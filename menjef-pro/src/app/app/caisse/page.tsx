import type { Metadata } from "next";
import { Alert, ButtonLink, EmptyState } from "@/components/ui";
import { requirePermission } from "@/lib/context";
import { Pos, type PosProduct } from "./pos";

export const metadata: Metadata = { title: "Caisse" };

export default async function CashRegisterPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const ctx = await requirePermission("sales.create");
  const locationId = ctx.locations.some((l) => l.id === sp.etablissement) ? sp.etablissement! : ctx.operationLocationId;
  if (!locationId) {
    return <EmptyState title="Aucun établissement" description="Créez un établissement pour commencer à vendre." action={<ButtonLink href="/app/etablissements">Établissements</ButtonLink>} />;
  }

  const [{ data: products }, { data: levels }, { data: categories }, { data: customers }, { data: sessions }, { data: cashAccounts }] = await Promise.all([
    ctx.supabase
      .from("products")
      .select("id, name, sku, barcode, category_id, unit, sale_price, wholesale_price, track_stock")
      .eq("organization_id", ctx.org.id)
      .eq("is_active", true)
      .order("name")
      .limit(3000),
    ctx.supabase.from("stock_levels").select("product_id, quantity").eq("organization_id", ctx.org.id).eq("location_id", locationId),
    ctx.supabase.from("categories").select("id, name").eq("organization_id", ctx.org.id).order("name"),
    ctx.supabase.from("customers").select("id, name, phone").eq("organization_id", ctx.org.id).is("archived_at", null).order("name").limit(2000),
    ctx.can("cash.close")
      ? ctx.supabase.from("cash_sessions").select("account_id").eq("organization_id", ctx.org.id).eq("status", "open")
      : Promise.resolve({ data: null }),
    ctx.supabase.from("treasury_accounts").select("id, location_id").eq("organization_id", ctx.org.id).eq("kind", "cash").is("archived_at", null),
  ]);

  const qty = new Map((levels ?? []).map((l) => [l.product_id as string, Number(l.quantity)]));
  const list: PosProduct[] = (products ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    sku: p.sku,
    barcode: p.barcode,
    category_id: p.category_id,
    unit: p.unit,
    price: Number(p.sale_price),
    wholesale: p.wholesale_price == null ? null : Number(p.wholesale_price),
    track: p.track_stock,
    stock: qty.get(p.id) ?? 0,
  }));

  const localCash = (cashAccounts ?? []).filter((a) => a.location_id === locationId || a.location_id === null).map((a) => a.id);
  const noOpenSession = sessions && localCash.length > 0 && !sessions.some((s) => localCash.includes(s.account_id));

  return (
    <>
      {noOpenSession && (
        <Alert tone="warning" className="mb-4">
          Aucune session de caisse n&apos;est ouverte pour cet établissement. Vous pouvez vendre, mais pensez à{" "}
          <a href="/app/tresorerie/caisses" className="font-bold underline">ouvrir la caisse</a> pour contrôler le fond et les écarts.
        </Alert>
      )}
      <Pos
        products={list}
        categories={categories ?? []}
        customers={customers ?? []}
        locations={ctx.locations.map((l) => ({ id: l.id, name: l.name }))}
        locationId={locationId}
        methods={ctx.org.enabled_payment_methods}
        taxRate={ctx.org.tax_enabled ? Number(ctx.org.tax_rate) : 0}
        canDiscount={ctx.can("sales.discount")}
        canCredit={ctx.can("sales.credit")}
        canCreateCustomer={ctx.can("sales.create")}
        allowNegative={ctx.org.allow_negative_stock && ctx.can("stock.negative")}
      />
    </>
  );
}
