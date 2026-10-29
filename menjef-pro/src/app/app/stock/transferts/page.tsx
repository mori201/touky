import type { Metadata } from "next";
import { Alert, Card, CardBody, CardHeader, EmptyState, Field, Input, PageHeader, Select, Table, TD, TH } from "@/components/ui";
import { ActionForm, SubmitButton } from "@/components/ui/client";
import { getAppContext } from "@/lib/context";
import { formatDate, formatQty } from "@/lib/format";
import { StockTabs } from "../tabs";
import { transferStockAction } from "../actions";

export const metadata: Metadata = { title: "Transferts de stock" };

export default async function TransfersPage() {
  const ctx = await getAppContext();
  const [{ data: transfers }, { data: products }] = await Promise.all([
    ctx.supabase.from("stock_transfers").select("id, number, from_location_id, to_location_id, note, created_at, items:stock_transfer_items(quantity, product:products(name))").eq("organization_id", ctx.org.id).order("created_at", { ascending: false }).limit(50),
    ctx.supabase.from("products").select("id, name").eq("organization_id", ctx.org.id).eq("is_active", true).eq("track_stock", true).order("name").limit(3000),
  ]);
  const locName = new Map(ctx.locations.map((l) => [l.id, l.name]));
  const canTransfer = ctx.can("stock.manage") && ctx.locations.length > 1;

  return (
    <>
      <PageHeader title="Stock" description="Déplacez de la marchandise d'un établissement à un autre." />
      <StockTabs active="/app/stock/transferts" />
      <div className="grid gap-5 lg:grid-cols-[1fr_420px]">
        <Card>
          <CardHeader title="Historique des transferts" />
          {!transfers?.length ? (
            <EmptyState title="Aucun transfert" />
          ) : (
            <Table>
              <thead><tr><TH>N°</TH><TH>Date</TH><TH>De → Vers</TH><TH>Produits</TH></tr></thead>
              <tbody>
                {transfers.map((t) => (
                  <tr key={t.id}>
                    <TD className="font-bold">{t.number}</TD>
                    <TD className="text-fg-muted">{formatDate(t.created_at, true)}</TD>
                    <TD>{locName.get(t.from_location_id) ?? "—"} → {locName.get(t.to_location_id) ?? "—"}</TD>
                    <TD className="text-sm">
                      {(t.items as unknown as { quantity: number; product: { name: string } }[]).map((i, k) => <p key={k}>{formatQty(i.quantity)} × {i.product?.name}</p>)}
                      {t.note && <p className="text-xs text-fg-muted">{t.note}</p>}
                    </TD>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
        <Card className="self-start">
          <CardHeader title="Nouveau transfert" />
          <CardBody>
            {!canTransfer ? (
              <Alert tone="neutral">{ctx.locations.length < 2 ? "Il faut au moins deux établissements pour transférer du stock." : "Permission « Gérer les stocks » requise."}</Alert>
            ) : (
              <ActionForm action={transferStockAction} resetOnSuccess className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <Field label="De" htmlFor="from"><Select id="from" name="from">{ctx.locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</Select></Field>
                  <Field label="Vers" htmlFor="to"><Select id="to" name="to" defaultValue={ctx.locations[1]?.id}>{ctx.locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</Select></Field>
                </div>
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="grid grid-cols-[1fr_90px] gap-2">
                    <Select name={`product_${i}`} defaultValue="" aria-label={`Produit ${i + 1}`}>
                      <option value="">— Produit —</option>
                      {(products ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </Select>
                    <Input name={`qty_${i}`} inputMode="decimal" placeholder="Qté" aria-label={`Quantité ${i + 1}`} />
                  </div>
                ))}
                <Input name="note" placeholder="Note (facultatif)" aria-label="Note" />
                <SubmitButton className="w-full">Transférer</SubmitButton>
              </ActionForm>
            )}
          </CardBody>
        </Card>
      </div>
    </>
  );
}
