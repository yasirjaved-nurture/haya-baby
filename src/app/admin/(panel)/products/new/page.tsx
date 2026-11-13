import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ProductForm } from "@/components/admin/product-form";
import { PageHeader } from "@/components/admin/ui";

export default async function NewProduct() {
  const supabase = await createClient();
  const { data: categories } = await supabase.from("categories").select("*").order("sort");
  return (
    <>
      <Link href="/admin/products" className="mb-3 inline-flex items-center gap-1 text-sm font-bold text-muted hover:text-ink">
        <ArrowLeft size={14} /> Products
      </Link>
      <PageHeader title="New product" subtitle="Tip: it's often faster to send a photo + price to the WhatsApp bot." />
      <ProductForm categories={categories ?? []} />
    </>
  );
}
