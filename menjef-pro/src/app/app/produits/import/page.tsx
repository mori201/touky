import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { requirePermission } from "@/lib/context";
import { CsvImporter } from "./importer";

export const metadata: Metadata = { title: "Importer un catalogue" };

export default async function ImportPage() {
  const ctx = await requirePermission("products.manage");
  const [{ data: existing }] = await Promise.all([
    ctx.supabase.from("products").select("sku, barcode").eq("organization_id", ctx.org.id).limit(20000),
  ]);
  return (
    <>
      <Link href="/app/produits" className="text-sm font-semibold text-fg-muted hover:text-fg">← Catalogue</Link>
      <PageHeader title="Importer un catalogue CSV" description="Vérifiez l'aperçu avant de confirmer : si une seule ligne est invalide, rien n'est importé." />
      <CsvImporter
        locations={ctx.locations.map((l) => ({ id: l.id, name: l.name }))}
        defaultLocation={ctx.operationLocationId ?? ""}
        existingSkus={(existing ?? []).map((e) => e.sku?.toLowerCase()).filter(Boolean) as string[]}
        existingBarcodes={(existing ?? []).map((e) => e.barcode).filter(Boolean) as string[]}
        canCosts={ctx.can("costs.view")}
        canStock={ctx.can("stock.manage")}
      />
    </>
  );
}
