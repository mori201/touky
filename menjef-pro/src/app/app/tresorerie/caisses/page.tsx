import type { Metadata } from "next";
import Link from "next/link";
import { Alert, Badge, Card, CardBody, CardHeader, EmptyState, Field, Input, PageHeader, Table, TD, TH, Textarea } from "@/components/ui";
import { ActionForm, Modal, SubmitButton } from "@/components/ui/client";
import { requirePermission } from "@/lib/context";
import { getMemberNames } from "@/lib/queries";
import { formatDate, formatMoney } from "@/lib/format";
import { TREASURY_KINDS } from "@/lib/constants";
import { closeSession, correctSession, openSession } from "../actions";

export const metadata: Metadata = { title: "Caisses : ouverture et clôture" };

interface Status { open: boolean; balance: number; session_id?: string; opened_at?: string; declared_opening?: number; movements?: { kind: string; amount: number; count: number }[] }

export default async function CashSessionsPage() {
  const ctx = await requirePermission("cash.close");
  const { data: accounts } = await ctx.supabase.from("treasury_accounts").select("id, name, location_id").eq("organization_id", ctx.org.id).eq("kind", "cash").is("archived_at", null).order("name");
  const visible = (accounts ?? []).filter((a) => !ctx.restrictedTo || !a.location_id || a.location_id === ctx.restrictedTo);
  const statuses = await Promise.all(visible.map(async (a) => ({ a, s: (await ctx.supabase.rpc("cash_session_status", { p_account: a.id })).data as Status | null })));
  const [{ data: sessions }, { data: corrections }, names] = await Promise.all([
    ctx.supabase.from("cash_sessions").select("*").eq("organization_id", ctx.org.id).eq("status", "closed").order("closed_at", { ascending: false }).limit(50),
    ctx.supabase.from("cash_session_corrections").select("session_id, previous_counted, new_counted, reason, created_at").eq("organization_id", ctx.org.id),
    getMemberNames(ctx),
  ]);
  const accName = new Map((accounts ?? []).map((a) => [a.id, a.name]));
  const corr = new Map<string, typeof corrections>();
  for (const c of corrections ?? []) corr.set(c.session_id, [...(corr.get(c.session_id) ?? []), c]);

  return (
    <>
      <Link href="/app/tresorerie" className="text-sm font-semibold text-fg-muted hover:text-fg">← Trésorerie</Link>
      <PageHeader title="Ouverture et clôture de caisse" description="Comptez les espèces à l'ouverture et à la clôture : tout écart est enregistré et doit être justifié." />
      {ctx.org.require_cash_gap_comment && <Alert tone="primary" className="mb-5">Règle de l&apos;entreprise : un commentaire est obligatoire en cas d&apos;écart.</Alert>}
      <div className="grid gap-5 md:grid-cols-2">
        {statuses.map(({ a, s }) => (
          <Card key={a.id}>
            <CardHeader title={a.name} description={a.location_id ? ctx.locations.find((l) => l.id === a.location_id)?.name : "Toute l'entreprise"} actions={s?.open ? <Badge tone="success">Ouverte</Badge> : <Badge>Fermée</Badge>} />
            <CardBody className="space-y-4">
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-fg-muted">Solde théorique</span>
                <span className="num font-display text-2xl font-extrabold">{formatMoney(s?.balance ?? 0)}</span>
              </div>
              {s?.open ? (
                <>
                  <p className="text-sm text-fg-muted">Ouverte le {formatDate(s.opened_at, true)} avec un fond de {formatMoney(s.declared_opening)}.</p>
                  {(s.movements ?? []).length > 0 && (
                    <ul className="space-y-1 rounded-xl bg-muted/60 p-3 text-sm">
                      {(s.movements ?? []).map((m) => (
                        <li key={m.kind} className="flex justify-between"><span>{TREASURY_KINDS[m.kind as keyof typeof TREASURY_KINDS]} ({m.count})</span><span className="num font-semibold">{formatMoney(m.amount)}</span></li>
                      ))}
                    </ul>
                  )}
                  <ActionForm action={closeSession} className="space-y-3">
                    <input type="hidden" name="session_id" value={s.session_id} />
                    <Field label="Espèces comptées" htmlFor={`c_${a.id}`} required><Input id={`c_${a.id}`} name="counted" inputMode="decimal" required /></Field>
                    <Field label="Commentaire" htmlFor={`m_${a.id}`} hint="Obligatoire en cas d'écart."><Textarea id={`m_${a.id}`} name="comment" /></Field>
                    <SubmitButton variant="accent" className="w-full">Clôturer la caisse</SubmitButton>
                  </ActionForm>
                </>
              ) : (
                <ActionForm action={openSession} className="space-y-3">
                  <input type="hidden" name="account_id" value={a.id} />
                  <Field label="Fond de caisse compté" htmlFor={`o_${a.id}`} required><Input id={`o_${a.id}`} name="declared" inputMode="decimal" defaultValue={s?.balance ?? 0} required /></Field>
                  <Field label="Commentaire" htmlFor={`oc_${a.id}`} hint="Obligatoire si le fond diffère du solde théorique."><Input id={`oc_${a.id}`} name="comment" /></Field>
                  <SubmitButton className="w-full">Ouvrir la caisse</SubmitButton>
                </ActionForm>
              )}
            </CardBody>
          </Card>
        ))}
        {statuses.length === 0 && <Card className="md:col-span-2"><EmptyState title="Aucune caisse physique" description="Créez un compte de type « Caisse physique » dans Trésorerie." /></Card>}
      </div>

      <Card className="mt-5">
        <CardHeader title="Rapports de clôture" description="Une clôture ne peut pas être modifiée silencieusement : chaque correction est tracée." />
        {!sessions?.length ? (
          <EmptyState title="Aucune clôture" />
        ) : (
          <Table>
            <thead><tr><TH>Caisse</TH><TH>Période</TH><TH className="text-right">Théorique</TH><TH className="text-right">Compté</TH><TH className="text-right">Écart</TH><TH>Commentaire</TH><TH>Clôturée par</TH>{ctx.can("treasury.manage") && <TH />}</tr></thead>
            <tbody>
              {sessions.map((s) => (
                <tr key={s.id}>
                  <TD className="font-semibold">{accName.get(s.account_id)}</TD>
                  <TD className="whitespace-nowrap text-fg-muted">{formatDate(s.opened_at, true)}<br />→ {formatDate(s.closed_at, true)}</TD>
                  <TD className="num text-right">{formatMoney(s.expected_balance)}</TD>
                  <TD className="num text-right">{formatMoney(s.counted_balance)}</TD>
                  <TD className={`num text-right font-bold ${Number(s.gap) === 0 ? "text-success" : "text-danger"}`}>{Number(s.gap) > 0 ? "+" : ""}{formatMoney(s.gap)}</TD>
                  <TD className="text-sm text-fg-muted">
                    {s.comment ?? "—"}
                    {(corr.get(s.id) ?? []).map((c, i) => <p key={i} className="mt-1 text-xs text-warning">Corrigé le {formatDate(c.created_at)} : {formatMoney(c.previous_counted)} → {formatMoney(c.new_counted)} ({c.reason})</p>)}
                  </TD>
                  <TD className="text-fg-muted">{names.get(s.closed_by) ?? "—"}</TD>
                  {ctx.can("treasury.manage") && (
                    <TD>
                      <Modal trigger="Corriger" title="Corriger une clôture" triggerVariant="ghost" triggerSize="sm">
                        <ActionForm action={correctSession} className="space-y-3">
                          <input type="hidden" name="session_id" value={s.id} />
                          <Field label="Nouveau montant compté" htmlFor={`n_${s.id}`}><Input id={`n_${s.id}`} name="counted" inputMode="decimal" defaultValue={Number(s.counted_balance)} required /></Field>
                          <Field label="Motif de la correction" htmlFor={`r_${s.id}`} required><Textarea id={`r_${s.id}`} name="reason" required /></Field>
                          <SubmitButton>Enregistrer la correction</SubmitButton>
                        </ActionForm>
                      </Modal>
                    </TD>
                  )}
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
