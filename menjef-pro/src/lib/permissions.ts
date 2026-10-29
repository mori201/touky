export const PERMISSIONS = {
  "sales.view": "Consulter les ventes",
  "sales.create": "Créer une vente",
  "sales.cancel": "Annuler une vente / enregistrer un retour",
  "sales.discount": "Accorder une remise",
  "sales.credit": "Vendre à crédit",
  "costs.view": "Consulter les coûts d'achat et les marges",
  "prices.edit": "Modifier les prix de vente",
  "products.manage": "Gérer le catalogue",
  "stock.manage": "Gérer les stocks",
  "stock.inventory": "Effectuer un inventaire",
  "stock.negative": "Vendre au-delà du stock (si autorisé)",
  "credits.view": "Consulter les créances",
  "payments.record": "Enregistrer des remboursements clients",
  "expenses.manage": "Gérer les dépenses et recettes",
  "treasury.manage": "Gérer la trésorerie",
  "cash.close": "Ouvrir et clôturer une caisse",
  "suppliers.manage": "Gérer les fournisseurs",
  "purchases.manage": "Gérer les achats",
  "reports.view": "Consulter les rapports",
  "reports.export": "Exporter les données",
  "team.manage": "Gérer l'équipe",
  "settings.manage": "Modifier les paramètres de l'entreprise",
  "locations.manage": "Gérer les établissements",
  "audit.view": "Consulter le journal d'audit",
} as const;
export type Permission = keyof typeof PERMISSIONS;

export const ROLES = {
  owner: { label: "Propriétaire", description: "Accès complet, y compris la gestion des propriétaires." },
  admin: { label: "Administrateur", description: "Accès complet à l'entreprise." },
  manager: { label: "Gérant d'établissement", description: "Ventes, stock, achats, dépenses et rapports." },
  cashier: { label: "Caissier", description: "Caisse, ventes, remboursements clients et clôture." },
  stock_manager: { label: "Gestionnaire de stock", description: "Catalogue, stock, inventaires et achats." },
  accountant: { label: "Comptable", description: "Finances, trésorerie, rapports et journal d'audit." },
  viewer: { label: "Observateur", description: "Lecture seule des ventes et rapports." },
} as const;
export type Role = keyof typeof ROLES;
export const ROLE_KEYS = Object.keys(ROLES) as Role[];
