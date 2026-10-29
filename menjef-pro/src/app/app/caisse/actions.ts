"use server";

import { z } from "zod";
import { getAppContext } from "@/lib/context";
import { friendlyError } from "@/lib/actions";
import { PAYMENT_METHOD_KEYS } from "@/lib/constants";

const saleSchema = z.object({
  location_id: z.string().uuid(),
  items: z
    .array(z.object({ product_id: z.string().uuid(), quantity: z.number().positive().max(1_000_000), discount: z.number().min(0).default(0) }))
    .min(1, "Le panier est vide")
    .max(300),
  payments: z
    .array(z.object({ method: z.enum(PAYMENT_METHOD_KEYS as [string, ...string[]]), amount: z.number().min(0), reference: z.string().max(80).optional() }))
    .max(8),
  customer_id: z.string().uuid().nullable(),
  price_mode: z.enum(["retail", "wholesale"]),
  discount: z.number().min(0),
  amount_received: z.number().min(0).nullable(),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  note: z.string().max(500).nullable(),
  idempotency_key: z.string().min(8).max(80),
});

export type SaleInput = z.infer<typeof saleSchema>;
export type SaleResult =
  | { ok: true; id: string; number: string; total: number; paid: number; balance: number; change: number | null; duplicate: boolean }
  | { ok: false; error: string };

export async function createSale(input: SaleInput): Promise<SaleResult> {
  const parsed = saleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const v = parsed.data;
  const ctx = await getAppContext();
  const { data, error } = await ctx.supabase.rpc("create_sale", {
    p_org: ctx.org.id,
    p_location: v.location_id,
    p_items: v.items,
    p_payments: v.payments.filter((p) => p.amount > 0),
    p_customer: v.customer_id,
    p_price_mode: v.price_mode,
    p_discount: v.discount,
    p_amount_received: v.amount_received,
    p_due_date: v.due_date,
    p_note: v.note,
    p_idempotency_key: v.idempotency_key,
  });
  if (error) return { ok: false, error: friendlyError(error) };
  const r = data as { id: string; number: string; total?: number; paid?: number; balance?: number; change?: number | null; duplicate: boolean };
  return { ok: true, id: r.id, number: r.number, total: Number(r.total ?? 0), paid: Number(r.paid ?? 0), balance: Number(r.balance ?? 0), change: r.change == null ? null : Number(r.change), duplicate: r.duplicate };
}

export async function quickCreateCustomer(name: string, phone: string): Promise<{ ok: true; id: string; name: string; phone: string | null } | { ok: false; error: string }> {
  const n = name.trim();
  if (n.length < 2) return { ok: false, error: "Nom du client trop court" };
  const ctx = await getAppContext();
  const { data, error } = await ctx.supabase
    .from("customers")
    .insert({ organization_id: ctx.org.id, name: n.slice(0, 160), phone: phone.trim().slice(0, 40) || null })
    .select("id, name, phone")
    .single();
  if (error) return { ok: false, error: friendlyError(error) };
  return { ok: true, id: data.id, name: data.name, phone: data.phone };
}
