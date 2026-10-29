-- =====================================================================
-- Mënjëf PRO — Indicateurs, vues de soldes et rapports
-- Chaque indicateur est calculé à partir des opérations enregistrées ;
-- les formules sont documentées dans l'interface (page Finances).
-- =====================================================================

-- Soldes clients (respecte la RLS de l'appelant)
create or replace view public.customer_balances with (security_invoker = true) as
select
  c.id as customer_id,
  c.organization_id,
  coalesce(sum(s.total - s.returned_total) filter (where s.status = 'completed'), 0) as total_sales,
  coalesce(sum(s.total - s.returned_total - s.balance_due) filter (where s.status = 'completed'), 0) as total_paid,
  coalesce(sum(s.balance_due) filter (where s.status = 'completed'), 0) as balance_due,
  coalesce(sum(s.balance_due) filter (where s.status = 'completed' and s.due_date < current_date), 0) as overdue,
  min(s.due_date) filter (where s.status = 'completed' and s.balance_due > 0) as next_due_date,
  max(s.created_at) as last_sale_at,
  count(s.id) filter (where s.status = 'completed') as sales_count
from public.customers c
left join public.sales s on s.customer_id = c.id
group by c.id, c.organization_id;

-- Soldes fournisseurs : marchandises reçues - retours - paiements
create or replace view public.supplier_balances with (security_invoker = true) as
select
  sp.id as supplier_id,
  sp.organization_id,
  coalesce(po.received, 0) as total_received,
  coalesce(po.returned, 0) as total_returned,
  coalesce(pay.paid, 0) as total_paid,
  coalesce(po.received, 0) - coalesce(po.returned, 0) - coalesce(pay.paid, 0) as balance_due,
  coalesce(po.open_orders, 0) as open_orders
from public.suppliers sp
left join (
  select supplier_id, sum(received_total) as received, sum(returned_total) as returned,
         count(*) filter (where status in ('draft', 'ordered', 'partially_received')) as open_orders
  from public.purchase_orders group by supplier_id
) po on po.supplier_id = sp.id
left join (
  select supplier_id, sum(amount) as paid from public.supplier_payments group by supplier_id
) pay on pay.supplier_id = sp.id;

-- Soldes des comptes de trésorerie
create or replace view public.account_balances with (security_invoker = true) as
select
  a.id as account_id,
  a.organization_id,
  a.name,
  a.kind,
  a.method,
  a.location_id,
  a.archived_at,
  coalesce(sum(m.amount), 0) as balance
from public.treasury_accounts a
left join public.treasury_movements m on m.account_id = a.id
group by a.id;

-- Droits sur ces vues : voir 20261029000005_grants.sql

-- ---------------------------------------------------------------------
-- Tableau de bord
-- ---------------------------------------------------------------------
create or replace function public.dashboard_summary(
  p_org uuid, p_from timestamptz, p_to timestamptz,
  p_location uuid default null, p_cashier uuid default null
) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_tz text;
  v_restricted uuid;
  v_loc uuid;
  v_cashier uuid;
  v_reports boolean;
  v_costs boolean;
  v_credits boolean;
  v_treasury boolean;
  v_payables boolean;
  v_len interval;
  v_bucket text;
  v_from_d date;
  v_to_d date;
  r jsonb;
  v_sales jsonb;
  v_prev jsonb;
  v_warnings text[] := '{}';
  v_cogs numeric;
  v_zero_cost int;
  v_expenses numeric;
  v_other numeric;
  v_net_ht numeric;
begin
  if not is_member(p_org) then
    raise exception 'Accès refusé' using errcode = '42501';
  end if;
  if p_to <= p_from or p_to - p_from > interval '1100 days' then
    raise exception 'Période invalide';
  end if;
  select timezone into v_tz from organizations where id = p_org;
  v_restricted := member_location(p_org);
  if v_restricted is not null and p_location is not null and p_location <> v_restricted then
    raise exception 'Accès refusé à cet établissement' using errcode = '42501';
  end if;
  v_loc := coalesce(v_restricted, p_location);
  v_reports := has_perm(p_org, 'reports.view');
  if not v_reports and not has_perm(p_org, 'sales.view') then
    raise exception 'Permission refusée' using errcode = '42501';
  end if;
  -- Sans accès aux rapports, un utilisateur ne voit que ses propres ventes
  v_cashier := case when v_reports then p_cashier else auth.uid() end;
  v_costs := has_perm(p_org, 'costs.view');
  v_credits := has_perm(p_org, 'credits.view');
  v_treasury := v_reports or has_perm(p_org, 'treasury.manage');
  v_payables := has_perm(p_org, 'purchases.manage') or has_perm(p_org, 'treasury.manage');
  v_len := p_to - p_from;
  v_bucket := case when v_len > interval '93 days' then 'month' else 'day' end;
  v_from_d := (p_from at time zone v_tz)::date;
  v_to_d := (p_to at time zone v_tz)::date;

  -- Ventes de la période
  select jsonb_build_object(
    'revenue', coalesce(sum(total), 0),
    'returns', coalesce(sum(returned_total), 0),
    'net_revenue', coalesce(sum(total - returned_total), 0),
    'tax', coalesce(sum(tax_total), 0),
    'discounts', coalesce(sum(discount_total), 0),
    'count', count(*),
    'avg_basket', case when count(*) > 0 then round(sum(total) / count(*), 0) else 0 end,
    'paid_at_checkout', coalesce(sum(paid_at_checkout), 0),
    'credit_sales', coalesce(sum(total - paid_at_checkout) filter (where total > paid_at_checkout), 0)
  ), coalesce(sum(total - tax_total - returned_total), 0)
  into v_sales, v_net_ht
  from sales
  where organization_id = p_org and status = 'completed'
    and created_at >= p_from and created_at < p_to
    and (v_loc is null or location_id = v_loc)
    and (v_cashier is null or cashier_id = v_cashier);

  r := jsonb_build_object('sales', v_sales, 'bucket', v_bucket,
                          'scope', jsonb_build_object('location', v_loc, 'cashier', v_cashier,
                                                      'costs', v_costs, 'reports', v_reports,
                                                      'credits', v_credits, 'treasury', v_treasury,
                                                      'payables', v_payables));

  -- Période précédente de même durée
  select jsonb_build_object(
    'revenue', coalesce(sum(total - returned_total), 0),
    'count', count(*)
  ) into v_prev
  from sales
  where organization_id = p_org and status = 'completed'
    and created_at >= p_from - v_len and created_at < p_from
    and (v_loc is null or location_id = v_loc)
    and (v_cashier is null or cashier_id = v_cashier);
  r := r || jsonb_build_object('previous', v_prev);

  -- Série temporelle
  r := r || jsonb_build_object('series', coalesce((
    select jsonb_agg(jsonb_build_object('period', to_char(g.b, 'YYYY-MM-DD'),
                                        'revenue', coalesce(sv.revenue, 0),
                                        'count', coalesce(sv.cnt, 0),
                                        'expenses', coalesce(ev.amount, 0)) order by g.b)
    from generate_series(date_trunc(v_bucket, p_from at time zone v_tz),
                         date_trunc(v_bucket, (p_to - interval '1 second') at time zone v_tz),
                         ('1 ' || v_bucket)::interval) as g(b)
    left join (
      select date_trunc(v_bucket, created_at at time zone v_tz) as b,
             sum(total - returned_total) as revenue, count(*) as cnt
      from sales
      where organization_id = p_org and status = 'completed'
        and created_at >= p_from and created_at < p_to
        and (v_loc is null or location_id = v_loc)
        and (v_cashier is null or cashier_id = v_cashier)
      group by 1
    ) sv on sv.b = g.b
    left join (
      select date_trunc(v_bucket, expense_date::timestamp) as b, sum(amount) as amount
      from expenses
      where v_reports and organization_id = p_org and status = 'posted'
        and expense_date >= v_from_d and expense_date < v_to_d
        and (v_loc is null or location_id = v_loc)
      group by 1
    ) ev on ev.b = g.b
  ), '[]'::jsonb));

  -- Répartition par catégorie et meilleurs produits
  r := r || jsonb_build_object('by_category', coalesce((
    select jsonb_agg(x order by (x->>'revenue')::numeric desc) from (
      select jsonb_build_object('name', coalesce(c.name, 'Sans catégorie'),
                                'revenue', sum(si.line_total)) as x
      from sale_items si
      join sales s on s.id = si.sale_id
      join products p on p.id = si.product_id
      left join categories c on c.id = p.category_id
      where s.organization_id = p_org and s.status = 'completed'
        and s.created_at >= p_from and s.created_at < p_to
        and (v_loc is null or s.location_id = v_loc)
        and (v_cashier is null or s.cashier_id = v_cashier)
      group by c.name
    ) t
  ), '[]'::jsonb));

  r := r || jsonb_build_object('top_products', coalesce((
    select jsonb_agg(x) from (
      select jsonb_build_object('name', si.product_name,
                                'quantity', trim_scale(sum(si.quantity - si.returned_qty)),
                                'revenue', sum(si.line_total)) as x
      from sale_items si
      join sales s on s.id = si.sale_id
      where s.organization_id = p_org and s.status = 'completed'
        and s.created_at >= p_from and s.created_at < p_to
        and (v_loc is null or s.location_id = v_loc)
        and (v_cashier is null or s.cashier_id = v_cashier)
      group by si.product_id, si.product_name
      order by sum(si.line_total) desc
      limit 10
    ) t
  ), '[]'::jsonb));

  r := r || jsonb_build_object('by_method', coalesce((
    select jsonb_agg(jsonb_build_object('method', method, 'amount', amount) order by amount desc) from (
      select sp.method, sum(sp.amount) as amount
      from sale_payments sp join sales s on s.id = sp.sale_id
      where s.organization_id = p_org and s.status = 'completed'
        and s.created_at >= p_from and s.created_at < p_to
        and (v_loc is null or s.location_id = v_loc)
        and (v_cashier is null or s.cashier_id = v_cashier)
      group by sp.method
    ) t
  ), '[]'::jsonb));

  if v_reports and v_loc is null then
    r := r || jsonb_build_object('by_location', coalesce((
      select jsonb_agg(jsonb_build_object('name', l.name, 'revenue', coalesce(t.revenue, 0), 'count', coalesce(t.cnt, 0))
                       order by coalesce(t.revenue, 0) desc)
      from locations l
      left join (
        select location_id, sum(total - returned_total) as revenue, count(*) as cnt from sales
        where organization_id = p_org and status = 'completed'
          and created_at >= p_from and created_at < p_to
          and (v_cashier is null or cashier_id = v_cashier)
        group by location_id
      ) t on t.location_id = l.id
      where l.organization_id = p_org and l.archived_at is null
    ), '[]'::jsonb));
  end if;

  -- Dépenses, recettes diverses et flux de trésorerie
  if v_reports then
    select coalesce(sum(amount), 0) into v_expenses from expenses
    where organization_id = p_org and status = 'posted'
      and expense_date >= v_from_d and expense_date < v_to_d
      and (v_loc is null or location_id = v_loc);
    select coalesce(sum(amount), 0) into v_other from other_incomes
    where organization_id = p_org and status = 'posted'
      and income_date >= v_from_d and income_date < v_to_d
      and (v_loc is null or location_id = v_loc);
    r := r || jsonb_build_object(
      'expenses', v_expenses,
      'other_income', v_other,
      'previous_expenses', (
        select coalesce(sum(amount), 0) from expenses
        where organization_id = p_org and status = 'posted'
          and expense_date >= v_from_d - (v_to_d - v_from_d) and expense_date < v_from_d
          and (v_loc is null or location_id = v_loc)),
      'expense_by_category', coalesce((
        select jsonb_agg(jsonb_build_object('name', name, 'amount', amount) order by amount desc) from (
          select coalesce(ec.name, 'Sans catégorie') as name, sum(e.amount) as amount
          from expenses e left join expense_categories ec on ec.id = e.category_id
          where e.organization_id = p_org and e.status = 'posted'
            and e.expense_date >= v_from_d and e.expense_date < v_to_d
            and (v_loc is null or e.location_id = v_loc)
          group by 1
        ) t
      ), '[]'::jsonb),
      'purchases_received', (
        select coalesce(sum(pr.total), 0) from purchase_receptions pr
        join purchase_orders po on po.id = pr.purchase_order_id
        where pr.organization_id = p_org and pr.received_at >= p_from and pr.received_at < p_to
          and (v_loc is null or po.location_id = v_loc))
    );
    if v_expenses = 0 then
      v_warnings := v_warnings || 'Aucune dépense n''est enregistrée sur la période : le bénéfice estimé est probablement surévalué.';
    end if;
  end if;

  if v_treasury then
    r := r || jsonb_build_object(
      'cash_in', (
        select coalesce(sum(amount), 0) from treasury_movements
        where organization_id = p_org and amount > 0
          and kind not in ('transfer_in', 'opening', 'cash_gap')
          and occurred_at >= p_from and occurred_at < p_to
          and (v_loc is null or location_id = v_loc)),
      'cash_out', (
        select coalesce(-sum(amount), 0) from treasury_movements
        where organization_id = p_org and amount < 0
          and kind not in ('transfer_out', 'cash_gap')
          and occurred_at >= p_from and occurred_at < p_to
          and (v_loc is null or location_id = v_loc)),
      'previous_cash_in', (
        select coalesce(sum(amount), 0) from treasury_movements
        where organization_id = p_org and amount > 0
          and kind not in ('transfer_in', 'opening', 'cash_gap')
          and occurred_at >= p_from - v_len and occurred_at < p_from
          and (v_loc is null or location_id = v_loc)),
      'accounts', coalesce((
        select jsonb_agg(jsonb_build_object('id', a.id, 'name', a.name, 'kind', a.kind,
                                            'balance', coalesce(b.balance, 0)) order by a.name)
        from treasury_accounts a
        left join (select account_id, sum(amount) as balance from treasury_movements
                   where organization_id = p_org group by account_id) b on b.account_id = a.id
        where a.organization_id = p_org and a.archived_at is null
          and (v_loc is null or a.location_id is null or a.location_id = v_loc)
      ), '[]'::jsonb)
    );
  else
    -- Encaissements de l'utilisateur uniquement
    r := r || jsonb_build_object('cash_in', (v_sales->>'paid_at_checkout')::numeric);
  end if;

  -- Marge (coûts d'achat requis)
  if v_costs then
    select coalesce(sum((si.quantity - si.returned_qty) * si.unit_cost), 0),
           count(*) filter (where si.unit_cost = 0)
    into v_cogs, v_zero_cost
    from sale_items si join sales s on s.id = si.sale_id
    where s.organization_id = p_org and s.status = 'completed'
      and s.created_at >= p_from and s.created_at < p_to
      and (v_loc is null or s.location_id = v_loc)
      and (v_cashier is null or s.cashier_id = v_cashier);
    r := r || jsonb_build_object(
      'net_revenue_ht', v_net_ht,
      'cogs', round(v_cogs, 0),
      'gross_margin', round(v_net_ht - v_cogs, 0),
      'gross_margin_rate', case when v_net_ht > 0 then round((v_net_ht - v_cogs) / v_net_ht * 100, 1) end,
      'stock_value', (
        select round(coalesce(sum(sl.quantity * sl.avg_cost), 0), 0) from stock_levels sl
        where sl.organization_id = p_org and sl.quantity > 0
          and (v_loc is null or sl.location_id = v_loc))
    );
    if v_reports then
      r := r || jsonb_build_object('net_result', round(v_net_ht - v_cogs - v_expenses + v_other, 0));
    end if;
    if v_zero_cost > 0 then
      v_warnings := v_warnings || (v_zero_cost || ' ligne(s) vendue(s) sans coût d''achat : la marge est surévaluée.');
    end if;
  end if;

  -- Alertes de stock
  r := r || jsonb_build_object('stock_alerts', coalesce((
    select jsonb_agg(jsonb_build_object('id', id, 'name', name, 'quantity', trim_scale(qty),
                                        'min_stock', trim_scale(min_stock)) order by qty)
    from (
      select p.id, p.name, p.min_stock, coalesce(sum(sl.quantity), 0) as qty
      from products p
      left join stock_levels sl on sl.product_id = p.id and (v_loc is null or sl.location_id = v_loc)
      where p.organization_id = p_org and p.is_active and p.track_stock
      group by p.id
      having coalesce(sum(sl.quantity), 0) <= p.min_stock
      order by coalesce(sum(sl.quantity), 0)
      limit 50
    ) t
  ), '[]'::jsonb));

  if v_credits then
    r := r || jsonb_build_object(
      'receivables', (select coalesce(sum(balance_due), 0) from sales
                      where organization_id = p_org and status = 'completed' and balance_due > 0
                        and (v_loc is null or location_id = v_loc)),
      'overdue_receivables', (select coalesce(sum(balance_due), 0) from sales
                              where organization_id = p_org and status = 'completed' and balance_due > 0
                                and due_date < (now() at time zone v_tz)::date
                                and (v_loc is null or location_id = v_loc))
    );
  end if;

  if v_payables then
    r := r || jsonb_build_object('payables', (
      select coalesce(sum(received_total - returned_total), 0) from purchase_orders where organization_id = p_org
    ) - (select coalesce(sum(amount), 0) from supplier_payments where organization_id = p_org));
  end if;

  r := r || jsonb_build_object('warnings', to_jsonb(v_warnings));
  return r;
end $$;

-- ---------------------------------------------------------------------
-- État de la caisse (pour l'écran de clôture)
-- ---------------------------------------------------------------------
create or replace function public.cash_session_status(p_account uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_acc treasury_accounts%rowtype;
  v_s cash_sessions%rowtype;
  v_balance numeric;
begin
  select * into v_acc from treasury_accounts where id = p_account;
  if not found then raise exception 'Compte introuvable'; end if;
  perform assert_perm(v_acc.organization_id, 'cash.close');
  if v_acc.location_id is not null then perform assert_location(v_acc.organization_id, v_acc.location_id); end if;
  v_balance := (select coalesce(sum(amount), 0) from treasury_movements where account_id = p_account);
  select * into v_s from cash_sessions where account_id = p_account and status = 'open';
  if not found then
    return jsonb_build_object('open', false, 'balance', v_balance);
  end if;
  return jsonb_build_object(
    'open', true,
    'session_id', v_s.id,
    'opened_at', v_s.opened_at,
    'declared_opening', v_s.declared_opening,
    'balance', v_balance,
    'movements', coalesce((
      select jsonb_agg(jsonb_build_object('kind', kind, 'amount', amount, 'count', cnt))
      from (select kind, sum(amount) as amount, count(*) as cnt from treasury_movements
            where account_id = p_account and occurred_at >= v_s.opened_at
            group by kind) t
    ), '[]'::jsonb)
  );
end $$;

-- ---------------------------------------------------------------------
-- Administration de la plateforme SaaS
-- ---------------------------------------------------------------------
create or replace function public.platform_overview()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not is_platform_admin() then
    raise exception 'Accès réservé aux administrateurs de la plateforme' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'organizations', (select count(*) from organizations),
    'users', (select count(*) from profiles),
    'sales_30d', (select count(*) from sales where created_at > now() - interval '30 days'),
    'deletion_requests', (select count(*) from account_deletion_requests where status = 'pending'),
    'list', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', o.id, 'name', o.name, 'sector', o.sector, 'city', o.city, 'created_at', o.created_at,
        'members', (select count(*) from organization_members m where m.organization_id = o.id),
        'plan', s.plan, 'status', s.status, 'trial_ends_at', s.trial_ends_at
      ) order by o.created_at desc)
      from organizations o left join subscriptions s on s.organization_id = o.id
    ), '[]'::jsonb)
  );
end $$;

-- Les droits d'exécution sont définis dans 20261029000005_grants.sql
