import { after } from "next/server";
import { handleIncoming } from "@/lib/bot/handler";
import { extractMessages, verifySignature } from "@/lib/whatsapp";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Meta calls this once to verify the webhook URL. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  if (mode === "subscribe" && token && token === process.env.WA_VERIFY_TOKEN) {
    return new Response(challenge ?? "", { status: 200 });
  }
  return new Response("Forbidden", { status: 403 });
}

/** Incoming WhatsApp messages. Reply 200 immediately, process in the background. */
export async function POST(req: Request) {
  const raw = await req.text();
  if (!verifySignature(raw, req.headers.get("x-hub-signature-256"))) {
    return new Response("Invalid signature", { status: 401 });
  }
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return new Response("Bad JSON", { status: 400 });
  }
  const messages = extractMessages(body);
  if (messages.length) {
    after(async () => {
      for (const m of messages) await handleIncoming(m);
    });
  }
  return Response.json({ ok: true });
}
