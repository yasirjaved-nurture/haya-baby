import { after } from "next/server";
import { admin } from "@/lib/supabase/admin";
import { isValidPkMobile, normalizePhone } from "@/lib/format";
import { getStoreSettings } from "@/lib/settings";
import { notifyNewOrder } from "@/lib/notify";

export const runtime = "nodejs";

type Body = {
  customer_name?: string;
  phone?: string;
  city?: string;
  address?: string;
  notes?: string;
  payment_method?: string;
  payment_ref?: string;
  items?: { variant_id: string; qty: number }[];
};

export async function POST(req: Request) {
  let b: Body;
  try {
    b = await req.json();
  } catch {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }

  const name = b.customer_name?.trim();
  const city = b.city?.trim();
  const address = b.address?.trim();
  if (!name || !city || !address) return Response.json({ error: "Please fill in your name, city and address." }, { status: 400 });
  if (!b.phone || !isValidPkMobile(b.phone)) return Response.json({ error: "Please enter a valid mobile number, e.g. 0300 1234567." }, { status: 400 });
  if (!b.items?.length) return Response.json({ error: "Your cart is empty." }, { status: 400 });

  const db = admin();
  const settings = await getStoreSettings(db);
  const method = b.payment_method ?? "cod";
  const allowed =
    (method === "cod" && settings.payment.cod) ||
    (method === "jazzcash" && settings.payment.jazzcash.enabled) ||
    (method === "easypaisa" && settings.payment.easypaisa.enabled) ||
    (method === "bank" && settings.payment.bank.enabled);
  if (!allowed) return Response.json({ error: "That payment method isn't available." }, { status: 400 });

  // merge duplicate lines
  const merged = new Map<string, number>();
  for (const it of b.items) {
    if (!it?.variant_id || !Number.isInteger(it.qty) || it.qty < 1) continue;
    merged.set(it.variant_id, (merged.get(it.variant_id) ?? 0) + it.qty);
  }

  const { data, error } = await db.rpc("place_order", {
    p: {
      customer_name: name.slice(0, 120),
      phone: normalizePhone(b.phone),
      city: city.slice(0, 80),
      address: address.slice(0, 500),
      notes: b.notes?.trim().slice(0, 500) ?? "",
      payment_method: method,
      payment_ref: method === "cod" ? "" : (b.payment_ref?.trim().slice(0, 80) ?? ""),
      items: [...merged].map(([variant_id, qty]) => ({ variant_id, qty })),
    },
  });

  if (error) {
    const msg = error.message || "";
    if (msg.includes("OUT_OF_STOCK")) {
      const item = msg.split("OUT_OF_STOCK:")[1]?.trim();
      return Response.json({ error: `Sorry, ${item ? `“${item}”` : "an item"} just ran out — please update your cart.` }, { status: 409 });
    }
    if (msg.includes("UNAVAILABLE")) return Response.json({ error: "An item in your cart is no longer available." }, { status: 409 });
    console.error("[orders]", error);
    return Response.json({ error: "Could not place the order. Please try again." }, { status: 500 });
  }

  after(() => notifyNewOrder(data.id).catch((e) => console.error("[notify]", e)));
  return Response.json(data);
}
