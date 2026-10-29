import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Alert, Badge, Card, CardBody, CardHeader, Field, Input, Select, Table, TD, TH } from "@/components/ui";
import { ActionForm, Modal, SubmitButton } from "@/components/ui/client";
import { getAppContext } from "@/lib/context";
import { getMemberNames } from "@/lib/queries";
import { formatDate, formatMoney, formatQty } from "@/lib/format";
import { STOCK_MOVEMENT_TYPES } from "@/lib/constants";
import { isUuid } from "@/lib/utils";
import { ProductFields } from "../product-form";
import { setProductActive, updateProduct } from "../actions";
import { adjustStockAction } from "../../stock/actions";

export const metadata: Metadata = { title: "Fiche produit" };

export default async function ProductPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { id } = await params;
  const sp = await searchParams;
  if (!isUuid(id)) notFound();
  const ctx = await getAppContext();
  const { data: product } = await ctx.supabase
    .from("products")
    .select("id, name, sku, barcode, category_id, supplier_id, description, unit, sale_price, wholesale_price, min_stock, track_stock, image_url, is_active, created_at, updated_at")
    .eq("id", id)
    .eq("organization_id", ctx.org.id)
    .maybeSingle();
  if (!product) notFound();

  let mq = ctx.supabase
    .from("stock_movements")
    .select("id, type, quantity, balance_after, reason, reference_type, reference_id, location_id, created_by, created_at")
    .eq("product_id", id)
    .order("id", { ascending: false })
    .limit(50);
  if (ctx.locationId) mq = mq.eq("location_id", ctx.locationId);

  const [{ data: categories }, { data: suppliers }, { data: levels }, { data: movements }, costs, names] = await Promise.all([
    ctx.supabase.from("categories").select("id, name").eq("organization_id", ctx.org.id).order("name"),
    ctx.supabase.from("suppliers").select("id, name").eq("organization_id", ctx.org.id).is("archived_at", null).order("name"),
    ctx.supabase.from("stock_levels").select("location_id, quantity").eq("product_id", id),
    mq,
    ctx.can("costs.view") ? ctx.supabase.rpc("get_product_costs", { p_org: ctx.org.id }) : Promise.resolve({ data: null }),
    getMemberNames(ctx),
  ]);
  const cost = ((costs.data as { product_id: string; purchase_price: number; avg_cost: number }[] | null) ?? []).find((c) => c.product_id === id);
  const locName = new Map(ctx.locations.map((l) => [l.id, l.name]));
  const levelMap = new Map((levels ?? []).map((l) => [l.location_id, Number(l.quantity)]));
  const total = [...levelMap.values()].reduce((a, b) => a + b, 0);
  const margin = cost && Number(product.sale_price) > 0 ? ((Number(product.sale_price) - Number(cost.avg_cost)) / Number(product.sale_price)) * 100 : null;

  return (
    <>
      <Link href="/app/produits" className="text-sm font-semibold text-fg-muted hover:text-fg">← Catalogue</Link>
      <div className="mb-6 mt-1 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex flex-wrap items-center gap-3 font-display text-3xl font-extrabold">
            {product.name}
            {!product.is_active && <Badge tone="danger">Archivé</Badge>}
          </h1>
          <p className="mt-1 text-sm text-fg-muted">Créé le {formatDate(product.created_at)} · modifié le {formatDate(product.updated_at, true)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {ctx.can("stock.manage") && product.track_stock && (
            <Modal trigger="Ajuster le stock" title="Mouvement de stock" triggerVariant="outline">
              <ActionForm action={adjustStockAction} className="space-y-4">
                <input type="hidden" name="product_id" value={id} />
                <Field label="Établissement" htmlFor="location_id">
                  <Select id="location_id" name="location_id" defaultValue={ctx.operationLocationId ?? ""}>
                    {ctx.locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </Select>
                </Field>
                <Field label="Type de mouvement" htmlFor="type">
                  <Select id="type" name="type" defaultValue="loss">
                    <option value="initial">Entrée (stock initial / réapprovisionnement hors achat)</option>
                    <option value="loss">Perte, casse ou produit périmé (sortie)</option>
                    <option value="correction">Correction documentée (+ ou −)</option>
                  </Select>
                </Field>
                <Field label="Quantité" htmlFor="quantity" hint="Pour une correction, saisissez une valeur négative pour retirer du stock.">
                  <Input id="quantity" name="quantity" inputMode="decimal" required />
                </Field>
                {ctx.can("costs.view") && (
                  <Field label="Coût unitaire (entrées)" htmlFor="unit_cost" hint="Par défaut : prix d'achat du produit.">
                    <Input id="unit_cost" name="unit_cost" inputMode="decimal" />
                  </Field>
                )}
                <Field label="Motif" htmlFor="reason" hint="Obligatoire pour une perte ou une correction.">
                  <Input id="reason" name="reason" />
                </Field>
                <SubmitButton>Enregistrer le mouvement</SubmitButton>
              </ActionForm>
            </Modal>
          )}
          {ctx.can("products.manage") && (
            <ActionForm action={setProductActive}>
              <input type="hidden" name="id" value={id} />
              <input type="hidden" name="active" value={String(!product.is_active)} />
              <SubmitButton variant={product.is_active ? "outline" : "accent"}>{product.is_active ? "Archiver" : "Réactiver"}</SubmitButton>
            </ActionForm>
          )}
        </div>
      </div>

      {sp.cree && <Alert tone="success" className="mb-5">Produit créé avec succès.</Alert>}

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Informations" />
          <CardBody>
            {ctx.can("products.manage") ? (
              <ActionForm action={updateProduct} className="space-y-5">
                <ProductFields
                  values={{ ...product, sale_price: Number(product.sale_price), wholesale_price: product.wholesale_price == null ? null : Number(product.wholesale_price), min_stock: Number(product.min_stock), purchase_price: cost ? Number(cost.purchase_price) : null }}
                  categories={categories ?? []}
                  suppliers={suppliers ?? []}
                  canCosts={ctx.can("costs.view")}
                  canPrices={ctx.can("prices.edit")}
                />
                <div className="flex justify-end"><SubmitButton>Enregistrer les modifications</SubmitButton></div>
              </ActionForm>
            ) : (
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <div><dt className="text-fg-muted">Prix de vente</dt><dd className="font-bold">{formatMoney(product.sale_price)}</dd></div>
                <div><dt className="text-fg-muted">Prix de gros</dt><dd className="font-bold">{product.wholesale_price != null ? formatMoney(product.wholesale_price) : "—"}</dd></div>
                <div><dt className="text-fg-muted">Référence</dt><dd>{product.sku ?? "—"}</dd></div>
                <div><dt className="text-fg-muted">Code-barres</dt><dd>{product.barcode ?? "—"}</dd></div>
                <div className="sm:col-span-2"><dt className="text-fg-muted">Description</dt><dd>{product.description ?? "—"}</dd></div>
              </dl>
            )}
          </CardBody>
        </Card>

        <div className="space-y-5">
          <Card>
            <CardHeader title="Stock par établissement" />
            <CardBody className="space-y-2 text-sm">
              {!product.track_stock ? (
                <p className="text-fg-muted">Le stock de ce produit n&apos;est pas suivi.</p>
              ) : (
                <>
                  {ctx.locations.map((l) => {
                    const q = levelMap.get(l.id) ?? 0;
                    return (
                      <div key={l.id} className="flex justify-between">
                        <span>{l.name}</span>
                        <span className={`num font-bold ${q <= 0 ? "text-danger" : q <= Number(product.min_stock) ? "text-warning" : ""}`}>{formatQty(q)} {product.unit}</span>
                      </div>
                    );
                  })}
                  {ctx.locations.length > 1 && <div className="flex justify-between border-t border-border pt-2 font-bold"><span>Total</span><span className="num">{formatQty(total)}</span></div>}
                  <p className="text-xs text-fg-muted">Seuil d&apos;alerte : {formatQty(product.min_stock)}</p>
                </>
              )}
            </CardBody>
          </Card>
          {cost && (
            <Card>
              <CardHeader title="Coûts et marge" />
              <CardBody className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-fg-muted">Dernier prix d&apos;achat</span><span className="num font-semibold">{formatMoney(cost.purchase_price)}</span></div>
                <div className="flex justify-between"><span className="text-fg-muted">Coût moyen pondéré</span><span className="num font-semibold">{formatMoney(cost.avg_cost)}</span></div>
                <div className="flex justify-between"><span className="text-fg-muted">Marge unitaire</span><span className="num font-semibold">{formatMoney(Number(product.sale_price) - Number(cost.avg_cost))}</span></div>
                {margin != null && <div className="flex justify-between"><span className="text-fg-muted">Taux de marge</span><span className={`num font-bold ${margin < 0 ? "text-danger" : "text-success"}`}>{margin.toFixed(1).replace(".", ",")} %</span></div>}
              </CardBody>
            </Card>
          )}
        </div>
      </div>

      <Card className="mt-5">
        <CardHeader title="Historique des mouvements" description="50 derniers mouvements — aucun mouvement n'est jamais supprimé." />
        {(movements ?? []).length === 0 ? (
          <CardBody><p className="text-sm text-fg-muted">Aucun mouvement.</p></CardBody>
        ) : (
          <Table>
            <thead><tr><TH>Date</TH><TH>Type</TH>{ctx.locations.length > 1 && <TH>Établissement</TH>}<TH className="text-right">Quantité</TH><TH className="text-right">Stock après</TH><TH>Motif / référence</TH><TH>Par</TH></tr></thead>
            <tbody>
              {(movements ?? []).map((m) => (
                <tr key={m.id}>
                  <TD className="whitespace-nowrap text-fg-muted">{formatDate(m.created_at, true)}</TD>
                  <TD>{STOCK_MOVEMENT_TYPES[m.type as keyof typeof STOCK_MOVEMENT_TYPES]}</TD>
                  {ctx.locations.length > 1 && <TD className="text-fg-muted">{locName.get(m.location_id) ?? "—"}</TD>}
                  <TD className={`num text-right font-bold ${Number(m.quantity) < 0 ? "text-danger" : "text-success"}`}>{Number(m.quantity) > 0 ? "+" : ""}{formatQty(m.quantity)}</TD>
                  <TD className="num text-right">{formatQty(m.balance_after)}</TD>
                  <TD className="text-fg-muted">
                    {m.reference_type === "sale" && m.reference_id ? <Link href={`/app/ventes/${m.reference_id}`} className="text-primary">{m.reason}</Link>
                      : m.reference_type === "purchase" && m.reference_id ? <Link href={`/app/achats/${m.reference_id}`} className="text-primary">{m.reason}</Link>
                      : m.reason ?? "—"}
                  </TD>
                  <TD className="text-fg-muted">{names.get(m.created_by ?? "") ?? "—"}</TD>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
