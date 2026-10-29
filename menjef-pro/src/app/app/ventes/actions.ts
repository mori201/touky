"use server";

import { getAppContext } from "@/lib/context";
import { fail, friendlyError, success, type ActionState } from "@/lib/actions";
import { isUuid, nullable, parseAmount, str } from "@/lib/utils";

export async function cancelSaleAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const id = str(fd.get("sale_id"));
  const reason = str(fd.get("reason"));
  if (!isUuid(id)) return fail("Vente invalide.");
  if (reason.length < 3) return fail("Indiquez le motif de l'annulation.");
  const ctx = await getAppContext();
  const { error } = await ctx.supabase.rpc("cancel_sale", { p_sale: id, p_reason: reason });
  if (error) return fail(friendlyError(error));
  return success("Vente annulée. Le stock et la caisse ont été corrigés par des mouvements inverses.");
}

export async function returnItemsAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const id = str(fd.get("sale_id"));
  if (!isUuid(id)) return fail("Vente invalide.");
  const items: { sale_item_id: string; quantity: number }[] = [];
  for (const [k, v] of fd.entries()) {
    if (!k.startsWith("qty_")) continue;
    const q = parseAmount(v);
    const itemId = k.slice(4);
    if (q && q > 0 && isUuid(itemId)) items.push({ sale_item_id: itemId, quantity: q });
  }
  if (items.length === 0) return fail("Indiquez au moins une quantité à retourner.");
  const ctx = await getAppContext();
  const { error } = await ctx.supabase.rpc("return_sale_items", {
    p_sale: id,
    p_items: items,
    p_refund_account: nullable(fd.get("account_id")),
    p_reason: str(fd.get("reason")),
  });
  if (error) return fail(friendlyError(error));
  return success("Retour enregistré : le stock est réintégré et le remboursement comptabilisé.");
}
