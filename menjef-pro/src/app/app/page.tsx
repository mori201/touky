import Link from "next/link";
import {
  AlertTriangle, Banknote, HandCoins, Package, PiggyBank, Receipt, ShoppingCart, TrendingUp, Truck, Wallet,
} from "lucide-react";
import { Alert, ButtonLink, Card, CardBody, CardHeader, EmptyState, PageHeader, StatCard } from "@/components/ui";
import { Donut, HorizontalBars, SalesTrendChart } from "@/components/charts";
import { PeriodFilter } from "@/components/period-filter";
import { getAppContext } from "@/lib/context";
import { getDashboard, getMemberNames } from "@/lib/queries";
import { resolvePeriod, toISODate } from "@/lib/period";
import { formatMoney, formatPercent, formatQty, variation } from "@/lib/format";
import { PAYMENT_METHODS, type PaymentMethod } from "@/lib/constants";

export default async function DashboardPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const ctx = await getAppContext();
  const range = resolvePeriod(sp.periode, sp.du, sp.au);
  const cashier = ctx.can("reports.view") ? sp.caissier : undefined;
  const [d, names] = await Promise.all([
    getDashboard(ctx, range.from, range.to, cashier),
    ctx.can("reports.view") ? getMemberNames(ctx) : Promise.resolve(new Map<string, string>()),
  ]);
  const toIncl = new Date(range.to.getTime() - 86_400_000);
  const locName = ctx.locationId ? ctx.locations.find((l) => l.id === ctx.locationId)?.name : "Tous les établissements";

  return (
    <>
      {!ctx.org.onboarding_completed && ctx.can("settings.manage") && (
        <Alert tone="primary" className="mb-5" title="Configuration à terminer">
          Ajoutez vos produits, vos moyens de paiement et votre équipe.{" "}
          <Link href="/onboarding" className="font-bold text-primary underline">Reprendre la configuration →</Link>
        </Alert>
      )}

      <PageHeader
        eyebrow="Centre de pilotage"
        title={<>Vue globale de <span className="text-primary">votre activité</span></>}
        description={`${ctx.org.name} · ${locName} · ${range.label}${!ctx.can("reports.view") ? " · vos ventes uniquement" : ""}`}
        actions={
          <>
            <PeriodFilter
              period={range.key}
              from={toISODate(range.from)}
              to={toISODate(toIncl)}
              cashiers={ctx.can("reports.view") ? [...names].map(([id, name]) => ({ id, name })) : undefined}
              cashier={cashier}
            />
            {ctx.can("sales.create") && <ButtonLink href="/app/caisse"><ShoppingCart size={16} /> Nouvelle vente</ButtonLink>}
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Chiffre d'affaires"
          value={formatMoney(d.sales.net_revenue)}
          icon={<TrendingUp size={18} />}
          trend={variation(d.sales.net_revenue, d.previous.revenue)}
          hint={`${d.sales.count} vente(s) · panier moyen ${formatMoney(d.sales.avg_basket)}`}
        />
        <StatCard
          label="Encaissements"
          value={formatMoney(d.cash_in ?? 0)}
          icon={<Banknote size={18} />}
          tone="success"
          trend={d.previous_cash_in != null ? variation(d.cash_in, d.previous_cash_in) : null}
          hint={d.scope.treasury ? "Argent réellement reçu" : "Payé à la caisse par vous"}
        />
        {d.expenses != null ? (
          <StatCard label="Dépenses" value={formatMoney(d.expenses)} icon={<Wallet size={18} />} tone="danger" trend={variation(d.expenses, d.previous_expenses)} hint="Charges d'exploitation" />
        ) : (
          <StatCard label="Ventes à crédit" value={formatMoney(d.sales.credit_sales)} icon={<HandCoins size={18} />} tone="warning" hint="Non encaissé à la vente" />
        )}
        {d.receivables != null ? (
          <StatCard
            label="Créances clients"
            value={formatMoney(d.receivables)}
            icon={<HandCoins size={18} />}
            tone="warning"
            hint={d.overdue_receivables ? <span className="font-semibold text-danger">dont {formatMoney(d.overdue_receivables)} en retard</span> : "Aucun retard"}
          />
        ) : (
          <StatCard label="Remises accordées" value={formatMoney(d.sales.discounts)} icon={<Receipt size={18} />} tone="neutral" />
        )}
      </div>

      {(d.gross_margin != null || d.payables != null) && (
        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {d.gross_margin != null && (
            <StatCard label="Marge brute estimée" value={formatMoney(d.gross_margin)} icon={<PiggyBank size={18} />} tone="success" hint={d.gross_margin_rate != null ? `Taux de marge ${formatPercent(d.gross_margin_rate)}` : "—"} />
          )}
          {d.net_result != null && (
            <StatCard label="Bénéfice net estimé" value={formatMoney(d.net_result)} icon={<TrendingUp size={18} />} tone={d.net_result >= 0 ? "primary" : "danger"} hint={<Link href="/app/finances" className="underline">Voir le détail du calcul</Link>} />
          )}
          {d.stock_value != null && (
            <StatCard label="Valeur du stock" value={formatMoney(d.stock_value)} icon={<Package size={18} />} tone="neutral" hint="Au coût moyen pondéré" />
          )}
          {d.payables != null && (
            <StatCard label="Dettes fournisseurs" value={formatMoney(d.payables)} icon={<Truck size={18} />} tone="danger" hint="Marchandises reçues non payées" />
          )}
        </div>
      )}

      {d.warnings.length > 0 && (
        <Alert tone="warning" className="mt-4" title="À savoir pour interpréter ces chiffres">
          <ul className="list-disc pl-5">{d.warnings.map((w) => <li key={w}>{w}</li>)}</ul>
        </Alert>
      )}

      <div className="mt-5 grid gap-5 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Évolution des ventes" description={`Ventes nettes ${d.expenses != null ? "et dépenses " : ""}par ${d.bucket === "day" ? "jour" : "mois"}`} />
          <CardBody>
            {d.sales.count === 0 && (d.expenses ?? 0) === 0 ? (
              <EmptyState icon={<TrendingUp />} title="Aucune vente sur la période" description="Les ventes validées à la caisse apparaîtront ici." />
            ) : (
              <SalesTrendChart data={d.series} bucket={d.bucket} />
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Actions requises" description="Ce qui mérite votre attention" />
          <CardBody className="space-y-3">
            {d.stock_alerts.length === 0 && !d.overdue_receivables ? (
              <p className="text-sm text-fg-muted">Rien à signaler. 👍</p>
            ) : null}
            {d.overdue_receivables ? (
              <Link href="/app/clients?filtre=retard" className="flex items-center gap-3 rounded-xl border border-danger/30 bg-danger/5 p-3 text-sm">
                <AlertTriangle size={18} className="text-danger" />
                <span><strong>{formatMoney(d.overdue_receivables)}</strong> de créances en retard</span>
              </Link>
            ) : null}
            {d.stock_alerts.slice(0, 6).map((a) => (
              <Link key={a.id} href={`/app/produits/${a.id}`} className="flex items-center justify-between gap-3 rounded-xl border border-border p-3 text-sm hover:bg-muted">
                <span className="truncate font-semibold">{a.name}</span>
                <span className={Number(a.quantity) <= 0 ? "font-bold text-danger" : "font-bold text-warning"}>
                  {Number(a.quantity) <= 0 ? "Rupture" : `${formatQty(a.quantity)} / min ${formatQty(a.min_stock)}`}
                </span>
              </Link>
            ))}
            {d.stock_alerts.length > 6 && (
              <Link href="/app/stock?filtre=alerte" className="block text-sm font-semibold text-primary">Voir les {d.stock_alerts.length} alertes →</Link>
            )}
          </CardBody>
        </Card>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
        <Card>
          <CardHeader title="Top produits" description="Par chiffre d'affaires" />
          <CardBody>
            {d.top_products.length ? <HorizontalBars data={d.top_products as never} /> : <p className="text-sm text-fg-muted">Aucune donnée.</p>}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Ventes par catégorie" />
          <CardBody>
            {d.by_category.length ? <Donut data={d.by_category.map((c) => ({ name: c.name, value: Number(c.revenue) }))} /> : <p className="text-sm text-fg-muted">Aucune donnée.</p>}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Modes de paiement" description="Encaissé lors des ventes" />
          <CardBody>
            {d.by_method.length ? (
              <Donut data={d.by_method.map((m) => ({ name: PAYMENT_METHODS[m.method as PaymentMethod] ?? m.method, value: Number(m.amount) }))} />
            ) : <p className="text-sm text-fg-muted">Aucun paiement.</p>}
          </CardBody>
        </Card>
        {d.by_location && d.by_location.length > 1 && (
          <Card>
            <CardHeader title="Performance par établissement" />
            <CardBody><HorizontalBars data={d.by_location as never} /></CardBody>
          </Card>
        )}
        {d.expense_by_category && d.expense_by_category.length > 0 && (
          <Card>
            <CardHeader title="Dépenses par catégorie" />
            <CardBody><HorizontalBars data={d.expense_by_category as never} valueKey="amount" /></CardBody>
          </Card>
        )}
        {d.accounts && (
          <Card>
            <CardHeader title="Trésorerie" description="Solde actuel par compte" actions={<Link href="/app/tresorerie" className="text-sm font-semibold text-primary">Détail →</Link>} />
            <CardBody className="space-y-2">
              {d.accounts.map((a) => (
                <div key={a.id} className="flex items-center justify-between rounded-lg bg-muted/60 px-3 py-2 text-sm">
                  <span className="font-semibold">{a.name}</span>
                  <span className={`num font-bold ${Number(a.balance) < 0 ? "text-danger" : ""}`}>{formatMoney(a.balance)}</span>
                </div>
              ))}
              <div className="flex items-center justify-between border-t border-border px-3 pt-2 text-sm font-bold">
                <span>Total</span>
                <span className="num">{formatMoney(d.accounts.reduce((s, a) => s + Number(a.balance), 0))}</span>
              </div>
            </CardBody>
          </Card>
        )}
      </div>
    </>
  );
}
