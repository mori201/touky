import type { Metadata } from "next";
import { LegalDraftNotice, Prose } from "@/components/public-shell";

export const metadata: Metadata = { title: "Conditions générales d'utilisation", robots: { index: true } };

export default function TermsPage() {
  return (
    <Prose>
      <h1 className="font-display text-4xl font-extrabold tracking-tight">Conditions générales d&apos;utilisation</h1>
      <p className="text-sm text-fg-muted">Version projet · dernière mise à jour : octobre 2026</p>
      <LegalDraftNotice />
      <h2>1. Objet</h2>
      <p>Les présentes conditions encadrent l&apos;accès et l&apos;utilisation de la plateforme Mënjëf PRO, service en ligne de gestion commerciale, de caisse, de stock et de pilotage financier proposé aux professionnels (ci-après « le Service »).</p>
      <h2>2. Accès au Service et compte</h2>
      <ul>
        <li>L&apos;inscription requiert une adresse e-mail valide et l&apos;acceptation des présentes conditions et de la politique de confidentialité.</li>
        <li>L&apos;utilisateur est responsable de la confidentialité de ses identifiants et des actions réalisées depuis son compte.</li>
        <li>Le titulaire d&apos;un compte « Propriétaire » est responsable des accès qu&apos;il accorde à ses collaborateurs.</li>
      </ul>
      <h2>3. Données de l&apos;entreprise</h2>
      <p>L&apos;entreprise cliente reste propriétaire des données qu&apos;elle saisit. Mënjëf PRO les héberge et les traite uniquement pour fournir le Service. L&apos;entreprise peut exporter ses données dans les formats proposés.</p>
      <h2>4. Responsabilités</h2>
      <ul>
        <li>Les indicateurs (marge, bénéfice estimé, trésorerie) sont calculés à partir des données saisies ; leur exactitude dépend de l&apos;exhaustivité de ces saisies. Ils ne remplacent pas une comptabilité tenue par un professionnel.</li>
        <li>Les paiements Mobile Money déclarés à la caisse ne sont pas vérifiés automatiquement auprès des opérateurs, sauf mention contraire.</li>
        <li>L&apos;utilisateur s&apos;engage à respecter les obligations fiscales et réglementaires propres à son activité.</li>
      </ul>
      <h2>5. Disponibilité</h2>
      <p>Mënjëf PRO met en œuvre des moyens raisonnables pour assurer la disponibilité du Service, sans garantie d&apos;un fonctionnement ininterrompu. Des opérations de maintenance peuvent survenir.</p>
      <h2>6. Abonnement</h2>
      <p>Une période d&apos;essai gratuite est proposée. Les conditions tarifaires applicables à l&apos;issue de l&apos;essai sont communiquées avant tout engagement.</p>
      <h2>7. Résiliation et suppression</h2>
      <p>L&apos;utilisateur peut demander la suppression de son compte depuis son profil. La suppression des données d&apos;une entreprise intervient après vérification de l&apos;identité du demandeur et sous réserve des obligations légales de conservation.</p>
      <h2>8. Droit applicable</h2>
      <p>Les présentes conditions sont régies par le droit sénégalais. À défaut d&apos;accord amiable, les juridictions compétentes de Dakar seront saisies.</p>
    </Prose>
  );
}
