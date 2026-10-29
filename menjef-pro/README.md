# Mënjëf PRO

> « Gérez mieux, décidez mieux, grandissez plus vite ! »

SaaS de gestion commerciale, financière et opérationnelle pour les commerçants et PME d'Afrique francophone.
Marché de lancement : Sénégal · devise XOF (franc CFA BCEAO) · fuseau `Africa/Dakar` · interface en français.

## Stack

| Couche | Choix |
| --- | --- |
| Frontend | Next.js 15 (App Router), React 19, TypeScript strict, Tailwind CSS 3, Recharts, lucide-react |
| Validation | Zod (Server Actions), contrôles répétés en base |
| Données | PostgreSQL (Supabase), RLS sur toutes les tables, fonctions transactionnelles `SECURITY DEFINER` |
| Auth | Supabase Auth (e-mail + mot de passe, confirmation d'e-mail, réinitialisation), `@supabase/ssr` |
| Hébergement | Vercel (dossier racine du projet : `menjef-pro`) |

Aucune clé secrète n'est utilisée par l'application : seules l'URL et la clé publique Supabase sont exposées, la sécurité repose sur la RLS.

## Modules

- **Site public** : accueil, fonctionnalités, tarifs, à propos, contact, centre d'aide, CGU, confidentialité, cookies (textes juridiques à faire valider), SEO (métadonnées, sitemap, robots).
- **Authentification** : inscription avec acceptation des conditions, vérification d'e-mail, connexion, mot de passe oublié, changement de mot de passe, demande de suppression de compte.
- **Assistant de démarrage** en 8 étapes (responsable, entreprise, coordonnées, établissement, produits, moyens de paiement, équipe, fin), reprise possible.
- **Multi-entreprise et multi-établissement** : un utilisateur peut appartenir à plusieurs entreprises ; un membre peut être limité à un établissement.
- **Tableau de bord** : CA, encaissements, dépenses, créances, marge brute, bénéfice estimé, valeur du stock, dettes fournisseurs, trésorerie par compte, alertes, graphiques, comparaison avec la période précédente, filtres de période, d'établissement et de vendeur.
- **Caisse** : recherche et code-barres, panier tactile, remises (permission), prix de gros, paiements mixtes (espèces, Wave, Orange Money, Free Money, carte, virement…), monnaie à rendre, crédit client avec plafond et échéance, reçu imprimable, **clé d'idempotence** contre les doubles ventes.
- **Ventes** : historique filtrable, annulation par mouvements compensatoires, retours partiels.
- **Catalogue** : fiches produits, catégories, import CSV avec aperçu et contrôle des doublons, archivage (jamais de suppression destructrice).
- **Stock** : journal immuable des mouvements, coût moyen pondéré, inventaires, transferts, alertes, refus de la survente (verrouillage de ligne).
- **Clients et crédits** : soldes, retards, remboursements affectés aux ventes les plus anciennes, promesses de paiement, relevé et reçu imprimables.
- **Fournisseurs et achats** : bons de commande, réception partielle (le stock n'augmente qu'à la réception), retours, paiements, dettes.
- **Dépenses et recettes diverses**, **trésorerie** (comptes, transferts internes neutres), **ouverture / clôture de caisse** avec écarts justifiés et corrections tracées.
- **Finances** : compte de résultat estimé et flux de trésorerie, formules expliquées, avertissements si les données sont incomplètes.
- **Budget personnel** strictement séparé (tables sans `organization_id`, RLS `user_id = auth.uid()`).
- **Équipe** : 7 rôles, 24 permissions, invitations par lien, suspension ; **journal d'audit** ; **administration SaaS**.
- **Exports CSV** (séparateur « ; », compatibles Excel, protégés contre l'injection de formules).

## Sécurité

- RLS activée sur toutes les tables ; aucune politique d'écriture sur les ventes, stocks, paiements, trésorerie et achats : ces écritures passent uniquement par des fonctions qui vérifient les permissions (`has_perm`) et l'établissement (`can_access_location`).
- Coûts d'achat masqués au niveau des colonnes (`products.purchase_price`, `stock_levels.avg_cost`, `sale_items.unit_cost`, `stock_movements.unit_cost`) ; ils ne sont lisibles qu'au travers de `get_product_costs` (permission `costs.view`).
- Un déclencheur refuse les modifications de prix sans la permission `prices.edit` et tout changement d'`organization_id`.
- Les cookies `mj_org` / `mj_loc` ne mémorisent qu'un choix d'affichage ; l'appartenance est revérifiée côté serveur et par la base.
- Redirections internes uniquement (pas de redirection ouverte), en-têtes de sécurité HTTP, termes de recherche nettoyés avant les filtres PostgREST.

## Développement local

```bash
cd menjef-pro
cp .env.example .env.local   # renseigner l'URL et la clé publique Supabase
npm install
npm run dev
```

Contrôles : `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`.

### Tester les migrations SQL sans Supabase

`supabase/tests/local_auth_stub.sql` imite le schéma `auth` ; `supabase/tests/scenario.sql` déroule un scénario complet
(vente, idempotence, survente refusée, crédit, remboursement, annulation, achat et CMUP, dépense, clôture de caisse,
inventaire, isolation entre entreprises, droits du caissier) :

```bash
createdb menjef_test
for f in supabase/tests/local_auth_stub.sql supabase/migrations/*.sql supabase/tests/scenario.sql; do
  psql -v ON_ERROR_STOP=1 -d menjef_test -f "$f"
done
```

## Déploiement

1. **Supabase** : appliquer les fichiers de `supabase/migrations/` dans l'ordre (SQL Editor, `supabase db push` ou MCP).
2. **Supabase → Authentication → URL Configuration** :
   - *Site URL* : l'URL de production (ex. `https://menjef-pro.vercel.app`) ;
   - *Redirect URLs* : `https://menjef-pro.vercel.app/auth/callback` et `https://*-dramemorikeba201-3570s-projects.vercel.app/auth/callback` pour les préversions.
3. **Supabase → Authentication → SMTP** : configurer un fournisseur d'e-mails (Resend, Brevo…). L'envoi intégré de Supabase est limité à quelques e-mails par heure.
4. **Vercel** : projet relié au dépôt GitHub, *Root Directory* = `menjef-pro`, variables `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_CONTACT_EMAIL`.
5. Pour accéder à l'administration SaaS : `insert into public.platform_admins (user_id) values ('<uuid>');`

## Limites connues (honnêtes)

- Les paiements Mobile Money sont **déclarés** par le caissier, pas vérifiés auprès de l'opérateur (aucune intégration Wave / Orange Money).
- Le paiement en ligne de l'abonnement n'est pas branché ; la période d'essai est enregistrée mais non bloquante.
- Les invitations produisent un lien à transmettre (WhatsApp, SMS) : aucun e-mail d'invitation n'est envoyé automatiquement.
- Pas de mode hors ligne pour la caisse.
- Les textes juridiques sont des projets à faire valider par un professionnel.
