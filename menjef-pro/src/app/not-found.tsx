import { ButtonLink } from "@/components/ui";
import { Logo } from "@/components/logo";

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center px-6">
      <div className="text-center">
        <Logo className="justify-center" />
        <p className="mt-8 font-display text-5xl font-extrabold text-navy dark:text-fg">404</p>
        <p className="mt-2 text-fg-muted">Cette page n&apos;existe pas ou vous n&apos;y avez pas accès.</p>
        <ButtonLink href="/" className="mt-6">Retour à l&apos;accueil</ButtonLink>
      </div>
    </main>
  );
}
