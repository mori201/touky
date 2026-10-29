import type { Metadata } from "next";
import Link from "next/link";
import { Alert, Badge, Card, CardBody, CardHeader, EmptyState, Input, PageHeader, Select, Table, TD, TH } from "@/components/ui";
import { SubmitButton } from "@/components/ui/client";
import { getAppContext } from "@/lib/context";
import { formatDate } from "@/lib/format";
import { StockTabs } from "../tabs";
import { createInventoryAction } from "../actions";

export const metadata: Metadata = { title: "Inventaires" };

export default async function InventoriesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const ctx = await getAppContext();
  let q = ctx.supabase.from("inventories").select("id, number, status, location_id, created_at, validated_at, note").eq("organization_id", ctx.org.id).order("created_at", { ascending: false }).limit(100);
  if (ctx.locationId) q = q.eq("location_id", ctx.locationId);
  const { data: inventories } = await q;
  const locName = new Map(ctx.locations.map((l) => [l.id, l.name]));

  return (
    <>
      <PageHeader title="Stock" description="Comparez le stock théorique au stock compté et régularisez les écarts." />
      <StockTabs active="/app/stock/inventaires" />
      {sp.erreur && <Alert tone="danger" className="mb-4">{sp.erreur}</Alert>}
      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <Card>
          {!inventories?.length ? (
            <EmptyState title="Aucun inventaire" description="Lancez un inventaire pour compter votre stock physique." />
          ) : (
            <Table>
              <thead><tr><TH>N°</TH><TH>Établissement</TH><TH>Créé le</TH><TH>Statut</TH></tr></thead>
              <tbody>
                {inventories.map((i) => (
                  <tr key={i.id}>
                    <TD><Link href={`/app/stock/inventaires/${i.id}`} className="font-bold text-primary">{i.number}</Link>{i.note && <p className="text-xs text-fg-muted">{i.note}</p>}</TD>
                    <TD>{locName.get(i.location_id) ?? "—"}</TD>
                    <TD className="text-fg-muted">{formatDate(i.created_at, true)}</TD>
                    <TD>{i.status === "validated" ? <Badge tone="success">Validé le {formatDate(i.validated_at)}</Badge> : <Badge tone="warning">Brouillon</Badge>}</TD>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
        {ctx.can("stock.inventory") && (
          <Card className="self-start">
            <CardHeader title="Nouvel inventaire" description="Le stock théorique de tous les produits suivis est figé comme point de départ." />
            <CardBody>
              <form action={createInventoryAction} className="space-y-3">
                <Select name="location_id" defaultValue={ctx.operationLocationId ?? ""} aria-label="Établissement">
                  {ctx.locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                </Select>
                <Input name="note" placeholder="Note (ex. : inventaire de fin de mois)" aria-label="Note" />
                <SubmitButton className="w-full" pendingText="Préparation…">Démarrer l&apos;inventaire</SubmitButton>
              </form>
            </CardBody>
          </Card>
        )}
      </div>
    </>
  );
}
