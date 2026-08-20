-- Administrateur d'entreprise, acte 4 : c'est l'administrateur Quantinvo qui
-- nomme et révoque les administrateurs d'entreprise (décision v1). Les deux
-- fonctions sont journalisées — règle M4 : toute admin_* d'écriture trace,
-- dans la même transaction, sans bloc qui avale les erreurs.

-- Nommer : si un compte de l'entreprise existe déjà pour cette adresse, il
-- est promu (le rattrapage des clients existants tient en un clic) ; sinon
-- une invitation 'company_admin' est écrite, l'e-mail part par l'edge
-- function invite-company-admin.
create or replace function public.admin_invite_company_admin(
  p_company uuid, p_email text, p_first_name text, p_last_name text)
returns json
language plpgsql
security definer
set search_path to 'public', 'auth'
as $$
declare
  v_email  text := lower(btrim(coalesce(p_email, '')));
  v_first  text := btrim(coalesce(p_first_name, ''));
  v_last   text := btrim(coalesce(p_last_name, ''));
  v_uid    uuid;
  v_prof   public.profiles%rowtype;
  v_inv    public.team_invitations%rowtype;
  v_cname  text;
begin
  if not public.is_admin() then
    return json_build_object('success', false, 'error', 'Accès refusé');
  end if;

  select name into v_cname from public.companies where id = p_company;
  if not found then
    return json_build_object('success', false, 'error', 'Entreprise introuvable.');
  end if;
  if v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    return json_build_object('success', false, 'error', 'Adresse e-mail invalide.');
  end if;

  select u.id into v_uid from auth.users u where lower(u.email::text) = v_email;

  if v_uid is not null then
    select * into v_prof from public.profiles where id = v_uid;
    if not found then
      return json_build_object('success', false, 'error', 'Ce compte n''a pas encore de profil.');
    end if;
    if v_prof.company_id is distinct from p_company then
      return json_build_object('success', false, 'error', 'Ce compte appartient à une autre entreprise.');
    end if;
    if v_prof.is_company_admin then
      return json_build_object('success', false, 'error', 'Ce compte est déjà administrateur de l''entreprise.');
    end if;

    -- Promotion : le drapeau, et au besoin la visibilité superviseur — un
    -- administrateur d'entreprise pilote, il ne reste pas simple compteur.
    update public.profiles
       set is_company_admin = true,
           role = case when role = 'employee' then 'supervisor' else role end
     where id = v_uid;

    perform public.log_admin_action('admin_entreprise_promu', 'profil', v_uid::text,
      coalesce(v_prof.full_name, ''),
      json_build_object('email', v_email, 'entreprise', coalesce(v_cname, ''))::jsonb);

    return json_build_object('success', true, 'mode', 'promoted',
      'full_name', coalesce(v_prof.full_name, ''));
  end if;

  if v_first = '' or v_last = '' then
    return json_build_object('success', false, 'error', 'Prénom et nom sont requis.');
  end if;

  select * into v_inv from public.team_invitations where lower(email) = v_email limit 1;
  if v_inv.id is not null and v_inv.company_id is distinct from p_company then
    return json_build_object('success', false, 'error', 'Une invitation existe déjà pour une autre entreprise.');
  end if;

  -- Une invitation de la même entreprise est remplacée : c'est la plus
  -- récente volonté de l'administrateur qui fait foi.
  delete from public.team_invitations where lower(email) = v_email and company_id = p_company;
  insert into public.team_invitations
    (company_id, email, first_name, last_name, full_name, created_by, store_ids, role)
  values
    (p_company, v_email, v_first, v_last, btrim(v_first || ' ' || v_last),
     auth.uid(), '{}', 'company_admin');

  perform public.log_admin_action('admin_entreprise_invite', 'entreprise', p_company::text,
    btrim(v_first || ' ' || v_last),
    json_build_object('email', v_email, 'entreprise', coalesce(v_cname, ''))::jsonb);

  return json_build_object('success', true, 'mode', 'invited',
    'email', v_email, 'first_name', v_first, 'last_name', v_last);
end;
$$;

-- Révoquer : le drapeau tombe, le rôle superviseur (et ses affectations)
-- demeure — retirer aussi les accès magasin est un autre geste, qui existe
-- déjà (admin_unassign_supervisor, ca_remove_supervisor).
create or replace function public.admin_revoke_company_admin(p_user uuid)
returns json
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_prof public.profiles%rowtype;
begin
  if not public.is_admin() then
    return json_build_object('success', false, 'error', 'Accès refusé');
  end if;

  select * into v_prof from public.profiles where id = p_user;
  if not found or not v_prof.is_company_admin then
    return json_build_object('success', false, 'error', 'Ce compte n''est pas administrateur d''entreprise.');
  end if;

  update public.profiles set is_company_admin = false where id = p_user;

  perform public.log_admin_action('admin_entreprise_revoque', 'profil', p_user::text,
    coalesce(v_prof.full_name, ''), '{}'::jsonb);

  return json_build_object('success', true);
end;
$$;

revoke all on function public.admin_invite_company_admin(uuid, text, text, text) from public, anon;
revoke all on function public.admin_revoke_company_admin(uuid) from public, anon;
grant execute on function public.admin_invite_company_admin(uuid, text, text, text) to authenticated, service_role;
grant execute on function public.admin_revoke_company_admin(uuid) to authenticated, service_role;

-- La liste des membres expose le drapeau, pour l'affichage dans /admin.
-- Signature inchangée côté appelant : une colonne s'ajoute, rien ne casse.
drop function if exists public.admin_list_company_members(uuid);
create or replace function public.admin_list_company_members(p_company_id uuid)
returns table(id uuid, full_name text, role text, is_company_admin boolean)
language plpgsql
stable security definer
set search_path to 'public'
as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return query
  select p.id, p.full_name, p.role, p.is_company_admin
  from public.profiles p
  where p.company_id = p_company_id and p.role = 'supervisor'
  order by p.full_name;
end;
$$;

revoke all on function public.admin_list_company_members(uuid) from public, anon;
grant execute on function public.admin_list_company_members(uuid) to authenticated, service_role;
