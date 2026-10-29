import Link from "next/link";
import { Logo } from "@/components/logo";
import { ButtonLink } from "@/components/ui";
import { ThemeToggle } from "@/components/ui/client";
import { CONTACT_EMAIL } from "@/lib/constants";

const NAV = [
  { href: "/fonctionnalites", label: "Fonctionnalités" },
  { href: "/tarifs", label: "Tarifs" },
  { href: "/aide", label: "Centre d'aide" },
  { href: "/a-propos", label: "À propos" },
  { href: "/contact", label: "Contact" },
];

export function FlagBar({ className = "" }: { className?: string }) {
  // Vert, jaune, rouge : couleurs partagées par de nombreux drapeaux d'Afrique de l'Ouest
  return (
    <span className={`flex gap-1.5 ${className}`} aria-hidden>
      <span className="h-1.5 w-10 rounded-full bg-[#00853f]" />
      <span className="h-1.5 w-10 rounded-full bg-[#fdef42]" />
      <span className="h-1.5 w-10 rounded-full bg-[#e31b23]" />
    </span>
  );
}

export function PublicHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-surface/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
        <Link href="/" className="focus-ring rounded-lg" aria-label="Mënjëf PRO, accueil">
          <Logo />
        </Link>
        <nav className="hidden items-center gap-1 lg:flex" aria-label="Navigation principale">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="focus-ring rounded-lg px-3 py-2 text-sm font-semibold text-fg-muted hover:bg-muted hover:text-fg">
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <ButtonLink href="/connexion" variant="ghost" size="sm" className="hidden sm:inline-flex">
            Se connecter
          </ButtonLink>
          <ButtonLink href="/inscription" size="sm">
            Créer mon compte
          </ButtonLink>
        </div>
      </div>
      <nav className="flex gap-1 overflow-x-auto border-t border-border/60 px-3 py-1.5 lg:hidden" aria-label="Navigation mobile">
        {NAV.map((n) => (
          <Link key={n.href} href={n.href} className="whitespace-nowrap rounded-lg px-2.5 py-1.5 text-xs font-semibold text-fg-muted hover:bg-muted">
            {n.label}
          </Link>
        ))}
        <Link href="/connexion" className="whitespace-nowrap rounded-lg px-2.5 py-1.5 text-xs font-semibold text-primary sm:hidden">
          Se connecter
        </Link>
      </nav>
    </header>
  );
}

export function PublicFooter() {
  return (
    <footer className="mt-20 bg-navy text-white">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 md:grid-cols-4">
        <div className="md:col-span-2">
          <Logo inverted tagline />
          <p className="mt-4 max-w-sm text-sm text-white/70">
            Logiciel de gestion commerciale, de caisse et de pilotage financier conçu au Sénégal pour les
            commerçants et PME d&apos;Afrique francophone.
          </p>
          <FlagBar className="mt-5" />
        </div>
        <div>
          <p className="text-sm font-bold">Produit</p>
          <ul className="mt-3 space-y-2 text-sm text-white/70">
            <li><Link href="/fonctionnalites" className="hover:text-white">Fonctionnalités</Link></li>
            <li><Link href="/tarifs" className="hover:text-white">Tarifs</Link></li>
            <li><Link href="/aide" className="hover:text-white">Manuel d&apos;utilisation</Link></li>
            <li><Link href="/inscription" className="hover:text-white">Créer un compte</Link></li>
          </ul>
        </div>
        <div>
          <p className="text-sm font-bold">Entreprise</p>
          <ul className="mt-3 space-y-2 text-sm text-white/70">
            <li><Link href="/a-propos" className="hover:text-white">À propos</Link></li>
            <li><Link href="/contact" className="hover:text-white">Contact et assistance</Link></li>
            <li><Link href="/cgu" className="hover:text-white">Conditions d&apos;utilisation</Link></li>
            <li><Link href="/confidentialite" className="hover:text-white">Confidentialité</Link></li>
            <li><Link href="/cookies" className="hover:text-white">Cookies</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4 text-xs text-white/60">
          <p>© {new Date().getFullYear()} Mënjëf PRO · Dakar, Sénégal · {CONTACT_EMAIL}</p>
          <ThemeToggle className="border-white/20 bg-transparent text-white/70 hover:text-white" />
        </div>
      </div>
    </footer>
  );
}

export function LegalDraftNotice() {
  return (
    <div className="mb-8 rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-fg">
      <strong>Projet de document.</strong> Ce texte a été préparé pour être relu et validé par un professionnel du
      droit avant sa publication définitive. Il ne constitue pas un avis juridique.
    </div>
  );
}

export function Prose({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 [&_h2]:mt-10 [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-bold [&_h3]:mt-6 [&_h3]:font-bold [&_li]:mt-1.5 [&_p]:mt-3 [&_p]:leading-relaxed [&_p]:text-fg/85 [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:text-fg/85">
      {children}
    </div>
  );
}
