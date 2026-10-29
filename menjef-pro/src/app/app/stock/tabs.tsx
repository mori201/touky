import Link from "next/link";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/app/stock", label: "Niveaux de stock" },
  { href: "/app/stock/mouvements", label: "Mouvements" },
  { href: "/app/stock/inventaires", label: "Inventaires" },
  { href: "/app/stock/transferts", label: "Transferts" },
];

export function StockTabs({ active }: { active: string }) {
  return (
    <nav className="mb-5 flex gap-1 overflow-x-auto border-b border-border" aria-label="Sections du stock">
      {TABS.map((t) => (
        <Link key={t.href} href={t.href} className={cn("whitespace-nowrap border-b-2 px-3 py-2 text-sm font-semibold", active === t.href ? "border-primary text-primary" : "border-transparent text-fg-muted hover:text-fg")}>
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
