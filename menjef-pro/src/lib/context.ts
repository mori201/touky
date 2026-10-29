import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Permission, Role } from "@/lib/permissions";
import type { PaymentMethod, Sector } from "@/lib/constants";

export const ORG_COOKIE = "mj_org";
export const LOC_COOKIE = "mj_loc";

export interface Organization {
  id: string;
  name: string;
  sector: Sector;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  currency: string;
  timezone: string;
  ninea: string | null;
  rccm: string | null;
  receipt_footer: string | null;
  tax_enabled: boolean;
  tax_rate: number;
  allow_negative_stock: boolean;
  require_cash_gap_comment: boolean;
  enabled_payment_methods: PaymentMethod[];
  onboarding_completed: boolean;
  onboarding_step: number;
}

export interface Location {
  id: string;
  name: string;
  type: string;
  city: string | null;
  address: string | null;
  phone: string | null;
}

export interface Membership {
  id: string;
  role: Role;
  location_id: string | null;
  organization: Organization;
}

const ORG_COLUMNS =
  "id, name, sector, phone, email, address, city, currency, timezone, ninea, rccm, receipt_footer, tax_enabled, tax_rate, allow_negative_stock, require_cash_gap_comment, enabled_payment_methods, onboarding_completed, onboarding_step";

export const getSessionUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
});

export const getMemberships = cache(async (): Promise<Membership[]> => {
  const { supabase, user } = await getSessionUser();
  if (!user) return [];
  const { data, error } = await supabase
    .from("organization_members")
    .select(`id, role, location_id, organization:organizations(${ORG_COLUMNS})`)
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("created_at");
  if (error) throw new Error(error.message);
  return (data ?? []).filter((m) => m.organization) as unknown as Membership[];
});

/**
 * Contexte de l'espace de gestion. Le cookie ne fait que mémoriser un choix
 * d'affichage : l'appartenance est revérifiée ici et, surtout, par la RLS.
 */
export const getAppContext = cache(async () => {
  const { supabase, user } = await getSessionUser();
  if (!user) redirect("/connexion");

  const memberships = await getMemberships();
  if (memberships.length === 0) redirect("/onboarding");

  const store = await cookies();
  const wanted = store.get(ORG_COOKIE)?.value;
  const membership = memberships.find((m) => m.organization.id === wanted) ?? memberships[0];
  const org = membership.organization;

  const [{ data: perms }, { data: locs }, { data: profile }] = await Promise.all([
    supabase.rpc("my_permissions", { p_org: org.id }),
    supabase
      .from("locations")
      .select("id, name, type, city, address, phone")
      .eq("organization_id", org.id)
      .is("archived_at", null)
      .order("created_at"),
    supabase.from("profiles").select("id, full_name, phone, email").eq("id", user.id).maybeSingle(),
  ]);

  const permissions = new Set<string>((perms as string[] | null) ?? []);
  const allLocations = (locs ?? []) as Location[];
  const restrictedTo = membership.location_id;
  const locations = restrictedTo ? allLocations.filter((l) => l.id === restrictedTo) : allLocations;

  const wantedLoc = store.get(LOC_COOKIE)?.value;
  // null = vue consolidée (tous les établissements)
  const locationId = restrictedTo ?? (locations.some((l) => l.id === wantedLoc) ? wantedLoc! : null);
  // Établissement utilisé pour les opérations (caisse, réception…)
  const operationLocationId = locationId ?? locations[0]?.id ?? null;

  return {
    supabase,
    user,
    profile: profile as { id: string; full_name: string; phone: string | null; email: string | null } | null,
    memberships,
    membership,
    org,
    role: membership.role,
    permissions,
    can: (p: Permission) => permissions.has(p),
    locations,
    restrictedTo,
    locationId,
    operationLocationId,
  };
});

export type AppContext = Awaited<ReturnType<typeof getAppContext>>;

/** Interrompt le rendu si la permission manque (la base refuserait de toute façon) */
export async function requirePermission(p: Permission) {
  const ctx = await getAppContext();
  if (!ctx.can(p)) redirect(`/app/acces-refuse?permission=${encodeURIComponent(p)}`);
  return ctx;
}
