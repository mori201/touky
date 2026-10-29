import type { Permission } from "@/lib/permissions";

export interface NavItem {
  href: string;
  label: string;
  icon: string;
  any?: Permission[];
  group: "pilotage" | "commerce" | "finances" | "organisation";
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/app", label: "Tableau de bord", icon: "LayoutDashboard", group: "pilotage" },
  { href: "/app/caisse", label: "Caisse", icon: "ShoppingCart", any: ["sales.create"], group: "commerce" },
  { href: "/app/ventes", label: "Historique des ventes", icon: "ReceiptText", any: ["sales.view"], group: "commerce" },
  { href: "/app/clients", label: "Clients et crédits", icon: "Users", any: ["credits.view"], group: "commerce" },
  { href: "/app/produits", label: "Catalogue", icon: "Package", group: "commerce" },
  { href: "/app/stock", label: "Stock", icon: "Boxes", group: "commerce" },
  { href: "/app/achats", label: "Fournisseurs et achats", icon: "Truck", any: ["purchases.manage", "suppliers.manage"], group: "commerce" },
  { href: "/app/depenses", label: "Dépenses et recettes", icon: "Wallet", any: ["expenses.manage", "reports.view"], group: "finances" },
  { href: "/app/tresorerie", label: "Trésorerie et caisses", icon: "Landmark", any: ["treasury.manage", "cash.close", "reports.view"], group: "finances" },
  { href: "/app/finances", label: "Finances et rentabilité", icon: "TrendingUp", any: ["reports.view"], group: "finances" },
  { href: "/app/budget", label: "Budget personnel", icon: "PiggyBank", group: "finances" },
  { href: "/app/equipe", label: "Équipe", icon: "UserCog", any: ["team.manage"], group: "organisation" },
  { href: "/app/etablissements", label: "Établissements", icon: "Store", any: ["locations.manage"], group: "organisation" },
  { href: "/app/parametres", label: "Paramètres", icon: "Settings", any: ["settings.manage"], group: "organisation" },
  { href: "/app/journal", label: "Journal d'audit", icon: "ScrollText", any: ["audit.view"], group: "organisation" },
];

export const GROUP_LABELS = {
  pilotage: "Pilotage",
  commerce: "Commerce",
  finances: "Finances",
  organisation: "Organisation",
} as const;
