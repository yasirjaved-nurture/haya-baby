/* eslint-disable @typescript-eslint/no-explicit-any */
import { publicClient } from "./supabase/public";
import { getStoreSettings } from "./settings";
import type { Category, Product } from "./types";

export type StoreProduct = Product & { images: string[]; totalStock: number; minPrice: number };

const SELECT = "*, variants(*), product_images(url, sort), categories(id, name, slug)";

export function shape(p: any): StoreProduct {
  const images = [...(p.product_images ?? [])].sort((a: any, b: any) => a.sort - b.sort).map((i: any) => i.url);
  const variants = [...(p.variants ?? [])].sort((a: any, b: any) => a.sort - b.sort);
  const prices = variants.map((v: any) => v.price ?? p.price);
  return {
    ...p,
    variants,
    images,
    totalStock: variants.reduce((s: number, v: any) => s + v.stock, 0),
    minPrice: prices.length ? Math.min(...prices) : p.price,
  };
}

export async function getStoreData() {
  const db = publicClient();
  const [settings, { data: categories }] = await Promise.all([getStoreSettings(db), db.from("categories").select("*").order("sort")]);
  return { settings, categories: (categories ?? []) as Category[] };
}

export async function listProducts(opts: { category?: string; sort?: string; q?: string; limit?: number; featured?: boolean } = {}) {
  const db = publicClient();
  let catId: string | undefined;
  if (opts.category) {
    const { data } = await db.from("categories").select("id").eq("slug", opts.category).maybeSingle();
    if (!data) return [];
    catId = data.id;
  }
  let q = db.from("products").select(SELECT).in("status", ["active", "sold_out"]);
  if (catId) q = q.eq("category_id", catId);
  if (opts.q) q = q.ilike("name", `%${opts.q}%`);
  if (opts.featured) q = q.eq("featured", true);
  if (opts.sort === "price_asc") q = q.order("price", { ascending: true });
  else if (opts.sort === "price_desc") q = q.order("price", { ascending: false });
  else q = q.order("created_at", { ascending: false });
  const { data } = await q.limit(opts.limit ?? 120);
  const list = (data ?? []).map(shape);
  // in-stock first, keep chosen order otherwise
  return list.sort((a, b) => Number(b.status === "active") - Number(a.status === "active"));
}

export async function getProductBySlug(slug: string) {
  const db = publicClient();
  const { data } = await db.from("products").select(SELECT).eq("slug", slug).in("status", ["active", "sold_out"]).maybeSingle();
  return data ? shape(data) : null;
}
