"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { PERIODS } from "@/lib/period";

export function PeriodFilter({
  period,
  from,
  to,
  cashiers,
  cashier,
}: {
  period: string;
  from: string;
  to: string;
  cashiers?: { id: string; name: string }[];
  cashier?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  function update(next: Record<string, string>) {
    const params = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(next)) {
      if (v) params.set(k, v);
      else params.delete(k);
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="sr-only" htmlFor="periode">Période</label>
      <select id="periode" value={period} onChange={(e) => update({ periode: e.target.value })} className="input h-9 w-auto py-1.5 text-sm font-semibold">
        {Object.entries(PERIODS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
      </select>
      {period === "custom" && (
        <form
          className="flex items-center gap-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            update({ periode: "custom", du: String(f.get("du")), au: String(f.get("au")) });
          }}
        >
          <input type="date" name="du" defaultValue={from} className="input h-9 w-auto py-1 text-sm" aria-label="Du" required />
          <span className="text-fg-muted">→</span>
          <input type="date" name="au" defaultValue={to} className="input h-9 w-auto py-1 text-sm" aria-label="Au" required />
          <button className="h-9 rounded-lg bg-primary px-3 text-sm font-bold text-primary-fg">OK</button>
        </form>
      )}
      {cashiers && cashiers.length > 1 && (
        <>
          <label className="sr-only" htmlFor="caissier">Caissier</label>
          <select id="caissier" value={cashier ?? ""} onChange={(e) => update({ caissier: e.target.value })} className="input h-9 w-auto py-1.5 text-sm">
            <option value="">Tous les vendeurs</option>
            {cashiers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </>
      )}
    </div>
  );
}
