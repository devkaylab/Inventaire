-- ─────────────────────────────────────────────────────────────────────────
-- Panier moyen : 2 200 € → 3 700 €.
--
-- La grille tarifaire a été regonflée de la fiscalité le 21 août 2026 : les
-- montants d'origine (1 200 / 2 400 / 3 900 / 6 000 / 8 400 €) sont désormais
-- ce qui reste NET après impôt sur les sociétés et flat tax, et les prix
-- affichés sont ces montants divisés par 0,595 — soit 2 100 / 4 200 / 6 600 /
-- 10 200 / 14 400 €.
--
-- Le panier moyen suit la même règle : 2 200 / 0,595 = 3 697 €, arrondi à
-- 3 700 € (qui laisse très exactement 2 201 € net). C'est l'estimation servie
-- par admin_business_overview pour les magasins dont le tarif négocié n'est
-- pas encore saisi ; la carte du tableau de bord annonce qu'il s'agit d'une
-- estimation, et le nombre de magasins concernés.
--
-- Seule la constante change. Le reste du corps est recopié à l'identique de
-- 20260821190001 : `create or replace` impose de redonner la fonction
-- entière, et les GRANT sont reposés dans la même migration puisque le
-- remplacement rend EXECUTE à PUBLIC.
-- ─────────────────────────────────────────────────────────────────────────

create or replace function public.admin_business_overview()
returns json
language plpgsql
stable security definer
set search_path to 'public'
as $$
declare
  v_debut_mois timestamptz := date_trunc('month', now());
  v_defaut_cents constant integer := 370000;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return json_build_object(
    'companies', (select count(*) from public.companies),
    'companies_new_month', (select count(*) from public.companies where created_at >= v_debut_mois),
    'stores', (select count(*) from public.stores),
    'arr_cents', (select coalesce(sum(coalesce(annual_price_cents, v_defaut_cents)), 0) from public.stores),
    'priced_stores', (select count(*) from public.stores where annual_price_cents is not null),
    'default_price_cents', v_defaut_cents,
    'active_stores_month', (
      select count(distinct s.store_id) from public.inventory_sessions s
       where s.created_at >= v_debut_mois and s.store_id is not null),
    'sessions_month', (select count(*) from public.inventory_sessions where created_at >= v_debut_mois),
    'counts_month', (select count(*) from public.counts where created_at >= v_debut_mois),
    'active_people_month', (select count(distinct counted_by) from public.counts
                             where created_at >= v_debut_mois and counted_by is not null),
    'companies_without_store', (
      select coalesce(json_agg(json_build_object('id', c.id, 'name', c.name) order by c.name), '[]'::json)
        from public.companies c
       where not exists (select 1 from public.stores s where s.company_id = c.id)),
    'companies_without_admin', (
      select count(*) from public.companies c
       where not exists (select 1 from public.profiles p
                          where p.company_id = c.id and p.is_company_admin)),
    'idle_stores', (
      select coalesce(json_agg(json_build_object(
               'id', s.id, 'name', s.name, 'company_id', s.company_id,
               'company_name', c.name,
               'days', case when d.last is null then null
                            else floor(extract(epoch from now() - d.last) / 86400)::int end
             ) order by d.last nulls first), '[]'::json)
        from public.stores s
        join public.companies c on c.id = s.company_id
        cross join lateral (
          select max(x.created_at) as last from public.inventory_sessions x where x.store_id = s.id
        ) d
       where d.last is null or d.last < now() - interval '60 days'),
    'pending_deletions', (
      select count(*) from public.account_deletion_requests where status = 'pending')
  );
end;
$$;

revoke all on function public.admin_business_overview() from public, anon;
grant execute on function public.admin_business_overview() to authenticated, service_role;
