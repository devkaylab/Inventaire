-- La fiche d'un magasin affiche son adresse (16 septembre 2026).
--
-- Demande de Julien, dans la foulée de l'adresse exigée à la déclaration
-- (`20260916120001`) : elle se lit là où l'on regarde le magasin. Un seul
-- ajout, `address` dans l'objet `store` ; le reste est la définition en
-- vigueur, reprise de la base.

create or replace function public.ca_store_detail(p_store_id uuid)
returns json
language plpgsql
stable
security definer
set search_path = public, auth
as $function$
declare v_company uuid;
begin
  select company_id into v_company from public.stores where id = p_store_id;
  if v_company is null then
    raise exception 'Magasin introuvable.';
  end if;
  if not public.is_company_admin(v_company) then
    raise exception 'Accès réservé à l''administrateur de l''entreprise.';
  end if;

  return json_build_object(
    'store', (
      select json_build_object('id', s.id, 'name', s.name, 'join_code', s.join_code,
                               'created_at', s.created_at, 'address', s.address)
        from public.stores s where s.id = p_store_id),

    'supervisors', (
      select coalesce(json_agg(json_build_object(
               'id', p.id, 'full_name', p.full_name,
               'email', (select u.email::text from auth.users u where u.id = p.id),
               'is_company_admin', p.is_company_admin,
               'is_active', (select u.last_sign_in_at is not null from auth.users u where u.id = p.id)
             ) order by p.is_company_admin desc, p.full_name), '[]'::json)
        from public.store_supervisors ss
        join public.profiles p on p.id = ss.user_id
       where ss.store_id = p_store_id),

    'counters', (
      select coalesce(json_agg(json_build_object(
               'id', p.id, 'full_name', p.full_name,
               'email', (select u.email::text from auth.users u where u.id = p.id),
               'is_active', (select u.last_sign_in_at is not null from auth.users u where u.id = p.id),
               'last_count_at', (select max(c.created_at) from public.counts c
                                  join public.inventory_sessions s2 on s2.id = c.session_id
                                 where c.counted_by = p.id and s2.store_id = p_store_id),
               'sessions_counted', (select count(distinct c2.session_id) from public.counts c2
                                     join public.inventory_sessions s3 on s3.id = c2.session_id
                                    where c2.counted_by = p.id and s3.store_id = p_store_id)
             ) order by p.full_name), '[]'::json)
        from public.store_team st
        join public.profiles p on p.id = st.user_id
       where st.store_id = p_store_id and p.role = 'employee'),

    'sessions', (
      select coalesce(json_agg(json_build_object(
               'id', x.id,
               'name', coalesce(nullif(btrim(x.name), ''), x.inventory_number),
               'inventory_number', x.inventory_number,
               'status', x.status,
               'uses_zones', x.uses_zones,
               'created_at', x.created_at,
               'closed_at', x.closed_at,
               'created_by_label', (select coalesce(nullif(btrim(pr.full_name), ''), '')
                                      from public.profiles pr where pr.id = x.created_by),
               'members', (select count(*) from public.session_members sm where sm.session_id = x.id),
               'pieces', (select coalesce(sum(c3.qty), 0)::bigint from public.counts c3
                           where c3.session_id = x.id),
               'expected', (select coalesce(sum(t.theoretical_qty), 0)::bigint
                              from public.theoretical_stock t where t.session_id = x.id),
               'last_count_at', (select max(c4.created_at) from public.counts c4
                                  where c4.session_id = x.id)
             ) order by (x.status <> 'closed') desc, x.created_at desc), '[]'::json)
        from public.inventory_sessions x where x.store_id = p_store_id)
  );
end;
$function$;

revoke all on function public.ca_store_detail(uuid) from public, anon;
grant execute on function public.ca_store_detail(uuid) to authenticated, service_role;
