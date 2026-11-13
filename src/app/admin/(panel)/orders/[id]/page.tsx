/* eslint-disable @typescript-eslint/no-explicit-any */
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getStoreSettings } from "@/lib/settings";
import { formatPKR } from "@/lib/format";
import { OrderActions } from "@/components/admin/order-actions";
import { OrderBadge, PageHeader } from "@/components/admin/ui";

const PAY: Record<string, string> = { cod: "Cash on delivery", jazzcash: "JazzCash", easypaisa: "Easypaisa", bank: "Bank transfer" };

export default async function OrderDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: o }, settings] = await Promise.all([
    supabase.from("orders").select("*, order_items(*)").eq("id", id).maybeSingle(),
    getStoreSettings(supabase),
  ]);
  if (!o) notFound();

  return (
    <>
      <Link href="/admin/orders" className="mb-3 inline-flex items-center gap-1 text-sm font-bold text-muted hover:text-ink">
        <ArrowLeft size={14} /> Orders
      </Link>
      <PageHeader
        title={`Order #${o.order_number}`}
        subtitle={new Date(o.created_at).toLocaleString("en-PK", { dateStyle: "medium", timeStyle: "short" })}
        action={<OrderBadge status={o.status} />}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section className="card">
            <h2 className="border-b border-line px-5 py-4 font-semibold">Items</h2>
            <ul className="divide-y divide-line">
              {o.order_items.map((i: any) => (
                <li key={i.id} className="flex items-center gap-4 px-5 py-3">
                  <div className="size-14 shrink-0 overflow-hidden rounded-xl bg-shell">
                    {i.image_url ? <img src={i.image_url} alt="" className="size-full object-cover" /> : <div className="grid size-full place-items-center">🧸</div>}
                  </div>
                  <div className="min-w-0 flex-1">
                    {i.product_id ? (
                      <Link href={`/admin/products/${i.product_id}`} className="font-bold hover:text-brand">
                        {i.name}
                      </Link>
                    ) : (
                      <span className="font-bold">{i.name}</span>
                    )}
                    <div className="text-xs text-muted">{[i.size, i.color].filter(Boolean).join(" · ") || "One size"}</div>
                  </div>
                  <div className="text-sm text-muted">
                    {i.qty} × {formatPKR(i.price)}
                  </div>
                  <div className="w-24 text-right font-bold">{formatPKR(i.qty * i.price)}</div>
                </li>
              ))}
            </ul>
            <div className="space-y-1.5 border-t border-line px-5 py-4 text-sm">
              <div className="flex justify-between"><span className="text-muted">Subtotal</span><span>{formatPKR(o.subtotal)}</span></div>
              <div className="flex justify-between"><span className="text-muted">Delivery</span><span>{o.delivery_fee ? formatPKR(o.delivery_fee) : "Free"}</span></div>
              <div className="flex justify-between pt-1 font-heading text-lg font-semibold"><span>Total</span><span>{formatPKR(o.total)}</span></div>
            </div>
          </section>

          <section className="card grid gap-5 p-5 sm:grid-cols-2">
            <div>
              <div className="label">Customer</div>
              <div className="font-bold">{o.customer_name}</div>
              <a href={`tel:+${o.phone}`} className="text-sm text-brand">+{o.phone}</a>
            </div>
            <div>
              <div className="label">Deliver to</div>
              <div className="text-sm">{o.address}</div>
              <div className="text-sm font-bold">{o.city}</div>
            </div>
            <div>
              <div className="label">Payment</div>
              <div className="text-sm font-bold">{PAY[o.payment_method]}</div>
              {o.payment_ref && <div className="text-sm text-muted">Ref: {o.payment_ref}</div>}
              <div className="mt-1"><OrderBadge status={o.payment_status} /></div>
            </div>
            {o.notes && (
              <div>
                <div className="label">Notes</div>
                <div className="text-sm">{o.notes}</div>
              </div>
            )}
          </section>
        </div>

        <aside className="card h-fit p-5">
          <OrderActions id={o.id} status={o.status} paymentStatus={o.payment_status} phone={o.phone} orderNumber={o.order_number} shopName={settings.shop_name} />
        </aside>
      </div>
    </>
  );
}
