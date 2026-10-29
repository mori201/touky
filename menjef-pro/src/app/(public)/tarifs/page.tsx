import type { Metadata } from "next";
import { Check } from "lucide-react";
import { ButtonLink } from "@/components/ui";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Tarifs",
  description: "Des formules adaptées aux commerçants et PME d'Afrique francophone, en francs CFA, avec 30 jours d'essai gratuit.",
};

const PLANS = [
  { name: "Essentiel", price: "9 900", desc: "Pour une boutique qui démarre.", features: ["1 établissement", "3 utilisateurs", "Caisse, stock et crédits clients", "Dépenses et tableau de bord", "Budget personnel"] },
  { name: "Business", price: "24 900", desc: "Pour les commerces en croissance.", highlight: true, features: ["Jusqu'à 3 établissements", "10 utilisateurs", "Fournisseurs et achats", "Trésorerie et clôtures de caisse", "Inventaires et transferts", "Exports CSV"] },
  { name: "Entreprise", price: "Sur devis", desc: "Pour les PME multi-sites.", features: ["Établissements illimités", "Utilisateurs illimités", "Journal d'audit complet", "Accompagnement à la prise en main", "Assistance prioritaire"] },
];

export default function PricingPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-16">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Tarifs</p>
      <h1 className="mt-2 font-display text-4xl font-extrabold tracking-tight">Simple et transparent</h1>
      <p className="mt-3 max-w-2xl text-fg-muted">
        Prix mensuels hors taxes, en francs CFA. Chaque nouvelle entreprise bénéficie de 30 jours d&apos;essai gratuit
        sans carte bancaire.
      </p>
      <div className="mt-10 grid gap-5 md:grid-cols-3">
        {PLANS.map((p) => (
          <div key={p.name} className={cn("flex flex-col rounded-2xl border bg-surface p-6 shadow-card", p.highlight ? "border-primary ring-2 ring-primary/20" : "border-border")}>
            {p.highlight && <span className="mb-3 self-start rounded-full bg-primary px-2.5 py-0.5 text-xs font-bold text-primary-fg">Le plus choisi</span>}
            <h2 className="font-display text-xl font-bold">{p.name}</h2>
            <p className="mt-1 text-sm text-fg-muted">{p.desc}</p>
            <p className="mt-5 font-display text-3xl font-extrabold">
              {p.price}
              {p.price !== "Sur devis" && <span className="text-base font-semibold text-fg-muted"> F CFA / mois</span>}
            </p>
            <ul className="mt-6 flex-1 space-y-2.5 text-sm">
              {p.features.map((f) => (
                <li key={f} className="flex gap-2"><Check size={18} className="shrink-0 text-accent" />{f}</li>
              ))}
            </ul>
            <ButtonLink href={p.price === "Sur devis" ? "/contact" : "/inscription"} className="mt-6" variant={p.highlight ? "primary" : "outline"}>
              {p.price === "Sur devis" ? "Nous contacter" : "Commencer l'essai"}
            </ButtonLink>
          </div>
        ))}
      </div>
      <p className="mt-8 text-sm text-fg-muted">
        Le paiement de l&apos;abonnement en ligne (Wave, Orange Money, carte) sera proposé à la fin de la période
        d&apos;essai. Tarifs susceptibles d&apos;évoluer ; les conditions applicables vous seront communiquées avant tout
        engagement.
      </p>
    </div>
  );
}
