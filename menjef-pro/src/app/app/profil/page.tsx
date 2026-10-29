import type { Metadata } from "next";
import Link from "next/link";
import { Alert, Badge, ButtonLink, Card, CardBody, CardHeader, Field, Input, PageHeader, Textarea } from "@/components/ui";
import { ActionForm, SubmitButton } from "@/components/ui/client";
import { getAppContext } from "@/lib/context";
import { ROLES } from "@/lib/permissions";
import { setOrganization } from "../actions";
import { changePassword, requestDeletion, saveProfile } from "./actions";

export const metadata: Metadata = { title: "Mon profil" };

export default async function ProfilePage() {
  const ctx = await getAppContext();
  const { data: pending } = await ctx.supabase.from("account_deletion_requests").select("id, created_at").eq("user_id", ctx.user.id).eq("status", "pending").maybeSingle();
  return (
    <>
      <PageHeader title="Mon profil" description={ctx.user.email} />
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="Informations personnelles" />
          <CardBody>
            <ActionForm action={saveProfile} className="space-y-4">
              <Field label="Nom complet" htmlFor="full_name" required><Input id="full_name" name="full_name" defaultValue={ctx.profile?.full_name ?? ""} required /></Field>
              <Field label="Téléphone" htmlFor="phone"><Input id="phone" name="phone" type="tel" defaultValue={ctx.profile?.phone ?? ""} /></Field>
              <Field label="Adresse e-mail" htmlFor="email" hint="Pour changer d'adresse, contactez l'assistance."><Input id="email" value={ctx.user.email ?? ""} readOnly disabled /></Field>
              <SubmitButton>Enregistrer</SubmitButton>
            </ActionForm>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Changer de mot de passe" />
          <CardBody>
            <ActionForm action={changePassword} resetOnSuccess className="space-y-4">
              <Field label="Mot de passe actuel" htmlFor="current"><Input id="current" name="current" type="password" autoComplete="current-password" required /></Field>
              <Field label="Nouveau mot de passe" htmlFor="password" hint="8 caractères minimum, avec une lettre et un chiffre."><Input id="password" name="password" type="password" autoComplete="new-password" required /></Field>
              <Field label="Confirmer" htmlFor="confirm"><Input id="confirm" name="confirm" type="password" autoComplete="new-password" required /></Field>
              <SubmitButton>Modifier</SubmitButton>
            </ActionForm>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Mes entreprises" actions={<ButtonLink href="/onboarding?nouvelle=1" size="sm" variant="outline">+ Créer une entreprise</ButtonLink>} />
          <ul className="divide-y divide-border">
            {ctx.memberships.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-3 px-5 py-3">
                <div>
                  <p className="font-semibold">{m.organization.name} {m.organization.id === ctx.org.id && <Badge tone="primary" className="ml-1">Active</Badge>}</p>
                  <p className="text-xs text-fg-muted">{ROLES[m.role].label}</p>
                </div>
                {m.organization.id !== ctx.org.id && (
                  <form action={setOrganization}>
                    <input type="hidden" name="organization_id" value={m.organization.id} />
                    <button className="text-sm font-semibold text-primary">Basculer</button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <CardHeader title="Supprimer mon compte" />
          <CardBody>
            {pending ? (
              <Alert tone="warning">Une demande de suppression est en cours de traitement.</Alert>
            ) : (
              <ActionForm action={requestDeletion} className="space-y-4">
                <p className="text-sm text-fg-muted">
                  La suppression est définitive. Pour votre sécurité, elle est traitée manuellement après vérification. Consultez la{" "}
                  <Link href="/confidentialite" className="text-primary">politique de confidentialité</Link>.
                </p>
                <Field label="Motif (facultatif)" htmlFor="reason"><Textarea id="reason" name="reason" /></Field>
                <Field label="Saisissez SUPPRIMER pour confirmer" htmlFor="confirm"><Input id="confirm" name="confirm" required autoComplete="off" /></Field>
                <SubmitButton variant="danger">Demander la suppression</SubmitButton>
              </ActionForm>
            )}
          </CardBody>
        </Card>
      </div>
    </>
  );
}
