import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardHeader, EmptyState, Input, PageHeader } from "@/components/ui";
import { getAppContext } from "@/lib/context";
import { formatDate, formatMoney } from "@/lib/format";
import { searchTerm } from "@/lib/utils";

export const metadata: Metadata = { title: "Recherche" };

export default async function SearchPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const ctx = await getAppContext();
  const s = searchTerm(sp.q);
  const has = s.length >= 2;
  const [products, customers, sales, suppliers] = has
    ? await Promise.all([
        ctx.supabase.from("products").select("id, name, sku, sale_price").eq("organization_id", ctx.org.id).or(`name.ilike.%${s}%,sku.ilike.%${s}%,barcode.eq.${s}`).limit(10),
        ctx.can("credits.view") || ctx.can("sales.create") ? ctx.supabase.from("customers").select("id, name, phone").eq("organization_id", ctx.org.id).or(`name.ilike.%${s}%,phone.ilike.%${s}%`).limit(10) : Promise.resolve({ data: [] as never[] }),
        ctx.can("sales.view") ? ctx.supabase.from("sales").select("id, number, total, created_at").eq("organization_id", ctx.org.id).ilike("number", `%${s}%`).limit(10) : Promise.resolve({ data: [] as never[] }),
        ctx.supabase.from("suppliers").select("id, name").eq("organization_id", ctx.org.id).ilike("name", `%${s}%`).limit(10),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }, { data: [] }];
  const total = (products.data?.length ?? 0) + (customers.data?.length ?? 0) + (sales.data?.length ?? 0) + (suppliers.data?.length ?? 0);

  return (
    <>
      <PageHeader title="Recherche" />
      <form className="mb-5" role="search">
        <Input name="q" defaultValue={sp.q} placeholder="Produit, client, n° de vente, fournisseur…" autoFocus className="h-12 text-base" aria-label="Recherche" />
      </form>
      {!has ? (
        <p className="text-sm text-fg-muted">Saisissez au moins deux caractères.</p>
      ) : total === 0 ? (
        <Card><EmptyState title="Aucun résultat" description={`Rien ne correspond à « ${s} ».`} /></Card>
      ) : (
        <div className="grid gap-5 md:grid-cols-2">
          {!!products.data?.length && (
            <Card><CardHeader title="Produits" /><ul className="divide-y divide-border">{products.data.map((p) => <li key={p.id}><Link href={`/app/produits/${p.id}`} className="flex justify-between px-5 py-3 hover:bg-muted/50"><span className="font-semibold">{p.name} <span className="text-xs text-fg-muted">{p.sku}</span></span><span className="num">{formatMoney(p.sale_price)}</span></Link></li>)}</ul></Card>
          )}
          {!!customers.data?.length && (
            <Card><CardHeader title="Clients" /><ul className="divide-y divide-border">{customers.data.map((c) => <li key={c.id}><Link href={`/app/clients/${c.id}`} className="flex justify-between px-5 py-3 hover:bg-muted/50"><span className="font-semibold">{c.name}</span><span className="text-fg-muted">{c.phone}</span></Link></li>)}</ul></Card>
          )}
          {!!sales.data?.length && (
            <Card><CardHeader title="Ventes" /><ul className="divide-y divide-border">{sales.data.map((v) => <li key={v.id}><Link href={`/app/ventes/${v.id}`} className="flex justify-between px-5 py-3 hover:bg-muted/50"><span className="font-semibold">{v.number} <span className="text-xs text-fg-muted">{formatDate(v.created_at)}</span></span><span className="num">{formatMoney(v.total)}</span></Link></li>)}</ul></Card>
          )}
          {!!suppliers.data?.length && (
            <Card><CardHeader title="Fournisseurs" /><ul className="divide-y divide-border">{suppliers.data.map((f) => <li key={f.id}><Link href={`/app/achats/fournisseurs/${f.id}`} className="block px-5 py-3 font-semibold hover:bg-muted/50">{f.name}</Link></li>)}</ul></Card>
          )}
        </div>
      )}
    </>
  );
}
