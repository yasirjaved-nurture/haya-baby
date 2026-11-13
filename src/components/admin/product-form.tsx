"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, ImagePlus, Loader2, Minus, Plus, Sparkles, Trash2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { deleteProduct, saveProduct, type ImageInput, type ProductInput, type VariantInput } from "@/app/admin/actions";
import type { Category, Product } from "@/lib/types";

const BABY_SIZES = ["NB", "0-3m", "3-6m", "6-9m", "9-12m", "12-18m", "18-24m", "2-3y"];

export function ProductForm({ product, categories }: { product?: Product; categories: Category[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [uploading, setUploading] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    name: product?.name ?? "",
    description: product?.description ?? "",
    category_id: product?.category_id ?? "",
    price: product?.price?.toString() ?? "",
    compare_at_price: product?.compare_at_price?.toString() ?? "",
    status: product?.status ?? "active",
    tags: (product?.tags ?? []).join(", "),
    instagram_url: product?.instagram_url ?? "",
    video_url: product?.video_url ?? "",
    featured: product?.featured ?? false,
  });
  const [variants, setVariants] = useState<VariantInput[]>(
    product?.variants?.length
      ? [...product.variants]
          .sort((a, b) => a.sort - b.sort)
          .map((v) => ({ id: v.id, size: v.size, color: v.color, sku: v.sku ?? "", price: v.price, stock: v.stock }))
      : [{ size: "", color: "", sku: "", price: null, stock: 0 }],
  );
  const [images, setImages] = useState<ImageInput[]>(
    [...(product?.product_images ?? [])].sort((a, b) => a.sort - b.sort).map((i) => ({ id: i.id, storage_path: i.storage_path, url: i.url })),
  );

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setSaved(false);
  };
  const setVariant = (i: number, patch: Partial<VariantInput>) => {
    setVariants((vs) => vs.map((v, j) => (j === i ? { ...v, ...patch } : v)));
    setSaved(false);
  };

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    const supabase = createClient();
    setUploading(files.length);
    for (const file of Array.from(files)) {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `products/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("product-images").upload(path, file, { contentType: file.type });
      if (error) setError(error.message);
      else {
        const url = supabase.storage.from("product-images").getPublicUrl(path).data.publicUrl;
        setImages((imgs) => [...imgs, { storage_path: path, url }]);
      }
      setUploading((n) => n - 1);
    }
    setSaved(false);
  }

  const moveImage = (i: number, dir: -1 | 1) =>
    setImages((imgs) => {
      const j = i + dir;
      if (j < 0 || j >= imgs.length) return imgs;
      const copy = [...imgs];
      [copy[i], copy[j]] = [copy[j], copy[i]];
      return copy;
    });

  function addBabySizes() {
    const existing = new Set(variants.map((v) => v.size));
    const fresh = BABY_SIZES.filter((s) => !existing.has(s)).map((size) => ({ size, color: "", sku: "", price: null, stock: 0 }));
    setVariants((vs) => [...vs.filter((v) => v.size || v.color || v.stock || v.id), ...fresh]);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const payload: ProductInput = {
      id: product?.id,
      name: form.name,
      description: form.description,
      category_id: form.category_id || null,
      price: Number(form.price),
      compare_at_price: form.compare_at_price ? Number(form.compare_at_price) : null,
      status: form.status as ProductInput["status"],
      tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
      instagram_url: form.instagram_url,
      video_url: form.video_url,
      featured: form.featured,
      variants: variants.map((v) => ({ ...v, stock: Number(v.stock) || 0, price: v.price ? Number(v.price) : null })),
      images,
    };
    start(async () => {
      const res = await saveProduct(payload);
      if (res.error) return setError(res.error);
      setSaved(true);
      if (!product) router.replace(`/admin/products/${res.id}`);
      router.refresh();
    });
  }

  const totalStock = variants.reduce((s, v) => s + (Number(v.stock) || 0), 0);

  return (
    <form onSubmit={submit} className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        {/* Details */}
        <section className="card space-y-4 p-5">
          <div>
            <label className="label">Name</label>
            <input className="input" required value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Bunny Print Cotton Romper" />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea className="input min-h-28" value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="Soft 100% cotton, snap buttons for easy changes…" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Price (Rs)</label>
              <input className="input" required inputMode="numeric" value={form.price} onChange={(e) => set("price", e.target.value.replace(/\D/g, ""))} placeholder="1450" />
            </div>
            <div>
              <label className="label">Was (optional, shows a sale)</label>
              <input className="input" inputMode="numeric" value={form.compare_at_price} onChange={(e) => set("compare_at_price", e.target.value.replace(/\D/g, ""))} placeholder="1800" />
            </div>
          </div>
        </section>

        {/* Photos */}
        <section className="card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">Photos</h2>
            <span className="text-xs text-muted">First photo is the cover</span>
          </div>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
            {images.map((img, i) => (
              <div key={img.url} className="group relative aspect-square overflow-hidden rounded-xl bg-shell ring-1 ring-line">
                <img src={img.url} alt="" className="size-full object-cover" />
                {i === 0 && <span className="absolute left-2 top-2 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-bold">Cover</span>}
                <div className="absolute inset-x-1.5 bottom-1.5 flex justify-between opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100">
                  <div className="flex gap-1">
                    <button type="button" onClick={() => moveImage(i, -1)} className="grid size-7 place-items-center rounded-full bg-white/95 shadow" aria-label="Move left">
                      <ChevronLeft size={14} />
                    </button>
                    <button type="button" onClick={() => moveImage(i, 1)} className="grid size-7 place-items-center rounded-full bg-white/95 shadow" aria-label="Move right">
                      <ChevronRight size={14} />
                    </button>
                  </div>
                  <button type="button" onClick={() => setImages((imgs) => imgs.filter((_, j) => j !== i))} className="grid size-7 place-items-center rounded-full bg-white/95 text-brand-dark shadow" aria-label="Remove">
                    <X size={14} />
                  </button>
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="grid aspect-square place-items-center rounded-xl border-2 border-dashed border-line text-muted transition hover:border-brand hover:text-brand"
            >
              {uploading ? <Loader2 className="animate-spin" /> : (
                <span className="flex flex-col items-center gap-1 text-xs font-bold">
                  <ImagePlus /> Add photos
                </span>
              )}
            </button>
          </div>
          <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => upload(e.target.files)} />
        </section>

        {/* Variants */}
        <section className="card p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-semibold">Sizes & stock</h2>
              <p className="text-xs text-muted">Total in stock: <b className="text-ink">{totalStock}</b></p>
            </div>
            <button type="button" onClick={addBabySizes} className="btn-ghost !px-3 !py-1.5 text-xs">
              <Sparkles size={14} /> Add baby sizes
            </button>
          </div>
          <div className="space-y-2">
            <div className="hidden grid-cols-[1fr_1fr_110px_150px_36px] gap-2 px-1 text-[11px] font-bold uppercase tracking-wide text-muted sm:grid">
              <span>Size</span>
              <span>Colour</span>
              <span>Price override</span>
              <span>Stock</span>
              <span />
            </div>
            {variants.map((v, i) => (
              <div key={v.id ?? `new-${i}`} className="grid grid-cols-2 gap-2 rounded-xl bg-shell/50 p-2 sm:grid-cols-[1fr_1fr_110px_150px_36px] sm:bg-transparent sm:p-0">
                <input className="input" placeholder="Size (e.g. 0-3m)" value={v.size} onChange={(e) => setVariant(i, { size: e.target.value })} />
                <input className="input" placeholder="Colour" value={v.color} onChange={(e) => setVariant(i, { color: e.target.value })} />
                <input className="input" placeholder="Same" inputMode="numeric" value={v.price ?? ""} onChange={(e) => setVariant(i, { price: e.target.value ? Number(e.target.value.replace(/\D/g, "")) : null })} />
                <div className="flex items-center rounded-xl border border-line bg-white">
                  <button type="button" className="grid size-10 place-items-center text-muted hover:text-ink" onClick={() => setVariant(i, { stock: Math.max(0, (Number(v.stock) || 0) - 1) })} aria-label="Less">
                    <Minus size={14} />
                  </button>
                  <input className="w-full min-w-0 bg-transparent text-center text-sm font-bold outline-none" inputMode="numeric" value={v.stock} onChange={(e) => setVariant(i, { stock: Number(e.target.value.replace(/\D/g, "")) || 0 })} />
                  <button type="button" className="grid size-10 place-items-center text-muted hover:text-ink" onClick={() => setVariant(i, { stock: (Number(v.stock) || 0) + 1 })} aria-label="More">
                    <Plus size={14} />
                  </button>
                </div>
                <button
                  type="button"
                  disabled={variants.length === 1}
                  onClick={() => setVariants((vs) => vs.filter((_, j) => j !== i))}
                  className="grid size-10 place-items-center rounded-xl text-muted hover:bg-brand-soft hover:text-brand-dark disabled:opacity-30"
                  aria-label="Remove variant"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
          <button type="button" onClick={() => setVariants((vs) => [...vs, { size: "", color: "", sku: "", price: null, stock: 0 }])} className="mt-3 text-sm font-bold text-brand">
            + Add variant
          </button>
        </section>
      </div>

      {/* Sidebar */}
      <div className="space-y-6">
        <section className="card space-y-4 p-5">
          <div>
            <label className="label">Status</label>
            <select className="input" value={form.status} onChange={(e) => set("status", e.target.value as typeof form.status)}>
              <option value="active">🟢 Active — visible in shop</option>
              <option value="sold_out">🔴 Sold out — visible, can't order</option>
              <option value="hidden">🙈 Hidden</option>
              <option value="draft">📝 Draft</option>
            </select>
            <p className="mt-1.5 text-xs text-muted">Switches to sold out automatically when stock hits 0.</p>
          </div>
          <div>
            <label className="label">Category</label>
            <select className="input" value={form.category_id} onChange={(e) => set("category_id", e.target.value)}>
              <option value="">Uncategorised</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Tags</label>
            <input className="input" value={form.tags} onChange={(e) => set("tags", e.target.value)} placeholder="cotton, girl, eid" />
          </div>
          <label className="flex cursor-pointer items-center gap-2.5 text-sm font-bold">
            <input type="checkbox" className="size-4 accent-[var(--color-brand)]" checked={form.featured} onChange={(e) => set("featured", e.target.checked)} />
            Feature on home page
          </label>
        </section>

        <section className="card space-y-4 p-5">
          <div>
            <label className="label">Instagram post / reel link</label>
            <input className="input" value={form.instagram_url} onChange={(e) => set("instagram_url", e.target.value)} placeholder="https://instagram.com/reel/…" />
          </div>
          <div>
            <label className="label">Video link</label>
            <input className="input" value={form.video_url} onChange={(e) => set("video_url", e.target.value)} placeholder="Added automatically from WhatsApp" />
          </div>
        </section>

        <div className="sticky bottom-4 space-y-2">
          {error && <p className="rounded-xl bg-brand-soft px-3 py-2 text-sm font-semibold text-brand-dark">{error}</p>}
          <button className="btn-primary w-full !py-3" disabled={pending || uploading > 0}>
            {pending ? <Loader2 className="animate-spin" size={16} /> : null}
            {pending ? "Saving…" : saved ? "Saved ✓" : product ? "Save changes" : "Create product"}
          </button>
          {product && (
            <button
              type="button"
              className="w-full rounded-full py-2 text-sm font-bold text-muted hover:text-brand-dark"
              onClick={() => {
                if (confirm(`Delete “${product.name}”? This can't be undone.`)) start(() => deleteProduct(product.id));
              }}
            >
              Delete product
            </button>
          )}
        </div>
      </div>
    </form>
  );
}
