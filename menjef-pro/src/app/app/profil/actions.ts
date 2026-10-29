"use server";

import { z } from "zod";
import { getSessionUser } from "@/lib/context";
import { fail, friendlyError, success, type ActionState } from "@/lib/actions";
import { nullable, str } from "@/lib/utils";

export async function saveProfile(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, user } = await getSessionUser();
  if (!user) return fail("Session expirée.");
  const name = str(fd.get("full_name"));
  if (name.length < 2 || name.length > 120) return fail("Nom invalide.");
  const { error } = await supabase.from("profiles").update({ full_name: name, phone: nullable(fd.get("phone")) }).eq("id", user.id);
  if (error) return fail(friendlyError(error));
  return success("Profil mis à jour.");
}

export async function changePassword(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, user } = await getSessionUser();
  if (!user?.email) return fail("Session expirée.");
  const current = String(fd.get("current") ?? "");
  const parsed = z
    .string()
    .min(8, "Au moins 8 caractères")
    .regex(/[A-Za-z]/, "Au moins une lettre")
    .regex(/\d/, "Au moins un chiffre")
    .safeParse(fd.get("password"));
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  if (parsed.data !== fd.get("confirm")) return fail("Les deux mots de passe ne correspondent pas.");
  // Vérifie le mot de passe actuel avant de le remplacer
  const { error: e1 } = await supabase.auth.signInWithPassword({ email: user.email, password: current });
  if (e1) return fail("Mot de passe actuel incorrect.");
  const { error } = await supabase.auth.updateUser({ password: parsed.data });
  if (error) return fail(friendlyError(error));
  return success("Mot de passe modifié.");
}

export async function requestDeletion(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, user } = await getSessionUser();
  if (!user) return fail("Session expirée.");
  if (fd.get("confirm") !== "SUPPRIMER") return fail("Saisissez SUPPRIMER pour confirmer.");
  const { error } = await supabase.from("account_deletion_requests").insert({ user_id: user.id, reason: nullable(fd.get("reason")) });
  if (error) return fail(friendlyError(error));
  return success("Demande enregistrée. Notre équipe vérifiera votre identité avant de supprimer définitivement le compte ; les entreprises dont vous êtes l'unique propriétaire devront être transférées ou clôturées.");
}
