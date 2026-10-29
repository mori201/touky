import type { Metadata } from "next";
import { LegalDraftNotice, Prose } from "@/components/public-shell";
import { CONTACT_EMAIL } from "@/lib/constants";

export const metadata: Metadata = { title: "Politique de confidentialité" };

export default function PrivacyPage() {
  return (
    <Prose>
      <h1 className="font-display text-4xl font-extrabold tracking-tight">Politique de confidentialité</h1>
      <p className="text-sm text-fg-muted">Version projet · dernière mise à jour : octobre 2026</p>
      <LegalDraftNotice />
      <p>Cette politique décrit la manière dont Mënjëf PRO traite les données à caractère personnel, conformément à la loi sénégalaise n° 2008-12 du 25 janvier 2008 sur la protection des données à caractère personnel et aux recommandations de la Commission de Protection des Données Personnelles (CDP).</p>
      <h2>Données collectées</h2>
      <ul>
        <li><strong>Compte :</strong> nom, adresse e-mail, téléphone facultatif, date d&apos;acceptation des conditions.</li>
        <li><strong>Données de l&apos;entreprise :</strong> informations commerciales, produits, ventes, clients, fournisseurs, dépenses, saisies par l&apos;entreprise cliente qui en est responsable.</li>
        <li><strong>Budget personnel :</strong> revenus et dépenses personnels, visibles uniquement par leur auteur.</li>
        <li><strong>Données techniques :</strong> journaux de connexion et d&apos;audit nécessaires à la sécurité.</li>
      </ul>
      <h2>Finalités</h2>
      <ul>
        <li>Fournir le Service, authentifier les utilisateurs et sécuriser les accès.</li>
        <li>Assurer la traçabilité des opérations sensibles (journal d&apos;audit).</li>
        <li>Répondre aux demandes d&apos;assistance.</li>
      </ul>
      <p>Aucune donnée n&apos;est vendue ni utilisée à des fins publicitaires.</p>
      <h2>Hébergement et sécurité</h2>
      <p>Les données sont hébergées par des prestataires d&apos;infrastructure cloud (base de données et hébergement web) susceptibles de se situer hors du Sénégal. Les échanges sont chiffrés (HTTPS) et chaque entreprise dispose d&apos;un espace isolé par des règles d&apos;accès appliquées par la base de données.</p>
      <h2>Durée de conservation</h2>
      <p>Les données sont conservées pendant la durée d&apos;utilisation du Service, puis supprimées ou anonymisées, sous réserve des durées légales de conservation des documents commerciaux.</p>
      <h2>Vos droits</h2>
      <p>Vous disposez d&apos;un droit d&apos;accès, de rectification, d&apos;opposition et de suppression. Vous pouvez modifier votre profil depuis l&apos;application, demander la suppression de votre compte depuis la page Profil ou écrire à {CONTACT_EMAIL}. Vous pouvez également saisir la CDP.</p>
    </Prose>
  );
}
