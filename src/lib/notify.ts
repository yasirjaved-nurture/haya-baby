import { admin } from "./supabase/admin";
import { formatPKR, normalizePhone } from "./format";
import { sendTemplate, sendText, WhatsAppError } from "./whatsapp";

/** WhatsApp the owner(s) about a new website order. */
export async function notifyNewOrder(orderId: string) {
  const db = admin();
  const { data: order } = await db.from("orders").select("*, order_items(*)").eq("id", orderId).single();
  if (!order) return;

  const { data: users } = await db.from("bot_users").select("phone").eq("active", true).eq("notify_orders", true);
  const phones = new Set<string>((users ?? []).map((u: { phone: string }) => u.phone));
  for (const p of (process.env.OWNER_PHONES || "").split(",")) if (p.trim()) phones.add(normalizePhone(p));
  if (!phones.size) return;

  const site = process.env.NEXT_PUBLIC_SITE_URL || "";
  const lines = (order.order_items ?? [])
    .map((i: { qty: number; name: string; size: string | null; color: string | null }) =>
      `• ${i.qty} × ${i.name}${i.size || i.color ? ` (${[i.size, i.color].filter(Boolean).join(", ")})` : ""}`,
    )
    .join("\n");
  const pay = order.payment_method === "cod" ? "Cash on delivery" : `${order.payment_method}${order.payment_ref ? ` · Ref ${order.payment_ref}` : ""}`;
  const text =
    `🛍️ *New order #${order.order_number}*\n\n${lines}\n\n` +
    `*Total:* ${formatPKR(order.total)}\n*Payment:* ${pay}\n` +
    `*Customer:* ${order.customer_name} · ${order.phone}\n*City:* ${order.city}\n\n` +
    `Reply *order ${order.order_number} confirmed* to confirm.\n${site}/admin/orders/${order.id}`;

  for (const phone of phones) {
    try {
      await sendText(phone, text);
    } catch (e) {
      // Outside the 24h customer-service window free text is rejected → use the approved template
      const template = process.env.WA_ORDER_TEMPLATE;
      if (template && e instanceof WhatsAppError) {
        await sendTemplate(phone, template, [
          String(order.order_number),
          order.customer_name,
          formatPKR(order.total),
          order.city,
        ]).catch((err) => console.error("order template failed", err));
      } else {
        console.error("order alert failed", e);
      }
    }
  }
}
