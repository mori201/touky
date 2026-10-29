import { PERMISSIONS } from "@/lib/permissions";

export type ActionState = {
  ok: boolean;
  message?: string;
  error?: string;
  data?: Record<string, unknown>;
} | null;

interface DbError {
  message: string;
  code?: string;
  details?: string | null;
  hint?: string | null;
}

/** Transforme une erreur PostgreSQL/PostgREST en message français lisible */
export function friendlyError(e: DbError | null | undefined): string {
  if (!e) return "Une erreur inattendue est survenue.";
  const msg = e.message ?? "";
  const perm = msg.match(/Permission refusée \(([\w.]+)\)/);
  if (perm) {
    const label = PERMISSIONS[perm[1] as keyof typeof PERMISSIONS];
    return `Permission refusée${label ? ` : « ${label} »` : ""}.`;
  }
  if (e.code === "23505") {
    if (/sku/i.test(msg)) return "Cette référence interne existe déjà.";
    if (/barcode/i.test(msg)) return "Ce code-barres est déjà utilisé par un autre produit.";
    return "Cet élément existe déjà (doublon).";
  }
  if (e.code === "23514") return "Une valeur saisie n'est pas valide.";
  if (e.code === "42501") return msg.includes("row-level security") ? "Action non autorisée." : msg;
  if (e.code === "22P02") return "Format de donnée invalide.";
  if (/JWT|session/i.test(msg)) return "Votre session a expiré. Reconnectez-vous.";
  if (/fetch failed|network/i.test(msg)) return "Connexion au serveur impossible. Vérifiez votre réseau.";
  return msg || "Une erreur inattendue est survenue.";
}

export function fail(error: string): ActionState {
  return { ok: false, error };
}

export function success(message: string, data?: Record<string, unknown>): ActionState {
  return { ok: true, message, data };
}
