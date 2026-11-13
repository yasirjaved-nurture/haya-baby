"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { updateOrder } from "@/app/admin/actions";

const FLOW = [
  { key: "pending", label: "Pending", emoji: "⏳" },
  { key: "confirmed", label: "Confirmed", emoji: "✅" },
  { key: "shipped", label: "Shipped", emoji: "🚚" },
  { key: "delivered", label: "Delivered", emoji: "📬" },
];

export function OrderActions({ id, status, paymentStatus, phone, orderNumber, shopName }: { id: string; status: string; paymentStatus: string; phone: string; orderNumber: number; shopName: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const run = (patch: { status?: string; payment_status?: string }) =>
    start(async () => {
      setError("");
      const res = await updateOrder(id, patch);
      if (res?.error) setError(res.error);
      router.refresh();
    });

  const cancelled = status === "cancelled";
  const msg = encodeURIComponent(`Assalam o Alaikum! This is ${shopName} 🍼 about your order #${orderNumber}. `);

  return (
    <div className="space-y-5">
      <div>
        <div className="label">Order status</div>
        <div className="grid grid-cols-2 gap-2">
          {FLOW.map((s) => (
            <button
              key={s.key}
              disabled={pending || cancelled}
              onClick={() => run({ status: s.key })}
              className={`rounded-xl px-3 py-2.5 text-sm font-bold transition disabled:opacity-50 ${
                status === s.key ? "bg-ink text-white" : "bg-shell text-ink/80 hover:bg-blush/60"
              }`}
            >
              {s.emoji} {s.label}
            </button>
          ))}
        </div>
      </div>
      <div>
        <div className="label">Payment</div>
        <div className="grid grid-cols-2 gap-2">
          {["unpaid", "paid"].map((p) => (
            <button
              key={p}
              disabled={pending}
              onClick={() => run({ payment_status: p })}
              className={`rounded-xl px-3 py-2.5 text-sm font-bold capitalize transition ${
                paymentStatus === p ? "bg-ink text-white" : "bg-shell text-ink/80 hover:bg-sage"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>
      <a href={`https://wa.me/${phone}?text=${msg}`} target="_blank" className="btn w-full bg-[#25d366] text-white hover:bg-[#1ebe5b]">
        💬 Message customer on WhatsApp
      </a>
      {!cancelled && (
        <button
          disabled={pending}
          onClick={() => confirm("Cancel this order? Items go back into stock.") && run({ status: "cancelled" })}
          className="w-full text-sm font-bold text-muted hover:text-brand-dark"
        >
          Cancel order & restock
        </button>
      )}
      {pending && (
        <p className="flex items-center gap-2 text-sm text-muted">
          <Loader2 size={14} className="animate-spin" /> Updating…
        </p>
      )}
      {error && <p className="rounded-xl bg-brand-soft px-3 py-2 text-sm font-semibold text-brand-dark">{error}</p>}
    </div>
  );
}
