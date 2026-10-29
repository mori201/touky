-- =====================================================================
-- Mënjëf PRO — Fonctions transactionnelles
-- Chaque fonction s'exécute dans une seule transaction : soit toutes
-- les écritures réussissent, soit aucune n'est conservée.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Outils internes
-- ---------------------------------------------------------------------
create or replace function public.next_number(p_org uuid, p_key text, p_prefix text)
returns text language plpgsql security definer set search_path = public as $$
declare v bigint;
begin
  insert into org_counters (organization_id, key, value) values (p_org, p_key, 1)
  on conflict (organization_id, key) do update set value = org_counters.value + 1
  returning value into v;
  return p_prefix || '-' || lpad(v::text, 6, '0');
end $$;

create or replace function public.account_balance(p_account uuid)
returns numeric language sql stable security definer set search_path = public as $$
  select coalesce(sum(amount), 0) from treasury_movements where account_id = p_account;
$$;

-- Résout le compte de trésorerie d'un paiement
create or replace function public.resolve_account(
  p_org uuid, p_method public.payment_method, p_account uuid, p_location uuid
) returns uuid language plpgsql stable security definer set search_path = public as $$
declare v uuid;
begin
  if p_account is not null then
    select id into v from treasury_accounts
    where id = p_account and organization_id = p_org and archived_at is null;
    if v is null then
      raise exception 'Compte de trésorerie invalide';
    end if;
    return v;
  end if;
  select id into v from treasury_accounts
  where organization_id = p_org and method = p_method and archived_at is null
  order by (location_id is not distinct from p_location) desc, (location_id is null) desc, created_at
  limit 1;
  if v is null then
    raise exception 'Aucun compte de trésorerie n''est configuré pour ce mode de paiement';
  end if;
  return v;
end $$;

-- Applique un mouvement de stock avec verrouillage de la ligne et
-- mise à jour du coût moyen pondéré (CMUP) sur les entrées valorisées.
create or replace function public.apply_stock(
  p_org uuid, p_product uuid, p_location uuid, p_type public.stock_movement_type,
  p_delta numeric, p_unit_cost numeric, p_ref_type text, p_ref_id uuid,
  p_reason text, p_allow_negative boolean
) returns numeric language plpgsql security definer set search_path = public as $$
declare
  v_level stock_levels%rowtype;
  v_new numeric;
  v_cost numeric;
  v_base numeric;
  v_name text;
begin
  if p_delta = 0 then
    return null;
  end if;
  insert into stock_levels (organization_id, product_id, location_id)
  values (p_org, p_product, p_location)
  on conflict (product_id, location_id) do nothing;

  select * into v_level from stock_levels
  where product_id = p_product and location_id = p_location
  for update;

  v_new := v_level.quantity + p_delta;
  if v_new < 0 and not p_allow_negative then
    select name into v_name from products where id = p_product;
    raise exception 'Stock insuffisant pour « % » (disponible : %)', v_name, trim_scale(v_level.quantity)
      using errcode = 'P0001';
  end if;

  if p_delta > 0 and p_unit_cost is not null then
    v_base := greatest(v_level.quantity, 0);
    v_cost := case when v_base + p_delta > 0
                   then (v_base * v_level.avg_cost + p_delta * p_unit_cost) / (v_base + p_delta)
                   else p_unit_cost end;
  else
    v_cost := v_level.avg_cost;
  end if;

  update stock_levels
  set quantity = v_new, avg_cost = v_cost, updated_at = now()
  where product_id = p_product and location_id = p_location;

  insert into stock_movements (
    organization_id, product_id, location_id, type, quantity, unit_cost,
    balance_after, reference_type, reference_id, reason, created_by
  ) values (
    p_org, p_product, p_location, p_type, p_delta,
    case when p_delta > 0 and p_unit_cost is not null then p_unit_cost else v_level.avg_cost end,
    v_new, p_ref_type, p_ref_id, p_reason, auth.uid()
  );
  return v_new;
end $$;

create or replace function public.add_treasury(
  p_org uuid, p_account uuid, p_location uuid, p_kind public.treasury_movement_kind,
  p_amount numeric, p_label text, p_ref_type text, p_ref_id uuid,
  p_occurred_at timestamptz default now()
) returns void language sql security definer set search_path = public as $$
  insert into treasury_movements (
    organization_id, account_id, location_id, kind, amount, label,
    reference_type, reference_id, created_by, occurred_at
  ) values (
    p_org, p_account, p_location, p_kind, p_amount, p_label,
    p_ref_type, p_ref_id, auth.uid(), coalesce(p_occurred_at, now())
  );
$$;

-- ---------------------------------------------------------------------
-- Création d'entreprise (assistant de démarrage)
-- ---------------------------------------------------------------------
create or replace function public.create_organization(
  p_name text, p_sector public.business_sector, p_phone text default null,
  p_city text default null, p_address text default null,
  p_location_name text default null, p_location_type public.location_type default 'boutique'
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_org uuid;
  v_loc uuid;
  v_cash uuid;
begin
  if v_uid is null then
    raise exception 'Authentification requise' using errcode = '42501';
  end if;
  if coalesce(length(trim(p_name)), 0) < 2 then
    raise exception 'Le nom de l''entreprise est obligatoire';
  end if;
  if (select count(*) from organization_members where user_id = v_uid and role = 'owner') >= 10 then
    raise exception 'Nombre maximal d''entreprises atteint';
  end if;

  insert into organizations (name, sector, phone, city, address, created_by, onboarding_step)
  values (trim(p_name), p_sector, p_phone, p_city, p_address, v_uid, 4)
  returning id into v_org;

  insert into organization_members (organization_id, user_id, role)
  values (v_org, v_uid, 'owner');

  insert into locations (organization_id, name, type, city, address, phone)
  values (v_org, coalesce(nullif(trim(p_location_name), ''), 'Établissement principal'),
          p_location_type, p_city, p_address, p_phone)
  returning id into v_loc;

  insert into subscriptions (organization_id) values (v_org);

  insert into treasury_accounts (organization_id, location_id, name, kind, method) values
    (v_org, v_loc, 'Caisse principale', 'cash', 'cash')
  returning id into v_cash;
  insert into treasury_accounts (organization_id, name, kind, method) values
    (v_org, 'Wave', 'mobile_money', 'wave'),
    (v_org, 'Orange Money', 'mobile_money', 'orange_money');

  insert into expense_categories (organization_id, name)
  select v_org, unnest(array[
    'Loyer', 'Salaires', 'Transport', 'Électricité', 'Eau', 'Internet',
    'Approvisionnement', 'Entretien', 'Marketing', 'Frais bancaires',
    'Taxes et frais administratifs', 'Autres charges'
  ]);

  perform write_audit(v_org, 'create', 'organizations', v_org::text, jsonb_build_object('name', p_name));
  return v_org;
end $$;

-- ---------------------------------------------------------------------
-- Équipe et invitations
-- ---------------------------------------------------------------------
create or replace function public.invite_member(
  p_org uuid, p_email text, p_role public.app_role, p_location uuid default null
) returns text language plpgsql security definer set search_path = public as $$
declare
  v_token text;
  v_my_role public.app_role;
begin
  perform assert_perm(p_org, 'team.manage');
  select role into v_my_role from organization_members where organization_id = p_org and user_id = auth.uid();
  if p_role = 'owner' and v_my_role <> 'owner' then
    raise exception 'Seul un propriétaire peut inviter un autre propriétaire' using errcode = '42501';
  end if;
  if p_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Adresse e-mail invalide';
  end if;
  if p_location is not null then
    perform assert_location(p_org, p_location);
  end if;
  update invitations set revoked_at = now()
  where organization_id = p_org and lower(email) = lower(p_email) and accepted_at is null and revoked_at is null;
  insert into invitations (organization_id, email, role, location_id, invited_by)
  values (p_org, lower(trim(p_email)), p_role, p_location, auth.uid())
  returning token into v_token;
  perform write_audit(p_org, 'invite', 'invitations', p_email, jsonb_build_object('role', p_role));
  return v_token;
end $$;

create or replace function public.get_invitation(p_token text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'organization', o.name, 'email', i.email, 'role', i.role,
    'valid', i.accepted_at is null and i.revoked_at is null and i.expires_at > now()
  )
  from invitations i join organizations o on o.id = i.organization_id
  where i.token = p_token;
$$;

create or replace function public.accept_invitation(p_token text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_inv invitations%rowtype;
  v_email text;
begin
  if auth.uid() is null then
    raise exception 'Authentification requise' using errcode = '42501';
  end if;
  select * into v_inv from invitations where token = p_token for update;
  if not found or v_inv.accepted_at is not null or v_inv.revoked_at is not null or v_inv.expires_at < now() then
    raise exception 'Invitation invalide ou expirée';
  end if;
  select email into v_email from auth.users where id = auth.uid();
  if lower(v_email) <> lower(v_inv.email) then
    raise exception 'Cette invitation est destinée à une autre adresse e-mail' using errcode = '42501';
  end if;
  insert into organization_members (organization_id, user_id, role, location_id)
  values (v_inv.organization_id, auth.uid(), v_inv.role, v_inv.location_id)
  on conflict (organization_id, user_id)
  do update set role = excluded.role, location_id = excluded.location_id, status = 'active';
  update invitations set accepted_at = now() where id = v_inv.id;
  perform write_audit(v_inv.organization_id, 'accept', 'invitations', v_inv.id::text, null);
  return v_inv.organization_id;
end $$;

create or replace function public.revoke_invitation(p_invitation uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_org uuid;
begin
  select organization_id into v_org from invitations where id = p_invitation;
  perform assert_perm(v_org, 'team.manage');
  update invitations set revoked_at = now() where id = p_invitation and accepted_at is null;
end $$;

create or replace function public.update_member(
  p_member uuid, p_role public.app_role, p_location uuid, p_status text
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_m organization_members%rowtype;
  v_my_role public.app_role;
begin
  select * into v_m from organization_members where id = p_member for update;
  if not found then raise exception 'Membre introuvable'; end if;
  perform assert_perm(v_m.organization_id, 'team.manage');
  select role into v_my_role from organization_members
  where organization_id = v_m.organization_id and user_id = auth.uid();
  if (v_m.role = 'owner' or p_role = 'owner') and v_my_role <> 'owner' then
    raise exception 'Seul un propriétaire peut modifier un propriétaire' using errcode = '42501';
  end if;
  if p_status not in ('active', 'suspended') then
    raise exception 'Statut invalide';
  end if;
  if v_m.role = 'owner' and (p_role <> 'owner' or p_status <> 'active') and (
    select count(*) from organization_members
    where organization_id = v_m.organization_id and role = 'owner' and status = 'active'
  ) <= 1 then
    raise exception 'L''entreprise doit conserver au moins un propriétaire actif';
  end if;
  if p_location is not null then
    perform assert_location(v_m.organization_id, p_location);
  end if;
  update organization_members set role = p_role, location_id = p_location, status = p_status
  where id = p_member;
end $$;

create or replace function public.remove_member(p_member uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_m organization_members%rowtype;
  v_my_role public.app_role;
begin
  select * into v_m from organization_members where id = p_member for update;
  if not found then raise exception 'Membre introuvable'; end if;
  perform assert_perm(v_m.organization_id, 'team.manage');
  select role into v_my_role from organization_members
  where organization_id = v_m.organization_id and user_id = auth.uid();
  if v_m.role = 'owner' and v_my_role <> 'owner' then
    raise exception 'Seul un propriétaire peut retirer un propriétaire' using errcode = '42501';
  end if;
  if v_m.role = 'owner' and (
    select count(*) from organization_members
    where organization_id = v_m.organization_id and role = 'owner' and status = 'active'
  ) <= 1 then
    raise exception 'L''entreprise doit conserver au moins un propriétaire actif';
  end if;
  delete from organization_members where id = p_member;
end $$;

-- ---------------------------------------------------------------------
-- Coûts (réservés à la permission costs.view)
-- ---------------------------------------------------------------------
create or replace function public.get_product_costs(p_org uuid)
returns table (product_id uuid, purchase_price numeric, avg_cost numeric)
language plpgsql stable security definer set search_path = public as $$
begin
  perform assert_perm(p_org, 'costs.view');
  return query
  select p.id, p.purchase_price,
         coalesce((select sum(sl.quantity * sl.avg_cost) / nullif(sum(sl.quantity), 0)
                   from stock_levels sl where sl.product_id = p.id and sl.quantity > 0), p.purchase_price)
  from products p where p.organization_id = p_org;
end $$;

-- ---------------------------------------------------------------------
-- Stock
-- ---------------------------------------------------------------------
create or replace function public.adjust_stock(
  p_org uuid, p_product uuid, p_location uuid, p_type public.stock_movement_type,
  p_quantity numeric, p_unit_cost numeric default null, p_reason text default null
) returns numeric language plpgsql security definer set search_path = public as $$
declare
  v_delta numeric;
  v_org organizations%rowtype;
  v_result numeric;
begin
  perform assert_perm(p_org, 'stock.manage');
  perform assert_location(p_org, p_location);
  if not exists (select 1 from products where id = p_product and organization_id = p_org) then
    raise exception 'Produit introuvable';
  end if;
  if p_quantity is null or p_quantity = 0 then
    raise exception 'La quantité doit être différente de zéro';
  end if;
  if p_type = 'initial' then
    v_delta := abs(p_quantity);
  elsif p_type = 'loss' then
    v_delta := -abs(p_quantity);
    if coalesce(trim(p_reason), '') = '' then
      raise exception 'Le motif est obligatoire pour une perte';
    end if;
  elsif p_type = 'correction' then
    v_delta := p_quantity;
    if coalesce(trim(p_reason), '') = '' then
      raise exception 'Le motif est obligatoire pour une correction';
    end if;
  else
    raise exception 'Type de mouvement non autorisé ici';
  end if;
  if p_unit_cost is not null and not has_perm(p_org, 'costs.view') then
    raise exception 'Permission refusée : coûts d''achat' using errcode = '42501';
  end if;
  select * into v_org from organizations where id = p_org;
  v_result := apply_stock(
    p_org, p_product, p_location, p_type, v_delta,
    case when v_delta > 0 then coalesce(p_unit_cost, (select purchase_price from products where id = p_product)) end,
    'adjustment', null, p_reason, v_org.allow_negative_stock and has_perm(p_org, 'stock.negative')
  );
  return v_result;
end $$;

create or replace function public.transfer_stock(
  p_org uuid, p_from uuid, p_to uuid, p_items jsonb, p_note text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_item jsonb;
  v_qty numeric;
  v_product uuid;
  v_cost numeric;
begin
  perform assert_perm(p_org, 'stock.manage');
  perform assert_location(p_org, p_from);
  perform assert_location(p_org, p_to);
  if p_from = p_to then
    raise exception 'Les établissements de départ et d''arrivée doivent être différents';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Aucun produit à transférer';
  end if;
  insert into stock_transfers (organization_id, number, from_location_id, to_location_id, note, created_by)
  values (p_org, next_number(p_org, 'transfer', 'TR'), p_from, p_to, p_note, auth.uid())
  returning id into v_id;

  for v_item in select value from jsonb_array_elements(p_items) order by value->>'product_id' loop
    v_product := (v_item->>'product_id')::uuid;
    v_qty := (v_item->>'quantity')::numeric;
    if v_qty is null or v_qty <= 0 then
      raise exception 'Quantité invalide';
    end if;
    if not exists (select 1 from products where id = v_product and organization_id = p_org and track_stock) then
      raise exception 'Produit introuvable';
    end if;
    select avg_cost into v_cost from stock_levels where product_id = v_product and location_id = p_from;
    perform apply_stock(p_org, v_product, p_from, 'transfer_out', -v_qty, null, 'transfer', v_id, p_note, false);
    perform apply_stock(p_org, v_product, p_to, 'transfer_in', v_qty, coalesce(v_cost, 0), 'transfer', v_id, p_note, false);
    insert into stock_transfer_items (transfer_id, organization_id, product_id, quantity)
    values (v_id, p_org, v_product, v_qty);
  end loop;
  perform write_audit(p_org, 'create', 'stock_transfers', v_id::text, p_items);
  return v_id;
end $$;

create or replace function public.create_inventory(p_org uuid, p_location uuid, p_note text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  perform assert_perm(p_org, 'stock.inventory');
  perform assert_location(p_org, p_location);
  insert into inventories (organization_id, location_id, number, note, created_by)
  values (p_org, p_location, next_number(p_org, 'inventory', 'INV'), p_note, auth.uid())
  returning id into v_id;
  insert into inventory_lines (inventory_id, organization_id, product_id, theoretical_qty)
  select v_id, p_org, p.id, coalesce(sl.quantity, 0)
  from products p
  left join stock_levels sl on sl.product_id = p.id and sl.location_id = p_location
  where p.organization_id = p_org and p.is_active and p.track_stock;
  return v_id;
end $$;

create or replace function public.set_inventory_counts(p_inventory uuid, p_counts jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_inv inventories%rowtype;
  v_c jsonb;
begin
  select * into v_inv from inventories where id = p_inventory for update;
  if not found then raise exception 'Inventaire introuvable'; end if;
  perform assert_perm(v_inv.organization_id, 'stock.inventory');
  perform assert_location(v_inv.organization_id, v_inv.location_id);
  if v_inv.status <> 'draft' then
    raise exception 'Cet inventaire est déjà clôturé';
  end if;
  for v_c in select value from jsonb_array_elements(p_counts) loop
    if (v_c->>'counted') is not null and (v_c->>'counted')::numeric < 0 then
      raise exception 'Une quantité comptée ne peut pas être négative';
    end if;
    update inventory_lines
    set counted_qty = nullif(v_c->>'counted', '')::numeric
    where inventory_id = p_inventory and product_id = (v_c->>'product_id')::uuid;
  end loop;
end $$;

create or replace function public.validate_inventory(p_inventory uuid)
returns int language plpgsql security definer set search_path = public as $$
declare
  v_inv inventories%rowtype;
  v_line record;
  v_current numeric;
  v_count int := 0;
begin
  select * into v_inv from inventories where id = p_inventory for update;
  if not found then raise exception 'Inventaire introuvable'; end if;
  perform assert_perm(v_inv.organization_id, 'stock.inventory');
  perform assert_location(v_inv.organization_id, v_inv.location_id);
  if v_inv.status <> 'draft' then
    raise exception 'Cet inventaire est déjà clôturé';
  end if;
  for v_line in
    select * from inventory_lines where inventory_id = p_inventory and counted_qty is not null
    order by product_id
  loop
    select quantity into v_current from stock_levels
    where product_id = v_line.product_id and location_id = v_inv.location_id for update;
    v_current := coalesce(v_current, 0);
    update inventory_lines set theoretical_qty = v_current where id = v_line.id;
    if v_line.counted_qty <> v_current then
      perform apply_stock(
        v_inv.organization_id, v_line.product_id, v_inv.location_id, 'inventory_adjustment',
        v_line.counted_qty - v_current, null, 'inventory', p_inventory,
        'Inventaire ' || v_inv.number, true
      );
      v_count := v_count + 1;
    end if;
  end loop;
  update inventories set status = 'validated', validated_by = auth.uid(), validated_at = now()
  where id = p_inventory;
  perform write_audit(v_inv.organization_id, 'validate', 'inventories', p_inventory::text,
                      jsonb_build_object('ajustements', v_count));
  return v_count;
end $$;

-- Import de catalogue CSV (tout ou rien)
create or replace function public.import_products(p_org uuid, p_location uuid, p_rows jsonb)
returns int language plpgsql security definer set search_path = public as $$
declare
  v_row jsonb;
  v_cat uuid;
  v_id uuid;
  v_qty numeric;
  v_cost numeric;
  v_n int := 0;
begin
  perform assert_perm(p_org, 'products.manage');
  perform assert_perm(p_org, 'stock.manage');
  perform assert_location(p_org, p_location);
  if jsonb_array_length(p_rows) > 5000 then
    raise exception 'Import limité à 5 000 lignes';
  end if;
  for v_row in select value from jsonb_array_elements(p_rows) loop
    if coalesce(trim(v_row->>'name'), '') = '' then
      raise exception 'Ligne % : le nom est obligatoire', v_n + 1;
    end if;
    v_cat := null;
    if coalesce(trim(v_row->>'category'), '') <> '' then
      insert into categories (organization_id, name) values (p_org, trim(v_row->>'category'))
      on conflict (organization_id, name) do update set name = excluded.name
      returning id into v_cat;
    end if;
    v_cost := coalesce(nullif(v_row->>'purchase_price', '')::numeric, 0);
    if v_cost < 0 or coalesce(nullif(v_row->>'sale_price', '')::numeric, 0) < 0 then
      raise exception 'Ligne % : prix négatif', v_n + 1;
    end if;
    if v_cost > 0 and not has_perm(p_org, 'costs.view') then
      raise exception 'Permission refusée : coûts d''achat' using errcode = '42501';
    end if;
    insert into products (
      organization_id, name, sku, barcode, category_id, unit,
      purchase_price, sale_price, wholesale_price, min_stock
    ) values (
      p_org, trim(v_row->>'name'), nullif(trim(v_row->>'sku'), ''),
      nullif(trim(v_row->>'barcode'), ''), v_cat,
      coalesce(nullif(trim(v_row->>'unit'), ''), 'unité'),
      v_cost, coalesce(nullif(v_row->>'sale_price', '')::numeric, 0),
      nullif(v_row->>'wholesale_price', '')::numeric,
      coalesce(nullif(v_row->>'min_stock', '')::numeric, 0)
    ) returning id into v_id;
    v_qty := coalesce(nullif(v_row->>'quantity', '')::numeric, 0);
    if v_qty < 0 then
      raise exception 'Ligne % : quantité négative', v_n + 1;
    end if;
    if v_qty > 0 then
      perform apply_stock(p_org, v_id, p_location, 'initial', v_qty, v_cost, 'import', null, 'Import CSV', false);
    end if;
    v_n := v_n + 1;
  end loop;
  perform write_audit(p_org, 'import', 'products', null, jsonb_build_object('lignes', v_n));
  return v_n;
end $$;

-- ---------------------------------------------------------------------
-- Ventes
-- ---------------------------------------------------------------------
create or replace function public.create_sale(
  p_org uuid,
  p_location uuid,
  p_items jsonb,              -- [{product_id, quantity, discount}]
  p_payments jsonb,           -- [{method, amount, account_id?, reference?}]
  p_customer uuid default null,
  p_price_mode text default 'retail',
  p_discount numeric default 0,
  p_amount_received numeric default null,
  p_due_date date default null,
  p_note text default null,
  p_idempotency_key text default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_org organizations%rowtype;
  v_sale_id uuid;
  v_number text;
  v_item jsonb;
  v_pay jsonb;
  v_prod products%rowtype;
  v_qty numeric;
  v_price numeric;
  v_line_disc numeric;
  v_unit_cost numeric;
  v_subtotal numeric := 0;
  v_lines_disc numeric := 0;
  v_net numeric;
  v_tax numeric := 0;
  v_total numeric;
  v_paid numeric := 0;
  v_cash numeric := 0;
  v_balance numeric;
  v_amount numeric;
  v_method public.payment_method;
  v_account uuid;
  v_change numeric;
  v_limit numeric;
  v_outstanding numeric;
  v_allow_negative boolean;
  v_existing record;
begin
  if v_uid is null then
    raise exception 'Authentification requise' using errcode = '42501';
  end if;
  perform assert_perm(p_org, 'sales.create');
  perform assert_location(p_org, p_location);

  -- Idempotence : une même clé renvoie la vente déjà enregistrée
  if p_idempotency_key is not null then
    select id, number into v_existing from sales
    where organization_id = p_org and idempotency_key = p_idempotency_key;
    if found then
      return jsonb_build_object('id', v_existing.id, 'number', v_existing.number, 'duplicate', true);
    end if;
  end if;

  select * into v_org from organizations where id = p_org;
  if not exists (select 1 from locations where id = p_location and organization_id = p_org and archived_at is null) then
    raise exception 'Établissement invalide ou archivé';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Le panier est vide';
  end if;
  if jsonb_array_length(p_items) > 300 then
    raise exception 'Trop de lignes dans le panier';
  end if;
  if p_price_mode not in ('retail', 'wholesale') then
    raise exception 'Mode de prix invalide';
  end if;
  p_discount := coalesce(p_discount, 0);
  if p_discount < 0 then
    raise exception 'Remise invalide';
  end if;
  if p_customer is not null and not exists (
    select 1 from customers where id = p_customer and organization_id = p_org and archived_at is null
  ) then
    raise exception 'Client introuvable';
  end if;
  v_allow_negative := v_org.allow_negative_stock and has_perm(p_org, 'stock.negative');

  v_number := next_number(p_org, 'sale', 'V');
  begin
    insert into sales (organization_id, location_id, number, cashier_id, customer_id, price_mode,
                       subtotal, total, idempotency_key, note, due_date)
    values (p_org, p_location, v_number, v_uid, p_customer, p_price_mode, 0, 0,
            p_idempotency_key, nullif(trim(p_note), ''), p_due_date)
    returning id into v_sale_id;
  exception when unique_violation then
    -- Requête concurrente avec la même clé : on renvoie la vente existante
    select id, number into v_existing from sales
    where organization_id = p_org and idempotency_key = p_idempotency_key;
    return jsonb_build_object('id', v_existing.id, 'number', v_existing.number, 'duplicate', true);
  end;

  -- Lignes : verrouillage du stock dans un ordre déterministe (évite les interblocages)
  for v_item in select value from jsonb_array_elements(p_items) order by value->>'product_id' loop
    v_qty := nullif(v_item->>'quantity', '')::numeric;
    if v_qty is null or v_qty <= 0 then
      raise exception 'Quantité invalide';
    end if;
    select * into v_prod from products
    where id = (v_item->>'product_id')::uuid and organization_id = p_org and is_active;
    if not found then
      raise exception 'Produit introuvable ou archivé';
    end if;
    v_price := case when p_price_mode = 'wholesale' and v_prod.wholesale_price is not null
                    then v_prod.wholesale_price else v_prod.sale_price end;
    v_line_disc := coalesce(nullif(v_item->>'discount', '')::numeric, 0);
    if v_line_disc < 0 or v_line_disc > v_price * v_qty then
      raise exception 'Remise invalide sur « % »', v_prod.name;
    end if;

    select avg_cost into v_unit_cost from stock_levels
    where product_id = v_prod.id and location_id = p_location;
    v_unit_cost := coalesce(nullif(v_unit_cost, 0), v_prod.purchase_price);

    if v_prod.track_stock then
      perform apply_stock(p_org, v_prod.id, p_location, 'sale_out', -v_qty, null,
                          'sale', v_sale_id, v_number, v_allow_negative);
    end if;

    insert into sale_items (sale_id, organization_id, product_id, product_name, quantity,
                            unit_price, discount, line_total, unit_cost)
    values (v_sale_id, p_org, v_prod.id, v_prod.name, v_qty, v_price, v_line_disc,
            round(v_price * v_qty - v_line_disc, 2), v_unit_cost);

    v_subtotal := v_subtotal + round(v_price * v_qty, 2);
    v_lines_disc := v_lines_disc + v_line_disc;
  end loop;

  if (v_lines_disc > 0 or p_discount > 0) then
    perform assert_perm(p_org, 'sales.discount');
  end if;

  v_net := v_subtotal - v_lines_disc - p_discount;
  if v_net < 0 then
    raise exception 'La remise dépasse le montant de la vente';
  end if;
  if v_org.tax_enabled and v_org.tax_rate > 0 then
    v_tax := round(v_net * v_org.tax_rate / 100, 0);
  end if;
  v_total := round(v_net + v_tax, 0);

  -- Paiements
  if p_payments is not null and jsonb_typeof(p_payments) = 'array' then
    for v_pay in select value from jsonb_array_elements(p_payments) loop
      v_amount := round(coalesce(nullif(v_pay->>'amount', '')::numeric, 0), 2);
      if v_amount < 0 then
        raise exception 'Montant de paiement invalide';
      end if;
      continue when v_amount = 0;
      v_method := (v_pay->>'method')::public.payment_method;
      if not (v_method = any (v_org.enabled_payment_methods)) then
        raise exception 'Mode de paiement non activé pour cette entreprise';
      end if;
      v_account := resolve_account(p_org, v_method, nullif(v_pay->>'account_id', '')::uuid, p_location);
      insert into sale_payments (sale_id, organization_id, method, account_id, amount, reference, verified)
      values (v_sale_id, p_org, v_method, v_account, v_amount,
              nullif(trim(v_pay->>'reference'), ''), v_method = 'cash');
      perform add_treasury(p_org, v_account, p_location, 'sale_payment', v_amount,
                           'Vente ' || v_number, 'sale', v_sale_id);
      v_paid := v_paid + v_amount;
      if v_method = 'cash' then
        v_cash := v_cash + v_amount;
      end if;
    end loop;
  end if;

  if v_paid > v_total then
    raise exception 'Le total des paiements (%) dépasse le montant à payer (%)', v_paid, v_total;
  end if;
  if p_amount_received is not null then
    if p_amount_received < v_cash then
      raise exception 'Le montant reçu est inférieur au paiement en espèces';
    end if;
    v_change := p_amount_received - v_cash;
  end if;

  v_balance := v_total - v_paid;
  if v_balance > 0 then
    if p_customer is null then
      raise exception 'Un client doit être sélectionné pour une vente à crédit ou un paiement partiel';
    end if;
    perform assert_perm(p_org, 'sales.credit');
    select credit_limit into v_limit from customers where id = p_customer for update;
    if v_limit is not null then
      select coalesce(sum(balance_due), 0) into v_outstanding from sales
      where customer_id = p_customer and status = 'completed' and id <> v_sale_id;
      if v_outstanding + v_balance > v_limit then
        raise exception 'Plafond de crédit dépassé (encours : %, plafond : %)', v_outstanding, v_limit;
      end if;
    end if;
  end if;

  update sales set
    subtotal = v_subtotal,
    discount_total = v_lines_disc + p_discount,
    tax_total = v_tax,
    total = v_total,
    paid_at_checkout = v_paid,
    amount_received = p_amount_received,
    change_given = v_change,
    balance_due = v_balance
  where id = v_sale_id;

  perform write_audit(p_org, 'create', 'sales', v_sale_id::text,
                      jsonb_build_object('number', v_number, 'total', v_total, 'paye', v_paid));
  return jsonb_build_object('id', v_sale_id, 'number', v_number, 'total', v_total,
                            'paid', v_paid, 'balance', v_balance, 'change', v_change, 'duplicate', false);
end $$;

create or replace function public.cancel_sale(p_sale uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_sale sales%rowtype;
  v_item record;
  v_pay record;
begin
  select * into v_sale from sales where id = p_sale for update;
  if not found then raise exception 'Vente introuvable'; end if;
  perform assert_perm(v_sale.organization_id, 'sales.cancel');
  perform assert_location(v_sale.organization_id, v_sale.location_id);
  if v_sale.status <> 'completed' then
    raise exception 'Cette vente est déjà annulée';
  end if;
  if coalesce(trim(p_reason), '') = '' then
    raise exception 'Le motif d''annulation est obligatoire';
  end if;
  if exists (select 1 from customer_payment_allocations where sale_id = p_sale)
     or exists (select 1 from sale_returns where sale_id = p_sale) then
    raise exception 'Cette vente a déjà reçu des remboursements ou des retours : utilisez un retour partiel';
  end if;

  -- Mouvements compensatoires : le stock revient, l'historique est conservé
  for v_item in
    select si.*, p.track_stock from sale_items si join products p on p.id = si.product_id
    where si.sale_id = p_sale order by si.product_id
  loop
    if v_item.track_stock then
      perform apply_stock(v_sale.organization_id, v_item.product_id, v_sale.location_id,
                          'sale_cancel', v_item.quantity, v_item.unit_cost, 'sale', p_sale,
                          'Annulation ' || v_sale.number, true);
    end if;
  end loop;
  for v_pay in select * from sale_payments where sale_id = p_sale loop
    perform add_treasury(v_sale.organization_id, v_pay.account_id, v_sale.location_id,
                         'sale_refund', -v_pay.amount, 'Annulation ' || v_sale.number, 'sale', p_sale);
  end loop;

  update sales set status = 'cancelled', balance_due = 0, cancelled_at = now(),
                   cancelled_by = auth.uid(), cancel_reason = trim(p_reason)
  where id = p_sale;
  perform write_audit(v_sale.organization_id, 'cancel', 'sales', p_sale::text,
                      jsonb_build_object('number', v_sale.number, 'motif', p_reason));
end $$;

create or replace function public.return_sale_items(
  p_sale uuid, p_items jsonb, p_refund_account uuid default null, p_reason text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_sale sales%rowtype;
  v_item jsonb;
  v_line record;
  v_qty numeric;
  v_amount numeric;
  v_total numeric := 0;
  v_credit numeric;
  v_refund numeric;
  v_return uuid;
  v_ratio numeric;
begin
  select * into v_sale from sales where id = p_sale for update;
  if not found then raise exception 'Vente introuvable'; end if;
  perform assert_perm(v_sale.organization_id, 'sales.cancel');
  perform assert_location(v_sale.organization_id, v_sale.location_id);
  if v_sale.status <> 'completed' then
    raise exception 'Vente annulée';
  end if;
  if coalesce(trim(p_reason), '') = '' then
    raise exception 'Le motif du retour est obligatoire';
  end if;

  insert into sale_returns (organization_id, sale_id, amount, reason, created_by)
  values (v_sale.organization_id, p_sale, 0, trim(p_reason), auth.uid())
  returning id into v_return;

  -- Les remises globales et taxes sont réparties au prorata
  v_ratio := case when (v_sale.subtotal - v_sale.discount_total + (select coalesce(sum(discount), 0) from sale_items where sale_id = p_sale)) > 0
                  then v_sale.total / (v_sale.subtotal - v_sale.discount_total + (select coalesce(sum(discount), 0) from sale_items where sale_id = p_sale))
                  else 0 end;

  for v_item in select value from jsonb_array_elements(p_items) loop
    v_qty := nullif(v_item->>'quantity', '')::numeric;
    continue when v_qty is null or v_qty = 0;
    if v_qty < 0 then raise exception 'Quantité invalide'; end if;
    select si.*, p.track_stock into v_line from sale_items si join products p on p.id = si.product_id
    where si.id = (v_item->>'sale_item_id')::uuid and si.sale_id = p_sale for update of si;
    if not found then raise exception 'Ligne de vente introuvable'; end if;
    if v_qty > v_line.quantity - v_line.returned_qty then
      raise exception 'Quantité retournée supérieure à la quantité vendue pour « % »', v_line.product_name;
    end if;
    v_amount := round(v_line.line_total / v_line.quantity * v_qty * v_ratio, 0);
    if v_line.track_stock then
      perform apply_stock(v_sale.organization_id, v_line.product_id, v_sale.location_id,
                          'customer_return', v_qty, v_line.unit_cost, 'sale_return', v_return,
                          'Retour ' || v_sale.number, true);
    end if;
    update sale_items set returned_qty = returned_qty + v_qty where id = v_line.id;
    insert into sale_return_items (return_id, organization_id, sale_item_id, quantity, amount)
    values (v_return, v_sale.organization_id, v_line.id, v_qty, v_amount);
    v_total := v_total + v_amount;
  end loop;

  if v_total <= 0 then
    raise exception 'Aucune quantité à retourner';
  end if;
  v_total := least(v_total, v_sale.total - v_sale.returned_total);
  v_credit := least(v_total, v_sale.balance_due);
  v_refund := v_total - v_credit;
  if v_refund > 0 then
    if p_refund_account is null then
      raise exception 'Choisissez le compte de remboursement';
    end if;
    perform resolve_account(v_sale.organization_id, 'cash', p_refund_account, v_sale.location_id);
    perform add_treasury(v_sale.organization_id, p_refund_account, v_sale.location_id, 'sale_refund',
                         -v_refund, 'Retour ' || v_sale.number, 'sale_return', v_return);
  end if;

  update sale_returns set amount = v_total, refunded_amount = v_refund, credit_reduction = v_credit,
                          refund_account_id = case when v_refund > 0 then p_refund_account end
  where id = v_return;
  update sales set returned_total = returned_total + v_total, balance_due = balance_due - v_credit
  where id = p_sale;
  perform write_audit(v_sale.organization_id, 'return', 'sales', p_sale::text,
                      jsonb_build_object('montant', v_total, 'rembourse', v_refund));
  return v_return;
end $$;

-- ---------------------------------------------------------------------
-- Créances clients
-- ---------------------------------------------------------------------
create or replace function public.record_customer_payment(
  p_org uuid, p_customer uuid, p_amount numeric, p_method public.payment_method,
  p_account uuid default null, p_reference text default null, p_note text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_outstanding numeric;
  v_left numeric;
  v_id uuid;
  v_number text;
  v_account uuid;
  v_sale record;
  v_alloc numeric;
begin
  perform assert_perm(p_org, 'payments.record');
  if not exists (select 1 from customers where id = p_customer and organization_id = p_org) then
    raise exception 'Client introuvable';
  end if;
  p_amount := round(coalesce(p_amount, 0), 2);
  if p_amount <= 0 then
    raise exception 'Le montant doit être supérieur à zéro';
  end if;
  perform 1 from customers where id = p_customer for update;
  select coalesce(sum(balance_due), 0) into v_outstanding from sales
  where customer_id = p_customer and organization_id = p_org and status = 'completed';
  if p_amount > v_outstanding then
    raise exception 'Le montant dépasse le solde dû par ce client (%)', v_outstanding;
  end if;

  v_account := resolve_account(p_org, p_method, p_account, null);
  v_number := next_number(p_org, 'customer_payment', 'RC');
  insert into customer_payments (organization_id, customer_id, number, amount, method, account_id,
                                 reference, note, created_by)
  values (p_org, p_customer, v_number, p_amount, p_method, v_account,
          nullif(trim(p_reference), ''), nullif(trim(p_note), ''), auth.uid())
  returning id into v_id;
  perform add_treasury(p_org, v_account, null, 'customer_payment', p_amount,
                       'Remboursement client ' || v_number, 'customer_payment', v_id);

  -- Affectation aux ventes les plus anciennes en premier
  v_left := p_amount;
  for v_sale in
    select id, balance_due from sales
    where customer_id = p_customer and organization_id = p_org and status = 'completed' and balance_due > 0
    order by created_at for update
  loop
    exit when v_left <= 0;
    v_alloc := least(v_left, v_sale.balance_due);
    update sales set balance_due = balance_due - v_alloc where id = v_sale.id;
    insert into customer_payment_allocations (payment_id, organization_id, sale_id, amount)
    values (v_id, p_org, v_sale.id, v_alloc);
    v_left := v_left - v_alloc;
  end loop;

  perform write_audit(p_org, 'create', 'customer_payments', v_id::text,
                      jsonb_build_object('montant', p_amount, 'client', p_customer));
  return v_id;
end $$;

-- ---------------------------------------------------------------------
-- Achats fournisseurs
-- ---------------------------------------------------------------------
create or replace function public.create_purchase_order(
  p_org uuid, p_location uuid, p_supplier uuid, p_items jsonb,
  p_status public.purchase_status default 'draft', p_expected_date date default null,
  p_note text default null, p_invoice_ref text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_item jsonb;
  v_total numeric := 0;
  v_qty numeric;
  v_cost numeric;
begin
  perform assert_perm(p_org, 'purchases.manage');
  perform assert_location(p_org, p_location);
  if p_status not in ('draft', 'ordered') then
    raise exception 'Statut initial invalide';
  end if;
  if not exists (select 1 from suppliers where id = p_supplier and organization_id = p_org) then
    raise exception 'Fournisseur introuvable';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'La commande ne contient aucun produit';
  end if;
  insert into purchase_orders (organization_id, location_id, supplier_id, number, status,
                               expected_date, note, supplier_invoice_ref, created_by)
  values (p_org, p_location, p_supplier, next_number(p_org, 'purchase', 'BC'), p_status,
          p_expected_date, nullif(trim(p_note), ''), nullif(trim(p_invoice_ref), ''), auth.uid())
  returning id into v_id;
  for v_item in select value from jsonb_array_elements(p_items) loop
    v_qty := nullif(v_item->>'quantity', '')::numeric;
    v_cost := coalesce(nullif(v_item->>'unit_cost', '')::numeric, 0);
    if v_qty is null or v_qty <= 0 or v_cost < 0 then
      raise exception 'Quantité ou coût invalide';
    end if;
    if not exists (select 1 from products where id = (v_item->>'product_id')::uuid and organization_id = p_org) then
      raise exception 'Produit introuvable';
    end if;
    insert into purchase_order_items (purchase_order_id, organization_id, product_id, quantity_ordered, unit_cost)
    values (v_id, p_org, (v_item->>'product_id')::uuid, v_qty, v_cost);
    v_total := v_total + round(v_qty * v_cost, 2);
  end loop;
  update purchase_orders set ordered_total = v_total where id = v_id;
  perform write_audit(p_org, 'create', 'purchase_orders', v_id::text, jsonb_build_object('total', v_total));
  return v_id;
end $$;

create or replace function public.set_purchase_status(p_po uuid, p_status public.purchase_status)
returns void language plpgsql security definer set search_path = public as $$
declare v_po purchase_orders%rowtype;
begin
  select * into v_po from purchase_orders where id = p_po for update;
  if not found then raise exception 'Commande introuvable'; end if;
  perform assert_perm(v_po.organization_id, 'purchases.manage');
  perform assert_location(v_po.organization_id, v_po.location_id);
  if p_status = 'ordered' and v_po.status <> 'draft' then
    raise exception 'Seul un brouillon peut être passé en commande';
  elsif p_status = 'cancelled' and v_po.received_total > 0 then
    raise exception 'Une commande déjà reçue (même partiellement) ne peut pas être annulée';
  elsif p_status = 'cancelled' and v_po.status = 'cancelled' then
    raise exception 'Commande déjà annulée';
  elsif p_status not in ('ordered', 'cancelled') then
    raise exception 'Changement de statut non autorisé';
  end if;
  update purchase_orders set status = p_status, updated_at = now() where id = p_po;
  perform write_audit(v_po.organization_id, 'status', 'purchase_orders', p_po::text, jsonb_build_object('statut', p_status));
end $$;

create or replace function public.receive_purchase(p_po uuid, p_items jsonb, p_note text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_po purchase_orders%rowtype;
  v_item jsonb;
  v_line purchase_order_items%rowtype;
  v_qty numeric;
  v_cost numeric;
  v_total numeric := 0;
  v_rec uuid;
  v_track boolean;
begin
  select * into v_po from purchase_orders where id = p_po for update;
  if not found then raise exception 'Commande introuvable'; end if;
  perform assert_perm(v_po.organization_id, 'purchases.manage');
  perform assert_location(v_po.organization_id, v_po.location_id);
  if v_po.status not in ('draft', 'ordered', 'partially_received') then
    raise exception 'Cette commande ne peut plus être réceptionnée';
  end if;
  insert into purchase_receptions (organization_id, purchase_order_id, total, note, received_by)
  values (v_po.organization_id, p_po, 0, nullif(trim(p_note), ''), auth.uid())
  returning id into v_rec;

  for v_item in select value from jsonb_array_elements(p_items) loop
    v_qty := nullif(v_item->>'quantity', '')::numeric;
    continue when v_qty is null or v_qty = 0;
    select * into v_line from purchase_order_items
    where id = (v_item->>'item_id')::uuid and purchase_order_id = p_po for update;
    if not found then raise exception 'Ligne de commande introuvable'; end if;
    if v_qty < 0 or v_qty > v_line.quantity_ordered - v_line.quantity_received then
      raise exception 'Quantité reçue invalide (reste à recevoir : %)',
        trim_scale(v_line.quantity_ordered - v_line.quantity_received);
    end if;
    v_cost := coalesce(nullif(v_item->>'unit_cost', '')::numeric, v_line.unit_cost);
    if v_cost < 0 then raise exception 'Coût invalide'; end if;
    select track_stock into v_track from products where id = v_line.product_id;
    if v_track then
      perform apply_stock(v_po.organization_id, v_line.product_id, v_po.location_id, 'purchase_in',
                          v_qty, v_cost, 'purchase', p_po, 'Réception ' || v_po.number, false);
    end if;
    update products set purchase_price = v_cost where id = v_line.product_id;
    update purchase_order_items set quantity_received = quantity_received + v_qty, unit_cost = v_cost
    where id = v_line.id;
    insert into purchase_reception_items (reception_id, organization_id, purchase_order_item_id, quantity, unit_cost)
    values (v_rec, v_po.organization_id, v_line.id, v_qty, v_cost);
    v_total := v_total + round(v_qty * v_cost, 2);
  end loop;
  if v_total = 0 and not exists (select 1 from purchase_reception_items where reception_id = v_rec) then
    raise exception 'Aucune quantité reçue';
  end if;
  update purchase_receptions set total = v_total where id = v_rec;
  update purchase_orders set
    received_total = received_total + v_total,
    status = case when exists (
               select 1 from purchase_order_items
               where purchase_order_id = p_po and quantity_received < quantity_ordered)
             then 'partially_received'::purchase_status else 'received'::purchase_status end,
    updated_at = now()
  where id = p_po;
  perform write_audit(v_po.organization_id, 'receive', 'purchase_orders', p_po::text, jsonb_build_object('montant', v_total));
  return v_rec;
end $$;

create or replace function public.return_to_supplier(p_item uuid, p_quantity numeric, p_reason text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_line purchase_order_items%rowtype;
  v_po purchase_orders%rowtype;
  v_id uuid;
  v_amount numeric;
  v_track boolean;
begin
  select * into v_line from purchase_order_items where id = p_item for update;
  if not found then raise exception 'Ligne de commande introuvable'; end if;
  select * into v_po from purchase_orders where id = v_line.purchase_order_id for update;
  perform assert_perm(v_po.organization_id, 'purchases.manage');
  perform assert_location(v_po.organization_id, v_po.location_id);
  if coalesce(trim(p_reason), '') = '' then
    raise exception 'Le motif du retour est obligatoire';
  end if;
  if p_quantity is null or p_quantity <= 0 or p_quantity > v_line.quantity_received - v_line.quantity_returned then
    raise exception 'Quantité de retour invalide';
  end if;
  v_amount := round(p_quantity * v_line.unit_cost, 2);
  select track_stock into v_track from products where id = v_line.product_id;
  insert into supplier_returns (organization_id, purchase_order_id, purchase_order_item_id, quantity, amount, reason, created_by)
  values (v_po.organization_id, v_po.id, v_line.id, p_quantity, v_amount, trim(p_reason), auth.uid())
  returning id into v_id;
  if v_track then
    perform apply_stock(v_po.organization_id, v_line.product_id, v_po.location_id, 'supplier_return',
                        -p_quantity, null, 'supplier_return', v_id, p_reason, false);
  end if;
  update purchase_order_items set quantity_returned = quantity_returned + p_quantity where id = v_line.id;
  update purchase_orders set returned_total = returned_total + v_amount, updated_at = now() where id = v_po.id;
  perform write_audit(v_po.organization_id, 'return', 'purchase_orders', v_po.id::text, jsonb_build_object('montant', v_amount));
  return v_id;
end $$;

create or replace function public.pay_supplier(
  p_org uuid, p_supplier uuid, p_amount numeric, p_method public.payment_method,
  p_account uuid default null, p_po uuid default null, p_reference text default null, p_note text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_debt numeric;
  v_po_debt numeric;
  v_account uuid;
  v_id uuid;
  v_name text;
begin
  if not (has_perm(p_org, 'purchases.manage') or has_perm(p_org, 'treasury.manage')) then
    raise exception 'Permission refusée' using errcode = '42501';
  end if;
  select name into v_name from suppliers where id = p_supplier and organization_id = p_org for update;
  if not found then raise exception 'Fournisseur introuvable'; end if;
  p_amount := round(coalesce(p_amount, 0), 2);
  if p_amount <= 0 then raise exception 'Le montant doit être supérieur à zéro'; end if;

  select coalesce(sum(received_total - returned_total), 0) - coalesce((
           select sum(amount) from supplier_payments where supplier_id = p_supplier), 0)
  into v_debt
  from purchase_orders where supplier_id = p_supplier and organization_id = p_org;
  if p_amount > v_debt then
    raise exception 'Le montant dépasse la dette envers ce fournisseur (%)', v_debt;
  end if;
  if p_po is not null then
    select received_total - returned_total - paid_total into v_po_debt
    from purchase_orders where id = p_po and supplier_id = p_supplier and organization_id = p_org for update;
    if v_po_debt is null then raise exception 'Commande introuvable'; end if;
    if p_amount > v_po_debt then
      raise exception 'Le montant dépasse le solde de cette commande (%)', v_po_debt;
    end if;
  end if;
  v_account := resolve_account(p_org, p_method, p_account, null);
  if account_balance(v_account) < p_amount then
    raise exception 'Solde insuffisant sur le compte sélectionné';
  end if;
  insert into supplier_payments (organization_id, supplier_id, purchase_order_id, amount, method,
                                 account_id, reference, note, created_by)
  values (p_org, p_supplier, p_po, p_amount, p_method, v_account,
          nullif(trim(p_reference), ''), nullif(trim(p_note), ''), auth.uid())
  returning id into v_id;
  if p_po is not null then
    update purchase_orders set paid_total = paid_total + p_amount, updated_at = now() where id = p_po;
  end if;
  perform add_treasury(p_org, v_account, null, 'supplier_payment', -p_amount,
                       'Paiement fournisseur ' || v_name, 'supplier_payment', v_id);
  perform write_audit(p_org, 'create', 'supplier_payments', v_id::text, jsonb_build_object('montant', p_amount));
  return v_id;
end $$;

-- ---------------------------------------------------------------------
-- Dépenses et recettes diverses
-- ---------------------------------------------------------------------
create or replace function public.create_expense(
  p_org uuid, p_location uuid, p_category uuid, p_label text, p_amount numeric,
  p_date date, p_method public.payment_method, p_account uuid default null,
  p_beneficiary text default null, p_attachment_url text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_account uuid;
  v_id uuid;
begin
  perform assert_perm(p_org, 'expenses.manage');
  if p_location is not null then
    perform assert_location(p_org, p_location);
  elsif member_location(p_org) is not null then
    raise exception 'Vous devez rattacher la dépense à votre établissement' using errcode = '42501';
  end if;
  if p_category is not null and not exists (
    select 1 from expense_categories where id = p_category and organization_id = p_org) then
    raise exception 'Catégorie invalide';
  end if;
  p_amount := round(coalesce(p_amount, 0), 2);
  if p_amount <= 0 then raise exception 'Le montant doit être supérieur à zéro'; end if;
  if coalesce(trim(p_label), '') = '' then raise exception 'Le libellé est obligatoire'; end if;
  if p_date > current_date + 1 then raise exception 'La date ne peut pas être dans le futur'; end if;
  v_account := resolve_account(p_org, p_method, p_account, p_location);
  insert into expenses (organization_id, location_id, category_id, label, amount, expense_date,
                        method, account_id, beneficiary, attachment_url, created_by)
  values (p_org, p_location, p_category, trim(p_label), p_amount, coalesce(p_date, current_date),
          p_method, v_account, nullif(trim(p_beneficiary), ''), nullif(trim(p_attachment_url), ''), auth.uid())
  returning id into v_id;
  perform add_treasury(p_org, v_account, p_location, 'expense', -p_amount, trim(p_label), 'expense', v_id,
                       case when p_date = current_date or p_date is null then now()
                            else (p_date + time '12:00') at time zone 'Africa/Dakar' end);
  perform write_audit(p_org, 'create', 'expenses', v_id::text, jsonb_build_object('montant', p_amount, 'libelle', p_label));
  return v_id;
end $$;

create or replace function public.cancel_expense(p_expense uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare v_e expenses%rowtype;
begin
  select * into v_e from expenses where id = p_expense for update;
  if not found then raise exception 'Dépense introuvable'; end if;
  perform assert_perm(v_e.organization_id, 'expenses.manage');
  if v_e.location_id is not null then
    perform assert_location(v_e.organization_id, v_e.location_id);
  end if;
  if v_e.status <> 'posted' then raise exception 'Dépense déjà annulée'; end if;
  if coalesce(trim(p_reason), '') = '' then raise exception 'Le motif est obligatoire'; end if;
  update expenses set status = 'cancelled', cancel_reason = trim(p_reason) where id = p_expense;
  perform add_treasury(v_e.organization_id, v_e.account_id, v_e.location_id, 'expense_cancel', v_e.amount,
                       'Annulation : ' || v_e.label, 'expense', p_expense);
  perform write_audit(v_e.organization_id, 'cancel', 'expenses', p_expense::text, jsonb_build_object('motif', p_reason));
end $$;

create or replace function public.create_other_income(
  p_org uuid, p_location uuid, p_label text, p_amount numeric, p_date date,
  p_method public.payment_method, p_account uuid default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_account uuid;
  v_id uuid;
begin
  perform assert_perm(p_org, 'expenses.manage');
  if p_location is not null then
    perform assert_location(p_org, p_location);
  end if;
  p_amount := round(coalesce(p_amount, 0), 2);
  if p_amount <= 0 then raise exception 'Le montant doit être supérieur à zéro'; end if;
  if coalesce(trim(p_label), '') = '' then raise exception 'Le libellé est obligatoire'; end if;
  v_account := resolve_account(p_org, p_method, p_account, p_location);
  insert into other_incomes (organization_id, location_id, label, amount, income_date, method, account_id, created_by)
  values (p_org, p_location, trim(p_label), p_amount, coalesce(p_date, current_date), p_method, v_account, auth.uid())
  returning id into v_id;
  perform add_treasury(p_org, v_account, p_location, 'other_income', p_amount, trim(p_label), 'other_income', v_id,
                       case when p_date = current_date or p_date is null then now()
                            else (p_date + time '12:00') at time zone 'Africa/Dakar' end);
  perform write_audit(p_org, 'create', 'other_incomes', v_id::text, jsonb_build_object('montant', p_amount));
  return v_id;
end $$;

create or replace function public.cancel_other_income(p_income uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare v_i other_incomes%rowtype;
begin
  select * into v_i from other_incomes where id = p_income for update;
  if not found then raise exception 'Recette introuvable'; end if;
  perform assert_perm(v_i.organization_id, 'expenses.manage');
  if v_i.status <> 'posted' then raise exception 'Recette déjà annulée'; end if;
  if coalesce(trim(p_reason), '') = '' then raise exception 'Le motif est obligatoire'; end if;
  update other_incomes set status = 'cancelled' where id = p_income;
  perform add_treasury(v_i.organization_id, v_i.account_id, v_i.location_id, 'other_income_cancel', -v_i.amount,
                       'Annulation : ' || v_i.label, 'other_income', p_income);
  perform write_audit(v_i.organization_id, 'cancel', 'other_incomes', p_income::text, jsonb_build_object('motif', p_reason));
end $$;

-- ---------------------------------------------------------------------
-- Trésorerie et caisses
-- ---------------------------------------------------------------------
create or replace function public.create_treasury_account(
  p_org uuid, p_name text, p_kind public.account_kind, p_method public.payment_method,
  p_location uuid default null, p_opening numeric default 0
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  perform assert_perm(p_org, 'treasury.manage');
  if p_location is not null then perform assert_location(p_org, p_location); end if;
  if coalesce(trim(p_name), '') = '' then raise exception 'Le nom du compte est obligatoire'; end if;
  insert into treasury_accounts (organization_id, location_id, name, kind, method)
  values (p_org, p_location, trim(p_name), p_kind, p_method)
  returning id into v_id;
  if coalesce(p_opening, 0) <> 0 then
    perform add_treasury(p_org, v_id, p_location, 'opening', round(p_opening, 2), 'Solde initial', 'account', v_id);
  end if;
  return v_id;
end $$;

create or replace function public.transfer_funds(
  p_org uuid, p_from uuid, p_to uuid, p_amount numeric, p_note text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  perform assert_perm(p_org, 'treasury.manage');
  if p_from = p_to then raise exception 'Choisissez deux comptes différents'; end if;
  perform 1 from treasury_accounts where id in (p_from, p_to) and organization_id = p_org and archived_at is null
  order by id for update;
  if (select count(*) from treasury_accounts where id in (p_from, p_to) and organization_id = p_org and archived_at is null) <> 2 then
    raise exception 'Compte invalide';
  end if;
  p_amount := round(coalesce(p_amount, 0), 2);
  if p_amount <= 0 then raise exception 'Le montant doit être supérieur à zéro'; end if;
  if account_balance(p_from) < p_amount then raise exception 'Solde insuffisant sur le compte de départ'; end if;
  insert into treasury_transfers (organization_id, from_account_id, to_account_id, amount, note, created_by)
  values (p_org, p_from, p_to, p_amount, nullif(trim(p_note), ''), auth.uid())
  returning id into v_id;
  perform add_treasury(p_org, p_from, null, 'transfer_out', -p_amount, coalesce(nullif(trim(p_note), ''), 'Transfert interne'), 'transfer', v_id);
  perform add_treasury(p_org, p_to, null, 'transfer_in', p_amount, coalesce(nullif(trim(p_note), ''), 'Transfert interne'), 'transfer', v_id);
  perform write_audit(p_org, 'create', 'treasury_transfers', v_id::text, jsonb_build_object('montant', p_amount));
  return v_id;
end $$;

create or replace function public.open_cash_session(p_account uuid, p_declared numeric, p_comment text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_acc treasury_accounts%rowtype;
  v_org organizations%rowtype;
  v_balance numeric;
  v_id uuid;
begin
  select * into v_acc from treasury_accounts where id = p_account for update;
  if not found then raise exception 'Compte introuvable'; end if;
  perform assert_perm(v_acc.organization_id, 'cash.close');
  if v_acc.location_id is not null then perform assert_location(v_acc.organization_id, v_acc.location_id); end if;
  if v_acc.kind <> 'cash' then raise exception 'Seule une caisse physique peut être ouverte'; end if;
  if exists (select 1 from cash_sessions where account_id = p_account and status = 'open') then
    raise exception 'Cette caisse est déjà ouverte';
  end if;
  if p_declared is null or p_declared < 0 then raise exception 'Fond de caisse invalide'; end if;
  select * into v_org from organizations where id = v_acc.organization_id;
  v_balance := account_balance(p_account);
  if p_declared <> v_balance and v_org.require_cash_gap_comment and coalesce(trim(p_comment), '') = '' then
    raise exception 'Le fond déclaré (%) diffère du solde théorique (%) : un commentaire est obligatoire', p_declared, v_balance;
  end if;
  insert into cash_sessions (organization_id, account_id, opened_by, opening_balance, declared_opening, comment)
  values (v_acc.organization_id, p_account, auth.uid(), v_balance, p_declared, nullif(trim(p_comment), ''))
  returning id into v_id;
  if p_declared <> v_balance then
    perform add_treasury(v_acc.organization_id, p_account, v_acc.location_id, 'cash_gap', p_declared - v_balance,
                         'Écart à l''ouverture', 'cash_session', v_id);
  end if;
  perform write_audit(v_acc.organization_id, 'open', 'cash_sessions', v_id::text, jsonb_build_object('fond', p_declared));
  return v_id;
end $$;

create or replace function public.close_cash_session(p_session uuid, p_counted numeric, p_comment text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_s cash_sessions%rowtype;
  v_org organizations%rowtype;
  v_loc uuid;
  v_expected numeric;
  v_gap numeric;
begin
  select * into v_s from cash_sessions where id = p_session for update;
  if not found then raise exception 'Session introuvable'; end if;
  perform assert_perm(v_s.organization_id, 'cash.close');
  select location_id into v_loc from treasury_accounts where id = v_s.account_id;
  if v_loc is not null then perform assert_location(v_s.organization_id, v_loc); end if;
  if v_s.status <> 'open' then raise exception 'Cette session est déjà clôturée'; end if;
  if p_counted is null or p_counted < 0 then raise exception 'Montant compté invalide'; end if;
  select * into v_org from organizations where id = v_s.organization_id;
  v_expected := account_balance(v_s.account_id);
  v_gap := round(p_counted - v_expected, 2);
  if v_gap <> 0 and v_org.require_cash_gap_comment and coalesce(trim(p_comment), '') = '' then
    raise exception 'Écart de caisse de % : un commentaire est obligatoire', v_gap;
  end if;
  if v_gap <> 0 then
    perform add_treasury(v_s.organization_id, v_s.account_id, v_loc, 'cash_gap', v_gap,
                         'Écart de clôture', 'cash_session', p_session);
  end if;
  update cash_sessions set
    status = 'closed', closed_by = auth.uid(), closed_at = now(),
    expected_balance = v_expected, counted_balance = p_counted, gap = v_gap,
    comment = coalesce(nullif(trim(p_comment), ''), comment)
  where id = p_session;
  perform write_audit(v_s.organization_id, 'close', 'cash_sessions', p_session::text,
                      jsonb_build_object('theorique', v_expected, 'compte', p_counted, 'ecart', v_gap));
  return jsonb_build_object('expected', v_expected, 'counted', p_counted, 'gap', v_gap);
end $$;

create or replace function public.correct_cash_session(p_session uuid, p_new_counted numeric, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_s cash_sessions%rowtype;
  v_diff numeric;
  v_loc uuid;
begin
  select * into v_s from cash_sessions where id = p_session for update;
  if not found then raise exception 'Session introuvable'; end if;
  perform assert_perm(v_s.organization_id, 'treasury.manage');
  if v_s.status <> 'closed' then raise exception 'Seule une session clôturée peut être corrigée'; end if;
  if coalesce(trim(p_reason), '') = '' then raise exception 'Le motif de correction est obligatoire'; end if;
  if p_new_counted is null or p_new_counted < 0 then raise exception 'Montant invalide'; end if;
  v_diff := round(p_new_counted - v_s.counted_balance, 2);
  if v_diff = 0 then raise exception 'Aucune différence avec le montant déclaré'; end if;
  select location_id into v_loc from treasury_accounts where id = v_s.account_id;
  insert into cash_session_corrections (session_id, organization_id, previous_counted, new_counted, reason, created_by)
  values (p_session, v_s.organization_id, v_s.counted_balance, p_new_counted, trim(p_reason), auth.uid());
  perform add_treasury(v_s.organization_id, v_s.account_id, v_loc, 'cash_gap', v_diff,
                       'Correction de clôture', 'cash_session', p_session);
  update cash_sessions set counted_balance = p_new_counted, gap = gap + v_diff where id = p_session;
  perform write_audit(v_s.organization_id, 'correct', 'cash_sessions', p_session::text,
                      jsonb_build_object('avant', v_s.counted_balance, 'apres', p_new_counted, 'motif', p_reason));
end $$;

-- Les droits d'exécution sont définis dans 20261029000005_grants.sql
