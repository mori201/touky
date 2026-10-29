import { NextResponse, type NextRequest } from "next/server";
import { getAppContext, getSessionUser } from "@/lib/context";
import { toCsv } from "@/lib/csv";
import { PAYMENT_METHODS, type PaymentMethod } from "@/lib/constants";

const ISO = /^\d{4}-\d{2}-\d{2}$/;

function file(name: string, csv: string) {
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ entity: string }> }) {
  const { entity } = await params;
  const sp = req.nextUrl.searchParams;

  // Budget personnel : données propres à l'utilisateur, indépendantes de l'entreprise
  if (entity === "budget") {
    const { supabase, user } = await getSessionUser();
    if (!user) return new NextResponse("Non authentifié", { status: 401 });
    const mois = sp.get("mois");
    let q = supabase.from("personal_transactions").select("occurred_on, kind, label, amount, category:personal_categories(name)").eq("user_id", user.id).order("occurred_on");
    if (mois && /^\d{4}-\d{2}$/.test(mois)) {
      const [y, m] = mois.split("-").map(Number);
      q = q.gte("occurred_on", `${mois}-01`).lt("occurred_on", new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10));
    }
    const { data } = await q;
    return file("budget-personnel", toCsv(["Date", "Type", "Libellé", "Catégorie", "Montant"], (data ?? []).map((t) => [t.occurred_on, t.kind === "income" ? "Revenu" : "Dépense", t.label, (t.category as unknown as { name: string } | null)?.name, Number(t.amount)])));
  }

  const ctx = await getAppContext();
  if (!ctx.can("reports.export")) return new NextResponse("Permission refusée", { status: 403 });
  const org = ctx.org.id;
  const du = sp.get("du");
  const au = sp.get("au");

  switch (entity) {
    case "ventes": {
      let q = ctx.supabase.from("sales").select("number, created_at, status, subtotal, discount_total, tax_total, total, returned_total, paid_at_checkout, balance_due, location:locations(name), customer:customers(name)").eq("organization_id", org).order("created_at").limit(50000);
      if (du && ISO.test(du)) q = q.gte("created_at", `${du}T00:00:00Z`);
      if (au && ISO.test(au)) q = q.lt("created_at", `${au}T00:00:00Z`);
      if (ctx.locationId) q = q.eq("location_id", ctx.locationId);
      const { data } = await q;
      return file("ventes", toCsv(
        ["N°", "Date", "Statut", "Établissement", "Client", "Sous-total", "Remises", "Taxes", "Total", "Retours", "Payé à la vente", "Solde dû"],
        (data ?? []).map((s) => [s.number, s.created_at, s.status === "cancelled" ? "Annulée" : "Validée", (s.location as unknown as { name: string } | null)?.name, (s.customer as unknown as { name: string } | null)?.name, Number(s.subtotal), Number(s.discount_total), Number(s.tax_total), Number(s.total), Number(s.returned_total), Number(s.paid_at_checkout), Number(s.balance_due)]),
      ));
    }
    case "produits": {
      const [{ data }, costs] = await Promise.all([
        ctx.supabase.from("products").select("id, name, sku, barcode, unit, sale_price, wholesale_price, min_stock, is_active, category:categories(name)").eq("organization_id", org).order("name"),
        ctx.can("costs.view") ? ctx.supabase.rpc("get_product_costs", { p_org: org }) : Promise.resolve({ data: null }),
      ]);
      const c = new Map(((costs.data as { product_id: string; purchase_price: number }[] | null) ?? []).map((x) => [x.product_id, Number(x.purchase_price)]));
      const headers = ["Nom", "Référence", "Code-barres", "Catégorie", "Unité", "Prix de vente", "Prix de gros", ...(ctx.can("costs.view") ? ["Prix d'achat"] : []), "Stock minimum", "Actif"];
      return file("produits", toCsv(headers, (data ?? []).map((p) => [p.name, p.sku, p.barcode, (p.category as unknown as { name: string } | null)?.name, p.unit, Number(p.sale_price), p.wholesale_price == null ? null : Number(p.wholesale_price), ...(ctx.can("costs.view") ? [c.get(p.id) ?? 0] : []), Number(p.min_stock), p.is_active ? "oui" : "non"])));
    }
    case "stock": {
      let lq = ctx.supabase.from("stock_levels").select("quantity, product:products(name, sku, unit), location:locations(name)").eq("organization_id", org);
      if (ctx.locationId) lq = lq.eq("location_id", ctx.locationId);
      const { data } = await lq;
      return file("stock", toCsv(["Produit", "Référence", "Établissement", "Quantité", "Unité"], (data ?? []).map((l) => {
        const p = l.product as unknown as { name: string; sku: string | null; unit: string };
        return [p?.name, p?.sku, (l.location as unknown as { name: string })?.name, Number(l.quantity), p?.unit];
      })));
    }
    case "clients": {
      const [{ data: customers }, { data: balances }] = await Promise.all([
        ctx.supabase.from("customers").select("id, name, phone, email, address, credit_limit").eq("organization_id", org).order("name"),
        ctx.supabase.from("customer_balances").select("customer_id, total_sales, total_paid, balance_due, overdue").eq("organization_id", org),
      ]);
      const b = new Map((balances ?? []).map((x) => [x.customer_id, x]));
      return file("clients", toCsv(["Nom", "Téléphone", "E-mail", "Adresse", "Plafond", "Total facturé", "Total payé", "Solde dû", "En retard"], (customers ?? []).map((c) => {
        const x = b.get(c.id);
        return [c.name, c.phone, c.email, c.address, c.credit_limit == null ? null : Number(c.credit_limit), Number(x?.total_sales ?? 0), Number(x?.total_paid ?? 0), Number(x?.balance_due ?? 0), Number(x?.overdue ?? 0)];
      })));
    }
    case "depenses":
    case "recettes": {
      const exp = entity === "depenses";
      const dateCol = exp ? "expense_date" : "income_date";
      let q = ctx.supabase.from(exp ? "expenses" : "other_incomes").select(exp ? "expense_date, label, amount, method, status, beneficiary, category:expense_categories(name)" : "income_date, label, amount, method, status").eq("organization_id", org).order(dateCol);
      if (du && ISO.test(du)) q = q.gte(dateCol, du);
      if (au && ISO.test(au)) q = q.lt(dateCol, au);
      if (ctx.locationId) q = q.eq("location_id", ctx.locationId);
      const { data } = await q;
      const rows = (data ?? []) as unknown as Record<string, unknown>[];
      return file(entity, toCsv(
        exp ? ["Date", "Libellé", "Catégorie", "Bénéficiaire", "Mode", "Statut", "Montant"] : ["Date", "Libellé", "Mode", "Statut", "Montant"],
        rows.map((r) => exp
          ? [String(r.expense_date), String(r.label), (r.category as { name: string } | null)?.name, r.beneficiary as string | null, PAYMENT_METHODS[r.method as PaymentMethod], r.status === "cancelled" ? "Annulée" : "Validée", Number(r.amount)]
          : [String(r.income_date), String(r.label), PAYMENT_METHODS[r.method as PaymentMethod], r.status === "cancelled" ? "Annulée" : "Validée", Number(r.amount)]),
      ));
    }
    default:
      return new NextResponse("Export inconnu", { status: 404 });
  }
}
