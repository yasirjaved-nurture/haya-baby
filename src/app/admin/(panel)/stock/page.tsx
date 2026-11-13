/* eslint-disable @typescript-eslint/no-explicit-any */
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { timeAgo, variantLabel } from "@/lib/format";
import { Empty, PageHeader, SourceBadge } from "@/components/admin/ui";

const SOURCES = ["all", "whatsapp", "dashboard", "order"];

export default async function StockLog({ searchParams }: { searchParams: Promise<{ source?: string }> }) {
  const { source = "all" } = await searchParams;
  const supabase = await createClient();
  let q = supabase
    .from("stock_movements")
    .select("id, change, stock_after, reason, source, actor, created_at, product_id, products(name), variants(size, color)")
    .order("created_at", { ascending: false })
    .limit(300);
  if (source !== "all") q = q.eq("source", source);
  const { data } = await q;

  return (
    <>
      <PageHeader title="Stock log" subtitle="Every change, who made it, and from where — handy when counts don't add up." />
      <div className="no-scrollbar mb-4 flex gap-1.5 overflow-x-auto">
        {SOURCES.map((s) => (
          <Link
            key={s}
            href={`/admin/stock?source=${s}`}
            className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-bold capitalize transition ${
              source === s ? "bg-ink text-white" : "bg-white text-ink/70 ring-1 ring-line hover:ring-ink/30"
            }`}
          >
            {s === "whatsapp" ? "WhatsApp" : s}
          </Link>
        ))}
      </div>
      {!data?.length ? (
        <Empty title="No stock changes yet" />
      ) : (
        <div className="card overflow-hidden">
          <ul className="divide-y divide-line">
            {data.map((m: any) => (
              <li key={m.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 text-sm">
                <span className={`w-12 font-heading text-lg font-semibold ${m.change < 0 ? "text-brand-dark" : "text-sage-deep"}`}>
                  {m.change > 0 ? `+${m.change}` : m.change}
                </span>
                <div className="min-w-0 flex-1">
                  {m.product_id ? (
                    <Link href={`/admin/products/${m.product_id}`} className="font-bold hover:text-brand">
                      {m.products?.name}
                    </Link>
                  ) : (
                    <span className="font-bold text-muted">Deleted product</span>
                  )}
                  {m.variants && <span className="text-muted"> · {variantLabel(m.variants)}</span>}
                  <div className="text-xs text-muted">
                    {m.reason} · now {m.stock_after}
                    {m.actor ? ` · ${m.actor}` : ""}
                  </div>
                </div>
                <SourceBadge source={m.source} />
                <span className="w-20 text-right text-xs text-muted">{timeAgo(m.created_at)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
