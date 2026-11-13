/* eslint-disable @typescript-eslint/no-explicit-any */
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatPKR, timeAgo } from "@/lib/format";
import { Empty, OrderBadge, PageHeader } from "@/components/admin/ui";

const TABS = ["all", "pending", "confirmed", "shipped", "delivered", "cancelled"];
const PAY: Record<string, string> = { cod: "COD", jazzcash: "JazzCash", easypaisa: "Easypaisa", bank: "Bank" };

export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string }> }) {
  const { status = "all", q = "" } = await searchParams;
  const supabase = await createClient();
  let query = supabase
    .from("orders")
    .select("id, order_number, customer_name, phone, city, total, status, payment_method, payment_status, created_at, order_items(qty)")
    .order("created_at", { ascending: false })
    .limit(200);
  if (status !== "all") query = query.eq("status", status);
  if (q) query = /^\d+$/.test(q) ? query.or(`order_number.eq.${q},phone.ilike.%${q}%`) : query.ilike("customer_name", `%${q}%`);
  const { data: orders } = await query;

  return (
    <>
      <PageHeader title="Orders" subtitle="New orders also arrive on your WhatsApp." />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <form className="flex-1">
          <input name="q" defaultValue={q} placeholder="Search name, phone or order #" className="input" />
          {status !== "all" && <input type="hidden" name="status" value={status} />}
        </form>
        <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
          {TABS.map((t) => (
            <Link
              key={t}
              href={`/admin/orders?status=${t}`}
              className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-bold capitalize transition ${
                status === t ? "bg-ink text-white" : "bg-white text-ink/70 ring-1 ring-line hover:ring-ink/30"
              }`}
            >
              {t}
            </Link>
          ))}
        </div>
      </div>

      {!orders?.length ? (
        <Empty title="No orders here">When customers check out on your website, their orders appear here.</Empty>
      ) : (
        <div className="card overflow-hidden">
          <ul className="divide-y divide-line">
            {orders.map((o: any) => (
              <li key={o.id}>
                <Link href={`/admin/orders/${o.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-5 py-4 hover:bg-shell/40">
                  <div className="w-16 font-heading text-lg font-semibold">#{o.order_number}</div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-bold">{o.customer_name}</div>
                    <div className="text-xs text-muted">
                      {o.city} · {(o.order_items ?? []).reduce((s: number, i: any) => s + i.qty, 0)} items · {timeAgo(o.created_at)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-muted">{PAY[o.payment_method]}</span>
                    {o.payment_method !== "cod" && <OrderBadge status={o.payment_status} />}
                    <OrderBadge status={o.status} />
                  </div>
                  <div className="w-24 text-right font-bold">{formatPKR(o.total)}</div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
