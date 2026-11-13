"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type CartItem = {
  variantId: string;
  productId: string;
  slug: string;
  name: string;
  variant: string;
  price: number;
  image?: string;
  qty: number;
  max: number;
};

type Cart = {
  items: CartItem[];
  count: number;
  subtotal: number;
  ready: boolean;
  add: (item: CartItem) => void;
  setQty: (variantId: string, qty: number) => void;
  remove: (variantId: string) => void;
  clear: () => void;
  justAdded: CartItem | null;
};

const CartContext = createContext<Cart | null>(null);
const KEY = "babyshop-cart-v1";

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [ready, setReady] = useState(false);
  const [justAdded, setJustAdded] = useState<CartItem | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setItems(JSON.parse(raw));
    } catch {}
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(items));
    } catch {}
  }, [items, ready]);

  useEffect(() => {
    if (!justAdded) return;
    const t = setTimeout(() => setJustAdded(null), 3500);
    return () => clearTimeout(t);
  }, [justAdded]);

  const add = useCallback((item: CartItem) => {
    setItems((list) => {
      const found = list.find((i) => i.variantId === item.variantId);
      if (found) return list.map((i) => (i.variantId === item.variantId ? { ...i, qty: Math.min(i.max, i.qty + item.qty), max: item.max } : i));
      return [...list, { ...item, qty: Math.min(item.max, item.qty) }];
    });
    setJustAdded(item);
  }, []);
  const setQty = useCallback(
    (variantId: string, qty: number) =>
      setItems((list) => list.map((i) => (i.variantId === variantId ? { ...i, qty: Math.max(1, Math.min(i.max, qty)) } : i))),
    [],
  );
  const remove = useCallback((variantId: string) => setItems((list) => list.filter((i) => i.variantId !== variantId)), []);
  const clear = useCallback(() => setItems([]), []);

  const value = useMemo<Cart>(
    () => ({
      items,
      ready,
      count: items.reduce((s, i) => s + i.qty, 0),
      subtotal: items.reduce((s, i) => s + i.qty * i.price, 0),
      add,
      setQty,
      remove,
      clear,
      justAdded,
    }),
    [items, ready, add, setQty, remove, clear, justAdded],
  );
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const c = useContext(CartContext);
  if (!c) throw new Error("useCart must be used inside CartProvider");
  return c;
}
