"use client";

import { useMemo, useState } from "react";
import { Minus, Plus, ShoppingBag } from "lucide-react";
import { useCart } from "./cart";
import { formatPKR, normalizePhone, variantLabel } from "@/lib/format";
import type { StoreProduct } from "@/lib/store";

export function ProductView({ p, whatsapp, siteUrl }: { p: StoreProduct; whatsapp: string; siteUrl: string }) {
  const { add } = useCart();
  const variants = p.variants ?? [];
  const firstInStock = variants.find((v) => v.stock > 0) ?? variants[0];
  const [variantId, setVariantId] = useState(firstInStock?.id);
  const [qty, setQty] = useState(1);
  const [img, setImg] = useState(0);

  const v = variants.find((x) => x.id === variantId);
  const price = v?.price ?? p.price;
  const soldOut = p.status === "sold_out" || p.totalStock === 0;
  const vOut = !v || v.stock === 0;
  const onlyOne = variants.length === 1 && !variants[0].size && !variants[0].color;
  const sizes = useMemo(() => variants, [variants]);
  const images = p.images.length ? p.images : [];

  const waText = encodeURIComponent(
    `Hi! I'd like to order:\n${p.name}${v && !onlyOne ? ` (${variantLabel(v)})` : ""} × ${qty}\n${siteUrl}/product/${p.slug}`,
  );

  return (
    <div className="grid gap-8 md:grid-cols-2 md:gap-12">
      {/* Gallery */}
      <div>
        <div className="relative aspect-[4/5] overflow-hidden rounded-[2rem] bg-blush/50">
          {images.length ? (
            <img src={images[img]} alt={p.name} className="size-full object-cover" />
          ) : (
            <div className="grid size-full place-items-center text-7xl">🧸</div>
          )}
          {soldOut && <span className="absolute left-4 top-4 rounded-full bg-ink px-3 py-1.5 text-xs font-bold text-white">Sold out</span>}
        </div>
        {images.length > 1 && (
          <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto">
            {images.map((src, i) => (
              <button key={src} onClick={() => setImg(i)} className={`size-20 shrink-0 overflow-hidden rounded-2xl ring-2 transition ${i === img ? "ring-brand" : "ring-transparent opacity-70 hover:opacity-100"}`}>
                <img src={src} alt="" className="size-full object-cover" />
              </button>
            ))}
          </div>
        )}
        {(p.video_url || p.instagram_url) && (
          <div className="mt-4">
            {p.video_url && <video src={p.video_url} controls playsInline className="w-full rounded-[2rem] bg-ink" />}
            {p.instagram_url && (
              <a href={p.instagram_url} target="_blank" className="btn-ghost mt-3 w-full">
                ▶️ Watch it on Instagram
              </a>
            )}
          </div>
        )}
      </div>

      {/* Details */}
      <div className="md:pt-4">
        {p.categories?.name && <div className="text-sm font-bold uppercase tracking-wide text-brand">{p.categories.name}</div>}
        <h1 className="mt-2 text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">{p.name}</h1>
        <div className="mt-3 flex items-baseline gap-3">
          <span className="font-heading text-3xl font-semibold text-brand-dark">{formatPKR(price)}</span>
          {p.compare_at_price && p.compare_at_price > price && <span className="text-lg text-muted line-through">{formatPKR(p.compare_at_price)}</span>}
        </div>

        {!onlyOne && (
          <div className="mt-7">
            <div className="label">{variants.some((x) => x.size) ? "Size" : "Option"}</div>
            <div className="flex flex-wrap gap-2">
              {sizes.map((x) => (
                <button
                  key={x.id}
                  onClick={() => {
                    setVariantId(x.id);
                    setQty(1);
                  }}
                  disabled={x.stock === 0}
                  className={`relative min-w-16 rounded-2xl px-4 py-2.5 text-sm font-bold transition ${
                    x.id === variantId ? "bg-ink text-white" : "bg-white ring-1 ring-line hover:ring-ink/40"
                  } disabled:cursor-not-allowed disabled:text-muted disabled:line-through disabled:opacity-60`}
                >
                  {variantLabel(x)}
                </button>
              ))}
            </div>
            {v && v.stock > 0 && v.stock <= 3 && <p className="mt-2 text-sm font-bold text-brand-dark">Hurry — only {v.stock} left in this size!</p>}
          </div>
        )}

        <div className="mt-7 flex gap-3">
          <div className="flex items-center rounded-full bg-white ring-1 ring-line">
            <button onClick={() => setQty((q) => Math.max(1, q - 1))} className="grid size-12 place-items-center" aria-label="Less">
              <Minus size={16} />
            </button>
            <span className="w-6 text-center font-bold">{qty}</span>
            <button onClick={() => setQty((q) => Math.min(v?.stock ?? 1, q + 1))} className="grid size-12 place-items-center" aria-label="More">
              <Plus size={16} />
            </button>
          </div>
          <button
            disabled={soldOut || vOut}
            onClick={() =>
              v &&
              add({
                variantId: v.id,
                productId: p.id,
                slug: p.slug,
                name: p.name,
                variant: onlyOne ? "One size" : variantLabel(v),
                price,
                image: images[0],
                qty,
                max: v.stock,
              })
            }
            className="btn-primary flex-1 !py-3.5 text-base"
          >
            <ShoppingBag size={18} /> {soldOut || vOut ? "Sold out" : "Add to bag"}
          </button>
        </div>

        {whatsapp && (
          <a href={`https://wa.me/${normalizePhone(whatsapp)}?text=${waText}`} target="_blank" className="btn mt-3 w-full bg-[#25d366] !py-3.5 text-base text-white hover:bg-[#1ebe5b]">
            💬 {soldOut ? "Ask when it's back" : "Order on WhatsApp"}
          </a>
        )}

        {p.description && <p className="mt-8 whitespace-pre-line leading-relaxed text-ink/80">{p.description}</p>}

        <div className="mt-8 grid grid-cols-3 gap-2 text-center text-xs font-bold">
          <div className="rounded-2xl bg-sage/60 px-2 py-3">💵<br />Cash on delivery</div>
          <div className="rounded-2xl bg-sky/60 px-2 py-3">🚚<br />3–5 day delivery</div>
          <div className="rounded-2xl bg-butter/70 px-2 py-3">🔁<br />Size exchange</div>
        </div>
      </div>
    </div>
  );
}
