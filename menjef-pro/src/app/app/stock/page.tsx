import type { Metadata } from "next";
import Link from "next/link";
import { Boxes } from "lucide-react";
import { Badge, ButtonLink, Card, EmptyState, Input, PageHeader, Select, StatCard, Table, TD, TH } from "@/components/ui";
import { getAppContext } from "@/lib/context";
import { formatMoney, formatQty } from "@/lib/format";
import { searchTerm } from "@/lib/utils";
import { StockTabs } from "./tabs";

export const metadata: Metadata = { title: "Stock" };

export default async function StockPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const ctx = await getAppContext();
  let pq = ctx.supabase
    .from("products")
    .select("id, name, sku, unit, min_stock, category:categories(name)")
    .eq("organization_id", ctx.org.id)
    .eq("is_active", true)
    .eq("track_stock", true)
    .order("name")
    .limit(3000);
  if (sp.q) {
    const s = searchTerm(sp.q);
    pq = pq.or(`name.ilike.%${s}%,sku.ilike.%${s}%,barcode.eq.${s}`);
  }
  let lq = ctx.supabase.from("stock_levels").select("product_id, location_id, quantity").eq("organization_id", ctx.org.id);
  if (ctx.locationId) lq = lq.eq("location_id", ctx.locationId);

  const [{ data: products }, { data: levels }, costs] = await Promise.all([
    pq,
    lq,
    ctx.can("costs.view") ? ctx.supabase.rpc("get_product_costs", { p_org: ctx.org.id }) : Promise.resolve({ data: null }),
  ]);
  const qty = new Map<string, number>();
  for (const l of levels ?? []) qty.set(l.product_id, (qty.get(l.product_id) ?? 0) + Number(l.quantity));
  const costMap = new Map(((costs.data as { product_id: string; avg_cost: number }[] | null) ?? []).map((c) => [c.product_id, Number(c.avg_cost)]));

  let rows = (products ?? []).map((p) => {
    const q = qty.get(p.id) ?? 0;
    const status = q <= 0 ? "rupture" : q <= Number(p.min_stock) ? "alerte" : "ok";
    return { ...p, q, status, value: costMap.has(p.id) ? Math.max(0, q) * (costMap.get(p.id) ?? 0) : null };
  });
  const counts = { rupture: rows.filter((r) => r.status === "rupture").length, alerte: rows.filter((r) => r.status === "alerte").length };
  const totalValue = rows.reduce((s, r) => s + (r.value ?? 0), 0);
  if (sp.filtre === "alerte") rows = rows.filter((r) => r.status !== "ok");
  if (sp.filtre === "rupture") rows = rows.filter((r) => r.status === "rupture");

  return (
    <>
      <PageHeader
        title="Stock"
        description={ctx.locationId ? ctx.locations.find((l) => l.id === ctx.locationId)?.name : "Tous les établissements (consolidé)"}
        actions={ctx.can("reports.export") && <ButtonLink href="/api/export/stock" variant="outline" prefetch={false}>Exporter</ButtonLink>}
      />
      <StockTabs active="/app/stock" />
      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <StatCard label="Produits suivis" value={String(products?.length ?? 0)} icon={<Boxes size={18} />} tone="neutral" />
        <StatCard label="Sous le seuil / en rupture" value={`${counts.alerte} / ${counts.rupture}`} tone={counts.rupture ? "danger" : "warning"} hint={<Link href="/app/stock?filtre=alerte" className="underline">Afficher</Link>} />
        {ctx.can("costs.view") && <StatCard label="Valeur du stock" value={formatMoney(totalValue)} tone="success" hint="Quantité × coût moyen pondéré" />}
      </div>
      <form className="mb-4 flex flex-wrap gap-2">
        <Input name="q" defaultValue={sp.q} placeholder="Rechercher un produit" className="w-64" aria-label="Rechercher" />
        <Select name="filtre" defaultValue={sp.filtre ?? ""} className="w-48" aria-label="Filtre">
          <option value="">Tous les produits</option>
          <option value="alerte">Sous le seuil d&apos;alerte</option>
          <option value="rupture">En rupture</option>
        </Select>
        <button className="rounded-lg bg-muted px-4 text-sm font-semibold">Filtrer</button>
      </form>
      <Card>
        {rows.length === 0 ? (
          <EmptyState icon={<Boxes />} title="Aucun produit" description="Aucun produit suivi en stock ne correspond." />
        ) : (
          <Table>
            <thead><tr><TH>Produit</TH><TH>Catégorie</TH><TH className="text-right">Quantité</TH><TH className="text-right">Seuil</TH>{ctx.can("costs.view") && <TH className="text-right">Valeur</TH>}<TH>État</TH></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-muted/40">
                  <TD><Link href={`/app/produits/${r.id}`} className="font-semibold hover:text-primary">{r.name}</Link><p className="text-xs text-fg-muted">{r.sku ?? ""}</p></TD>
                  <TD className="text-fg-muted">{(r.category as unknown as { name: string } | null)?.name ?? "—"}</TD>
                  <TD className="num text-right font-bold">{formatQty(r.q)} {r.unit}</TD>
                  <TD className="num text-right text-fg-muted">{formatQty(r.min_stock)}</TD>
                  {ctx.can("costs.view") && <TD className="num text-right">{formatMoney(r.value)}</TD>}
                  <TD>{r.status === "rupture" ? <Badge tone="danger">Rupture</Badge> : r.status === "alerte" ? <Badge tone="warning">Stock bas</Badge> : <Badge tone="success">OK</Badge>}</TD>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
