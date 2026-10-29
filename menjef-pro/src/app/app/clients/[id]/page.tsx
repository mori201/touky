import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, ButtonLink, Card, CardBody, CardHeader, Field, Input, Select, StatCard, Table, TD, TH } from "@/components/ui";
import { ActionForm, Modal, SubmitButton } from "@/components/ui/client";
import { requirePermission } from "@/lib/context";
import { formatDate, formatMoney } from "@/lib/format";
import { PAYMENT_METHODS, type PaymentMethod } from "@/lib/constants";
import { isUuid } from "@/lib/utils";
import { CustomerFields } from "../customer-fields";
import { addPromise, recordPayment, saveCustomer, setCustomerArchived, setPromiseStatus } from "../actions";

export const metadata: Metadata = { title: "Fiche client" };

export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const ctx = await requirePermission("credits.view");
  const { data: c } = await ctx.supabase.from("customers").select("*").eq("id", id).eq("organization_id", ctx.org.id).maybeSingle();
  if (!c) notFound();
  const [{ data: b }, { data: sales }, { data: payments }, { data: promises }, { data: accounts }] = await Promise.all([
    ctx.supabase.from("customer_balances").select("*").eq("customer_id", id).maybeSingle(),
    ctx.supabase.from("sales").select("id, number, created_at, total, returned_total, paid_at_checkout, balance_due, due_date, status").eq("customer_id", id).order("created_at", { ascending: false }).limit(100),
    ctx.supabase.from("customer_payments").select("id, number, amount, method, reference, note, created_at").eq("customer_id", id).order("created_at", { ascending: false }).limit(100),
    ctx.supabase.from("payment_promises").select("id, amount, promised_date, note, status").eq("customer_id", id).order("promised_date", { ascending: false }),
    ctx.supabase.from("treasury_accounts").select("id, name, method").eq("organization_id", ctx.org.id).is("archived_at", null).order("name"),
  ]);
  const due = Number(b?.balance_due ?? 0);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <>
      <Link href="/app/clients" className="text-sm font-semibold text-fg-muted hover:text-fg">← Clients</Link>
      <div className="mb-6 mt-1 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex flex-wrap items-center gap-3 font-display text-3xl font-extrabold">{c.name} {c.archived_at && <Badge tone="danger">Archivé</Badge>}</h1>
          <p className="mt-1 text-sm text-fg-muted">{[c.phone, c.email, c.address].filter(Boolean).join(" · ") || "Aucune coordonnée"}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ButtonLink href={`/app/clients/${id}/releve`} variant="outline" target="_blank">Relevé</ButtonLink>
          {ctx.can("payments.record") && due > 0 && (
            <Modal trigger="Enregistrer un remboursement" title={`Remboursement de ${c.name}`} triggerVariant="accent">
              <ActionForm action={recordPayment} resetOnSuccess className="space-y-4">
                <input type="hidden" name="customer_id" value={id} />
                <p className="text-sm">Solde dû : <strong>{formatMoney(due)}</strong></p>
                <Field label="Montant reçu" htmlFor="amount" required><Input id="amount" name="amount" inputMode="decimal" defaultValue={due} required /></Field>
                <Field label="Mode de paiement" htmlFor="method">
                  <Select id="method" name="method">{ctx.org.enabled_payment_methods.map((m) => <option key={m} value={m}>{PAYMENT_METHODS[m]}</option>)}</Select>
                </Field>
                <Field label="Compte crédité" htmlFor="account_id" hint="Par défaut : le compte associé au mode de paiement.">
                  <Select id="account_id" name="account_id" defaultValue="">
                    <option value="">Automatique</option>
                    {(accounts ?? []).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </Select>
                </Field>
                <Field label="Référence" htmlFor="reference"><Input id="reference" name="reference" /></Field>
                <Field label="Note" htmlFor="note"><Input id="note" name="note" /></Field>
                <SubmitButton>Enregistrer</SubmitButton>
              </ActionForm>
            </Modal>
          )}
        </div>
      </div>

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total facturé" value={formatMoney(b?.total_sales ?? 0)} hint={`${b?.sales_count ?? 0} vente(s)`} tone="primary" />
        <StatCard label="Total payé" value={formatMoney(b?.total_paid ?? 0)} tone="success" />
        <StatCard label="Solde dû" value={formatMoney(due)} tone={due > 0 ? "warning" : "neutral"} hint={c.credit_limit != null ? `Plafond ${formatMoney(c.credit_limit)}` : "Sans plafond"} />
        <StatCard label="En retard" value={formatMoney(b?.overdue ?? 0)} tone={Number(b?.overdue ?? 0) > 0 ? "danger" : "neutral"} hint={b?.next_due_date ? `Prochaine échéance ${formatDate(b.next_due_date)}` : undefined} />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card>
            <CardHeader title="Achats" />
            <Table>
              <thead><tr><TH>N°</TH><TH>Date</TH><TH className="text-right">Montant</TH><TH className="text-right">Payé à la vente</TH><TH className="text-right">Reste dû</TH><TH>Échéance</TH></tr></thead>
              <tbody>
                {(sales ?? []).map((s) => (
                  <tr key={s.id}>
                    <TD><Link href={`/app/ventes/${s.id}`} className="font-bold text-primary">{s.number}</Link>{s.status === "cancelled" && <Badge tone="danger" className="ml-2">Annulée</Badge>}</TD>
                    <TD className="text-fg-muted">{formatDate(s.created_at)}</TD>
                    <TD className="num text-right">{formatMoney(Number(s.total) - Number(s.returned_total))}</TD>
                    <TD className="num text-right">{formatMoney(s.paid_at_checkout)}</TD>
                    <TD className="num text-right font-semibold">{Number(s.balance_due) > 0 ? formatMoney(s.balance_due) : "—"}</TD>
                    <TD>{s.due_date && Number(s.balance_due) > 0 ? <span className={s.due_date < today ? "font-bold text-danger" : ""}>{formatDate(s.due_date)}</span> : "—"}</TD>
                  </tr>
                ))}
                {!(sales ?? []).length && <tr><TD colSpan={6} className="text-center text-fg-muted">Aucun achat.</TD></tr>}
              </tbody>
            </Table>
          </Card>
          <Card>
            <CardHeader title="Remboursements" />
            <Table>
              <thead><tr><TH>N°</TH><TH>Date</TH><TH>Mode</TH><TH className="text-right">Montant</TH><TH>Reçu</TH></tr></thead>
              <tbody>
                {(payments ?? []).map((p) => (
                  <tr key={p.id}>
                    <TD className="font-bold">{p.number}</TD>
                    <TD className="text-fg-muted">{formatDate(p.created_at, true)}</TD>
                    <TD>{PAYMENT_METHODS[p.method as PaymentMethod]}{p.reference && <span className="text-xs text-fg-muted"> · {p.reference}</span>}</TD>
                    <TD className="num text-right font-semibold text-success">{formatMoney(p.amount)}</TD>
                    <TD><Link href={`/app/clients/${id}/releve?recu=${p.id}`} target="_blank" className="text-sm font-semibold text-primary">Imprimer</Link></TD>
                  </tr>
                ))}
                {!(payments ?? []).length && <tr><TD colSpan={5} className="text-center text-fg-muted">Aucun remboursement.</TD></tr>}
              </tbody>
            </Table>
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader title="Promesses de paiement" />
            <CardBody className="space-y-3">
              {(promises ?? []).map((p) => (
                <div key={p.id} className="rounded-xl border border-border p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-bold">{formatMoney(p.amount)} le {formatDate(p.promised_date)}</span>
                    {p.status === "kept" ? <Badge tone="success">Tenue</Badge> : p.status === "broken" ? <Badge tone="danger">Non tenue</Badge> : <Badge tone={p.promised_date < today ? "danger" : "warning"}>En attente</Badge>}
                  </div>
                  {p.note && <p className="mt-1 text-fg-muted">{p.note}</p>}
                  {p.status === "pending" && ctx.can("payments.record") && (
                    <div className="mt-2 flex gap-2">
                      <ActionForm action={setPromiseStatus}><input type="hidden" name="id" value={p.id} /><input type="hidden" name="status" value="kept" /><SubmitButton size="sm" variant="outline">Tenue</SubmitButton></ActionForm>
                      <ActionForm action={setPromiseStatus}><input type="hidden" name="id" value={p.id} /><input type="hidden" name="status" value="broken" /><SubmitButton size="sm" variant="ghost">Non tenue</SubmitButton></ActionForm>
                    </div>
                  )}
                </div>
              ))}
              {ctx.can("payments.record") && (
                <ActionForm action={addPromise} resetOnSuccess className="space-y-2 border-t border-border pt-3">
                  <input type="hidden" name="customer_id" value={id} />
                  <div className="grid grid-cols-2 gap-2">
                    <Input name="amount" inputMode="decimal" placeholder="Montant" required aria-label="Montant promis" />
                    <Input name="promised_date" type="date" min={today} required aria-label="Date promise" />
                  </div>
                  <Input name="note" placeholder="Note" aria-label="Note" />
                  <SubmitButton size="sm" variant="outline">Ajouter une promesse</SubmitButton>
                </ActionForm>
              )}
            </CardBody>
          </Card>
          {(ctx.can("sales.create") || ctx.can("payments.record")) && (
            <Card>
              <CardHeader title="Informations" />
              <CardBody>
                <ActionForm action={saveCustomer} className="space-y-4">
                  <CustomerFields values={{ ...c, credit_limit: c.credit_limit == null ? null : Number(c.credit_limit) }} />
                  <SubmitButton>Enregistrer</SubmitButton>
                </ActionForm>
                <ActionForm action={setCustomerArchived} className="mt-3">
                  <input type="hidden" name="id" value={id} />
                  <input type="hidden" name="archive" value={String(!c.archived_at)} />
                  <SubmitButton size="sm" variant="ghost">{c.archived_at ? "Réactiver le client" : "Archiver le client"}</SubmitButton>
                </ActionForm>
              </CardBody>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
