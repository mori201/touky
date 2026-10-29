"use client";

import { useMemo, useState, useTransition } from "react";
import Papa from "papaparse";
import { useRouter } from "next/navigation";
import { Alert, Button, Card, CardBody, Select, Table, TD, TH } from "@/components/ui";
import { formatMoney } from "@/lib/format";
import { importProductsAction, type ImportRow } from "../actions";

const COLUMNS: { key: keyof ImportRow; label: string; aliases: string[] }[] = [
  { key: "name", label: "nom", aliases: ["nom", "name", "produit", "designation", "désignation"] },
  { key: "sku", label: "reference", aliases: ["reference", "référence", "sku", "ref"] },
  { key: "barcode", label: "code_barres", aliases: ["code_barres", "code-barres", "codebarre", "barcode", "ean"] },
  { key: "category", label: "categorie", aliases: ["categorie", "catégorie", "category", "rayon"] },
  { key: "unit", label: "unite", aliases: ["unite", "unité", "unit"] },
  { key: "purchase_price", label: "prix_achat", aliases: ["prix_achat", "prix d'achat", "cout", "coût", "purchase_price"] },
  { key: "sale_price", label: "prix_vente", aliases: ["prix_vente", "prix de vente", "prix", "sale_price"] },
  { key: "wholesale_price", label: "prix_gros", aliases: ["prix_gros", "prix de gros", "wholesale_price"] },
  { key: "min_stock", label: "stock_min", aliases: ["stock_min", "seuil", "stock minimum", "min_stock"] },
  { key: "quantity", label: "quantite", aliases: ["quantite", "quantité", "stock", "qte", "quantity"] },
];

const norm = (s: string) => s.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const toNum = (s?: string) => {
  if (s == null || s.trim() === "") return null;
  const n = Number(s.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
};

export function CsvImporter({
  locations, defaultLocation, existingSkus, existingBarcodes, canCosts, canStock,
}: {
  locations: { id: string; name: string }[];
  defaultLocation: string;
  existingSkus: string[];
  existingBarcodes: string[];
  canCosts: boolean;
  canStock: boolean;
}) {
  const router = useRouter();
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [location, setLocation] = useState(defaultLocation);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, start] = useTransition();

  function onFile(file: File) {
    setResult(null);
    setFileName(file.name);
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: (h) => {
        const n = norm(h);
        return COLUMNS.find((c) => c.aliases.map(norm).includes(n))?.key ?? n;
      },
      complete: (res) => setRows(res.data.map((r) => Object.fromEntries(COLUMNS.map((c) => [c.key, (r[c.key] ?? "").toString().trim()])) as unknown as ImportRow)),
      error: () => setResult({ ok: false, message: "Fichier illisible. Enregistrez-le au format CSV (UTF-8)." }),
    });
  }

  const errors = useMemo(() => {
    const skus = new Set(existingSkus);
    const bars = new Set(existingBarcodes);
    const seenSku = new Set<string>();
    const seenBar = new Set<string>();
    return rows.map((r) => {
      const e: string[] = [];
      if (!r.name) e.push("nom manquant");
      const price = toNum(r.sale_price);
      if (price == null || Number.isNaN(price) || price < 0) e.push("prix de vente invalide");
      for (const k of ["purchase_price", "wholesale_price", "min_stock", "quantity"] as const) {
        const n = toNum(r[k]);
        if (n != null && (Number.isNaN(n) || n < 0)) e.push(`${k} invalide`);
      }
      const sku = r.sku?.toLowerCase();
      if (sku) {
        if (skus.has(sku)) e.push("référence déjà utilisée");
        if (seenSku.has(sku)) e.push("référence en double dans le fichier");
        seenSku.add(sku);
      }
      if (r.barcode) {
        if (bars.has(r.barcode)) e.push("code-barres déjà utilisé");
        if (seenBar.has(r.barcode)) e.push("code-barres en double dans le fichier");
        seenBar.add(r.barcode);
      }
      return e;
    });
  }, [rows, existingSkus, existingBarcodes]);

  const invalid = errors.filter((e) => e.length).length;
  const template = `${COLUMNS.map((c) => c.label).join(";")}\nEau minérale 1,5 L;EAU15;6001234567890;Boissons;bouteille;300;500;450;12;48\nRiz brisé 1 kg;RIZ1;;Épicerie;kg;450;600;550;20;100\n`;

  return (
    <div className="space-y-5">
      <Card>
        <CardBody className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex h-10 cursor-pointer items-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-fg">
              Choisir un fichier CSV
              <input type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
            </label>
            <a href={`data:text/csv;charset=utf-8,${encodeURIComponent("﻿" + template)}`} download="modele-catalogue-menjef.csv" className="text-sm font-semibold text-primary">
              Télécharger le modèle
            </a>
            {fileName && <span className="text-sm text-fg-muted">{fileName} · {rows.length} ligne(s)</span>}
          </div>
          <p className="text-sm text-fg-muted">
            Colonnes reconnues : {COLUMNS.map((c) => c.label).join(", ")}. Séparateur « ; » ou « , ». Seuls <strong>nom</strong> et <strong>prix_vente</strong> sont obligatoires.
            {!canCosts && " Les prix d'achat seront ignorés (permission requise)."}
          </p>
          {canStock && locations.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span>Stock initial dans :</span>
              <Select value={location} onChange={(e) => setLocation(e.target.value)} className="w-auto">
                {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </Select>
            </div>
          )}
        </CardBody>
      </Card>

      {result && <Alert tone={result.ok ? "success" : "danger"}>{result.message}</Alert>}

      {rows.length > 0 && (
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
            <p className="text-sm">
              <strong>{rows.length}</strong> ligne(s) · {invalid ? <span className="font-bold text-danger">{invalid} ligne(s) à corriger</span> : <span className="font-bold text-success">aucune erreur détectée</span>}
            </p>
            <Button
              disabled={pending || invalid > 0}
              onClick={() =>
                start(async () => {
                  const r = await importProductsAction(rows, location);
                  setResult(r);
                  if (r.ok) {
                    setRows([]);
                    router.refresh();
                  }
                })
              }
            >
              {pending ? "Import en cours…" : `Importer ${rows.length} produit(s)`}
            </Button>
          </div>
          <Table className="max-h-[60vh]">
            <thead><tr><TH>#</TH><TH>Nom</TH><TH>Référence</TH><TH>Catégorie</TH><TH className="text-right">Prix de vente</TH><TH className="text-right">Quantité</TH><TH>Contrôle</TH></tr></thead>
            <tbody>
              {rows.slice(0, 500).map((r, i) => (
                <tr key={i} className={errors[i].length ? "bg-danger/5" : ""}>
                  <TD className="text-fg-muted">{i + 1}</TD>
                  <TD className="font-semibold">{r.name || "—"}</TD>
                  <TD>{r.sku || "—"}</TD>
                  <TD>{r.category || "—"}</TD>
                  <TD className="num text-right">{toNum(r.sale_price) != null && !Number.isNaN(toNum(r.sale_price)) ? formatMoney(toNum(r.sale_price)) : r.sale_price || "—"}</TD>
                  <TD className="num text-right">{r.quantity || "0"}</TD>
                  <TD>{errors[i].length ? <span className="text-xs font-semibold text-danger">{errors[i].join(", ")}</span> : <span className="text-xs font-semibold text-success">OK</span>}</TD>
                </tr>
              ))}
            </tbody>
          </Table>
          {rows.length > 500 && <p className="px-5 py-3 text-xs text-fg-muted">Aperçu limité aux 500 premières lignes ; toutes les lignes sont contrôlées.</p>}
        </Card>
      )}
    </div>
  );
}
