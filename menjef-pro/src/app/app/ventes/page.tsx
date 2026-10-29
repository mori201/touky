import type { Metadata } from "next";
import Link from "next/link";
import { ReceiptText } from "lucide-react";
import { Badge, ButtonLink, Card, EmptyState, Input, PageHeader, Select, Table, TD, TH } from "@/components/ui";
import { PeriodFilter } from "@/components/period-filter";
import { requirePermission } from "@/lib/context";
import { getMemberNames } from "@/lib/queries";
import { resolvePeriod, toISODate } from "@/lib/period";
import { formatDate, formatMoney } from "@/lib/format";

export const metadata: Metadata = { title: "Historique des ventes" };
const PAGE = 50;

export default async function SalesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const ctx = await requirePermission("sales.view");
  const range = resolvePeriod(sp.periode ?? "7d", sp.du, sp.au);
  const page = Math.max(1, Number(sp.page) || 1);

  let q = ctx.supabase
    .from("sales")
    .select("id, number, created_at, total, paid_at_checkout, balance_due, returned_total, status, cashier_id, location_id, customer:customers(name)", { count: "exact" })
    .eq("organization_id", ctx.org.id)
    .gte("created_at", range.from.toISOString())
    .lt("created_at", range.to.toISOString())
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE, page * PAGE - 1);
  if (ctx.locationId) q = q.eq("location_id", ctx.locationId);
  if (sp.statut === "completed" || sp.statut === "cancelled") q = q.eq("status", sp.statut);
  if (sp.statut === "credit") q = q.gt("balance_due", 0).eq("status", "completed");
  if (sp.q) q = q.ilike("number", `%${sp.q.replace(/[%_]/g, "")}%`);
  if (sp.caissier) q = q.eq("cashier_id", sp.caissier);

  const [{ data: sales, count }, names] = await Promise.all([q, getMemberNames(ctx)]);
  const locName = new Map(ctx.locations.map((l) => [l.id, l.name]));
  const pages = Math.ceil((count ?? 0) / PAGE);
  const qs = (p: number) => {
    const params = new URLSearchParams(Object.entries(sp).filter(([, v]) => v) as [string, string][]);
    params.set("page", String(p));
    return `?${params}`;
  };

  return (
    <>
      <PageHeader
        title="Historique des ventes"
        description={`${count ?? 0} vente(s) · ${range.label}`}
        actions={
          <>
            <PeriodFilter period={range.key} from={toISODate(range.from)} to={toISODate(new Date(range.to.getTime() - 86_400_000))} cashiers={[...names].map(([id, name]) => ({ id, name }))} cashier={sp.caissier} />
            {ctx.can("reports.export") && (
              <ButtonLink href={`/api/export/ventes?du=${toISODate(range.from)}&au=${toISODate(range.to)}`} variant="outline" prefetch={false}>Exporter CSV</ButtonLink>
            )}
          </>
        }
      />
      <form className="mb-4 flex flex-wrap gap-2">
        {Object.entries(sp).filter(([k, v]) => v && !["q", "statut", "page"].includes(k)).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
        <Input name="q" defaultValue={sp.q} placeholder="N° de vente (ex. V-000123)" className="w-56" aria-label="Numéro de vente" />
        <Select name="statut" defaultValue={sp.statut ?? ""} className="w-48" aria-label="Statut">
          <option value="">Tous les statuts</option>
          <option value="completed">Validées</option>
          <option value="credit">Avec solde dû</option>
          <option value="cancelled">Annulées</option>
        </Select>
        <button className="rounded-lg bg-muted px-4 text-sm font-semibold">Filtrer</button>
      </form>
      <Card>
        {!sales?.length ? (
          <EmptyState icon={<ReceiptText />} title="Aucune vente" description="Aucune vente ne correspond à ces filtres." action={ctx.can("sales.create") ? <ButtonLink href="/app/caisse">Ouvrir la caisse</ButtonLink> : undefined} />
        ) : (
          <Table>
            <thead>
              <tr><TH>N°</TH><TH>Date</TH><TH>Client</TH><TH>Vendeur</TH>{!ctx.locationId && ctx.locations.length > 1 && <TH>Établissement</TH>}<TH className="text-right">Total</TH><TH className="text-right">Solde dû</TH><TH>Statut</TH></tr>
            </thead>
            <tbody>
              {sales.map((s) => (
                <tr key={s.id} className="hover:bg-muted/40">
                  <TD><Link href={`/app/ventes/${s.id}`} className="font-bold text-primary">{s.number}</Link></TD>
                  <TD className="whitespace-nowrap text-fg-muted">{formatDate(s.created_at, true)}</TD>
                  <TD>{(s.customer as unknown as { name: string } | null)?.name ?? <span className="text-fg-muted">Anonyme</span>}</TD>
                  <TD className="text-fg-muted">{names.get(s.cashier_id as string) ?? "—"}</TD>
                  {!ctx.locationId && ctx.locations.length > 1 && <TD className="text-fg-muted">{locName.get(s.location_id) ?? "—"}</TD>}
                  <TD className="num text-right font-semibold">{formatMoney(Number(s.total) - Number(s.returned_total))}</TD>
                  <TD className="num text-right">{Number(s.balance_due) > 0 ? <span className="font-bold text-warning">{formatMoney(s.balance_due)}</span> : "—"}</TD>
                  <TD>{s.status === "cancelled" ? <Badge tone="danger">Annulée</Badge> : Number(s.returned_total) > 0 ? <Badge tone="warning">Retour partiel</Badge> : <Badge tone="success">Validée</Badge>}</TD>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
      {pages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2 text-sm">
          {page > 1 && <Link href={qs(page - 1)} className="rounded-lg border border-border px-3 py-1.5">← Précédent</Link>}
          <span className="text-fg-muted">Page {page} / {pages}</span>
          {page < pages && <Link href={qs(page + 1)} className="rounded-lg border border-border px-3 py-1.5">Suivant →</Link>}
        </div>
      )}
    </>
  );
}
