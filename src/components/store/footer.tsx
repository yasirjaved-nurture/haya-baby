import Link from "next/link";
import { normalizePhone } from "@/lib/format";
import type { Category, StoreSettings } from "@/lib/types";

export function StoreFooter({ settings, categories }: { settings: StoreSettings; categories: Category[] }) {
  const wa = settings.whatsapp_contact ? normalizePhone(settings.whatsapp_contact) : "";
  return (
    <footer className="mt-24 bg-shell">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-4">
        <div className="md:col-span-2">
          <div className="flex items-center gap-2">
            <span className="grid size-9 place-items-center rounded-full bg-blush text-lg">🍼</span>
            <span className="font-heading text-xl font-semibold">{settings.shop_name}</span>
          </div>
          <p className="mt-3 max-w-sm text-sm text-muted">{settings.tagline}</p>
          <div className="mt-5 flex flex-wrap gap-2">
            {settings.instagram && (
              <a href={`https://instagram.com/${settings.instagram}`} target="_blank" className="btn-ghost !py-2">
                📸 @{settings.instagram}
              </a>
            )}
            {wa && (
              <a href={`https://wa.me/${wa}`} target="_blank" className="btn !py-2 bg-[#25d366] text-white hover:bg-[#1ebe5b]">
                💬 WhatsApp us
              </a>
            )}
          </div>
        </div>
        <div>
          <h4 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted">Shop</h4>
          <ul className="space-y-2 text-sm font-semibold">
            <li><Link href="/shop" className="hover:text-brand">All products</Link></li>
            {categories.slice(0, 6).map((c) => (
              <li key={c.id}><Link href={`/shop?category=${c.slug}`} className="hover:text-brand">{c.name}</Link></li>
            ))}
          </ul>
        </div>
        <div>
          <h4 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted">Good to know</h4>
          <ul className="space-y-2 text-sm font-semibold text-ink/80">
            <li>💵 Cash on delivery</li>
            <li>🚚 Delivery in 3–5 working days</li>
            <li>🔁 Easy size exchange</li>
            <li>🧼 Baby-safe fabrics</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-line py-5 text-center text-xs text-muted">
        © {new Date().getFullYear()} {settings.shop_name}. Made with love in Pakistan.
      </div>
    </footer>
  );
}
