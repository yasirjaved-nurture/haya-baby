import Link from "next/link";
import { formatPKR } from "@/lib/format";
import type { StoreProduct } from "@/lib/store";

const TINTS = ["bg-blush/60", "bg-sky/60", "bg-sage/60", "bg-butter/60", "bg-lilac/60"];

export function ProductCard({ p, index = 0 }: { p: StoreProduct; index?: number }) {
  const soldOut = p.status === "sold_out" || p.totalStock === 0;
  const onSale = p.compare_at_price && p.compare_at_price > p.price;
  const few = !soldOut && p.totalStock <= 3;
  const multiPrice = p.variants?.some((v) => v.price && v.price !== p.price);

  return (
    <Link href={`/product/${p.slug}`} className="group block">
      <div className={`relative aspect-[4/5] overflow-hidden rounded-3xl ${TINTS[index % TINTS.length]}`}>
        {p.images[0] ? (
          <>
            <img src={p.images[0]} alt={p.name} loading="lazy" className={`size-full object-cover transition duration-500 group-hover:scale-[1.04] ${soldOut ? "opacity-60 grayscale-[30%]" : ""}`} />
            {p.images[1] && (
              <img src={p.images[1]} alt="" loading="lazy" className="absolute inset-0 size-full object-cover opacity-0 transition duration-500 group-hover:opacity-100" />
            )}
          </>
        ) : (
          <div className="grid size-full place-items-center text-5xl">🧸</div>
        )}
        <div className="absolute left-3 top-3 flex flex-col gap-1.5">
          {soldOut && <span className="rounded-full bg-ink px-2.5 py-1 text-[11px] font-bold text-white">Sold out</span>}
          {onSale && !soldOut && (
            <span className="rounded-full bg-brand px-2.5 py-1 text-[11px] font-bold text-white">
              -{Math.round((1 - p.price / p.compare_at_price!) * 100)}%
            </span>
          )}
          {few && <span className="rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-bold text-brand-dark">Only {p.totalStock} left</span>}
        </div>
      </div>
      <div className="mt-3 px-1">
        <h3 className="line-clamp-1 font-sans text-[15px] font-bold">{p.name}</h3>
        <div className="mt-0.5 flex items-baseline gap-2 text-sm">
          <span className="font-bold text-brand-dark">
            {multiPrice ? "From " : ""}
            {formatPKR(p.minPrice)}
          </span>
          {onSale && <span className="text-muted line-through">{formatPKR(p.compare_at_price)}</span>}
        </div>
      </div>
    </Link>
  );
}
