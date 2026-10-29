import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, Card, CardBody, CardHeader, Field, Input, Select, Table, TD, TH } from "@/components/ui";
import { ActionForm, ConfirmSubmit, Modal, SubmitButton } from "@/components/ui/client";
import { getAppContext } from "@/lib/context";
import { formatDate, formatMoney, formatQty } from "@/lib/format";
import { PAYMENT_METHODS, PURCHASE_STATUS, type PaymentMethod } from "@/lib/constants";
import { isUuid } from "@/lib/utils";
import { paySupplier, receivePurchase, returnToSupplier, setPurchaseStatus } from "../actions";

export const metadata: Metadata = { title: "Bon de commande" };

export default async function PurchaseOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const ctx = await getAppContext();
  const { data: po } = await ctx.supabase.from("purchase_orders").select("*, supplier:suppliers(id, name), location:locations(name)").eq("id", id).eq("organization_id", ctx.org.id).maybeSingle();
  if (!po) notFound();
  const [{ data: items }, { data: receptions }, { data: returns }, { data: payments }, { data: accounts }] = await Promise.all([
    ctx.supabase.from("purchase_order_items").select("id, product_id, quantity_ordered, quantity_received, quantity_returned, unit_cost, product:products(name, unit)").eq("purchase_order_id", id),
    ctx.supabase.from("purchase_receptions").select("id, total, note, received_at").eq("purchase_order_id", id).order("received_at"),
    ctx.supabase.from("supplier_returns").select("id, quantity, amount, reason, created_at, item:purchase_order_items(product:products(name))").eq("purchase_order_id", id).order("created_at"),
    ctx.supabase.from("supplier_payments").select("id, amount, method, reference, created_at").eq("purchase_order_id", id).order("created_at"),
    ctx.supabase.from("account_balances").select("account_id, name, balance").eq("organization_id", ctx.org.id).is("archived_at", null).order("name"),
  ]);
  const supplier = po.supplier as { id: string; name: string };
  const canManage = ctx.can("purchases.manage");
  const receivable = ["draft", "ordered", "partially_received"].includes(po.status);
  const due = Number(po.received_total) - Number(po.returned_total) - Number(po.paid_total);

  return (
    <>
      <Link href="/app/achats" className="text-sm font-semibold text-fg-muted hover:text-fg">← Achats</Link>
      <div className="mb-6 mt-1 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex flex-wrap items-center gap-3 font-display text-3xl font-extrabold">
            {po.number} <Badge tone={po.status === "received" ? "success" : po.status === "cancelled" ? "danger" : "warning"}>{PURCHASE_STATUS[po.status as keyof typeof PURCHASE_STATUS]}</Badge>
          </h1>
          <p className="mt-1 text-sm text-fg-muted">
            <Link href={`/app/achats/fournisseurs/${supplier.id}`} className="font-semibold text-primary">{supplier.name}</Link> · {(po.location as { name: string }).name} · créé le {formatDate(po.created_at)}
            {po.expected_date && ` · livraison prévue le ${formatDate(po.expected_date)}`}{po.supplier_invoice_ref && ` · facture ${po.supplier_invoice_ref}`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canManage && po.status === "draft" && (
            <ActionForm action={setPurchaseStatus}><input type="hidden" name="id" value={id} /><input type="hidden" name="status" value="ordered" /><SubmitButton variant="outline">Confirmer la commande</SubmitButton></ActionForm>
          )}
          {canManage && receivable && (
            <Modal trigger="Réceptionner" title="Réception des marchandises" wide>
              <ActionForm action={receivePurchase} className="space-y-4">
                <input type="hidden" name="id" value={id} />
                <Table>
                  <thead><tr><TH>Produit</TH><TH className="text-right">Reste à recevoir</TH><TH>Quantité reçue</TH><TH>Coût unitaire</TH></tr></thead>
                  <tbody>
                    {(items ?? []).map((i) => {
                      const left = Number(i.quantity_ordered) - Number(i.quantity_received);
                      const p = i.product as unknown as { name: string; unit: string };
                      return (
                        <tr key={i.id}>
                          <TD>{p.name}</TD>
                          <TD className="num text-right">{formatQty(left)} {p.unit}</TD>
                          <TD><Input name={`qty_${i.id}`} type="number" step="any" min={0} max={left} defaultValue={left > 0 ? left : ""} disabled={left <= 0} className="w-28" aria-label={`Quantité reçue ${p.name}`} /></TD>
                          <TD><Input name={`cost_${i.id}`} inputMode="decimal" defaultValue={Number(i.unit_cost)} disabled={left <= 0} className="w-32" aria-label={`Coût ${p.name}`} /></TD>
                        </tr>
                      );
                    })}
                  </tbody>
                </Table>
                <Field label="Note (n° de bon de livraison…)" htmlFor="note"><Input id="note" name="note" /></Field>
                <SubmitButton>Valider la réception</SubmitButton>
              </ActionForm>
            </Modal>
          )}
          {due > 0 && (ctx.can("purchases.manage") || ctx.can("treasury.manage")) && (
            <Modal trigger="Payer" title={`Paiement à ${supplier.name}`} triggerVariant="accent">
              <ActionForm action={paySupplier} resetOnSuccess className="space-y-4">
                <input type="hidden" name="supplier_id" value={supplier.id} />
                <input type="hidden" name="purchase_order_id" value={id} />
                <p className="text-sm">Reste à payer sur cette commande : <strong>{formatMoney(due)}</strong></p>
                <Field label="Montant" htmlFor="amount" required><Input id="amount" name="amount" inputMode="decimal" defaultValue={due} required /></Field>
                <Field label="Mode de paiement" htmlFor="method"><Select id="method" name="method">{Object.entries(PAYMENT_METHODS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
                <Field label="Compte débité" htmlFor="account_id">
                  <Select id="account_id" name="account_id" defaultValue="">
                    <option value="">Automatique (selon le mode)</option>
                    {(accounts ?? []).map((a) => <option key={a.account_id} value={a.account_id}>{a.name} · {formatMoney(a.balance)}</option>)}
                  </Select>
                </Field>
                <Field label="Référence" htmlFor="reference"><Input id="reference" name="reference" /></Field>
                <SubmitButton>Enregistrer le paiement</SubmitButton>
              </ActionForm>
            </Modal>
          )}
          {canManage && Number(po.received_total) === 0 && po.status !== "cancelled" && (
            <ActionForm action={setPurchaseStatus}><input type="hidden" name="id" value={id} /><input type="hidden" name="status" value="cancelled" /><ConfirmSubmit message="Annuler ce bon de commande ?" size="md">Annuler</ConfirmSubmit></ActionForm>
          )}
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Lignes de commande" />
          <Table>
            <thead><tr><TH>Produit</TH><TH className="text-right">Commandé</TH><TH className="text-right">Reçu</TH><TH className="text-right">Retourné</TH><TH className="text-right">Coût</TH><TH className="text-right">Total reçu</TH>{canManage && <TH />}</tr></thead>
            <tbody>
              {(items ?? []).map((i) => {
                const p = i.product as unknown as { name: string; unit: string };
                const returnable = Number(i.quantity_received) - Number(i.quantity_returned);
                return (
                  <tr key={i.id}>
                    <TD><Link href={`/app/produits/${i.product_id}`} className="font-semibold hover:text-primary">{p.name}</Link></TD>
                    <TD className="num text-right">{formatQty(i.quantity_ordered)}</TD>
                    <TD className="num text-right">{formatQty(i.quantity_received)}</TD>
                    <TD className="num text-right">{Number(i.quantity_returned) ? formatQty(i.quantity_returned) : "—"}</TD>
                    <TD className="num text-right">{formatMoney(i.unit_cost)}</TD>
                    <TD className="num text-right font-semibold">{formatMoney(Number(i.quantity_received) * Number(i.unit_cost))}</TD>
                    {canManage && (
                      <TD>
                        {returnable > 0 && (
                          <Modal trigger="Retour" title={`Retour fournisseur : ${p.name}`} triggerVariant="ghost" triggerSize="sm">
                            <ActionForm action={returnToSupplier} className="space-y-4">
                              <input type="hidden" name="item_id" value={i.id} />
                              <Field label={`Quantité (max ${formatQty(returnable)})`} htmlFor="quantity"><Input id="quantity" name="quantity" type="number" step="any" min={0} max={returnable} required /></Field>
                              <Field label="Motif" htmlFor="reason" required><Input id="reason" name="reason" required /></Field>
                              <SubmitButton>Enregistrer le retour</SubmitButton>
                            </ActionForm>
                          </Modal>
                        )}
                      </TD>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </Table>
          {po.note && <CardBody className="text-sm text-fg-muted">{po.note}</CardBody>}
        </Card>
        <div className="space-y-5">
          <Card>
            <CardHeader title="Montants" />
            <CardBody className="space-y-1.5 text-sm">
              <div className="flex justify-between"><span className="text-fg-muted">Commandé</span><span className="num">{formatMoney(po.ordered_total)}</span></div>
              <div className="flex justify-between"><span className="text-fg-muted">Reçu (dû au fournisseur)</span><span className="num">{formatMoney(po.received_total)}</span></div>
              <div className="flex justify-between"><span className="text-fg-muted">Retours</span><span className="num">− {formatMoney(po.returned_total)}</span></div>
              <div className="flex justify-between"><span className="text-fg-muted">Payé</span><span className="num">− {formatMoney(po.paid_total)}</span></div>
              <div className="flex justify-between border-t border-border pt-1.5 font-bold"><span>Reste à payer</span><span className={`num ${due > 0 ? "text-danger" : ""}`}>{formatMoney(due)}</span></div>
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Historique" />
            <CardBody className="space-y-2 text-sm">
              {(receptions ?? []).map((r) => <p key={r.id}>📦 {formatDate(r.received_at, true)} · réception {formatMoney(r.total)}{r.note && <span className="text-fg-muted"> · {r.note}</span>}</p>)}
              {(returns ?? []).map((r) => <p key={r.id}>↩ {formatDate(r.created_at, true)} · retour {formatQty(r.quantity)} × {(r.item as unknown as { product: { name: string } })?.product?.name} ({formatMoney(r.amount)}) · {r.reason}</p>)}
              {(payments ?? []).map((p) => <p key={p.id}>💳 {formatDate(p.created_at, true)} · paiement {formatMoney(p.amount)} ({PAYMENT_METHODS[p.method as PaymentMethod]})</p>)}
              {!receptions?.length && !returns?.length && !payments?.length && <p className="text-fg-muted">Aucune opération.</p>}
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
