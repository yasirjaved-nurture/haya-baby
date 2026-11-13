"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { normalizePhone, slugify } from "@/lib/format";
import { mergeSettings } from "@/lib/settings";
import type { StoreSettings } from "@/lib/types";

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");
  const { data: ok } = await supabase.rpc("is_admin");
  if (!ok) throw new Error("This account is not an admin");
  return { supabase, actor: user.email ?? user.id };
}

function revalidateStore() {
  revalidatePath("/", "layout");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/admin/login");
}

// ───────────── products ─────────────
export type VariantInput = { id?: string; size: string; color: string; sku: string; price: number | null; stock: number };
export type ImageInput = { id?: string; storage_path: string; url: string };
export type ProductInput = {
  id?: string;
  name: string;
  description: string;
  category_id: string | null;
  price: number;
  compare_at_price: number | null;
  status: "draft" | "active" | "sold_out" | "hidden";
  tags: string[];
  instagram_url: string;
  video_url: string;
  featured: boolean;
  variants: VariantInput[];
  images: ImageInput[];
};

export async function saveProduct(input: ProductInput): Promise<{ id?: string; error?: string }> {
  try {
    const { supabase, actor } = await requireAdmin();
    if (!input.name.trim()) return { error: "Name is required" };
    if (!Number.isFinite(input.price) || input.price < 0) return { error: "Price is invalid" };
    if (!input.variants.length) return { error: "Add at least one size / variant" };
    const keys = input.variants.map((v) => `${v.size.trim().toLowerCase()}|${v.color.trim().toLowerCase()}`);
    if (new Set(keys).size !== keys.length) return { error: "Two variants have the same size and colour" };

    const fields = {
      name: input.name.trim(),
      description: input.description.trim() || null,
      category_id: input.category_id || null,
      price: Math.round(input.price),
      compare_at_price: input.compare_at_price ? Math.round(input.compare_at_price) : null,
      status: input.status,
      tags: input.tags,
      instagram_url: input.instagram_url.trim() || null,
      video_url: input.video_url.trim() || null,
      featured: input.featured,
    };

    let productId = input.id;
    if (productId) {
      const { error } = await supabase.from("products").update(fields).eq("id", productId);
      if (error) return { error: error.message };
    } else {
      const base = slugify(fields.name);
      const { data: taken } = await supabase.from("products").select("slug").like("slug", `${base}%`);
      const set = new Set((taken ?? []).map((t: { slug: string }) => t.slug));
      let slug = base;
      for (let i = 2; set.has(slug); i++) slug = `${base}-${i}`;
      const { data, error } = await supabase.from("products").insert({ ...fields, slug }).select("id").single();
      if (error) return { error: error.message };
      productId = data.id as string;
    }

    // ── variants
    const { data: existing } = await supabase.from("variants").select("id, stock").eq("product_id", productId);
    const keep = new Set(input.variants.filter((v) => v.id).map((v) => v.id));
    const remove = (existing ?? []).filter((v: { id: string }) => !keep.has(v.id)).map((v: { id: string }) => v.id);
    if (remove.length) await supabase.from("variants").delete().in("id", remove);

    for (const [i, v] of input.variants.entries()) {
      const row = {
        size: v.size.trim(),
        color: v.color.trim(),
        sku: v.sku.trim() || null,
        price: v.price ? Math.round(v.price) : null,
        sort: i,
      };
      let variantId = v.id;
      if (variantId) {
        const { error } = await supabase.from("variants").update(row).eq("id", variantId);
        if (error) return { error: error.message };
      } else {
        const { data, error } = await supabase.from("variants").insert({ ...row, product_id: productId, stock: 0 }).select("id").single();
        if (error) return { error: error.message };
        variantId = data.id as string;
      }
      const before = (existing ?? []).find((e: { id: string }) => e.id === variantId)?.stock ?? 0;
      const target = Math.max(0, Math.round(v.stock || 0));
      if (target !== before) {
        const { error } = await supabase.rpc("set_stock", {
          p_variant: variantId,
          p_stock: target,
          p_reason: v.id ? "Edited in dashboard" : "Initial stock",
          p_source: "dashboard",
          p_actor: actor,
        });
        if (error) return { error: error.message };
      }
    }

    // ── images
    const { data: oldImgs } = await supabase.from("product_images").select("id, storage_path").eq("product_id", productId);
    const keepImg = new Set(input.images.filter((i) => i.id).map((i) => i.id));
    const dropped = (oldImgs ?? []).filter((i: { id: string }) => !keepImg.has(i.id));
    if (dropped.length) {
      await supabase.from("product_images").delete().in("id", dropped.map((d: { id: string }) => d.id));
      await supabase.storage.from("product-images").remove(dropped.map((d: { storage_path: string }) => d.storage_path));
    }
    for (const [i, img] of input.images.entries()) {
      if (img.id) await supabase.from("product_images").update({ sort: i }).eq("id", img.id);
      else await supabase.from("product_images").insert({ product_id: productId, storage_path: img.storage_path, url: img.url, sort: i });
    }

    await supabase.rpc("refresh_product_status", { p_product: productId });
    revalidateStore();
    return { id: productId };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function deleteProduct(id: string) {
  const { supabase } = await requireAdmin();
  const { data: imgs } = await supabase.from("product_images").select("storage_path").eq("product_id", id);
  await supabase.from("products").delete().eq("id", id);
  if (imgs?.length) await supabase.storage.from("product-images").remove(imgs.map((i: { storage_path: string }) => i.storage_path));
  revalidateStore();
  redirect("/admin/products");
}

export async function quickAdjust(variantId: string, change: number) {
  const { supabase, actor } = await requireAdmin();
  const { error } = await supabase.rpc("adjust_stock", {
    p_variant: variantId,
    p_change: change,
    p_reason: change < 0 ? "Sold (dashboard)" : "Restock (dashboard)",
    p_source: "dashboard",
    p_actor: actor,
    p_clamp: true,
  });
  if (error) return { error: error.message };
  revalidateStore();
  return {};
}

// ───────────── orders ─────────────
export async function updateOrder(id: string, patch: { status?: string; payment_status?: string }) {
  const { supabase, actor } = await requireAdmin();
  if (patch.status === "cancelled") {
    const { error } = await supabase.rpc("cancel_order", { p_order: id, p_actor: actor });
    if (error) return { error: error.message };
    delete patch.status;
  }
  if (Object.keys(patch).length) {
    const { error } = await supabase.from("orders").update(patch).eq("id", id);
    if (error) return { error: error.message };
  }
  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${id}`);
  revalidateStore();
  return {};
}

// ───────────── settings ─────────────
export async function saveSettings(value: StoreSettings) {
  const { supabase } = await requireAdmin();
  const clean = mergeSettings(value);
  const { error } = await supabase.from("settings").upsert({ key: "store", value: clean });
  if (error) return { error: error.message };
  revalidateStore();
  return {};
}

export async function addBotUser(phoneRaw: string, name: string, role: "owner" | "staff") {
  const { supabase } = await requireAdmin();
  const phone = normalizePhone(phoneRaw);
  if (phone.length < 11) return { error: "Enter a full number, e.g. 0300 1234567" };
  const { error } = await supabase.from("bot_users").upsert({ phone, name: name.trim() || null, role, active: true });
  if (error) return { error: error.message };
  revalidatePath("/admin/settings");
  return {};
}

export async function updateBotUser(phone: string, patch: { active?: boolean; notify_orders?: boolean }) {
  const { supabase } = await requireAdmin();
  await supabase.from("bot_users").update(patch).eq("phone", phone);
  revalidatePath("/admin/settings");
}

export async function removeBotUser(phone: string) {
  const { supabase } = await requireAdmin();
  await supabase.from("bot_users").delete().eq("phone", phone);
  revalidatePath("/admin/settings");
}

export async function addCategory(name: string) {
  const { supabase } = await requireAdmin();
  if (!name.trim()) return { error: "Name required" };
  const { count } = await supabase.from("categories").select("id", { count: "exact", head: true });
  const { error } = await supabase.from("categories").insert({ name: name.trim(), slug: slugify(name), sort: (count ?? 0) + 1 });
  if (error) return { error: error.message.includes("duplicate") ? "That category already exists" : error.message };
  revalidatePath("/admin/settings");
  revalidateStore();
  return {};
}

export async function deleteCategory(id: string) {
  const { supabase } = await requireAdmin();
  await supabase.from("categories").delete().eq("id", id);
  revalidatePath("/admin/settings");
  revalidateStore();
}
