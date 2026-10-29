import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PrintButton } from "@/components/ui/client";
import { requirePermission } from "@/lib/context";
import { getMemberNames } from "@/lib/queries";
import { formatDate, formatMoney, formatQty } from "@/lib/format";
import { PAYMENT_METHODS, type PaymentMethod } from "@/lib/constants";
import { isUuid } from "@/lib/utils";

export const metadata: Metadata = { title: "Reçu de vente" };

export default async function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const ctx = await requirePermission("sales.view");
  const { data: sale } = await ctx.supabase
    .from("sales")
    .select("*, customer:customers(name, phone), location:locations(name, address, phone)")
    .eq("id", id)
    .eq("organization_id", ctx.org.id)
    .maybeSingle();
  if (!sale) notFound();
  const [{ data: items }, { data: payments }, names] = await Promise.all([
    ctx.supabase.from("sale_items").select("id, product_name, quantity, unit_price, discount, line_total").eq("sale_id", id),
    ctx.supabase.from("sale_payments").select("method, amount, reference").eq("sale_id", id),
    getMemberNames(ctx),
  ]);
  const loc = sale.location as { name: string; address: string | null; phone: string | null } | null;
  const customer = sale.customer as { name: string; phone: string | null } | null;

  return (
    <div className="mx-auto max-w-sm">
      <div className="no-print mb-4 flex justify-end"><PrintButton label="Imprimer le reçu" /></div>
      <article className="rounded-xl border border-border bg-white p-5 font-mono text-[13px] leading-relaxed text-black">
        <header className="text-center">
          <p className="text-base font-bold uppercase">{ctx.org.name}</p>
          {loc && <p>{loc.name}</p>}
          {(loc?.address || ctx.org.address) && <p>{loc?.address || ctx.org.address}{ctx.org.city ? `, ${ctx.org.city}` : ""}</p>}
          {(loc?.phone || ctx.org.phone) && <p>Tél. {loc?.phone || ctx.org.phone}</p>}
          {ctx.org.ninea && <p>NINEA {ctx.org.ninea}</p>}
          {ctx.org.rccm && <p>RCCM {ctx.org.rccm}</p>}
        </header>
        <hr className="my-3 border-dashed border-black/40" />
        <p>Reçu n° {sale.number}</p>
        <p>{formatDate(sale.created_at, true)}</p>
        <p>Vendeur : {names.get(sale.cashier_id) ?? "—"}</p>
        {customer && <p>Client : {customer.name}{customer.phone ? ` (${customer.phone})` : ""}</p>}
        {sale.status === "cancelled" && <p className="mt-2 text-center font-bold">*** VENTE ANNULÉE ***</p>}
        <hr className="my-3 border-dashed border-black/40" />
        {(items ?? []).map((i) => (
          <div key={i.id} className="mb-1.5">
            <p>{i.product_name}</p>
            <p className="flex justify-between">
              <span>{formatQty(i.quantity)} × {formatMoney(i.unit_price, false)}{Number(i.discount) ? ` − ${formatMoney(i.discount, false)}` : ""}</span>
              <span>{formatMoney(i.line_total, false)}</span>
            </p>
          </div>
        ))}
        <hr className="my-3 border-dashed border-black/40" />
        {Number(sale.discount_total) > 0 && <p className="flex justify-between"><span>Remises</span><span>− {formatMoney(sale.discount_total, false)}</span></p>}
        {Number(sale.tax_total) > 0 && <p className="flex justify-between"><span>Taxes</span><span>{formatMoney(sale.tax_total, false)}</span></p>}
        <p className="flex justify-between text-base font-bold"><span>TOTAL</span><span>{formatMoney(sale.total)}</span></p>
        {(payments ?? []).map((p, i) => (
          <p key={i} className="flex justify-between"><span>{PAYMENT_METHODS[p.method as PaymentMethod]}{p.reference ? ` (${p.reference})` : ""}</span><span>{formatMoney(p.amount, false)}</span></p>
        ))}
        {sale.amount_received != null && <p className="flex justify-between"><span>Reçu en espèces</span><span>{formatMoney(sale.amount_received, false)}</span></p>}
        {sale.change_given != null && Number(sale.change_given) > 0 && <p className="flex justify-between"><span>Monnaie rendue</span><span>{formatMoney(sale.change_given, false)}</span></p>}
        {Number(sale.balance_due) > 0 && (
          <p className="mt-1 flex justify-between font-bold"><span>Reste dû</span><span>{formatMoney(sale.balance_due)}</span></p>
        )}
        {sale.due_date && Number(sale.balance_due) > 0 && <p>Échéance : {formatDate(sale.due_date)}</p>}
        <hr className="my-3 border-dashed border-black/40" />
        <p className="text-center">{ctx.org.receipt_footer || "Merci de votre visite !"}</p>
        <p className="mt-1 text-center text-[11px] text-black/60">Mënjëf PRO</p>
      </article>
    </div>
  );
}
