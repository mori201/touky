import type { Metadata } from "next";
import Link from "next/link";
import { Package } from "lucide-react";
import { Badge, ButtonLink, Card, EmptyState, Input, PageHeader, Select, Table, TD, TH } from "@/components/ui";
import { getAppContext } from "@/lib/context";
import { formatMoney, formatQty } from "@/lib/format";
import { searchTerm } from "@/lib/utils";

export const metadata: Metadata = { title: "Catalogue" };
const PAGE = 50;

export default async function ProductsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const ctx = await getAppContext();
  const page = Math.max(1, Number(sp.page) || 1);
  const sort = sp.tri === "prix" ? "sale_price" : sp.tri === "recent" ? "created_at" : "name";

  let q = ctx.supabase
    .from("products")
    .select("id, name, sku, barcode, unit, sale_price, wholesale_price, min_stock, track_stock, is_active, category:categories(name)", { count: "exact" })
    .eq("organization_id", ctx.org.id)
    .eq("is_active", sp.statut !== "archive")
    .order(sort, { ascending: sort === "name" })
    .range((page - 1) * PAGE, page * PAGE - 1);
  if (sp.q) {
    const s = searchTerm(sp.q);
    q = q.or(`name.ilike.%${s}%,sku.ilike.%${s}%,barcode.eq.${s}`);
  }
  if (sp.categorie) q = q.eq("category_id", sp.categorie);

  const [{ data: products, count }, { data: categories }] = await Promise.all([
    q,
    ctx.supabase.from("categories").select("id, name").eq("organization_id", ctx.org.id).order("name"),
  ]);
  const ids = (products ?? []).map((p) => p.id);
  let lq = ctx.supabase.from("stock_levels").select("product_id, quantity").in("product_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
  if (ctx.locationId) lq = lq.eq("location_id", ctx.locationId);
  const { data: levels } = await lq;
  const stock = new Map<string, number>();
  for (const l of levels ?? []) stock.set(l.product_id, (stock.get(l.product_id) ?? 0) + Number(l.quantity));

  let rows = products ?? [];
  if (sp.dispo === "rupture") rows = rows.filter((p) => p.track_stock && (stock.get(p.id) ?? 0) <= 0);
  if (sp.dispo === "alerte") rows = rows.filter((p) => p.track_stock && (stock.get(p.id) ?? 0) <= Number(p.min_stock));
  const pages = Math.ceil((count ?? 0) / PAGE);
  const qs = (p: number) => {
    const params = new URLSearchParams(Object.entries(sp).filter(([, v]) => v) as [string, string][]);
    params.set("page", String(p));
    return `?${params}`;
  };

  return (
    <>
      <PageHeader
        title="Catalogue et produits"
        description={`${count ?? 0} produit(s) ${sp.statut === "archive" ? "archivé(s)" : "actif(s)"}`}
        actions={
          ctx.can("products.manage") && (
            <>
              <ButtonLink href="/app/produits/categories" variant="outline">Catégories</ButtonLink>
              <ButtonLink href="/app/produits/import" variant="outline">Importer CSV</ButtonLink>
              {ctx.can("reports.export") && <ButtonLink href="/api/export/produits" variant="outline" prefetch={false}>Exporter</ButtonLink>}
              <ButtonLink href="/app/produits/nouveau">+ Nouveau produit</ButtonLink>
            </>
          )
        }
      />
      <form className="mb-4 flex flex-wrap gap-2">
        <Input name="q" defaultValue={sp.q} placeholder="Nom, référence ou code-barres" className="w-64" aria-label="Rechercher" />
        <Select name="categorie" defaultValue={sp.categorie ?? ""} className="w-48" aria-label="Catégorie">
          <option value="">Toutes les catégories</option>
          {(categories ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
        <Select name="dispo" defaultValue={sp.dispo ?? ""} className="w-44" aria-label="Disponibilité">
          <option value="">Toute disponibilité</option>
          <option value="alerte">Sous le seuil</option>
          <option value="rupture">En rupture</option>
        </Select>
        <Select name="tri" defaultValue={sp.tri ?? ""} className="w-40" aria-label="Tri">
          <option value="">Tri par nom</option>
          <option value="prix">Prix décroissant</option>
          <option value="recent">Plus récents</option>
        </Select>
        <Select name="statut" defaultValue={sp.statut ?? ""} className="w-36" aria-label="Statut">
          <option value="">Actifs</option>
          <option value="archive">Archivés</option>
        </Select>
        <button className="rounded-lg bg-muted px-4 text-sm font-semibold">Filtrer</button>
      </form>
      <Card>
        {rows.length === 0 ? (
          <EmptyState
            icon={<Package />}
            title={sp.q || sp.categorie || sp.dispo ? "Aucun produit trouvé" : "Votre catalogue est vide"}
            description="Ajoutez vos produits un par un ou importez un fichier CSV."
            action={ctx.can("products.manage") ? <ButtonLink href="/app/produits/nouveau">Ajouter un produit</ButtonLink> : undefined}
          />
        ) : (
          <Table>
            <thead><tr><TH>Produit</TH><TH>Catégorie</TH><TH className="text-right">Prix de vente</TH><TH className="text-right">Stock{ctx.locationId ? "" : " (total)"}</TH><TH>État</TH></tr></thead>
            <tbody>
              {rows.map((p) => {
                const qty = stock.get(p.id) ?? 0;
                return (
                  <tr key={p.id} className="hover:bg-muted/40">
                    <TD>
                      <Link href={`/app/produits/${p.id}`} className="font-semibold hover:text-primary">{p.name}</Link>
                      <p className="text-xs text-fg-muted">{[p.sku, p.barcode].filter(Boolean).join(" · ") || "—"}</p>
                    </TD>
                    <TD className="text-fg-muted">{(p.category as unknown as { name: string } | null)?.name ?? "—"}</TD>
                    <TD className="num text-right font-semibold">
                      {formatMoney(p.sale_price)}
                      {p.wholesale_price != null && <p className="text-xs font-normal text-fg-muted">Gros : {formatMoney(p.wholesale_price)}</p>}
                    </TD>
                    <TD className="num text-right">{p.track_stock ? `${formatQty(qty)} ${p.unit}` : <span className="text-fg-muted">Non suivi</span>}</TD>
                    <TD>
                      {!p.track_stock ? <Badge>Service</Badge> : qty <= 0 ? <Badge tone="danger">Rupture</Badge> : qty <= Number(p.min_stock) ? <Badge tone="warning">Stock bas</Badge> : <Badge tone="success">Disponible</Badge>}
                    </TD>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>
      {pages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2 text-sm">
          {page > 1 && <Link href={qs(page - 1)} className="rounded-lg border border-border px-3 py-1.5">← Précédent</Link>}
          <span className="text-fg-muted">Page {page} / {pages}</span>
          {page < pages && <Link href={qs(page + 1)} className="rounded-lg border border-border px-3 py-1.5">Suivant →</Link>}
        </div>
      )}
    </>
  );
}
