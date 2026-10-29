"use server";

import { getAppContext } from "@/lib/context";
import { fail, friendlyError, success, type ActionState } from "@/lib/actions";
import { ACCOUNT_KINDS, PAYMENT_METHOD_KEYS } from "@/lib/constants";
import { isUuid, nullable, parseAmount, str } from "@/lib/utils";

export async function createAccount(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await getAppContext();
  const name = str(fd.get("name"));
  const kind = str(fd.get("kind"));
  const method = nullable(fd.get("method"));
  if (!name) return fail("Le nom est obligatoire.");
  if (!(kind in ACCOUNT_KINDS)) return fail("Type de compte invalide.");
  if (method && !(PAYMENT_METHOD_KEYS as string[]).includes(method)) return fail("Mode de paiement invalide.");
  const { error } = await ctx.supabase.rpc("create_treasury_account", {
    p_org: ctx.org.id, p_name: name, p_kind: kind, p_method: method, p_location: nullable(fd.get("location_id")),
    p_opening: parseAmount(fd.get("opening")) ?? 0,
  });
  if (error) return fail(friendlyError(error));
  return success("Compte créé.");
}

export async function archiveAccount(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await getAppContext();
  const id = str(fd.get("id"));
  if (!isUuid(id)) return fail("Compte invalide.");
  const { data: bal } = await ctx.supabase.from("account_balances").select("balance").eq("account_id", id).maybeSingle();
  if (bal && Number(bal.balance) !== 0) return fail("Transférez d'abord le solde vers un autre compte : seul un compte à zéro peut être archivé.");
  const { error } = await ctx.supabase.from("treasury_accounts").update({ archived_at: new Date().toISOString() }).eq("id", id).eq("organization_id", ctx.org.id);
  if (error) return fail(friendlyError(error));
  return success("Compte archivé.");
}

export async function transferFunds(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await getAppContext();
  const amount = parseAmount(fd.get("amount"));
  if (!amount || amount <= 0) return fail("Montant invalide.");
  const { error } = await ctx.supabase.rpc("transfer_funds", {
    p_org: ctx.org.id, p_from: str(fd.get("from")), p_to: str(fd.get("to")), p_amount: amount, p_note: nullable(fd.get("note")),
  });
  if (error) return fail(friendlyError(error));
  return success("Transfert interne enregistré (sans effet sur le résultat).");
}

export async function openSession(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await getAppContext();
  const declared = parseAmount(fd.get("declared"));
  if (declared == null || declared < 0) return fail("Indiquez le fond de caisse compté.");
  const { error } = await ctx.supabase.rpc("open_cash_session", { p_account: str(fd.get("account_id")), p_declared: declared, p_comment: nullable(fd.get("comment")) });
  if (error) return fail(friendlyError(error));
  return success("Caisse ouverte.");
}

export async function closeSession(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await getAppContext();
  const counted = parseAmount(fd.get("counted"));
  if (counted == null || counted < 0) return fail("Indiquez le montant compté.");
  const { data, error } = await ctx.supabase.rpc("close_cash_session", { p_session: str(fd.get("session_id")), p_counted: counted, p_comment: nullable(fd.get("comment")) });
  if (error) return fail(friendlyError(error));
  const r = data as { expected: number; counted: number; gap: number };
  return success(Number(r.gap) === 0 ? "Caisse clôturée sans écart. 👍" : `Caisse clôturée avec un écart de ${Number(r.gap).toLocaleString("fr-FR")} F CFA (enregistré et tracé).`);
}

export async function correctSession(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await getAppContext();
  const counted = parseAmount(fd.get("counted"));
  if (counted == null || counted < 0) return fail("Montant invalide.");
  const { error } = await ctx.supabase.rpc("correct_cash_session", { p_session: str(fd.get("session_id")), p_new_counted: counted, p_reason: str(fd.get("reason")) });
  if (error) return fail(friendlyError(error));
  return success("Correction enregistrée dans le journal d'audit.");
}
