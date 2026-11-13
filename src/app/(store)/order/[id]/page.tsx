/* eslint-disable @typescript-eslint/no-explicit-any */
import Link from "next/link";
import { notFound } from "next/navigation";
import { admin } from "@/lib/supabase/admin";
import { getStoreSettings } from "@/lib/settings";
import { formatPKR, normalizePhone } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "Order placed" };

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const db = admin();
  const [{ data: o }, settings] = await Promise.all([
    db.from("orders").select("order_number, customer_name, city, address, total, subtotal, delivery_fee, payment_method, payment_status, status, order_items(*)").eq("id", id).maybeSingle(),
    getStoreSettings(db),
  ]);
  if (!o) notFound();
  const wa = settings.whatsapp_contact ? normalizePhone(settings.whatsapp_contact) : "";
  const needsPayment = o.payment_method !== "cod" && o.payment_status === "unpaid";
  const acct =
    o.payment_method === "jazzcash" ? settings.payment.jazzcash : o.payment_method === "easypaisa" ? settings.payment.easypaisa : null;

  return (
    <div className="mx-auto max-w-xl px-4 py-14 text-center sm:px-6">
      <div className="mx-auto grid size-20 place-items-center rounded-full bg-sage text-4xl">🎉</div>
      <h1 className="mt-5 text-4xl font-semibold tracking-tight">Thank you, {o.customer_name.split(" ")[0]}!</h1>
      <p className="mt-2 text-muted">
        Your order <b className="text-ink">#{o.order_number}</b> is placed. We&apos;ll call or WhatsApp you to confirm.
      </p>

      {needsPayment && (
        <div className="mt-6 rounded-3xl bg-butter/70 p-5 text-left text-sm">
          <p className="font-bold">Please send {formatPKR(o.total)}</p>
          {acct ? (
            <p className="mt-1">{acct.title} · <b>{acct.number}</b> ({o.payment_method === "jazzcash" ? "JazzCash" : "Easypaisa"})</p>
          ) : (
            <p className="mt-1">{settings.payment.bank.bank_name} · {settings.payment.bank.title} · <b>{settings.payment.bank.account}</b></p>
          )}
          <p className="mt-2 text-muted">Then share the screenshot with us on WhatsApp with your order number.</p>
        </div>
      )}

      <div className="mt-8 rounded-3xl bg-white p-6 text-left ring-1 ring-line">
        <ul className="space-y-3">
          {o.order_items.map((i: any) => (
            <li key={i.id} className="flex items-center gap-3 text-sm">
              <div className="size-12 shrink-0 overflow-hidden rounded-xl bg-blush/50">{i.image_url && <img src={i.image_url} alt="" className="size-full object-cover" />}</div>
              <div className="min-w-0 flex-1">
                <div className="line-clamp-1 font-bold">{i.name}</div>
                <div className="text-xs text-muted">{[i.size, i.color].filter(Boolean).join(" · ") || "One size"} × {i.qty}</div>
              </div>
              <span className="font-bold">{formatPKR(i.price * i.qty)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-4 space-y-1 border-t border-line pt-4 text-sm">
          <div className="flex justify-between"><span className="text-muted">Delivery</span><span>{o.delivery_fee ? formatPKR(o.delivery_fee) : "Free"}</span></div>
          <div className="flex justify-between font-heading text-lg font-semibold"><span>Total</span><span>{formatPKR(o.total)}</span></div>
        </div>
        <div className="mt-4 rounded-2xl bg-shell p-3 text-sm">
          <b>Delivering to:</b> {o.address}, {o.city}
        </div>
      </div>

      <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
        {wa && (
          <a href={`https://wa.me/${wa}?text=${encodeURIComponent(`Hi! About my order #${o.order_number}`)}`} target="_blank" className="btn bg-[#25d366] !px-6 !py-3 text-white hover:bg-[#1ebe5b]">
            💬 WhatsApp us
          </a>
        )}
        <Link href="/shop" className="btn-ghost !px-6 !py-3">Continue shopping</Link>
      </div>
    </div>
  );
}
