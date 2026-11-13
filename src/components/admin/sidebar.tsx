"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { History, LayoutDashboard, LogOut, Menu, Package, Settings, ShoppingBag, Store, X } from "lucide-react";
import { signOut } from "@/app/admin/actions";

const NAV = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/products", label: "Products", icon: Package },
  { href: "/admin/orders", label: "Orders", icon: ShoppingBag },
  { href: "/admin/stock", label: "Stock log", icon: History },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

export function Sidebar({ shopName, pendingOrders }: { shopName: string; pendingOrders: number }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const isActive = (href: string) => (href === "/admin" ? path === "/admin" : path.startsWith(href));

  const nav = (
    <nav className="flex flex-1 flex-col gap-1">
      {NAV.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          onClick={() => setOpen(false)}
          className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold transition ${
            isActive(href) ? "bg-ink text-white" : "text-ink/70 hover:bg-ink/5 hover:text-ink"
          }`}
        >
          <Icon size={18} strokeWidth={2.2} />
          {label}
          {href === "/admin/orders" && pendingOrders > 0 && (
            <span className="ml-auto rounded-full bg-brand px-2 py-0.5 text-[11px] text-white">{pendingOrders}</span>
          )}
        </Link>
      ))}
      <div className="mt-auto space-y-1 border-t border-line pt-3">
        <Link href="/" target="_blank" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold text-ink/70 hover:bg-ink/5">
          <Store size={18} /> View shop
        </Link>
        <form action={signOut}>
          <button className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold text-ink/70 hover:bg-ink/5">
            <LogOut size={18} /> Sign out
          </button>
        </form>
      </div>
    </nav>
  );

  const brand = (
    <Link href="/admin" className="flex items-center gap-2.5">
      <span className="grid size-9 place-items-center rounded-xl bg-brand text-lg">🍼</span>
      <span>
        <span className="block font-heading text-base font-semibold leading-tight">{shopName}</span>
        <span className="block text-[11px] font-bold uppercase tracking-wider text-muted">Dashboard</span>
      </span>
    </Link>
  );

  return (
    <>
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col gap-8 border-r border-line bg-shell/60 p-5 lg:flex">
        {brand}
        {nav}
      </aside>

      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-cream/90 px-4 py-3 backdrop-blur lg:hidden">
        {brand}
        <button onClick={() => setOpen(true)} className="rounded-xl p-2 hover:bg-ink/5" aria-label="Open menu">
          <Menu />
        </button>
      </header>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-ink/30" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 flex w-72 flex-col gap-8 bg-cream p-5 shadow-xl">
            <div className="flex items-center justify-between">
              {brand}
              <button onClick={() => setOpen(false)} className="rounded-xl p-2 hover:bg-ink/5" aria-label="Close menu">
                <X />
              </button>
            </div>
            {nav}
          </div>
        </div>
      )}
    </>
  );
}
