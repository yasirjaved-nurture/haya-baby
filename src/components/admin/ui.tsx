import Link from "next/link";
import { STATUS_LABEL } from "@/lib/format";

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

const productTone: Record<string, string> = {
  active: "bg-sage text-sage-deep",
  sold_out: "bg-brand-soft text-brand-dark",
  hidden: "bg-ink/5 text-muted",
  draft: "bg-butter text-amber-800",
};
export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${productTone[status] ?? "bg-ink/5"}`}>
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

const orderTone: Record<string, string> = {
  pending: "bg-butter text-amber-800",
  confirmed: "bg-sky text-sky-800",
  shipped: "bg-lilac text-violet-800",
  delivered: "bg-sage text-sage-deep",
  cancelled: "bg-ink/5 text-muted line-through",
  unpaid: "bg-ink/5 text-muted",
  paid: "bg-sage text-sage-deep",
  refunded: "bg-brand-soft text-brand-dark",
};
export function OrderBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold capitalize ${orderTone[status] ?? "bg-ink/5"}`}>
      {status}
    </span>
  );
}

export function StatCard({ label, value, hint, tone = "bg-white", href }: { label: string; value: string | number; hint?: string; tone?: string; href?: string }) {
  const body = (
    <div className={`rounded-2xl border border-line p-5 transition ${tone} ${href ? "hover:-translate-y-0.5 hover:shadow-md" : ""}`}>
      <div className="text-xs font-bold uppercase tracking-wide text-muted">{label}</div>
      <div className="mt-2 font-heading text-3xl font-semibold">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted">{hint}</div>}
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

export function Empty({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="card flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
      <div className="text-4xl">🧸</div>
      <div className="font-heading text-lg font-semibold">{title}</div>
      {children && <div className="max-w-sm text-sm text-muted">{children}</div>}
    </div>
  );
}

export function SourceBadge({ source }: { source: string }) {
  const map: Record<string, string> = {
    whatsapp: "bg-[#dcf8c6] text-[#1f6b3a]",
    dashboard: "bg-sky text-sky-800",
    order: "bg-lilac text-violet-800",
    system: "bg-ink/5 text-muted",
  };
  const label: Record<string, string> = { whatsapp: "WhatsApp", dashboard: "Dashboard", order: "Order", system: "System" };
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${map[source] ?? ""}`}>{label[source] ?? source}</span>;
}
