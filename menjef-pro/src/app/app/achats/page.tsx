import type { Metadata } from "next";
import Link from "next/link";
import { Truck } from "lucide-react";
import { Badge, ButtonLink, Card, EmptyState, PageHeader, Select, StatCard, Table, TD, TH } from "@/components/ui";
import { ActionForm, Modal, SubmitButton } from "@/components/ui/client";
import { getAppContext } from "@/lib/context";
import { formatDate, formatMoney } from "@/lib/format";
import { PURCHASE_STATUS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { SupplierFields } from "./supplier-fields";
import { saveSupplier } from "./actions";

export const metadata: Metadata = { title: "Fournisseurs et achats" };

const STATUS_TONE = { draft: "neutral", ordered: "primary", partially_received: "warning", received: "success", cancelled: "danger" } as const;

export default async function PurchasesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const ctx = await getAppContext();
  const canPurchases = ctx.can("purchases.manage") || ctx.can("treasury.manage");
  const view = sp.vue === "fournisseurs" || !canPurchases ? "fournisseurs" : "commandes";

  const [{ data: suppliers }, { data: balances }, poRes] = await Promise.all([
    ctx.supabase.from("suppliers").select("id, name, phone, contact_name").eq("organization_id", ctx.org.id).is("archived_at", null).order("name"),
    ctx.supabase.from("supplier_balances").select("supplier_id, total_received, total_paid, balance_due, open_orders").eq("organization_id", ctx.org.id),
    canPurchases
      ? (() => {
          let q = ctx.supabase.from("purchase_orders").select("id, number, status, created_at, expected_date, ordered_total, received_total, returned_total, paid_total, supplier:suppliers(name)").eq("organization_id", ctx.org.id).order("created_at", { ascending: false }).limit(200);
          if (ctx.locationId) q = q.eq("location_id", ctx.locationId);
          if (sp.statut && sp.statut in PURCHASE_STATUS) q = q.eq("status", sp.statut);
          return q;
        })()
      : Promise.resolve({ data: [] as never[] }),
  ]);
  const bal = new Map((balances ?? []).map((b) => [b.supplier_id, b]));
  const totalDebt = (balances ?? []).reduce((s, b) => s + Number(b.balance_due), 0);
  const openOrders = (balances ?? []).reduce((s, b) => s + Number(b.open_orders), 0);

  return (
    <>
      <PageHeader
        title="Fournisseurs et achats"
        description="Le stock n'augmente qu'à la réception validée des marchandises."
        actions={
          <>
            {ctx.can("suppliers.manage") && (
              <Modal trigger="+ Fournisseur" title="Nouveau fournisseur" triggerVariant="outline">
                <ActionForm action={saveSupplier} resetOnSuccess className="space-y-4">
                  <SupplierFields />
                  <SubmitButton>Créer</SubmitButton>
                </ActionForm>
              </Modal>
            )}
            {ctx.can("purchases.manage") && <ButtonLink href="/app/achats/nouveau">+ Bon de commande</ButtonLink>}
          </>
        }
      />
      {canPurchases && (
        <div className="mb-5 grid gap-3 sm:grid-cols-3">
          <StatCard label="Dettes fournisseurs" value={formatMoney(totalDebt)} tone="danger" icon={<Truck size={18} />} hint="Reçu − retours − payé" />
          <StatCard label="Commandes en cours" value={String(openOrders)} tone="primary" />
          <StatCard label="Fournisseurs actifs" value={String(suppliers?.length ?? 0)} tone="neutral" />
        </div>
      )}
      <nav className="mb-4 flex gap-1 border-b border-border">
        {canPurchases && <Link href="/app/achats" className={cn("border-b-2 px-3 py-2 text-sm font-semibold", view === "commandes" ? "border-primary text-primary" : "border-transparent text-fg-muted")}>Bons de commande</Link>}
        <Link href="/app/achats?vue=fournisseurs" className={cn("border-b-2 px-3 py-2 text-sm font-semibold", view === "fournisseurs" ? "border-primary text-primary" : "border-transparent text-fg-muted")}>Fournisseurs</Link>
      </nav>

      {view === "commandes" ? (
        <>
          <form className="mb-4 flex gap-2">
            <Select name="statut" defaultValue={sp.statut ?? ""} className="w-56" aria-label="Statut">
              <option value="">Tous les statuts</option>
              {Object.entries(PURCHASE_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Select>
            <button className="rounded-lg bg-muted px-4 text-sm font-semibold">Filtrer</button>
          </form>
          <Card>
            {!poRes.data?.length ? (
              <EmptyState icon={<Truck />} title="Aucun bon de commande" action={ctx.can("purchases.manage") ? <ButtonLink href="/app/achats/nouveau">Créer un bon de commande</ButtonLink> : undefined} />
            ) : (
              <Table>
                <thead><tr><TH>N°</TH><TH>Fournisseur</TH><TH>Date</TH><TH className="text-right">Commandé</TH><TH className="text-right">Reçu</TH><TH className="text-right">Reste à payer</TH><TH>Statut</TH></tr></thead>
                <tbody>
                  {poRes.data.map((po) => {
                    const due = Number(po.received_total) - Number(po.returned_total) - Number(po.paid_total);
                    return (
                      <tr key={po.id} className="hover:bg-muted/40">
                        <TD><Link href={`/app/achats/${po.id}`} className="font-bold text-primary">{po.number}</Link></TD>
                        <TD>{(po.supplier as unknown as { name: string } | null)?.name}</TD>
                        <TD className="text-fg-muted">{formatDate(po.created_at)}{po.expected_date && <p className="text-xs">Prévu {formatDate(po.expected_date)}</p>}</TD>
                        <TD className="num text-right">{formatMoney(po.ordered_total)}</TD>
                        <TD className="num text-right">{formatMoney(po.received_total)}</TD>
                        <TD className="num text-right font-semibold">{due > 0 ? formatMoney(due) : "—"}</TD>
                        <TD><Badge tone={STATUS_TONE[po.status as keyof typeof STATUS_TONE]}>{PURCHASE_STATUS[po.status as keyof typeof PURCHASE_STATUS]}</Badge></TD>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            )}
          </Card>
        </>
      ) : (
        <Card>
          {!suppliers?.length ? (
            <EmptyState icon={<Truck />} title="Aucun fournisseur" description="Ajoutez vos fournisseurs pour suivre vos achats et vos dettes." />
          ) : (
            <Table>
              <thead><tr><TH>Fournisseur</TH><TH>Contact</TH>{canPurchases && <><TH className="text-right">Total reçu</TH><TH className="text-right">Payé</TH><TH className="text-right">Solde dû</TH></>}</tr></thead>
              <tbody>
                {suppliers.map((s) => {
                  const b = bal.get(s.id);
                  return (
                    <tr key={s.id} className="hover:bg-muted/40">
                      <TD><Link href={`/app/achats/fournisseurs/${s.id}`} className="font-semibold hover:text-primary">{s.name}</Link></TD>
                      <TD className="text-fg-muted">{[s.contact_name, s.phone].filter(Boolean).join(" · ") || "—"}</TD>
                      {canPurchases && (
                        <>
                          <TD className="num text-right">{formatMoney(b?.total_received ?? 0)}</TD>
                          <TD className="num text-right">{formatMoney(b?.total_paid ?? 0)}</TD>
                          <TD className="num text-right font-bold">{Number(b?.balance_due ?? 0) > 0 ? <span className="text-danger">{formatMoney(b?.balance_due)}</span> : "—"}</TD>
                        </>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          )}
        </Card>
      )}
    </>
  );
}
