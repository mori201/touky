"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Alert, Button, Card, CardBody, Field, Input, Select, Textarea } from "@/components/ui";
import { formatMoney } from "@/lib/format";
import { createPurchaseOrder } from "../actions";

interface P { id: string; name: string; sku: string | null; unit: string; supplier_id: string | null; cost: number }
interface Line { product_id: string; quantity: string; unit_cost: string }
const num = (s: string) => Number(String(s).replace(/\s/g, "").replace(",", "."));

export function PurchaseOrderForm({ suppliers, products, locations, defaultLocation, defaultSupplier }: { suppliers: { id: string; name: string }[]; products: P[]; locations: { id: string; name: string }[]; defaultLocation: string; defaultSupplier: string }) {
  const router = useRouter();
  const [supplier, setSupplier] = useState(defaultSupplier || suppliers[0]?.id || "");
  const [location, setLocation] = useState(defaultLocation);
  const [lines, setLines] = useState<Line[]>([{ product_id: "", quantity: "", unit_cost: "" }]);
  const [expected, setExpected] = useState("");
  const [ref, setRef] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const total = lines.reduce((s, l) => s + (num(l.quantity) || 0) * (num(l.unit_cost) || 0), 0);
  const ordered = [...products].sort((a, b) => Number(b.supplier_id === supplier) - Number(a.supplier_id === supplier));

  function submit(status: "draft" | "ordered") {
    setError(null);
    const items = lines.filter((l) => l.product_id).map((l) => ({ product_id: l.product_id, quantity: num(l.quantity), unit_cost: num(l.unit_cost) || 0 }));
    if (items.some((i) => !(i.quantity > 0))) return setError("Chaque ligne doit avoir une quantité positive.");
    start(async () => {
      const r = await createPurchaseOrder({ supplier_id: supplier, location_id: location, status, expected_date: expected || null, invoice_ref: ref || null, note: note || null, items });
      if (!r.ok) return setError(r.error);
      router.push(`/app/achats/${r.id}`);
    });
  }

  return (
    <Card>
      <CardBody className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Fournisseur" htmlFor="supplier"><Select id="supplier" value={supplier} onChange={(e) => setSupplier(e.target.value)}>{suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></Field>
          <Field label="Établissement de livraison" htmlFor="location"><Select id="location" value={location} onChange={(e) => setLocation(e.target.value)}>{locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</Select></Field>
          <Field label="Livraison prévue" htmlFor="expected"><Input id="expected" type="date" value={expected} onChange={(e) => setExpected(e.target.value)} /></Field>
          <Field label="Réf. facture fournisseur" htmlFor="ref"><Input id="ref" value={ref} onChange={(e) => setRef(e.target.value)} /></Field>
        </div>
        <div className="space-y-2">
          <div className="hidden grid-cols-[1fr_120px_140px_120px_40px] gap-2 text-xs font-bold uppercase text-fg-muted sm:grid">
            <span>Produit</span><span>Quantité</span><span>Coût unitaire</span><span className="text-right">Total</span><span />
          </div>
          {lines.map((l, i) => (
            <div key={i} className="grid grid-cols-2 gap-2 sm:grid-cols-[1fr_120px_140px_120px_40px]">
              <Select
                value={l.product_id}
                onChange={(e) => {
                  const p = products.find((x) => x.id === e.target.value);
                  setLines((ls) => ls.map((x, j) => (j === i ? { ...x, product_id: e.target.value, unit_cost: x.unit_cost || (p?.cost ? String(p.cost) : "") } : x)));
                }}
                className="col-span-2 sm:col-span-1"
                aria-label="Produit"
              >
                <option value="">— Choisir un produit —</option>
                {ordered.map((p) => <option key={p.id} value={p.id}>{p.name}{p.sku ? ` (${p.sku})` : ""}</option>)}
              </Select>
              <Input value={l.quantity} onChange={(e) => setLines((ls) => ls.map((x, j) => (j === i ? { ...x, quantity: e.target.value } : x)))} inputMode="decimal" placeholder="Qté" aria-label="Quantité" />
              <Input value={l.unit_cost} onChange={(e) => setLines((ls) => ls.map((x, j) => (j === i ? { ...x, unit_cost: e.target.value } : x)))} inputMode="decimal" placeholder="Coût" aria-label="Coût unitaire" />
              <span className="num self-center text-right text-sm font-semibold">{formatMoney((num(l.quantity) || 0) * (num(l.unit_cost) || 0))}</span>
              <button type="button" onClick={() => setLines((ls) => (ls.length > 1 ? ls.filter((_, j) => j !== i) : ls))} className="grid h-10 w-10 place-items-center rounded-lg text-danger hover:bg-danger/10" aria-label="Retirer la ligne"><Trash2 size={16} /></button>
            </div>
          ))}
          <Button type="button" variant="ghost" size="sm" onClick={() => setLines((ls) => [...ls, { product_id: "", quantity: "", unit_cost: "" }])}>+ Ajouter une ligne</Button>
        </div>
        <Field label="Note" htmlFor="note"><Textarea id="note" value={note} onChange={(e) => setNote(e.target.value)} /></Field>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
          <p className="font-display text-lg font-bold">Total : <span className="num">{formatMoney(total)}</span></p>
          <div className="flex gap-2">
            <Button variant="outline" disabled={pending} onClick={() => submit("draft")}>Enregistrer en brouillon</Button>
            <Button disabled={pending} onClick={() => submit("ordered")}>{pending ? "Enregistrement…" : "Passer la commande"}</Button>
          </div>
        </div>
        {error && <Alert tone="danger">{error}</Alert>}
      </CardBody>
    </Card>
  );
}
