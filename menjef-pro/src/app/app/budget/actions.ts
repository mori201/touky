"use server";

import { getSessionUser } from "@/lib/context";
import { fail, friendlyError, success, type ActionState } from "@/lib/actions";
import { isUuid, nullable, parseAmount, str } from "@/lib/utils";

// Toutes les écritures sont limitées à l'utilisateur connecté par la RLS (user_id = auth.uid()).
async function client() {
  const { supabase, user } = await getSessionUser();
  if (!user) throw new Error("Session expirée");
  return supabase;
}

const DEFAULTS = {
  income: ["Salaire", "Revenus du commerce", "Autres revenus"],
  expense: ["Logement", "Alimentation", "Transport", "Santé", "Éducation", "Famille", "Factures", "Loisirs", "Cérémonies", "Épargne", "Autres"],
};

// Signature (état, formulaire) imposée par useActionState ; aucun champ n'est lu
export async function seedCategories(): Promise<ActionState> {
  const supabase = await client();
  const rows = [
    ...DEFAULTS.income.map((name) => ({ name, kind: "income" })),
    ...DEFAULTS.expense.map((name) => ({ name, kind: "expense" })),
  ];
  const { error } = await supabase.from("personal_categories").upsert(rows, { onConflict: "user_id,name,kind", ignoreDuplicates: true });
  if (error) return fail(friendlyError(error));
  return success("Catégories créées.");
}

export async function addCategory(_: ActionState, fd: FormData): Promise<ActionState> {
  const supabase = await client();
  const name = str(fd.get("name"));
  const kind = str(fd.get("kind"));
  if (!name || !["income", "expense"].includes(kind)) return fail("Nom et type obligatoires.");
  const { error } = await supabase.from("personal_categories").insert({ name, kind });
  if (error) return fail(friendlyError(error));
  return success("Catégorie ajoutée.");
}

export async function addTransaction(_: ActionState, fd: FormData): Promise<ActionState> {
  const supabase = await client();
  const amount = parseAmount(fd.get("amount"));
  const kind = str(fd.get("kind"));
  const label = str(fd.get("label"));
  const date = str(fd.get("date"));
  if (!label || !amount || amount <= 0 || !["income", "expense"].includes(kind) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return fail("Libellé, montant et date obligatoires.");
  const { error } = await supabase.from("personal_transactions").insert({ kind, label, amount, occurred_on: date, category_id: nullable(fd.get("category_id")) });
  if (error) return fail(friendlyError(error));
  return success(kind === "income" ? "Revenu enregistré." : "Dépense enregistrée.");
}

export async function deleteTransaction(_: ActionState, fd: FormData): Promise<ActionState> {
  const supabase = await client();
  const id = str(fd.get("id"));
  if (!isUuid(id)) return fail("Opération invalide.");
  const { error } = await supabase.from("personal_transactions").delete().eq("id", id);
  if (error) return fail(friendlyError(error));
  return success("Opération supprimée.");
}

export async function setBudget(_: ActionState, fd: FormData): Promise<ActionState> {
  const supabase = await client();
  const month = str(fd.get("month"));
  if (!/^\d{4}-\d{2}-01$/.test(month)) return fail("Mois invalide.");
  const rows: { category_id: string; month: string; amount: number }[] = [];
  for (const [k, v] of fd.entries()) {
    if (!k.startsWith("b_")) continue;
    const id = k.slice(2);
    const n = parseAmount(v);
    if (isUuid(id) && n != null && n >= 0) rows.push({ category_id: id, month, amount: n });
  }
  if (rows.length) {
    const { error } = await supabase.from("personal_budgets").upsert(rows, { onConflict: "user_id,category_id,month" });
    if (error) return fail(friendlyError(error));
  }
  return success("Budgets du mois enregistrés.");
}

export async function addGoal(_: ActionState, fd: FormData): Promise<ActionState> {
  const supabase = await client();
  const name = str(fd.get("name"));
  const target = parseAmount(fd.get("target"));
  if (!name || !target || target <= 0) return fail("Nom et montant cible obligatoires.");
  const { error } = await supabase.from("personal_goals").insert({ name, target_amount: target, deadline: nullable(fd.get("deadline")) });
  if (error) return fail(friendlyError(error));
  return success("Objectif créé.");
}

export async function contributeGoal(_: ActionState, fd: FormData): Promise<ActionState> {
  const supabase = await client();
  const id = str(fd.get("id"));
  const amount = parseAmount(fd.get("amount"));
  if (!isUuid(id) || amount == null || amount === 0) return fail("Montant invalide.");
  const { data: g } = await supabase.from("personal_goals").select("saved_amount").eq("id", id).maybeSingle();
  if (!g) return fail("Objectif introuvable.");
  const next = Math.max(0, Number(g.saved_amount) + amount);
  const { error } = await supabase.from("personal_goals").update({ saved_amount: next }).eq("id", id);
  if (error) return fail(friendlyError(error));
  return success("Épargne mise à jour.");
}

export async function deleteGoal(_: ActionState, fd: FormData): Promise<ActionState> {
  const supabase = await client();
  const id = str(fd.get("id"));
  if (!isUuid(id)) return fail("Objectif invalide.");
  const { error } = await supabase.from("personal_goals").delete().eq("id", id);
  if (error) return fail(friendlyError(error));
  return success("Objectif supprimé.");
}
