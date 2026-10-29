"use server";

import { getAppContext } from "@/lib/context";
import { fail, friendlyError, success, type ActionState } from "@/lib/actions";
import { PAYMENT_METHOD_KEYS } from "@/lib/constants";
import { isUuid, nullable, parseAmount, str } from "@/lib/utils";

function common(fd: FormData) {
  const amount = parseAmount(fd.get("amount"));
  const method = str(fd.get("method"));
  const date = str(fd.get("date"));
  const label = str(fd.get("label"));
  if (!label) return { error: "Le libellé est obligatoire." };
  if (!amount || amount <= 0) return { error: "Le montant doit être supérieur à zéro." };
  if (!(PAYMENT_METHOD_KEYS as string[]).includes(method)) return { error: "Mode de paiement invalide." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: "Date invalide." };
  return { amount, method, date, label };
}

export async function createExpense(_: ActionState, fd: FormData): Promise<ActionState> {
  const v = common(fd);
  if ("error" in v) return fail(v.error!);
  const ctx = await getAppContext();
  const { error } = await ctx.supabase.rpc("create_expense", {
    p_org: ctx.org.id, p_location: nullable(fd.get("location_id")), p_category: nullable(fd.get("category_id")),
    p_label: v.label, p_amount: v.amount, p_date: v.date, p_method: v.method, p_account: nullable(fd.get("account_id")),
    p_beneficiary: nullable(fd.get("beneficiary")), p_attachment_url: nullable(fd.get("attachment_url")),
  });
  if (error) return fail(friendlyError(error));
  return success("Dépense enregistrée et déduite du compte de trésorerie.");
}

export async function cancelExpense(_: ActionState, fd: FormData): Promise<ActionState> {
  const id = str(fd.get("id"));
  if (!isUuid(id)) return fail("Dépense invalide.");
  const ctx = await getAppContext();
  const { error } = await ctx.supabase.rpc("cancel_expense", { p_expense: id, p_reason: str(fd.get("reason")) });
  if (error) return fail(friendlyError(error));
  return success("Dépense annulée : le montant a été recrédité sur le compte.");
}

export async function createIncome(_: ActionState, fd: FormData): Promise<ActionState> {
  const v = common(fd);
  if ("error" in v) return fail(v.error!);
  const ctx = await getAppContext();
  const { error } = await ctx.supabase.rpc("create_other_income", {
    p_org: ctx.org.id, p_location: nullable(fd.get("location_id")), p_label: v.label, p_amount: v.amount,
    p_date: v.date, p_method: v.method, p_account: nullable(fd.get("account_id")),
  });
  if (error) return fail(friendlyError(error));
  return success("Recette enregistrée.");
}

export async function cancelIncome(_: ActionState, fd: FormData): Promise<ActionState> {
  const id = str(fd.get("id"));
  if (!isUuid(id)) return fail("Recette invalide.");
  const ctx = await getAppContext();
  const { error } = await ctx.supabase.rpc("cancel_other_income", { p_income: id, p_reason: str(fd.get("reason")) });
  if (error) return fail(friendlyError(error));
  return success("Recette annulée.");
}

export async function saveExpenseCategory(_: ActionState, fd: FormData): Promise<ActionState> {
  const name = str(fd.get("name"));
  if (!name || name.length > 80) return fail("Nom invalide.");
  const ctx = await getAppContext();
  const { error } = await ctx.supabase.from("expense_categories").insert({ organization_id: ctx.org.id, name });
  if (error) return fail(friendlyError(error));
  return success("Catégorie ajoutée.");
}
