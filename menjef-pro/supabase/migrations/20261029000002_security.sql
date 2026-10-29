-- =====================================================================
-- Mënjëf PRO — Permissions, contrôle d'accès et politiques RLS
-- Règle : aucune donnée d'une entreprise n'est lisible ou modifiable
-- par un utilisateur qui n'en est pas membre actif, quelle que soit la
-- requête envoyée. Les écritures sensibles (ventes, stock, trésorerie)
-- n'ont AUCUNE politique d'écriture : elles passent par des fonctions
-- SECURITY DEFINER qui vérifient les permissions.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Matrice des permissions par rôle
-- ---------------------------------------------------------------------
insert into public.role_permissions (role, permission)
select r::public.app_role, p from (values
  -- Propriétaire et administrateur : toutes les permissions
  ('owner'), ('admin')
) as roles(r)
cross join unnest(array[
  'sales.view', 'sales.create', 'sales.cancel', 'sales.discount', 'sales.credit',
  'costs.view', 'prices.edit', 'products.manage', 'stock.manage', 'stock.inventory',
  'stock.negative', 'credits.view', 'payments.record', 'expenses.manage',
  'treasury.manage', 'cash.close', 'suppliers.manage', 'purchases.manage',
  'reports.view', 'reports.export', 'team.manage', 'settings.manage',
  'locations.manage', 'audit.view'
]) as p;

insert into public.role_permissions (role, permission) values
  -- Gérant d'établissement
  ('manager', 'sales.view'), ('manager', 'sales.create'), ('manager', 'sales.cancel'),
  ('manager', 'sales.discount'), ('manager', 'sales.credit'), ('manager', 'costs.view'),
  ('manager', 'prices.edit'), ('manager', 'products.manage'), ('manager', 'stock.manage'),
  ('manager', 'stock.inventory'), ('manager', 'credits.view'), ('manager', 'payments.record'),
  ('manager', 'expenses.manage'), ('manager', 'cash.close'), ('manager', 'suppliers.manage'),
  ('manager', 'purchases.manage'), ('manager', 'reports.view'), ('manager', 'reports.export'),
  -- Caissier
  ('cashier', 'sales.view'), ('cashier', 'sales.create'), ('cashier', 'credits.view'),
  ('cashier', 'payments.record'), ('cashier', 'cash.close'),
  -- Gestionnaire de stock
  ('stock_manager', 'sales.view'), ('stock_manager', 'costs.view'),
  ('stock_manager', 'products.manage'), ('stock_manager', 'stock.manage'),
  ('stock_manager', 'stock.inventory'), ('stock_manager', 'suppliers.manage'),
  ('stock_manager', 'purchases.manage'),
  -- Comptable
  ('accountant', 'sales.view'), ('accountant', 'costs.view'), ('accountant', 'credits.view'),
  ('accountant', 'payments.record'), ('accountant', 'expenses.manage'),
  ('accountant', 'treasury.manage'), ('accountant', 'reports.view'),
  ('accountant', 'reports.export'), ('accountant', 'audit.view'),
  ('accountant', 'suppliers.manage'),
  -- Observateur
  ('viewer', 'sales.view'), ('viewer', 'reports.view'), ('viewer', 'credits.view');

-- ---------------------------------------------------------------------
-- Fonctions de contrôle d'accès
-- ---------------------------------------------------------------------
create or replace function public.is_member(p_org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from organization_members
    where organization_id = p_org and user_id = auth.uid() and status = 'active'
  );
$$;

create or replace function public.has_perm(p_org uuid, p_perm text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from organization_members m
    join role_permissions rp on rp.role = m.role
    where m.organization_id = p_org and m.user_id = auth.uid()
      and m.status = 'active' and rp.permission = p_perm
  );
$$;

-- Vrai si le membre n'est pas limité à un établissement, ou s'il s'agit du sien
create or replace function public.can_access_location(p_org uuid, p_location uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from organization_members m
    where m.organization_id = p_org and m.user_id = auth.uid() and m.status = 'active'
      and (m.location_id is null or m.location_id = p_location)
  );
$$;

create or replace function public.member_location(p_org uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select location_id from organization_members
  where organization_id = p_org and user_id = auth.uid() and status = 'active';
$$;

create or replace function public.my_permissions(p_org uuid)
returns text[] language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(rp.permission order by rp.permission), '{}')
  from organization_members m
  join role_permissions rp on rp.role = m.role
  where m.organization_id = p_org and m.user_id = auth.uid() and m.status = 'active';
$$;

create or replace function public.assert_perm(p_org uuid, p_perm text)
returns void language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'Authentification requise' using errcode = '42501';
  end if;
  if not public.has_perm(p_org, p_perm) then
    raise exception 'Permission refusée (%)', p_perm using errcode = '42501';
  end if;
end $$;

create or replace function public.assert_location(p_org uuid, p_location uuid)
returns void language plpgsql stable security definer set search_path = public as $$
begin
  if p_location is not null and not exists (
    select 1 from locations where id = p_location and organization_id = p_org
  ) then
    raise exception 'Établissement introuvable' using errcode = '42501';
  end if;
  if not public.can_access_location(p_org, p_location) then
    raise exception 'Accès refusé à cet établissement' using errcode = '42501';
  end if;
end $$;

create or replace function public.is_platform_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from platform_admins where user_id = auth.uid());
$$;

-- Journal d'audit (écriture réservée aux fonctions internes)
create or replace function public.write_audit(
  p_org uuid, p_action text, p_entity text, p_entity_id text, p_data jsonb default null
) returns void language sql security definer set search_path = public as $$
  insert into audit_logs (organization_id, user_id, action, entity, entity_id, data)
  values (p_org, auth.uid(), p_action, p_entity, p_entity_id, p_data);
$$;

create or replace function public.audit_trigger()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_org uuid;
  v_row jsonb;
begin
  v_row := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  v_org := case when tg_table_name = 'organizations' then (v_row->>'id')::uuid
                else (v_row->>'organization_id')::uuid end;
  insert into audit_logs (organization_id, user_id, action, entity, entity_id, data)
  values (
    v_org, auth.uid(), lower(tg_op), tg_table_name, v_row->>'id',
    case when tg_op = 'UPDATE' then jsonb_build_object('avant', to_jsonb(old), 'apres', to_jsonb(new))
         else v_row end
  );
  return null;
end $$;

do $$
declare t text;
begin
  foreach t in array array[
    'organizations', 'locations', 'organization_members', 'products', 'categories',
    'customers', 'suppliers', 'treasury_accounts', 'expense_categories'
  ] loop
    execute format(
      'create trigger %I after insert or update or delete on public.%I
         for each row execute function public.audit_trigger()', t || '_audit', t);
  end loop;
end $$;

-- Contrôle des modifications de prix côté base de données
create or replace function public.products_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    return new; -- appel interne (fonction SECURITY DEFINER)
  end if;
  if tg_op = 'UPDATE' then
    if new.organization_id <> old.organization_id then
      raise exception 'Changement d''entreprise interdit' using errcode = '42501';
    end if;
    if (new.sale_price is distinct from old.sale_price
        or new.wholesale_price is distinct from old.wholesale_price)
       and not public.has_perm(new.organization_id, 'prices.edit') then
      raise exception 'Permission refusée : modification des prix' using errcode = '42501';
    end if;
    if new.purchase_price is distinct from old.purchase_price
       and not public.has_perm(new.organization_id, 'costs.view') then
      raise exception 'Permission refusée : coûts d''achat' using errcode = '42501';
    end if;
  elsif tg_op = 'INSERT' then
    if new.purchase_price <> 0 and not public.has_perm(new.organization_id, 'costs.view') then
      raise exception 'Permission refusée : coûts d''achat' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;

create trigger products_guard before insert or update on public.products
  for each row execute function public.products_guard();

-- Empêche de déplacer une ligne vers une autre entreprise
create or replace function public.forbid_org_change()
returns trigger language plpgsql as $$
begin
  if new.organization_id <> old.organization_id then
    raise exception 'Changement d''entreprise interdit' using errcode = '42501';
  end if;
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array[
    'locations', 'categories', 'customers', 'suppliers', 'treasury_accounts',
    'expense_categories', 'payment_promises'
  ] loop
    execute format(
      'create trigger %I before update on public.%I
         for each row execute function public.forbid_org_change()', t || '_org_lock', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- Activation de RLS sur toutes les tables
-- ---------------------------------------------------------------------
do $$
declare t record;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t.tablename);
    execute format('revoke all on public.%I from anon', t.tablename);
  end loop;
end $$;

-- Profils : soi-même et les collègues des mêmes entreprises
create policy profiles_select on public.profiles for select to authenticated
  using (
    id = auth.uid() or exists (
      select 1 from organization_members a
      join organization_members b on b.organization_id = a.organization_id
      where a.user_id = auth.uid() and a.status = 'active' and b.user_id = profiles.id
    )
  );
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

create policy platform_admins_select on public.platform_admins for select to authenticated
  using (user_id = auth.uid());

create policy deletion_select on public.account_deletion_requests for select to authenticated
  using (user_id = auth.uid());
create policy deletion_insert on public.account_deletion_requests for insert to authenticated
  with check (user_id = auth.uid());

create policy role_permissions_select on public.role_permissions for select to authenticated
  using (true);

-- Entreprises
create policy organizations_select on public.organizations for select to authenticated
  using (public.is_member(id));
create policy organizations_update on public.organizations for update to authenticated
  using (public.has_perm(id, 'settings.manage')) with check (public.has_perm(id, 'settings.manage'));

create policy members_select on public.organization_members for select to authenticated
  using (public.is_member(organization_id));

create policy invitations_select on public.invitations for select to authenticated
  using (public.has_perm(organization_id, 'team.manage'));

create policy subscriptions_select on public.subscriptions for select to authenticated
  using (public.is_member(organization_id));

create policy audit_select on public.audit_logs for select to authenticated
  using (public.has_perm(organization_id, 'audit.view'));

-- Établissements
create policy locations_select on public.locations for select to authenticated
  using (public.is_member(organization_id));
create policy locations_insert on public.locations for insert to authenticated
  with check (public.has_perm(organization_id, 'locations.manage'));
create policy locations_update on public.locations for update to authenticated
  using (public.has_perm(organization_id, 'locations.manage'))
  with check (public.has_perm(organization_id, 'locations.manage'));

-- Catalogue
create policy categories_select on public.categories for select to authenticated
  using (public.is_member(organization_id));
create policy categories_write on public.categories for all to authenticated
  using (public.has_perm(organization_id, 'products.manage'))
  with check (public.has_perm(organization_id, 'products.manage'));

create policy products_select on public.products for select to authenticated
  using (public.is_member(organization_id));
create policy products_insert on public.products for insert to authenticated
  with check (public.has_perm(organization_id, 'products.manage'));
create policy products_update on public.products for update to authenticated
  using (public.has_perm(organization_id, 'products.manage'))
  with check (public.has_perm(organization_id, 'products.manage'));

create policy suppliers_select on public.suppliers for select to authenticated
  using (public.is_member(organization_id));
create policy suppliers_insert on public.suppliers for insert to authenticated
  with check (public.has_perm(organization_id, 'suppliers.manage'));
create policy suppliers_update on public.suppliers for update to authenticated
  using (public.has_perm(organization_id, 'suppliers.manage'))
  with check (public.has_perm(organization_id, 'suppliers.manage'));

-- Stock (lecture seule ; écritures via fonctions)
create policy stock_levels_select on public.stock_levels for select to authenticated
  using (public.can_access_location(organization_id, location_id));
create policy stock_movements_select on public.stock_movements for select to authenticated
  using (public.can_access_location(organization_id, location_id));
create policy inventories_select on public.inventories for select to authenticated
  using (public.can_access_location(organization_id, location_id));
create policy inventory_lines_select on public.inventory_lines for select to authenticated
  using (exists (select 1 from inventories i where i.id = inventory_id
                 and public.can_access_location(i.organization_id, i.location_id)));
create policy stock_transfers_select on public.stock_transfers for select to authenticated
  using (public.can_access_location(organization_id, from_location_id)
         or public.can_access_location(organization_id, to_location_id));
create policy stock_transfer_items_select on public.stock_transfer_items for select to authenticated
  using (exists (select 1 from stock_transfers t where t.id = transfer_id
                 and (public.can_access_location(t.organization_id, t.from_location_id)
                      or public.can_access_location(t.organization_id, t.to_location_id))));

-- Trésorerie
create policy treasury_accounts_select on public.treasury_accounts for select to authenticated
  using (public.is_member(organization_id));
create policy treasury_accounts_update on public.treasury_accounts for update to authenticated
  using (public.has_perm(organization_id, 'treasury.manage'))
  with check (public.has_perm(organization_id, 'treasury.manage'));
create policy treasury_movements_select on public.treasury_movements for select to authenticated
  using (public.has_perm(organization_id, 'treasury.manage') or public.has_perm(organization_id, 'reports.view'));
create policy treasury_transfers_select on public.treasury_transfers for select to authenticated
  using (public.has_perm(organization_id, 'treasury.manage') or public.has_perm(organization_id, 'reports.view'));
create policy cash_sessions_select on public.cash_sessions for select to authenticated
  using (public.has_perm(organization_id, 'cash.close') or public.has_perm(organization_id, 'treasury.manage'));
create policy cash_corrections_select on public.cash_session_corrections for select to authenticated
  using (public.has_perm(organization_id, 'cash.close') or public.has_perm(organization_id, 'treasury.manage'));

-- Clients
create policy customers_select on public.customers for select to authenticated
  using (public.has_perm(organization_id, 'sales.create') or public.has_perm(organization_id, 'credits.view'));
create policy customers_insert on public.customers for insert to authenticated
  with check (public.has_perm(organization_id, 'sales.create') or public.has_perm(organization_id, 'payments.record'));
create policy customers_update on public.customers for update to authenticated
  using (public.has_perm(organization_id, 'sales.create') or public.has_perm(organization_id, 'payments.record'))
  with check (public.has_perm(organization_id, 'sales.create') or public.has_perm(organization_id, 'payments.record'));

-- Ventes (lecture seule ; écritures via fonctions)
create policy sales_select on public.sales for select to authenticated
  using (public.has_perm(organization_id, 'sales.view') and public.can_access_location(organization_id, location_id));
create policy sale_items_select on public.sale_items for select to authenticated
  using (exists (select 1 from sales s where s.id = sale_id));
create policy sale_payments_select on public.sale_payments for select to authenticated
  using (exists (select 1 from sales s where s.id = sale_id));
create policy sale_returns_select on public.sale_returns for select to authenticated
  using (exists (select 1 from sales s where s.id = sale_id));
create policy sale_return_items_select on public.sale_return_items for select to authenticated
  using (exists (select 1 from sale_returns r where r.id = return_id));

create policy customer_payments_select on public.customer_payments for select to authenticated
  using (public.has_perm(organization_id, 'credits.view'));
create policy allocations_select on public.customer_payment_allocations for select to authenticated
  using (public.has_perm(organization_id, 'credits.view'));
create policy promises_select on public.payment_promises for select to authenticated
  using (public.has_perm(organization_id, 'credits.view'));
create policy promises_insert on public.payment_promises for insert to authenticated
  with check (public.has_perm(organization_id, 'payments.record')
              and exists (select 1 from customers c where c.id = customer_id and c.organization_id = payment_promises.organization_id));
create policy promises_update on public.payment_promises for update to authenticated
  using (public.has_perm(organization_id, 'payments.record'))
  with check (public.has_perm(organization_id, 'payments.record'));

-- Achats fournisseurs
create policy po_select on public.purchase_orders for select to authenticated
  using ((public.has_perm(organization_id, 'purchases.manage') or public.has_perm(organization_id, 'treasury.manage'))
         and public.can_access_location(organization_id, location_id));
create policy po_items_select on public.purchase_order_items for select to authenticated
  using (exists (select 1 from purchase_orders p where p.id = purchase_order_id));
create policy receptions_select on public.purchase_receptions for select to authenticated
  using (exists (select 1 from purchase_orders p where p.id = purchase_order_id));
create policy reception_items_select on public.purchase_reception_items for select to authenticated
  using (exists (select 1 from purchase_receptions r where r.id = reception_id));
create policy supplier_returns_select on public.supplier_returns for select to authenticated
  using (exists (select 1 from purchase_orders p where p.id = purchase_order_id));
create policy supplier_payments_select on public.supplier_payments for select to authenticated
  using (public.has_perm(organization_id, 'purchases.manage') or public.has_perm(organization_id, 'treasury.manage'));

-- Dépenses et recettes
create policy expense_categories_select on public.expense_categories for select to authenticated
  using (public.is_member(organization_id));
create policy expense_categories_write on public.expense_categories for all to authenticated
  using (public.has_perm(organization_id, 'expenses.manage'))
  with check (public.has_perm(organization_id, 'expenses.manage'));
create policy expenses_select on public.expenses for select to authenticated
  using ((public.has_perm(organization_id, 'expenses.manage') or public.has_perm(organization_id, 'reports.view'))
         and (location_id is null or public.can_access_location(organization_id, location_id)));
create policy other_incomes_select on public.other_incomes for select to authenticated
  using ((public.has_perm(organization_id, 'expenses.manage') or public.has_perm(organization_id, 'reports.view'))
         and (location_id is null or public.can_access_location(organization_id, location_id)));

-- Budget personnel : accès exclusif au propriétaire
create policy personal_categories_own on public.personal_categories for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy personal_transactions_own on public.personal_transactions for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and (category_id is null or exists (
    select 1 from personal_categories c where c.id = category_id and c.user_id = auth.uid())));
create policy personal_budgets_own on public.personal_budgets for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and exists (
    select 1 from personal_categories c where c.id = category_id and c.user_id = auth.uid()));
create policy personal_goals_own on public.personal_goals for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- Masquage des coûts d'achat au niveau des colonnes.
-- Les coûts sont exposés uniquement via des fonctions qui vérifient
-- la permission costs.view.
-- ---------------------------------------------------------------------
revoke select on public.products from authenticated;
grant select (
  id, organization_id, name, sku, barcode, category_id, description, unit,
  sale_price, wholesale_price, min_stock, supplier_id, image_url, track_stock,
  is_active, created_at, updated_at
) on public.products to authenticated;

revoke select on public.stock_levels from authenticated;
grant select (organization_id, product_id, location_id, quantity, updated_at)
  on public.stock_levels to authenticated;

revoke select on public.stock_movements from authenticated;
grant select (
  id, organization_id, product_id, location_id, type, quantity, balance_after,
  reference_type, reference_id, reason, created_by, created_at
) on public.stock_movements to authenticated;

revoke select on public.sale_items from authenticated;
grant select (
  id, sale_id, organization_id, product_id, product_name, quantity, unit_price,
  discount, line_total, returned_qty
) on public.sale_items to authenticated;

-- Les tables à écriture contrôlée n'acceptent aucune écriture directe
do $$
declare t text;
begin
  foreach t in array array[
    'stock_levels', 'stock_movements', 'inventories', 'inventory_lines', 'stock_transfers',
    'stock_transfer_items', 'treasury_movements', 'treasury_transfers', 'cash_sessions',
    'cash_session_corrections', 'sales', 'sale_items', 'sale_payments', 'sale_returns',
    'sale_return_items', 'customer_payments', 'customer_payment_allocations',
    'purchase_orders', 'purchase_order_items', 'purchase_receptions',
    'purchase_reception_items', 'supplier_returns', 'supplier_payments', 'expenses',
    'other_incomes', 'audit_logs', 'org_counters', 'organization_members', 'invitations',
    'subscriptions', 'role_permissions', 'platform_admins'
  ] loop
    execute format('revoke insert, update, delete, truncate on public.%I from authenticated', t);
  end loop;
end $$;

-- Aucune suppression physique des données métier : on archive
do $$
declare t text;
begin
  foreach t in array array['organizations', 'locations', 'products', 'customers', 'suppliers', 'treasury_accounts'] loop
    execute format('revoke delete, truncate on public.%I from authenticated', t);
  end loop;
end $$;
