import Link from "next/link";
import { BarChart3, Boxes, ShieldCheck, Wallet } from "lucide-react";
import { Logo } from "@/components/logo";
import { FlagBar } from "@/components/public-shell";

const POINTS = [
  { icon: Boxes, title: "Gestion commerciale complète", text: "Ventes, produits et stocks centralisés" },
  { icon: Wallet, title: "Vos finances sous contrôle", text: "Caisse, Mobile Money, banque et crédits" },
  { icon: ShieldCheck, title: "Données sécurisées", text: "Un espace isolé pour chaque entreprise" },
  { icon: BarChart3, title: "Un pilotage simplifié", text: "Des chiffres clairs pour mieux décider" },
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <aside className="relative overflow-hidden bg-navy px-6 py-8 text-white sm:px-10 lg:py-12">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_10%,rgb(var(--primary)/0.45),transparent_45%),radial-gradient(circle_at_10%_90%,rgb(var(--accent)/0.30),transparent_45%)]" aria-hidden />
        <div className="relative flex h-full flex-col">
          <Link href="/" className="self-start"><Logo inverted tagline /></Link>
          <div className="mt-8 lg:mt-auto">
            <h1 className="font-display text-3xl font-extrabold leading-tight sm:text-4xl lg:text-5xl">
              Votre partenaire de gestion au <span className="text-accent">quotidien</span>
            </h1>
            <p className="mt-4 max-w-md text-white/75">
              Une seule application pour gérer votre commerce, vos finances et faire grandir votre activité.
            </p>
            <FlagBar className="mt-6" />
          </div>
          <ul className="mt-8 hidden gap-4 sm:grid sm:grid-cols-2 lg:mt-auto">
            {POINTS.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex gap-3 rounded-xl bg-white/5 p-3 ring-1 ring-white/10">
                <Icon className="mt-0.5 shrink-0 text-accent" size={20} />
                <span>
                  <span className="block text-sm font-bold">{title}</span>
                  <span className="block text-xs text-white/65">{text}</span>
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-8 text-xs text-white/50">🇸🇳 Solution conçue au Sénégal · Ensemble vers la réussite !</p>
        </div>
      </aside>
      <main className="flex items-center justify-center bg-bg px-4 py-10 sm:px-8">
        <div className="w-full max-w-md">{children}</div>
      </main>
    </div>
  );
}
