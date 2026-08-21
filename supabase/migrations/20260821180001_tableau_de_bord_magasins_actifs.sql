-- Tableau de bord Quantinvo : remplacer un doublon par un vrai signal.
--
-- La première ligne affichait « Inventaires ce mois-ci », que la ligne
-- « Usage du mois » redonnait sous le nom « Inventaires lancés ». Le même
-- chiffre deux fois — le défaut même qu'on venait de corriger ailleurs.
--
-- À sa place, active_stores_month : combien de magasins SOUS LICENCE ont
-- réellement compté ce mois. Rapporté au nombre de magasins, c'est la santé
-- du parc — quatre magasins facturés dont un seul compte, c'est un client
-- qui s'en va.
--
-- (Corps identique à la migration appliquée en live le 21 août 2026 ;
-- seule la clé active_stores_month s'ajoute par rapport à 20260821170001.)
create or replace function public.admin_business_overview()
returns json
language plpgsql
stable security definer
set search_path to 'public'
as $$
declare v_debut_mois timestamptz := date_trunc('month', now());
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return json_build_object(
    'companies', (select count(*) from public.companies),
    'stores', (select count(*) from public.stores),
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
