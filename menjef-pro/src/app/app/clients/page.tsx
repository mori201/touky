import type { Metadata } from "next";
import Link from "next/link";
import { Users } from "lucide-react";
import { Badge, ButtonLink, Card, EmptyState, Input, PageHeader, Select, StatCard, Table, TD, TH } from "@/components/ui";
import { ActionForm, Modal, SubmitButton } from "@/components/ui/client";
import { requirePermission } from "@/lib/context";
import { formatDate, formatMoney } from "@/lib/format";
import { searchTerm } from "@/lib/utils";
import { CustomerFields } from "./customer-fields";
import { saveCustomer } from "./actions";

export const metadata: Metadata = { title: "Clients et crédits" };

export default async function CustomersPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const ctx = await requirePermission("credits.view");
  let q = ctx.supabase.from("customers").select("id, name, phone, credit_limit, archived_at").eq("organization_id", ctx.org.id).order("name").limit(1000);
  q = sp.statut === "archive" ? q.not("archived_at", "is", null) : q.is("archived_at", null);
  if (sp.q) {
    const s = searchTerm(sp.q);
    q = q.or(`name.ilike.%${s}%,phone.ilike.%${s}%`);
  }
  const [{ data: customers }, { data: balances }] = await Promise.all([
    q,
    ctx.supabase.from("customer_balances").select("customer_id, total_sales, balance_due, overdue, next_due_date, last_sale_at").eq("organization_id", ctx.org.id),
  ]);
  const bal = new Map((balances ?? []).map((b) => [b.customer_id, b]));
  let rows = (customers ?? []).map((c) => ({ ...c, b: bal.get(c.id) }));
  if (sp.filtre === "debiteurs") rows = rows.filter((r) => Number(r.b?.balance_due ?? 0) > 0);
  if (sp.filtre === "retard") rows = rows.filter((r) => Number(r.b?.overdue ?? 0) > 0);
  if (sp.filtre) rows.sort((a, b) => Number(b.b?.balance_due ?? 0) - Number(a.b?.balance_due ?? 0));
  const totalDue = (balances ?? []).reduce((s, b) => s + Number(b.balance_due), 0);
  const totalOverdue = (balances ?? []).reduce((s, b) => s + Number(b.overdue), 0);
  const debtors = (balances ?? []).filter((b) => Number(b.balance_due) > 0).length;

  return (
    <>
      <PageHeader
        title="Clients et crédits"
        description="Suivez ce que vos clients vous doivent et enregistrez leurs remboursements."
        actions={
          <>
            {ctx.can("reports.export") && <ButtonLink href="/api/export/clients" variant="outline" prefetch={false}>Exporter</ButtonLink>}
            {(ctx.can("sales.create") || ctx.can("payments.record")) && (
              <Modal trigger="+ Nouveau client" title="Nouveau client">
                <ActionForm action={saveCustomer} resetOnSuccess className="space-y-4">
                  <CustomerFields />
                  <SubmitButton>Créer le client</SubmitButton>
                </ActionForm>
              </Modal>
            )}
          </>
        }
      />
      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <StatCard label="Créances totales" value={formatMoney(totalDue)} tone="warning" hint={`${debtors} client(s) débiteur(s)`} />
        <StatCard label="Dont en retard" value={formatMoney(totalOverdue)} tone="danger" hint={<Link href="/app/clients?filtre=retard" className="underline">Voir les retards</Link>} />
        <StatCard label="Clients" value={String((balances ?? []).length)} icon={<Users size={18} />} tone="neutral" />
      </div>
      <form className="mb-4 flex flex-wrap gap-2">
        <Input name="q" defaultValue={sp.q} placeholder="Nom ou téléphone" className="w-60" aria-label="Rechercher" />
        <Select name="filtre" defaultValue={sp.filtre ?? ""} className="w-48" aria-label="Filtre">
          <option value="">Tous les clients</option>
          <option value="debiteurs">Avec solde dû</option>
          <option value="retard">En retard</option>
        </Select>
        <Select name="statut" defaultValue={sp.statut ?? ""} className="w-36" aria-label="Statut">
          <option value="">Actifs</option>
          <option value="archive">Archivés</option>
        </Select>
        <button className="rounded-lg bg-muted px-4 text-sm font-semibold">Filtrer</button>
      </form>
      <Card>
        {rows.length === 0 ? (
          <EmptyState icon={<Users />} title="Aucun client" description="Les clients peuvent aussi être créés directement depuis la caisse." />
        ) : (
          <Table>
            <thead><tr><TH>Client</TH><TH className="text-right">Total des achats</TH><TH className="text-right">Solde dû</TH><TH>Prochaine échéance</TH><TH>Dernier achat</TH></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-muted/40">
                  <TD><Link href={`/app/clients/${r.id}`} className="font-semibold hover:text-primary">{r.name}</Link><p className="text-xs text-fg-muted">{r.phone ?? ""}</p></TD>
                  <TD className="num text-right">{formatMoney(r.b?.total_sales ?? 0)}</TD>
                  <TD className="num text-right">
                    {Number(r.b?.balance_due ?? 0) > 0 ? <span className="font-bold text-warning">{formatMoney(r.b?.balance_due)}</span> : "—"}
                    {Number(r.b?.overdue ?? 0) > 0 && <Badge tone="danger" className="ml-2">Retard</Badge>}
                    {r.credit_limit != null && <p className="text-xs text-fg-muted">Plafond {formatMoney(r.credit_limit)}</p>}
                  </TD>
                  <TD className="text-fg-muted">{r.b?.next_due_date ? formatDate(r.b.next_due_date) : "—"}</TD>
                  <TD className="text-fg-muted">{r.b?.last_sale_at ? formatDate(r.b.last_sale_at) : "—"}</TD>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
