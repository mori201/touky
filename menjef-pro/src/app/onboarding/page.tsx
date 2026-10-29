import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@/components/logo";
import { Alert, ButtonLink, Card, Field, Input, Select } from "@/components/ui";
import { ActionForm, SubmitButton } from "@/components/ui/client";
import { getAppContext, getMemberships, getSessionUser } from "@/lib/context";
import { PAYMENT_METHODS } from "@/lib/constants";
import { ROLES } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { CreateOrganizationWizard } from "./wizard";
import { addInitialProducts, finishOnboarding, goToStep, inviteCollaborator, savePaymentMethods } from "./actions";

// Données propres à chaque utilisateur : jamais de rendu statique
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Configuration de votre entreprise", robots: { index: false } };

const LATER_STEPS = [
  { n: 5, title: "Produits" },
  { n: 6, title: "Paiements" },
  { n: 7, title: "Équipe" },
  { n: 8, title: "Terminé" },
];

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-bg">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-4">
          <Logo />
          <form action="/auth/deconnexion" method="post">
            <button className="text-sm font-semibold text-fg-muted hover:text-fg">Déconnexion</button>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-10">{children}</main>
    </div>
  );
}

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const { supabase, user } = await getSessionUser();
  if (!user) redirect("/connexion?suivant=/onboarding");
  const memberships = await getMemberships();

  if (memberships.length === 0 || sp.nouvelle) {
    const { data: profile } = await supabase.from("profiles").select("full_name, phone").eq("id", user.id).maybeSingle();
    return (
      <Shell>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Bienvenue</p>
        <h1 className="mt-1 font-display text-3xl font-extrabold">Configurons votre entreprise</h1>
        <p className="mt-2 text-fg-muted">Quatre étapes rapides, puis vous pourrez commencer à encaisser.</p>
        <Card className="mt-6 p-6">
          <CreateOrganizationWizard fullName={profile?.full_name ?? ""} phone={profile?.phone ?? ""} />
        </Card>
        {memberships.length > 0 && (
          <p className="mt-4 text-sm"><Link href="/app" className="font-semibold text-primary">← Retour à mon espace</Link></p>
        )}
      </Shell>
    );
  }

  const ctx = await getAppContext();
  const step = Math.min(8, Math.max(5, Number(sp.etape) || ctx.org.onboarding_step || 5));

  return (
    <Shell>
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">{ctx.org.name}</p>
      <h1 className="mt-1 font-display text-3xl font-extrabold">Finalisez votre configuration</h1>
      <p className="mt-2 text-fg-muted">Ces étapes sont facultatives : vous pouvez les passer et y revenir plus tard.</p>
      <ol className="mt-6 grid grid-cols-4 gap-2">
        {LATER_STEPS.map((s) => (
          <li key={s.n}>
            <form action={goToStep}>
              <input type="hidden" name="step" value={s.n} />
              <button className="w-full text-center">
                <span className={cn("block h-1.5 rounded-full", s.n <= step ? "bg-primary" : "bg-border")} />
                <span className={cn("mt-1.5 block text-xs font-semibold", s.n === step ? "text-primary" : "text-fg-muted")}>{s.n}. {s.title}</span>
              </button>
            </form>
          </li>
        ))}
      </ol>

      <Card className="mt-6 p-6">
        {step === 5 && (
          <>
            <h2 className="font-display text-xl font-bold">Ajoutez vos premiers produits</h2>
            <p className="mt-1 text-sm text-fg-muted">
              Saisissez quelques articles maintenant ou{" "}
              <Link href="/app/produits/import" className="font-semibold text-primary">importez un fichier CSV</Link>.
              La quantité devient votre stock initial dans « {ctx.locations.find((l) => l.id === ctx.operationLocationId)?.name} ».
            </p>
            <ActionForm action={addInitialProducts} className="mt-5" redirectTo="/onboarding?etape=6">
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="grid grid-cols-2 gap-2 sm:grid-cols-[2fr_1fr_1fr_1fr]">
                    <Input name={`name_${i}`} placeholder="Nom du produit" aria-label={`Nom du produit ${i + 1}`} className="col-span-2 sm:col-span-1" />
                    <Input name={`price_${i}`} inputMode="decimal" placeholder="Prix de vente" aria-label="Prix de vente" />
                    <Input name={`cost_${i}`} inputMode="decimal" placeholder="Prix d'achat" aria-label="Prix d'achat" />
                    <Input name={`qty_${i}`} inputMode="decimal" placeholder="Quantité" aria-label="Quantité en stock" />
                  </div>
                ))}
              </div>
              <div className="mt-6 flex flex-wrap justify-end gap-2">
                <SkipButton to={6} />
                <SubmitButton>Enregistrer et continuer</SubmitButton>
              </div>
            </ActionForm>
          </>
        )}

        {step === 6 && (
          <>
            <h2 className="font-display text-xl font-bold">Moyens de paiement acceptés</h2>
            <p className="mt-1 text-sm text-fg-muted">Ils apparaîtront à la caisse. Les espèces sont toujours actives.</p>
            <ActionForm action={savePaymentMethods} className="mt-5" redirectTo="/onboarding?etape=7">
              <div className="grid gap-2 sm:grid-cols-2">
                {Object.entries(PAYMENT_METHODS).map(([k, v]) => (
                  <label key={k} className="flex items-center gap-3 rounded-xl border border-border px-4 py-3 text-sm font-medium has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                    <input type="checkbox" name="methods" value={k} defaultChecked={ctx.org.enabled_payment_methods.includes(k as never)} disabled={k === "cash"} className="h-4 w-4" />
                    {v}
                  </label>
                ))}
              </div>
              <input type="hidden" name="methods" value="cash" />
              <Alert tone="warning" className="mt-4">
                Les paiements Mobile Money sont déclarés par le caissier : aucune vérification automatique auprès de l&apos;opérateur n&apos;est encore active.
              </Alert>
              <div className="mt-6 flex flex-wrap justify-end gap-2">
                <SkipButton to={7} />
                <SubmitButton>Enregistrer et continuer</SubmitButton>
              </div>
            </ActionForm>
          </>
        )}

        {step === 7 && (
          <>
            <h2 className="font-display text-xl font-bold">Invitez vos collaborateurs</h2>
            <p className="mt-1 text-sm text-fg-muted">Chaque invitation génère un lien personnel valable 7 jours.</p>
            <ActionForm action={inviteCollaborator} className="mt-5 grid gap-4 sm:grid-cols-2">
              <Field label="Adresse e-mail" htmlFor="email"><Input id="email" name="email" type="email" required /></Field>
              <Field label="Rôle" htmlFor="role">
                <Select id="role" name="role" defaultValue="cashier">
                  {Object.entries(ROLES).filter(([k]) => k !== "owner").map(([k, r]) => <option key={k} value={k}>{r.label}</option>)}
                </Select>
              </Field>
              <Field label="Limiter à un établissement" htmlFor="location_id" className="sm:col-span-2">
                <Select id="location_id" name="location_id" defaultValue="">
                  <option value="">Tous les établissements</option>
                  {ctx.locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                </Select>
              </Field>
              <div className="flex flex-wrap justify-end gap-2 sm:col-span-2">
                <SkipButton to={8} label="Continuer" />
                <SubmitButton variant="outline">Créer l&apos;invitation</SubmitButton>
              </div>
            </ActionForm>
          </>
        )}

        {step === 8 && (
          <div className="text-center">
            <p className="text-5xl">🎉</p>
            <h2 className="mt-3 font-display text-2xl font-bold">Votre espace est prêt</h2>
            <p className="mt-1 text-fg-muted">Vous pouvez dès maintenant enregistrer votre première vente.</p>
            <form action={finishOnboarding} className="mt-6 flex flex-wrap justify-center gap-2">
              <SubmitButton size="lg">Accéder au tableau de bord</SubmitButton>
            </form>
            <ButtonLink href="/app/caisse" variant="outline" className="mt-2">Ouvrir la caisse</ButtonLink>
          </div>
        )}
      </Card>
    </Shell>
  );
}

function SkipButton({ to, label = "Passer cette étape" }: { to: number; label?: string }) {
  return (
    <ButtonLink href={`/onboarding?etape=${to}`} variant="ghost">{label}</ButtonLink>
  );
}
