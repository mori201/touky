import type { Metadata } from "next";
import { Card, EmptyState, PageHeader, Select, Table, TD, TH } from "@/components/ui";
import { requirePermission } from "@/lib/context";
import { getMemberNames } from "@/lib/queries";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Journal d'audit" };

const ENTITIES: Record<string, string> = {
  sales: "Ventes", products: "Produits", customers: "Clients", suppliers: "Fournisseurs", expenses: "Dépenses",
  other_incomes: "Recettes", cash_sessions: "Caisses", treasury_transfers: "Transferts", treasury_accounts: "Comptes",
  purchase_orders: "Achats", supplier_payments: "Paiements fournisseurs", customer_payments: "Remboursements clients",
  inventories: "Inventaires", stock_transfers: "Transferts de stock", organization_members: "Équipe", invitations: "Invitations",
  organizations: "Entreprise", locations: "Établissements", categories: "Catégories", expense_categories: "Catégories de dépenses",
};
const ACTIONS: Record<string, string> = { create: "Création", insert: "Création", update: "Modification", delete: "Suppression", cancel: "Annulation", return: "Retour", receive: "Réception", close: "Clôture", open: "Ouverture", correct: "Correction", validate: "Validation", invite: "Invitation", accept: "Acceptation", import: "Import", status: "Changement de statut" };

function summary(data: unknown): string {
  if (!data || typeof data !== "object") return "";
  const d = data as Record<string, unknown>;
  if (d.avant && d.apres) {
    const a = d.avant as Record<string, unknown>;
    const b = d.apres as Record<string, unknown>;
    const changed = Object.keys(b).filter((k) => !["updated_at", "created_at"].includes(k) && JSON.stringify(a[k]) !== JSON.stringify(b[k]));
    return changed.slice(0, 6).map((k) => `${k} : ${JSON.stringify(a[k])} → ${JSON.stringify(b[k])}`).join(" · ");
  }
  return Object.entries(d).filter(([k]) => !["id", "organization_id", "created_at", "updated_at"].includes(k)).slice(0, 5).map(([k, v]) => `${k} : ${typeof v === "object" ? JSON.stringify(v) : String(v)}`).join(" · ");
}

export default async function AuditPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const ctx = await requirePermission("audit.view");
  let q = ctx.supabase.from("audit_logs").select("id, user_id, action, entity, entity_id, data, created_at").eq("organization_id", ctx.org.id).order("id", { ascending: false }).limit(200);
  if (sp.entite && sp.entite in ENTITIES) q = q.eq("entity", sp.entite);
  const [{ data: logs }, names] = await Promise.all([q, getMemberNames(ctx)]);
  return (
    <>
      <PageHeader title="Journal d'audit" description="Historique des opérations sensibles, non modifiable. 200 dernières entrées." />
      <form className="mb-4 flex gap-2">
        <Select name="entite" defaultValue={sp.entite ?? ""} className="w-64" aria-label="Type d'élément">
          <option value="">Tous les éléments</option>
          {Object.entries(ENTITIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </Select>
        <button className="rounded-lg bg-muted px-4 text-sm font-semibold">Filtrer</button>
      </form>
      <Card>
        {!logs?.length ? (
          <EmptyState title="Aucune entrée" />
        ) : (
          <Table>
            <thead><tr><TH>Date</TH><TH>Utilisateur</TH><TH>Action</TH><TH>Élément</TH><TH>Détail</TH></tr></thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id}>
                  <TD className="whitespace-nowrap text-fg-muted">{formatDate(l.created_at, true)}</TD>
                  <TD>{l.user_id ? names.get(l.user_id) ?? "Ancien membre" : "Système"}</TD>
                  <TD className="font-semibold">{ACTIONS[l.action] ?? l.action}</TD>
                  <TD>{ENTITIES[l.entity] ?? l.entity}</TD>
                  <TD className="max-w-md truncate text-xs text-fg-muted" title={summary(l.data)}>{summary(l.data)}</TD>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
