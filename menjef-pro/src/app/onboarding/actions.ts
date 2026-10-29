"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { ORG_COOKIE, getAppContext } from "@/lib/context";
import { fail, friendlyError, success, type ActionState } from "@/lib/actions";
import { PAYMENT_METHOD_KEYS, SECTORS, LOCATION_TYPES, PAYMENT_METHODS, type PaymentMethod } from "@/lib/constants";
import { ROLE_KEYS } from "@/lib/permissions";
import { SITE_URL } from "@/lib/env";
import { parseAmount, str } from "@/lib/utils";

const optional = z.string().trim().max(200).optional().transform((v) => (v ? v : null));

const orgSchema = z.object({
  full_name: z.string().trim().min(2, "Indiquez votre nom").max(120),
  phone: optional,
  name: z.string().trim().min(2, "Le nom de l'entreprise est obligatoire").max(120),
  sector: z.enum(Object.keys(SECTORS) as [string, ...string[]], { message: "Choisissez un secteur" }),
  org_phone: optional,
  org_email: z.union([z.literal(""), z.string().trim().email("E-mail de l'entreprise invalide")]).optional(),
  city: optional,
  address: optional,
  ninea: optional,
  rccm: optional,
  location_name: z.string().trim().min(1, "Nommez votre établissement").max(120),
  location_type: z.enum(Object.keys(LOCATION_TYPES) as [string, ...string[]]),
});

export async function createOrganization(_: ActionState, fd: FormData): Promise<ActionState> {
  const parsed = orgSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const v = parsed.data;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Session expirée, reconnectez-vous.");

  await supabase.from("profiles").update({ full_name: v.full_name, phone: v.phone }).eq("id", user.id);

  const { data: orgId, error } = await supabase.rpc("create_organization", {
    p_name: v.name,
    p_sector: v.sector,
    p_phone: v.org_phone,
    p_city: v.city,
    p_address: v.address,
    p_location_name: v.location_name,
    p_location_type: v.location_type,
  });
  if (error) return fail(friendlyError(error));

  if (v.org_email || v.ninea || v.rccm) {
    await supabase
      .from("organizations")
      .update({ email: v.org_email || null, ninea: v.ninea, rccm: v.rccm })
      .eq("id", orgId as string);
  }
  (await cookies()).set(ORG_COOKIE, orgId as string, { path: "/", httpOnly: true, sameSite: "lax", secure: true, maxAge: 31536000 });
  redirect("/onboarding?etape=5");
}

async function setStep(orgId: string, step: number, completed = false) {
  const supabase = await createClient();
  await supabase
    .from("organizations")
    .update({ onboarding_step: step, ...(completed ? { onboarding_completed: true } : {}) })
    .eq("id", orgId);
}

export async function goToStep(fd: FormData) {
  const ctx = await getAppContext();
  const step = Math.min(8, Math.max(5, Number(fd.get("step")) || 5));
  if (ctx.can("settings.manage")) await setStep(ctx.org.id, step);
  redirect(`/onboarding?etape=${step}`);
}

export async function finishOnboarding() {
  const ctx = await getAppContext();
  if (ctx.can("settings.manage")) await setStep(ctx.org.id, 8, true);
  redirect("/app");
}

export async function addInitialProducts(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await getAppContext();
  if (!ctx.operationLocationId) return fail("Aucun établissement disponible.");
  const rows: Record<string, string | number>[] = [];
  for (let i = 0; i < 8; i++) {
    const name = str(fd.get(`name_${i}`));
    if (!name) continue;
    const price = parseAmount(fd.get(`price_${i}`));
    const cost = parseAmount(fd.get(`cost_${i}`));
    const qty = parseAmount(fd.get(`qty_${i}`));
    if (price == null || price < 0) return fail(`Prix de vente invalide pour « ${name} »`);
    if ((cost != null && cost < 0) || (qty != null && qty < 0)) return fail(`Valeur négative pour « ${name} »`);
    rows.push({ name, sale_price: price, purchase_price: cost ?? 0, quantity: qty ?? 0 });
  }
  if (rows.length === 0) return fail("Ajoutez au moins un produit, ou passez cette étape.");
  const { data, error } = await ctx.supabase.rpc("import_products", {
    p_org: ctx.org.id,
    p_location: ctx.operationLocationId,
    p_rows: rows,
  });
  if (error) return fail(friendlyError(error));
  await setStep(ctx.org.id, 6);
  return success(`${data} produit(s) ajouté(s) au catalogue.`);
}

export async function savePaymentMethods(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await getAppContext();
  if (!ctx.can("settings.manage")) return fail("Permission refusée.");
  const methods = fd.getAll("methods").map(String).filter((m): m is PaymentMethod => (PAYMENT_METHOD_KEYS as string[]).includes(m));
  if (!methods.includes("cash")) methods.unshift("cash");
  const { error } = await ctx.supabase.from("organizations").update({ enabled_payment_methods: methods }).eq("id", ctx.org.id);
  if (error) return fail(friendlyError(error));

  // Chaque moyen activé doit disposer d'un compte de trésorerie
  const { data: accounts } = await ctx.supabase.from("treasury_accounts").select("method").eq("organization_id", ctx.org.id).is("archived_at", null);
  const existing = new Set((accounts ?? []).map((a) => a.method));
  for (const m of methods) {
    if (existing.has(m)) continue;
    const kind = m === "bank_transfer" || m === "card" ? "bank" : m === "other" ? "other" : m === "cash" ? "cash" : "mobile_money";
    const { error: e } = await ctx.supabase.rpc("create_treasury_account", {
      p_org: ctx.org.id, p_name: PAYMENT_METHODS[m], p_kind: kind, p_method: m, p_location: null, p_opening: 0,
    });
    if (e) return fail(friendlyError(e));
  }
  await setStep(ctx.org.id, 7);
  return success("Moyens de paiement enregistrés.");
}

export async function inviteCollaborator(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await getAppContext();
  const email = str(fd.get("email")).toLowerCase();
  const role = str(fd.get("role"));
  if (!z.string().email().safeParse(email).success) return fail("Adresse e-mail invalide.");
  if (!(ROLE_KEYS as string[]).includes(role)) return fail("Rôle invalide.");
  const location = str(fd.get("location_id")) || null;
  const { data, error } = await ctx.supabase.rpc("invite_member", {
    p_org: ctx.org.id, p_email: email, p_role: role, p_location: location,
  });
  if (error) return fail(friendlyError(error));
  const base = SITE_URL || "";
  return success(`Invitation créée pour ${email}. Envoyez-lui ce lien :`, { link: `${base}/invitation/${data}` });
}
