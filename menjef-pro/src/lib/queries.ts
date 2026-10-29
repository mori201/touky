import type { AppContext } from "@/lib/context";

/** Noms des membres de l'entreprise (profils visibles grâce à la RLS) */
export async function getMemberNames(ctx: AppContext) {
  const { data: members } = await ctx.supabase
    .from("organization_members")
    .select("user_id")
    .eq("organization_id", ctx.org.id);
  const ids = (members ?? []).map((m) => m.user_id as string);
  if (ids.length === 0) return new Map<string, string>();
  const { data: profiles } = await ctx.supabase.from("profiles").select("id, full_name, email").in("id", ids);
  return new Map((profiles ?? []).map((p) => [p.id as string, (p.full_name as string) || (p.email as string) || "Utilisateur"]));
}

export interface DashboardSummary {
  sales: {
    revenue: number; returns: number; net_revenue: number; tax: number; discounts: number; count: number;
    avg_basket: number; paid_at_checkout: number; credit_sales: number;
  };
  previous: { revenue: number; count: number };
  bucket: "day" | "month";
  scope: { costs: boolean; reports: boolean; credits: boolean; treasury: boolean; payables: boolean; location: string | null; cashier: string | null };
  series: { period: string; revenue: number; count: number; expenses: number }[];
  by_category: { name: string; revenue: number }[];
  top_products: { name: string; quantity: number; revenue: number }[];
  by_method: { method: string; amount: number }[];
  by_location?: { name: string; revenue: number; count: number }[];
  expenses?: number;
  other_income?: number;
  previous_expenses?: number;
  expense_by_category?: { name: string; amount: number }[];
  purchases_received?: number;
  cash_in?: number;
  cash_out?: number;
  previous_cash_in?: number;
  accounts?: { id: string; name: string; kind: string; balance: number }[];
  net_revenue_ht?: number;
  cogs?: number;
  gross_margin?: number;
  gross_margin_rate?: number | null;
  stock_value?: number;
  net_result?: number;
  stock_alerts: { id: string; name: string; quantity: number; min_stock: number }[];
  receivables?: number;
  overdue_receivables?: number;
  payables?: number;
  warnings: string[];
}

export async function getDashboard(ctx: AppContext, from: Date, to: Date, cashier?: string | null) {
  const { data, error } = await ctx.supabase.rpc("dashboard_summary", {
    p_org: ctx.org.id,
    p_from: from.toISOString(),
    p_to: to.toISOString(),
    p_location: ctx.locationId,
    p_cashier: cashier || null,
  });
  if (error) throw new Error(error.message);
  return data as DashboardSummary;
}
