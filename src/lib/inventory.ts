import { admin } from "./supabase/admin";
import { slugify, variantLabel } from "./format";
import type { DraftProduct } from "./ai";
import type { Product, Variant } from "./types";

export type CatalogProduct = Product & { variants: Variant[]; firstImage?: string; categoryName?: string };
export type Catalog = { lines: string; byRef: Map<string, CatalogProduct>; byId: Map<string, CatalogProduct>; categories: { id: string; name: string }[] };

/** Loads the catalogue as compact text for the AI, with short refs (P1, P2, …). */
export async function loadCatalog(limit = 400): Promise<Catalog> {
  const db = admin();
  const [{ data: products }, { data: categories }] = await Promise.all([
    db
      .from("products")
      .select("*, variants(*), product_images(url, sort), categories(name)")
      .neq("status", "draft")
      .order("updated_at", { ascending: false })
      .limit(limit),
    db.from("categories").select("id, name").order("sort"),
  ]);

  const byRef = new Map<string, CatalogProduct>();
  const byId = new Map<string, CatalogProduct>();
  const lines: string[] = [];
  (products ?? []).forEach((p: Product & { categories?: { name: string } | null }, i: number) => {
    const ref = `P${i + 1}`;
    const imgs = [...(p.product_images ?? [])].sort((a, b) => a.sort - b.sort);
    const variants = [...(p.variants ?? [])].sort((a, b) => a.sort - b.sort);
    const cp: CatalogProduct = { ...p, variants, firstImage: imgs[0]?.url, categoryName: p.categories?.name };
    byRef.set(ref, cp);
    byId.set(p.id, cp);
    const vs = variants.map((v) => `${variantLabel(v)}:${v.stock}`).join(", ");
    const look = (p.ai_description || "").slice(0, 140);
    lines.push(`${ref} | ${p.name} | ${cp.categoryName ?? "-"} | ${p.price} | ${p.status} | ${vs} | ${look}`);
  });
  return { lines: lines.join("\n"), byRef, byId, categories: categories ?? [] };
}

const norm = (s?: string | null) =>
  (s || "")
    .toLowerCase()
    .replace(/months?|mnths?|mo\b/g, "m")
    .replace(/years?|yrs?/g, "y")
    .replace(/to/g, "-")
    .replace(/[\s_]/g, "");

/** Find the variant matching a size/colour. Returns null if ambiguous. */
export function matchVariant(p: CatalogProduct, size?: string, color?: string): Variant | null {
  const vs = p.variants;
  if (vs.length === 1) return vs[0];
  let list = vs;
  if (size) list = list.filter((v) => norm(v.size) === norm(size) || (norm(size) && norm(v.size).includes(norm(size))));
  if (color) {
    const byColor = list.filter((v) => norm(v.color) === norm(color) || (norm(color) && norm(v.color).includes(norm(color))));
    if (byColor.length) list = byColor;
  }
  return list.length === 1 ? list[0] : null;
}

async function uniqueSlug(name: string) {
  const db = admin();
  const base = slugify(name);
  const { data } = await db.from("products").select("slug").like("slug", `${base}%`);
  const taken = new Set((data ?? []).map((r: { slug: string }) => r.slug));
  if (!taken.has(base)) return base;
  let i = 2;
  while (taken.has(`${base}-${i}`)) i++;
  return `${base}-${i}`;
}

export type MediaRef = { id: string; kind: "image" | "video"; url: string; storage_path: string };

export async function createProduct(draft: DraftProduct, media: MediaRef[], actor: string) {
  const db = admin();
  const { data: cats } = await db.from("categories").select("id, name");
  const cat = (cats ?? []).find((c: { name: string }) => c.name.toLowerCase() === (draft.category || "").toLowerCase());
  const video = media.find((m) => m.kind === "video");

  const { data: product, error } = await db
    .from("products")
    .insert({
      name: draft.name || "New product",
      slug: await uniqueSlug(draft.name || "new-product"),
      description: draft.description ?? null,
      ai_description: draft.ai_description ?? null,
      category_id: cat?.id ?? null,
      price: draft.price ?? 0,
      compare_at_price: draft.compare_at_price ?? null,
      tags: draft.tags ?? [],
      video_url: video?.url ?? null,
      status: "active",
    })
    .select()
    .single();
  if (error) throw error;

  const variants = draft.variants?.length ? draft.variants : [{ stock: 0 }];
  const seen = new Set<string>();
  const rows = variants
    .map((v, i) => ({ product_id: product.id, size: v.size?.trim() || "", color: v.color?.trim() || "", stock: 0, sort: i, _qty: v.stock ?? 0 }))
    .filter((r) => {
      const k = `${r.size}|${r.color}`.toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  const { data: inserted, error: vErr } = await db
    .from("variants")
    .insert(rows.map(({ _qty, ...r }) => r))
    .select();
  if (vErr) throw vErr;

  for (const v of inserted ?? []) {
    const qty = rows.find((r) => r.size === v.size && r.color === v.color)?._qty ?? 0;
    if (qty > 0) await db.rpc("adjust_stock", { p_variant: v.id, p_change: qty, p_reason: "Initial stock", p_source: "whatsapp", p_actor: actor });
  }
  // a product created with 0 stock should show as sold out
  await db.rpc("refresh_product_status", { p_product: product.id });

  const images = media.filter((m) => m.kind === "image");
  if (images.length) {
    await db.from("product_images").insert(images.map((m, i) => ({ product_id: product.id, storage_path: m.storage_path, url: m.url, sort: i })));
  }
  return product as Product;
}

export async function attachMedia(productId: string, media: MediaRef[]) {
  const db = admin();
  const images = media.filter((m) => m.kind === "image");
  const video = media.find((m) => m.kind === "video");
  let ids: string[] = [];
  if (images.length) {
    const { data: existing } = await db.from("product_images").select("sort").eq("product_id", productId).order("sort", { ascending: false }).limit(1);
    const start = (existing?.[0]?.sort ?? -1) + 1;
    const { data } = await db
      .from("product_images")
      .insert(images.map((m, i) => ({ product_id: productId, storage_path: m.storage_path, url: m.url, sort: start + i })))
      .select("id");
    ids = (data ?? []).map((r: { id: string }) => r.id);
  }
  let prevVideo: string | null = null;
  if (video) {
    const { data: p } = await db.from("products").select("video_url").eq("id", productId).single();
    prevVideo = p?.video_url ?? null;
    await db.from("products").update({ video_url: video.url }).eq("id", productId);
  }
  return { imageIds: ids, prevVideo, setVideo: !!video };
}

export async function lowStock(threshold: number) {
  const db = admin();
  const { data } = await db
    .from("variants")
    .select("id, size, color, stock, products!inner(name, status)")
    .lte("stock", threshold)
    .in("products.status", ["active", "sold_out"])
    .order("stock")
    .limit(25);
  return (data ?? []) as unknown as { id: string; size: string; color: string; stock: number; products: { name: string; status: string } }[];
}
