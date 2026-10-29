// Calcul des périodes de filtrage. Africa/Dakar est en UTC+0 toute l'année
// (pas d'heure d'été) : les bornes de jour en UTC correspondent à Dakar.
export const PERIODS = {
  today: "Aujourd'hui",
  yesterday: "Hier",
  "7d": "7 derniers jours",
  month: "Mois en cours",
  last_month: "Mois précédent",
  year: "Année en cours",
  custom: "Période personnalisée",
} as const;
export type PeriodKey = keyof typeof PERIODS;

export interface Range {
  from: Date;
  to: Date; // exclusif
  key: PeriodKey;
  label: string;
}

function startOfDay(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}
function addDays(d: Date, n: number) {
  return new Date(d.getTime() + n * 86_400_000);
}
function parseISODate(s: string | undefined): Date | null {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function resolvePeriod(key: string | undefined, fromStr?: string, toStr?: string, now = new Date()): Range {
  const today = startOfDay(now);
  const k = (key && key in PERIODS ? key : "month") as PeriodKey;
  switch (k) {
    case "today":
      return { key: k, label: PERIODS[k], from: today, to: addDays(today, 1) };
    case "yesterday":
      return { key: k, label: PERIODS[k], from: addDays(today, -1), to: today };
    case "7d":
      return { key: k, label: PERIODS[k], from: addDays(today, -6), to: addDays(today, 1) };
    case "last_month": {
      const from = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1));
      const to = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
      return { key: k, label: PERIODS[k], from, to };
    }
    case "year": {
      const from = new Date(Date.UTC(today.getUTCFullYear(), 0, 1));
      return { key: k, label: PERIODS[k], from, to: addDays(today, 1) };
    }
    case "custom": {
      const from = parseISODate(fromStr);
      const toIncl = parseISODate(toStr);
      if (from && toIncl && toIncl >= from && toIncl.getTime() - from.getTime() <= 1095 * 86_400_000) {
        return { key: k, label: PERIODS[k], from, to: addDays(toIncl, 1) };
      }
      break;
    }
  }
  const from = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  return { key: "month", label: PERIODS.month, from, to: addDays(today, 1) };
}

export function toISODate(d: Date) {
  return d.toISOString().slice(0, 10);
}
