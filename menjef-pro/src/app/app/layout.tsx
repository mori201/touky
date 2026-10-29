import type { Metadata } from "next";
import Link from "next/link";
import { Search } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { NAV_ITEMS } from "@/components/app-nav";
import { LocationSwitcher, OrganizationSwitcher } from "@/components/context-switchers";
import { ThemeToggle } from "@/components/ui/client";
import { getAppContext } from "@/lib/context";
import { ROLES } from "@/lib/permissions";

// Données propres à chaque utilisateur : jamais de rendu statique
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Espace de gestion", robots: { index: false, follow: false } };

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getAppContext();
  const { data: isAdmin } = await ctx.supabase.rpc("is_platform_admin");
  const items = NAV_ITEMS.filter((i) => !i.any || i.any.some((p) => ctx.can(p)));
  const quickHrefs = ["/app", "/app/caisse", "/app/stock", "/app/clients", "/app/achats", "/app/depenses", "/app/tresorerie"];
  const quick = items.filter((i) => quickHrefs.includes(i.href));

  const topbar = (
    <>
      <OrganizationSwitcher current={ctx.org.id} options={ctx.memberships.map((m) => ({ id: m.organization.id, name: m.organization.name }))} />
      <LocationSwitcher current={ctx.locationId} options={ctx.locations} restricted={!!ctx.restrictedTo} />
      <form action="/app/recherche" className="relative mx-auto hidden min-w-0 max-w-md flex-1 md:block" role="search">
        <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fg-muted" size={16} />
        <input name="q" type="search" placeholder="Rechercher un produit, un client, une vente…" aria-label="Recherche" className="input h-9 rounded-full pl-9" />
      </form>
      <div className="ml-auto flex items-center gap-2">
        <Link href="/app/recherche" className="rounded-lg p-2 text-fg-muted hover:bg-muted md:hidden" aria-label="Rechercher"><Search size={18} /></Link>
        <ThemeToggle className="hidden sm:inline-flex" />
        <Link href="/app/profil" className="hidden max-w-[12rem] truncate rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold text-fg-muted hover:text-fg sm:block" title="Mon profil">
          {ctx.profile?.full_name || ctx.user.email} · {ROLES[ctx.role].label}
        </Link>
        <form action="/auth/deconnexion" method="post">
          <button className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-bold text-fg hover:bg-muted">Déconnexion</button>
        </form>
      </div>
    </>
  );

  return (
    <AppShell items={items} quick={quick} topbar={topbar} platformAdmin={!!isAdmin}>
      {children}
    </AppShell>
  );
}
