import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, ButtonLink, Card, CardBody, CardHeader, Field, Input, Select, StatCard, Table, TD, TH } from "@/components/ui";
import { ActionForm, Modal, SubmitButton } from "@/components/ui/client";
import { getAppContext } from "@/lib/context";
import { formatDate, formatMoney } from "@/lib/format";
import { PAYMENT_METHODS, PURCHASE_STATUS, type PaymentMethod } from "@/lib/constants";
import { isUuid } from "@/lib/utils";
import { SupplierFields } from "../../supplier-fields";
import { paySupplier, saveSupplier } from "../../actions";

export const metadata: Metadata = { title: "Fournisseur" };

export default async function SupplierPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const ctx = await getAppContext();
  const { data: s } = await ctx.supabase.from("suppliers").select("*").eq("id", id).eq("organization_id", ctx.org.id).maybeSingle();
  if (!s) notFound();
  const canMoney = ctx.can("purchases.manage") || ctx.can("treasury.manage");
  const [{ data: b }, { data: orders }, { data: payments }, { data: products }] = await Promise.all([
    ctx.supabase.from("supplier_balances").select("*").eq("supplier_id", id).maybeSingle(),
    ctx.supabase.from("purchase_orders").select("id, number, status, created_at, received_total, returned_total, paid_total").eq("supplier_id", id).order("created_at", { ascending: false }).limit(100),
    ctx.supabase.from("supplier_payments").select("id, amount, method, reference, note, created_at, po:purchase_orders(number)").eq("supplier_id", id).order("created_at", { ascending: false }).limit(100),
    ctx.supabase.from("products").select("id, name").eq("supplier_id", id).eq("is_active", true).order("name"),
  ]);
  const due = Number(b?.balance_due ?? 0);

  return (
    <>
      <Link href="/app/achats?vue=fournisseurs" className="text-sm font-semibold text-fg-muted hover:text-fg">← Fournisseurs</Link>
      <div className="mb-6 mt-1 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-extrabold">{s.name}</h1>
          <p className="mt-1 text-sm text-fg-muted">{[s.contact_name, s.phone, s.email, s.address].filter(Boolean).join(" · ") || "Aucune coordonnée"}</p>
        </div>
        <div className="flex gap-2">
          {ctx.can("purchases.manage") && <ButtonLink href={`/app/achats/nouveau?fournisseur=${id}`} variant="outline">+ Bon de commande</ButtonLink>}
          {canMoney && due > 0 && (
            <Modal trigger="Payer" title={`Paiement à ${s.name}`} triggerVariant="accent">
              <ActionForm action={paySupplier} resetOnSuccess className="space-y-4">
                <input type="hidden" name="supplier_id" value={id} />
                <p className="text-sm">Dette totale : <strong>{formatMoney(due)}</strong>. Paiement non affecté à une commande précise.</p>
                <Field label="Montant" htmlFor="amount" required><Input id="amount" name="amount" inputMode="decimal" required /></Field>
                <Field label="Mode de paiement" htmlFor="method"><Select id="method" name="method">{Object.entries(PAYMENT_METHODS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
                <Field label="Référence" htmlFor="reference"><Input id="reference" name="reference" /></Field>
                <Field label="Note" htmlFor="note"><Input id="note" name="note" /></Field>
                <SubmitButton>Enregistrer</SubmitButton>
              </ActionForm>
            </Modal>
          )}
        </div>
      </div>
      {canMoney && (
        <div className="mb-5 grid gap-3 sm:grid-cols-3">
          <StatCard label="Marchandises reçues" value={formatMoney(b?.total_received ?? 0)} tone="primary" hint={`Retours : ${formatMoney(b?.total_returned ?? 0)}`} />
          <StatCard label="Payé" value={formatMoney(b?.total_paid ?? 0)} tone="success" />
          <StatCard label="Solde dû" value={formatMoney(due)} tone={due > 0 ? "danger" : "neutral"} />
        </div>
      )}
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          {canMoney && (
            <Card>
              <CardHeader title="Commandes" />
              <Table>
                <thead><tr><TH>N°</TH><TH>Date</TH><TH className="text-right">Reçu</TH><TH className="text-right">Reste dû</TH><TH>Statut</TH></tr></thead>
                <tbody>
                  {(orders ?? []).map((o) => (
                    <tr key={o.id}>
                      <TD><Link href={`/app/achats/${o.id}`} className="font-bold text-primary">{o.number}</Link></TD>
                      <TD className="text-fg-muted">{formatDate(o.created_at)}</TD>
                      <TD className="num text-right">{formatMoney(o.received_total)}</TD>
                      <TD className="num text-right">{formatMoney(Number(o.received_total) - Number(o.returned_total) - Number(o.paid_total))}</TD>
                      <TD><Badge>{PURCHASE_STATUS[o.status as keyof typeof PURCHASE_STATUS]}</Badge></TD>
                    </tr>
                  ))}
                  {!orders?.length && <tr><TD colSpan={5} className="text-center text-fg-muted">Aucune commande.</TD></tr>}
                </tbody>
              </Table>
            </Card>
          )}
          {canMoney && (
            <Card>
              <CardHeader title="Paiements" />
              <Table>
                <thead><tr><TH>Date</TH><TH>Mode</TH><TH>Commande</TH><TH className="text-right">Montant</TH></tr></thead>
                <tbody>
                  {(payments ?? []).map((p) => (
                    <tr key={p.id}>
                      <TD className="text-fg-muted">{formatDate(p.created_at, true)}</TD>
                      <TD>{PAYMENT_METHODS[p.method as PaymentMethod]}{p.reference && <span className="text-xs text-fg-muted"> · {p.reference}</span>}</TD>
                      <TD>{(p.po as unknown as { number: string } | null)?.number ?? "Non affecté"}</TD>
                      <TD className="num text-right font-semibold">{formatMoney(p.amount)}</TD>
                    </tr>
                  ))}
                  {!payments?.length && <tr><TD colSpan={4} className="text-center text-fg-muted">Aucun paiement.</TD></tr>}
                </tbody>
              </Table>
            </Card>
          )}
        </div>
        <div className="space-y-5">
          <Card>
            <CardHeader title="Produits fournis" />
            <CardBody className="space-y-1 text-sm">
              {(products ?? []).map((p) => <Link key={p.id} href={`/app/produits/${p.id}`} className="block hover:text-primary">{p.name}</Link>)}
              {!products?.length && <p className="text-fg-muted">Aucun produit n&apos;a ce fournisseur comme fournisseur principal.</p>}
            </CardBody>
          </Card>
          {ctx.can("suppliers.manage") && (
            <Card>
              <CardHeader title="Informations" />
              <CardBody>
                <ActionForm action={saveSupplier} className="space-y-4"><SupplierFields values={s} /><SubmitButton>Enregistrer</SubmitButton></ActionForm>
              </CardBody>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
