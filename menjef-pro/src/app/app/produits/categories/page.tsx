import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardBody, CardHeader, EmptyState, Input, PageHeader } from "@/components/ui";
import { ActionForm, ConfirmSubmit, SubmitButton } from "@/components/ui/client";
import { requirePermission } from "@/lib/context";
import { deleteCategory, saveCategory } from "../actions";

export const metadata: Metadata = { title: "Catégories" };

export default async function CategoriesPage() {
  const ctx = await requirePermission("products.manage");
  const [{ data: categories }, { data: counts }] = await Promise.all([
    ctx.supabase.from("categories").select("id, name").eq("organization_id", ctx.org.id).order("name"),
    ctx.supabase.from("products").select("category_id").eq("organization_id", ctx.org.id).eq("is_active", true),
  ]);
  const n = new Map<string, number>();
  for (const p of counts ?? []) if (p.category_id) n.set(p.category_id, (n.get(p.category_id) ?? 0) + 1);

  return (
    <>
      <Link href="/app/produits" className="text-sm font-semibold text-fg-muted hover:text-fg">← Catalogue</Link>
      <PageHeader title="Catégories de produits" description="Elles organisent la caisse et les rapports de ventes." />
      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <Card>
          {(categories ?? []).length === 0 ? (
            <EmptyState title="Aucune catégorie" description="Créez vos premières catégories : Boissons, Épicerie, Hygiène…" />
          ) : (
            <ul className="divide-y divide-border">
              {(categories ?? []).map((c) => (
                <li key={c.id} className="flex flex-wrap items-center gap-2 px-5 py-3">
                  <ActionForm action={saveCategory} className="flex flex-1 items-center gap-2">
                    <input type="hidden" name="id" value={c.id} />
                    <Input name="name" defaultValue={c.name} className="h-9 max-w-xs" aria-label="Nom de la catégorie" />
                    <SubmitButton size="sm" variant="outline">Renommer</SubmitButton>
                    <span className="text-xs text-fg-muted">{n.get(c.id) ?? 0} produit(s)</span>
                  </ActionForm>
                  <ActionForm action={deleteCategory}>
                    <input type="hidden" name="id" value={c.id} />
                    <ConfirmSubmit message={`Supprimer la catégorie « ${c.name} » ? Les produits ne sont pas supprimés.`}>Supprimer</ConfirmSubmit>
                  </ActionForm>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card className="self-start">
          <CardHeader title="Nouvelle catégorie" />
          <CardBody>
            <ActionForm action={saveCategory} resetOnSuccess className="space-y-3">
              <Input name="name" placeholder="Ex. : Boissons" required maxLength={80} aria-label="Nom" />
              <SubmitButton className="w-full">Créer</SubmitButton>
            </ActionForm>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
