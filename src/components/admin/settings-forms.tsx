"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bell, BellOff, Loader2, Trash2 } from "lucide-react";
import { addBotUser, addCategory, deleteCategory, removeBotUser, saveSettings, updateBotUser } from "@/app/admin/actions";
import type { Category, StoreSettings } from "@/lib/types";

function Section({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <section className="card p-5 sm:p-6">
      <h2 className="font-semibold">{title}</h2>
      {desc && <p className="mt-0.5 text-sm text-muted">{desc}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 py-1">
      <span className="text-sm font-bold">{label}</span>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 rounded-full transition ${checked ? "bg-sage-deep" : "bg-ink/15"}`}
        aria-pressed={checked}
      >
        <span className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition ${checked ? "left-[22px]" : "left-0.5"}`} />
      </button>
    </label>
  );
}

export function StoreSettingsForm({ initial }: { initial: StoreSettings }) {
  const router = useRouter();
  const [s, setS] = useState(initial);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState("");
  const up = (patch: Partial<StoreSettings>) => setS((x) => ({ ...x, ...patch }));
  const pay = <K extends keyof StoreSettings["payment"]>(k: K, patch: Partial<StoreSettings["payment"][K]> | boolean) =>
    setS((x) => ({
      ...x,
      payment: { ...x.payment, [k]: typeof patch === "boolean" ? patch : { ...(x.payment[k] as object), ...patch } },
    }));

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await saveSettings(s);
          setMsg(r.error ?? "Saved ✓");
          router.refresh();
        });
      }}
    >
      <Section title="Shop" desc="Shown on your website.">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Shop name</label>
            <input className="input" value={s.shop_name} onChange={(e) => up({ shop_name: e.target.value })} />
          </div>
          <div>
            <label className="label">Tagline</label>
            <input className="input" value={s.tagline} onChange={(e) => up({ tagline: e.target.value })} />
          </div>
          <div>
            <label className="label">Instagram handle</label>
            <input className="input" placeholder="littlenest.pk" value={s.instagram} onChange={(e) => up({ instagram: e.target.value.replace("@", "") })} />
          </div>
          <div>
            <label className="label">WhatsApp for customers</label>
            <input className="input" placeholder="0300 1234567" value={s.whatsapp_contact} onChange={(e) => up({ whatsapp_contact: e.target.value })} />
          </div>
        </div>
      </Section>

      <Section title="Delivery & stock">
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="label">Delivery fee (Rs)</label>
            <input className="input" inputMode="numeric" value={s.delivery_fee} onChange={(e) => up({ delivery_fee: Number(e.target.value.replace(/\D/g, "")) || 0 })} />
          </div>
          <div>
            <label className="label">Free delivery over (Rs)</label>
            <input className="input" inputMode="numeric" value={s.free_delivery_over} onChange={(e) => up({ free_delivery_over: Number(e.target.value.replace(/\D/g, "")) || 0 })} />
            <p className="mt-1 text-xs text-muted">0 = never free</p>
          </div>
          <div>
            <label className="label">Low stock alert at</label>
            <input className="input" inputMode="numeric" value={s.low_stock_threshold} onChange={(e) => up({ low_stock_threshold: Number(e.target.value.replace(/\D/g, "")) || 0 })} />
          </div>
        </div>
      </Section>

      <Section title="Payment methods" desc="Online payments are confirmed manually — the customer sends the money and enters the transaction ID.">
        <div className="divide-y divide-line">
          <div className="pb-3">
            <Toggle label="💵 Cash on delivery" checked={s.payment.cod} onChange={(v) => pay("cod", v)} />
          </div>
          {(["jazzcash", "easypaisa"] as const).map((k) => (
            <div key={k} className="py-3">
              <Toggle label={k === "jazzcash" ? "📱 JazzCash" : "📱 Easypaisa"} checked={s.payment[k].enabled} onChange={(v) => pay(k, { enabled: v })} />
              {s.payment[k].enabled && (
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <input className="input" placeholder="Account title" value={s.payment[k].title} onChange={(e) => pay(k, { title: e.target.value })} />
                  <input className="input" placeholder="Mobile account number" value={s.payment[k].number} onChange={(e) => pay(k, { number: e.target.value })} />
                </div>
              )}
            </div>
          ))}
          <div className="pt-3">
            <Toggle label="🏦 Bank transfer" checked={s.payment.bank.enabled} onChange={(v) => pay("bank", { enabled: v })} />
            {s.payment.bank.enabled && (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <input className="input" placeholder="Bank name" value={s.payment.bank.bank_name} onChange={(e) => pay("bank", { bank_name: e.target.value })} />
                <input className="input" placeholder="Account title" value={s.payment.bank.title} onChange={(e) => pay("bank", { title: e.target.value })} />
                <input className="input" placeholder="Account number" value={s.payment.bank.account} onChange={(e) => pay("bank", { account: e.target.value })} />
                <input className="input" placeholder="IBAN" value={s.payment.bank.iban} onChange={(e) => pay("bank", { iban: e.target.value })} />
              </div>
            )}
          </div>
        </div>
      </Section>

      <div className="flex items-center gap-3">
        <button className="btn-primary" disabled={pending}>
          {pending && <Loader2 size={16} className="animate-spin" />} Save settings
        </button>
        {msg && <span className="text-sm font-bold text-muted">{msg}</span>}
      </div>
    </form>
  );
}

type BotUser = { phone: string; name: string | null; role: string; active: boolean; notify_orders: boolean };

export function BotUsers({ users }: { users: BotUser[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<"owner" | "staff">("staff");
  const [err, setErr] = useState("");
  const act = (fn: () => Promise<unknown>) => start(async () => { await fn(); router.refresh(); });

  return (
    <Section title="WhatsApp bot access" desc="Only these numbers can update stock by WhatsApp. Everyone else gets your shop link.">
      <ul className="divide-y divide-line rounded-xl border border-line">
        {users.map((u) => (
          <li key={u.phone} className="flex items-center gap-3 px-4 py-3">
            <div className="grid size-9 place-items-center rounded-full bg-[#dcf8c6] text-sm">💬</div>
            <div className="min-w-0 flex-1">
              <div className="font-bold">{u.name || "Unnamed"} <span className="ml-1 rounded-full bg-shell px-2 py-0.5 text-[11px] capitalize text-muted">{u.role}</span></div>
              <div className="text-xs text-muted">+{u.phone}{!u.active && " · paused"}</div>
            </div>
            <button
              title={u.notify_orders ? "Gets new order alerts" : "No order alerts"}
              onClick={() => act(() => updateBotUser(u.phone, { notify_orders: !u.notify_orders }))}
              className={`grid size-9 place-items-center rounded-full ${u.notify_orders ? "bg-butter text-amber-800" : "text-muted hover:bg-shell"}`}
            >
              {u.notify_orders ? <Bell size={16} /> : <BellOff size={16} />}
            </button>
            <button onClick={() => act(() => updateBotUser(u.phone, { active: !u.active }))} className="text-xs font-bold text-muted hover:text-ink">
              {u.active ? "Pause" : "Resume"}
            </button>
            <button onClick={() => confirm("Remove this number?") && act(() => removeBotUser(u.phone))} className="grid size-9 place-items-center rounded-full text-muted hover:bg-brand-soft hover:text-brand-dark">
              <Trash2 size={16} />
            </button>
          </li>
        ))}
        {!users.length && <li className="px-4 py-6 text-center text-sm text-muted">No numbers yet — numbers in OWNER_PHONES still work.</li>}
      </ul>
      <form
        className="mt-4 grid gap-2 sm:grid-cols-[1fr_1fr_120px_auto]"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const r = await addBotUser(phone, name, role);
            if (r.error) return setErr(r.error);
            setErr("");
            setPhone("");
            setName("");
            router.refresh();
          });
        }}
      >
        <input className="input" placeholder="0300 1234567" value={phone} onChange={(e) => setPhone(e.target.value)} required />
        <input className="input" placeholder="Name (e.g. Ammi, Shop staff)" value={name} onChange={(e) => setName(e.target.value)} />
        <select className="input" value={role} onChange={(e) => setRole(e.target.value as "owner" | "staff")}>
          <option value="staff">Staff</option>
          <option value="owner">Owner</option>
        </select>
        <button className="btn-dark" disabled={pending}>Add</button>
      </form>
      {err && <p className="mt-2 text-sm font-bold text-brand-dark">{err}</p>}
    </Section>
  );
}

export function Categories({ categories }: { categories: Category[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [name, setName] = useState("");
  const [err, setErr] = useState("");
  return (
    <Section title="Categories">
      <div className="flex flex-wrap gap-2">
        {categories.map((c) => (
          <span key={c.id} className="group inline-flex items-center gap-1.5 rounded-full bg-shell py-1.5 pl-3.5 pr-1.5 text-sm font-bold">
            {c.name}
            <button
              onClick={() => confirm(`Delete “${c.name}”? Products in it become uncategorised.`) && start(async () => { await deleteCategory(c.id); router.refresh(); })}
              className="grid size-6 place-items-center rounded-full text-muted hover:bg-brand-soft hover:text-brand-dark"
              aria-label={`Delete ${c.name}`}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <form
        className="mt-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const r = await addCategory(name);
            if (r.error) return setErr(r.error);
            setErr("");
            setName("");
            router.refresh();
          });
        }}
      >
        <input className="input" placeholder="New category" value={name} onChange={(e) => setName(e.target.value)} />
        <button className="btn-dark" disabled={pending}>Add</button>
      </form>
      {err && <p className="mt-2 text-sm font-bold text-brand-dark">{err}</p>}
    </Section>
  );
}
