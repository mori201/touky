-- =====================================================================
-- Mënjëf PRO — Schéma principal (multi-entreprise)
-- Toutes les données commerciales sont rattachées à organization_id.
-- Les écritures financières et de stock passent exclusivement par des
-- fonctions transactionnelles (voir 20261029000003_functions.sql).
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Types énumérés
-- ---------------------------------------------------------------------
create type public.app_role as enum (
  'owner', 'admin', 'manager', 'cashier', 'stock_manager', 'accountant', 'viewer'
);

create type public.business_sector as enum (
  'boutique', 'superette', 'supermarche', 'restaurant', 'grossiste',
  'pharmacie', 'quincaillerie', 'cosmetique', 'services', 'autre'
);

create type public.location_type as enum (
  'boutique', 'magasin', 'depot', 'restaurant', 'bureau', 'autre'
);

create type public.payment_method as enum (
  'cash', 'wave', 'orange_money', 'free_money', 'other_mobile_money',
  'bank_transfer', 'card', 'other'
);

create type public.account_kind as enum ('cash', 'bank', 'mobile_money', 'other');

create type public.stock_movement_type as enum (
  'initial', 'purchase_in', 'sale_out', 'sale_cancel', 'customer_return',
  'supplier_return', 'inventory_adjustment', 'transfer_out', 'transfer_in',
  'loss', 'correction'
);

create type public.treasury_movement_kind as enum (
  'opening', 'sale_payment', 'sale_refund', 'customer_payment',
  'supplier_payment', 'expense', 'expense_cancel', 'other_income',
  'other_income_cancel', 'transfer_in', 'transfer_out', 'cash_gap'
);

create type public.sale_status as enum ('completed', 'cancelled');

create type public.purchase_status as enum (
  'draft', 'ordered', 'partially_received', 'received', 'cancelled'
);

create type public.record_status as enum ('posted', 'cancelled');

-- ---------------------------------------------------------------------
-- Utilitaire updated_at
-- ---------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ---------------------------------------------------------------------
-- Profils utilisateurs
-- ---------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  phone text,
  email text,
  terms_accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

-- Création automatique du profil à l'inscription
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, phone, email, terms_accepted_at)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    new.raw_user_meta_data->>'phone',
    new.email,
    case when (new.raw_user_meta_data->>'terms_accepted') = 'true' then now() end
  );
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create table public.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.account_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  reason text,
  status text not null default 'pending' check (status in ('pending', 'processed', 'rejected')),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Entreprises, établissements, membres
-- ---------------------------------------------------------------------
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 2 and 120),
  sector public.business_sector not null default 'boutique',
  phone text,
  email text,
  address text,
  city text,
  country text not null default 'SN',
  currency text not null default 'XOF',
  timezone text not null default 'Africa/Dakar',
  ninea text,
  rccm text,
  receipt_footer text,
  tax_enabled boolean not null default false,
  tax_rate numeric(5,2) not null default 0 check (tax_rate >= 0 and tax_rate <= 100),
  allow_negative_stock boolean not null default false,
  require_cash_gap_comment boolean not null default true,
  enabled_payment_methods public.payment_method[] not null
    default array['cash', 'wave', 'orange_money']::public.payment_method[],
  onboarding_completed boolean not null default false,
  onboarding_step int not null default 1,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger organizations_touch before update on public.organizations
  for each row execute function public.touch_updated_at();

create table public.locations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 120),
  type public.location_type not null default 'boutique',
  address text,
  city text,
  phone text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, name)
);
create index on public.locations (organization_id);
create trigger locations_touch before update on public.locations
  for each row execute function public.touch_updated_at();

create table public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null default 'viewer',
  -- Si renseigné, le membre est limité à cet établissement
  location_id uuid references public.locations(id) on delete set null,
  status text not null default 'active' check (status in ('active', 'suspended')),
  created_at timestamptz not null default now(),
  unique (organization_id, user_id)
);
create index on public.organization_members (user_id);

create table public.role_permissions (
  role public.app_role not null,
  permission text not null,
  primary key (role, permission)
);

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  email text not null,
  role public.app_role not null,
  location_id uuid references public.locations(id) on delete set null,
  token text not null unique default encode(gen_random_bytes(24), 'hex'),
  invited_by uuid references auth.users(id),
  accepted_at timestamptz,
  revoked_at timestamptz,
  expires_at timestamptz not null default now() + interval '7 days',
  created_at timestamptz not null default now()
);
create index on public.invitations (organization_id);

create table public.subscriptions (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  plan text not null default 'essentiel' check (plan in ('essentiel', 'business', 'entreprise')),
  status text not null default 'trialing' check (status in ('trialing', 'active', 'past_due', 'cancelled')),
  trial_ends_at timestamptz default now() + interval '30 days',
  current_period_end timestamptz,
  created_at timestamptz not null default now()
);

create table public.org_counters (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  key text not null,
  value bigint not null default 0,
  primary key (organization_id, key)
);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  organization_id uuid references public.organizations(id) on delete cascade,
  user_id uuid,
  action text not null,
  entity text not null,
  entity_id text,
  data jsonb,
  created_at timestamptz not null default now()
);
create index on public.audit_logs (organization_id, created_at desc);

-- ---------------------------------------------------------------------
-- Catalogue
-- ---------------------------------------------------------------------
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 80),
  created_at timestamptz not null default now(),
  unique (organization_id, name)
);

create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 160),
  contact_name text,
  phone text,
  email text,
  address text,
  notes text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.suppliers (organization_id);
create trigger suppliers_touch before update on public.suppliers
  for each row execute function public.touch_updated_at();

create table public.products (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 200),
  sku text,
  barcode text,
  category_id uuid references public.categories(id) on delete set null,
  description text,
  unit text not null default 'unité',
  purchase_price numeric(14,2) not null default 0 check (purchase_price >= 0),
  sale_price numeric(14,2) not null default 0 check (sale_price >= 0),
  wholesale_price numeric(14,2) check (wholesale_price is null or wholesale_price >= 0),
  min_stock numeric(14,3) not null default 0 check (min_stock >= 0),
  supplier_id uuid references public.suppliers(id) on delete set null,
  image_url text,
  track_stock boolean not null default true,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index products_sku_unique on public.products (organization_id, lower(sku)) where sku is not null and sku <> '';
create unique index products_barcode_unique on public.products (organization_id, barcode) where barcode is not null and barcode <> '';
create index on public.products (organization_id, name);
create trigger products_touch before update on public.products
  for each row execute function public.touch_updated_at();

-- Stock courant par produit et par établissement (coût moyen pondéré)
create table public.stock_levels (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  location_id uuid not null references public.locations(id) on delete restrict,
  quantity numeric(14,3) not null default 0,
  avg_cost numeric(14,4) not null default 0,
  updated_at timestamptz not null default now(),
  primary key (product_id, location_id)
);
create index on public.stock_levels (organization_id, location_id);

-- Journal immuable des mouvements de stock
create table public.stock_movements (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  location_id uuid not null references public.locations(id) on delete restrict,
  type public.stock_movement_type not null,
  quantity numeric(14,3) not null, -- signé : + entrée, - sortie
  unit_cost numeric(14,4),
  balance_after numeric(14,3),
  reference_type text,
  reference_id uuid,
  reason text,
  created_by uuid,
  created_at timestamptz not null default now()
);
create index on public.stock_movements (organization_id, product_id, created_at desc);
create index on public.stock_movements (organization_id, location_id, created_at desc);

create table public.inventories (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  location_id uuid not null references public.locations(id) on delete restrict,
  number text not null,
  status text not null default 'draft' check (status in ('draft', 'validated', 'cancelled')),
  note text,
  created_by uuid,
  validated_by uuid,
  validated_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.inventories (organization_id);

create table public.inventory_lines (
  id uuid primary key default gen_random_uuid(),
  inventory_id uuid not null references public.inventories(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  theoretical_qty numeric(14,3) not null,
  counted_qty numeric(14,3),
  unique (inventory_id, product_id)
);

create table public.stock_transfers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  number text not null,
  from_location_id uuid not null references public.locations(id),
  to_location_id uuid not null references public.locations(id),
  note text,
  created_by uuid,
  created_at timestamptz not null default now(),
  check (from_location_id <> to_location_id)
);

create table public.stock_transfer_items (
  id uuid primary key default gen_random_uuid(),
  transfer_id uuid not null references public.stock_transfers(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  product_id uuid not null references public.products(id),
  quantity numeric(14,3) not null check (quantity > 0)
);

-- ---------------------------------------------------------------------
-- Trésorerie
-- ---------------------------------------------------------------------
create table public.treasury_accounts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  location_id uuid references public.locations(id) on delete set null,
  name text not null check (length(trim(name)) between 1 and 120),
  kind public.account_kind not null default 'cash',
  -- Moyen de paiement que ce compte reçoit par défaut à la caisse
  method public.payment_method,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  unique (organization_id, name)
);

create table public.treasury_movements (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  account_id uuid not null references public.treasury_accounts(id) on delete restrict,
  location_id uuid references public.locations(id),
  kind public.treasury_movement_kind not null,
  amount numeric(14,2) not null, -- signé : + encaissement, - décaissement
  label text,
  reference_type text,
  reference_id uuid,
  created_by uuid,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index on public.treasury_movements (organization_id, account_id, occurred_at);
create index on public.treasury_movements (organization_id, occurred_at);

create table public.treasury_transfers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  from_account_id uuid not null references public.treasury_accounts(id),
  to_account_id uuid not null references public.treasury_accounts(id),
  amount numeric(14,2) not null check (amount > 0),
  note text,
  created_by uuid,
  created_at timestamptz not null default now(),
  check (from_account_id <> to_account_id)
);

create table public.cash_sessions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  account_id uuid not null references public.treasury_accounts(id),
  opened_by uuid,
  opened_at timestamptz not null default now(),
  opening_balance numeric(14,2) not null,
  declared_opening numeric(14,2) not null,
  closed_by uuid,
  closed_at timestamptz,
  expected_balance numeric(14,2),
  counted_balance numeric(14,2),
  gap numeric(14,2),
  comment text,
  status text not null default 'open' check (status in ('open', 'closed'))
);
create unique index cash_sessions_one_open on public.cash_sessions (account_id) where status = 'open';

create table public.cash_session_corrections (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.cash_sessions(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  previous_counted numeric(14,2) not null,
  new_counted numeric(14,2) not null,
  reason text not null,
  created_by uuid,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Clients, ventes, crédits
-- ---------------------------------------------------------------------
create table public.customers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 160),
  phone text,
  email text,
  address text,
  credit_limit numeric(14,2) check (credit_limit is null or credit_limit >= 0),
  notes text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.customers (organization_id, name);
create trigger customers_touch before update on public.customers
  for each row execute function public.touch_updated_at();

create table public.sales (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  location_id uuid not null references public.locations(id),
  number text not null,
  cashier_id uuid,
  customer_id uuid references public.customers(id),
  price_mode text not null default 'retail' check (price_mode in ('retail', 'wholesale')),
  subtotal numeric(14,2) not null,
  discount_total numeric(14,2) not null default 0,
  tax_total numeric(14,2) not null default 0,
  total numeric(14,2) not null,
  paid_at_checkout numeric(14,2) not null default 0,
  amount_received numeric(14,2),
  change_given numeric(14,2),
  balance_due numeric(14,2) not null default 0,
  returned_total numeric(14,2) not null default 0,
  due_date date,
  status public.sale_status not null default 'completed',
  idempotency_key text,
  note text,
  cancelled_at timestamptz,
  cancelled_by uuid,
  cancel_reason text,
  created_at timestamptz not null default now(),
  unique (organization_id, number),
  unique (organization_id, idempotency_key)
);
create index on public.sales (organization_id, created_at desc);
create index on public.sales (organization_id, customer_id) where customer_id is not null;

create table public.sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  product_id uuid not null references public.products(id),
  product_name text not null,
  quantity numeric(14,3) not null check (quantity > 0),
  unit_price numeric(14,2) not null,
  discount numeric(14,2) not null default 0,
  line_total numeric(14,2) not null,
  unit_cost numeric(14,4) not null default 0,
  returned_qty numeric(14,3) not null default 0
);
create index on public.sale_items (sale_id);
create index on public.sale_items (organization_id, product_id);

create table public.sale_payments (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  method public.payment_method not null,
  account_id uuid not null references public.treasury_accounts(id),
  amount numeric(14,2) not null check (amount > 0),
  reference text,
  -- Un paiement Mobile Money est « déclaré » tant qu'aucune intégration ne le vérifie
  verified boolean not null default false,
  created_at timestamptz not null default now()
);
create index on public.sale_payments (sale_id);

create table public.sale_returns (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  sale_id uuid not null references public.sales(id),
  amount numeric(14,2) not null,
  refunded_amount numeric(14,2) not null default 0,
  credit_reduction numeric(14,2) not null default 0,
  refund_account_id uuid references public.treasury_accounts(id),
  reason text,
  created_by uuid,
  created_at timestamptz not null default now()
);

create table public.sale_return_items (
  id uuid primary key default gen_random_uuid(),
  return_id uuid not null references public.sale_returns(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  sale_item_id uuid not null references public.sale_items(id),
  quantity numeric(14,3) not null check (quantity > 0),
  amount numeric(14,2) not null
);

create table public.customer_payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  customer_id uuid not null references public.customers(id),
  number text not null,
  amount numeric(14,2) not null check (amount > 0),
  method public.payment_method not null,
  account_id uuid not null references public.treasury_accounts(id),
  reference text,
  note text,
  created_by uuid,
  created_at timestamptz not null default now(),
  unique (organization_id, number)
);
create index on public.customer_payments (organization_id, customer_id);

create table public.customer_payment_allocations (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.customer_payments(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  sale_id uuid not null references public.sales(id),
  amount numeric(14,2) not null check (amount > 0)
);

create table public.payment_promises (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  amount numeric(14,2) not null check (amount > 0),
  promised_date date not null,
  note text,
  status text not null default 'pending' check (status in ('pending', 'kept', 'broken')),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Fournisseurs et achats
-- ---------------------------------------------------------------------
create table public.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  location_id uuid not null references public.locations(id),
  supplier_id uuid not null references public.suppliers(id),
  number text not null,
  status public.purchase_status not null default 'draft',
  supplier_invoice_ref text,
  expected_date date,
  note text,
  ordered_total numeric(14,2) not null default 0,
  received_total numeric(14,2) not null default 0,
  returned_total numeric(14,2) not null default 0,
  paid_total numeric(14,2) not null default 0,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, number)
);
create index on public.purchase_orders (organization_id, supplier_id);

create table public.purchase_order_items (
  id uuid primary key default gen_random_uuid(),
  purchase_order_id uuid not null references public.purchase_orders(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  product_id uuid not null references public.products(id),
  quantity_ordered numeric(14,3) not null check (quantity_ordered > 0),
  quantity_received numeric(14,3) not null default 0,
  quantity_returned numeric(14,3) not null default 0,
  unit_cost numeric(14,2) not null check (unit_cost >= 0)
);

create table public.purchase_receptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  purchase_order_id uuid not null references public.purchase_orders(id),
  total numeric(14,2) not null,
  note text,
  received_by uuid,
  received_at timestamptz not null default now()
);

create table public.purchase_reception_items (
  id uuid primary key default gen_random_uuid(),
  reception_id uuid not null references public.purchase_receptions(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  purchase_order_item_id uuid not null references public.purchase_order_items(id),
  quantity numeric(14,3) not null check (quantity > 0),
  unit_cost numeric(14,2) not null
);

create table public.supplier_returns (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  purchase_order_id uuid not null references public.purchase_orders(id),
  purchase_order_item_id uuid not null references public.purchase_order_items(id),
  quantity numeric(14,3) not null check (quantity > 0),
  amount numeric(14,2) not null,
  reason text,
  created_by uuid,
  created_at timestamptz not null default now()
);

create table public.supplier_payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  supplier_id uuid not null references public.suppliers(id),
  purchase_order_id uuid references public.purchase_orders(id),
  amount numeric(14,2) not null check (amount > 0),
  method public.payment_method not null,
  account_id uuid not null references public.treasury_accounts(id),
  reference text,
  note text,
  created_by uuid,
  created_at timestamptz not null default now()
);
create index on public.supplier_payments (organization_id, supplier_id);

-- ---------------------------------------------------------------------
-- Dépenses et recettes diverses
-- ---------------------------------------------------------------------
create table public.expense_categories (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  unique (organization_id, name)
);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  location_id uuid references public.locations(id),
  category_id uuid references public.expense_categories(id),
  label text not null check (length(trim(label)) between 1 and 200),
  amount numeric(14,2) not null check (amount > 0),
  expense_date date not null default current_date,
  method public.payment_method not null,
  account_id uuid not null references public.treasury_accounts(id),
  beneficiary text,
  attachment_url text,
  status public.record_status not null default 'posted',
  cancel_reason text,
  created_by uuid,
  created_at timestamptz not null default now()
);
create index on public.expenses (organization_id, expense_date desc);

create table public.other_incomes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  location_id uuid references public.locations(id),
  label text not null check (length(trim(label)) between 1 and 200),
  amount numeric(14,2) not null check (amount > 0),
  income_date date not null default current_date,
  method public.payment_method not null,
  account_id uuid not null references public.treasury_accounts(id),
  status public.record_status not null default 'posted',
  created_by uuid,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Budget personnel — strictement séparé des données d'entreprise
-- (aucune colonne organization_id, accès limité au propriétaire)
-- ---------------------------------------------------------------------
create table public.personal_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 80),
  kind text not null check (kind in ('income', 'expense')),
  unique (user_id, name, kind)
);

create table public.personal_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  category_id uuid references public.personal_categories(id) on delete set null,
  kind text not null check (kind in ('income', 'expense')),
  label text not null check (length(trim(label)) between 1 and 200),
  amount numeric(14,2) not null check (amount > 0),
  occurred_on date not null default current_date,
  created_at timestamptz not null default now()
);
create index on public.personal_transactions (user_id, occurred_on desc);

create table public.personal_budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  category_id uuid not null references public.personal_categories(id) on delete cascade,
  month date not null, -- premier jour du mois
  amount numeric(14,2) not null check (amount >= 0),
  unique (user_id, category_id, month)
);

create table public.personal_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 120),
  target_amount numeric(14,2) not null check (target_amount > 0),
  saved_amount numeric(14,2) not null default 0 check (saved_amount >= 0),
  deadline date,
  created_at timestamptz not null default now()
);
