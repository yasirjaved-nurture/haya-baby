/* eslint-disable @typescript-eslint/no-explicit-any */
import Link from "next/link";
import { ArrowRight, MessageCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getStoreSettings } from "@/lib/settings";
import { formatPKR, startOfStoreDay, timeAgo, variantLabel } from "@/lib/format";
import { OrderBadge, PageHeader, SourceBadge, StatCard } from "@/components/admin/ui";

export default async function Overview() {
  const supabase = await createClient();
  const settings = await getStoreSettings(supabase);
  const today = startOfStoreDay();
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

  const [products, todayOrders, monthOrders, recentOrders, low, moves] = await Promise.all([
    supabase.from("products").select("status"),
    supabase.from("orders").select("total, status").gte("created_at", today),
    supabase.from("orders").select("total, status").gte("created_at", monthStart),
    supabase.from("orders").select("id, order_number, customer_name, city, total, status, created_at").order("created_at", { ascending: false }).limit(6),
    supabase
      .from("variants")
      .select("id, size, color, stock, products!inner(id, name, status)")
      .lte("stock", settings.low_stock_threshold)
      .in("products.status", ["active", "sold_out"])
      .order("stock")
      .limit(8),
    supabase
      .from("stock_movements")
      .select("id, change, stock_after, reason, source, actor, created_at, product_id, products(name), variants(size, color)")
      .order("created_at", { ascending: false })
      .limit(8),
  ]);

  const live = (rows: any[] | null) => (rows ?? []).filter((o) => o.status !== "cancelled");
  const sum = (rows: any[]) => rows.reduce((s, o) => s + o.total, 0);
  const counts: Record<string, number> = (products.data ?? []).reduce((acc: Record<string, number>, p: any) => ({ ...acc, [p.status]: (acc[p.status] ?? 0) + 1 }), {});

  return (
    <>
      <PageHeader title={`Hi there 👋`} subtitle={`Here's how ${settings.shop_name} is doing today.`} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Today's sales" value={formatPKR(sum(live(todayOrders.data)))} hint={`${live(todayOrders.data).length} orders`} tone="bg-blush/50" href="/admin/orders" />
        <StatCard label="This month" value={formatPKR(sum(live(monthOrders.data)))} hint={`${live(monthOrders.data).length} orders`} tone="bg-sky/50" />
        <StatCard label="Live products" value={counts.active ?? 0} hint={`${counts.sold_out ?? 0} sold out · ${counts.hidden ?? 0} hidden`} tone="bg-sage/50" href="/admin/products" />
        <StatCard label="Running low" value={low.data?.length ?? 0} hint={`≤ ${settings.low_stock_threshold} pieces`} tone="bg-butter/60" href="/admin/products?filter=low" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        <section className="card lg:col-span-3">
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <h2 className="font-semibold">Recent orders</h2>
            <Link href="/admin/orders" className="flex items-center gap-1 text-sm font-bold text-brand">
              All orders <ArrowRight size={14} />
            </Link>
          </div>
          {recentOrders.data?.length ? (
            <ul className="divide-y divide-line">
              {recentOrders.data.map((o: any) => (
                <li key={o.id}>
                  <Link href={`/admin/orders/${o.id}`} className="flex items-center gap-3 px-5 py-3.5 hover:bg-shell/50">
                    <div className="min-w-0 flex-1">
                      <div className="font-bold">
                        #{o.order_number} · {o.customer_name}
                      </div>
                      <div className="text-xs text-muted">
                        {o.city} · {timeAgo(o.created_at)}
                      </div>
                    </div>
                    <OrderBadge status={o.status} />
                    <div className="w-24 text-right font-bold">{formatPKR(o.total)}</div>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-5 py-10 text-center text-sm text-muted">No orders yet — share your shop link on Instagram! ✨</p>
          )}
        </section>

        <section className="card lg:col-span-2">
          <div className="border-b border-line px-5 py-4">
            <h2 className="font-semibold">Running low</h2>
          </div>
          {low.data?.length ? (
            <ul className="divide-y divide-line">
              {low.data.map((v: any) => (
                <li key={v.id}>
                  <Link href={`/admin/products/${v.products.id}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-shell/50">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-bold">{v.products.name}</div>
                      <div className="text-xs text-muted">{variantLabel(v)}</div>
                    </div>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${v.stock === 0 ? "bg-brand-soft text-brand-dark" : "bg-butter text-amber-800"}`}>
                      {v.stock === 0 ? "Out" : `${v.stock} left`}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-5 py-10 text-center text-sm text-muted">Everything is well stocked 🎉</p>
          )}
        </section>
      </div>

      <section className="card mt-6">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="font-semibold">Latest stock changes</h2>
          <Link href="/admin/stock" className="flex items-center gap-1 text-sm font-bold text-brand">
            Full log <ArrowRight size={14} />
          </Link>
        </div>
        {moves.data?.length ? (
          <ul className="divide-y divide-line">
            {moves.data.map((m: any) => (
              <li key={m.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-3 text-sm">
                <span className={`w-12 font-heading text-base font-semibold ${m.change < 0 ? "text-brand-dark" : "text-sage-deep"}`}>
                  {m.change > 0 ? `+${m.change}` : m.change}
                </span>
                <span className="min-w-0 flex-1 truncate">
                  <b>{m.products?.name ?? "Deleted product"}</b>
                  {m.variants && (m.variants.size || m.variants.color) ? <span className="text-muted"> · {variantLabel(m.variants)}</span> : null}
                  <span className="text-muted"> → {m.stock_after}</span>
                </span>
                <SourceBadge source={m.source} />
                <span className="w-20 text-right text-xs text-muted">{timeAgo(m.created_at)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="flex items-center gap-3 px-5 py-8 text-sm text-muted">
            <MessageCircle className="text-sage-deep" /> Send a product photo to your WhatsApp bot to add your first item.
          </div>
        )}
      </section>
    </>
  );
}
