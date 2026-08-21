-- Un superviseur gère vraiment son équipe.
--
-- Manque relevé par Julien le 21 août 2026 : « comment un superviseur est-il
-- supposé gérer son équipe s'il ne peut pas retirer un membre ! » La maquette
-- montrait un bouton « Retirer » sur chaque ligne de compteur ; l'écran livré
-- le réservait à l'administrateur d'entreprise, et rien en base ne permettait
-- le geste — `store_team` a la RLS active sans aucune policy, donc aucune
-- écriture côté client, et aucune RPC ne couvrait ce cas.
--
-- Deux fonctions, même famille :
--   · remove_counter_from_store : retirer un compteur d'UN magasin. Pas de
--     partout — un compteur qui travaille dans deux magasins supervisés par
--     deux personnes ne doit pas disparaître des deux d'un seul clic. Le
--     bouton vit d'ailleurs dans le groupe d'un magasin.
--   · cancel_my_invitation : annuler l'invitation qu'on a soi-même envoyée.
--     L'écran affichait « Invitations en cours » au superviseur sans lui
--     donner de recours sur une adresse mal tapée.
--
-- Gardes vérifiées en session superviseur réelle (jetons JWT simulés) :
-- magasin d'une autre entreprise → refus ; magasin de son entreprise qu'il
-- ne supervise pas → refus ; cible qui n'est pas compteur → refus ; se
-- retirer soi-même → refus.

create or replace function public.remove_counter_from_store(p_user uuid, p_store_id uuid)
returns json
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  v_company uuid;
  v_nom text;
  v_magasin text;
begin
  if v_uid is null then
    return json_build_object('success', false, 'error', 'Non authentifié.');
  end if;
  if p_user = v_uid then
    return json_build_object('success', false, 'error', 'Vous ne pouvez pas vous retirer vous-même.');
  end if;

  select s.company_id, s.name into v_company, v_magasin
    from public.stores s where s.id = p_store_id;
  if v_company is null then
    return json_build_object('success', false, 'error', 'Magasin introuvable.');
  end if;

  -- Le superviseur du magasin, ou l'administrateur de l'entreprise. La
  -- vérification porte sur le magasin visé, jamais sur un paramètre fourni
  -- par l'appelant.
  if not (
    exists (select 1 from public.store_supervisors ss
             where ss.store_id = p_store_id and ss.user_id = v_uid)
    or public.is_company_admin(v_company)
  ) then
    return json_build_object('success', false, 'error', 'Ce magasin n''est pas le vôtre.');
  end if;

  select p.full_name into v_nom from public.profiles p
   where p.id = p_user and p.company_id = v_company and p.role = 'employee';
  if v_nom is null then
    return json_build_object('success', false, 'error', 'Compteur introuvable dans ce magasin.');
  end if;

  delete from public.store_team
   where store_id = p_store_id and user_id = p_user;

  perform public.log_company_action(v_company, 'compteur_retire_du_magasin',
    coalesce(v_nom, ''), json_build_object('magasin', coalesce(v_magasin, ''))::jsonb);

  return json_build_object('success', true);
end;
$$;

revoke all on function public.remove_counter_from_store(uuid, uuid) from public, anon;
grant execute on function public.remove_counter_from_store(uuid, uuid) to authenticated, service_role;

create or replace function public.cancel_my_invitation(p_id uuid)
returns json
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  v_inv public.team_invitations%rowtype;
begin
  if v_uid is null then
    return json_build_object('success', false, 'error', 'Non authentifié.');
  end if;

  delete from public.team_invitations
   where id = p_id and created_by = v_uid
  returning * into v_inv;
  if not found then
    return json_build_object('success', false,
      'error', 'Invitation introuvable, ou envoyée par quelqu''un d''autre.');
  end if;

  perform public.log_company_action(v_inv.company_id, 'invitation_annulee',
    btrim(coalesce(v_inv.first_name, '') || ' ' || coalesce(v_inv.last_name, '')),
    json_build_object('email', coalesce(v_inv.email, ''), 'role', v_inv.role)::jsonb);

  return json_build_object('success', true);
end;
$$;

revoke all on function public.cancel_my_invitation(uuid) from public, anon;
grant execute on function public.cancel_my_invitation(uuid) to authenticated, service_role;

-- La liste des compteurs porte la date du dernier comptage, comme la maquette
-- (« a compté 3 inventaires · dernier le 14/08 »).
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
                             where c2.counted_by = p.id),
                          'last_count_at', (
                            select max(c3.created_at) from public.counts c3
                             where c3.counted_by = p.id)
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
