import Link from "next/link";
import { Search } from "lucide-react";
import { getStoreData, listProducts } from "@/lib/store";
import { ProductCard } from "@/components/store/product-card";

export const metadata = { title: "Shop" };

export default async function Shop({ searchParams }: { searchParams: Promise<{ category?: string; sort?: string; q?: string }> }) {
  const { category, sort, q } = await searchParams;
  const [{ categories }, products] = await Promise.all([getStoreData(), listProducts({ category, sort, q })]);
  const active = categories.find((c) => c.slug === category);
  const href = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const merged = { category, sort, q, ...patch };
    Object.entries(merged).forEach(([k, v]) => v && p.set(k, v));
    const s = p.toString();
    return `/shop${s ? `?${s}` : ""}`;
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <h1 className="text-4xl font-semibold tracking-tight">{active?.name ?? (q ? `“${q}”` : "Shop all")}</h1>
      <p className="mt-1 text-muted">{products.length} item{products.length === 1 ? "" : "s"}</p>

      <div className="mt-6 flex flex-col gap-3 md:flex-row md:items-center">
        <div className="no-scrollbar -mx-4 flex flex-1 gap-2 overflow-x-auto px-4 md:mx-0 md:px-0">
          <Link href={href({ category: undefined })} className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-bold ${!category ? "bg-ink text-white" : "bg-white ring-1 ring-line"}`}>
            All
          </Link>
          {categories.map((c) => (
            <Link key={c.id} href={href({ category: c.slug })} className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-bold ${category === c.slug ? "bg-ink text-white" : "bg-white ring-1 ring-line hover:ring-ink/30"}`}>
              {c.name}
            </Link>
          ))}
        </div>
        <form className="flex gap-2">
          {category && <input type="hidden" name="category" value={category} />}
          <div className="relative">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
            <input name="q" defaultValue={q} placeholder="Search" className="input w-full rounded-full pl-10 md:w-52" />
          </div>
          <select name="sort" defaultValue={sort ?? ""} className="input w-auto rounded-full">
            <option value="">Newest</option>
            <option value="price_asc">Price ↑</option>
            <option value="price_desc">Price ↓</option>
          </select>
          <button className="btn-dark !px-4">Go</button>
        </form>
      </div>

      {products.length ? (
        <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 lg:grid-cols-4">
          {products.map((p, i) => (
            <ProductCard key={p.id} p={p} index={i} />
          ))}
        </div>
      ) : (
        <div className="mt-10 rounded-3xl bg-white/70 py-20 text-center">
          <div className="text-5xl">🔍</div>
          <p className="mt-3 font-bold">Nothing here yet</p>
          <Link href="/shop" className="mt-4 inline-block text-sm font-bold text-brand">See all products</Link>
        </div>
      )}
    </div>
  );
}
