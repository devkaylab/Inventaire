-- Un superviseur est obligatoirement rattaché à une entreprise et à au moins
-- un magasin (règle posée par Julien le 23 août 2026).
--
-- L'entreprise était déjà garantie : `handle_new_user` reprend le company_id
-- de l'invitation. Le magasin, lui, ne l'était pas — trois chemins menaient à
-- un superviseur sans magasin, donc à quelqu'un qui se connecte, ne voit rien
-- et ne peut rien créer :
--
--   1. `ca_invite_supervisor` : `p_store_ids uuid[] default '{}'`, et le seul
--      contrôle vérifiait l'appartenance des magasins à l'entreprise — une
--      liste vide passait ;
--   2. `ca_set_supervisor_stores` : supprime puis réinsère ; tout décocher sur
--      /equipe laissait zéro magasin ;
--   3. `admin_unassign_supervisor` (console Quantinvo) : retirait le dernier
--      magasin sans rien dire.
--
-- Les trois refusent désormais. Rien d'autre ne change dans leur corps.
--
-- ⚠️ L'administrateur d'entreprise reste hors de cette règle : il supervise
-- tous les magasins par construction (migration 20260822150001), et les deux
-- fonctions qui le concernent le refusaient déjà nommément.

create or replace function public.ca_invite_supervisor(
  p_email text, p_first_name text, p_last_name text, p_store_ids uuid[] default '{}')
returns json
language plpgsql
security definer
set search_path to 'public', 'auth'
as $$
declare
  v_company uuid;
  v_email   text := lower(btrim(coalesce(p_email, '')));
  v_first   text := btrim(coalesce(p_first_name, ''));
  v_last    text := btrim(coalesce(p_last_name, ''));
  v_ids     uuid[] := coalesce(p_store_ids, '{}');
  n         int;
begin
  if not public.is_company_admin() then
    return json_build_object('success', false, 'error', 'Accès réservé à l''administrateur de l''entreprise.');
  end if;
  select company_id into v_company from public.profiles where id = auth.uid();

  if v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    return json_build_object('success', false, 'error', 'Adresse e-mail invalide.');
  end if;
  if v_first = '' or v_last = '' then
    return json_build_object('success', false, 'error', 'Prénom et nom sont requis.');
  end if;
  if exists (select 1 from auth.users u where lower(u.email::text) = v_email) then
    return json_build_object('success', false, 'error', 'Un compte existe déjà pour cette adresse.');
  end if;
  if exists (select 1 from public.team_invitations i where lower(i.email) = v_email) then
    return json_build_object('success', false, 'error', 'Une invitation est déjà en cours pour cette adresse.');
  end if;
  if exists (select 1 from public.supervisor_requests r
              where lower(r.email) = v_email and r.status in ('pending', 'approved')) then
    return json_build_object('success', false, 'error', 'Une demande est déjà en cours pour cette adresse.');
  end if;

  -- La garde. Un superviseur sans magasin ne verrait ni équipe, ni inventaire.
  if coalesce(array_length(v_ids, 1), 0) = 0 then
    return json_build_object('success', false,
      'error', 'Choisissez au moins un magasin : un superviseur y est toujours rattaché.');
  end if;

  select count(*) into n from public.stores s where s.id = any(v_ids) and s.company_id = v_company;
  if n <> coalesce(array_length(v_ids, 1), 0) then
    return json_build_object('success', false, 'error', 'Un des magasins n''appartient pas à votre entreprise.');
  end if;

  insert into public.team_invitations
    (company_id, email, first_name, last_name, full_name, created_by, store_ids, role)
  values
    (v_company, v_email, v_first, v_last, btrim(v_first || ' ' || v_last),
     auth.uid(), v_ids, 'supervisor');

  perform public.log_company_action(v_company, 'superviseur_invite',
    btrim(v_first || ' ' || v_last),
    json_build_object('email', v_email, 'magasins', coalesce(array_length(v_ids, 1), 0))::jsonb);

  return json_build_object('success', true, 'email', v_email,
    'first_name', v_first, 'last_name', v_last);
end;
$$;

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

  -- La garde. Pour détacher quelqu'un, on lui retire le rôle de superviseur —
  -- on ne le laisse pas superviseur de rien.
  if coalesce(array_length(v_ids, 1), 0) = 0 then
    return json_build_object('success', false,
      'error', 'Un superviseur garde au moins un magasin. Pour lui retirer tout accès, retirez-lui le rôle.');
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

create or replace function public.admin_unassign_supervisor(p_store_id uuid, p_user_id uuid)
returns json
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_store text; v_who text; v_admin boolean; v_restants int;
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

  -- La garde : retirer le dernier magasin laisserait un superviseur de rien.
  select count(*) into v_restants
    from public.store_supervisors
   where user_id = p_user_id and store_id <> p_store_id;
  if v_restants = 0 then
    return json_build_object('success', false,
      'error', 'C''est son dernier magasin : un superviseur y est toujours rattaché. Affectez-le ailleurs d''abord, ou changez son rôle.');
  end if;

  delete from public.store_supervisors where store_id = p_store_id and user_id = p_user_id;
  perform public.log_admin_action('superviseur_retire', 'magasin', p_store_id::text, coalesce(v_store, ''),
    json_build_object('utilisateur', coalesce(v_who, ''), 'user_id', p_user_id::text)::jsonb);
  return json_build_object('success', true);
end;
$$;

revoke all on function public.ca_invite_supervisor(text, text, text, uuid[]) from public, anon;
revoke all on function public.ca_set_supervisor_stores(uuid, uuid[]) from public, anon;
revoke all on function public.admin_unassign_supervisor(uuid, uuid) from public, anon;
