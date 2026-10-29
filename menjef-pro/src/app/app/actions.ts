"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { LOC_COOKIE, ORG_COOKIE, getAppContext, getMemberships } from "@/lib/context";
import { isUuid } from "@/lib/utils";

const COOKIE = { path: "/", httpOnly: true, sameSite: "lax" as const, secure: true, maxAge: 31536000 };

export async function setOrganization(fd: FormData) {
  const id = String(fd.get("organization_id") ?? "");
  const memberships = await getMemberships();
  if (!isUuid(id) || !memberships.some((m) => m.organization.id === id)) return;
  const store = await cookies();
  store.set(ORG_COOKIE, id, COOKIE);
  store.delete(LOC_COOKIE);
  revalidatePath("/app", "layout");
}

export async function setLocation(fd: FormData) {
  const id = String(fd.get("location_id") ?? "");
  const ctx = await getAppContext();
  const store = await cookies();
  if (id === "") store.delete(LOC_COOKIE);
  else if (ctx.locations.some((l) => l.id === id)) store.set(LOC_COOKIE, id, COOKIE);
  revalidatePath("/app", "layout");
}
