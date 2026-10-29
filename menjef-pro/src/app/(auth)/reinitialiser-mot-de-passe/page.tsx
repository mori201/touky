import type { Metadata } from "next";
import { ActionForm, SubmitButton } from "@/components/ui/client";
import { ButtonLink, Field, Input } from "@/components/ui";
import { AuthCard } from "../auth-card";
import { updatePassword } from "../actions";

export const metadata: Metadata = { title: "Nouveau mot de passe" };

export default function ResetPasswordPage() {
  return (
    <AuthCard title="Nouveau mot de passe" subtitle="Choisissez un mot de passe que vous n'utilisez pas ailleurs.">
      <ActionForm action={updatePassword} className="space-y-4" resetOnSuccess>
        <Field label="Nouveau mot de passe" htmlFor="password" hint="8 caractères minimum, avec au moins une lettre et un chiffre.">
          <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} />
        </Field>
        <Field label="Confirmer" htmlFor="confirm">
          <Input id="confirm" name="confirm" type="password" autoComplete="new-password" required minLength={8} />
        </Field>
        <SubmitButton className="w-full" size="lg">Mettre à jour</SubmitButton>
      </ActionForm>
      <ButtonLink href="/app" variant="outline" className="mt-3 w-full">Aller à mon espace</ButtonLink>
    </AuthCard>
  );
}
