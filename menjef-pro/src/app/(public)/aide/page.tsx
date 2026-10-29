import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Centre d'aide et manuel d'utilisation", description: "Guides pas à pas pour prendre en main Mënjëf PRO : caisse, produits, stock, crédits, achats, dépenses, trésorerie et équipe." };

const GUIDES: { id: string; title: string; steps: string[] }[] = [
  { id: "demarrer", title: "1. Démarrer", steps: [
    "Créez votre compte puis confirmez votre adresse e-mail grâce au lien reçu.",
    "L'assistant vous demande le nom de votre entreprise, son secteur et votre premier établissement.",
    "Une caisse « Caisse principale » et des comptes Wave et Orange Money sont créés automatiquement. Vous pouvez les renommer ou en ajouter dans Trésorerie.",
    "Vous pouvez quitter l'assistant à tout moment et le reprendre depuis le tableau de bord.",
  ] },
  { id: "produits", title: "2. Ajouter vos produits", steps: [
    "Menu Produits → « Nouveau produit ». Seuls le nom et le prix de vente sont obligatoires.",
    "Indiquez la quantité de départ : elle est enregistrée comme « Stock initial » dans l'établissement choisi.",
    "Pour un catalogue important, utilisez Produits → Importer et un fichier CSV (modèle téléchargeable). Un aperçu signale les erreurs avant l'import ; si une ligne est invalide, rien n'est importé.",
    "Le seuil d'alerte déclenche une notification sur le tableau de bord lorsque le stock passe en dessous.",
  ] },
  { id: "caisse", title: "3. Encaisser une vente", steps: [
    "Menu Caisse. Recherchez un produit par son nom, sa référence ou scannez son code-barres puis touchez-le pour l'ajouter.",
    "Ajustez les quantités dans le panier. Les remises ne sont proposées qu'aux utilisateurs autorisés.",
    "Choisissez un ou plusieurs modes de paiement. Pour les espèces, saisissez le montant reçu : la monnaie à rendre s'affiche.",
    "Un paiement inférieur au total exige de sélectionner un client : le reste devient une créance.",
    "Validez. Le reçu s'affiche et peut être imprimé. Un double appui ne crée jamais deux ventes.",
    "Les paiements Wave, Orange Money et Free Money sont « déclarés » : vérifiez la réception sur votre téléphone avant de valider.",
  ] },
  { id: "credits", title: "4. Suivre les crédits clients", steps: [
    "Menu Clients : la colonne « Solde dû » indique ce que chaque client vous doit, les montants en retard sont signalés.",
    "Ouvrez la fiche du client puis « Enregistrer un remboursement ». Le montant est affecté aux ventes les plus anciennes.",
    "Le relevé du client liste ses achats et remboursements ; il peut être imprimé.",
    "Notez les promesses de paiement pour planifier vos relances.",
  ] },
  { id: "stock", title: "5. Gérer le stock", steps: [
    "Menu Stock : quantités par établissement, valeur au coût moyen (si vous y êtes autorisé) et alertes.",
    "Pertes, casse ou produits périmés : « Ajuster » avec un motif obligatoire.",
    "Inventaire : créez un inventaire, saisissez les quantités comptées, puis validez. Les écarts génèrent des ajustements tracés.",
    "Transferts : déplacez de la marchandise d'un établissement à un autre.",
  ] },
  { id: "achats", title: "6. Acheter auprès des fournisseurs", steps: [
    "Créez le fournisseur, puis un bon de commande avec les produits, quantités et coûts.",
    "À la livraison, ouvrez la commande et « Réceptionner » : vous pouvez recevoir partiellement. Le stock et le coût moyen sont mis à jour à ce moment-là.",
    "Enregistrez vos paiements : la dette fournisseur diminue d'autant.",
    "Un retour fournisseur diminue le stock et la dette.",
  ] },
  { id: "depenses", title: "7. Dépenses et trésorerie", steps: [
    "Menu Dépenses : enregistrez loyer, salaires, transport… avec le compte de paiement utilisé.",
    "Les recettes diverses (location, commissions…) sont distinctes des ventes.",
    "Trésorerie : soldes de chaque compte et transferts internes (ex. versement de la caisse à la banque). Un transfert n'est ni une recette ni une dépense.",
    "Clôture de caisse : comptez les espèces, saisissez le montant. En cas d'écart, un commentaire est demandé. Une clôture ne peut être corrigée que par un responsable, avec motif, et la correction reste visible.",
  ] },
  { id: "equipe", title: "8. Inviter votre équipe", steps: [
    "Menu Équipe → « Inviter » : adresse e-mail, rôle et, si besoin, établissement autorisé.",
    "Copiez le lien d'invitation et envoyez-le (WhatsApp, SMS, e-mail). Il est valable 7 jours.",
    "La personne crée son compte avec la même adresse e-mail puis ouvre le lien pour rejoindre l'entreprise.",
    "Un caissier ne voit ni les coûts d'achat, ni les marges, ni la trésorerie globale.",
  ] },
  { id: "chiffres", title: "9. Comprendre vos chiffres", steps: [
    "Chiffre d'affaires : total des ventes validées (crédits compris), retours déduits.",
    "Encaissements : argent réellement entré dans vos comptes (ventes payées, remboursements clients, recettes diverses).",
    "Marge brute : chiffre d'affaires hors taxes − coût d'achat des articles vendus.",
    "Bénéfice net estimé : marge brute − dépenses + recettes diverses. Il n'est fiable que si toutes vos dépenses sont saisies.",
    "Trésorerie : solde de vos comptes à l'instant présent.",
  ] },
];

export default function HelpPage() {
  return (
    <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 lg:grid-cols-[220px_1fr]">
      <nav className="lg:sticky lg:top-24 lg:self-start" aria-label="Sommaire">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Manuel</p>
        <ul className="mt-3 space-y-1 text-sm">
          {GUIDES.map((g) => (
            <li key={g.id}><a href={`#${g.id}`} className="block rounded-lg px-2 py-1.5 text-fg-muted hover:bg-muted hover:text-fg">{g.title}</a></li>
          ))}
        </ul>
      </nav>
      <div>
        <h1 className="font-display text-4xl font-extrabold tracking-tight">Centre d&apos;aide</h1>
        <p className="mt-3 text-fg-muted">Tout ce qu&apos;il faut savoir pour utiliser Mënjëf PRO au quotidien.</p>
        <div className="mt-8 space-y-6">
          {GUIDES.map((g) => (
            <section key={g.id} id={g.id} className="scroll-mt-24 rounded-2xl border border-border bg-surface p-6 shadow-card">
              <h2 className="font-display text-xl font-bold">{g.title}</h2>
              <ol className="mt-4 space-y-2.5">
                {g.steps.map((s, i) => (
                  <li key={i} className="flex gap-3 text-sm">
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-bold text-primary">{i + 1}</span>
                    <span className="text-fg/85">{s}</span>
                  </li>
                ))}
              </ol>
            </section>
          ))}
        </div>
        <p className="mt-8 text-sm text-fg-muted">
          Vous ne trouvez pas la réponse ? <Link href="/contact" className="font-semibold text-primary">Contactez l&apos;assistance</Link>.
        </p>
      </div>
    </div>
  );
}
