"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, Search, ShoppingBag, X } from "lucide-react";
import { useCart } from "./cart";
import { formatPKR } from "@/lib/format";
import type { Category } from "@/lib/types";

export function StoreHeader({ shopName, categories, freeOver }: { shopName: string; categories: Category[]; freeOver: number }) {
  const { count, justAdded } = useCart();
  const [open, setOpen] = useState(false);
  const path = usePathname();

  return (
    <>
      {freeOver > 0 && (
        <div className="bg-ink px-4 py-2 text-center text-xs font-bold text-white">
          🚚 Free delivery on orders over {formatPKR(freeOver)} · Cash on delivery all over Pakistan
        </div>
      )}
      <header className="sticky top-0 z-30 border-b border-line/70 bg-cream/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3 sm:px-6">
          <button className="-ml-2 rounded-full p-2 md:hidden" onClick={() => setOpen(true)} aria-label="Menu">
            <Menu size={22} />
          </button>
          <Link href="/" className="flex items-center gap-2">
            <span className="grid size-9 place-items-center rounded-full bg-blush text-lg">🍼</span>
            <span className="font-heading text-xl font-semibold tracking-tight">{shopName}</span>
          </Link>
          <nav className="ml-6 hidden items-center gap-1 md:flex">
            <Link href="/shop" className={`rounded-full px-3 py-1.5 text-sm font-bold ${path === "/shop" ? "bg-white" : "hover:bg-white/70"}`}>
              Shop all
            </Link>
            {categories.slice(0, 5).map((c) => (
              <Link key={c.id} href={`/shop?category=${c.slug}`} className="rounded-full px-3 py-1.5 text-sm font-bold text-ink/70 hover:bg-white/70 hover:text-ink">
                {c.name}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-1">
            <Link href="/shop" className="rounded-full p-2.5 hover:bg-white" aria-label="Search">
              <Search size={20} />
            </Link>
            <Link href="/cart" className="relative rounded-full p-2.5 hover:bg-white" aria-label="Cart">
              <ShoppingBag size={20} />
              {count > 0 && (
                <span className="absolute -right-0.5 -top-0.5 grid min-w-5 place-items-center rounded-full bg-brand px-1 text-[11px] font-bold text-white">
                  {count}
                </span>
              )}
            </Link>
          </div>
        </div>
      </header>

      {justAdded && (
        <div className="fixed inset-x-4 bottom-4 z-50 mx-auto flex max-w-md items-center gap-3 rounded-2xl bg-ink p-3 text-white shadow-2xl sm:bottom-6">
          {justAdded.image && <img src={justAdded.image} alt="" className="size-12 rounded-xl object-cover" />}
          <div className="min-w-0 flex-1 text-sm">
            <div className="font-bold">Added to bag 🎉</div>
            <div className="truncate text-white/70">{justAdded.name} · {justAdded.variant}</div>
          </div>
          <Link href="/cart" className="rounded-full bg-white px-4 py-2 text-sm font-bold text-ink">
            View bag
          </Link>
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-ink/30" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-80 max-w-[85%] bg-cream p-5 shadow-xl">
            <div className="mb-6 flex items-center justify-between">
              <span className="font-heading text-xl font-semibold">{shopName}</span>
              <button onClick={() => setOpen(false)} className="rounded-full p-2 hover:bg-white" aria-label="Close">
                <X />
              </button>
            </div>
            <nav className="flex flex-col gap-1" onClick={() => setOpen(false)}>
              <Link href="/shop" className="rounded-xl px-3 py-3 font-bold hover:bg-white">Shop all</Link>
              {categories.map((c) => (
                <Link key={c.id} href={`/shop?category=${c.slug}`} className="rounded-xl px-3 py-3 font-bold text-ink/75 hover:bg-white">
                  {c.name}
                </Link>
              ))}
            </nav>
          </div>
        </div>
      )}
    </>
  );
}
