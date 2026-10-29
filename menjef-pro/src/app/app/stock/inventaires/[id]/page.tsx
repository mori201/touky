import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Alert, Badge, Card, Input, PageHeader, Table, TD, TH } from "@/components/ui";
import { ActionForm, SubmitButton } from "@/components/ui/client";
import { getAppContext } from "@/lib/context";
import { formatDate, formatQty } from "@/lib/format";
import { isUuid } from "@/lib/utils";
import { saveInventoryCounts } from "../../actions";

export const metadata: Metadata = { title: "Inventaire" };

export default async function InventoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const ctx = await getAppContext();
  const { data: inv } = await ctx.supabase.from("inventories").select("*").eq("id", id).eq("organization_id", ctx.org.id).maybeSingle();
  if (!inv) notFound();
  const { data: lines } = await ctx.supabase.from("inventory_lines").select("product_id, theoretical_qty, counted_qty, product:products(name, sku, unit)").eq("inventory_id", id);
  const sorted = (lines ?? []).sort((a, b) => ((a.product as unknown as { name: string })?.name ?? "").localeCompare((b.product as unknown as { name: string })?.name ?? ""));
  const draft = inv.status === "draft";
  const editable = draft && ctx.can("stock.inventory");
  const counted = sorted.filter((l) => l.counted_qty != null);
  const gaps = counted.filter((l) => Number(l.counted_qty) !== Number(l.theoretical_qty));

  return (
    <>
      <Link href="/app/stock/inventaires" className="text-sm font-semibold text-fg-muted hover:text-fg">← Inventaires</Link>
      <PageHeader
        title={<span className="flex flex-wrap items-center gap-3">Inventaire {inv.number} {draft ? <Badge tone="warning">Brouillon</Badge> : <Badge tone="success">Validé</Badge>}</span>}
        description={`${ctx.locations.find((l) => l.id === inv.location_id)?.name ?? ""} · créé le ${formatDate(inv.created_at, true)} · ${counted.length}/${sorted.length} produit(s) comptés · ${gaps.length} écart(s)`}
      />
      {draft && (
        <Alert tone="primary" className="mb-4">
          Saisissez les quantités comptées (laissez vide un produit non compté : il ne sera pas ajusté). À la validation, l&apos;écart est calculé par rapport au stock <strong>au moment de la validation</strong>, pour tenir compte des ventes réalisées entre-temps.
        </Alert>
      )}
      <ActionForm action={saveInventoryCounts}>
        <input type="hidden" name="inventory_id" value={id} />
        <Card>
          <Table>
            <thead><tr><TH>Produit</TH><TH className="text-right">Théorique</TH><TH>Compté</TH><TH className="text-right">Écart</TH></tr></thead>
            <tbody>
              {sorted.map((l) => {
                const p = l.product as unknown as { name: string; sku: string | null; unit: string };
                const diff = l.counted_qty == null ? null : Number(l.counted_qty) - Number(l.theoretical_qty);
                return (
                  <tr key={l.product_id}>
                    <TD><span className="font-semibold">{p?.name}</span>{p?.sku && <p className="text-xs text-fg-muted">{p.sku}</p>}</TD>
                    <TD className="num text-right">{formatQty(l.theoretical_qty)} {p?.unit}</TD>
                    <TD>
                      {editable ? (
                        <Input name={`count_${l.product_id}`} defaultValue={l.counted_qty ?? ""} inputMode="decimal" className="h-9 w-28" aria-label={`Quantité comptée pour ${p?.name}`} />
                      ) : (
                        <span className="num">{l.counted_qty == null ? "—" : formatQty(l.counted_qty)}</span>
                      )}
                    </TD>
                    <TD className={`num text-right font-bold ${diff == null || diff === 0 ? "text-fg-muted" : diff < 0 ? "text-danger" : "text-success"}`}>{diff == null ? "—" : `${diff > 0 ? "+" : ""}${formatQty(diff)}`}</TD>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </Card>
        {editable && (
          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <SubmitButton variant="outline" name="validate" value="0">Enregistrer le brouillon</SubmitButton>
            <SubmitButton variant="accent" name="validate" value="1" pendingText="Validation…">Valider l&apos;inventaire</SubmitButton>
          </div>
        )}
      </ActionForm>
    </>
  );
}
