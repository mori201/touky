import type { Metadata } from "next";
import Link from "next/link";
import { Wallet } from "lucide-react";
import { Badge, ButtonLink, Card, EmptyState, Field, Input, PageHeader, Select, StatCard, Table, TD, TH } from "@/components/ui";
import { ActionForm, Modal, SubmitButton } from "@/components/ui/client";
import { PeriodFilter } from "@/components/period-filter";
import { getAppContext } from "@/lib/context";
import { getMemberNames } from "@/lib/queries";
import { resolvePeriod, toISODate } from "@/lib/period";
import { formatDate, formatMoney, todayISO } from "@/lib/format";
import { PAYMENT_METHODS, type PaymentMethod } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { cancelExpense, cancelIncome, createExpense, createIncome, saveExpenseCategory } from "./actions";

export const metadata: Metadata = { title: "Dépenses et recettes" };

export default async function ExpensesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const ctx = await getAppContext();
  if (!ctx.can("expenses.manage") && !ctx.can("reports.view")) {
    const { redirect } = await import("next/navigation");
    redirect("/app/acces-refuse?permission=expenses.manage");
  }
  const view = sp.vue === "recettes" ? "recettes" : "depenses";
  const range = resolvePeriod(sp.periode, sp.du, sp.au);
  const fromD = toISODate(range.from);
  const toD = toISODate(range.to);

  const table = view === "depenses" ? "expenses" : "other_incomes";
  const dateCol = view === "depenses" ? "expense_date" : "income_date";
  let q = ctx.supabase
    .from(table)
    .select(view === "depenses"
      ? "id, label, amount, expense_date, method, beneficiary, attachment_url, status, cancel_reason, location_id, created_by, category:expense_categories(name), account:treasury_accounts(name)"
      : "id, label, amount, income_date, method, status, location_id, created_by, account:treasury_accounts(name)")
    .eq("organization_id", ctx.org.id)
    .gte(dateCol, fromD)
    .lt(dateCol, toD)
    .order(dateCol, { ascending: false })
    .order("created_at", { ascending: false })
    .limit(500);
  if (ctx.locationId) q = q.eq("location_id", ctx.locationId);
  if (view === "depenses" && sp.categorie) q = q.eq("category_id", sp.categorie);

  const [{ data: rowsRaw }, { data: categories }, { data: accounts }, names] = await Promise.all([
    q,
    ctx.supabase.from("expense_categories").select("id, name").eq("organization_id", ctx.org.id).order("name"),
    ctx.supabase.from("treasury_accounts").select("id, name").eq("organization_id", ctx.org.id).is("archived_at", null).order("name"),
    getMemberNames(ctx),
  ]);
  const rows = (rowsRaw ?? []) as unknown as Record<string, unknown>[];
  const posted = rows.filter((r) => r.status === "posted");
  const total = posted.reduce((s, r) => s + Number(r.amount), 0);
  const byCat = new Map<string, number>();
  if (view === "depenses") for (const r of posted) {
    const n = (r.category as { name: string } | null)?.name ?? "Sans catégorie";
    byCat.set(n, (byCat.get(n) ?? 0) + Number(r.amount));
  }
  const canManage = ctx.can("expenses.manage");
  const locName = new Map(ctx.locations.map((l) => [l.id, l.name]));

  const formFields = (
    <>
      <Field label="Libellé" htmlFor="label" required className="sm:col-span-2"><Input id="label" name="label" required maxLength={200} /></Field>
      <Field label="Montant (F CFA)" htmlFor="amount" required><Input id="amount" name="amount" inputMode="decimal" required /></Field>
      <Field label="Date" htmlFor="date"><Input id="date" name="date" type="date" defaultValue={todayISO()} max={todayISO()} required /></Field>
      <Field label="Mode de paiement" htmlFor="method"><Select id="method" name="method">{Object.entries(PAYMENT_METHODS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
      <Field label="Compte de trésorerie" htmlFor="account_id"><Select id="account_id" name="account_id" defaultValue=""><option value="">Automatique (selon le mode)</option>{(accounts ?? []).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</Select></Field>
      <Field label="Établissement" htmlFor="location_id">
        <Select id="location_id" name="location_id" defaultValue={ctx.locationId ?? (ctx.restrictedTo ?? "")}>
          {!ctx.restrictedTo && <option value="">Entreprise (non rattachée)</option>}
          {ctx.locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </Select>
      </Field>
    </>
  );

  return (
    <>
      <PageHeader
        title="Dépenses et recettes"
        description={`${range.label} · les achats de marchandises sont suivis dans « Fournisseurs et achats ».`}
        actions={
          <>
            <PeriodFilter period={range.key} from={fromD} to={toISODate(new Date(range.to.getTime() - 86_400_000))} />
            {ctx.can("reports.export") && <ButtonLink href={`/api/export/${view}?du=${fromD}&au=${toD}`} variant="outline" prefetch={false}>Exporter</ButtonLink>}
            {canManage && view === "depenses" && (
              <Modal trigger="+ Dépense" title="Nouvelle dépense" wide>
                <ActionForm action={createExpense} resetOnSuccess className="grid gap-4 sm:grid-cols-2">
                  {formFields}
                  <Field label="Catégorie" htmlFor="category_id"><Select id="category_id" name="category_id">{(categories ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
                  <Field label="Bénéficiaire" htmlFor="beneficiary"><Input id="beneficiary" name="beneficiary" /></Field>
                  <Field label="Lien vers le justificatif" htmlFor="attachment_url" hint="Facultatif : lien vers une photo ou un document" className="sm:col-span-2"><Input id="attachment_url" name="attachment_url" type="url" /></Field>
                  <div className="sm:col-span-2"><SubmitButton>Enregistrer la dépense</SubmitButton></div>
                </ActionForm>
              </Modal>
            )}
            {canManage && view === "recettes" && (
              <Modal trigger="+ Recette" title="Nouvelle recette diverse" wide>
                <ActionForm action={createIncome} resetOnSuccess className="grid gap-4 sm:grid-cols-2">
                  {formFields}
                  <div className="sm:col-span-2"><SubmitButton>Enregistrer la recette</SubmitButton></div>
                </ActionForm>
              </Modal>
            )}
          </>
        }
      />
      <nav className="mb-4 flex gap-1 border-b border-border">
        {[["depenses", "Dépenses"], ["recettes", "Recettes diverses"]].map(([k, l]) => (
          <Link key={k} href={`/app/depenses?vue=${k}${sp.periode ? `&periode=${sp.periode}` : ""}`} className={cn("border-b-2 px-3 py-2 text-sm font-semibold", view === k ? "border-primary text-primary" : "border-transparent text-fg-muted")}>{l}</Link>
        ))}
      </nav>
      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <StatCard label={view === "depenses" ? "Total des dépenses" : "Total des recettes diverses"} value={formatMoney(total)} tone={view === "depenses" ? "danger" : "success"} icon={<Wallet size={18} />} hint={`${posted.length} opération(s)`} />
        {view === "depenses" && [...byCat].sort((a, b) => b[1] - a[1]).slice(0, 2).map(([n, v]) => <StatCard key={n} label={n} value={formatMoney(v)} tone="neutral" hint={total ? `${Math.round((v / total) * 100)} % des dépenses` : undefined} />)}
      </div>
      {view === "depenses" && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <form className="flex gap-2">
            <input type="hidden" name="vue" value="depenses" />
            {sp.periode && <input type="hidden" name="periode" value={sp.periode} />}
            <Select name="categorie" defaultValue={sp.categorie ?? ""} className="w-56" aria-label="Catégorie">
              <option value="">Toutes les catégories</option>
              {(categories ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
            <button className="rounded-lg bg-muted px-4 text-sm font-semibold">Filtrer</button>
          </form>
          {canManage && (
            <Modal trigger="Catégories" title="Ajouter une catégorie de dépense" triggerVariant="ghost" triggerSize="sm">
              <ActionForm action={saveExpenseCategory} resetOnSuccess className="flex gap-2">
                <Input name="name" required placeholder="Ex. : Carburant" aria-label="Nom" />
                <SubmitButton>Ajouter</SubmitButton>
              </ActionForm>
              <p className="mt-3 text-xs text-fg-muted">Existantes : {(categories ?? []).map((c) => c.name).join(", ")}</p>
            </Modal>
          )}
        </div>
      )}
      <Card>
        {rows.length === 0 ? (
          <EmptyState icon={<Wallet />} title={view === "depenses" ? "Aucune dépense sur la période" : "Aucune recette diverse sur la période"} description="Enregistrez toutes vos charges pour obtenir un bénéfice estimé fiable." />
        ) : (
          <Table>
            <thead><tr><TH>Date</TH><TH>Libellé</TH>{view === "depenses" && <TH>Catégorie</TH>}<TH>Paiement</TH>{ctx.locations.length > 1 && <TH>Établissement</TH>}<TH>Par</TH><TH className="text-right">Montant</TH>{canManage && <TH />}</tr></thead>
            <tbody>
              {rows.map((r) => {
                const cancelled = r.status === "cancelled";
                return (
                  <tr key={String(r.id)} className={cancelled ? "opacity-60" : ""}>
                    <TD className="whitespace-nowrap text-fg-muted">{formatDate(String(r[dateCol]))}</TD>
                    <TD>
                      <span className={cn("font-semibold", cancelled && "line-through")}>{String(r.label)}</span>
                      {typeof r.beneficiary === "string" && <p className="text-xs text-fg-muted">{r.beneficiary}</p>}
                      {typeof r.attachment_url === "string" && <a href={r.attachment_url} target="_blank" rel="noreferrer" className="text-xs text-primary">Justificatif</a>}
                      {cancelled && <p className="text-xs text-danger">Annulée{r.cancel_reason ? ` : ${r.cancel_reason}` : ""}</p>}
                    </TD>
                    {view === "depenses" && <TD className="text-fg-muted">{(r.category as { name: string } | null)?.name ?? "—"}</TD>}
                    <TD className="text-fg-muted">{PAYMENT_METHODS[r.method as PaymentMethod]} · {(r.account as { name: string } | null)?.name}</TD>
                    {ctx.locations.length > 1 && <TD className="text-fg-muted">{r.location_id ? locName.get(String(r.location_id)) : "Entreprise"}</TD>}
                    <TD className="text-fg-muted">{names.get(String(r.created_by)) ?? "—"}</TD>
                    <TD className="num text-right font-bold">{formatMoney(r.amount)}</TD>
                    {canManage && (
                      <TD>
                        {!cancelled ? (
                          <Modal trigger="Annuler" title="Annuler l'opération" triggerVariant="ghost" triggerSize="sm">
                            <ActionForm action={view === "depenses" ? cancelExpense : cancelIncome} className="space-y-3">
                              <input type="hidden" name="id" value={String(r.id)} />
                              <p className="text-sm">Une écriture inverse sera enregistrée sur le compte de trésorerie.</p>
                              <Input name="reason" placeholder="Motif" required aria-label="Motif" />
                              <SubmitButton variant="danger">Confirmer</SubmitButton>
                            </ActionForm>
                          </Modal>
                        ) : <Badge tone="danger">Annulée</Badge>}
                      </TD>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
