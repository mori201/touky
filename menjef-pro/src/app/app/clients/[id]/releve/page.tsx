import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PrintButton } from "@/components/ui/client";
import { requirePermission } from "@/lib/context";
import { formatDate, formatMoney } from "@/lib/format";
import { PAYMENT_METHODS, type PaymentMethod } from "@/lib/constants";
import { isUuid } from "@/lib/utils";

export const metadata: Metadata = { title: "Relevé client" };

export default async function StatementPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { id } = await params;
  const sp = await searchParams;
  if (!isUuid(id)) notFound();
  const ctx = await requirePermission("credits.view");
  const { data: c } = await ctx.supabase.from("customers").select("name, phone, address").eq("id", id).eq("organization_id", ctx.org.id).maybeSingle();
  if (!c) notFound();

  // Reçu de remboursement unique
  if (sp.recu && isUuid(sp.recu)) {
    const { data: p } = await ctx.supabase.from("customer_payments").select("number, amount, method, reference, note, created_at").eq("id", sp.recu).eq("customer_id", id).maybeSingle();
    if (!p) notFound();
    const { data: b } = await ctx.supabase.from("customer_balances").select("balance_due").eq("customer_id", id).maybeSingle();
    return (
      <div className="mx-auto max-w-sm">
        <div className="no-print mb-4 flex justify-end"><PrintButton /></div>
        <article className="rounded-xl border border-border bg-white p-5 font-mono text-[13px] text-black">
          <p className="text-center text-base font-bold uppercase">{ctx.org.name}</p>
          {ctx.org.phone && <p className="text-center">Tél. {ctx.org.phone}</p>}
          <hr className="my-3 border-dashed border-black/40" />
          <p className="font-bold">REÇU DE REMBOURSEMENT {p.number}</p>
          <p>{formatDate(p.created_at, true)}</p>
          <p>Client : {c.name}</p>
          <hr className="my-3 border-dashed border-black/40" />
          <p className="flex justify-between text-base font-bold"><span>Montant reçu</span><span>{formatMoney(p.amount)}</span></p>
          <p>Mode : {PAYMENT_METHODS[p.method as PaymentMethod]}{p.reference ? ` (${p.reference})` : ""}</p>
          {p.note && <p>Note : {p.note}</p>}
          <p className="mt-2 flex justify-between"><span>Solde restant à ce jour</span><span>{formatMoney(b?.balance_due ?? 0)}</span></p>
          <hr className="my-3 border-dashed border-black/40" />
          <p className="text-center">Merci !</p>
        </article>
      </div>
    );
  }

  const [{ data: sales }, { data: payments }, { data: returns }] = await Promise.all([
    ctx.supabase.from("sales").select("number, created_at, total, paid_at_checkout, status").eq("customer_id", id).eq("status", "completed"),
    ctx.supabase.from("customer_payments").select("number, created_at, amount, method").eq("customer_id", id),
    ctx.supabase.from("sale_returns").select("amount, refunded_amount, created_at, sale:sales!inner(number, customer_id, status)").eq("sale.customer_id", id).eq("sale.status", "completed"),
  ]);
  type Line = { date: string; label: string; debit: number; credit: number };
  const lines: Line[] = [];
  for (const s of sales ?? []) {
    lines.push({ date: s.created_at, label: `Vente ${s.number}`, debit: Number(s.total), credit: 0 });
    if (Number(s.paid_at_checkout) > 0) lines.push({ date: s.created_at, label: `Payé à la vente ${s.number}`, debit: 0, credit: Number(s.paid_at_checkout) });
  }
  for (const r of returns ?? []) {
    const num = (r.sale as unknown as { number: string }).number;
    lines.push({ date: r.created_at, label: `Retour sur ${num}`, debit: 0, credit: Number(r.amount) });
    if (Number(r.refunded_amount) > 0) lines.push({ date: r.created_at, label: `Remboursé au client (retour ${num})`, debit: Number(r.refunded_amount), credit: 0 });
  }
  for (const p of payments ?? []) lines.push({ date: p.created_at, label: `Remboursement ${p.number} (${PAYMENT_METHODS[p.method as PaymentMethod]})`, debit: 0, credit: Number(p.amount) });
  lines.sort((a, b) => a.date.localeCompare(b.date));
  let running = 0;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="no-print mb-4 flex justify-end"><PrintButton label="Imprimer le relevé" /></div>
      <article className="rounded-xl border border-border bg-white p-8 text-sm text-black">
        <header className="flex justify-between gap-6">
          <div>
            <p className="text-lg font-bold">{ctx.org.name}</p>
            <p>{[ctx.org.address, ctx.org.city].filter(Boolean).join(", ")}</p>
            {ctx.org.phone && <p>Tél. {ctx.org.phone}</p>}
          </div>
          <div className="text-right">
            <p className="text-lg font-bold">Relevé de compte client</p>
            <p>Édité le {formatDate(new Date(), true)}</p>
            <p className="mt-2 font-semibold">{c.name}</p>
            {c.phone && <p>{c.phone}</p>}
          </div>
        </header>
        <table className="mt-6 w-full border-collapse">
          <thead><tr className="border-b border-black text-left"><th className="py-1.5">Date</th><th>Libellé</th><th className="text-right">Débit</th><th className="text-right">Crédit</th><th className="text-right">Solde</th></tr></thead>
          <tbody>
            {lines.map((l, i) => {
              running += l.debit - l.credit;
              return (
                <tr key={i} className="border-b border-black/10">
                  <td className="py-1.5">{formatDate(l.date)}</td>
                  <td>{l.label}</td>
                  <td className="text-right">{l.debit ? formatMoney(l.debit, false) : ""}</td>
                  <td className="text-right">{l.credit ? formatMoney(l.credit, false) : ""}</td>
                  <td className="text-right font-semibold">{formatMoney(running, false)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="mt-4 text-right text-base font-bold">Solde dû : {formatMoney(running)}</p>
      </article>
    </div>
  );
}
