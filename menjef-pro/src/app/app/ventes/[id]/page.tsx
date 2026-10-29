import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Alert, Badge, ButtonLink, Card, CardBody, CardHeader, Field, Input, Select, Table, TD, TH, Textarea } from "@/components/ui";
import { ActionForm, Modal, SubmitButton } from "@/components/ui/client";
import { requirePermission } from "@/lib/context";
import { getMemberNames } from "@/lib/queries";
import { formatDate, formatMoney, formatQty } from "@/lib/format";
import { PAYMENT_METHODS, type PaymentMethod } from "@/lib/constants";
import { isUuid } from "@/lib/utils";
import { cancelSaleAction, returnItemsAction } from "../actions";

export const metadata: Metadata = { title: "Détail de la vente" };

export default async function SaleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const ctx = await requirePermission("sales.view");
  const { data: sale } = await ctx.supabase
    .from("sales")
    .select("*, customer:customers(id, name, phone), location:locations(name)")
    .eq("id", id)
    .eq("organization_id", ctx.org.id)
    .maybeSingle();
  if (!sale) notFound();

  const [{ data: items }, { data: payments }, { data: returns }, { data: allocations }, { data: accounts }, names] = await Promise.all([
    ctx.supabase.from("sale_items").select("id, product_id, product_name, quantity, unit_price, discount, line_total, returned_qty").eq("sale_id", id),
    ctx.supabase.from("sale_payments").select("id, method, amount, reference, verified, account:treasury_accounts(name)").eq("sale_id", id),
    ctx.supabase.from("sale_returns").select("id, amount, refunded_amount, credit_reduction, reason, created_at").eq("sale_id", id).order("created_at"),
    ctx.can("credits.view")
      ? ctx.supabase.from("customer_payment_allocations").select("amount, payment:customer_payments(number, created_at, method)").eq("sale_id", id)
      : Promise.resolve({ data: [] as never[] }),
    ctx.supabase.from("treasury_accounts").select("id, name").eq("organization_id", ctx.org.id).is("archived_at", null).order("name"),
    getMemberNames(ctx),
  ]);

  const customer = sale.customer as { id: string; name: string; phone: string | null } | null;
  const cancelled = sale.status === "cancelled";
  const canReturn = ctx.can("sales.cancel") && !cancelled && (items ?? []).some((i) => Number(i.quantity) > Number(i.returned_qty));
  const canCancel = ctx.can("sales.cancel") && !cancelled && !(returns ?? []).length && !(allocations ?? []).length;

  return (
    <>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/app/ventes" className="text-sm font-semibold text-fg-muted hover:text-fg">← Ventes</Link>
          <h1 className="mt-1 flex flex-wrap items-center gap-3 font-display text-3xl font-extrabold">
            Vente {sale.number}
            {cancelled ? <Badge tone="danger">Annulée</Badge> : Number(sale.returned_total) > 0 ? <Badge tone="warning">Retour partiel</Badge> : <Badge tone="success">Validée</Badge>}
          </h1>
          <p className="mt-1 text-sm text-fg-muted">
            {formatDate(sale.created_at, true)} · {(sale.location as { name: string } | null)?.name} · Vendeur : {names.get(sale.cashier_id) ?? "—"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ButtonLink href={`/app/ventes/${id}/recu`} variant="outline" target="_blank">Reçu</ButtonLink>
          {canReturn && (
            <Modal trigger="Retour client" title="Enregistrer un retour" triggerVariant="outline" wide>
              <ActionForm action={returnItemsAction} className="space-y-4">
                <input type="hidden" name="sale_id" value={id} />
                <Table>
                  <thead><tr><TH>Produit</TH><TH className="text-right">Vendu</TH><TH className="text-right">Déjà retourné</TH><TH>Quantité retournée</TH></tr></thead>
                  <tbody>
                    {(items ?? []).map((i) => {
                      const max = Number(i.quantity) - Number(i.returned_qty);
                      return (
                        <tr key={i.id}>
                          <TD>{i.product_name}</TD>
                          <TD className="num text-right">{formatQty(i.quantity)}</TD>
                          <TD className="num text-right">{formatQty(i.returned_qty)}</TD>
                          <TD><Input name={`qty_${i.id}`} type="number" min={0} max={max} step="any" disabled={max <= 0} className="w-28" aria-label={`Quantité retournée pour ${i.product_name}`} /></TD>
                        </tr>
                      );
                    })}
                  </tbody>
                </Table>
                <Field label="Compte de remboursement" htmlFor="account_id" hint="Utilisé si le client a déjà payé. Une créance en cours est d'abord réduite.">
                  <Select id="account_id" name="account_id">
                    {(accounts ?? []).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </Select>
                </Field>
                <Field label="Motif" htmlFor="reason" required><Textarea id="reason" name="reason" required /></Field>
                <SubmitButton>Valider le retour</SubmitButton>
              </ActionForm>
            </Modal>
          )}
          {canCancel && (
            <Modal trigger="Annuler la vente" title={`Annuler la vente ${sale.number}`} triggerVariant="danger">
              <ActionForm action={cancelSaleAction} className="space-y-4">
                <input type="hidden" name="sale_id" value={id} />
                <Alert tone="warning">
                  L&apos;annulation remet les articles en stock et enregistre un remboursement de {formatMoney(sale.paid_at_checkout)} sur les comptes encaissés.
                  La vente reste visible dans l&apos;historique.
                </Alert>
                <Field label="Motif d'annulation" htmlFor="reason" required><Textarea id="reason" name="reason" required minLength={3} /></Field>
                <SubmitButton variant="danger" pendingText="Annulation…">Confirmer l&apos;annulation</SubmitButton>
              </ActionForm>
            </Modal>
          )}
        </div>
      </div>

      {cancelled && (
        <Alert tone="danger" className="mb-5" title={`Annulée le ${formatDate(sale.cancelled_at, true)}`}>
          Motif : {sale.cancel_reason} · par {names.get(sale.cancelled_by) ?? "—"}
        </Alert>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Articles" />
          <Table>
            <thead><tr><TH>Produit</TH><TH className="text-right">Qté</TH><TH className="text-right">Prix unitaire</TH><TH className="text-right">Remise</TH><TH className="text-right">Total</TH></tr></thead>
            <tbody>
              {(items ?? []).map((i) => (
                <tr key={i.id}>
                  <TD>
                    <Link href={`/app/produits/${i.product_id}`} className="font-semibold hover:text-primary">{i.product_name}</Link>
                    {Number(i.returned_qty) > 0 && <span className="ml-2 text-xs text-warning">{formatQty(i.returned_qty)} retourné(s)</span>}
                  </TD>
                  <TD className="num text-right">{formatQty(i.quantity)}</TD>
                  <TD className="num text-right">{formatMoney(i.unit_price)}</TD>
                  <TD className="num text-right">{Number(i.discount) ? formatMoney(i.discount) : "—"}</TD>
                  <TD className="num text-right font-semibold">{formatMoney(i.line_total)}</TD>
                </tr>
              ))}
            </tbody>
          </Table>
          <CardBody className="ml-auto max-w-xs space-y-1.5 text-sm">
            <div className="flex justify-between"><span className="text-fg-muted">Sous-total</span><span className="num">{formatMoney(sale.subtotal)}</span></div>
            <div className="flex justify-between"><span className="text-fg-muted">Remises</span><span className="num">− {formatMoney(sale.discount_total)}</span></div>
            {Number(sale.tax_total) > 0 && <div className="flex justify-between"><span className="text-fg-muted">Taxes</span><span className="num">{formatMoney(sale.tax_total)}</span></div>}
            <div className="flex justify-between border-t border-border pt-1.5 font-bold"><span>Total</span><span className="num">{formatMoney(sale.total)}</span></div>
            {Number(sale.returned_total) > 0 && <div className="flex justify-between text-warning"><span>Retours</span><span className="num">− {formatMoney(sale.returned_total)}</span></div>}
            <div className="flex justify-between"><span className="text-fg-muted">Payé à la caisse</span><span className="num">{formatMoney(sale.paid_at_checkout)}</span></div>
            {sale.change_given != null && Number(sale.change_given) > 0 && <div className="flex justify-between"><span className="text-fg-muted">Monnaie rendue</span><span className="num">{formatMoney(sale.change_given)}</span></div>}
            <div className="flex justify-between font-bold"><span>Solde dû</span><span className={`num ${Number(sale.balance_due) > 0 ? "text-warning" : ""}`}>{formatMoney(sale.balance_due)}</span></div>
          </CardBody>
        </Card>

        <div className="space-y-5">
          <Card>
            <CardHeader title="Client" />
            <CardBody className="text-sm">
              {customer ? (
                <>
                  <Link href={`/app/clients/${customer.id}`} className="font-bold text-primary">{customer.name}</Link>
                  {customer.phone && <p className="text-fg-muted">{customer.phone}</p>}
                  {sale.due_date && <p className="mt-2">Échéance : <strong>{formatDate(sale.due_date)}</strong></p>}
                </>
              ) : <p className="text-fg-muted">Client anonyme</p>}
              {sale.note && <p className="mt-3 rounded-lg bg-muted p-2 text-fg-muted">{sale.note}</p>}
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Paiements" />
            <CardBody className="space-y-2 text-sm">
              {(payments ?? []).length === 0 && <p className="text-fg-muted">Aucun paiement à la caisse.</p>}
              {(payments ?? []).map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-2">
                  <span>
                    {PAYMENT_METHODS[p.method as PaymentMethod]} <span className="text-fg-muted">· {(p.account as unknown as { name: string } | null)?.name}</span>
                    {p.reference && <span className="block text-xs text-fg-muted">Réf. {p.reference}</span>}
                    {!p.verified && <span className="block text-xs text-warning">Déclaré, non vérifié automatiquement</span>}
                  </span>
                  <span className="num font-semibold">{formatMoney(p.amount)}</span>
                </div>
              ))}
              {(allocations ?? []).map((a, i) => {
                const pay = a.payment as unknown as { number: string; created_at: string } | null;
                return (
                  <div key={i} className="flex justify-between border-t border-border pt-2 text-success">
                    <span>Remboursement {pay?.number} · {formatDate(pay?.created_at)}</span>
                    <span className="num font-semibold">{formatMoney(a.amount)}</span>
                  </div>
                );
              })}
            </CardBody>
          </Card>
          {(returns ?? []).length > 0 && (
            <Card>
              <CardHeader title="Retours" />
              <CardBody className="space-y-2 text-sm">
                {(returns ?? []).map((r) => (
                  <div key={r.id}>
                    <div className="flex justify-between"><span>{formatDate(r.created_at, true)}</span><span className="num font-semibold">{formatMoney(r.amount)}</span></div>
                    <p className="text-xs text-fg-muted">
                      {r.reason} · remboursé {formatMoney(r.refunded_amount)} · créance réduite {formatMoney(r.credit_reduction)}
                    </p>
                  </div>
                ))}
              </CardBody>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
