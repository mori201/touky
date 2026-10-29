import type { Metadata } from "next";
import { Alert, Card, CardBody, CardHeader, PageHeader, StatCard } from "@/components/ui";
import { PeriodFilter } from "@/components/period-filter";
import { requirePermission } from "@/lib/context";
import { getDashboard } from "@/lib/queries";
import { resolvePeriod, toISODate } from "@/lib/period";
import { formatMoney, formatPercent } from "@/lib/format";

export const metadata: Metadata = { title: "Finances et rentabilité" };

function Row({ label, value, strong, minus, hint }: { label: string; value: number | null | undefined; strong?: boolean; minus?: boolean; hint?: string }) {
  return (
    <div className={`flex items-start justify-between gap-4 py-2 ${strong ? "border-t border-border font-bold" : ""}`}>
      <div>
        <p className={strong ? "" : "text-fg/85"}>{minus ? "− " : ""}{label}</p>
        {hint && <p className="text-xs font-normal text-fg-muted">{hint}</p>}
      </div>
      <p className="num whitespace-nowrap">{value == null ? "—" : formatMoney(value)}</p>
    </div>
  );
}

export default async function FinancesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const ctx = await requirePermission("reports.view");
  const range = resolvePeriod(sp.periode, sp.du, sp.au);
  const d = await getDashboard(ctx, range.from, range.to);
  const s = d.sales;
  const hasCosts = d.gross_margin != null;

  return (
    <>
      <PageHeader
        eyebrow="Rentabilité"
        title="Finances et rentabilité"
        description={`${range.label} · ${ctx.locationId ? ctx.locations.find((l) => l.id === ctx.locationId)?.name : "tous les établissements"}`}
        actions={<PeriodFilter period={range.key} from={toISODate(range.from)} to={toISODate(new Date(range.to.getTime() - 86_400_000))} />}
      />
      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Chiffre d'affaires net" value={formatMoney(s.net_revenue)} tone="primary" />
        <StatCard label="Encaissements" value={formatMoney(d.cash_in ?? 0)} tone="success" />
        {hasCosts && <StatCard label="Marge brute" value={formatMoney(d.gross_margin)} tone="success" hint={d.gross_margin_rate != null ? formatPercent(d.gross_margin_rate) : undefined} />}
        {d.net_result != null && <StatCard label="Bénéfice net estimé" value={formatMoney(d.net_result)} tone={d.net_result >= 0 ? "primary" : "danger"} />}
      </div>
      {d.warnings.length > 0 && (
        <Alert tone="warning" className="mb-5" title="Fiabilité des chiffres">
          <ul className="list-disc pl-5">{d.warnings.map((w) => <li key={w}>{w}</li>)}</ul>
        </Alert>
      )}
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="Compte de résultat estimé" description="Logique de gestion, ne remplace pas une comptabilité certifiée." />
          <CardBody className="text-sm">
            <Row label="Ventes validées (TTC)" value={s.revenue} hint={`${s.count} vente(s), remises déjà déduites (${formatMoney(s.discounts)})`} />
            <Row label="Retours clients" value={s.returns} minus />
            <Row label="Chiffre d'affaires net" value={s.net_revenue} strong />
            {s.tax > 0 && <Row label="Taxes collectées" value={s.tax} minus />}
            {hasCosts ? (
              <>
                <Row label="Chiffre d'affaires hors taxes" value={d.net_revenue_ht} strong />
                <Row label="Coût d'achat des marchandises vendues" value={d.cogs} minus hint="Quantités vendues × coût moyen pondéré au moment de la vente" />
                <Row label="Marge brute" value={d.gross_margin} strong />
                <Row label="Dépenses d'exploitation" value={d.expenses} minus hint="Loyer, salaires, transport…" />
                <Row label="Recettes diverses" value={d.other_income} hint="Hors ventes de marchandises" />
                <Row label="Bénéfice net estimé" value={d.net_result} strong />
              </>
            ) : (
              <Alert tone="neutral" className="mt-3">La marge et le bénéfice nécessitent la permission de consulter les coûts d&apos;achat.</Alert>
            )}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Flux de trésorerie" description="Argent réellement entré et sorti des comptes." />
          <CardBody className="text-sm">
            <Row label="Encaissements" value={d.cash_in} hint="Paiements de ventes, remboursements clients, recettes diverses" />
            <Row label="Décaissements" value={d.cash_out} minus hint="Dépenses, paiements fournisseurs, remboursements de ventes" />
            <Row label="Variation de trésorerie" value={(d.cash_in ?? 0) - (d.cash_out ?? 0)} strong />
            <div className="mt-4 space-y-1 rounded-xl bg-muted/60 p-3">
              <Row label="Ventes à crédit de la période (non encaissées)" value={s.credit_sales} />
              <Row label="Créances clients totales" value={d.receivables} />
              <Row label="Dettes fournisseurs totales" value={d.payables} />
              <Row label="Achats de marchandises reçus" value={d.purchases_received} hint="Entrent en stock ; deviennent un coût lorsqu'ils sont vendus" />
            </div>
          </CardBody>
        </Card>
      </div>
      <Card className="mt-5">
        <CardHeader title="Comprendre les indicateurs" />
        <CardBody className="grid gap-4 text-sm sm:grid-cols-2">
          {[
            ["Chiffre d'affaires", "Total des ventes validées, y compris celles payées à crédit, retours déduits. Ce n'est pas de l'argent encaissé."],
            ["Encaissements", "Argent réellement reçu sur vos comptes. Les transferts internes, soldes initiaux et écarts de caisse sont exclus."],
            ["Marge brute", "Chiffre d'affaires hors taxes moins le coût d'achat des articles vendus. Les achats non vendus restent en stock."],
            ["Bénéfice net estimé", "Marge brute − dépenses + recettes diverses. Fiable uniquement si toutes les charges sont saisies."],
            ["Trésorerie", "Solde actuel de vos caisses, comptes bancaires et Mobile Money."],
            ["Transferts internes", "Déplacer de l'argent entre deux comptes ne change ni le résultat ni la trésorerie totale."],
          ].map(([t, x]) => (
            <div key={t}><p className="font-bold">{t}</p><p className="mt-0.5 text-fg-muted">{x}</p></div>
          ))}
        </CardBody>
      </Card>
    </>
  );
}
