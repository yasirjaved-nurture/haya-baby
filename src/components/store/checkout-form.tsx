"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useCart } from "./cart";
import { formatPKR } from "@/lib/format";
import type { StoreSettings } from "@/lib/types";

const CITIES = ["Karachi", "Lahore", "Islamabad", "Rawalpindi", "Faisalabad", "Multan", "Hyderabad", "Peshawar", "Quetta", "Sialkot", "Gujranwala"];

export function CheckoutForm({ settings }: { settings: StoreSettings }) {
  const router = useRouter();
  const { items, subtotal, clear, ready } = useCart();
  const methods = [
    settings.payment.cod && { key: "cod", label: "Cash on delivery", emoji: "💵", note: "Pay when your parcel arrives." },
    settings.payment.jazzcash.enabled && { key: "jazzcash", label: "JazzCash", emoji: "📱", account: settings.payment.jazzcash },
    settings.payment.easypaisa.enabled && { key: "easypaisa", label: "Easypaisa", emoji: "📱", account: settings.payment.easypaisa },
    settings.payment.bank.enabled && { key: "bank", label: "Bank transfer", emoji: "🏦" },
  ].filter(Boolean) as { key: string; label: string; emoji: string; note?: string; account?: { title: string; number: string } }[];

  const [form, setForm] = useState({ customer_name: "", phone: "", city: "Karachi", address: "", notes: "", payment_method: methods[0]?.key ?? "cod", payment_ref: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const fee = settings.free_delivery_over > 0 && subtotal >= settings.free_delivery_over ? 0 : settings.delivery_fee;
  const total = subtotal + fee;
  const method = methods.find((m) => m.key === form.payment_method);

  if (!ready) return <div className="min-h-[50vh]" />;
  if (!items.length)
    return (
      <div className="py-20 text-center">
        <p className="font-bold">Your bag is empty.</p>
        <Link href="/shop" className="btn-primary mt-4">Go shopping</Link>
      </div>
    );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, items: items.map((i) => ({ variant_id: i.variantId, qty: i.qty })) }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setLoading(false);
      return setError(json.error || "Something went wrong. Please try again.");
    }
    clear();
    router.push(`/order/${json.id}`);
  }

  return (
    <form onSubmit={submit} className="grid gap-8 md:grid-cols-[1fr_340px]">
      <div className="space-y-6">
        <section className="rounded-3xl bg-white p-6 ring-1 ring-line">
          <h2 className="text-xl font-semibold">Delivery details</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="label">Full name</label>
              <input className="input" required autoComplete="name" value={form.customer_name} onChange={(e) => set("customer_name", e.target.value)} />
            </div>
            <div>
              <label className="label">Mobile number</label>
              <input className="input" required inputMode="tel" autoComplete="tel" placeholder="0300 1234567" value={form.phone} onChange={(e) => set("phone", e.target.value)} />
            </div>
            <div>
              <label className="label">City</label>
              <input className="input" required list="cities" value={form.city} onChange={(e) => set("city", e.target.value)} />
              <datalist id="cities">{CITIES.map((c) => <option key={c} value={c} />)}</datalist>
            </div>
            <div className="sm:col-span-2">
              <label className="label">Full address</label>
              <textarea className="input min-h-20" required autoComplete="street-address" placeholder="House #, street, area, landmark" value={form.address} onChange={(e) => set("address", e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <label className="label">Notes (optional)</label>
              <input className="input" placeholder="e.g. gift wrap, call before delivery" value={form.notes} onChange={(e) => set("notes", e.target.value)} />
            </div>
          </div>
        </section>

        <section className="rounded-3xl bg-white p-6 ring-1 ring-line">
          <h2 className="text-xl font-semibold">Payment</h2>
          <div className="mt-4 grid gap-2">
            {methods.map((m) => (
              <label key={m.key} className={`flex cursor-pointer items-center gap-3 rounded-2xl p-4 ring-1 transition ${form.payment_method === m.key ? "bg-blush/40 ring-brand" : "ring-line hover:ring-ink/30"}`}>
                <input type="radio" name="pm" className="accent-[var(--color-brand)]" checked={form.payment_method === m.key} onChange={() => set("payment_method", m.key)} />
                <span className="text-xl">{m.emoji}</span>
                <span className="font-bold">{m.label}</span>
              </label>
            ))}
          </div>
          {method && method.key !== "cod" && (
            <div className="mt-4 rounded-2xl bg-shell p-4 text-sm">
              <p className="font-bold">Send {formatPKR(total)} to:</p>
              {method.account ? (
                <p className="mt-1">{method.account.title}<br /><span className="font-heading text-lg font-semibold">{method.account.number}</span></p>
              ) : (
                <p className="mt-1">
                  {settings.payment.bank.bank_name} — {settings.payment.bank.title}<br />
                  Account: <b>{settings.payment.bank.account}</b>
                  {settings.payment.bank.iban && <><br />IBAN: <b>{settings.payment.bank.iban}</b></>}
                </p>
              )}
              <label className="label mt-4">Transaction ID</label>
              <input className="input" placeholder="Paste it here (you can also send it later)" value={form.payment_ref} onChange={(e) => set("payment_ref", e.target.value)} />
            </div>
          )}
          {method?.key === "cod" && <p className="mt-3 text-sm text-muted">{method.note}</p>}
        </section>
      </div>

      <aside className="h-fit rounded-3xl bg-white p-6 ring-1 ring-line md:sticky md:top-24">
        <h2 className="text-xl font-semibold">Order summary</h2>
        <ul className="mt-4 space-y-3">
          {items.map((i) => (
            <li key={i.variantId} className="flex items-center gap-3 text-sm">
              <div className="relative size-14 shrink-0 overflow-hidden rounded-xl bg-blush/50">
                {i.image && <img src={i.image} alt="" className="size-full object-cover" />}
                <span className="absolute -right-0 -top-0 grid size-5 place-items-center rounded-bl-lg bg-ink text-[10px] font-bold text-white">{i.qty}</span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="line-clamp-1 font-bold">{i.name}</div>
                <div className="text-xs text-muted">{i.variant}</div>
              </div>
              <span className="font-bold">{formatPKR(i.price * i.qty)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-5 space-y-1.5 border-t border-line pt-4 text-sm">
          <div className="flex justify-between"><span className="text-muted">Subtotal</span><span>{formatPKR(subtotal)}</span></div>
          <div className="flex justify-between"><span className="text-muted">Delivery</span><span>{fee ? formatPKR(fee) : "Free 🎉"}</span></div>
          {fee > 0 && settings.free_delivery_over > 0 && (
            <p className="text-xs text-sage-deep">Add {formatPKR(settings.free_delivery_over - subtotal)} more for free delivery</p>
          )}
          <div className="flex justify-between pt-2 font-heading text-xl font-semibold"><span>Total</span><span>{formatPKR(total)}</span></div>
        </div>
        {error && <p className="mt-4 rounded-xl bg-brand-soft px-3 py-2 text-sm font-semibold text-brand-dark">{error}</p>}
        <button className="btn-primary mt-5 w-full !py-3.5 text-base" disabled={loading}>
          {loading && <Loader2 size={18} className="animate-spin" />} Place order
        </button>
      </aside>
    </form>
  );
}
