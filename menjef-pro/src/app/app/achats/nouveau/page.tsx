import type { Metadata } from "next";
import Link from "next/link";
import { Alert, ButtonLink, PageHeader } from "@/components/ui";
import { requirePermission } from "@/lib/context";
import { PurchaseOrderForm } from "./form";

export const metadata: Metadata = { title: "Nouveau bon de commande" };

export default async function NewPurchasePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const ctx = await requirePermission("purchases.manage");
  const [{ data: suppliers }, { data: products }, costs] = await Promise.all([
    ctx.supabase.from("suppliers").select("id, name").eq("organization_id", ctx.org.id).is("archived_at", null).order("name"),
    ctx.supabase.from("products").select("id, name, sku, unit, supplier_id").eq("organization_id", ctx.org.id).eq("is_active", true).order("name").limit(3000),
    ctx.can("costs.view") ? ctx.supabase.rpc("get_product_costs", { p_org: ctx.org.id }) : Promise.resolve({ data: null }),
  ]);
  const cost = new Map(((costs.data as { product_id: string; purchase_price: number }[] | null) ?? []).map((c) => [c.product_id, Number(c.purchase_price)]));
  return (
    <>
      <Link href="/app/achats" className="text-sm font-semibold text-fg-muted hover:text-fg">← Achats</Link>
      <PageHeader title="Nouveau bon de commande" description="Le stock sera mis à jour lors de la réception, pas à la commande." />
      {!suppliers?.length ? (
        <Alert tone="warning" title="Aucun fournisseur">
          Créez d&apos;abord un fournisseur. <ButtonLink href="/app/achats?vue=fournisseurs" size="sm" variant="outline" className="ml-2">Fournisseurs</ButtonLink>
        </Alert>
      ) : (
        <PurchaseOrderForm
          suppliers={suppliers}
          products={(products ?? []).map((p) => ({ ...p, cost: cost.get(p.id) ?? 0 }))}
          locations={ctx.locations.map((l) => ({ id: l.id, name: l.name }))}
          defaultLocation={ctx.operationLocationId ?? ""}
          defaultSupplier={sp.fournisseur ?? ""}
        />
      )}
    </>
  );
}
