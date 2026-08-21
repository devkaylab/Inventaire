-- Administrateur d'entreprise, acte 5 : « Mot de passe à créer ».
--
-- Constat du test terrain (21 août 2026) : handle_new_user crée le profil
-- dès l'invitation, avant le mot de passe — la personne apparaissait donc
-- comme superviseur à part entière alors qu'elle ne peut pas encore se
-- connecter. La console admin gère déjà ce cas (« Mot de passe à créer ») ;
-- l'espace équipe l'ignorait. ca_list_team remonte désormais l'état du
-- compte pour que l'écran le dise.
create or replace function public.ca_list_team()
returns json
language plpgsql
stable security definer
set search_path to 'public', 'auth'
as $$
declare v_company uuid;
begin
  if not public.is_company_admin() then
    raise exception 'Accès réservé à l''administrateur de l''entreprise.';
  end if;
  select company_id into v_company from public.profiles where id = auth.uid();

  return json_build_object(
    'stores', (
      select coalesce(json_agg(json_build_object('id', s.id, 'name', s.name) order by s.name), '[]'::json)
        from public.stores s where s.company_id = v_company),
    'members', (
      select coalesce(json_agg(json_build_object(
               'id', p.id,
               'full_name', p.full_name,
               'first_name', p.first_name,
               'last_name', p.last_name,
               'role', p.role,
               'is_company_admin', p.is_company_admin,
               'email', (select u.email::text from auth.users u where u.id = p.id),
               -- Faux tant que la personne n'a pas choisi son mot de passe :
               -- le profil existe, le compte n'est pas encore utilisable.
               'is_active', (select u.last_sign_in_at is not null
                               from auth.users u where u.id = p.id),
               'store_ids', case when p.role = 'supervisor' then
                 (select coalesce(json_agg(ss.store_id), '[]'::json)
                    from public.store_supervisors ss
                    join public.stores st on st.id = ss.store_id and st.company_id = v_company
                   where ss.user_id = p.id)
               else
                 (select coalesce(json_agg(stm.store_id), '[]'::json)
                    from public.store_team stm
                    join public.stores st on st.id = stm.store_id and st.company_id = v_company
                   where stm.user_id = p.id)
               end
             ) order by p.is_company_admin desc, p.role desc, p.full_name), '[]'::json)
        from public.profiles p where p.company_id = v_company),
    'invitations', (
      select coalesce(json_agg(json_build_object(
               'id', i.id, 'email', i.email,
               'first_name', i.first_name, 'last_name', i.last_name,
               'role', i.role, 'store_ids', coalesce(to_json(i.store_ids), '[]'::json),
               'created_at', i.created_at
             ) order by i.created_at desc), '[]'::json)
        from public.team_invitations i where i.company_id = v_company)
  );
end;
$$;

-- create or replace rend EXECUTE à PUBLIC : droits reposés aussitôt.
revoke all on function public.ca_list_team() from public, anon;
grant execute on function public.ca_list_team() to authenticated, service_role;
