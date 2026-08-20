-- Administrateur d'entreprise, acte 2 : les invitations portent un rôle,
-- et handle_new_user sait créer superviseurs et administrateurs invités.

alter table public.team_invitations
  add column if not exists role text not null default 'employee';

alter table public.team_invitations
  add constraint team_invitations_role_check
  check (role in ('employee', 'supervisor', 'company_admin'));

-- Fermeture d'un trou d'élévation : la policy laissait un superviseur écrire
-- n'importe quelle ligne de son entreprise — donc s'inventer une invitation
-- 'company_admin' que handle_new_user aurait honorée. Les superviseurs ne
-- gèrent que des invitations de compteurs ; les rôles privilégiés ne passent
-- que par les fonctions SECURITY DEFINER (ca_*, admin_*).
drop policy if exists team_invitations_supervisor on public.team_invitations;
create policy team_invitations_supervisor on public.team_invitations
  for all
  using ((get_my_role() = 'supervisor') and (company_id = get_my_company()) and (role = 'employee'))
  with check ((get_my_role() = 'supervisor') and (company_id = get_my_company()) and (role = 'employee'));

-- handle_new_user : deux branches nouvelles, placées AVANT les invitations
-- d'inventaire pour qu'une personne invitée comme superviseur ou admin ne
-- retombe jamais en simple compteur. Le refus final reste inchangé.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_email   text := lower(trim(new.email));
  v_first   text; v_last text; v_name text;
  v_sup     public.supervisor_requests%rowtype;
  v_team    public.team_invitations%rowtype;
  v_company uuid;
  v_session_count int;
  r record;
begin
  v_first := coalesce(nullif(trim(new.raw_user_meta_data->>'first_name'), ''), '');
  v_last  := coalesce(nullif(trim(new.raw_user_meta_data->>'last_name'),  ''), '');

  select * into v_sup from public.supervisor_requests
   where lower(email) = v_email and status = 'approved' order by created_at desc limit 1;
  select count(*) into v_session_count from public.session_invitations si where si.email = v_email;
  select * into v_team from public.team_invitations where email = v_email limit 1;

  if v_sup.id is not null then
    v_first := coalesce(nullif(v_first, ''), v_sup.first_name);
    v_last  := coalesce(nullif(v_last,  ''), v_sup.last_name);
    v_name  := public.compose_full_name(v_first, v_last,
                 nullif(trim(new.raw_user_meta_data->>'full_name'), ''));
    insert into public.profiles (id, full_name, first_name, last_name, role, company_id)
      values (new.id, v_name, v_first, v_last, 'supervisor', v_sup.company_id);
    insert into public.store_supervisors (store_id, user_id)
      values (v_sup.store_id, new.id) on conflict do nothing;
    update public.supervisor_requests set status = 'active', user_id = new.id where id = v_sup.id;

  elsif v_team.id is not null and v_team.role in ('supervisor', 'company_admin') then
    -- Invitation privilégiée : superviseur, ou administrateur d'entreprise
    -- (role 'supervisor' + drapeau, voir 20260820190001).
    v_first := coalesce(nullif(v_first, ''), v_team.first_name);
    v_last  := coalesce(nullif(v_last,  ''), v_team.last_name);
    v_name  := public.compose_full_name(v_first, v_last, coalesce(
      nullif(trim(new.raw_user_meta_data->>'full_name'), ''), nullif(v_team.full_name, ''), ''));
    insert into public.profiles (id, full_name, first_name, last_name, role, company_id, is_company_admin)
      values (new.id, v_name, v_first, v_last, 'supervisor', v_team.company_id,
              v_team.role = 'company_admin');
    if array_length(v_team.store_ids, 1) is not null then
      insert into public.store_supervisors (store_id, user_id)
        select unnest(v_team.store_ids), new.id on conflict do nothing;
    end if;
    delete from public.team_invitations where id = v_team.id;

  elsif v_session_count > 0 then
    select company_id into v_company from public.session_invitations
      where email = v_email order by created_at limit 1;
    v_name := public.compose_full_name(v_first, v_last, coalesce(
      nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
      (select nullif(full_name, '') from public.session_invitations
        where email = v_email order by created_at limit 1), ''));
    insert into public.profiles (id, full_name, first_name, last_name, role, company_id)
      values (new.id, v_name, v_first, v_last, 'employee', v_company);
    for r in select * from public.session_invitations where email = v_email loop
      insert into public.session_members (session_id, user_id, role)
        values (r.session_id, new.id, r.role)
        on conflict (session_id, user_id) do update set role = excluded.role;
      insert into public.store_team (store_id, user_id)
        select s.store_id, new.id from public.inventory_sessions s where s.id = r.session_id
        on conflict do nothing;
    end loop;
    delete from public.session_invitations where email = v_email;
    delete from public.team_invitations where email = v_email;

  elsif v_team.id is not null then
    v_first := coalesce(nullif(v_first, ''), v_team.first_name);
    v_last  := coalesce(nullif(v_last,  ''), v_team.last_name);
    v_name  := public.compose_full_name(v_first, v_last, coalesce(
      nullif(trim(new.raw_user_meta_data->>'full_name'), ''), nullif(v_team.full_name, ''), ''));
    insert into public.profiles (id, full_name, first_name, last_name, role, company_id)
      values (new.id, v_name, v_first, v_last, 'employee', v_team.company_id);
    if array_length(v_team.store_ids, 1) is not null then
      insert into public.store_team (store_id, user_id)
        select unnest(v_team.store_ids), new.id on conflict do nothing;
    else
      insert into public.store_team (store_id, user_id)
        select ss.store_id, new.id from public.store_supervisors ss
        where ss.user_id = v_team.created_by on conflict do nothing;
    end if;
    delete from public.team_invitations where id = v_team.id;

  else
    if not exists (select 1 from public.profiles) then
      insert into public.profiles (id, full_name, first_name, last_name, role)
        values (new.id, public.compose_full_name(v_first, v_last,
                  coalesce(new.raw_user_meta_data->>'full_name', '')), v_first, v_last, 'supervisor');
    else
      raise exception 'Aucune invitation ni demande validée pour cet e-mail. Déposez une demande sur le site, ou demandez à votre superviseur de vous ajouter.';
    end if;
  end if;
  return new;
end;
$$;

-- create or replace rend EXECUTE à PUBLIC : on repose les droits. La fonction
-- n'est appelée que par le trigger d'auth.users, personne n'a à l'exécuter.
revoke all on function public.handle_new_user() from public, anon, authenticated;
