import type { Metadata } from "next";
import { Alert, Card, CardBody, CardHeader, Field, Input, PageHeader, Select } from "@/components/ui";
import { ActionForm, SubmitButton } from "@/components/ui/client";
import { requirePermission } from "@/lib/context";
import { PAYMENT_METHODS, SECTORS } from "@/lib/constants";
import { formatDate } from "@/lib/format";
import { saveSettings } from "./actions";

export const metadata: Metadata = { title: "Paramètres" };

export default async function SettingsPage() {
  const ctx = await requirePermission("settings.manage");
  const o = ctx.org;
  const { data: sub } = await ctx.supabase.from("subscriptions").select("plan, status, trial_ends_at").eq("organization_id", o.id).maybeSingle();
  return (
    <>
      <PageHeader title="Paramètres de l'entreprise" description="Devise : franc CFA (XOF) · fuseau horaire : Africa/Dakar" />
      {sub && (
        <Alert tone="primary" className="mb-5" title={`Formule ${sub.plan.charAt(0).toUpperCase() + sub.plan.slice(1)} · ${sub.status === "trialing" ? "période d'essai" : sub.status}`}>
          {sub.status === "trialing" && sub.trial_ends_at && <>Essai gratuit jusqu&apos;au {formatDate(sub.trial_ends_at)}. Le paiement en ligne de l&apos;abonnement n&apos;est pas encore activé.</>}
        </Alert>
      )}
      <ActionForm action={saveSettings} className="space-y-5">
        <Card>
          <CardHeader title="Identité et coordonnées" description="Affichées sur les reçus." />
          <CardBody className="grid gap-4 sm:grid-cols-2">
            <Field label="Nom de l'entreprise" htmlFor="name" required><Input id="name" name="name" defaultValue={o.name} required /></Field>
            <Field label="Secteur" htmlFor="sector"><Select id="sector" name="sector" defaultValue={o.sector}>{Object.entries(SECTORS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
            <Field label="Téléphone" htmlFor="phone"><Input id="phone" name="phone" defaultValue={o.phone ?? ""} /></Field>
            <Field label="E-mail" htmlFor="email"><Input id="email" name="email" type="email" defaultValue={o.email ?? ""} /></Field>
            <Field label="Adresse" htmlFor="address"><Input id="address" name="address" defaultValue={o.address ?? ""} /></Field>
            <Field label="Ville" htmlFor="city"><Input id="city" name="city" defaultValue={o.city ?? ""} /></Field>
            <Field label="NINEA" htmlFor="ninea"><Input id="ninea" name="ninea" defaultValue={o.ninea ?? ""} /></Field>
            <Field label="RCCM" htmlFor="rccm"><Input id="rccm" name="rccm" defaultValue={o.rccm ?? ""} /></Field>
            <Field label="Message en bas des reçus" htmlFor="receipt_footer" className="sm:col-span-2"><Input id="receipt_footer" name="receipt_footer" defaultValue={o.receipt_footer ?? ""} placeholder="Merci de votre visite !" /></Field>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Moyens de paiement" description="Proposés à la caisse. Chaque moyen doit être associé à un compte de trésorerie (menu Trésorerie)." />
          <CardBody className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {Object.entries(PAYMENT_METHODS).map(([k, v]) => (
              <label key={k} className="flex items-center gap-2 rounded-xl border border-border px-3 py-2.5 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                <input type="checkbox" name="methods" value={k} defaultChecked={o.enabled_payment_methods.includes(k as never)} disabled={k === "cash"} className="h-4 w-4" />{v}
              </label>
            ))}
            <input type="hidden" name="methods" value="cash" />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Règles de gestion" />
          <CardBody className="space-y-4 text-sm">
            <label className="flex items-start gap-3"><input type="checkbox" name="tax_enabled" defaultChecked={o.tax_enabled} className="mt-0.5 h-4 w-4" /><span><strong>Appliquer une taxe sur les ventes</strong><br /><span className="text-fg-muted">À activer uniquement si votre régime fiscal l&apos;exige (ex. TVA de 18 % au Sénégal).</span></span></label>
            <Field label="Taux de taxe (%)" htmlFor="tax_rate" className="max-w-xs"><Input id="tax_rate" name="tax_rate" inputMode="decimal" defaultValue={o.tax_rate} /></Field>
            <label className="flex items-start gap-3"><input type="checkbox" name="require_cash_gap_comment" defaultChecked={o.require_cash_gap_comment} className="mt-0.5 h-4 w-4" /><span><strong>Commentaire obligatoire en cas d&apos;écart de caisse</strong></span></label>
            <label className="flex items-start gap-3"><input type="checkbox" name="allow_negative_stock" defaultChecked={o.allow_negative_stock} className="mt-0.5 h-4 w-4" /><span><strong>Autoriser la vente au-delà du stock</strong><br /><span className="text-fg-muted">Déconseillé. Même activée, seuls les utilisateurs disposant de la permission dédiée (propriétaire, administrateur) peuvent le faire.</span></span></label>
          </CardBody>
        </Card>
        <div className="flex justify-end"><SubmitButton size="lg">Enregistrer les paramètres</SubmitButton></div>
      </ActionForm>
    </>
  );
}
