"use server";

import { z } from "zod";
import { getAppContext } from "@/lib/context";
import { fail, friendlyError, success, type ActionState } from "@/lib/actions";
import { PAYMENT_METHOD_KEYS, SECTORS } from "@/lib/constants";
import { nullable, parseAmount, str } from "@/lib/utils";

export async function saveSettings(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await getAppContext();
  if (!ctx.can("settings.manage")) return fail("Permission refusée.");
  const parsed = z
    .object({
      name: z.string().trim().min(2, "Nom trop court").max(120),
      sector: z.enum(Object.keys(SECTORS) as [string, ...string[]]),
      phone: z.string().max(40).nullable(),
      email: z.union([z.null(), z.string().email("E-mail invalide")]),
      address: z.string().max(300).nullable(),
      city: z.string().max(80).nullable(),
      ninea: z.string().max(40).nullable(),
      rccm: z.string().max(60).nullable(),
      receipt_footer: z.string().max(300).nullable(),
      tax_enabled: z.boolean(),
      tax_rate: z.number().min(0).max(100),
      allow_negative_stock: z.boolean(),
      require_cash_gap_comment: z.boolean(),
    })
    .safeParse({
      name: str(fd.get("name")), sector: str(fd.get("sector")), phone: nullable(fd.get("phone")), email: nullable(fd.get("email")),
      address: nullable(fd.get("address")), city: nullable(fd.get("city")), ninea: nullable(fd.get("ninea")), rccm: nullable(fd.get("rccm")),
      receipt_footer: nullable(fd.get("receipt_footer")), tax_enabled: fd.get("tax_enabled") === "on", tax_rate: parseAmount(fd.get("tax_rate")) ?? 0,
      allow_negative_stock: fd.get("allow_negative_stock") === "on", require_cash_gap_comment: fd.get("require_cash_gap_comment") === "on",
    });
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const methods = fd.getAll("methods").map(String).filter((m) => (PAYMENT_METHOD_KEYS as string[]).includes(m));
  if (!methods.includes("cash")) methods.unshift("cash");
  const { error } = await ctx.supabase.from("organizations").update({ ...parsed.data, enabled_payment_methods: methods }).eq("id", ctx.org.id);
  if (error) return fail(friendlyError(error));
  return success("Paramètres enregistrés.");
}
