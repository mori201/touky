"use server";

import { redirect } from "next/navigation";
import { getAppContext } from "@/lib/context";
import { fail, friendlyError, success, type ActionState } from "@/lib/actions";
import { isUuid, nullable, parseAmount, str } from "@/lib/utils";

export async function adjustStockAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await getAppContext();
  const product = str(fd.get("product_id"));
  const location = str(fd.get("location_id"));
  const type = str(fd.get("type"));
  const qty = parseAmount(fd.get("quantity"));
  if (!isUuid(product) || !isUuid(location)) return fail("Produit ou établissement invalide.");
  if (!["initial", "loss", "correction"].includes(type)) return fail("Type de mouvement invalide.");
  if (qty == null || qty === 0) return fail("Indiquez une quantité différente de zéro.");
  const cost = parseAmount(fd.get("unit_cost"));
  const { error } = await ctx.supabase.rpc("adjust_stock", {
    p_org: ctx.org.id, p_product: product, p_location: location, p_type: type, p_quantity: qty,
    p_unit_cost: cost != null && ctx.can("costs.view") ? cost : null, p_reason: nullable(fd.get("reason")),
  });
  if (error) return fail(friendlyError(error));
  return success("Mouvement de stock enregistré.");
}

export async function transferStockAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await getAppContext();
  const from = str(fd.get("from"));
  const to = str(fd.get("to"));
  const items: { product_id: string; quantity: number }[] = [];
  for (let i = 0; i < 20; i++) {
    const p = str(fd.get(`product_${i}`));
    const q = parseAmount(fd.get(`qty_${i}`));
    if (isUuid(p) && q && q > 0) items.push({ product_id: p, quantity: q });
  }
  if (items.length === 0) return fail("Ajoutez au moins un produit avec une quantité.");
  const { error } = await ctx.supabase.rpc("transfer_stock", { p_org: ctx.org.id, p_from: from, p_to: to, p_items: items, p_note: nullable(fd.get("note")) });
  if (error) return fail(friendlyError(error));
  return success(`Transfert de ${items.length} produit(s) enregistré.`);
}

export async function createInventoryAction(fd: FormData) {
  const ctx = await getAppContext();
  const location = str(fd.get("location_id"));
  const { data, error } = await ctx.supabase.rpc("create_inventory", { p_org: ctx.org.id, p_location: location, p_note: nullable(fd.get("note")) });
  if (error) redirect(`/app/stock/inventaires?erreur=${encodeURIComponent(friendlyError(error))}`);
  redirect(`/app/stock/inventaires/${data}`);
}

export async function saveInventoryCounts(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await getAppContext();
  const id = str(fd.get("inventory_id"));
  if (!isUuid(id)) return fail("Inventaire invalide.");
  const counts: { product_id: string; counted: number | null }[] = [];
  for (const [k, v] of fd.entries()) {
    if (!k.startsWith("count_")) continue;
    const pid = k.slice(6);
    if (!isUuid(pid)) continue;
    const n = parseAmount(v);
    if (n != null && n < 0) return fail("Une quantité comptée ne peut pas être négative.");
    counts.push({ product_id: pid, counted: n });
  }
  const { error } = await ctx.supabase.rpc("set_inventory_counts", { p_inventory: id, p_counts: counts });
  if (error) return fail(friendlyError(error));
  if (fd.get("validate") === "1") {
    const { data, error: e } = await ctx.supabase.rpc("validate_inventory", { p_inventory: id });
    if (e) return fail(friendlyError(e));
    return success(`Inventaire validé : ${data} ajustement(s) de stock enregistré(s).`);
  }
  return success("Comptage enregistré (brouillon).");
}
