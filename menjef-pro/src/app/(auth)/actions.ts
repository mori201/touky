"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { SITE_URL } from "@/lib/env";
import { fail, success, type ActionState } from "@/lib/actions";

async function origin() {
  if (SITE_URL) return SITE_URL;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}

/** N'accepte que des chemins internes pour éviter les redirections ouvertes */
export async function safeNext(next: unknown, fallback = "/app") {
  const s = typeof next === "string" ? next : "";
  return s.startsWith("/") && !s.startsWith("//") && !s.startsWith("/\\") ? s : fallback;
}

function authMessage(msg: string) {
  if (/invalid login credentials/i.test(msg)) return "Adresse e-mail ou mot de passe incorrect.";
  if (/email not confirmed/i.test(msg)) return "Votre adresse e-mail n'est pas encore confirmée. Ouvrez le lien reçu par e-mail.";
  if (/already registered|already exists/i.test(msg)) return "Un compte existe déjà avec cette adresse e-mail.";
  if (/rate limit|too many/i.test(msg)) return "Trop de tentatives. Patientez quelques minutes avant de réessayer.";
  if (/password/i.test(msg) && /weak|short|characters/i.test(msg)) return "Mot de passe trop faible.";
  if (/same.*password|different from the old/i.test(msg)) return "Le nouveau mot de passe doit être différent de l'ancien.";
  return "Opération impossible pour le moment. Réessayez.";
}

const email = z.string().trim().toLowerCase().email("Adresse e-mail invalide").max(254);
const password = z
  .string()
  .min(8, "Le mot de passe doit contenir au moins 8 caractères")
  .max(72, "Mot de passe trop long")
  .regex(/[A-Za-z]/, "Le mot de passe doit contenir au moins une lettre")
  .regex(/\d/, "Le mot de passe doit contenir au moins un chiffre");

export async function signIn(_: ActionState, fd: FormData): Promise<ActionState> {
  const parsed = z.object({ email, password: z.string().min(1, "Saisissez votre mot de passe") }).safeParse({
    email: fd.get("email"),
    password: fd.get("password"),
  });
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return fail(authMessage(error.message));
  redirect(await safeNext(fd.get("suivant")));
}

export async function signUp(_: ActionState, fd: FormData): Promise<ActionState> {
  const parsed = z
    .object({
      full_name: z.string().trim().min(2, "Indiquez votre nom complet").max(120),
      email,
      password,
      confirm: z.string(),
      terms: z.literal("on", { message: "Vous devez accepter les conditions d'utilisation et la politique de confidentialité" }),
    })
    .refine((v) => v.password === v.confirm, { message: "Les deux mots de passe ne correspondent pas" })
    .safeParse({
      full_name: fd.get("full_name"),
      email: fd.get("email"),
      password: fd.get("password"),
      confirm: fd.get("confirm"),
      terms: fd.get("terms") ?? undefined,
    });
  if (!parsed.success) return fail(parsed.error.issues[0].message);

  const supabase = await createClient();
  const next = await safeNext(fd.get("suivant"), "/onboarding");
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.full_name, terms_accepted: "true" },
      emailRedirectTo: `${await origin()}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });
  if (error) return fail(authMessage(error.message));
  if (data.session) redirect(next);
  return success(
    `Compte créé. Un e-mail de confirmation a été envoyé à ${parsed.data.email}. Ouvrez le lien qu'il contient pour activer votre compte.`,
  );
}

export async function requestPasswordReset(_: ActionState, fd: FormData): Promise<ActionState> {
  const parsed = email.safeParse(fd.get("email"));
  if (!parsed.success) return fail("Adresse e-mail invalide");
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data, {
    redirectTo: `${await origin()}/auth/callback?next=/reinitialiser-mot-de-passe`,
  });
  if (error && /rate limit|too many/i.test(error.message)) return fail(authMessage(error.message));
  // Même réponse que le compte existe ou non (pas d'énumération des adresses)
  return success("Si un compte correspond à cette adresse, un lien de réinitialisation vient d'être envoyé.");
}

export async function updatePassword(_: ActionState, fd: FormData): Promise<ActionState> {
  const parsed = z
    .object({ password, confirm: z.string() })
    .refine((v) => v.password === v.confirm, { message: "Les deux mots de passe ne correspondent pas" })
    .safeParse({ password: fd.get("password"), confirm: fd.get("confirm") });
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Le lien de réinitialisation a expiré. Demandez-en un nouveau.");
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return fail(authMessage(error.message));
  return success("Mot de passe mis à jour. Vous pouvez continuer vers votre espace.");
}
