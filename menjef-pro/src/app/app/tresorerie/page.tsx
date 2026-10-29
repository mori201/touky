import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Landmark } from "lucide-react";
import { Badge, ButtonLink, Card, CardHeader, EmptyState, Field, Input, PageHeader, Select, StatCard, Table, TD, TH } from "@/components/ui";
import { ActionForm, ConfirmSubmit, Modal, SubmitButton } from "@/components/ui/client";
import { getAppContext } from "@/lib/context";
import { formatDate, formatMoney } from "@/lib/format";
import { ACCOUNT_KINDS, PAYMENT_METHODS, TREASURY_KINDS } from "@/lib/constants";
import { archiveAccount, createAccount, transferFunds } from "./actions";

export const metadata: Metadata = { title: "Trésorerie" };

export default async function TreasuryPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const ctx = await getAppContext();
  const canSee = ctx.can("treasury.manage") || ctx.can("reports.view");
  if (!canSee) {
    if (ctx.can("cash.close")) redirect("/app/tresorerie/caisses");
    redirect("/app/acces-refuse?permission=treasury.manage");
  }
  const manage = ctx.can("treasury.manage");
  let mq = ctx.supabase.from("treasury_movements").select("id, account_id, kind, amount, label, reference_type, reference_id, occurred_at").eq("organization_id", ctx.org.id).order("occurred_at", { ascending: false }).order("id", { ascending: false }).limit(150);
  if (sp.compte) mq = mq.eq("account_id", sp.compte);
  const [{ data: accounts }, { data: movements }] = await Promise.all([
    ctx.supabase.from("account_balances").select("*").eq("organization_id", ctx.org.id).is("archived_at", null).order("name"),
    mq,
  ]);
  const accName = new Map((accounts ?? []).map((a) => [a.account_id, a.name]));
  const total = (accounts ?? []).reduce((s, a) => s + Number(a.balance), 0);
  const byKind = new Map<string, number>();
  for (const a of accounts ?? []) byKind.set(a.kind, (byKind.get(a.kind) ?? 0) + Number(a.balance));

  return (
    <>
      <PageHeader
        title="Trésorerie"
        description="Solde de chaque compte, calculé à partir de tous ses mouvements."
        actions={
          <>
            <ButtonLink href="/app/tresorerie/caisses" variant="outline">Ouverture / clôture de caisse</ButtonLink>
            {manage && (
              <Modal trigger="Transfert interne" title="Transfert entre comptes" triggerVariant="outline">
                <ActionForm action={transferFunds} resetOnSuccess className="space-y-4">
                  <p className="text-sm text-fg-muted">Ex. : versement de la caisse à la banque. Un transfert n&apos;est ni une recette ni une dépense.</p>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Depuis" htmlFor="from"><Select id="from" name="from">{(accounts ?? []).map((a) => <option key={a.account_id} value={a.account_id}>{a.name} ({formatMoney(a.balance)})</option>)}</Select></Field>
                    <Field label="Vers" htmlFor="to"><Select id="to" name="to" defaultValue={accounts?.[1]?.account_id}>{(accounts ?? []).map((a) => <option key={a.account_id} value={a.account_id}>{a.name}</option>)}</Select></Field>
                  </div>
                  <Field label="Montant" htmlFor="amount" required><Input id="amount" name="amount" inputMode="decimal" required /></Field>
                  <Field label="Note" htmlFor="note"><Input id="note" name="note" placeholder="Versement banque du jour" /></Field>
                  <SubmitButton>Transférer</SubmitButton>
                </ActionForm>
              </Modal>
            )}
            {manage && (
              <Modal trigger="+ Compte" title="Nouveau compte de trésorerie">
                <ActionForm action={createAccount} resetOnSuccess className="space-y-4">
                  <Field label="Nom" htmlFor="name" required><Input id="name" name="name" required placeholder="Ex. : Banque CBAO" /></Field>
                  <Field label="Type" htmlFor="kind"><Select id="kind" name="kind">{Object.entries(ACCOUNT_KINDS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
                  <Field label="Mode de paiement associé" htmlFor="method" hint="Les paiements de ce mode à la caisse seront crédités ici par défaut.">
                    <Select id="method" name="method"><option value="">Aucun</option>{Object.entries(PAYMENT_METHODS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select>
                  </Field>
                  <Field label="Établissement" htmlFor="location_id"><Select id="location_id" name="location_id"><option value="">Toute l&apos;entreprise</option>{ctx.locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</Select></Field>
                  <Field label="Solde initial" htmlFor="opening"><Input id="opening" name="opening" inputMode="decimal" placeholder="0" /></Field>
                  <SubmitButton>Créer le compte</SubmitButton>
                </ActionForm>
              </Modal>
            )}
          </>
        }
      />
      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Trésorerie totale" value={formatMoney(total)} icon={<Landmark size={18} />} tone="primary" />
        {[...byKind].map(([k, v]) => <StatCard key={k} label={ACCOUNT_KINDS[k as keyof typeof ACCOUNT_KINDS]} value={formatMoney(v)} tone="neutral" />)}
      </div>
      <div className="grid gap-5 xl:grid-cols-[380px_1fr]">
        <Card className="self-start">
          <CardHeader title="Comptes" />
          <ul className="divide-y divide-border">
            {(accounts ?? []).map((a) => (
              <li key={a.account_id} className="flex items-center justify-between gap-2 px-5 py-3">
                <Link href={`/app/tresorerie?compte=${a.account_id}`} className="min-w-0">
                  <p className="truncate font-semibold hover:text-primary">{a.name}</p>
                  <p className="text-xs text-fg-muted">{ACCOUNT_KINDS[a.kind as keyof typeof ACCOUNT_KINDS]}{a.location_id ? ` · ${ctx.locations.find((l) => l.id === a.location_id)?.name ?? ""}` : ""}</p>
                </Link>
                <div className="flex items-center gap-2">
                  <span className={`num font-bold ${Number(a.balance) < 0 ? "text-danger" : ""}`}>{formatMoney(a.balance)}</span>
                  {manage && Number(a.balance) === 0 && (
                    <ActionForm action={archiveAccount}><input type="hidden" name="id" value={a.account_id} /><ConfirmSubmit message={`Archiver le compte « ${a.name} » ?`} variant="outline">Archiver</ConfirmSubmit></ActionForm>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <CardHeader title={sp.compte ? `Mouvements · ${accName.get(sp.compte) ?? ""}` : "Derniers mouvements"} actions={sp.compte && <Link href="/app/tresorerie" className="text-sm font-semibold text-primary">Tous les comptes</Link>} />
          {!movements?.length ? (
            <EmptyState title="Aucun mouvement" />
          ) : (
            <Table>
              <thead><tr><TH>Date</TH><TH>Compte</TH><TH>Nature</TH><TH>Libellé</TH><TH className="text-right">Montant</TH></tr></thead>
              <tbody>
                {movements.map((m) => (
                  <tr key={m.id}>
                    <TD className="whitespace-nowrap text-fg-muted">{formatDate(m.occurred_at, true)}</TD>
                    <TD>{accName.get(m.account_id) ?? "Compte archivé"}</TD>
                    <TD><Badge tone={m.kind.startsWith("transfer") ? "neutral" : Number(m.amount) >= 0 ? "success" : "danger"}>{TREASURY_KINDS[m.kind as keyof typeof TREASURY_KINDS]}</Badge></TD>
                    <TD className="text-fg-muted">{m.reference_type === "sale" && m.reference_id ? <Link href={`/app/ventes/${m.reference_id}`} className="text-primary">{m.label}</Link> : m.label}</TD>
                    <TD className={`num text-right font-bold ${Number(m.amount) < 0 ? "text-danger" : "text-success"}`}>{Number(m.amount) > 0 ? "+" : ""}{formatMoney(m.amount)}</TD>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      </div>
    </>
  );
}
