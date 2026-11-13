import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { getProductBySlug, getStoreData, listProducts } from "@/lib/store";
import { ProductView } from "@/components/store/product-view";
import { ProductCard } from "@/components/store/product-card";

export const revalidate = 15;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const p = await getProductBySlug(slug);
  if (!p) return {};
  return { title: p.name, description: p.description ?? undefined, openGraph: { images: p.images.slice(0, 1) } };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [p, { settings }] = await Promise.all([getProductBySlug(slug), getStoreData()]);
  if (!p) notFound();
  const related = p.categories?.slug ? (await listProducts({ category: p.categories.slug, limit: 5 })).filter((x) => x.id !== p.id).slice(0, 4) : [];

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <Link href="/shop" className="mb-5 inline-flex items-center gap-1 text-sm font-bold text-muted hover:text-ink">
        <ChevronLeft size={16} /> Back to shop
      </Link>
      <ProductView p={p} whatsapp={settings.whatsapp_contact} siteUrl={process.env.NEXT_PUBLIC_SITE_URL || ""} />
      {related.length > 0 && (
        <section className="mt-20">
          <h2 className="mb-6 text-2xl font-semibold">You may also like</h2>
          <div className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-4">
            {related.map((r, i) => (
              <ProductCard key={r.id} p={r} index={i + 1} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
