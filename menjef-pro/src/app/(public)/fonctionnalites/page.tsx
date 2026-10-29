import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui";

export const metadata: Metadata = {
  title: "Fonctionnalités",
  description: "Caisse, stocks, crédits clients, achats fournisseurs, dépenses, trésorerie, budget personnel et gestion d'équipe : découvrez les modules de Mënjëf PRO.",
};

const MODULES = [
  { title: "Caisse numérique", items: ["Recherche rapide et lecture de code-barres", "Panier tactile, remises selon les permissions", "Espèces, Wave, Orange Money, Free Money, carte, virement, paiement mixte et crédit", "Calcul de la monnaie à rendre", "Reçu imprimable", "Protection contre les doubles ventes (clé d'idempotence)"] },
  { title: "Catalogue et stocks", items: ["Fiches produits : référence, code-barres, catégorie, unité, prix de détail et de gros", "Import CSV avec aperçu et validation", "Mouvements traçables : achat, vente, retour, perte, transfert, inventaire", "Inventaire physique avec écarts théorique / compté", "Coût moyen pondéré et valorisation du stock", "Refus des ventes au-delà du stock disponible"] },
  { title: "Clients et crédits", items: ["Fichier client et historique des achats", "Ventes à crédit avec plafond et échéance", "Remboursements partiels affectés aux ventes les plus anciennes", "Relevé client et créances en retard", "Promesses de paiement"] },
  { title: "Fournisseurs et achats", items: ["Bons de commande (brouillon, commandé)", "Réception totale ou partielle", "Stock mis à jour uniquement à la réception", "Retours fournisseurs", "Paiements et dettes fournisseurs"] },
  { title: "Dépenses et finances", items: ["Dépenses par catégorie, établissement et moyen de paiement", "Recettes diverses distinctes des ventes", "Marge brute et bénéfice estimé avec formules expliquées", "Avertissements lorsque les données sont incomplètes"] },
  { title: "Trésorerie et caisses", items: ["Comptes caisse, banque et Mobile Money", "Transferts internes neutres sur le résultat", "Ouverture et clôture de caisse, écart justifié", "Corrections de clôture tracées dans le journal d'audit"] },
  { title: "Équipe et sécurité", items: ["Sept rôles prêts à l'emploi et permissions granulaires", "Invitation de collaborateurs par lien sécurisé", "Limitation d'un employé à un établissement", "Isolation stricte des données par entreprise (RLS)", "Journal d'audit des opérations sensibles"] },
  { title: "Budget personnel", items: ["Revenus et dépenses personnels", "Budgets mensuels par catégorie", "Objectifs d'épargne et reste à vivre", "Strictement séparé des données de l'entreprise"] },
];

export default function FeaturesPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-16">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Fonctionnalités</p>
      <h1 className="mt-2 font-display text-4xl font-extrabold tracking-tight">Une application, toute votre gestion</h1>
      <p className="mt-3 max-w-2xl text-fg-muted">
        Chaque module s&apos;appuie sur une base de données unique : une vente met à jour le stock, la caisse et le
        compte client en une seule opération indivisible.
      </p>
      <div className="mt-10 grid gap-5 md:grid-cols-2">
        {MODULES.map((m) => (
          <section key={m.title} className="rounded-2xl border border-border bg-surface p-6 shadow-card">
            <h2 className="font-display text-lg font-bold">{m.title}</h2>
            <ul className="mt-3 space-y-2 text-sm text-fg-muted">
              {m.items.map((i) => (
                <li key={i} className="flex gap-2"><span className="text-accent">●</span>{i}</li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      <div className="mt-12 flex flex-wrap gap-3">
        <ButtonLink href="/inscription" size="lg">Créer mon compte</ButtonLink>
        <ButtonLink href="/tarifs" size="lg" variant="outline">Voir les tarifs</ButtonLink>
      </div>
    </div>
  );
}
