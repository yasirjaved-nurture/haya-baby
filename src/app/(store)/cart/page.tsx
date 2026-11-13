"use client";

import Link from "next/link";
import { Minus, Plus, Trash2 } from "lucide-react";
import { useCart } from "@/components/store/cart";
import { formatPKR } from "@/lib/format";

export default function CartPage() {
  const { items, subtotal, setQty, remove, ready } = useCart();

  if (!ready) return <div className="min-h-[50vh]" />;
  if (!items.length)
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <div className="text-6xl">🛍️</div>
        <h1 className="mt-4 text-3xl font-semibold">Your bag is empty</h1>
        <p className="mt-2 text-muted">Let&apos;s find something sweet.</p>
        <Link href="/shop" className="btn-primary mt-6 !px-7 !py-3">Start shopping</Link>
      </div>
    );

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <h1 className="text-4xl font-semibold tracking-tight">Your bag</h1>
      <div className="mt-8 grid gap-8 md:grid-cols-[1fr_300px]">
        <ul className="space-y-3">
          {items.map((i) => (
            <li key={i.variantId} className="flex gap-4 rounded-3xl bg-white p-3 ring-1 ring-line">
              <Link href={`/product/${i.slug}`} className="size-24 shrink-0 overflow-hidden rounded-2xl bg-blush/50">
                {i.image ? <img src={i.image} alt="" className="size-full object-cover" /> : <div className="grid size-full place-items-center text-3xl">🧸</div>}
              </Link>
              <div className="flex min-w-0 flex-1 flex-col">
                <div className="flex justify-between gap-2">
                  <div className="min-w-0">
                    <Link href={`/product/${i.slug}`} className="line-clamp-1 font-bold hover:text-brand">{i.name}</Link>
                    <div className="text-sm text-muted">{i.variant}</div>
                  </div>
                  <button onClick={() => remove(i.variantId)} className="h-fit rounded-full p-1.5 text-muted hover:bg-brand-soft hover:text-brand-dark" aria-label="Remove">
                    <Trash2 size={16} />
                  </button>
                </div>
                <div className="mt-auto flex items-center justify-between">
                  <div className="flex items-center rounded-full bg-shell">
                    <button onClick={() => setQty(i.variantId, i.qty - 1)} className="grid size-9 place-items-center" aria-label="Less"><Minus size={14} /></button>
                    <span className="w-5 text-center text-sm font-bold">{i.qty}</span>
                    <button onClick={() => setQty(i.variantId, i.qty + 1)} disabled={i.qty >= i.max} className="grid size-9 place-items-center disabled:opacity-30" aria-label="More"><Plus size={14} /></button>
                  </div>
                  <span className="font-bold">{formatPKR(i.price * i.qty)}</span>
                </div>
              </div>
            </li>
          ))}
        </ul>
        <aside className="h-fit rounded-3xl bg-white p-6 ring-1 ring-line md:sticky md:top-24">
          <div className="flex justify-between text-sm"><span className="text-muted">Subtotal</span><span className="font-bold">{formatPKR(subtotal)}</span></div>
          <p className="mt-1 text-xs text-muted">Delivery calculated at checkout</p>
          <Link href="/checkout" className="btn-primary mt-5 w-full !py-3.5 text-base">Checkout</Link>
          <Link href="/shop" className="mt-3 block text-center text-sm font-bold text-muted hover:text-ink">Keep shopping</Link>
        </aside>
      </div>
    </div>
  );
}
