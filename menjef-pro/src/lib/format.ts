// Formats français et franc CFA (XOF, sans décimales en usage courant)
const numberFmt = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });
const qtyFmt = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 3 });
const pctFmt = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });

export const TIMEZONE = "Africa/Dakar";

function toNumber(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

/** 12500 → « 12 500 F CFA » (espaces insécables normalisés) */
export function formatMoney(v: unknown, withUnit = true): string {
  const s = numberFmt.format(Math.round(toNumber(v))).replace(/ | /g, " ");
  return withUnit ? `${s} F CFA` : s;
}

export function formatQty(v: unknown): string {
  return qtyFmt.format(toNumber(v)).replace(/ | /g, " ");
}

export function formatPercent(v: unknown): string {
  return `${pctFmt.format(toNumber(v))} %`;
}

export function formatDate(v: string | Date | null | undefined, withTime = false): string {
  if (!v) return "—";
  const d = typeof v === "string" ? new Date(v) : v;
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: TIMEZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  }).format(d);
}

/** Variation en % entre deux périodes ; null si la base est nulle */
export function variation(current: unknown, previous: unknown): number | null {
  const c = toNumber(current);
  const p = toNumber(previous);
  if (p === 0) return null;
  return ((c - p) / Math.abs(p)) * 100;
}

/** Date du jour (AAAA-MM-JJ) dans le fuseau de l'entreprise */
export function todayISO(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIMEZONE }).format(new Date());
}
