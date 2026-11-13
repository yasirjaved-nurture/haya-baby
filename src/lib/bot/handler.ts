/* eslint-disable @typescript-eslint/no-explicit-any */
import { admin } from "../supabase/admin";
import { parseMessage, pickProductByPhoto, type ParsedIntent, type TargetRef } from "../ai";
import {
  attachMedia,
  createProduct,
  loadCatalog,
  lowStock,
  matchVariant,
  type Catalog,
  type CatalogProduct,
  type MediaRef,
} from "../inventory";
import { formatPKR, normalizePhone, startOfStoreDay, STATUS_LABEL, variantLabel } from "../format";
import { getStoreSettings } from "../settings";
import { transcribe } from "../transcribe";
import {
  downloadMedia,
  markRead,
  sendButtons,
  sendList,
  sendText,
  type Incoming,
} from "../whatsapp";
import type { Variant } from "../types";

type Ctx = { phone: string; actor: string };
type Action = {
  id: string;
  phone: string;
  kind: string;
  payload: any;
  status: string;
  summary: string | null;
  created_at: string;
  undo: any;
};

const SITE = () => (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "");
const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const db = () => admin();

// ════════════════════════ entry ════════════════════════
export async function handleIncoming(msg: Incoming) {
  // Meta can deliver the same webhook more than once
  const { error: dup } = await db().from("wa_processed").insert({ id: msg.id });
  if (dup) return;

  const user = await getBotUser(msg.from);
  if (!user) return handleStranger(msg);

  void markRead(msg.id);
  const ctx: Ctx = { phone: msg.from, actor: `${user.name || "WhatsApp"} (${msg.from})` };
  try {
    await route(msg, ctx);
  } catch (e) {
    console.error("[bot]", e);
    await sendText(msg.from, `⚠️ Sorry, something went wrong: ${(e as Error)?.message ?? e}\nPlease try again.`).catch(() => {});
  }
}

async function getBotUser(phone: string): Promise<{ name: string | null } | null> {
  const { data } = await db().from("bot_users").select("name").eq("phone", phone).eq("active", true).maybeSingle();
  if (data) return data;
  const owners = (process.env.OWNER_PHONES || "").split(",").map((p) => normalizePhone(p)).filter(Boolean);
  return owners.includes(phone) ? { name: "Owner" } : null;
}

/** Someone who isn't staff messaged the bot number → friendly pointer to the shop (max once per 12h). */
async function handleStranger(msg: Incoming) {
  if (process.env.WA_CUSTOMER_AUTOREPLY === "false") return;
  const { data: s } = await db().from("bot_sessions").select("state").eq("phone", msg.from).maybeSingle();
  const last = s?.state?.autoReplyAt;
  if (last && Date.now() - new Date(last).getTime() < 12 * 3600_000) return;
  await db()
    .from("bot_sessions")
    .upsert({ phone: msg.from, state: { ...(s?.state ?? {}), autoReplyAt: new Date().toISOString() }, updated_at: new Date().toISOString() });
  const settings = await getStoreSettings(db());
  const chat = settings.whatsapp_contact ? `\n💬 Questions? Chat with us: https://wa.me/${normalizePhone(settings.whatsapp_contact)}` : "";
  await sendText(
    msg.from,
    `Hi${msg.name ? ` ${msg.name}` : ""}! 👋 Thanks for messaging *${settings.shop_name}*.\n\n🛍️ Browse & order here: ${SITE()}${chat}`,
  );
}

// ════════════════════════ routing ════════════════════════
async function route(msg: Incoming, ctx: Ctx) {
  switch (msg.type) {
    case "interactive":
      return onButton(msg.buttonId || "", ctx);

    case "audio": {
      const { buffer, mime } = await downloadMedia(msg.mediaId!);
      const text = await transcribe(buffer, mime);
      if (!text) return sendText(ctx.phone, "🎙️ Voice notes aren't switched on yet — please type it instead 🙏");
      await sendText(ctx.phone, `🎙️ _“${text}”_`);
      return onText(text, ctx);
    }

    case "image":
    case "video":
    case "document": {
      const kind = msg.type === "video" ? "video" : msg.mime?.startsWith("image/") ? "image" : null;
      if (!kind) return sendText(ctx.phone, "I can read photos, videos and voice notes. For a document, send a photo or screenshot of it 📸");
      const saved = await saveMedia(ctx.phone, msg.mediaId!, kind, msg.mime);
      if (msg.caption?.trim()) {
        await sleep(3500); // let the other photos of the same batch arrive
        return onText(msg.caption, ctx);
      }
      return onLooseMedia(saved, ctx);
    }

    case "text":
      return onText(msg.text || "", ctx);

    default:
      return sendText(ctx.phone, "I can read text, photos, videos and voice notes 🙂 Type *help* for examples.");
  }
}

// ════════════════════════ media ════════════════════════
async function saveMedia(phone: string, mediaId: string, kind: "image" | "video", mimeHint?: string): Promise<MediaRef> {
  const { buffer, mime } = await downloadMedia(mediaId);
  const type = (mime || mimeHint || "").split(";")[0];
  const ext = type.split("/")[1]?.replace("jpeg", "jpg") || (kind === "image" ? "jpg" : "mp4");
  const path = `inbox/${phone}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await db().storage.from("product-images").upload(path, buffer, { contentType: type, upsert: false });
  if (error) throw error;
  const url = db().storage.from("product-images").getPublicUrl(path).data.publicUrl;
  const { data, error: insErr } = await db()
    .from("bot_media")
    .insert({ phone, kind, mime: type, storage_path: path, url })
    .select("id, kind, url, storage_path")
    .single();
  if (insErr) throw insErr;
  return data as MediaRef;
}

async function getMedia(phone: string, extraIds: string[] = []): Promise<MediaRef[]> {
  const { data: recent } = await db()
    .from("bot_media")
    .select("id, kind, url, storage_path")
    .eq("phone", phone)
    .eq("used", false)
    .gte("created_at", minutesAgo(15))
    .order("created_at");
  const list = (recent ?? []) as MediaRef[];
  if (extraIds.length) {
    const { data: extra } = await db().from("bot_media").select("id, kind, url, storage_path").in("id", extraIds);
    for (const m of (extra ?? []) as MediaRef[]) if (!list.some((x) => x.id === m.id)) list.push(m);
  }
  return list;
}

async function markUsed(media: MediaRef[]) {
  if (media.length) await db().from("bot_media").update({ used: true }).in("id", media.map((m) => m.id));
}

/** Photo/video without a caption. */
async function onLooseMedia(saved: MediaRef, ctx: Ctx) {
  // More photos of a product the bot is already asking to confirm → add them silently
  const { data: pending } = await db()
    .from("bot_actions")
    .select("*")
    .eq("phone", ctx.phone)
    .eq("status", "pending")
    .in("kind", ["create_product", "attach_media"])
    .gte("created_at", minutesAgo(3))
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (pending) {
    const payload = { ...pending.payload, media: [...(pending.payload.media ?? []), saved] };
    await db().from("bot_actions").update({ payload }).eq("id", pending.id);
    await markUsed([saved]);
    return;
  }

  const session = await getSession(ctx.phone);
  if (session.draft) return; // we're waiting for details — the photo will be used with the next message

  // Only prompt once per batch of photos
  await sleep(1500);
  const { data: me } = await db().from("bot_media").select("created_at").eq("id", saved.id).single();
  const { count: earlier } = await db()
    .from("bot_media")
    .select("id", { count: "exact", head: true })
    .eq("phone", ctx.phone)
    .eq("used", false)
    .gte("created_at", minutesAgo(2))
    .lt("created_at", me?.created_at ?? new Date().toISOString());
  if ((earlier ?? 0) > 0) return;

  await sendText(
    ctx.phone,
    `📸 Got it! What should I do with ${saved.kind === "video" ? "this video" : "this"}?\n\n` +
      `• *New product:* new, 1450, 0-3m 5, 3-6m 5\n` +
      `• *Sold:* sold 2  /  3-6m 2 bik gaye\n` +
      `• *Restock:* 10 aa gaye\n` +
      `• *Out of stock:* khatam\n` +
      `• *Add to a product:* add to blue romper`,
  );
}

// ════════════════════════ session ════════════════════════
async function getSession(phone: string): Promise<any> {
  const { data } = await db().from("bot_sessions").select("state, updated_at").eq("phone", phone).maybeSingle();
  if (!data) return {};
  // drafts older than 2h are stale
  if (data.state?.draft && Date.now() - new Date(data.updated_at).getTime() > 2 * 3600_000) return { ...data.state, draft: undefined };
  return data.state ?? {};
}
async function saveSession(phone: string, state: any) {
  await db().from("bot_sessions").upsert({ phone, state, updated_at: new Date().toISOString() });
}
async function clearDraft(phone: string, state: any) {
  if (state?.draft) await saveSession(phone, { ...state, draft: undefined, draftMediaIds: undefined });
}

// ════════════════════════ text ════════════════════════
async function onText(text: string, ctx: Ctx) {
  const t = text.trim().toLowerCase();
  if (["help", "menu", "?", "madad"].includes(t)) return sendHelp(ctx);
  if (["undo", "galti", "undo last"].includes(t)) return undoLast(ctx);
  if (["cancel", "chhoro", "chodo", "stop", "rehne do"].includes(t)) return cancelAll(ctx);

  const session = await getSession(ctx.phone);
  const media = await getMedia(ctx.phone, session.draftMediaIds ?? []);
  const images = media.filter((m) => m.kind === "image");
  const catalog = await loadCatalog();

  const parsed = await parseMessage({
    text,
    images: images.map((m) => ({ url: m.url })),
    videos: media.filter((m) => m.kind === "video").length,
    catalog: catalog.lines,
    categories: catalog.categories.map((c) => c.name),
    draft: session.draft,
  });

  if (parsed.intent !== "create_product" && parsed.intent !== "unclear") {
    await clearDraft(ctx.phone, session);
  }

  switch (parsed.intent) {
    case "help":
      return sendHelp(ctx);
    case "undo":
      return undoLast(ctx);
    case "cancel":
      return cancelAll(ctx);
    case "unclear":
      return sendText(ctx.phone, parsed.reply || "Sorry, I didn't get that 🙈 Type *help* for examples.");
    case "create_product":
      return onCreate(parsed, media, session, ctx);
    case "stock":
      await markUsed(media);
      return onStock(parsed, images, catalog, ctx);
    case "set_status":
    case "set_price":
    case "attach_media": {
      if (parsed.intent === "attach_media" && !media.length)
        return sendText(ctx.phone, "Send the photo(s) with a caption like *add to blue romper* 📸");
      if (parsed.intent === "set_price" && !parsed.price) return sendText(ctx.phone, parsed.reply || "What's the new price?");
      await markUsed(media);
      const action = await createAction(ctx, parsed.intent, {
        target: parsed.target ?? { product_refs: [], product_hint: "" },
        status: parsed.status,
        price: parsed.price,
        compare_at_price: parsed.compare_at_price,
        media: parsed.intent === "attach_media" ? media : [],
        images,
      });
      return advance(action, catalog);
    }
    case "update_order":
      return onOrderUpdate(parsed, ctx);
    case "query":
      await markUsed(media);
      return onQuery(parsed, images, catalog, ctx);
    default:
      return sendText(ctx.phone, "Sorry, I didn't get that 🙈 Type *help* for examples.");
  }
}

// ──────────── create product ────────────
async function onCreate(parsed: ParsedIntent, media: MediaRef[], session: any, ctx: Ctx) {
  const product = parsed.product ?? {};
  const missing = new Set(parsed.missing ?? []);
  if (!product.price) missing.add("price");
  if (!product.variants?.length || product.variants.some((v) => v.stock == null)) missing.add("stock");
  if (!product.name) missing.add("name");

  if (missing.size) {
    await saveSession(ctx.phone, {
      ...session,
      draft: { intent: "create_product", product },
      draftMediaIds: media.map((m) => m.id),
    });
    const ask =
      parsed.reply ||
      (missing.has("price") && missing.has("stock")
        ? "💰 What's the price, and how many pieces (per size)?"
        : missing.has("price")
          ? "💰 What's the price?"
          : missing.has("stock")
            ? "📦 How many pieces? (per size if there are sizes, e.g. 0-3m 4, 3-6m 6)"
            : "🏷️ What should I call this product?");
    return sendText(ctx.phone, ask);
  }

  await clearDraft(ctx.phone, session);
  await markUsed(media);
  const action = await createAction(ctx, "create_product", { product, media });
  return confirmAction(action);
}

// ──────────── stock ────────────
async function onStock(parsed: ParsedIntent, images: MediaRef[], catalog: Catalog, ctx: Ctx) {
  const items = parsed.items ?? [];
  if (!items.length) return sendText(ctx.phone, parsed.reply || "Which product, and how many?");

  if (items.length === 1) {
    const it = items[0];
    const action = await createAction(ctx, "stock", {
      target: it,
      mode: it.mode,
      quantity: it.quantity,
      images,
    });
    return advance(action, catalog);
  }

  // many lines (register / invoice / list) → best match for each, one confirmation
  const lines: any[] = [];
  const unresolved: string[] = [];
  for (const it of items) {
    const p = refToProduct(it.product_refs?.[0], catalog);
    const v = p ? matchVariant(p, it.size, it.color) : null;
    if (!p || !v) {
      unresolved.push(`${it.product_hint}${it.size ? ` ${it.size}` : ""}${p && !v ? " (which size?)" : ""}`);
      continue;
    }
    lines.push({ productId: p.id, variantId: v.id, mode: it.mode, quantity: it.quantity });
  }
  if (!lines.length)
    return sendText(ctx.phone, `❓ I couldn't match these to your products:\n${unresolved.map((u) => `• ${u}`).join("\n")}\n\nTry the names as shown on the dashboard.`);
  const action = await createAction(ctx, "stock_bulk", { lines, unresolved });
  return confirmAction(action);
}

// ════════════════════════ actions ════════════════════════
async function createAction(ctx: Ctx, kind: string, payload: any): Promise<Action> {
  // only one open request at a time keeps things simple for the owner
  await db().from("bot_actions").update({ status: "expired" }).eq("phone", ctx.phone).eq("status", "pending");
  const { data, error } = await db()
    .from("bot_actions")
    .insert({ phone: ctx.phone, kind, payload: { ...payload, actor: ctx.actor } })
    .select()
    .single();
  if (error) throw error;
  return data as Action;
}

async function saveAction(action: Action, patch: Partial<Action>) {
  Object.assign(action, patch);
  await db().from("bot_actions").update(patch).eq("id", action.id);
}

async function getProduct(id: string): Promise<CatalogProduct | null> {
  const { data } = await db().from("products").select("*, variants(*), product_images(url, sort)").eq("id", id).maybeSingle();
  if (!data) return null;
  const imgs = [...(data.product_images ?? [])].sort((a: any, b: any) => a.sort - b.sort);
  return { ...data, variants: [...(data.variants ?? [])].sort((a: Variant, b: Variant) => a.sort - b.sort), firstImage: imgs[0]?.url };
}

function refToProduct(ref: string | undefined, catalog: Catalog) {
  return ref ? catalog.byRef.get(ref.trim().toUpperCase()) : undefined;
}

/** Work out which product the owner means — from text refs and/or by comparing photos. */
async function resolveProduct(target: TargetRef, images: MediaRef[], catalog: Catalog) {
  const refs = (target?.product_refs ?? []).map((r) => refToProduct(r, catalog)).filter(Boolean) as CatalogProduct[];

  if (images.length && refs.length !== 1) {
    const pool = refs.filter((p) => p.firstImage);
    for (const p of catalog.byRef.values()) {
      if (pool.length >= 8) break;
      if (p.firstImage && !pool.includes(p)) pool.push(p);
    }
    if (pool.length) {
      const pick = await pickProductByPhoto(
        images.map((m) => ({ url: m.url })),
        pool.map((p, i) => ({ ref: `C${i + 1}`, name: p.name, imageUrl: p.firstImage! })),
      );
      const chosen = pick.ref ? pool[Number(pick.ref.replace(/\D/g, "")) - 1] : undefined;
      const ordered = chosen ? [chosen, ...pool.filter((p) => p !== chosen)] : refs.length ? refs : pool;
      if (chosen && pick.confidence !== "low") return { product: chosen, candidates: ordered.slice(0, 9) };
      return { product: undefined, candidates: ordered.slice(0, 9) };
    }
  }
  if (refs.length === 1) return { product: refs[0], candidates: refs };
  return { product: undefined, candidates: refs.slice(0, 9) };
}

const needsVariant = (a: Action) => a.kind === "stock" || (a.kind === "set_price" && (a.payload.target?.size || a.payload.target?.color));

/** Fill in product → variant (asking the owner when unsure), then confirm. */
async function advance(action: Action, catalog?: Catalog) {
  const p = action.payload;

  if (!p.productId) {
    catalog ??= await loadCatalog();
    const res = await resolveProduct(p.target, p.images ?? [], catalog);
    p.candidates = res.candidates.map((c) => c.id);
    if (res.product) {
      p.productId = res.product.id;
    } else if (res.candidates.length) {
      await saveAction(action, { payload: p });
      return askProduct(action, res.candidates);
    } else {
      await saveAction(action, { status: "cancelled" });
      const hint = p.target?.product_hint ? ` “${p.target.product_hint}”` : "";
      return sendText(
        action.phone,
        `❓ I couldn't find${hint} in your products.\nTry the name as shown on the dashboard, or send a photo of it.` +
          (action.kind === "stock" && (p.target?.quantity ?? 0) > 0 ? `\n\nIf it's a *new* product, send its photo with the price and stock.` : ""),
      );
    }
  }

  const prod = await getProduct(p.productId);
  if (!prod) {
    await saveAction(action, { status: "cancelled" });
    return sendText(action.phone, "That product no longer exists.");
  }

  if (needsVariant(action) && !p.variantId) {
    const v = matchVariant(prod, p.target?.size, p.target?.color);
    if (v) p.variantId = v.id;
    else {
      await saveAction(action, { payload: p });
      return sendList(
        action.phone,
        `Which size/colour of *${prod.name}*?`,
        "Choose size",
        prod.variants.map((v) => ({ id: `v:${action.id}:${v.id}`, title: variantLabel(v), description: `In stock: ${v.stock}` })),
        "Sizes",
      );
    }
  }

  await saveAction(action, { payload: p });
  if (action.kind === "query_product") {
    await saveAction(action, { status: "expired" });
    return sendProductInfo(action.phone, prod);
  }
  return confirmAction(action, prod);
}

async function askProduct(action: Action, candidates: CatalogProduct[]) {
  const hint = action.payload.target?.product_hint;
  return sendList(
    action.phone,
    `Which product do you mean${hint ? ` (“${hint}”)` : ""}?`,
    "Choose product",
    candidates.map((c) => ({
      id: `p:${action.id}:${c.id}`,
      title: c.name,
      description: `${formatPKR(c.price)} · ${c.variants.reduce((s, v) => s + v.stock, 0)} in stock · ${STATUS_LABEL[c.status]}`,
    })),
    "Products",
  );
}

// ──────────── confirmation messages ────────────
async function confirmAction(action: Action, prod?: CatalogProduct | null) {
  const p = action.payload;
  const okNo = (okTitle = "✅ Confirm") => [
    { id: `ok:${action.id}`, title: okTitle },
    ...((p.candidates?.length ?? 0) > 1 ? [{ id: `re:${action.id}`, title: "🔄 Other product" }] : []),
    { id: `no:${action.id}`, title: "❌ Cancel" },
  ];
  let text = "";
  let image = prod?.firstImage;
  let buttons = okNo();

  switch (action.kind) {
    case "create_product": {
      const d = p.product;
      const media: MediaRef[] = p.media ?? [];
      const photos = media.filter((m) => m.kind === "image").length;
      const videos = media.filter((m) => m.kind === "video").length;
      const vs = (d.variants ?? []).map((v: any) => `   ${variantLabel(v)}: ${v.stock ?? 0}`).join("\n");
      text =
        `🆕 *${d.name}*\n` +
        `💰 ${formatPKR(d.price)}${d.compare_at_price ? ` ~(was ${formatPKR(d.compare_at_price)})~` : ""}\n` +
        `📦 Stock:\n${vs}\n` +
        (d.category ? `🏷️ ${d.category}\n` : "") +
        `📸 ${photos} photo${photos === 1 ? "" : "s"}${videos ? ` · 🎬 ${videos} video` : ""}\n` +
        (d.description ? `\n${d.description}` : "");
      image = media.find((m) => m.kind === "image")?.url;
      buttons = [
        { id: `ok:${action.id}`, title: "✅ Save" },
        { id: `ed:${action.id}`, title: "✏️ Edit" },
        { id: `no:${action.id}`, title: "❌ Cancel" },
      ];
      break;
    }
    case "stock": {
      const v = prod!.variants.find((x) => x.id === p.variantId)!;
      const next = p.mode === "set" ? p.quantity : v.stock + p.quantity;
      const verb = p.mode === "set" ? "Set stock" : p.quantity < 0 ? `Sold ${-p.quantity}` : `Added ${p.quantity}`;
      text =
        `📦 *${prod!.name}*${prod!.variants.length > 1 ? ` (${variantLabel(v)})` : ""}\n${verb}\n\nStock: ${v.stock} → *${Math.max(0, next)}*` +
        (next < 0 ? `\n\n⚠️ Only ${v.stock} were in stock — I'll set it to 0.` : "") +
        (Math.max(0, next) === 0 ? `\n🔴 Will show as *sold out*` : "");
      break;
    }
    case "stock_bulk": {
      const ids = p.lines.map((l: any) => l.variantId);
      const { data: vs } = await db().from("variants").select("id, size, color, stock, products(name)").in("id", ids);
      const byId = new Map((vs ?? []).map((v: any) => [v.id, v]));
      const rows = p.lines.map((l: any) => {
        const v: any = byId.get(l.variantId);
        const next = Math.max(0, l.mode === "set" ? l.quantity : v.stock + l.quantity);
        return `• ${v.products?.name}${v.size || v.color ? ` (${variantLabel(v)})` : ""}: ${v.stock} → *${next}*`;
      });
      text =
        `📋 *${p.lines.length} stock update${p.lines.length > 1 ? "s" : ""}*\n\n${rows.join("\n")}` +
        (p.unresolved?.length ? `\n\n❓ Skipped (not found):\n${p.unresolved.map((u: string) => `• ${u}`).join("\n")}` : "");
      buttons = [
        { id: `ok:${action.id}`, title: "✅ Confirm all" },
        { id: `no:${action.id}`, title: "❌ Cancel" },
      ];
      image = undefined;
      break;
    }
    case "set_status": {
      const emoji = { active: "🟢", sold_out: "🔴", hidden: "🙈" }[p.status as string] ?? "•";
      text = `${emoji} *${prod!.name}*\n${STATUS_LABEL[prod!.status]} → *${STATUS_LABEL[p.status] ?? p.status}*` +
        (p.status === "hidden" ? "\n\nCustomers won't see it on the website." : "");
      break;
    }
    case "set_price": {
      const v = p.variantId ? prod!.variants.find((x) => x.id === p.variantId) : null;
      const old = v?.price ?? prod!.price;
      text = `💰 *${prod!.name}*${v ? ` (${variantLabel(v)})` : ""}\n${formatPKR(old)} → *${formatPKR(p.price)}*` +
        (p.compare_at_price ? `\nShown as sale from ${formatPKR(p.compare_at_price)}` : "");
      break;
    }
    case "attach_media": {
      const media: MediaRef[] = p.media ?? [];
      const photos = media.filter((m) => m.kind === "image").length;
      const videos = media.filter((m) => m.kind === "video").length;
      text = `📸 Add ${[photos ? `${photos} photo${photos > 1 ? "s" : ""}` : "", videos ? "the video" : ""].filter(Boolean).join(" + ")} to *${prod!.name}*?`;
      break;
    }
    case "update_order": {
      const o = p.order;
      text =
        `🧾 *Order #${o.order_number}* — ${o.customer_name}, ${formatPKR(o.total)}\n` +
        (p.status ? `Status: ${o.status} → *${p.status}*\n` : "") +
        (p.payment_status ? `Payment: ${o.payment_status} → *${p.payment_status}*\n` : "") +
        (p.status === "cancelled" ? "\nItems will go back into stock." : "");
      image = undefined;
      break;
    }
  }

  await saveAction(action, { summary: text.split("\n")[0].replace(/\*/g, "") });
  return sendButtons(action.phone, text.trim(), buttons, image);
}

// ════════════════════════ buttons ════════════════════════
async function onButton(id: string, ctx: Ctx) {
  const [op, actionId, extra] = id.split(":");
  if (op === "noop") return;
  const { data } = await db().from("bot_actions").select("*").eq("id", actionId).eq("phone", ctx.phone).maybeSingle();
  const action = data as Action | null;
  if (!action) return sendText(ctx.phone, "That request has expired — please send it again.");
  if (action.status !== "pending")
    return sendText(ctx.phone, action.status === "applied" ? "✅ Already done." : "That request is no longer open — please send it again.");
  if (Date.now() - new Date(action.created_at).getTime() > 24 * 3600_000) {
    await saveAction(action, { status: "expired" });
    return sendText(ctx.phone, "That request has expired — please send it again.");
  }

  switch (op) {
    case "ok":
      return applyAction(action);
    case "no":
      await saveAction(action, { status: "cancelled" });
      return sendText(ctx.phone, "❌ Cancelled — nothing changed.");
    case "ed": {
      await saveAction(action, { status: "cancelled" });
      const session = await getSession(ctx.phone);
      await saveSession(ctx.phone, {
        ...session,
        draft: { intent: "create_product", product: action.payload.product },
        draftMediaIds: (action.payload.media ?? []).map((m: MediaRef) => m.id),
      });
      return sendText(ctx.phone, "✏️ What should I change?\ne.g. *price 1300*, *name Pink Bunny Romper*, *0-3m 4, 3-6m 6*, *category Starter Sets*");
    }
    case "re": {
      const ids: string[] = action.payload.candidates ?? [];
      const prods = (await Promise.all(ids.map(getProduct))).filter(Boolean) as CatalogProduct[];
      const others = prods.filter((pp) => pp.id !== action.payload.productId);
      if (!others.length) {
        await saveAction(action, { status: "cancelled" });
        return sendText(ctx.phone, "Okay — please type the product name, e.g. *sold 2 pink bunny romper 3-6m*");
      }
      action.payload.productId = null;
      action.payload.variantId = null;
      await saveAction(action, { payload: action.payload });
      return askProduct(action, others);
    }
    case "p":
      action.payload.productId = extra;
      action.payload.variantId = null;
      await saveAction(action, { payload: action.payload });
      return advance(action);
    case "v":
      action.payload.variantId = extra;
      await saveAction(action, { payload: action.payload });
      return advance(action);
    default:
      return sendText(ctx.phone, "Sorry, I didn't get that.");
  }
}

// ════════════════════════ apply & undo ════════════════════════
const stockReason = (mode: string, q: number) =>
  mode === "set" ? "Stock count (WhatsApp)" : q < 0 ? "Sold (WhatsApp)" : "Restock (WhatsApp)";

async function applyStockLines(lines: any[], actor: string) {
  const ids = lines.map((l) => l.variantId);
  const { data: before } = await db().from("variants").select("id, stock, size, color, product_id, products(name)").in("id", ids);
  const byId = new Map((before ?? []).map((v: any) => [v.id, v]));
  const undo: { variantId: string; change: number }[] = [];
  const out: string[] = [];
  for (const l of lines) {
    const v: any = byId.get(l.variantId);
    if (!v) continue;
    const { data: after, error } =
      l.mode === "set"
        ? await db().rpc("set_stock", { p_variant: l.variantId, p_stock: l.quantity, p_reason: stockReason("set", 0), p_source: "whatsapp", p_actor: actor })
        : await db().rpc("adjust_stock", {
            p_variant: l.variantId,
            p_change: l.quantity,
            p_reason: stockReason("change", l.quantity),
            p_source: "whatsapp",
            p_actor: actor,
            p_clamp: true,
          });
    if (error) throw error;
    const newStock = Number(after);
    undo.push({ variantId: l.variantId, change: v.stock - newStock });
    out.push(`• ${v.products?.name}${v.size || v.color ? ` (${variantLabel(v)})` : ""}: *${newStock}* left${newStock === 0 ? " 🔴" : ""}`);
  }
  return { undo, out };
}

async function applyAction(action: Action) {
  const p = action.payload;
  const actor = p.actor || action.phone;
  let undo: any = null;
  let reply = "";

  switch (action.kind) {
    case "create_product": {
      const prod = await createProduct(p.product, p.media ?? [], actor);
      undo = { type: "create", productId: prod.id };
      reply = `✅ Saved *${prod.name}*!\n🔗 ${SITE()}/product/${prod.slug}\n\nType *undo* to remove it.`;
      break;
    }
    case "stock":
    case "stock_bulk": {
      const lines = action.kind === "stock" ? [{ variantId: p.variantId, mode: p.mode, quantity: p.quantity }] : p.lines;
      const res = await applyStockLines(lines, actor);
      undo = { type: "stock", lines: res.undo };
      reply = `✅ Stock updated\n${res.out.join("\n")}`;
      break;
    }
    case "set_status": {
      const { data: prev } = await db().from("products").select("status, name, slug").eq("id", p.productId).single();
      await db().from("products").update({ status: p.status }).eq("id", p.productId);
      undo = { type: "status", productId: p.productId, prev: prev?.status };
      reply = `✅ *${prev?.name}* is now *${STATUS_LABEL[p.status]}*`;
      break;
    }
    case "set_price": {
      if (p.variantId) {
        const { data: prev } = await db().from("variants").select("price").eq("id", p.variantId).single();
        await db().from("variants").update({ price: p.price }).eq("id", p.variantId);
        undo = { type: "variant_price", variantId: p.variantId, prev: prev?.price ?? null };
      } else {
        const { data: prev } = await db().from("products").select("price, compare_at_price").eq("id", p.productId).single();
        await db()
          .from("products")
          .update({ price: p.price, ...(p.compare_at_price !== undefined ? { compare_at_price: p.compare_at_price } : {}) })
          .eq("id", p.productId);
        undo = { type: "price", productId: p.productId, prev: prev?.price, prevCompare: prev?.compare_at_price ?? null };
      }
      reply = `✅ Price updated to *${formatPKR(p.price)}*`;
      break;
    }
    case "attach_media": {
      const res = await attachMedia(p.productId, p.media ?? []);
      undo = { type: "media", productId: p.productId, ...res };
      reply = `✅ Added to the product page.`;
      break;
    }
    case "update_order": {
      const o = p.order;
      if (p.status === "cancelled") {
        const { error } = await db().rpc("cancel_order", { p_order: o.id, p_actor: actor });
        if (error) throw error;
      } else if (p.status) {
        await db().from("orders").update({ status: p.status }).eq("id", o.id);
      }
      if (p.payment_status) await db().from("orders").update({ payment_status: p.payment_status }).eq("id", o.id);
      undo = p.status === "cancelled" ? null : { type: "order", orderId: o.id, prevStatus: o.status, prevPayment: o.payment_status };
      reply = `✅ Order #${o.order_number} updated` + (p.status === "cancelled" ? " — items are back in stock." : ".");
      break;
    }
  }

  await saveAction(action, { status: "applied", undo, applied_at: new Date().toISOString() } as any);
  return sendText(action.phone, reply);
}

async function undoLast(ctx: Ctx) {
  const { data } = await db()
    .from("bot_actions")
    .select("*")
    .eq("phone", ctx.phone)
    .eq("status", "applied")
    .not("undo", "is", null)
    .gte("applied_at", minutesAgo(24 * 60))
    .order("applied_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const action = data as Action | null;
  if (!action) return sendText(ctx.phone, "There's nothing to undo from the last 24 hours.");
  const u = action.undo;

  switch (u.type) {
    case "create":
      await db().from("products").delete().eq("id", u.productId);
      break;
    case "stock":
      for (const l of u.lines)
        await db().rpc("adjust_stock", { p_variant: l.variantId, p_change: l.change, p_reason: "Undo (WhatsApp)", p_source: "whatsapp", p_actor: ctx.actor, p_clamp: true });
      break;
    case "status":
      await db().from("products").update({ status: u.prev }).eq("id", u.productId);
      break;
    case "price":
      await db().from("products").update({ price: u.prev, compare_at_price: u.prevCompare }).eq("id", u.productId);
      break;
    case "variant_price":
      await db().from("variants").update({ price: u.prev }).eq("id", u.variantId);
      break;
    case "media":
      if (u.imageIds?.length) await db().from("product_images").delete().in("id", u.imageIds);
      if (u.setVideo) await db().from("products").update({ video_url: u.prevVideo }).eq("id", u.productId);
      break;
    case "order":
      await db().from("orders").update({ status: u.prevStatus, payment_status: u.prevPayment }).eq("id", u.orderId);
      break;
  }
  await saveAction(action, { status: "undone" });
  return sendText(ctx.phone, `↩️ Undone: ${action.summary ?? action.kind}`);
}

async function cancelAll(ctx: Ctx) {
  await db().from("bot_actions").update({ status: "cancelled" }).eq("phone", ctx.phone).eq("status", "pending");
  await db().from("bot_media").update({ used: true }).eq("phone", ctx.phone).eq("used", false);
  const session = await getSession(ctx.phone);
  await clearDraft(ctx.phone, session);
  return sendText(ctx.phone, "👍 Okay, cleared. Nothing was changed.");
}

// ════════════════════════ orders & queries ════════════════════════
async function onOrderUpdate(parsed: ParsedIntent, ctx: Ctx) {
  const num = parsed.order?.order_number;
  if (!num) return sendText(ctx.phone, "Which order number? e.g. *order 1023 shipped*");
  const { data: order } = await db().from("orders").select("*").eq("order_number", num).maybeSingle();
  if (!order) return sendText(ctx.phone, `I couldn't find order #${num}.`);
  if (!parsed.order?.status && !parsed.order?.payment_status) return sendOrderInfo(ctx.phone, order.id);
  const action = await createAction(ctx, "update_order", {
    order,
    status: parsed.order?.status !== order.status ? parsed.order?.status : undefined,
    payment_status: parsed.order?.payment_status,
  });
  return confirmAction(action);
}

async function sendOrderInfo(phone: string, orderId: string) {
  const { data: o } = await db().from("orders").select("*, order_items(*)").eq("id", orderId).single();
  const items = (o.order_items ?? []).map((i: any) => `• ${i.qty} × ${i.name}${i.size ? ` (${i.size})` : ""} — ${formatPKR(i.price * i.qty)}`).join("\n");
  return sendText(
    phone,
    `🧾 *Order #${o.order_number}* · ${o.status}\n${items}\n\n*Total:* ${formatPKR(o.total)} (${o.payment_method}, ${o.payment_status})\n` +
      `*Customer:* ${o.customer_name} · ${o.phone}\n${o.address}, ${o.city}${o.notes ? `\n📝 ${o.notes}` : ""}`,
  );
}

async function sendProductInfo(phone: string, prod: CatalogProduct) {
  const total = prod.variants.reduce((s, v) => s + v.stock, 0);
  const vs = prod.variants.map((v) => `• ${variantLabel(v)}: *${v.stock}*${v.price ? ` (${formatPKR(v.price)})` : ""}`).join("\n");
  const text = `📦 *${prod.name}*\n${formatPKR(prod.price)} · ${STATUS_LABEL[prod.status]}\n\n${vs}\n\nTotal: *${total}*\n🔗 ${SITE()}/product/${prod.slug}`;
  return prod.firstImage
    ? sendButtons(phone, text, [{ id: "noop:x", title: "👍 Thanks" }], prod.firstImage)
    : sendText(phone, text);
}

async function onQuery(parsed: ParsedIntent, images: MediaRef[], catalog: Catalog, ctx: Ctx) {
  const kind = parsed.query?.kind ?? "stock_summary";
  const settings = await getStoreSettings(db());

  if (kind === "product_info") {
    const action = await createAction(ctx, "query_product", { target: parsed.target ?? { product_refs: [], product_hint: "" }, images });
    return advance(action, catalog);
  }

  if (kind === "low_stock") {
    const rows = await lowStock(settings.low_stock_threshold);
    if (!rows.length) return sendText(ctx.phone, `✅ Nothing is running low (all above ${settings.low_stock_threshold}).`);
    return sendText(
      ctx.phone,
      `⚠️ *Low stock* (≤ ${settings.low_stock_threshold})\n\n` +
        rows.map((r) => `${r.stock === 0 ? "🔴" : "🟡"} ${r.products.name}${r.size || r.color ? ` (${variantLabel(r)})` : ""}: *${r.stock}*`).join("\n"),
    );
  }

  if (kind === "today_sales") {
    const { data } = await db().from("orders").select("total, status, order_items(qty)").gte("created_at", startOfStoreDay());
    const live = (data ?? []).filter((o: any) => o.status !== "cancelled");
    const revenue = live.reduce((s: number, o: any) => s + o.total, 0);
    const units = live.reduce((s: number, o: any) => s + (o.order_items ?? []).reduce((a: number, i: any) => a + i.qty, 0), 0);
    const pending = live.filter((o: any) => o.status === "pending").length;
    // stock marked sold via WhatsApp today (Instagram / shop sales)
    const { data: mv } = await db()
      .from("stock_movements")
      .select("change")
      .eq("source", "whatsapp")
      .eq("reason", "Sold (WhatsApp)")
      .gte("created_at", startOfStoreDay());
    const waSold = (mv ?? []).reduce((s: number, m: any) => s - m.change, 0);
    return sendText(
      ctx.phone,
      `📊 *Today*\n\n🌐 Website: *${live.length}* order${live.length === 1 ? "" : "s"} · ${units} items · *${formatPKR(revenue)}*\n` +
        (pending ? `⏳ ${pending} waiting for confirmation\n` : "") +
        `💬 Marked sold on WhatsApp: *${waSold}* items`,
    );
  }

  if (kind === "recent_orders") {
    const { data } = await db().from("orders").select("order_number, customer_name, total, status, city").order("created_at", { ascending: false }).limit(6);
    if (!data?.length) return sendText(ctx.phone, "No orders yet.");
    const icon: Record<string, string> = { pending: "⏳", confirmed: "✅", shipped: "🚚", delivered: "📬", cancelled: "❌" };
    return sendText(
      ctx.phone,
      `🧾 *Recent orders*\n\n` +
        data.map((o: any) => `${icon[o.status] ?? "•"} #${o.order_number} · ${o.customer_name} (${o.city}) · ${formatPKR(o.total)}`).join("\n") +
        `\n\nReply e.g. *order ${data[0].order_number} shipped*`,
    );
  }

  // stock_summary
  const prods = [...catalog.byRef.values()];
  const active = prods.filter((p) => p.status === "active").length;
  const soldOut = prods.filter((p) => p.status === "sold_out").length;
  const hidden = prods.filter((p) => p.status === "hidden").length;
  const units = prods.reduce((s, p) => s + p.variants.reduce((a, v) => a + v.stock, 0), 0);
  return sendText(ctx.phone, `📦 *Stock overview*\n\n🟢 ${active} active\n🔴 ${soldOut} sold out\n🙈 ${hidden} hidden\n\nTotal pieces in stock: *${units}*`);
}

function sendHelp(ctx: Ctx) {
  return sendText(
    ctx.phone,
    `👋 *What I can do*\n\n` +
      `🆕 *Add a product* — send photos with:\n   _new, 1450, 0-3m 5, 3-6m 5_\n\n` +
      `📦 *Update stock* — text or photo + caption:\n   _sold 2 blue romper 3-6m_\n   _starter set 10 aa gaye_\n   _romper stock 6 hai_\n\n` +
      `📋 *Many at once* — photo of your register or supplier bill\n\n` +
      `🔴 *Status* — _pink frock khatam_ / _hide blanket_ / _show blanket_\n` +
      `💰 *Price* — _romper price 1300_\n` +
      `📸 *Add photos* — send photos with _add to blue romper_\n` +
      `🧾 *Orders* — _orders_ / _order 1023 shipped_ / _order 1023 paid_\n` +
      `📊 *Reports* — _low stock_ / _aaj ki sale_ / _kitna stock hai romper_\n\n` +
      `↩️ *undo* — reverse your last change\n❌ *cancel* — clear what we were doing\n\n` +
      `🎙️ Voice notes work too!`,
  );
}
