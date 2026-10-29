export const APP_NAME = "Mënjëf PRO";
export const APP_SLOGAN = "Gérez mieux, décidez mieux, grandissez plus vite !";
// À remplacer par l'adresse réelle via NEXT_PUBLIC_CONTACT_EMAIL
export const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL || "contact@menjef.pro";

export const PAYMENT_METHODS = {
  cash: "Espèces",
  wave: "Wave",
  orange_money: "Orange Money",
  free_money: "Free Money",
  other_mobile_money: "Autre Mobile Money",
  bank_transfer: "Virement bancaire",
  card: "Carte bancaire",
  other: "Autre",
} as const;
export type PaymentMethod = keyof typeof PAYMENT_METHODS;
export const PAYMENT_METHOD_KEYS = Object.keys(PAYMENT_METHODS) as PaymentMethod[];

export const ACCOUNT_KINDS = {
  cash: "Caisse physique",
  bank: "Compte bancaire",
  mobile_money: "Mobile Money",
  other: "Autre",
} as const;
export type AccountKind = keyof typeof ACCOUNT_KINDS;

export const SECTORS = {
  boutique: "Boutique / magasin",
  superette: "Supérette",
  supermarche: "Supermarché",
  restaurant: "Restaurant / fast-food",
  grossiste: "Grossiste / distributeur",
  pharmacie: "Pharmacie / parapharmacie",
  quincaillerie: "Quincaillerie",
  cosmetique: "Cosmétique / beauté",
  services: "Services",
  autre: "Autre activité",
} as const;
export type Sector = keyof typeof SECTORS;

export const LOCATION_TYPES = {
  boutique: "Boutique",
  magasin: "Magasin",
  depot: "Dépôt / entrepôt",
  restaurant: "Restaurant",
  bureau: "Bureau",
  autre: "Autre",
} as const;
export type LocationType = keyof typeof LOCATION_TYPES;

export const STOCK_MOVEMENT_TYPES = {
  initial: "Stock initial",
  purchase_in: "Entrée achat",
  sale_out: "Sortie vente",
  sale_cancel: "Annulation de vente",
  customer_return: "Retour client",
  supplier_return: "Retour fournisseur",
  inventory_adjustment: "Ajustement d'inventaire",
  transfer_out: "Transfert sortant",
  transfer_in: "Transfert entrant",
  loss: "Perte / casse / périmé",
  correction: "Correction",
} as const;

export const TREASURY_KINDS = {
  opening: "Solde initial",
  sale_payment: "Encaissement vente",
  sale_refund: "Remboursement vente",
  customer_payment: "Remboursement client",
  supplier_payment: "Paiement fournisseur",
  expense: "Dépense",
  expense_cancel: "Annulation dépense",
  other_income: "Recette diverse",
  other_income_cancel: "Annulation recette",
  transfer_in: "Transfert entrant",
  transfer_out: "Transfert sortant",
  cash_gap: "Écart de caisse",
} as const;

export const PURCHASE_STATUS = {
  draft: "Brouillon",
  ordered: "Commandée",
  partially_received: "Reçue partiellement",
  received: "Reçue",
  cancelled: "Annulée",
} as const;

export const UNITS = ["unité", "kg", "g", "litre", "cl", "carton", "paquet", "sac", "boîte", "bouteille", "mètre", "plat", "portion"];
