import { ShieldAlert } from "lucide-react";
import { ButtonLink, Card, EmptyState } from "@/components/ui";
import { PERMISSIONS } from "@/lib/permissions";

export default async function ForbiddenPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const label = sp.permission ? PERMISSIONS[sp.permission as keyof typeof PERMISSIONS] : undefined;
  return (
    <Card>
      <EmptyState
        icon={<ShieldAlert />}
        title="Accès non autorisé"
        description={`Votre rôle ne permet pas d'accéder à cette page${label ? ` (permission requise : « ${label} »)` : ""}. Demandez à un responsable de l'entreprise de modifier vos droits.`}
        action={<ButtonLink href="/app">Retour au tableau de bord</ButtonLink>}
      />
    </Card>
  );
}
