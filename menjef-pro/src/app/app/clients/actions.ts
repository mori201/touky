"use server";

import { z } from "zod";
import { getAppContext } from "@/lib/context";
import { fail, friendlyError, success, type ActionState } from "@/lib/actions";
import { PAYMENT_METHOD_KEYS } from "@/lib/constants";
import { isUuid, nullable, parseAmount, str } from "@/lib/utils";

function readCustomer(fd: FormData) {
  return z
    .object({
      name: z.string().trim().min(1, "Le nom est obligatoire").max(160),
      phone: z.string().trim().max(40).nullable(),
      email: z.union([z.null(), z.string().trim().email("E-mail invalide").max(254)]),
      address: z.string().trim().max(300).nullable(),
      credit_limit: z.number().min(0, "Plafond invalide").nullable(),
      notes: z.string().trim().max(2000).nullable(),
    })
    .safeParse({
      name: str(fd.get("name")),
      phone: nullable(fd.get("phone")),
      email: nullable(fd.get("email")),
      address: nullable(fd.get("address")),
      credit_limit: parseAmount(fd.get("credit_limit")),
      notes: nullable(fd.get("notes")),
    });
}

export async function saveCustomer(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await getAppContext();
  const parsed = readCustomer(fd);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const id = nullable(fd.get("id"));
  const q = id
    ? ctx.supabase.from("customers").update(parsed.data).eq("id", id).eq("organization_id", ctx.org.id)
    : ctx.supabase.from("customers").insert({ ...parsed.data, organization_id: ctx.org.id });
  const { error } = await q;
  if (error) return fail(friendlyError(error));
  return success(id ? "Client mis à jour." : "Client créé.");
}

export async function setCustomerArchived(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await getAppContext();
  const id = str(fd.get("id"));
  if (!isUuid(id)) return fail("Client invalide.");
  const archive = fd.get("archive") === "true";
  const { error } = await ctx.supabase.from("customers").update({ archived_at: archive ? new Date().toISOString() : null }).eq("id", id).eq("organization_id", ctx.org.id);
  if (error) return fail(friendlyError(error));
  return success(archive ? "Client archivé." : "Client réactivé.");
}

export async function recordPayment(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await getAppContext();
  const customer = str(fd.get("customer_id"));
  const amount = parseAmount(fd.get("amount"));
  const method = str(fd.get("method"));
  if (!isUuid(customer)) return fail("Client invalide.");
  if (!amount || amount <= 0) return fail("Le montant doit être supérieur à zéro.");
  if (!(PAYMENT_METHOD_KEYS as string[]).includes(method)) return fail("Mode de paiement invalide.");
  const { data, error } = await ctx.supabase.rpc("record_customer_payment", {
    p_org: ctx.org.id, p_customer: customer, p_amount: amount, p_method: method,
    p_account: nullable(fd.get("account_id")), p_reference: nullable(fd.get("reference")), p_note: nullable(fd.get("note")),
  });
  if (error) return fail(friendlyError(error));
  return success("Remboursement enregistré et affecté aux ventes les plus anciennes.", { paymentId: data as string });
}

export async function addPromise(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await getAppContext();
  const customer = str(fd.get("customer_id"));
  const amount = parseAmount(fd.get("amount"));
  const date = str(fd.get("promised_date"));
  if (!isUuid(customer) || !amount || amount <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return fail("Montant et date obligatoires.");
  const { error } = await ctx.supabase.from("payment_promises").insert({
    organization_id: ctx.org.id, customer_id: customer, amount, promised_date: date, note: nullable(fd.get("note")),
  });
  if (error) return fail(friendlyError(error));
  return success("Promesse de paiement enregistrée.");
}

export async function setPromiseStatus(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await getAppContext();
  const id = str(fd.get("id"));
  const status = str(fd.get("status"));
  if (!isUuid(id) || !["kept", "broken", "pending"].includes(status)) return fail("Requête invalide.");
  const { error } = await ctx.supabase.from("payment_promises").update({ status }).eq("id", id).eq("organization_id", ctx.org.id);
  if (error) return fail(friendlyError(error));
  return success("Statut mis à jour.");
}
