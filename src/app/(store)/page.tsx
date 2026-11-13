import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getStoreData, listProducts } from "@/lib/store";
import { ProductCard } from "@/components/store/product-card";

export const revalidate = 30;

const CAT_STYLE = [
  { bg: "bg-blush", emoji: "👶" },
  { bg: "bg-sky", emoji: "🎁" },
  { bg: "bg-sage", emoji: "🧸" },
  { bg: "bg-butter", emoji: "🍼" },
  { bg: "bg-lilac", emoji: "🛁" },
  { bg: "bg-blush", emoji: "🪀" },
  { bg: "bg-sky", emoji: "🎀" },
];

export default async function Home() {
  const [{ settings, categories }, newest, featured] = await Promise.all([
    getStoreData(),
    listProducts({ limit: 8 }),
    listProducts({ featured: true, limit: 4 }),
  ]);
  const heroImgs = (featured.length ? featured : newest).flatMap((p) => p.images.slice(0, 1)).slice(0, 3);

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute -left-24 -top-24 size-96 rounded-full bg-blush/70 blur-3xl" />
        <div className="pointer-events-none absolute -right-24 top-20 size-96 rounded-full bg-sky/70 blur-3xl" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 sm:px-6 md:grid-cols-2 md:py-20">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1 text-xs font-bold text-brand-dark shadow-sm">
              ✨ New arrivals every week
            </span>
            <h1 className="mt-5 text-4xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
              Little things for your <span className="text-brand">littlest</span> one.
            </h1>
            <p className="mt-5 max-w-md text-lg text-muted">{settings.tagline}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/shop" className="btn-primary !px-7 !py-3.5 text-base">
                Shop now <ArrowRight size={18} />
              </Link>
              {settings.instagram && (
                <a href={`https://instagram.com/${settings.instagram}`} target="_blank" className="btn-ghost !px-6 !py-3.5 text-base">
                  📸 See our reels
                </a>
              )}
            </div>
            <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm font-bold text-ink/70">
              <span>💵 Cash on delivery</span>
              <span>🚚 All over Pakistan</span>
              <span>🔁 Easy exchange</span>
            </div>
          </div>
          <div className="relative mx-auto h-80 w-full max-w-md sm:h-[420px]">
            {heroImgs.length ? (
              heroImgs.map((src, i) => (
                <img
                  key={src}
                  src={src}
                  alt=""
                  className={`absolute rounded-[2rem] border-4 border-white object-cover shadow-xl ${
                    ["left-0 top-6 h-64 w-48 -rotate-6 sm:h-80 sm:w-60", "right-0 top-0 h-56 w-44 rotate-6 sm:h-72 sm:w-52", "bottom-0 left-1/2 h-48 w-40 -translate-x-1/2 rotate-2 sm:h-56 sm:w-44"][i]
                  }`}
                />
              ))
            ) : (
              <div className="grid size-full place-items-center rounded-[2rem] bg-white/60 text-8xl shadow-inner">🧸</div>
            )}
          </div>
        </div>
      </section>

      {/* Categories */}
      {categories.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-4 sm:px-0 lg:grid-cols-7">
            {categories.map((c, i) => {
              const s = CAT_STYLE[i % CAT_STYLE.length];
              return (
                <Link key={c.id} href={`/shop?category=${c.slug}`} className={`group flex min-w-32 flex-col items-center gap-2 rounded-3xl ${s.bg} px-3 py-5 text-center transition hover:-translate-y-1`}>
                  <span className="text-3xl transition group-hover:scale-110">{s.emoji}</span>
                  <span className="text-sm font-bold leading-tight">{c.name}</span>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* New arrivals */}
      <section className="mx-auto mt-16 max-w-6xl px-4 sm:px-6">
        <div className="mb-6 flex items-end justify-between">
          <h2 className="text-3xl font-semibold tracking-tight">Just arrived</h2>
          <Link href="/shop" className="flex items-center gap-1 text-sm font-bold text-brand">
            View all <ArrowRight size={14} />
          </Link>
        </div>
        {newest.length ? (
          <div className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-4">
            {newest.map((p, i) => (
              <ProductCard key={p.id} p={p} index={i} />
            ))}
          </div>
        ) : (
          <div className="rounded-3xl bg-white/70 py-16 text-center text-muted">New goodies coming very soon 💕</div>
        )}
      </section>

      {/* Promise strip */}
      <section className="mx-auto mt-20 max-w-6xl px-4 sm:px-6">
        <div className="grid gap-4 rounded-[2rem] bg-ink p-8 text-white sm:grid-cols-3 sm:p-10">
          {[
            ["🧼", "Gentle on skin", "Soft, breathable fabrics chosen for newborn skin."],
            ["📦", "Pay when it arrives", "Cash on delivery, or JazzCash / Easypaisa if you prefer."],
            ["💬", "Real humans", "Questions about sizes? Message us on WhatsApp anytime."],
          ].map(([e, t, d]) => (
            <div key={t}>
              <div className="text-3xl">{e}</div>
              <div className="mt-3 font-heading text-lg font-semibold">{t}</div>
              <p className="mt-1 text-sm text-white/70">{d}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
