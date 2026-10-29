import { Field, Input, Select, Textarea } from "@/components/ui";
import { UNITS } from "@/lib/constants";

export interface ProductFormValues {
  id?: string;
  name?: string;
  sku?: string | null;
  barcode?: string | null;
  category_id?: string | null;
  supplier_id?: string | null;
  description?: string | null;
  unit?: string;
  sale_price?: number;
  wholesale_price?: number | null;
  purchase_price?: number | null;
  min_stock?: number;
  track_stock?: boolean;
  image_url?: string | null;
}

export function ProductFields({
  values = {},
  categories,
  suppliers,
  canCosts,
  canPrices,
}: {
  values?: ProductFormValues;
  categories: { id: string; name: string }[];
  suppliers: { id: string; name: string }[];
  canCosts: boolean;
  canPrices: boolean;
}) {
  const priceLocked = !!values.id && !canPrices;
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {values.id && <input type="hidden" name="id" value={values.id} />}
      <Field label="Nom du produit" htmlFor="name" required className="sm:col-span-2">
        <Input id="name" name="name" defaultValue={values.name} required maxLength={200} />
      </Field>
      <Field label="Référence interne" htmlFor="sku">
        <Input id="sku" name="sku" defaultValue={values.sku ?? ""} maxLength={60} />
      </Field>
      <Field label="Code-barres" htmlFor="barcode" hint="Scannez-le directement dans ce champ.">
        <Input id="barcode" name="barcode" defaultValue={values.barcode ?? ""} maxLength={60} />
      </Field>
      <Field label="Catégorie" htmlFor="category_id">
        <Select id="category_id" name="category_id" defaultValue={values.category_id ?? ""}>
          <option value="">Sans catégorie</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
      </Field>
      <Field label="Unité de mesure" htmlFor="unit">
        <Select id="unit" name="unit" defaultValue={values.unit ?? "unité"}>
          {Array.from(new Set([...(values.unit ? [values.unit] : []), ...UNITS])).map((u) => <option key={u} value={u}>{u}</option>)}
        </Select>
      </Field>
      <Field label="Prix de vente (F CFA)" htmlFor="sale_price" required hint={priceLocked ? "Modification réservée aux utilisateurs autorisés." : undefined}>
        <Input id="sale_price" name="sale_price" inputMode="decimal" defaultValue={values.sale_price ?? ""} required readOnly={priceLocked} />
      </Field>
      <Field label="Prix de gros (F CFA)" htmlFor="wholesale_price" hint="Facultatif">
        <Input id="wholesale_price" name="wholesale_price" inputMode="decimal" defaultValue={values.wholesale_price ?? ""} readOnly={priceLocked} />
      </Field>
      {canCosts && (
        <Field label="Prix d'achat (F CFA)" htmlFor="purchase_price" hint="Sert au calcul de la marge. Mis à jour à chaque réception fournisseur.">
          <Input id="purchase_price" name="purchase_price" inputMode="decimal" defaultValue={values.purchase_price ?? ""} />
        </Field>
      )}
      <Field label="Stock minimum (seuil d'alerte)" htmlFor="min_stock">
        <Input id="min_stock" name="min_stock" inputMode="decimal" defaultValue={values.min_stock ?? 0} />
      </Field>
      <Field label="Fournisseur principal" htmlFor="supplier_id">
        <Select id="supplier_id" name="supplier_id" defaultValue={values.supplier_id ?? ""}>
          <option value="">—</option>
          {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </Select>
      </Field>
      <Field label="Image (URL)" htmlFor="image_url" hint="Facultatif">
        <Input id="image_url" name="image_url" type="url" defaultValue={values.image_url ?? ""} placeholder="https://…" />
      </Field>
      <Field label="Description" htmlFor="description" className="sm:col-span-2">
        <Textarea id="description" name="description" defaultValue={values.description ?? ""} maxLength={2000} />
      </Field>
      <label className="flex items-center gap-2 text-sm font-medium sm:col-span-2">
        <input type="checkbox" name="track_stock" defaultChecked={values.track_stock ?? true} className="h-4 w-4" />
        Suivre le stock de ce produit (décochez pour un service ou un plat préparé à la demande)
      </label>
    </div>
  );
}
