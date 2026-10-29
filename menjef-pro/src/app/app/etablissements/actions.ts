"use server";

import { getAppContext } from "@/lib/context";
import { fail, friendlyError, success, type ActionState } from "@/lib/actions";
import { LOCATION_TYPES } from "@/lib/constants";
import { isUuid, nullable, str } from "@/lib/utils";

export async function saveLocation(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await getAppContext();
  const name = str(fd.get("name"));
  const type = str(fd.get("type"));
  if (!name || name.length > 120) return fail("Nom invalide.");
  if (!(type in LOCATION_TYPES)) return fail("Type invalide.");
  const values = { name, type, city: nullable(fd.get("city")), address: nullable(fd.get("address")), phone: nullable(fd.get("phone")) };
  const id = nullable(fd.get("id"));
  if (id) {
    const { error } = await ctx.supabase.from("locations").update(values).eq("id", id).eq("organization_id", ctx.org.id);
    if (error) return fail(friendlyError(error));
    return success("Établissement mis à jour.");
  }
  const { data, error } = await ctx.supabase.from("locations").insert({ ...values, organization_id: ctx.org.id }).select("id").single();
  if (error) return fail(friendlyError(error));
  // Une caisse en espèces dédiée au nouvel établissement
  if (ctx.can("treasury.manage")) {
    await ctx.supabase.rpc("create_treasury_account", { p_org: ctx.org.id, p_name: `Caisse ${name}`.slice(0, 120), p_kind: "cash", p_method: "cash", p_location: data.id, p_opening: 0 });
  }
  return success("Établissement créé avec sa caisse.");
}

export async function setLocationArchived(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await getAppContext();
  const id = str(fd.get("id"));
  const archive = fd.get("archive") === "true";
  if (!isUuid(id)) return fail("Établissement invalide.");
  if (archive && ctx.locations.length <= 1) return fail("Vous devez conserver au moins un établissement actif.");
  const { error } = await ctx.supabase.from("locations").update({ archived_at: archive ? new Date().toISOString() : null }).eq("id", id).eq("organization_id", ctx.org.id);
  if (error) return fail(friendlyError(error));
  return success(archive ? "Établissement archivé : il n'accepte plus de ventes, son historique est conservé." : "Établissement réactivé.");
}
