"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getAppContext } from "@/lib/context";
import { fail, friendlyError, success, type ActionState } from "@/lib/actions";
import { isUuid, nullable, parseAmount, str } from "@/lib/utils";

const money = (label: string) => z.number({ message: `${label} invalide` }).min(0, `${label} ne peut pas être négatif`).max(1_000_000_000);

function readProduct(fd: FormData) {
  return z
    .object({
      name: z.string().trim().min(1, "Le nom est obligatoire").max(200),
      sku: z.string().trim().max(60).nullable(),
      barcode: z.string().trim().max(60).nullable(),
      category_id: z.string().uuid().nullable(),
      supplier_id: z.string().uuid().nullable(),
      description: z.string().trim().max(2000).nullable(),
      unit: z.string().trim().min(1).max(30),
      sale_price: money("Prix de vente"),
      wholesale_price: money("Prix de gros").nullable(),
      purchase_price: money("Prix d'achat").nullable(),
      min_stock: z.number().min(0, "Seuil invalide").max(1_000_000),
      track_stock: z.boolean(),
      image_url: z.string().trim().url("URL d'image invalide").max(500).nullable(),
    })
    .safeParse({
      name: str(fd.get("name")),
      sku: nullable(fd.get("sku")),
      barcode: nullable(fd.get("barcode")),
      category_id: nullable(fd.get("category_id")),
      supplier_id: nullable(fd.get("supplier_id")),
      description: nullable(fd.get("description")),
      unit: str(fd.get("unit")) || "unité",
      sale_price: parseAmount(fd.get("sale_price")) ?? NaN,
      wholesale_price: parseAmount(fd.get("wholesale_price")),
      purchase_price: parseAmount(fd.get("purchase_price")),
      min_stock: parseAmount(fd.get("min_stock")) ?? 0,
      track_stock: fd.get("track_stock") === "on",
      image_url: nullable(fd.get("image_url")),
    });
}

export async function createProduct(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await getAppContext();
  if (!ctx.can("products.manage")) return fail("Permission refusée : gestion du catalogue.");
  const parsed = readProduct(fd);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const qty = parseAmount(fd.get("initial_qty"));
  if (qty != null && qty < 0) return fail("Quantité initiale invalide.");
  const location = str(fd.get("location_id"));
  if (qty && !ctx.locations.some((l) => l.id === location)) return fail("Choisissez l'établissement du stock initial.");
  const { purchase_price, ...rest } = parsed.data;
  const { data, error } = await ctx.supabase
    .from("products")
    .insert({ ...rest, organization_id: ctx.org.id, purchase_price: ctx.can("costs.view") ? purchase_price ?? 0 : 0 })
    .select("id")
    .single();
  if (error) return fail(friendlyError(error));

  if (qty && qty > 0 && parsed.data.track_stock) {
    const { error: e } = await ctx.supabase.rpc("adjust_stock", {
      p_org: ctx.org.id, p_product: data.id, p_location: location, p_type: "initial", p_quantity: qty,
      p_unit_cost: ctx.can("costs.view") ? purchase_price ?? 0 : null, p_reason: "Stock initial à la création",
    });
    if (e) return fail(`Produit créé, mais le stock initial n'a pas pu être enregistré : ${friendlyError(e)}`);
  }
  redirect(`/app/produits/${data.id}?cree=1`);
}

export async function updateProduct(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await getAppContext();
  const id = str(fd.get("id"));
  if (!isUuid(id)) return fail("Produit invalide.");
  const parsed = readProduct(fd);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const { purchase_price, sale_price, wholesale_price, ...rest } = parsed.data;
  const update: Record<string, unknown> = { ...rest };
  // Les champs sensibles ne sont envoyés que si l'utilisateur y a droit (la base vérifie aussi)
  if (ctx.can("prices.edit")) Object.assign(update, { sale_price, wholesale_price });
  if (ctx.can("costs.view") && purchase_price != null) update.purchase_price = purchase_price;
  const { error } = await ctx.supabase.from("products").update(update).eq("id", id).eq("organization_id", ctx.org.id);
  if (error) return fail(friendlyError(error));
  return success("Produit mis à jour.");
}

export async function setProductActive(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await getAppContext();
  const id = str(fd.get("id"));
  const active = fd.get("active") === "true";
  if (!isUuid(id)) return fail("Produit invalide.");
  const { error } = await ctx.supabase.from("products").update({ is_active: active }).eq("id", id).eq("organization_id", ctx.org.id);
  if (error) return fail(friendlyError(error));
  return success(active ? "Produit réactivé." : "Produit archivé : il n'apparaît plus à la caisse, son historique est conservé.");
}

export async function saveCategory(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await getAppContext();
  const name = str(fd.get("name"));
  const id = nullable(fd.get("id"));
  if (name.length < 1 || name.length > 80) return fail("Nom de catégorie invalide.");
  const q = id
    ? ctx.supabase.from("categories").update({ name }).eq("id", id).eq("organization_id", ctx.org.id)
    : ctx.supabase.from("categories").insert({ name, organization_id: ctx.org.id });
  const { error } = await q;
  if (error) return fail(friendlyError(error));
  return success(id ? "Catégorie renommée." : "Catégorie créée.");
}

export async function deleteCategory(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await getAppContext();
  const id = str(fd.get("id"));
  if (!isUuid(id)) return fail("Catégorie invalide.");
  const { error } = await ctx.supabase.from("categories").delete().eq("id", id).eq("organization_id", ctx.org.id);
  if (error) return fail(friendlyError(error));
  return success("Catégorie supprimée. Les produits concernés sont désormais « sans catégorie ».");
}

export interface ImportRow {
  name: string; sku?: string; barcode?: string; category?: string; unit?: string;
  purchase_price?: string; sale_price?: string; wholesale_price?: string; min_stock?: string; quantity?: string;
}

export async function importProductsAction(rows: ImportRow[], locationId: string): Promise<{ ok: boolean; message: string }> {
  const ctx = await getAppContext();
  if (!Array.isArray(rows) || rows.length === 0) return { ok: false, message: "Aucune ligne à importer." };
  if (rows.length > 5000) return { ok: false, message: "Import limité à 5 000 lignes par fichier." };
  if (!isUuid(locationId)) return { ok: false, message: "Établissement invalide." };
  const clean = rows.map((r) => ({
    name: String(r.name ?? "").trim().slice(0, 200),
    sku: String(r.sku ?? "").trim().slice(0, 60),
    barcode: String(r.barcode ?? "").trim().slice(0, 60),
    category: String(r.category ?? "").trim().slice(0, 80),
    unit: String(r.unit ?? "").trim().slice(0, 30),
    purchase_price: ctx.can("costs.view") ? String(parseAmount(r.purchase_price ?? "") ?? "") : "",
    sale_price: String(parseAmount(r.sale_price ?? "") ?? ""),
    wholesale_price: String(parseAmount(r.wholesale_price ?? "") ?? ""),
    min_stock: String(parseAmount(r.min_stock ?? "") ?? ""),
    quantity: String(parseAmount(r.quantity ?? "") ?? ""),
  }));
  const { data, error } = await ctx.supabase.rpc("import_products", { p_org: ctx.org.id, p_location: locationId, p_rows: clean });
  if (error) return { ok: false, message: friendlyError(error) };
  return { ok: true, message: `${data} produit(s) importé(s) avec succès.` };
}
