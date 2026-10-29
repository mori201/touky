import type { Metadata } from "next";
import { Mail, LifeBuoy, BookOpen } from "lucide-react";
import Link from "next/link";
import { CONTACT_EMAIL } from "@/lib/constants";

export const metadata: Metadata = { title: "Contact et assistance", description: "Contactez l'équipe Mënjëf PRO pour une question commerciale, une démonstration ou une demande d'assistance." };

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-16">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Contact</p>
      <h1 className="mt-2 font-display text-4xl font-extrabold tracking-tight">Parlons de votre activité</h1>
      <p className="mt-3 max-w-2xl text-fg-muted">
        Une question, une demande de démonstration ou un problème technique ? Écrivez-nous en précisant le nom de votre
        entreprise : nous répondons du lundi au samedi.
      </p>
      <div className="mt-10 grid gap-5 sm:grid-cols-3">
        <a href={`mailto:${CONTACT_EMAIL}?subject=Demande%20d%27information%20M%C3%ABnj%C3%ABf%20PRO`} className="rounded-2xl border border-border bg-surface p-6 shadow-card hover:border-primary">
          <Mail className="text-primary" />
          <p className="mt-3 font-display font-bold">Commercial</p>
          <p className="mt-1 text-sm text-fg-muted">{CONTACT_EMAIL}</p>
        </a>
        <a href={`mailto:${CONTACT_EMAIL}?subject=Assistance%20M%C3%ABnj%C3%ABf%20PRO`} className="rounded-2xl border border-border bg-surface p-6 shadow-card hover:border-primary">
          <LifeBuoy className="text-accent" />
          <p className="mt-3 font-display font-bold">Assistance</p>
          <p className="mt-1 text-sm text-fg-muted">Décrivez le problème et joignez une capture d&apos;écran si possible.</p>
        </a>
        <Link href="/aide" className="rounded-2xl border border-border bg-surface p-6 shadow-card hover:border-primary">
          <BookOpen className="text-warning" />
          <p className="mt-3 font-display font-bold">Manuel d&apos;utilisation</p>
          <p className="mt-1 text-sm text-fg-muted">Guides pas à pas pour chaque module.</p>
        </Link>
      </div>
      <p className="mt-8 text-sm text-fg-muted">
        Pour exercer vos droits sur vos données personnelles, consultez la{" "}
        <Link href="/confidentialite" className="font-semibold text-primary">politique de confidentialité</Link>.
      </p>
    </div>
  );
}
