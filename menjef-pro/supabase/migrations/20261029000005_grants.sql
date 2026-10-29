-- =====================================================================
-- Mënjëf PRO — Droits d'exécution des fonctions (à appliquer en dernier)
-- =====================================================================

-- Vues de soldes (RLS des tables sous-jacentes appliquée via security_invoker)
grant select on public.customer_balances, public.supplier_balances, public.account_balances to authenticated;
revoke all on public.customer_balances, public.supplier_balances, public.account_balances from anon;

-- Par défaut PostgreSQL accorde EXECUTE à PUBLIC : on le retire partout,
-- puis on n'accorde l'exécution qu'aux utilisateurs authentifiés.
alter default privileges in schema public revoke execute on functions from public;
alter default privileges in schema public revoke execute on functions from anon;

do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prokind = 'f'
  loop
    execute format('revoke execute on function %s from public, anon', f.sig);
    execute format('grant execute on function %s to authenticated', f.sig);
  end loop;
end $$;

-- Fonctions internes : jamais appelables directement depuis l'API
revoke execute on function public.next_number(uuid, text, text) from authenticated;
revoke execute on function public.apply_stock(uuid, uuid, uuid, public.stock_movement_type, numeric, numeric, text, uuid, text, boolean) from authenticated;
revoke execute on function public.add_treasury(uuid, uuid, uuid, public.treasury_movement_kind, numeric, text, text, uuid, timestamptz) from authenticated;
revoke execute on function public.write_audit(uuid, text, text, text, jsonb) from authenticated;
revoke execute on function public.resolve_account(uuid, public.payment_method, uuid, uuid) from authenticated;
revoke execute on function public.account_balance(uuid) from authenticated;
revoke execute on function public.audit_trigger() from authenticated;
revoke execute on function public.handle_new_user() from authenticated;

-- Seule fonction lisible sans connexion : l'aperçu d'une invitation par son jeton secret
grant execute on function public.get_invitation(text) to anon;
