import type { Metadata } from "next";
import Link from "next/link";
import { Card, EmptyState, PageHeader, Select, Table, TD, TH } from "@/components/ui";
import { PeriodFilter } from "@/components/period-filter";
import { getAppContext } from "@/lib/context";
import { getMemberNames } from "@/lib/queries";
import { resolvePeriod, toISODate } from "@/lib/period";
import { formatDate, formatQty } from "@/lib/format";
import { STOCK_MOVEMENT_TYPES } from "@/lib/constants";
import { StockTabs } from "../tabs";

export const metadata: Metadata = { title: "Mouvements de stock" };

export default async function MovementsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const ctx = await getAppContext();
  const range = resolvePeriod(sp.periode ?? "7d", sp.du, sp.au);
  let q = ctx.supabase
    .from("stock_movements")
    .select("id, type, quantity, balance_after, reason, reference_type, reference_id, location_id, created_by, created_at, product:products(id, name, unit)")
    .eq("organization_id", ctx.org.id)
    .gte("created_at", range.from.toISOString())
    .lt("created_at", range.to.toISOString())
    .order("id", { ascending: false })
    .limit(300);
  if (ctx.locationId) q = q.eq("location_id", ctx.locationId);
  if (sp.type && sp.type in STOCK_MOVEMENT_TYPES) q = q.eq("type", sp.type);
  const [{ data: rows }, names] = await Promise.all([q, getMemberNames(ctx)]);
  const locName = new Map(ctx.locations.map((l) => [l.id, l.name]));

  return (
    <>
      <PageHeader title="Stock" description="Journal immuable : chaque entrée et sortie avec son auteur et son motif." actions={<PeriodFilter period={range.key} from={toISODate(range.from)} to={toISODate(new Date(range.to.getTime() - 86_400_000))} />} />
      <StockTabs active="/app/stock/mouvements" />
      <form className="mb-4 flex gap-2">
        {sp.periode && <input type="hidden" name="periode" value={sp.periode} />}
        <Select name="type" defaultValue={sp.type ?? ""} className="w-60" aria-label="Type">
          <option value="">Tous les types</option>
          {Object.entries(STOCK_MOVEMENT_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </Select>
        <button className="rounded-lg bg-muted px-4 text-sm font-semibold">Filtrer</button>
      </form>
      <Card>
        {!rows?.length ? (
          <EmptyState title="Aucun mouvement sur la période" />
        ) : (
          <Table>
            <thead><tr><TH>Date</TH><TH>Produit</TH><TH>Type</TH>{ctx.locations.length > 1 && <TH>Établissement</TH>}<TH className="text-right">Quantité</TH><TH className="text-right">Stock après</TH><TH>Motif</TH><TH>Par</TH></tr></thead>
            <tbody>
              {rows.map((m) => {
                const p = m.product as unknown as { id: string; name: string; unit: string } | null;
                return (
                  <tr key={m.id}>
                    <TD className="whitespace-nowrap text-fg-muted">{formatDate(m.created_at, true)}</TD>
                    <TD>{p ? <Link href={`/app/produits/${p.id}`} className="font-semibold hover:text-primary">{p.name}</Link> : "—"}</TD>
                    <TD>{STOCK_MOVEMENT_TYPES[m.type as keyof typeof STOCK_MOVEMENT_TYPES]}</TD>
                    {ctx.locations.length > 1 && <TD className="text-fg-muted">{locName.get(m.location_id) ?? "—"}</TD>}
                    <TD className={`num text-right font-bold ${Number(m.quantity) < 0 ? "text-danger" : "text-success"}`}>{Number(m.quantity) > 0 ? "+" : ""}{formatQty(m.quantity)}</TD>
                    <TD className="num text-right">{formatQty(m.balance_after)}</TD>
                    <TD className="text-fg-muted">{m.reference_type === "sale" && m.reference_id ? <Link className="text-primary" href={`/app/ventes/${m.reference_id}`}>{m.reason}</Link> : m.reason ?? "—"}</TD>
                    <TD className="text-fg-muted">{names.get(m.created_by ?? "") ?? "—"}</TD>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
