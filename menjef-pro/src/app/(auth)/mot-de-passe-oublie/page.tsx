import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm, SubmitButton } from "@/components/ui/client";
import { Field, Input } from "@/components/ui";
import { AuthCard } from "../auth-card";
import { requestPasswordReset } from "../actions";

export const metadata: Metadata = { title: "Mot de passe oublié" };

export default function ForgotPasswordPage() {
  return (
    <AuthCard title="Mot de passe oublié" subtitle="Recevez un lien sécurisé pour choisir un nouveau mot de passe.">
      <ActionForm action={requestPasswordReset} className="space-y-4">
        <Field label="Adresse e-mail du compte" htmlFor="email">
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </Field>
        <SubmitButton className="w-full" size="lg" pendingText="Envoi…">Envoyer le lien</SubmitButton>
      </ActionForm>
      <p className="mt-6 text-center text-sm text-fg-muted">
        <Link href="/connexion" className="font-semibold text-primary">← Retour à la connexion</Link>
      </p>
    </AuthCard>
  );
}
