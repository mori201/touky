"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import {
  Boxes, Landmark, LayoutDashboard, Menu, Package, PiggyBank, ReceiptText, ScrollText, Settings,
  ShoppingCart, Store, TrendingUp, Truck, UserCog, Users, Wallet, X, LifeBuoy, ShieldCheck,
} from "lucide-react";
import { Logo } from "@/components/logo";
import { GROUP_LABELS, type NavItem } from "@/components/app-nav";
import { cn } from "@/lib/utils";

const ICONS = {
  Boxes, Landmark, LayoutDashboard, Package, PiggyBank, ReceiptText, ScrollText, Settings,
  ShoppingCart, Store, TrendingUp, Truck, UserCog, Users, Wallet,
} as const;

function isActive(path: string, href: string) {
  return href === "/app" ? path === "/app" : path === href || path.startsWith(href + "/");
}

function NavList({ items, onNavigate, platformAdmin }: { items: NavItem[]; onNavigate?: () => void; platformAdmin: boolean }) {
  const path = usePathname();
  const groups = Object.keys(GROUP_LABELS) as (keyof typeof GROUP_LABELS)[];
  return (
    <nav aria-label="Menu de l'application" className="space-y-5">
      {groups.map((g) => {
        const list = items.filter((i) => i.group === g);
        if (list.length === 0) return null;
        return (
          <div key={g}>
            <p className="px-3 text-[0.65rem] font-bold uppercase tracking-[0.16em] text-white/45">{GROUP_LABELS[g]}</p>
            <ul className="mt-1.5 space-y-0.5">
              {list.map((item) => {
                const Icon = ICONS[item.icon as keyof typeof ICONS];
                const active = isActive(path, item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition",
                        active ? "bg-white text-navy shadow" : "text-white/80 hover:bg-white/10 hover:text-white",
                      )}
                    >
                      <Icon size={18} className={active ? "text-primary" : ""} />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
      <ul className="space-y-0.5 border-t border-white/10 pt-4">
        <li>
          <Link href="/aide" target="_blank" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-white/80 hover:bg-white/10">
            <LifeBuoy size={18} /> Assistance et manuel
          </Link>
        </li>
        {platformAdmin && (
          <li>
            <Link href="/app/admin" onClick={onNavigate} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-white/80 hover:bg-white/10">
              <ShieldCheck size={18} /> Administration SaaS
            </Link>
          </li>
        )}
      </ul>
    </nav>
  );
}

export function AppShell({
  items,
  topbar,
  quick,
  children,
  platformAdmin,
}: {
  items: NavItem[];
  topbar: ReactNode;
  quick: NavItem[];
  children: ReactNode;
  platformAdmin: boolean;
}) {
  const [open, setOpen] = useState(false);
  const path = usePathname();
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[264px_1fr]">
      <aside className="no-print sticky top-0 hidden h-screen overflow-y-auto bg-navy px-3 py-5 lg:block">
        <Link href="/app" className="mb-6 block px-2"><Logo inverted /></Link>
        <NavList items={items} platformAdmin={platformAdmin} />
      </aside>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="absolute inset-0 bg-navy/60" onClick={() => setOpen(false)} aria-hidden />
          <aside className="absolute inset-y-0 left-0 w-[82%] max-w-xs overflow-y-auto bg-navy px-3 py-5 shadow-2xl">
            <div className="mb-6 flex items-center justify-between px-2">
              <Logo inverted />
              <button onClick={() => setOpen(false)} className="rounded-lg p-2 text-white/80 hover:bg-white/10" aria-label="Fermer le menu"><X size={20} /></button>
            </div>
            <NavList items={items} onNavigate={() => setOpen(false)} platformAdmin={platformAdmin} />
          </aside>
        </div>
      )}

      <div className="min-w-0">
        <div className="no-print sticky top-0 z-30 border-b border-border bg-surface/90 backdrop-blur">
          <div className="flex items-center gap-2 px-3 py-2.5 sm:px-5">
            <button onClick={() => setOpen(true)} className="rounded-lg p-2 text-fg hover:bg-muted lg:hidden" aria-label="Ouvrir le menu">
              <Menu size={22} />
            </button>
            {topbar}
          </div>
          <div className="flex gap-1.5 overflow-x-auto px-3 pb-2.5 sm:px-5 lg:hidden" aria-label="Accès rapide">
            {quick.map((q) => (
              <Link
                key={q.href}
                href={q.href}
                className={cn(
                  "whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-bold",
                  isActive(path, q.href) ? "border-primary bg-primary/10 text-primary" : "border-border bg-surface text-fg-muted",
                )}
              >
                {q.label}
              </Link>
            ))}
          </div>
        </div>
        <main className="mx-auto max-w-7xl px-3 py-6 sm:px-5 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
