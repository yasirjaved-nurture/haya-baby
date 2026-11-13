/* eslint-disable @typescript-eslint/no-explicit-any */
import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getStoreSettings } from "@/lib/settings";
import { formatPKR, timeAgo } from "@/lib/format";
import { Empty, PageHeader, StatusBadge } from "@/components/admin/ui";

const FILTERS = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "sold_out", label: "Sold out" },
  { key: "hidden", label: "Hidden" },
  { key: "low", label: "Low stock" },
];

export default async function ProductsPage({ searchParams }: { searchParams: Promise<{ q?: string; filter?: string }> }) {
  const { q = "", filter = "all" } = await searchParams;
  const supabase = await createClient();
  const settings = await getStoreSettings(supabase);

  let query = supabase
    .from("products")
    .select("id, name, slug, price, status, updated_at, categories(name), variants(stock, size, color), product_images(url, sort)")
    .order("updated_at", { ascending: false })
    .limit(300);
  if (q) query = query.ilike("name", `%${q}%`);
  if (["active", "sold_out", "hidden", "draft"].includes(filter)) query = query.eq("status", filter);
  const { data } = await query;

  let products = (data ?? []).map((p: any) => ({
    ...p,
    total: (p.variants ?? []).reduce((s: number, v: any) => s + v.stock, 0),
    image: [...(p.product_images ?? [])].sort((a: any, b: any) => a.sort - b.sort)[0]?.url,
    lowCount: (p.variants ?? []).filter((v: any) => v.stock <= settings.low_stock_threshold).length,
  }));
  if (filter === "low") products = products.filter((p) => p.lowCount > 0 && p.status !== "hidden");

  return (
    <>
      <PageHeader
        title="Products"
        subtitle="Everything you add on WhatsApp shows up here too."
        action={
          <Link href="/admin/products/new" className="btn-primary">
            <Plus size={16} /> Add product
          </Link>
        }
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <form className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
          <input name="q" defaultValue={q} placeholder="Search products…" className="input pl-10" />
          {filter !== "all" && <input type="hidden" name="filter" value={filter} />}
        </form>
        <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
          {FILTERS.map((f) => (
            <Link
              key={f.key}
              href={`/admin/products?filter=${f.key}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
              className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-bold transition ${
                filter === f.key ? "bg-ink text-white" : "bg-white text-ink/70 ring-1 ring-line hover:ring-ink/30"
              }`}
            >
              {f.label}
            </Link>
          ))}
        </div>
      </div>

      {!products.length ? (
        <Empty title={q ? "No matches" : "No products yet"}>
          {q ? "Try a different search." : "Add one here, or send a product photo with its price and stock to your WhatsApp bot."}
        </Empty>
      ) : (
        <div className="card overflow-hidden">
          <div className="hidden grid-cols-[1fr_120px_110px_110px_90px] gap-4 border-b border-line bg-shell/50 px-5 py-2.5 text-xs font-bold uppercase tracking-wide text-muted md:grid">
            <span>Product</span>
            <span>Price</span>
            <span>Stock</span>
            <span>Status</span>
            <span className="text-right">Updated</span>
          </div>
          <ul className="divide-y divide-line">
            {products.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/admin/products/${p.id}`}
                  className="grid grid-cols-[56px_1fr_auto] items-center gap-3 px-4 py-3 hover:bg-shell/40 md:grid-cols-[56px_1fr_120px_110px_110px_90px] md:gap-4 md:px-5"
                >
                  <div className="size-14 overflow-hidden rounded-xl bg-shell">
                    {p.image ? <img src={p.image} alt="" className="size-full object-cover" /> : <div className="grid size-full place-items-center text-xl">🧸</div>}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate font-bold">{p.name}</div>
                    <div className="truncate text-xs text-muted">
                      {p.categories?.name ?? "Uncategorised"} · {p.variants?.length ?? 0} variant{p.variants?.length === 1 ? "" : "s"}
                    </div>
                    <div className="mt-1 flex items-center gap-2 md:hidden">
                      <StatusBadge status={p.status} />
                      <span className="text-xs text-muted">{p.total} in stock</span>
                    </div>
                  </div>
                  <div className="text-right font-bold md:text-left">{formatPKR(p.price)}</div>
                  <div className="hidden md:block">
                    <span className={`font-bold ${p.total === 0 ? "text-brand-dark" : ""}`}>{p.total}</span>
                    {p.lowCount > 0 && p.total > 0 && <span className="ml-1.5 text-xs font-bold text-amber-700">· {p.lowCount} low</span>}
                  </div>
                  <div className="hidden md:block">
                    <StatusBadge status={p.status} />
                  </div>
                  <div className="hidden text-right text-xs text-muted md:block">{timeAgo(p.updated_at)}</div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
