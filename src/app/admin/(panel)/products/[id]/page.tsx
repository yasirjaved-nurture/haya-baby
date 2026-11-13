/* eslint-disable @typescript-eslint/no-explicit-any */
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ProductForm } from "@/components/admin/product-form";
import { PageHeader, SourceBadge, StatusBadge } from "@/components/admin/ui";
import { timeAgo, variantLabel } from "@/lib/format";

export default async function EditProduct({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: product }, { data: categories }, { data: moves }] = await Promise.all([
    supabase.from("products").select("*, variants(*), product_images(*)").eq("id", id).maybeSingle(),
    supabase.from("categories").select("*").order("sort"),
    supabase
      .from("stock_movements")
      .select("id, change, stock_after, reason, source, actor, created_at, variants(size, color)")
      .eq("product_id", id)
      .order("created_at", { ascending: false })
      .limit(15),
  ]);
  if (!product) notFound();

  return (
    <>
      <Link href="/admin/products" className="mb-3 inline-flex items-center gap-1 text-sm font-bold text-muted hover:text-ink">
        <ArrowLeft size={14} /> Products
      </Link>
      <PageHeader
        title={product.name}
        subtitle={`Last updated ${timeAgo(product.updated_at)}`}
        action={
          <div className="flex items-center gap-2">
            <StatusBadge status={product.status} />
            <Link href={`/product/${product.slug}`} target="_blank" className="btn-ghost !py-2">
              View in shop <ExternalLink size={14} />
            </Link>
          </div>
        }
      />
      <ProductForm key={product.updated_at} product={product} categories={categories ?? []} />

      {product.ai_description && (
        <p className="mt-6 rounded-2xl bg-lilac/50 px-5 py-4 text-sm">
          <b>🤖 What the bot sees in the photos:</b> {product.ai_description}
        </p>
      )}

      <section className="card mt-6">
        <h2 className="border-b border-line px-5 py-4 font-semibold">Stock history</h2>
        {moves?.length ? (
          <ul className="divide-y divide-line">
            {moves.map((m: any) => (
              <li key={m.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-3 text-sm">
                <span className={`w-12 font-heading text-base font-semibold ${m.change < 0 ? "text-brand-dark" : "text-sage-deep"}`}>
                  {m.change > 0 ? `+${m.change}` : m.change}
                </span>
                <span className="min-w-0 flex-1">
                  {m.variants ? variantLabel(m.variants) : "—"} <span className="text-muted">→ {m.stock_after} · {m.reason}</span>
                  {m.actor && <span className="block text-xs text-muted">by {m.actor}</span>}
                </span>
                <SourceBadge source={m.source} />
                <span className="w-20 text-right text-xs text-muted">{timeAgo(m.created_at)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-5 py-8 text-center text-sm text-muted">No stock changes yet.</p>
        )}
      </section>
    </>
  );
}
