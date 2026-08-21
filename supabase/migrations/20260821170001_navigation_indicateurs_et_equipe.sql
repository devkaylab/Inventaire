-- Refonte de la navigation : ce que les nouveaux écrans ont besoin de lire.
-- (Contenu identique à la migration appliquée en live le 21 août 2026.)
--
-- Deux fonctions, une par écran, chacune en une seule requête : la page ne
-- doit plus enchaîner les appels comme le faisait « Mon compte ».
--
-- admin_business_overview : les chiffres du métier, et surtout ce qui les
-- menace — un client sans magasin ne paie aucune licence (elle est par
-- magasin), un magasin qui ne compte plus est un client qui décroche.
-- Le revenu n'y figure PAS : aucun prix n'est enregistré en base. L'ajouter
-- demande une colonne de tarif par magasin, décision à prendre à part —
-- plutôt qu'un montant inventé ici.
--
-- my_team_by_store : les compteurs d'un superviseur, rangés par magasin.
-- ca_list_team() sert l'administrateur d'entreprise ; celle-ci sert le
-- superviseur, sur ses seuls magasins.

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

create or replace function public.my_team_by_store()
returns json
language plpgsql
stable security definer
set search_path to 'public', 'auth'
as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Non authentifié.'; end if;
  if coalesce(public.get_my_role(), '') <> 'supervisor' then
    raise exception 'Réservé aux superviseurs.';
  end if;

  return json_build_object(
    'stores', (
      select coalesce(json_agg(json_build_object(
               'id', s.id, 'name', s.name,
               'counters', (
                 select coalesce(json_agg(json_build_object(
                          'id', p.id,
                          'full_name', p.full_name,
                          'email', (select u.email::text from auth.users u where u.id = p.id),
                          'is_active', (select u.last_sign_in_at is not null
                                          from auth.users u where u.id = p.id),
                          'sessions_counted', (
                            select count(distinct c2.session_id) from public.counts c2
                             where c2.counted_by = p.id)
                        ) order by p.full_name), '[]'::json)
                   from public.store_team st
                   join public.profiles p on p.id = st.user_id
                  where st.store_id = s.id and p.role = 'employee')
             ) order by s.name), '[]'::json)
        from public.stores s
        join public.store_supervisors ss on ss.store_id = s.id and ss.user_id = v_uid),
    'invitations', (
      select coalesce(json_agg(json_build_object(
               'id', i.id, 'email', i.email, 'first_name', i.first_name,
               'last_name', i.last_name, 'created_at', i.created_at
             ) order by i.created_at desc), '[]'::json)
        from public.team_invitations i
       where i.created_by = v_uid)
  );
end;
$$;

revoke all on function public.my_team_by_store() from public, anon;
grant execute on function public.my_team_by_store() to authenticated, service_role;
