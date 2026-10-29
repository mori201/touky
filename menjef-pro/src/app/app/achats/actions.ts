"use server";

import { z } from "zod";
import { getAppContext } from "@/lib/context";
import { fail, friendlyError, success, type ActionState } from "@/lib/actions";
import { PAYMENT_METHOD_KEYS } from "@/lib/constants";
import { isUuid, nullable, parseAmount, str } from "@/lib/utils";

export async function saveSupplier(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await getAppContext();
  const parsed = z
    .object({
      name: z.string().trim().min(1, "Le nom est obligatoire").max(160),
      contact_name: z.string().trim().max(120).nullable(),
      phone: z.string().trim().max(40).nullable(),
      email: z.union([z.null(), z.string().trim().email("E-mail invalide")]),
      address: z.string().trim().max(300).nullable(),
      notes: z.string().trim().max(2000).nullable(),
    })
    .safeParse({
      name: str(fd.get("name")), contact_name: nullable(fd.get("contact_name")), phone: nullable(fd.get("phone")),
      email: nullable(fd.get("email")), address: nullable(fd.get("address")), notes: nullable(fd.get("notes")),
    });
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const id = nullable(fd.get("id"));
  const { error } = id
    ? await ctx.supabase.from("suppliers").update(parsed.data).eq("id", id).eq("organization_id", ctx.org.id)
    : await ctx.supabase.from("suppliers").insert({ ...parsed.data, organization_id: ctx.org.id });
  if (error) return fail(friendlyError(error));
  return success(id ? "Fournisseur mis à jour." : "Fournisseur créé.");
}

const poSchema = z.object({
  supplier_id: z.string().uuid("Choisissez un fournisseur"),
  location_id: z.string().uuid("Choisissez un établissement"),
  status: z.enum(["draft", "ordered"]),
  expected_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  invoice_ref: z.string().max(80).nullable(),
  note: z.string().max(1000).nullable(),
  items: z.array(z.object({ product_id: z.string().uuid(), quantity: z.number().positive(), unit_cost: z.number().min(0) })).min(1, "Ajoutez au moins un produit"),
});

export async function createPurchaseOrder(input: z.infer<typeof poSchema>): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const parsed = poSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const v = parsed.data;
  const ctx = await getAppContext();
  const { data, error } = await ctx.supabase.rpc("create_purchase_order", {
    p_org: ctx.org.id, p_location: v.location_id, p_supplier: v.supplier_id, p_items: v.items, p_status: v.status,
    p_expected_date: v.expected_date, p_note: v.note, p_invoice_ref: v.invoice_ref,
  });
  if (error) return { ok: false, error: friendlyError(error) };
  return { ok: true, id: data as string };
}

export async function setPurchaseStatus(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await getAppContext();
  const id = str(fd.get("id"));
  const status = str(fd.get("status"));
  if (!isUuid(id) || !["ordered", "cancelled"].includes(status)) return fail("Requête invalide.");
  const { error } = await ctx.supabase.rpc("set_purchase_status", { p_po: id, p_status: status });
  if (error) return fail(friendlyError(error));
  return success(status === "ordered" ? "Commande confirmée auprès du fournisseur." : "Commande annulée.");
}

export async function receivePurchase(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await getAppContext();
  const id = str(fd.get("id"));
  if (!isUuid(id)) return fail("Commande invalide.");
  const items: { item_id: string; quantity: number; unit_cost: number | null }[] = [];
  for (const [k, v] of fd.entries()) {
    if (!k.startsWith("qty_")) continue;
    const itemId = k.slice(4);
    const q = parseAmount(v);
    if (!isUuid(itemId) || !q) continue;
    if (q < 0) return fail("Quantité négative.");
    items.push({ item_id: itemId, quantity: q, unit_cost: parseAmount(fd.get(`cost_${itemId}`)) });
  }
  if (items.length === 0) return fail("Saisissez au moins une quantité reçue.");
  const { error } = await ctx.supabase.rpc("receive_purchase", { p_po: id, p_items: items, p_note: nullable(fd.get("note")) });
  if (error) return fail(friendlyError(error));
  return success("Réception enregistrée : le stock et le coût moyen ont été mis à jour.");
}

export async function returnToSupplier(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await getAppContext();
  const item = str(fd.get("item_id"));
  const qty = parseAmount(fd.get("quantity"));
  if (!isUuid(item) || !qty || qty <= 0) return fail("Quantité invalide.");
  const { error } = await ctx.supabase.rpc("return_to_supplier", { p_item: item, p_quantity: qty, p_reason: str(fd.get("reason")) });
  if (error) return fail(friendlyError(error));
  return success("Retour fournisseur enregistré : stock et dette réduits.");
}

export async function paySupplier(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await getAppContext();
  const supplier = str(fd.get("supplier_id"));
  const amount = parseAmount(fd.get("amount"));
  const method = str(fd.get("method"));
  if (!isUuid(supplier)) return fail("Fournisseur invalide.");
  if (!amount || amount <= 0) return fail("Le montant doit être supérieur à zéro.");
  if (!(PAYMENT_METHOD_KEYS as string[]).includes(method)) return fail("Mode de paiement invalide.");
  const { error } = await ctx.supabase.rpc("pay_supplier", {
    p_org: ctx.org.id, p_supplier: supplier, p_amount: amount, p_method: method, p_account: nullable(fd.get("account_id")),
    p_po: nullable(fd.get("purchase_order_id")), p_reference: nullable(fd.get("reference")), p_note: nullable(fd.get("note")),
  });
  if (error) return fail(friendlyError(error));
  return success("Paiement fournisseur enregistré.");
}
