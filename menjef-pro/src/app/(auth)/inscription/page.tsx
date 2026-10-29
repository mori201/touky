import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm, SubmitButton } from "@/components/ui/client";
import { Field, Input } from "@/components/ui";
import { AuthCard } from "../auth-card";
import { signUp } from "../actions";

export const metadata: Metadata = { title: "Créer un compte" };

export default async function SignUpPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  return (
    <AuthCard title="Créer un compte" subtitle="30 jours d'essai gratuit, sans carte bancaire.">
      <ActionForm action={signUp} className="space-y-4" resetOnSuccess>
        <input type="hidden" name="suivant" value={sp.suivant ?? ""} />
        <Field label="Nom complet" htmlFor="full_name" required>
          <Input id="full_name" name="full_name" autoComplete="name" required placeholder="Awa Ndiaye" />
        </Field>
        <Field label="Adresse e-mail" htmlFor="email" required>
          <Input id="email" name="email" type="email" autoComplete="email" required placeholder="exemple@votreentreprise.sn" />
        </Field>
        <Field label="Mot de passe" htmlFor="password" required hint="8 caractères minimum, avec au moins une lettre et un chiffre.">
          <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} />
        </Field>
        <Field label="Confirmer le mot de passe" htmlFor="confirm" required>
          <Input id="confirm" name="confirm" type="password" autoComplete="new-password" required minLength={8} />
        </Field>
        <label className="flex items-start gap-2.5 text-sm text-fg-muted">
          <input type="checkbox" name="terms" required className="mt-0.5 h-4 w-4 rounded border-border accent-[rgb(var(--primary))]" />
          <span>
            J&apos;accepte les{" "}
            <Link href="/cgu" target="_blank" className="font-semibold text-primary">conditions d&apos;utilisation</Link> et la{" "}
            <Link href="/confidentialite" target="_blank" className="font-semibold text-primary">politique de confidentialité</Link>.
          </span>
        </label>
        <SubmitButton className="w-full" size="lg" pendingText="Création du compte…">Créer mon compte</SubmitButton>
      </ActionForm>
      <p className="mt-6 text-center text-sm text-fg-muted">
        Déjà inscrit ? <Link href="/connexion" className="font-semibold text-primary">Se connecter</Link>
      </p>
    </AuthCard>
  );
}
