import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm, SubmitButton } from "@/components/ui/client";
import { Alert, ButtonLink, Field, Input } from "@/components/ui";
import { AuthCard } from "../auth-card";
import { signIn } from "../actions";

export const metadata: Metadata = { title: "Se connecter" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  return (
    <AuthCard title="Se connecter" subtitle="Accédez à votre espace de gestion en toute sécurité.">
      {sp.confirme && <Alert tone="success" className="mb-4">Adresse e-mail confirmée. Vous pouvez vous connecter.</Alert>}
      {sp.erreur && <Alert tone="danger" className="mb-4">Le lien utilisé est invalide ou a expiré.</Alert>}
      <ActionForm action={signIn} className="space-y-4">
        <input type="hidden" name="suivant" value={sp.suivant ?? ""} />
        <Field label="Adresse e-mail" htmlFor="email">
          <Input id="email" name="email" type="email" autoComplete="email" required placeholder="exemple@votreentreprise.sn" />
        </Field>
        <Field label="Mot de passe" htmlFor="password">
          <Input id="password" name="password" type="password" autoComplete="current-password" required placeholder="Entrez votre mot de passe" />
        </Field>
        <SubmitButton className="w-full" size="lg" pendingText="Connexion…">Connexion →</SubmitButton>
      </ActionForm>
      <div className="mt-4 grid gap-2">
        <ButtonLink href="/mot-de-passe-oublie" variant="outline">Mot de passe oublié ?</ButtonLink>
        <ButtonLink href="/aide" variant="outline">📘 Manuel d&apos;utilisation</ButtonLink>
        <ButtonLink href={`/inscription${sp.suivant ? `?suivant=${encodeURIComponent(sp.suivant)}` : ""}`} variant="secondary">Créer un compte</ButtonLink>
      </div>
      <p className="mt-6 text-center text-xs text-fg-muted">
        <Link href="/" className="hover:text-fg">← Retour au site</Link>
      </p>
    </AuthCard>
  );
}
