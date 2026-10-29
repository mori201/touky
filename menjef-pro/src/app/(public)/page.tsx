import Link from "next/link";
import {
  BarChart3, Boxes, CreditCard, HandCoins, Receipt, ShieldCheck, Store, Truck, Users, Wallet,
  UtensilsCrossed, ShoppingBasket, Warehouse, Pill, Building2, CheckCircle2,
} from "lucide-react";
import { ButtonLink } from "@/components/ui";
import { FlagBar } from "@/components/public-shell";

const FEATURES = [
  { icon: Receipt, title: "Caisse rapide", text: "Encaissez en quelques touches sur téléphone, tablette ou ordinateur. Espèces, Wave, Orange Money, paiement mixte ou crédit." },
  { icon: Boxes, title: "Stocks fiables", text: "Chaque entrée et sortie est tracée. Alertes de rupture, inventaires, transferts entre boutiques et valorisation au coût moyen." },
  { icon: HandCoins, title: "Crédits clients", text: "Sachez qui vous doit combien, depuis quand. Remboursements partiels, relevés et créances en retard." },
  { icon: Truck, title: "Fournisseurs et achats", text: "Commandes, réceptions partielles, retours et dettes fournisseurs. Le stock n'augmente qu'à la réception." },
  { icon: Wallet, title: "Trésorerie", text: "Caisse, banque et Mobile Money séparés. Ouverture, clôture et écarts de caisse justifiés." },
  { icon: BarChart3, title: "Tableau de bord", text: "Chiffre d'affaires, encaissements, dépenses, marge et bénéfice estimé, sans confusion entre ces notions." },
  { icon: Users, title: "Équipe et rôles", text: "Propriétaire, gérant, caissier, magasinier, comptable : chacun ne voit que ce qui le concerne." },
  { icon: ShieldCheck, title: "Données isolées", text: "Chaque entreprise dispose d'un espace séparé, protégé au niveau de la base de données." },
];

const SECTORS = [
  { icon: Store, title: "Boutiques et magasins", text: "Ventes au détail, stock par rayon, crédits de quartier." },
  { icon: ShoppingBasket, title: "Supérettes et supermarchés", text: "Codes-barres, plusieurs caissiers, clôtures journalières." },
  { icon: UtensilsCrossed, title: "Restaurants et fast-foods", text: "Plats et boissons, encaissements rapides, dépenses quotidiennes." },
  { icon: Warehouse, title: "Grossistes et distributeurs", text: "Prix de gros, gros volumes, dettes fournisseurs." },
  { icon: Pill, title: "Commerces spécialisés", text: "Pharmacies, quincailleries, cosmétiques : références et seuils d'alerte." },
  { icon: Building2, title: "PME multi-sites", text: "Plusieurs établissements, vue consolidée et comparaison des performances." },
];

const FAQ = [
  { q: "Ai-je besoin d'un matériel particulier ?", a: "Non. Mënjëf PRO fonctionne dans le navigateur d'un smartphone, d'une tablette ou d'un ordinateur. Une douchette code-barres USB ou Bluetooth peut être utilisée à la caisse si vous en avez une." },
  { q: "Les paiements Wave et Orange Money sont-ils vérifiés automatiquement ?", a: "Pas encore. Le caissier déclare le paiement et peut saisir la référence de la transaction. Le paiement est marqué « déclaré » tant qu'aucune intégration officielle avec l'opérateur ne permet de le confirmer." },
  { q: "Que se passe-t-il si deux caissiers vendent le dernier article en même temps ?", a: "Une seule vente est acceptée. Le stock est verrouillé pendant la validation et la seconde vente est refusée avec un message clair." },
  { q: "Puis-je gérer plusieurs boutiques ?", a: "Oui. Chaque établissement a son propre stock et ses caisses. Les utilisateurs autorisés voient une vue consolidée ; un employé peut être limité à son établissement." },
  { q: "Mon budget personnel est-il mélangé avec celui de mon commerce ?", a: "Non. L'espace budget personnel est strictement séparé : ses données ne sont jamais visibles par vos employés ni intégrées aux rapports de l'entreprise." },
  { q: "Puis-je annuler une vente ?", a: "Oui, avec la permission adéquate et un motif. L'annulation crée des mouvements inverses : le stock revient et la caisse est corrigée, sans effacer l'historique." },
];

function DashboardPreview() {
  const bars = [38, 52, 45, 61, 58, 72, 66, 80, 74, 88, 69, 92];
  return (
    <div className="relative rounded-2xl border border-border bg-surface p-4 shadow-2xl shadow-navy/10" aria-label="Aperçu illustratif du tableau de bord">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-widest text-primary">Tableau de bord</p>
        <span className="rounded-full bg-muted px-2 py-0.5 text-[0.65rem] font-semibold text-fg-muted">Aperçu illustratif</span>
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        {[
          ["Chiffre d'affaires", "1 284 500 F", "text-primary"],
          ["Encaissé", "1 102 000 F", "text-success"],
          ["Dépenses", "186 300 F", "text-danger"],
          ["Créances", "182 500 F", "text-warning"],
        ].map(([l, v, c]) => (
          <div key={l} className="rounded-xl border border-border bg-bg/60 p-3">
            <p className="text-[0.68rem] font-semibold text-fg-muted">{l}</p>
            <p className={`num mt-1 font-display text-base font-extrabold ${c}`}>{v}</p>
          </div>
        ))}
      </div>
      <div className="mt-3 rounded-xl border border-border p-3">
        <p className="mb-2 text-[0.68rem] font-semibold text-fg-muted">Ventes des 12 derniers jours</p>
        <div className="flex h-24 items-end gap-1.5">
          {bars.map((h, i) => (
            <span key={i} className="flex-1 rounded-t bg-gradient-to-t from-primary to-primary/50" style={{ height: `${h}%` }} />
          ))}
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2 rounded-xl bg-warning/10 px-3 py-2 text-xs text-fg">
        <span className="h-2 w-2 rounded-full bg-warning" /> 3 produits sous le seuil d&apos;alerte
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <>
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_right,rgb(var(--primary)/0.14),transparent_55%),radial-gradient(ellipse_at_bottom_left,rgb(var(--accent)/0.10),transparent_50%)]" />
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 pb-16 pt-12 md:grid-cols-2 md:pt-20">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs font-semibold text-fg-muted">
              🇸🇳 Conçu au Sénégal · Montants en francs CFA
            </p>
            <h1 className="mt-5 font-display text-4xl font-extrabold leading-[1.08] tracking-tight text-navy dark:text-fg sm:text-5xl">
              Votre commerce, <span className="text-primary">piloté</span> en toute{" "}
              <span className="relative text-accent">
                clarté
                <svg className="absolute -bottom-2 left-0 w-full" viewBox="0 0 100 8" preserveAspectRatio="none" aria-hidden>
                  <path d="M1 6 Q50 0 99 5" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" />
                </svg>
              </span>
            </h1>
            <p className="mt-6 max-w-lg text-lg text-fg-muted">
              Ventes, caisse, stock, crédits clients, fournisseurs et trésorerie réunis dans une seule application.
              Sachez chaque jour combien vous avez vendu, encaissé et gagné.
            </p>
            <FlagBar className="mt-6" />
            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink href="/inscription" size="lg">Créer mon compte</ButtonLink>
              <ButtonLink href="/fonctionnalites" size="lg" variant="outline">Découvrir la plateforme</ButtonLink>
            </div>
            <p className="mt-4 text-sm text-fg-muted">Essai gratuit de 30 jours · Sans carte bancaire · Sans installation</p>
          </div>
          <DashboardPreview />
        </div>
      </section>

      <section className="bg-navy py-10 text-white">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 text-center sm:grid-cols-3">
          {[
            ["Chiffre d'affaires ≠ encaissements", "Les ventes à crédit ne sont jamais comptées comme de l'argent reçu."],
            ["Stock tracé à l'unité", "Chaque mouvement indique qui, quand, combien et pourquoi."],
            ["Aucune double vente", "Un double clic ou une connexion instable n'enregistre jamais deux fois la même vente."],
          ].map(([t, d]) => (
            <div key={t}>
              <p className="font-display text-lg font-bold">{t}</p>
              <p className="mt-1 text-sm text-white/70">{d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-20" aria-labelledby="fonctionnalites">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Fonctionnalités</p>
        <h2 id="fonctionnalites" className="mt-2 max-w-2xl font-display text-3xl font-extrabold tracking-tight">
          Tout ce qu&apos;il faut pour gérer, rien de superflu
        </h2>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <div key={title} className="rounded-2xl border border-border bg-surface p-5 shadow-card">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary"><Icon size={20} /></span>
              <h3 className="mt-4 font-display font-bold">{title}</h3>
              <p className="mt-1.5 text-sm text-fg-muted">{text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-y border-border bg-surface py-20" aria-labelledby="secteurs">
        <div className="mx-auto max-w-6xl px-4">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-accent">Cas d&apos;utilisation</p>
          <h2 id="secteurs" className="mt-2 font-display text-3xl font-extrabold tracking-tight">Adapté à votre activité</h2>
          <p className="mt-2 max-w-2xl text-fg-muted">
            À l&apos;inscription, vous choisissez votre secteur. Les fonctions essentielles restent disponibles pour tous.
          </p>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {SECTORS.map(({ icon: Icon, title, text }) => (
              <div key={title} className="flex gap-4 rounded-2xl border border-border p-5">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-accent/10 text-accent"><Icon size={22} /></span>
                <div>
                  <h3 className="font-display font-bold">{title}</h3>
                  <p className="mt-1 text-sm text-fg-muted">{text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-10 px-4 py-20 md:grid-cols-2" aria-labelledby="benefices">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Bénéfices</p>
          <h2 id="benefices" className="mt-2 font-display text-3xl font-extrabold tracking-tight">Fini les cahiers et les tableurs dispersés</h2>
          <p className="mt-3 text-fg-muted">
            Chaque chiffre du tableau de bord s&apos;explique par les opérations qui le composent. Vous savez enfin où
            passe votre argent.
          </p>
        </div>
        <ul className="space-y-3">
          {[
            "Savoir combien vous avez vendu et réellement encaissé aujourd'hui",
            "Connaître la valeur de votre stock et vos produits les plus vendus",
            "Suivre qui vous doit de l'argent et ce que vous devez à vos fournisseurs",
            "Contrôler les écarts de caisse à chaque clôture",
            "Comparer les performances de vos établissements",
            "Déléguer à votre équipe sans perdre le contrôle",
          ].map((b) => (
            <li key={b} className="flex items-start gap-3 rounded-xl border border-border bg-surface px-4 py-3">
              <CheckCircle2 className="mt-0.5 shrink-0 text-accent" size={18} />
              <span className="text-sm font-medium">{b}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="border-t border-border bg-surface py-20" aria-labelledby="faq">
        <div className="mx-auto max-w-3xl px-4">
          <h2 id="faq" className="font-display text-3xl font-extrabold tracking-tight">Questions fréquentes</h2>
          <div className="mt-8 divide-y divide-border rounded-2xl border border-border">
            {FAQ.map(({ q, a }) => (
              <details key={q} className="group px-5 py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold">
                  {q}
                  <span className="text-fg-muted transition group-open:rotate-45">+</span>
                </summary>
                <p className="mt-2 text-sm text-fg-muted">{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pt-20">
        <div className="overflow-hidden rounded-3xl bg-navy px-6 py-12 text-center text-white sm:px-12">
          <CreditCard className="mx-auto text-accent" size={32} />
          <h2 className="mt-4 font-display text-3xl font-extrabold">Prêt à piloter votre activité ?</h2>
          <p className="mx-auto mt-2 max-w-xl text-white/70">
            Créez votre entreprise et votre premier établissement en moins de cinq minutes.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <ButtonLink href="/inscription" size="lg" variant="accent">Créer mon compte gratuitement</ButtonLink>
            <Link href="/aide" className="inline-flex h-12 items-center rounded-lg px-5 font-semibold text-white/80 hover:text-white">
              Lire le manuel →
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
