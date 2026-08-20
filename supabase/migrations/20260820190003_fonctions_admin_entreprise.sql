-- Administrateur d'entreprise, acte 3 : son journal et ses fonctions.
--
-- Mêmes règles que le journal d'administration Quantinvo (M4 du 18 août) :
-- la trace s'écrit dans la même transaction que l'action — une action qui ne
-- peut pas se journaliser échoue —, les libellés sont figés au moment de
-- l'action, et aucune écriture ne passe par le client.

create table public.company_audit_log (
  id           bigint generated always as identity primary key,
  company_id   uuid not null references public.companies(id) on delete cascade,
  created_at   timestamptz not null default now(),
  actor_id     uuid,
  actor_label  text not null default '',
  action       text not null,
  target_label text not null default '',
  details      jsonb not null default '{}'::jsonb
);

alter table public.company_audit_log enable row level security;

-- Lecture : les administrateurs de l'entreprise, et l'administrateur
-- Quantinvo. Aucune policy d'écriture : seule log_company_action écrit.
create policy company_audit_log_select on public.company_audit_log
  for select using (public.is_admin() or public.is_company_admin(company_id));

create or replace function public.log_company_action(
  p_company uuid, p_action text, p_target_label text, p_details jsonb default '{}'::jsonb)
returns void
language plpgsql
security definer
set search_path to 'public', 'auth'
as $$
declare v_label text;
begin
  select coalesce(nullif(btrim(pr.full_name), ''), u.email::text, '')
    into v_label
    from auth.users u
    left join public.profiles pr on pr.id = u.id
   where u.id = auth.uid();
  insert into public.company_audit_log
    (company_id, actor_id, actor_label, action, target_label, details)
  values
    (p_company, auth.uid(), coalesce(v_label, ''), p_action,
     coalesce(p_target_label, ''), coalesce(p_details, '{}'::jsonb));
end;
$$;

revoke all on function public.log_company_action(uuid, text, text, jsonb) from public, anon, authenticated;

-- ── L'équipe, vue par son administrateur ─────────────────────────────────
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

-- ── Inviter un superviseur ───────────────────────────────────────────────
-- Écrit l'invitation ; l'e-mail part par l'edge function ca-invite-supervisor.
-- Les messages sont explicites : c'est un espace authentifié et journalisé,
-- pas un formulaire public — l'anti-oracle de /superviseur ne s'applique pas.
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

-- ── Réaffecter les magasins d'un superviseur ─────────────────────────────
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

-- ── Retirer les accès d'un superviseur ───────────────────────────────────
-- Retire les affectations (magasins, équipes) ; le compte demeure — sa
-- suppression complète reste chez Quantinvo (admin_delete_user) ou dans la
-- main de la personne (demande de suppression).
create or replace function public.ca_remove_supervisor(p_user uuid)
returns json
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_company uuid;
  v_target  public.profiles%rowtype;
begin
  if not public.is_company_admin() then
    return json_build_object('success', false, 'error', 'Accès réservé à l''administrateur de l''entreprise.');
  end if;
  if p_user = auth.uid() then
    return json_build_object('success', false, 'error', 'Vous ne pouvez pas retirer vos propres accès.');
  end if;
  select company_id into v_company from public.profiles where id = auth.uid();

  select * into v_target from public.profiles
   where id = p_user and company_id = v_company;
  if not found then
    return json_build_object('success', false, 'error', 'Personne introuvable dans votre entreprise.');
  end if;
  if v_target.is_company_admin then
    return json_build_object('success', false, 'error', 'Cet accès administrateur est géré par Quantinvo.');
  end if;

  delete from public.store_supervisors ss
   using public.stores st
   where st.id = ss.store_id and st.company_id = v_company and ss.user_id = p_user;
  delete from public.store_team stm
   using public.stores st
   where st.id = stm.store_id and st.company_id = v_company and stm.user_id = p_user;

  perform public.log_company_action(v_company, 'acces_retires',
    coalesce(v_target.full_name, ''), '{}'::jsonb);

  return json_build_object('success', true);
end;
$$;

-- ── Annuler une invitation en cours ──────────────────────────────────────
create or replace function public.ca_cancel_invitation(p_id uuid)
returns json
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_company uuid;
  v_inv     public.team_invitations%rowtype;
begin
  if not public.is_company_admin() then
    return json_build_object('success', false, 'error', 'Accès réservé à l''administrateur de l''entreprise.');
  end if;
  select company_id into v_company from public.profiles where id = auth.uid();

  delete from public.team_invitations
   where id = p_id and company_id = v_company
  returning * into v_inv;
  if not found then
    return json_build_object('success', false, 'error', 'Invitation introuvable.');
  end if;

  perform public.log_company_action(v_company, 'invitation_annulee',
    btrim(coalesce(v_inv.first_name, '') || ' ' || coalesce(v_inv.last_name, '')),
    json_build_object('email', coalesce(v_inv.email, ''), 'role', v_inv.role)::jsonb);

  return json_build_object('success', true);
end;
$$;

-- Droits : exécution par les comptes authentifiés (la garde est dans chaque
-- fonction), jamais par anon.
revoke all on function public.ca_list_team() from public, anon;
revoke all on function public.ca_invite_supervisor(text, text, text, uuid[]) from public, anon;
revoke all on function public.ca_set_supervisor_stores(uuid, uuid[]) from public, anon;
revoke all on function public.ca_remove_supervisor(uuid) from public, anon;
revoke all on function public.ca_cancel_invitation(uuid) from public, anon;
grant execute on function public.ca_list_team() to authenticated, service_role;
grant execute on function public.ca_invite_supervisor(text, text, text, uuid[]) to authenticated, service_role;
grant execute on function public.ca_set_supervisor_stores(uuid, uuid[]) to authenticated, service_role;
grant execute on function public.ca_remove_supervisor(uuid) to authenticated, service_role;
grant execute on function public.ca_cancel_invitation(uuid) to authenticated, service_role;

-- ── Purge : le journal d'entreprise suit la même durée que le journal
-- d'administration (1 an). create or replace → droits reposés ensuite.
create or replace function public.purge_expired_data()
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  invitations_ttl      constant interval := interval '3 months';
  demandes_sup_ttl     constant interval := interval '1 year';
  demandes_ent_rej_ttl constant interval := interval '1 year';
  demandes_ent_ttl     constant interval := interval '3 years';
  suppressions_ttl     constant interval := interval '1 year';
  journal_admin_ttl    constant interval := interval '1 year';
  journal_entrep_ttl   constant interval := interval '1 year';
  rapport              jsonb := '{}'::jsonb;
  n                    int;
begin
  delete from public.team_invitations where created_at < now() - invitations_ttl;
  get diagnostics n = row_count;  rapport := rapport || jsonb_build_object('team_invitations_supprimees', n);

  delete from public.session_invitations where created_at < now() - invitations_ttl;
  get diagnostics n = row_count;  rapport := rapport || jsonb_build_object('session_invitations_supprimees', n);

  update public.supervisor_requests
     set first_name = '', last_name = '',
         email = 'expire+' || id::text || '@invalide.local', phone = ''
   where status in ('active', 'rejected')
     and created_at < now() - demandes_sup_ttl
     and email not like 'expire+%';
  get diagnostics n = row_count;  rapport := rapport || jsonb_build_object('supervisor_requests_anonymisees', n);

  delete from public.company_requests
   where status = 'rejected' and updated_at < now() - demandes_ent_rej_ttl;
  get diagnostics n = row_count;  rapport := rapport || jsonb_build_object('company_requests_supprimees', n);

  update public.company_requests
     set contact_first_name = '', contact_last_name = '',
         contact_email = 'expire+' || id::text || '@invalide.local', contact_phone = ''
   where updated_at < now() - demandes_ent_ttl
     and contact_email not like 'expire+%';
  get diagnostics n = row_count;  rapport := rapport || jsonb_build_object('company_requests_anonymisees', n);

  delete from public.account_deletion_requests where created_at < now() - suppressions_ttl;
  get diagnostics n = row_count;  rapport := rapport || jsonb_build_object('deletion_requests_supprimees', n);

  delete from public.admin_audit_log where created_at < now() - journal_admin_ttl;
  get diagnostics n = row_count;  rapport := rapport || jsonb_build_object('journal_admin_supprime', n);

  delete from public.company_audit_log where created_at < now() - journal_entrep_ttl;
  get diagnostics n = row_count;  rapport := rapport || jsonb_build_object('journal_entreprise_supprime', n);

  return rapport || jsonb_build_object('execute_le', now());
end;
$$;

revoke all on function public.purge_expired_data() from public, anon, authenticated;
grant execute on function public.purge_expired_data() to service_role;
