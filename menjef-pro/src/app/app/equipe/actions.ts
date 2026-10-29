"use server";

import { z } from "zod";
import { getAppContext } from "@/lib/context";
import { fail, friendlyError, success, type ActionState } from "@/lib/actions";
import { ROLE_KEYS } from "@/lib/permissions";
import { isUuid, nullable, str } from "@/lib/utils";

export async function inviteMember(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await getAppContext();
  const email = str(fd.get("email")).toLowerCase();
  const role = str(fd.get("role"));
  if (!z.string().email().safeParse(email).success) return fail("Adresse e-mail invalide.");
  if (!(ROLE_KEYS as string[]).includes(role)) return fail("Rôle invalide.");
  const { data, error } = await ctx.supabase.rpc("invite_member", { p_org: ctx.org.id, p_email: email, p_role: role, p_location: nullable(fd.get("location_id")) });
  if (error) return fail(friendlyError(error));
  return success(`Invitation créée pour ${email}. Transmettez ce lien personnel (valable 7 jours) :`, { link: `/invitation/${data}` });
}

export async function updateMember(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await getAppContext();
  const id = str(fd.get("member_id"));
  const role = str(fd.get("role"));
  const status = str(fd.get("status"));
  if (!isUuid(id) || !(ROLE_KEYS as string[]).includes(role)) return fail("Requête invalide.");
  const { error } = await ctx.supabase.rpc("update_member", { p_member: id, p_role: role, p_location: nullable(fd.get("location_id")), p_status: status });
  if (error) return fail(friendlyError(error));
  return success("Membre mis à jour.");
}

export async function removeMember(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await getAppContext();
  const id = str(fd.get("member_id"));
  if (!isUuid(id)) return fail("Membre invalide.");
  const { error } = await ctx.supabase.rpc("remove_member", { p_member: id });
  if (error) return fail(friendlyError(error));
  return success("Membre retiré de l'entreprise.");
}

export async function revokeInvitation(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await getAppContext();
  const id = str(fd.get("id"));
  if (!isUuid(id)) return fail("Invitation invalide.");
  const { error } = await ctx.supabase.rpc("revoke_invitation", { p_invitation: id });
  if (error) return fail(friendlyError(error));
  return success("Invitation révoquée.");
}
