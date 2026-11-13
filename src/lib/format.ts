export const formatPKR = (n: number | null | undefined) =>
  "Rs " + Math.round(Number(n ?? 0)).toLocaleString("en-PK");

export function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "item";
}

/** Normalise a phone number to WhatsApp format: digits only, 92 country code. */
export function normalizePhone(raw: string) {
  let d = (raw || "").replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("0") && d.length === 11) d = "92" + d.slice(1);
  if (d.length === 10 && d.startsWith("3")) d = "92" + d;
  return d;
}

export const isValidPkMobile = (raw: string) => /^923\d{9}$/.test(normalizePhone(raw));

export function variantLabel(v: { size?: string | null; color?: string | null }) {
  return [v.size, v.color].filter(Boolean).join(" · ") || "One size";
}

export function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return d < 30 ? `${d}d ago` : new Date(iso).toLocaleDateString("en-PK", { day: "numeric", month: "short" });
}

/** Start of "today" in the store's timezone, as a UTC ISO string. */
export function startOfStoreDay(offsetMin = Number(process.env.STORE_TZ_OFFSET_MIN ?? 300)) {
  const now = new Date(Date.now() + offsetMin * 60_000);
  const startLocal = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return new Date(startLocal - offsetMin * 60_000).toISOString();
}

export const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  active: "Active",
  sold_out: "Sold out",
  hidden: "Hidden",
};

export const ORDER_STATUSES = ["pending", "confirmed", "shipped", "delivered", "cancelled"] as const;
