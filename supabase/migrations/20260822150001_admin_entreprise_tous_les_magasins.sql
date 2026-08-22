-- L'administrateur d'entreprise supervise tous les magasins de son entreprise.
--
-- Précision de Julien, 22 août 2026, capture à l'appui : son compte
-- d'administrateur affichait « Vous n'êtes affecté à aucun magasin » et l'écran
-- l'invitait à s'en affecter un depuis /equipe. C'était la lecture inverse de
-- la règle : **il les a tous, par construction**. Rien à s'affecter.
--
-- Le levier est l'affectation elle-même, pas l'affichage. Tout ce que voit un
-- superviseur — ses magasins, son équipe, ses inventaires, sur le site comme
-- dans l'application — se lit dans `store_supervisors`. Rendre l'affectation
-- vraie corrige les écrans d'un seul geste, au lieu d'ajouter partout une
-- condition « ou bien il est administrateur ».
--
-- Deux déclencheurs tiennent l'invariant dans le temps ; ils couvrent tous les
-- chemins existants (création par la console, création depuis une demande de
-- magasin, promotion d'un compte, invitation d'un administrateur qui crée son
-- profil) et ceux qu'on écrira demain.

create or replace function public.sync_company_admin_stores()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if tg_table_name = 'stores' then
    -- Un magasin naît : tous les administrateurs de l'entreprise le supervisent.
    insert into public.store_supervisors (store_id, user_id)
      select new.id, p.id
        from public.profiles p
       where p.company_id = new.company_id and p.is_company_admin
      on conflict do nothing;
  else
    -- Quelqu'un devient administrateur : il prend tous les magasins.
    insert into public.store_supervisors (store_id, user_id)
      select s.id, new.id
        from public.stores s
       where s.company_id = new.company_id
      on conflict do nothing;
  end if;
  return null;
end;
$$;

revoke all on function public.sync_company_admin_stores() from public, anon, authenticated;

drop trigger if exists stores_sync_company_admins on public.stores;
create trigger stores_sync_company_admins
  after insert on public.stores
  for each row execute function public.sync_company_admin_stores();

-- `when` plutôt qu'un `if` dans le corps : le déclencheur ne se réveille pas
-- sur les mises à jour de profil ordinaires (prénom, nom).
drop trigger if exists profiles_sync_company_admin_stores on public.profiles;
create trigger profiles_sync_company_admin_stores
  after insert or update of is_company_admin, company_id on public.profiles
  for each row
  when (new.is_company_admin and new.company_id is not null)
  execute function public.sync_company_admin_stores();

-- Rattrapage de l'existant.
insert into public.store_supervisors (store_id, user_id)
  select s.id, p.id
    from public.profiles p
    join public.stores s on s.company_id = p.company_id
   where p.is_company_admin
  on conflict do nothing;

-- ── Ce que l'invariant interdit désormais ─────────────────────────────────
-- Sans ces deux gardes, l'affectation d'un administrateur se retirerait à la
-- main et l'invariant serait faux sans que rien ne le signale : les
-- déclencheurs ne se réveillent qu'à la création d'un magasin ou à la
-- nomination, jamais pour réparer un retrait.

create or replace function public.ca_set_supervisor_stores(p_user uuid, p_store_ids uuid[])
returns json
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_company uuid;
  v_target  public.profiles%rowtype;
  v_ids     uuid[] := coalesce(p_store_ids, '{}');
  n         int;
begin
  if not public.is_company_admin() then
    return json_build_object('success', false, 'error', 'Accès réservé à l''administrateur de l''entreprise.');
  end if;
  select company_id into v_company from public.profiles where id = auth.uid();

  select * into v_target from public.profiles
   where id = p_user and company_id = v_company and role = 'supervisor';
  if not found then
    return json_build_object('success', false, 'error', 'Superviseur introuvable dans votre entreprise.');
  end if;
  if v_target.is_company_admin then
    return json_build_object('success', false,
      'error', 'Un administrateur d''entreprise est affecté à tous les magasins.');
  end if;

  select count(*) into n from public.stores s where s.id = any(v_ids) and s.company_id = v_company;
  if n <> coalesce(array_length(v_ids, 1), 0) then
    return json_build_object('success', false, 'error', 'Un des magasins n''appartient pas à votre entreprise.');
  end if;

  delete from public.store_supervisors ss
   using public.stores st
   where st.id = ss.store_id and st.company_id = v_company and ss.user_id = p_user;
  insert into public.store_supervisors (store_id, user_id)
    select unnest(v_ids), p_user on conflict do nothing;

  perform public.log_company_action(v_company, 'superviseur_magasins_modifies',
    coalesce(v_target.full_name, ''),
    json_build_object('magasins', coalesce(array_length(v_ids, 1), 0))::jsonb);

  return json_build_object('success', true);
end;
$$;

-- Côté console Quantinvo : même refus, avec la marche à suivre. Retirer d'abord
-- le drapeau d'administrateur rend le compte désaffectable comme un autre.
create or replace function public.admin_unassign_supervisor(p_store_id uuid, p_user_id uuid)
returns json
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_store text; v_who text; v_admin boolean;
begin
  if not public.is_admin() then
    return json_build_object('success', false, 'error', 'Accès refusé');
  end if;
  select name into v_store from public.stores where id = p_store_id;
  select coalesce(nullif(btrim(full_name), ''), ''), is_company_admin
    into v_who, v_admin
    from public.profiles where id = p_user_id;
  if coalesce(v_admin, false) then
    return json_build_object('success', false,
      'error', 'Administrateur d''entreprise : il supervise tous les magasins. Retirez-lui d''abord ce rôle.');
  end if;
  delete from public.store_supervisors where store_id = p_store_id and user_id = p_user_id;
  perform public.log_admin_action('superviseur_retire', 'magasin', p_store_id::text, coalesce(v_store, ''),
    json_build_object('utilisateur', coalesce(v_who, ''), 'user_id', p_user_id::text)::jsonb);
  return json_build_object('success', true);
end;
$$;

revoke all on function public.ca_set_supervisor_stores(uuid, uuid[]) from public, anon;
revoke all on function public.admin_unassign_supervisor(uuid, uuid) from public, anon;
grant execute on function public.ca_set_supervisor_stores(uuid, uuid[]) to authenticated, service_role;
grant execute on function public.admin_unassign_supervisor(uuid, uuid) to authenticated, service_role;
