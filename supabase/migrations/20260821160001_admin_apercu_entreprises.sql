-- Console d'administration : une liste d'entreprises qui tient la charge.
--
-- La page /admin montait une carte complète par entreprise, et chacune
-- déclenchait deux requêtes au chargement (membres, affectations) : à
-- cinquante entreprises, cent requêtes et un mur illisible — avec le risque
-- de supprimer la mauvaise ligne.
--
-- admin_list_companies_overview rend en UNE requête ce qu'il faut pour la
-- liste : de quoi chercher, et de quoi repérer ce qui demande attention.
-- Le code d'entreprise n'y figure PAS : il est confidentiel et n'a rien à
-- faire dans une liste survolée. Le détail complet, codes compris, est servi
-- entreprise par entreprise par admin_company_detail.
create or replace function public.admin_list_companies_overview()
returns table(
  id uuid,
  name text,
  created_at timestamptz,
  store_count int,
  supervisor_count int,
  counter_count int,
  company_admin_count int,
  pending_invitations int,
  last_session_at timestamptz
)
language plpgsql
stable security definer
set search_path to 'public'
as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return query
  select c.id, c.name, c.created_at,
         (select count(*)::int from public.stores s where s.company_id = c.id),
         (select count(*)::int from public.profiles p
           where p.company_id = c.id and p.role = 'supervisor'),
         (select count(*)::int from public.profiles p
           where p.company_id = c.id and p.role = 'employee'),
         (select count(*)::int from public.profiles p
           where p.company_id = c.id and p.is_company_admin),
         (select count(*)::int from public.team_invitations i where i.company_id = c.id),
         (select max(s.created_at) from public.inventory_sessions s where s.company_id = c.id)
  from public.companies c
  order by c.name;
end;
$$;

revoke all on function public.admin_list_companies_overview() from public, anon;
grant execute on function public.admin_list_companies_overview() to authenticated, service_role;

create or replace function public.admin_company_detail(p_company_id uuid)
returns json
language plpgsql
stable security definer
set search_path to 'public', 'auth'
as $$
declare v json;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;

  select json_build_object(
    'company', (select json_build_object('id', c.id, 'name', c.name,
                         'join_code', c.join_code, 'created_at', c.created_at)
                  from public.companies c where c.id = p_company_id),
    'stores', (select coalesce(json_agg(json_build_object(
                        'id', s.id, 'name', s.name, 'join_code', s.join_code,
                        'supervisor_ids', (select coalesce(json_agg(ss.user_id), '[]'::json)
                                             from public.store_supervisors ss
                                            where ss.store_id = s.id)
                      ) order by s.name), '[]'::json)
                 from public.stores s where s.company_id = p_company_id),
    'members', (select coalesce(json_agg(json_build_object(
                        'id', p.id, 'full_name', p.full_name, 'role', p.role,
                        'is_company_admin', p.is_company_admin,
                        'email', (select u.email::text from auth.users u where u.id = p.id),
                        'is_active', (select u.last_sign_in_at is not null
                                        from auth.users u where u.id = p.id)
                      ) order by p.is_company_admin desc, p.role desc, p.full_name), '[]'::json)
                 from public.profiles p where p.company_id = p_company_id),
    'invitations', (select coalesce(json_agg(json_build_object(
                        'id', i.id, 'email', i.email, 'role', i.role,
                        'first_name', i.first_name, 'last_name', i.last_name,
                        'created_at', i.created_at
                      ) order by i.created_at desc), '[]'::json)
                 from public.team_invitations i where i.company_id = p_company_id)
  ) into v;

  if v->'company' is null or v->>'company' is null then
    raise exception 'Entreprise introuvable.';
  end if;
  return v;
end;
$$;

revoke all on function public.admin_company_detail(uuid) from public, anon;
grant execute on function public.admin_company_detail(uuid) to authenticated, service_role;
