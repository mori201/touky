import { clsx, type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

/** Convertit une valeur de formulaire en nombre ; renvoie null si vide ou invalide */
export function parseAmount(v: FormDataEntryValue | null | undefined): number | null {
  if (v == null) return null;
  const s = String(v).replace(/\s/g, "").replace(",", ".");
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function str(v: FormDataEntryValue | null | undefined): string {
  return v == null ? "" : String(v).trim();
}

export function nullable(v: FormDataEntryValue | null | undefined): string | null {
  const s = str(v);
  return s === "" ? null : s;
}

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function isUuid(v: unknown): v is string {
  return typeof v === "string" && UUID_RE.test(v);
}

/** Nettoie un terme de recherche avant de l'insérer dans un filtre PostgREST `or()` */
export function searchTerm(v: string | undefined | null): string {
  return String(v ?? "").replace(/[%_,()"'\\*:]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
}
