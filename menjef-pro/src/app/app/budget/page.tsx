import type { Metadata } from "next";
import Link from "next/link";
import { Lock, PiggyBank } from "lucide-react";
import { Alert, ButtonLink, Card, CardBody, CardHeader, EmptyState, Field, Input, PageHeader, Select, StatCard, Table, TD, TH } from "@/components/ui";
import { ActionForm, ConfirmSubmit, Modal, SubmitButton } from "@/components/ui/client";
import { HorizontalBars } from "@/components/charts";
import { getSessionUser } from "@/lib/context";
import { formatDate, formatMoney, todayISO } from "@/lib/format";
import { addCategory, addGoal, addTransaction, contributeGoal, deleteGoal, deleteTransaction, seedCategories, setBudget } from "./actions";

export const metadata: Metadata = { title: "Budget personnel" };

function monthBounds(m?: string) {
  const ok = m && /^\d{4}-\d{2}$/.test(m) ? m : todayISO().slice(0, 7);
  const [y, mo] = ok.split("-").map(Number);
  const start = `${ok}-01`;
  const next = new Date(Date.UTC(y, mo, 1)).toISOString().slice(0, 10);
  const prev = new Date(Date.UTC(y, mo - 2, 1)).toISOString().slice(0, 7);
  const label = new Date(Date.UTC(y, mo - 1, 1)).toLocaleDateString("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" });
  return { key: ok, start, next, prev, nextKey: next.slice(0, 7), label };
}

export default async function BudgetPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const { supabase, user } = await getSessionUser();
  if (!user) return null;
  const m = monthBounds(sp.mois);
  const [{ data: cats }, { data: txs }, { data: budgets }, { data: goals }] = await Promise.all([
    supabase.from("personal_categories").select("id, name, kind").eq("user_id", user.id).order("name"),
    supabase.from("personal_transactions").select("id, kind, label, amount, occurred_on, category_id").eq("user_id", user.id).gte("occurred_on", m.start).lt("occurred_on", m.next).order("occurred_on", { ascending: false }),
    supabase.from("personal_budgets").select("category_id, amount").eq("user_id", user.id).eq("month", m.start),
    supabase.from("personal_goals").select("*").eq("user_id", user.id).order("created_at"),
  ]);
  const catName = new Map((cats ?? []).map((c) => [c.id, c.name]));
  const income = (txs ?? []).filter((t) => t.kind === "income").reduce((s, t) => s + Number(t.amount), 0);
  const expense = (txs ?? []).filter((t) => t.kind === "expense").reduce((s, t) => s + Number(t.amount), 0);
  const spentByCat = new Map<string, number>();
  for (const t of txs ?? []) if (t.kind === "expense") spentByCat.set(t.category_id ?? "", (spentByCat.get(t.category_id ?? "") ?? 0) + Number(t.amount));
  const budgetMap = new Map((budgets ?? []).map((b) => [b.category_id, Number(b.amount)]));
  const totalBudget = [...budgetMap.values()].reduce((a, b) => a + b, 0);
  const expenseCats = (cats ?? []).filter((c) => c.kind === "expense");

  return (
    <>
      <PageHeader
        eyebrow="Espace privé"
        title="Budget personnel"
        description={`${m.label.charAt(0).toUpperCase() + m.label.slice(1)}`}
        actions={
          <>
            <ButtonLink href={`/app/budget?mois=${m.prev}`} variant="outline">←</ButtonLink>
            <ButtonLink href={`/app/budget?mois=${m.nextKey}`} variant="outline">→</ButtonLink>
            <ButtonLink href={`/api/export/budget?mois=${m.key}`} variant="outline" prefetch={false}>Exporter</ButtonLink>
            {(cats ?? []).length > 0 && (
              <Modal trigger="+ Opération" title="Nouvelle opération personnelle">
                <ActionForm action={addTransaction} resetOnSuccess className="space-y-4">
                  <Field label="Type" htmlFor="kind"><Select id="kind" name="kind"><option value="expense">Dépense</option><option value="income">Revenu</option></Select></Field>
                  <Field label="Libellé" htmlFor="label" required><Input id="label" name="label" required /></Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Montant" htmlFor="amount" required><Input id="amount" name="amount" inputMode="decimal" required /></Field>
                    <Field label="Date" htmlFor="date"><Input id="date" name="date" type="date" defaultValue={todayISO()} required /></Field>
                  </div>
                  <Field label="Catégorie" htmlFor="category_id">
                    <Select id="category_id" name="category_id">
                      <option value="">Sans catégorie</option>
                      <optgroup label="Dépenses">{expenseCats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</optgroup>
                      <optgroup label="Revenus">{(cats ?? []).filter((c) => c.kind === "income").map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</optgroup>
                    </Select>
                  </Field>
                  <SubmitButton>Enregistrer</SubmitButton>
                </ActionForm>
              </Modal>
            )}
          </>
        }
      />
      <Alert tone="neutral" className="mb-5">
        <span className="inline-flex items-center gap-2"><Lock size={14} /> Ces données ne sont visibles que par vous. Elles ne sont jamais mélangées aux comptes de vos entreprises ni à leurs rapports.</span>
      </Alert>

      {(cats ?? []).length === 0 ? (
        <Card>
          <EmptyState
            icon={<PiggyBank />}
            title="Commencez votre budget personnel"
            description="Créez des catégories (logement, alimentation, transport…) pour suivre vos revenus et dépenses personnels."
            action={<ActionForm action={seedCategories}><SubmitButton>Créer les catégories par défaut</SubmitButton></ActionForm>}
          />
        </Card>
      ) : (
        <>
          <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Revenus du mois" value={formatMoney(income)} tone="success" />
            <StatCard label="Dépenses du mois" value={formatMoney(expense)} tone="danger" />
            <StatCard label="Reste à vivre" value={formatMoney(income - expense)} tone={income - expense >= 0 ? "primary" : "danger"} hint="Revenus − dépenses" />
            <StatCard label="Budget prévu" value={formatMoney(totalBudget)} tone="neutral" hint={totalBudget ? `${Math.round((expense / totalBudget) * 100)} % consommé` : "Définissez vos budgets"} />
          </div>
          <div className="grid gap-5 xl:grid-cols-3">
            <Card className="xl:col-span-2">
              <CardHeader title="Opérations du mois" />
              {!(txs ?? []).length ? (
                <EmptyState title="Aucune opération ce mois-ci" />
              ) : (
                <Table>
                  <thead><tr><TH>Date</TH><TH>Libellé</TH><TH>Catégorie</TH><TH className="text-right">Montant</TH><TH /></tr></thead>
                  <tbody>
                    {(txs ?? []).map((t) => (
                      <tr key={t.id}>
                        <TD className="text-fg-muted">{formatDate(t.occurred_on)}</TD>
                        <TD className="font-semibold">{t.label}</TD>
                        <TD className="text-fg-muted">{t.category_id ? catName.get(t.category_id) : "—"}</TD>
                        <TD className={`num text-right font-bold ${t.kind === "income" ? "text-success" : "text-danger"}`}>{t.kind === "income" ? "+" : "−"} {formatMoney(t.amount)}</TD>
                        <TD><ActionForm action={deleteTransaction}><input type="hidden" name="id" value={t.id} /><ConfirmSubmit message="Supprimer cette opération ?" variant="outline">Suppr.</ConfirmSubmit></ActionForm></TD>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </Card>
            <Card>
              <CardHeader title="Dépenses par catégorie" />
              <CardBody>
                {spentByCat.size ? <HorizontalBars data={[...spentByCat].map(([k, v]) => ({ name: k ? catName.get(k) ?? "—" : "Sans catégorie", revenue: v }))} /> : <p className="text-sm text-fg-muted">Aucune dépense.</p>}
              </CardBody>
            </Card>
            <Card className="xl:col-span-2">
              <CardHeader title="Budgets mensuels" description="Montant prévu par catégorie et consommation réelle." />
              <CardBody>
                <ActionForm action={setBudget} className="space-y-3">
                  <input type="hidden" name="month" value={m.start} />
                  {expenseCats.map((c) => {
                    const b = budgetMap.get(c.id) ?? 0;
                    const spent = spentByCat.get(c.id) ?? 0;
                    const pct = b > 0 ? Math.min(100, (spent / b) * 100) : 0;
                    return (
                      <div key={c.id} className="grid grid-cols-[1fr_120px] items-center gap-3 sm:grid-cols-[160px_1fr_130px]">
                        <span className="text-sm font-semibold">{c.name}</span>
                        <div className="order-3 col-span-2 sm:order-none sm:col-span-1">
                          <div className="h-2 overflow-hidden rounded-full bg-muted"><div className={`h-full ${spent > b && b > 0 ? "bg-danger" : "bg-accent"}`} style={{ width: `${pct}%` }} /></div>
                          <p className="mt-0.5 text-xs text-fg-muted">{formatMoney(spent)} dépensés{b > 0 ? ` sur ${formatMoney(b)}` : ""}</p>
                        </div>
                        <Input name={`b_${c.id}`} defaultValue={b || ""} inputMode="decimal" placeholder="Budget" className="h-9" aria-label={`Budget ${c.name}`} />
                      </div>
                    );
                  })}
                  <SubmitButton variant="outline">Enregistrer les budgets</SubmitButton>
                </ActionForm>
                <details className="mt-4 text-sm">
                  <summary className="cursor-pointer font-semibold text-primary">Ajouter une catégorie</summary>
                  <ActionForm action={addCategory} resetOnSuccess className="mt-2 flex flex-wrap gap-2">
                    <Input name="name" placeholder="Nom" required className="w-48" aria-label="Nom" />
                    <Select name="kind" className="w-36" aria-label="Type"><option value="expense">Dépense</option><option value="income">Revenu</option></Select>
                    <SubmitButton size="sm">Ajouter</SubmitButton>
                  </ActionForm>
                </details>
              </CardBody>
            </Card>
            <Card>
              <CardHeader title="Objectifs d'épargne" />
              <CardBody className="space-y-4">
                {(goals ?? []).map((g) => {
                  const pct = Math.min(100, (Number(g.saved_amount) / Number(g.target_amount)) * 100);
                  return (
                    <div key={g.id} className="rounded-xl border border-border p-3">
                      <div className="flex justify-between text-sm"><span className="font-bold">{g.name}</span><span className="num">{Math.round(pct)} %</span></div>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary" style={{ width: `${pct}%` }} /></div>
                      <p className="mt-1 text-xs text-fg-muted">{formatMoney(g.saved_amount)} / {formatMoney(g.target_amount)}{g.deadline ? ` · avant le ${formatDate(g.deadline)}` : ""}</p>
                      <div className="mt-2 flex gap-2">
                        <ActionForm action={contributeGoal} resetOnSuccess className="flex flex-1 gap-1.5">
                          <input type="hidden" name="id" value={g.id} />
                          <Input name="amount" inputMode="decimal" placeholder="+ montant" className="h-8 text-xs" aria-label="Montant épargné" />
                          <SubmitButton size="sm" variant="outline">OK</SubmitButton>
                        </ActionForm>
                        <ActionForm action={deleteGoal}><input type="hidden" name="id" value={g.id} /><ConfirmSubmit message="Supprimer cet objectif ?" variant="outline">×</ConfirmSubmit></ActionForm>
                      </div>
                    </div>
                  );
                })}
                <ActionForm action={addGoal} resetOnSuccess className="space-y-2 border-t border-border pt-3">
                  <Input name="name" placeholder="Ex. : Tabaski, scolarité…" required aria-label="Nom de l'objectif" />
                  <div className="grid grid-cols-2 gap-2">
                    <Input name="target" inputMode="decimal" placeholder="Montant cible" required aria-label="Montant cible" />
                    <Input name="deadline" type="date" aria-label="Échéance" />
                  </div>
                  <SubmitButton size="sm">Créer l&apos;objectif</SubmitButton>
                </ActionForm>
              </CardBody>
            </Card>
          </div>
        </>
      )}
      <p className="mt-6 text-xs text-fg-muted">Astuce : votre budget personnel vous suit quelle que soit l&apos;entreprise sélectionnée. <Link href="/aide" className="text-primary">En savoir plus</Link></p>
    </>
  );
}
