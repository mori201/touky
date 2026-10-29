import type { Metadata } from "next";
import { LegalDraftNotice, Prose } from "@/components/public-shell";

export const metadata: Metadata = { title: "Politique de cookies" };

export default function CookiesPage() {
  return (
    <Prose>
      <h1 className="font-display text-4xl font-extrabold tracking-tight">Politique de cookies</h1>
      <LegalDraftNotice />
      <p>Mënjëf PRO n&apos;utilise <strong>aucun cookie publicitaire ni de mesure d&apos;audience tiers</strong>. Seuls des cookies strictement nécessaires au fonctionnement sont déposés :</p>
      <ul>
        <li><strong>Session d&apos;authentification</strong> (sb-…) : maintient votre connexion de manière sécurisée.</li>
        <li><strong>mj_org</strong> et <strong>mj_loc</strong> : mémorisent l&apos;entreprise et l&apos;établissement affichés. Ils ne donnent aucun droit d&apos;accès : les autorisations sont vérifiées par le serveur à chaque requête.</li>
      </ul>
      <p>Le choix du thème clair ou sombre est enregistré dans le stockage local de votre navigateur. Ces éléments étant indispensables, ils ne nécessitent pas de consentement préalable.</p>
    </Prose>
  );
}
