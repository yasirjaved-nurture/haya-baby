import crypto from "node:crypto";

const api = () => `https://graph.facebook.com/${process.env.WA_API_VERSION || "v24.0"}`;
const token = () => process.env.WA_ACCESS_TOKEN!;
const phoneId = () => process.env.WA_PHONE_NUMBER_ID!;

export const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

export class WhatsAppError extends Error {
  code?: number;
  constructor(message: string, code?: number) {
    super(message);
    this.code = code;
  }
}

async function send(body: Record<string, unknown>) {
  const res = await fetch(`${api()}/${phoneId()}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", ...body }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new WhatsAppError(json?.error?.message || `WhatsApp error ${res.status}`, json?.error?.code);
  return json;
}

export function sendText(to: string, text: string) {
  return send({ to, type: "text", text: { body: clip(text, 4096), preview_url: true } });
}

export type Button = { id: string; title: string };

/** Up to 3 reply buttons, optional image header (great for showing the product). */
export function sendButtons(to: string, text: string, buttons: Button[], imageUrl?: string, footer?: string) {
  return send({
    to,
    type: "interactive",
    interactive: {
      type: "button",
      ...(imageUrl ? { header: { type: "image", image: { link: imageUrl } } } : {}),
      body: { text: clip(text, 1024) },
      ...(footer ? { footer: { text: clip(footer, 60) } } : {}),
      action: {
        buttons: buttons.slice(0, 3).map((b) => ({ type: "reply", reply: { id: b.id, title: clip(b.title, 20) } })),
      },
    },
  });
}

export type ListRow = { id: string; title: string; description?: string };

/** A tappable list of up to 10 options. */
export function sendList(to: string, text: string, buttonLabel: string, rows: ListRow[], sectionTitle = "Options") {
  return send({
    to,
    type: "interactive",
    interactive: {
      type: "list",
      body: { text: clip(text, 1024) },
      action: {
        button: clip(buttonLabel, 20),
        sections: [
          {
            title: clip(sectionTitle, 24),
            rows: rows.slice(0, 10).map((r) => ({
              id: r.id.slice(0, 200),
              title: clip(r.title, 24),
              ...(r.description ? { description: clip(r.description, 72) } : {}),
            })),
          },
        ],
      },
    },
  });
}

export function sendImage(to: string, link: string, caption?: string) {
  return send({ to, type: "image", image: { link, ...(caption ? { caption: clip(caption, 1024) } : {}) } });
}

export function sendTemplate(to: string, name: string, params: string[], lang = process.env.WA_TEMPLATE_LANG || "en") {
  return send({
    to,
    type: "template",
    template: {
      name,
      language: { code: lang },
      components: params.length
        ? [{ type: "body", parameters: params.map((text) => ({ type: "text", text })) }]
        : [],
    },
  });
}

export async function markRead(messageId: string) {
  await fetch(`${api()}/${phoneId()}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", status: "read", message_id: messageId }),
  }).catch(() => {});
}

/** Download a media file the user sent (image, video, voice note). */
export async function downloadMedia(mediaId: string): Promise<{ buffer: ArrayBuffer; mime: string }> {
  const metaRes = await fetch(`${api()}/${mediaId}`, { headers: { Authorization: `Bearer ${token()}` } });
  const meta = await metaRes.json();
  if (!metaRes.ok || !meta?.url) throw new Error("Could not fetch media info from WhatsApp");
  const fileRes = await fetch(meta.url, { headers: { Authorization: `Bearer ${token()}` } });
  if (!fileRes.ok) throw new Error("Could not download media from WhatsApp");
  return { buffer: await fileRes.arrayBuffer(), mime: (meta.mime_type as string) || "application/octet-stream" };
}

/** Validates Meta's X-Hub-Signature-256 header. Skipped if WA_APP_SECRET is not set (dev only). */
export function verifySignature(rawBody: string, signature: string | null) {
  const secret = process.env.WA_APP_SECRET;
  if (!secret) return true;
  if (!signature?.startsWith("sha256=")) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(signature.slice(7), "hex");
  const b = Buffer.from(expected, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// ───────────── incoming webhook parsing ─────────────
export type Incoming = {
  id: string;
  from: string;
  name?: string;
  type: "text" | "image" | "video" | "audio" | "document" | "interactive" | "other";
  text?: string;
  caption?: string;
  mediaId?: string;
  mime?: string;
  buttonId?: string;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function extractMessages(body: any): Incoming[] {
  const out: Incoming[] = [];
  for (const entry of body?.entry ?? []) {
    for (const change of entry?.changes ?? []) {
      const value = change?.value;
      const names: Record<string, string> = {};
      for (const c of value?.contacts ?? []) names[c.wa_id] = c?.profile?.name;
      for (const m of value?.messages ?? []) {
        const base = { id: m.id as string, from: m.from as string, name: names[m.from] };
        switch (m.type) {
          case "text":
            out.push({ ...base, type: "text", text: m.text?.body ?? "" });
            break;
          case "image":
          case "video":
          case "audio":
          case "document": {
            const media = m[m.type];
            out.push({ ...base, type: m.type, mediaId: media?.id, mime: media?.mime_type, caption: media?.caption });
            break;
          }
          case "interactive":
            out.push({
              ...base,
              type: "interactive",
              buttonId: m.interactive?.button_reply?.id ?? m.interactive?.list_reply?.id,
            });
            break;
          case "button":
            out.push({ ...base, type: "text", text: m.button?.text ?? m.button?.payload ?? "" });
            break;
          default:
            out.push({ ...base, type: "other" });
        }
      }
    }
  }
  return out;
}
