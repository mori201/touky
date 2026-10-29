-- Scénario de bout en bout : à exécuter sur une base de test locale
\set ON_ERROR_STOP 1
insert into auth.users (id, email, raw_user_meta_data) values
 ('00000000-0000-0000-0000-00000000000a', 'awa@example.sn', '{"full_name":"Awa Ndiaye","terms_accepted":"true"}'),
 ('00000000-0000-0000-0000-00000000000b', 'moussa@example.sn', '{"full_name":"Moussa Fall"}'),
 ('00000000-0000-0000-0000-00000000000c', 'caissier@example.sn', '{"full_name":"Fatou Caisse"}');

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);

select public.create_organization('Boutique Awa', 'boutique', '+221770000000', 'Dakar', 'Médina', 'Boutique Médina', 'boutique') as org \gset
select id as loc from locations where organization_id = :'org' \gset
insert into categories (organization_id, name) values (:'org', 'Boissons') returning id as cat \gset
insert into products (organization_id, name, sku, category_id, purchase_price, sale_price, min_stock)
  values (:'org', 'Eau Kirène 1,5L', 'EAU15', :'cat', 300, 500, 5) returning id as p1 \gset
insert into products (organization_id, name, sku, purchase_price, sale_price, wholesale_price)
  values (:'org', 'Riz brisé 1kg', 'RIZ1', 450, 600, 550) returning id as p2 \gset
select adjust_stock(:'org', :'p1', :'loc', 'initial', 10, 300, null);
select adjust_stock(:'org', :'p2', :'loc', 'initial', 3, 450, null);

-- Vente comptant avec rendu de monnaie
select create_sale(:'org', :'loc', jsonb_build_array(jsonb_build_object('product_id', :'p1', 'quantity', 2)),
  '[{"method":"cash","amount":1000}]', null, 'retail', 0, 2000, null, null, 'k1') as s1 \gset
\echo :s1
-- Rejeu de la même clé : aucune double vente
select create_sale(:'org', :'loc', jsonb_build_array(jsonb_build_object('product_id', :'p1', 'quantity', 2)),
  '[{"method":"cash","amount":1000}]', null, 'retail', 0, 2000, null, null, 'k1');
select quantity from stock_levels where product_id = :'p1';

-- Vente supérieure au stock : refusée
do $$ begin
  perform create_sale((select id from organizations limit 1), (select id from locations limit 1),
    jsonb_build_array(jsonb_build_object('product_id', (select id from products where sku='RIZ1'), 'quantity', 5)),
    '[]'::jsonb);
  raise exception 'ÉCHEC : la survente aurait dû être refusée';
exception when others then
  if sqlerrm like 'ÉCHEC%' then raise; end if;
  raise notice 'OK survente refusée : %', sqlerrm;
end $$;

-- Vente à crédit sans client : refusée ; avec client : acceptée
insert into customers (organization_id, name, phone, credit_limit) values (:'org', 'Ousmane Diop', '+221771112233', 5000) returning id as c1 \gset
select create_sale(:'org', :'loc', jsonb_build_array(jsonb_build_object('product_id', :'p2', 'quantity', 2)),
  '[{"method":"wave","amount":200}]', :'c1', 'wholesale', 0, null, current_date + 7, null, 'k2') as s2 \gset
\echo :s2
select balance_due, total_paid, total_sales from customer_balances where customer_id = :'c1';
select record_customer_payment(:'org', :'c1', 500, 'cash');
select balance_due from customer_balances where customer_id = :'c1';
-- Remboursement supérieur au solde : refusé
do $$ begin
  perform record_customer_payment((select id from organizations limit 1), (select id from customers limit 1), 10000, 'cash');
  raise exception 'ÉCHEC';
exception when others then
  if sqlerrm = 'ÉCHEC' then raise; end if;
  raise notice 'OK remboursement excessif refusé : %', sqlerrm;
end $$;

-- Annulation de la première vente : stock et caisse compensés
select cancel_sale((:'s1'::jsonb->>'id')::uuid, 'Erreur de saisie');
select quantity from stock_levels where product_id = :'p1';
select type, quantity, balance_after from stock_movements where product_id = :'p1' order by id;

-- Achats : commande, réception partielle, CMUP, paiement
insert into suppliers (organization_id, name) values (:'org', 'Grossiste Sandaga') returning id as sup \gset
select create_purchase_order(:'org', :'loc', :'sup', jsonb_build_array(jsonb_build_object('product_id', :'p1', 'quantity', 20, 'unit_cost', 350)), 'ordered') as po \gset
select id as poi from purchase_order_items where purchase_order_id = :'po' \gset
select receive_purchase(:'po', jsonb_build_array(jsonb_build_object('item_id', :'poi', 'quantity', 10)));
select status, received_total from purchase_orders where id = :'po';
select balance_due from supplier_balances where supplier_id = :'sup';
reset role;
select quantity, round(avg_cost, 2) as cmup from stock_levels where product_id = :'p1';
set role authenticated;
select pay_supplier(:'org', :'sup', 400, 'cash', null, :'po');
select balance_due from supplier_balances where supplier_id = :'sup';

-- Dépense, transfert, clôture de caisse avec écart
select create_expense(:'org', :'loc', (select id from expense_categories where organization_id = :'org' and name = 'Transport'), 'Taxi livraison', 50, current_date, 'cash');
select account_id as cash_acc from account_balances where organization_id = :'org' and kind = 'cash' \gset
select name, balance from account_balances where organization_id = :'org' order by name;
select open_cash_session(:'cash_acc', (select balance from account_balances where account_id = :'cash_acc')) as sess \gset
do $$ begin
  perform close_cash_session((select id from cash_sessions where status='open'), 0, '');
  raise exception 'ÉCHEC';
exception when others then
  if sqlerrm = 'ÉCHEC' then raise; end if;
  raise notice 'OK écart sans commentaire refusé : %', sqlerrm;
end $$;
select close_cash_session(:'sess', 0, 'Billets remis au gérant');

-- Inventaire
select create_inventory(:'org', :'loc') as inv \gset
select set_inventory_counts(:'inv', jsonb_build_array(jsonb_build_object('product_id', :'p2', 'counted', 0)));
select validate_inventory(:'inv');

-- Tableau de bord
select jsonb_pretty(dashboard_summary(:'org', date_trunc('day', now()), date_trunc('day', now()) + interval '1 day'));

-- Isolation : un autre utilisateur ne voit rien et ne peut rien faire
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
select count(*) as produits_visibles_par_b from products;
select count(*) as ventes_visibles_par_b from sales;
select count(*) as clients_visibles_par_b from customer_balances;
do $$ begin
  perform create_sale((select id from organizations limit 1), null, '[]', '[]');
  raise exception 'ÉCHEC';
exception when others then
  if sqlerrm = 'ÉCHEC' then raise; end if;
  raise notice 'OK vente refusée pour non-membre : %', sqlerrm;
end $$;
do $$ begin
  update products set sale_price = 1 where true;
  if found then raise exception 'ÉCHEC modification croisée'; end if;
  raise notice 'OK aucune ligne modifiable par B';
end $$;

-- Caissier invité : pas d'accès aux coûts
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
select invite_member(:'org', 'caissier@example.sn', 'cashier') as tok \gset
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', false);
reset role;
-- auth.users n'est pas accessible au rôle authenticated : accept_invitation est SECURITY DEFINER
set role authenticated;
select accept_invitation(:'tok');
select count(*) as produits_visibles_caissier from products;
do $$ begin
  perform purchase_price from products;
  raise exception 'ÉCHEC';
exception when insufficient_privilege then raise notice 'OK colonne purchase_price masquée';
end $$;
do $$ begin
  perform get_product_costs((select id from organizations limit 1));
  raise exception 'ÉCHEC';
exception when others then
  if sqlerrm = 'ÉCHEC' then raise; end if;
  raise notice 'OK coûts refusés au caissier : %', sqlerrm;
end $$;
select dashboard_summary(:'org', date_trunc('day', now()), date_trunc('day', now()) + interval '1 day') ? 'gross_margin' as caissier_voit_marge;
do $$ begin
  perform cancel_sale((select id from sales where status='completed' limit 1), 'test');
  raise exception 'ÉCHEC';
exception when others then
  if sqlerrm = 'ÉCHEC' then raise; end if;
  raise notice 'OK annulation refusée au caissier : %', sqlerrm;
end $$;
\echo 'SCÉNARIO TERMINÉ'

-- Tableau de bord d'une entreprise sans aucune dépense (cas de tout nouvel utilisateur)
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
select public.create_organization('Boutique Moussa', 'boutique') as org2 \gset
select jsonb_array_length(dashboard_summary(:'org2', now() - interval '1 day', now() + interval '1 day') -> 'warnings') as avertissements_nouvelle_entreprise;
insert into products (organization_id, name, sale_price) values (:'org2', 'Article sans coût', 1000) returning id as p3 \gset
select adjust_stock(:'org2', :'p3', (select id from locations where organization_id = :'org2'), 'initial', 5, null, null);
select create_sale(:'org2', (select id from locations where organization_id = :'org2'), jsonb_build_array(jsonb_build_object('product_id', :'p3', 'quantity', 1)), '[{"method":"cash","amount":1000}]');
select dashboard_summary(:'org2', now() - interval '1 day', now() + interval '1 day') -> 'warnings' as avertissements_deux;
\echo 'TABLEAU DE BORD SANS DÉPENSE OK'
