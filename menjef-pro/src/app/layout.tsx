import type { Metadata, Viewport } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import { APP_NAME, APP_SLOGAN } from "@/lib/constants";
import { SITE_URL } from "@/lib/env";
import "./globals.css";

const sans = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const display = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-display", display: "swap", weight: ["600", "700", "800"] });

export const metadata: Metadata = {
  metadataBase: SITE_URL ? new URL(SITE_URL) : undefined,
  title: { default: `${APP_NAME} — Gestion commerciale et caisse pour les entrepreneurs`, template: `%s · ${APP_NAME}` },
  description:
    "Mënjëf PRO centralise vos ventes, votre caisse, vos stocks, vos crédits clients, vos fournisseurs et votre trésorerie. Conçu au Sénégal, en francs CFA, pour les commerçants et PME d'Afrique francophone.",
  applicationName: APP_NAME,
  keywords: ["logiciel de caisse Sénégal", "gestion de stock", "gestion commerciale", "FCFA", "Wave", "Orange Money", "PME Afrique", "point de vente"],
  openGraph: { type: "website", locale: "fr_SN", siteName: APP_NAME, title: APP_NAME, description: APP_SLOGAN },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#0a1f44" },
    { media: "(prefers-color-scheme: dark)", color: "#070d1a" },
  ],
};

// Applique le thème avant l'affichage pour éviter un flash
const themeScript = `try{var t=localStorage.getItem('mj-theme');if(t==='dark'||(!t&&matchMedia('(prefers-color-scheme: dark)').matches))document.documentElement.classList.add('dark')}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${sans.variable} ${display.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-screen font-sans">{children}</body>
    </html>
  );
}
