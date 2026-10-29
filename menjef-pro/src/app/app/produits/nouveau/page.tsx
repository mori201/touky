import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardBody, Field, Input, PageHeader, Select } from "@/components/ui";
import { ActionForm, SubmitButton } from "@/components/ui/client";
import { requirePermission } from "@/lib/context";
import { ProductFields } from "../product-form";
import { createProduct } from "../actions";

export const metadata: Metadata = { title: "Nouveau produit" };

export default async function NewProductPage() {
  const ctx = await requirePermission("products.manage");
  const [{ data: categories }, { data: suppliers }] = await Promise.all([
    ctx.supabase.from("categories").select("id, name").eq("organization_id", ctx.org.id).order("name"),
    ctx.supabase.from("suppliers").select("id, name").eq("organization_id", ctx.org.id).is("archived_at", null).order("name"),
  ]);
  return (
    <>
      <Link href="/app/produits" className="text-sm font-semibold text-fg-muted hover:text-fg">← Catalogue</Link>
      <PageHeader title="Nouveau produit" description="Seuls le nom et le prix de vente sont obligatoires." />
      <Card>
        <CardBody>
          <ActionForm action={createProduct} className="space-y-6">
            <ProductFields categories={categories ?? []} suppliers={suppliers ?? []} canCosts={ctx.can("costs.view")} canPrices />
            {ctx.can("stock.manage") && (
              <div className="grid gap-4 rounded-xl border border-border bg-muted/40 p-4 sm:grid-cols-2">
                <Field label="Quantité en stock au départ" htmlFor="initial_qty" hint="Enregistrée comme mouvement « Stock initial ».">
                  <Input id="initial_qty" name="initial_qty" inputMode="decimal" placeholder="0" />
                </Field>
                <Field label="Établissement" htmlFor="location_id">
                  <Select id="location_id" name="location_id" defaultValue={ctx.operationLocationId ?? ""}>
                    {ctx.locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </Select>
                </Field>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <SubmitButton>Créer le produit</SubmitButton>
            </div>
          </ActionForm>
        </CardBody>
      </Card>
    </>
  );
}
