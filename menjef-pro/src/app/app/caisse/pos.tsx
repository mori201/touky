"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Minus, Plus, ScanLine, Search, Trash2, UserPlus, X } from "lucide-react";
import { Alert, Button, Input, Select } from "@/components/ui";
import { PAYMENT_METHODS, type PaymentMethod } from "@/lib/constants";
import { formatMoney, formatQty, todayISO } from "@/lib/format";
import { cn } from "@/lib/utils";
import { createSale, quickCreateCustomer, type SaleResult } from "./actions";

export interface PosProduct {
  id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  category_id: string | null;
  unit: string;
  price: number;
  wholesale: number | null;
  track: boolean;
  stock: number;
}

interface CartLine {
  product: PosProduct;
  quantity: number;
  discount: number;
}

interface PaymentLine {
  method: PaymentMethod;
  amount: string;
  reference: string;
}

function newKey() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

const num = (s: string) => {
  const n = Number(String(s).replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

export function Pos({
  products,
  categories,
  customers: initialCustomers,
  locations,
  locationId,
  methods,
  taxRate,
  canDiscount,
  canCredit,
  canCreateCustomer,
  allowNegative,
}: {
  products: PosProduct[];
  categories: { id: string; name: string }[];
  customers: { id: string; name: string; phone: string | null }[];
  locations: { id: string; name: string }[];
  locationId: string;
  methods: PaymentMethod[];
  taxRate: number;
  canDiscount: boolean;
  canCredit: boolean;
  canCreateCustomer: boolean;
  allowNegative: boolean;
}) {
  const router = useRouter();
  const searchRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [priceMode, setPriceMode] = useState<"retail" | "wholesale">("retail");
  const [globalDiscount, setGlobalDiscount] = useState("");
  const [payments, setPayments] = useState<PaymentLine[]>([{ method: "cash", amount: "", reference: "" }]);
  const [received, setReceived] = useState("");
  const [customers, setCustomers] = useState(initialCustomers);
  const [customerId, setCustomerId] = useState("");
  const [customerQuery, setCustomerQuery] = useState("");
  const [newCustomer, setNewCustomer] = useState<{ name: string; phone: string } | null>(null);
  const [dueDate, setDueDate] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Extract<SaleResult, { ok: true }> | null>(null);
  const [pending, startTransition] = useTransition();
  // Clé d'idempotence : conservée jusqu'au succès pour qu'un nouvel essai ne crée pas de doublon
  const keyRef = useRef<string>(newKey());

  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  const unitPrice = (p: PosProduct) => (priceMode === "wholesale" && p.wholesale != null ? p.wholesale : p.price);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products
      .filter((p) => !category || p.category_id === category)
      .filter((p) => !q || p.name.toLowerCase().includes(q) || p.sku?.toLowerCase().includes(q) || p.barcode === q)
      .slice(0, 120);
  }, [products, query, category]);

  const subtotal = cart.reduce((s, l) => s + unitPrice(l.product) * l.quantity, 0);
  const lineDiscounts = cart.reduce((s, l) => s + l.discount, 0);
  const discount = canDiscount ? Math.max(0, num(globalDiscount)) : 0;
  const net = Math.max(0, subtotal - lineDiscounts - discount);
  const tax = taxRate > 0 ? Math.round((net * taxRate) / 100) : 0;
  const total = Math.round(net + tax);
  const paid = payments.reduce((s, p) => s + Math.max(0, num(p.amount)), 0);
  const cashPaid = payments.filter((p) => p.method === "cash").reduce((s, p) => s + Math.max(0, num(p.amount)), 0);
  const balance = Math.max(0, total - paid);
  const receivedNum = received === "" ? null : num(received);
  const change = receivedNum != null ? receivedNum - cashPaid : null;
  const overpaid = paid > total;

  function add(p: PosProduct) {
    setError(null);
    setCart((c) => {
      const i = c.findIndex((l) => l.product.id === p.id);
      const current = i >= 0 ? c[i].quantity : 0;
      if (p.track && !allowNegative && current + 1 > p.stock) {
        setError(`Stock insuffisant pour « ${p.name} » (disponible : ${formatQty(p.stock)}).`);
        return c;
      }
      if (i >= 0) {
        const next = [...c];
        next[i] = { ...next[i], quantity: current + 1 };
        return next;
      }
      return [...c, { product: p, quantity: 1, discount: 0 }];
    });
  }

  function setQty(id: string, q: number) {
    setCart((c) =>
      c.flatMap((l) => {
        if (l.product.id !== id) return [l];
        if (q <= 0) return [];
        if (l.product.track && !allowNegative && q > l.product.stock) {
          setError(`Stock insuffisant pour « ${l.product.name} » (disponible : ${formatQty(l.product.stock)}).`);
          return [{ ...l, quantity: l.product.stock }];
        }
        return [{ ...l, quantity: q }];
      }),
    );
  }

  function onSearchKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    // Douchette : le code-barres est saisi puis « Entrée »
    const exact = products.find((p) => p.barcode === q || p.sku?.toLowerCase() === q.toLowerCase());
    const target = exact ?? (filtered.length === 1 ? filtered[0] : undefined);
    if (target) {
      add(target);
      setQuery("");
    } else {
      setError(`Aucun produit ne correspond à « ${q} ».`);
    }
  }

  function payAll(method: PaymentMethod) {
    setPayments([{ method, amount: String(total), reference: "" }]);
    if (method !== "cash") setReceived("");
  }

  function reset() {
    setCart([]);
    setPayments([{ method: "cash", amount: "", reference: "" }]);
    setReceived("");
    setGlobalDiscount("");
    setCustomerId("");
    setCustomerQuery("");
    setDueDate("");
    setNote("");
    setError(null);
    keyRef.current = newKey();
    searchRef.current?.focus();
  }

  async function addCustomer() {
    if (!newCustomer) return;
    const r = await quickCreateCustomer(newCustomer.name, newCustomer.phone);
    if (!r.ok) return setError(r.error);
    setCustomers((c) => [...c, { id: r.id, name: r.name, phone: r.phone }].sort((a, b) => a.name.localeCompare(b.name)));
    setCustomerId(r.id);
    setNewCustomer(null);
  }

  function submit() {
    setError(null);
    if (cart.length === 0) return setError("Le panier est vide.");
    if (overpaid) return setError("Le total des paiements dépasse le montant à payer. Utilisez « Montant reçu » pour la monnaie.");
    if (balance > 0 && !customerId) return setError("Sélectionnez un client pour une vente à crédit ou un paiement partiel.");
    if (balance > 0 && !canCredit) return setError("Vous n'êtes pas autorisé à vendre à crédit.");
    if (change != null && change < 0) return setError("Le montant reçu est inférieur au paiement en espèces.");
    startTransition(async () => {
      const r = await createSale({
        location_id: locationId,
        items: cart.map((l) => ({ product_id: l.product.id, quantity: l.quantity, discount: canDiscount ? l.discount : 0 })),
        payments: payments.map((p) => ({ method: p.method, amount: Math.max(0, num(p.amount)), reference: p.reference || undefined })),
        customer_id: customerId || null,
        price_mode: priceMode,
        discount,
        amount_received: receivedNum,
        due_date: balance > 0 && dueDate ? dueDate : null,
        note: note || null,
        idempotency_key: keyRef.current,
      });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setResult(r);
      reset();
      router.refresh();
    });
  }

  const customerOptions = useMemo(() => {
    const q = customerQuery.trim().toLowerCase();
    return customers.filter((c) => !q || c.name.toLowerCase().includes(q) || c.phone?.includes(q)).slice(0, 50);
  }, [customers, customerQuery]);

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_400px]">
      {/* Catalogue */}
      <section aria-label="Produits" className="min-w-0">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fg-muted" size={18} />
            <Input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onSearchKey}
              placeholder="Nom, référence ou code-barres puis Entrée"
              className="h-12 pl-10 text-base"
              aria-label="Rechercher un produit"
            />
            <ScanLine className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-fg-muted" size={18} />
          </div>
          {locations.length > 1 && (
            <Select
              value={locationId}
              onChange={(e) => router.push(`/app/caisse?etablissement=${e.target.value}`)}
              className="h-12 w-auto"
              aria-label="Établissement de vente"
              disabled={cart.length > 0}
            >
              {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </Select>
          )}
        </div>
        <div className="mb-3 flex gap-1.5 overflow-x-auto pb-1">
          <button onClick={() => setCategory("")} className={cn("whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-bold", !category ? "border-primary bg-primary text-primary-fg" : "border-border bg-surface text-fg-muted")}>
            Tout
          </button>
          {categories.map((c) => (
            <button key={c.id} onClick={() => setCategory(c.id)} className={cn("whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-bold", category === c.id ? "border-primary bg-primary text-primary-fg" : "border-border bg-surface text-fg-muted")}>
              {c.name}
            </button>
          ))}
        </div>

        {products.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-10 text-center">
            <p className="font-semibold">Votre catalogue est vide.</p>
            <Link href="/app/produits/nouveau" className="mt-2 inline-block text-sm font-bold text-primary">Ajouter un produit →</Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
            {filtered.map((p) => {
              const out = p.track && p.stock <= 0;
              return (
                <button
                  key={p.id}
                  onClick={() => add(p)}
                  disabled={out && !allowNegative}
                  className="focus-ring flex min-h-[92px] flex-col justify-between rounded-xl border border-border bg-surface p-3 text-left shadow-sm transition hover:border-primary active:scale-[0.98] disabled:opacity-45"
                >
                  <span className="line-clamp-2 text-sm font-semibold leading-snug">{p.name}</span>
                  <span className="mt-2 flex items-end justify-between gap-1">
                    <span className="num font-display text-sm font-extrabold text-primary">{formatMoney(unitPrice(p))}</span>
                    {p.track && (
                      <span className={cn("text-[0.68rem] font-bold", out ? "text-danger" : p.stock <= 5 ? "text-warning" : "text-fg-muted")}>
                        {out ? "Rupture" : `${formatQty(p.stock)} ${p.unit}`}
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* Panier et paiement */}
      <aside aria-label="Panier" className="lg:sticky lg:top-24 lg:self-start">
        <div className="rounded-2xl border border-border bg-surface shadow-card">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 className="font-display font-bold">Panier ({cart.reduce((s, l) => s + l.quantity, 0)})</h2>
            <div className="flex items-center gap-2">
              {products.some((p) => p.wholesale != null) && (
                <Select value={priceMode} onChange={(e) => setPriceMode(e.target.value as "retail" | "wholesale")} className="h-8 w-auto py-0 text-xs" aria-label="Type de prix">
                  <option value="retail">Prix détail</option>
                  <option value="wholesale">Prix de gros</option>
                </Select>
              )}
              {cart.length > 0 && <button onClick={reset} className="text-xs font-semibold text-danger">Vider</button>}
            </div>
          </div>

          <div className="max-h-[38vh] overflow-y-auto px-4">
            {cart.length === 0 ? (
              <p className="py-8 text-center text-sm text-fg-muted">Touchez un produit pour l&apos;ajouter.</p>
            ) : (
              <ul className="divide-y divide-border">
                {cart.map((l) => (
                  <li key={l.product.id} className="py-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{l.product.name}</p>
                        <p className="num text-xs text-fg-muted">{formatMoney(unitPrice(l.product))} × {formatQty(l.quantity)}</p>
                      </div>
                      <p className="num shrink-0 text-sm font-bold">{formatMoney(unitPrice(l.product) * l.quantity - l.discount)}</p>
                    </div>
                    <div className="mt-2 flex items-center gap-1.5">
                      <button onClick={() => setQty(l.product.id, l.quantity - 1)} className="grid h-9 w-9 place-items-center rounded-lg border border-border" aria-label="Diminuer"><Minus size={16} /></button>
                      <input
                        value={l.quantity}
                        onChange={(e) => setQty(l.product.id, num(e.target.value))}
                        inputMode="decimal"
                        className="input h-9 w-16 px-2 text-center"
                        aria-label={`Quantité de ${l.product.name}`}
                      />
                      <button onClick={() => setQty(l.product.id, l.quantity + 1)} className="grid h-9 w-9 place-items-center rounded-lg border border-border" aria-label="Augmenter"><Plus size={16} /></button>
                      {canDiscount && (
                        <input
                          value={l.discount || ""}
                          onChange={(e) => {
                            const d = Math.max(0, Math.min(num(e.target.value), unitPrice(l.product) * l.quantity));
                            setCart((c) => c.map((x) => (x.product.id === l.product.id ? { ...x, discount: d } : x)));
                          }}
                          inputMode="decimal"
                          placeholder="Remise"
                          className="input h-9 min-w-0 flex-1 px-2 text-xs"
                          aria-label={`Remise sur ${l.product.name}`}
                        />
                      )}
                      <button onClick={() => setQty(l.product.id, 0)} className="ml-auto grid h-9 w-9 place-items-center rounded-lg text-danger hover:bg-danger/10" aria-label="Retirer"><Trash2 size={16} /></button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="space-y-1.5 border-t border-border px-4 py-3 text-sm">
            <div className="flex justify-between"><span className="text-fg-muted">Sous-total</span><span className="num">{formatMoney(subtotal)}</span></div>
            {(lineDiscounts > 0 || canDiscount) && (
              <div className="flex items-center justify-between gap-2">
                <span className="text-fg-muted">Remises</span>
                <span className="flex items-center gap-2">
                  {canDiscount && (
                    <input value={globalDiscount} onChange={(e) => setGlobalDiscount(e.target.value)} inputMode="decimal" placeholder="Remise globale" className="input h-8 w-28 px-2 text-xs" aria-label="Remise globale" />
                  )}
                  <span className="num">− {formatMoney(lineDiscounts + discount)}</span>
                </span>
              </div>
            )}
            {taxRate > 0 && <div className="flex justify-between"><span className="text-fg-muted">TVA ({taxRate} %)</span><span className="num">{formatMoney(tax)}</span></div>}
            <div className="flex items-baseline justify-between pt-1">
              <span className="font-display font-bold">Total à payer</span>
              <span className="num font-display text-2xl font-extrabold text-primary">{formatMoney(total)}</span>
            </div>
          </div>

          {/* Paiement */}
          <div className="space-y-3 border-t border-border px-4 py-3">
            <div className="flex flex-wrap gap-1.5">
              {methods.map((m) => (
                <button key={m} onClick={() => payAll(m)} className={cn("rounded-lg border px-2.5 py-1.5 text-xs font-bold", payments.length === 1 && payments[0].method === m ? "border-primary bg-primary/10 text-primary" : "border-border")}>
                  {PAYMENT_METHODS[m]}
                </button>
              ))}
            </div>
            {payments.map((p, i) => (
              <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-1.5">
                <Select
                  value={p.method}
                  onChange={(e) => setPayments((ps) => ps.map((x, j) => (j === i ? { ...x, method: e.target.value as PaymentMethod } : x)))}
                  className="h-10 py-1 text-sm"
                  aria-label="Mode de paiement"
                >
                  {methods.map((m) => <option key={m} value={m}>{PAYMENT_METHODS[m]}</option>)}
                </Select>
                <Input
                  value={p.amount}
                  onChange={(e) => setPayments((ps) => ps.map((x, j) => (j === i ? { ...x, amount: e.target.value } : x)))}
                  inputMode="decimal"
                  placeholder="Montant"
                  className="h-10"
                  aria-label="Montant payé"
                />
                <button
                  onClick={() => setPayments((ps) => (ps.length > 1 ? ps.filter((_, j) => j !== i) : [{ method: "cash", amount: "", reference: "" }]))}
                  className="grid h-10 w-10 place-items-center rounded-lg text-fg-muted hover:bg-muted"
                  aria-label="Retirer ce paiement"
                >
                  <X size={16} />
                </button>
                {p.method !== "cash" && (
                  <Input
                    value={p.reference}
                    onChange={(e) => setPayments((ps) => ps.map((x, j) => (j === i ? { ...x, reference: e.target.value } : x)))}
                    placeholder="Référence de transaction (facultatif)"
                    className="col-span-3 h-9 text-xs"
                    aria-label="Référence de transaction"
                  />
                )}
              </div>
            ))}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <button onClick={() => setPayments((ps) => [...ps, { method: methods.find((m) => m !== "cash") ?? "cash", amount: balance ? String(balance) : "", reference: "" }])} className="text-xs font-bold text-primary">
                + Paiement mixte
              </button>
              <button onClick={() => setPayments((ps) => ps.map((x, j) => (j === ps.length - 1 ? { ...x, amount: String(Math.max(0, total - ps.slice(0, -1).reduce((s, y) => s + num(y.amount), 0))) } : x)))} className="text-xs font-bold text-primary">
                Compléter le reste
              </button>
            </div>
            {payments.some((p) => p.method === "cash") && (
              <div className="grid grid-cols-2 items-center gap-2">
                <label htmlFor="received" className="text-sm text-fg-muted">Montant reçu (espèces)</label>
                <Input id="received" value={received} onChange={(e) => setReceived(e.target.value)} inputMode="decimal" className="h-10" />
                {change != null && (
                  <p className={cn("col-span-2 rounded-lg px-3 py-2 text-sm font-bold", change < 0 ? "bg-danger/10 text-danger" : "bg-success/10 text-success")}>
                    {change < 0 ? `Il manque ${formatMoney(-change)}` : `Monnaie à rendre : ${formatMoney(change)}`}
                  </p>
                )}
              </div>
            )}
            {payments.some((p) => p.method !== "cash") && (
              <p className="text-xs text-fg-muted">Paiement Mobile Money / banque déclaré : vérifiez sa réception avant de valider.</p>
            )}

            {/* Client */}
            <div className="rounded-xl bg-muted/60 p-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-wide text-fg-muted">Client {balance > 0 ? <span className="text-danger">(obligatoire)</span> : "(facultatif)"}</p>
                {canCreateCustomer && !newCustomer && (
                  <button onClick={() => setNewCustomer({ name: customerQuery, phone: "" })} className="flex items-center gap-1 text-xs font-bold text-primary"><UserPlus size={14} /> Nouveau</button>
                )}
              </div>
              {newCustomer ? (
                <div className="mt-2 grid gap-1.5">
                  <Input value={newCustomer.name} onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })} placeholder="Nom du client" className="h-9" aria-label="Nom du nouveau client" />
                  <Input value={newCustomer.phone} onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })} placeholder="Téléphone" className="h-9" inputMode="tel" aria-label="Téléphone du nouveau client" />
                  <div className="flex gap-2">
                    <Button size="sm" type="button" onClick={addCustomer}>Créer</Button>
                    <Button size="sm" type="button" variant="ghost" onClick={() => setNewCustomer(null)}>Annuler</Button>
                  </div>
                </div>
              ) : (
                <div className="mt-2 grid gap-1.5">
                  <Input value={customerQuery} onChange={(e) => setCustomerQuery(e.target.value)} placeholder="Rechercher par nom ou téléphone" className="h-9" aria-label="Rechercher un client" />
                  <Select value={customerId} onChange={(e) => setCustomerId(e.target.value)} className="h-9 py-1 text-sm" aria-label="Client">
                    <option value="">— Client anonyme —</option>
                    {customerOptions.map((c) => <option key={c.id} value={c.id}>{c.name}{c.phone ? ` · ${c.phone}` : ""}</option>)}
                  </Select>
                </div>
              )}
              {balance > 0 && (
                <div className="mt-2 grid grid-cols-2 items-center gap-2 text-sm">
                  <span className="font-semibold text-warning">Reste dû : {formatMoney(balance)}</span>
                  <Input type="date" value={dueDate} min={todayISO()} onChange={(e) => setDueDate(e.target.value)} className="h-9" aria-label="Échéance du crédit" />
                </div>
              )}
            </div>
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (facultatif)" className="h-9 text-sm" aria-label="Note" />

            {error && <Alert tone="danger">{error}</Alert>}
            <Button onClick={submit} disabled={pending || cart.length === 0} size="lg" variant="accent" className="w-full">
              {pending ? "Validation…" : `Valider la vente · ${formatMoney(total)}`}
            </Button>
          </div>
        </div>
      </aside>

      {/* Barre mobile */}
      {cart.length > 0 && !result && (
        <a href="#panier-total" className="fixed inset-x-3 bottom-3 z-30 flex items-center justify-between rounded-2xl bg-navy px-4 py-3 text-white shadow-2xl lg:hidden" onClick={(e) => { e.preventDefault(); document.querySelector("aside[aria-label=Panier]")?.scrollIntoView({ behavior: "smooth" }); }}>
          <span className="text-sm font-semibold">Panier · {cart.length} article(s)</span>
          <span className="num font-display font-extrabold">{formatMoney(total)} →</span>
        </a>
      )}

      {result && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-navy/60 p-4" role="dialog" aria-modal="true" aria-label="Vente enregistrée">
          <div className="w-full max-w-sm rounded-2xl bg-surface p-6 text-center shadow-2xl">
            <p className="text-4xl">✅</p>
            <h2 className="mt-2 font-display text-xl font-extrabold">Vente {result.number} enregistrée</h2>
            {result.duplicate && <p className="mt-1 text-xs text-fg-muted">Cette vente avait déjà été enregistrée : aucun doublon créé.</p>}
            <p className="num mt-3 text-sm text-fg-muted">Total {formatMoney(result.total)} · Payé {formatMoney(result.paid)}</p>
            {result.balance > 0 && <p className="num mt-1 text-sm font-bold text-warning">Crédit client : {formatMoney(result.balance)}</p>}
            {result.change != null && result.change > 0 && (
              <p className="num mt-3 rounded-xl bg-success/10 py-3 font-display text-2xl font-extrabold text-success">Rendre {formatMoney(result.change)}</p>
            )}
            <div className="mt-5 grid gap-2">
              <a href={`/app/ventes/${result.id}/recu`} target="_blank" rel="noreferrer" className="inline-flex h-11 items-center justify-center rounded-lg border border-border font-semibold hover:bg-muted">Imprimer le reçu</a>
              <Button size="lg" onClick={() => setResult(null)} autoFocus>Nouvelle vente</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
