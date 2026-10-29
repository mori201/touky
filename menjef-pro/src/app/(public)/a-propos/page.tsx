import type { Metadata } from "next";
import { Prose } from "@/components/public-shell";

export const metadata: Metadata = { title: "À propos", description: "La mission de Mënjëf PRO : donner aux entrepreneurs africains des outils de gestion simples, fiables et adaptés à leur réalité." };

export default function AboutPage() {
  return (
    <Prose>
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">À propos</p>
      <h1 className="mt-2 font-display text-4xl font-extrabold tracking-tight">Mënjëf PRO</h1>
      <p className="text-lg">
        En wolof, <em>mënjëf</em> évoque la capacité, le fait d&apos;être en mesure d&apos;agir. C&apos;est l&apos;ambition de
        notre outil : donner à chaque commerçant les moyens de comprendre et de piloter son activité.
      </p>
      <h2>Notre mission</h2>
      <p>
        Beaucoup d&apos;entreprises gèrent encore leurs ventes dans des cahiers, leurs stocks de mémoire et leurs crédits
        clients sur des bouts de papier. Les logiciels existants sont souvent pensés pour d&apos;autres marchés : devises,
        moyens de paiement et usages ne correspondent pas.
      </p>
      <p>
        Mënjëf PRO est conçu au Sénégal pour les réalités d&apos;Afrique francophone : francs CFA, Mobile Money, ventes
        à crédit, usage principal sur smartphone et connexions parfois instables.
      </p>
      <h2>Nos principes</h2>
      <ul>
        <li><strong>Des chiffres justes.</strong> Chiffre d&apos;affaires, encaissements, marge et trésorerie ne sont jamais confondus.</li>
        <li><strong>La traçabilité.</strong> Aucune opération validée n&apos;est effacée : elle est annulée par une opération inverse.</li>
        <li><strong>La sécurité.</strong> Les données de chaque entreprise sont isolées au niveau de la base de données.</li>
        <li><strong>La simplicité.</strong> Un commerçant débutant doit pouvoir encaisser dès le premier jour.</li>
      </ul>
      <h2>Feuille de route</h2>
      <p>
        Intégrations officielles avec les opérateurs Mobile Money, mode hors ligne pour la caisse, facturation
        électronique et ouverture progressive aux autres pays de l&apos;UEMOA et de la CEMAC.
      </p>
    </Prose>
  );
}
