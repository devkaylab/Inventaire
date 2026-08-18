-- M4 (audit du 13 août 2026) — journal des actions d'administration.
--
-- Constat : création d'entreprise, devis, validation de superviseur,
-- suppression de compte — aucune de ces opérations ne laissait de trace.
-- En cas de contestation ou d'incident, rien ne permettait de dire qui a
-- fait quoi, ni quand.
--
-- Réponse : une table alimentée par les fonctions admin_* elles-mêmes.
-- L'écriture au journal fait partie de la même transaction que l'action :
-- si la trace ne peut pas s'écrire, l'action échoue. Il ne peut donc pas
-- exister d'action d'administration réussie sans trace — c'est volontaire,
-- ne pas entourer log_admin_action d'un bloc qui avale les erreurs.
--
-- Conservation : 1 an (CNIL, délibération 2021-122 : 6 mois, extensible à
-- 1 an ; ANSSI PA-022 : 12 mois pour les journaux de sécurité), purgée par
-- purge_expired_data(). Le journal contient des identités (qui a agi, sur
-- qui) : c'est sa raison d'être, et la durée courte est sa contrepartie.

-- ── La table ────────────────────────────────────────────────────────────

create table public.admin_audit_log (
  -- Numéro croissant plutôt qu'uuid : deux actions d'une même transaction
  -- partagent le même now(), seul un compteur donne un ordre fiable.
  id           bigint generated always as identity primary key,
  actor_id     uuid,                     -- pas de clé étrangère : le journal survit à la suppression du compte
  actor_label  text not null default '', -- nom ou e-mail de l'auteur, figé au moment de l'action
  action       text not null,
  target_type  text not null default '',
  target_id    text not null default '',
  target_label text not null default '', -- libellé de la cible, figé au moment de l'action
  details      jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);

create index admin_audit_log_created_at_idx
  on public.admin_audit_log (created_at desc);

-- Lecture : les administrateurs seulement. Écriture : personne côté client —
-- seules les fonctions SECURITY DEFINER (exécutées en postgres, qui ignore
-- la RLS en tant que propriétaire) insèrent. Aucune policy insert/update/
-- delete : même un jeton volé ne peut ni forger ni effacer une ligne.
alter table public.admin_audit_log enable row level security;

create policy admin_audit_log_select on public.admin_audit_log
  for select to authenticated using (public.is_admin());

revoke all on public.admin_audit_log from anon, authenticated;
grant select on public.admin_audit_log to authenticated;

-- ── L'écriture ──────────────────────────────────────────────────────────

create or replace function public.log_admin_action(
  p_action text,
  p_target_type text,
  p_target_id text,
  p_target_label text,
  p_details jsonb default '{}'::jsonb
) returns void
language plpgsql security definer set search_path to 'public', 'auth'
as $function$
declare v_label text;
begin
  select coalesce(nullif(btrim(pr.full_name), ''), u.email::text, '')
    into v_label
    from auth.users u
    left join public.profiles pr on pr.id = u.id
   where u.id = auth.uid();
  insert into public.admin_audit_log
    (actor_id, actor_label, action, target_type, target_id, target_label, details)
  values
    (auth.uid(), coalesce(v_label, ''), p_action,
     coalesce(p_target_type, ''), coalesce(p_target_id, ''),
     coalesce(p_target_label, ''), coalesce(p_details, '{}'::jsonb));
end; $function$;

-- Interne aux fonctions admin_* : aucun client ne l'appelle directement.
revoke execute on function public.log_admin_action(text, text, text, text, jsonb)
  from public, anon, authenticated;

-- ── La lecture (onglet Journal de /admin) ───────────────────────────────

create or replace function public.admin_list_audit_log(p_limit int default 200)
returns table(
  id bigint, actor_label text, action text, target_type text,
  target_id text, target_label text, details jsonb, created_at timestamptz
)
language plpgsql stable security definer set search_path to 'public'
as $function$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return query
    select j.id, j.actor_label, j.action, j.target_type,
           j.target_id, j.target_label, j.details, j.created_at
      from public.admin_audit_log j
     order by j.id desc
     limit least(greatest(coalesce(p_limit, 200), 1), 1000);
end; $function$;

-- ── Les fonctions instrumentées ─────────────────────────────────────────
-- Corps repris de la base live à l'identique ; seul l'appel au journal
-- (et la capture des libellés avant suppression) est ajouté.

create or replace function public.admin_create_company(p_name text)
returns json
language plpgsql security definer set search_path to 'public'
as $function$
declare v_id uuid; v_code text;
begin
  if not public.is_admin() then return json_build_object('success', false, 'error', 'Accès refusé'); end if;
  if coalesce(trim(p_name), '') = '' then return json_build_object('success', false, 'error', 'Nom requis'); end if;
  v_code := public.gen_company_code();
  insert into public.companies (name, join_code) values (trim(p_name), v_code) returning id into v_id;
  perform public.log_admin_action('entreprise_creee', 'entreprise', v_id::text, trim(p_name));
  return json_build_object('success', true, 'company_id', v_id::text, 'name', trim(p_name), 'join_code', v_code);
end; $function$;

create or replace function public.admin_add_store(p_company_id uuid, p_name text)
returns json
language plpgsql security definer set search_path to 'public'
as $function$
declare v_id uuid; v_code text; v_company text;
begin
  if not public.is_admin() then return json_build_object('success', false, 'error', 'Accès refusé'); end if;
  if coalesce(trim(p_name), '') = '' then return json_build_object('success', false, 'error', 'Nom requis'); end if;
  select name into v_company from public.companies where id = p_company_id;
  if v_company is null then
    return json_build_object('success', false, 'error', 'Entreprise introuvable'); end if;
  v_code := public.gen_store_code();
  insert into public.stores (company_id, name, join_code)
    values (p_company_id, trim(p_name), v_code) returning id into v_id;
  perform public.log_admin_action('magasin_ajoute', 'magasin', v_id::text, trim(p_name),
    json_build_object('entreprise', v_company)::jsonb);
  return json_build_object('success', true, 'store_id', v_id::text, 'name', trim(p_name), 'join_code', v_code);
end; $function$;

create or replace function public.admin_delete_company(p_company_id uuid)
returns json
language plpgsql security definer set search_path to 'public'
as $function$
declare v_name text;
begin
  if not public.is_admin() then return json_build_object('success', false, 'error', 'Accès refusé'); end if;
  select name into v_name from public.companies where id = p_company_id;
  delete from public.inventory_sessions where company_id = p_company_id;   -- cascade enfants
  delete from public.team_invitations where company_id = p_company_id;
  update public.profiles set company_id = null where company_id = p_company_id;
  delete from public.companies where id = p_company_id;                    -- stores en cascade
  perform public.log_admin_action('entreprise_supprimee', 'entreprise', p_company_id::text, coalesce(v_name, ''));
  return json_build_object('success', true);
end; $function$;

create or replace function public.admin_delete_store(p_store_id uuid)
returns json
language plpgsql security definer set search_path to 'public'
as $function$
declare v_name text; v_company text;
begin
  if not public.is_admin() then return json_build_object('success', false, 'error', 'Accès refusé'); end if;
  select s.name, c.name into v_name, v_company
    from public.stores s left join public.companies c on c.id = s.company_id
   where s.id = p_store_id;
  delete from public.stores where id = p_store_id;
  perform public.log_admin_action('magasin_supprime', 'magasin', p_store_id::text, coalesce(v_name, ''),
    json_build_object('entreprise', coalesce(v_company, ''))::jsonb);
  return json_build_object('success', true);
end; $function$;

create or replace function public.admin_delete_user(p_user_id uuid)
returns json
language plpgsql security definer set search_path to 'public', 'auth'
as $function$
declare v_label text;
begin
  if not public.is_admin() then return json_build_object('success', false, 'error', 'Accès refusé'); end if;
  if p_user_id is null then return json_build_object('success', false, 'error', 'Utilisateur requis'); end if;

  -- Identité figée avant la suppression : après, elle n'existe plus.
  select coalesce(nullif(btrim(pr.full_name), ''), u.email::text, '')
    into v_label
    from auth.users u left join public.profiles pr on pr.id = u.id
   where u.id = p_user_id;

  update public.counts set counted_by = null where counted_by = p_user_id;
  update public.inventory_sessions set created_by = null where created_by = p_user_id;
  update public.team_invitations set created_by = null where created_by = p_user_id;
  update public.article_audit set resolved_by = null where resolved_by = p_user_id;

  -- Supprime le compte (cascade : profil, session_members, demande de suppression).
  delete from auth.users where id = p_user_id;
  perform public.log_admin_action('compte_supprime', 'utilisateur', p_user_id::text, coalesce(v_label, ''));
  return json_build_object('success', true);
end; $function$;

create or replace function public.admin_assign_supervisor(p_store_id uuid, p_user_id uuid)
returns json
language plpgsql security definer set search_path to 'public'
as $function$
declare v_company uuid; v_store text; v_who text;
begin
  if not public.is_admin() then
    return json_build_object('success', false, 'error', 'Accès refusé');
  end if;
  select company_id, name into v_company, v_store from public.stores where id = p_store_id;
  if v_company is null then
    return json_build_object('success', false, 'error', 'Magasin introuvable');
  end if;
  if not exists (select 1 from public.profiles p
                 where p.id = p_user_id and p.company_id = v_company and p.role = 'supervisor') then
    return json_build_object('success', false, 'error', 'Superviseur invalide pour cette entreprise');
  end if;
  select coalesce(nullif(btrim(full_name), ''), '') into v_who from public.profiles where id = p_user_id;
  insert into public.store_supervisors (store_id, user_id)
  values (p_store_id, p_user_id)
  on conflict (store_id, user_id) do nothing;
  perform public.log_admin_action('superviseur_affecte', 'magasin', p_store_id::text, coalesce(v_store, ''),
    json_build_object('utilisateur', coalesce(v_who, ''), 'user_id', p_user_id::text)::jsonb);
  return json_build_object('success', true);
end; $function$;

create or replace function public.admin_unassign_supervisor(p_store_id uuid, p_user_id uuid)
returns json
language plpgsql security definer set search_path to 'public'
as $function$
declare v_store text; v_who text;
begin
  if not public.is_admin() then
    return json_build_object('success', false, 'error', 'Accès refusé');
  end if;
  select name into v_store from public.stores where id = p_store_id;
  select coalesce(nullif(btrim(full_name), ''), '') into v_who from public.profiles where id = p_user_id;
  delete from public.store_supervisors where store_id = p_store_id and user_id = p_user_id;
  perform public.log_admin_action('superviseur_retire', 'magasin', p_store_id::text, coalesce(v_store, ''),
    json_build_object('utilisateur', coalesce(v_who, ''), 'user_id', p_user_id::text)::jsonb);
  return json_build_object('success', true);
end; $function$;

create or replace function public.admin_review_supervisor_request(p_id uuid, p_approve boolean, p_note text default ''::text)
returns json
language plpgsql security definer set search_path to 'public'
as $function$
declare v_req public.supervisor_requests%rowtype;
begin
  if not public.is_admin() then return json_build_object('success', false, 'error', 'Accès refusé'); end if;
  select * into v_req from public.supervisor_requests where id = p_id;
  if not found then return json_build_object('success', false, 'error', 'Demande introuvable'); end if;
  if v_req.status <> 'pending' then
    return json_build_object('success', false, 'error', 'Demande déjà traitée');
  end if;
  update public.supervisor_requests
     set status = case when p_approve then 'approved' else 'rejected' end,
         admin_note = coalesce(nullif(btrim(p_note), ''), admin_note),
         reviewed_by = auth.uid(), reviewed_at = now()
   where id = p_id;
  perform public.log_admin_action(
    case when p_approve then 'demande_superviseur_validee' else 'demande_superviseur_refusee' end,
    'demande_superviseur', p_id::text,
    btrim(coalesce(v_req.first_name, '') || ' ' || coalesce(v_req.last_name, '')),
    json_build_object('email', coalesce(v_req.email, ''))::jsonb);
  return json_build_object('success', true, 'email', v_req.email,
    'first_name', v_req.first_name, 'last_name', v_req.last_name,
    'store_id', v_req.store_id::text, 'company_id', v_req.company_id::text);
end; $function$;

create or replace function public.admin_quote_company_request(p_id uuid, p_reference text, p_amount_cents bigint, p_note text default ''::text)
returns json
language plpgsql security definer set search_path to 'public'
as $function$
declare v_name text;
begin
  if not public.is_admin() then return json_build_object('success', false, 'error', 'Accès refusé'); end if;
  if p_amount_cents is null or p_amount_cents < 0 then
    return json_build_object('success', false, 'error', 'Montant invalide');
  end if;
  update public.company_requests
     set status = 'quoted', quote_reference = coalesce(btrim(p_reference), ''),
         quote_amount_cents = p_amount_cents, quote_sent_at = now(),
         admin_note = coalesce(btrim(p_note), admin_note), updated_at = now()
   where id = p_id and status in ('pending','quoted');
  if not found then return json_build_object('success', false, 'error', 'Demande introuvable ou déjà traitée'); end if;
  select company_name into v_name from public.company_requests where id = p_id;
  perform public.log_admin_action('devis_envoye', 'demande_entreprise', p_id::text, coalesce(v_name, ''),
    json_build_object('reference', coalesce(btrim(p_reference), ''), 'montant_cents', p_amount_cents)::jsonb);
  return json_build_object('success', true);
end; $function$;

create or replace function public.admin_set_company_request_status(p_id uuid, p_status text, p_note text default ''::text)
returns json
language plpgsql security definer set search_path to 'public'
as $function$
declare v_allowed_from text[]; v_name text;
begin
  if not public.is_admin() then return json_build_object('success', false, 'error', 'Accès refusé'); end if;
  v_allowed_from := case p_status
    when 'accepted' then array['quoted']
    when 'paid'     then array['accepted']
    when 'rejected' then array['pending','quoted','accepted','paid']
    else null end;
  if v_allowed_from is null then
    return json_build_object('success', false, 'error', 'Statut invalide');
  end if;
  update public.company_requests
     set status = p_status,
         accepted_at = case when p_status = 'accepted' then now() else accepted_at end,
         paid_at     = case when p_status = 'paid'     then now() else paid_at end,
         admin_note  = coalesce(nullif(btrim(p_note), ''), admin_note),
         updated_at  = now()
   where id = p_id and status = any(v_allowed_from);
  if not found then
    return json_build_object('success', false, 'error', 'Transition impossible depuis le statut actuel');
  end if;
  select company_name into v_name from public.company_requests where id = p_id;
  perform public.log_admin_action('statut_demande_entreprise', 'demande_entreprise', p_id::text, coalesce(v_name, ''),
    json_build_object('statut', p_status)::jsonb);
  return json_build_object('success', true);
end; $function$;

create or replace function public.admin_fulfil_company_request(p_id uuid, p_store_names text[] default null::text[])
returns json
language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_req public.company_requests%rowtype;
  v_company_id uuid; v_company_code text; v_store_code text;
  v_name text; v_i int; v_stores json[] := '{}';
begin
  if not public.is_admin() then return json_build_object('success', false, 'error', 'Accès refusé'); end if;
  select * into v_req from public.company_requests where id = p_id;
  if not found then return json_build_object('success', false, 'error', 'Demande introuvable'); end if;
  if v_req.status <> 'paid' then
    return json_build_object('success', false,
      'error', 'L''entreprise ne peut être créée qu''après encaissement de la facture.');
  end if;
  v_company_code := public.gen_company_code();
  insert into public.companies (name, join_code) values (v_req.company_name, v_company_code)
    returning id into v_company_id;
  for v_i in 1..v_req.store_count loop
    v_name := coalesce(nullif(btrim(p_store_names[v_i]), ''), 'Magasin ' || v_i);
    v_store_code := public.gen_store_code();
    insert into public.stores (company_id, name, join_code)
      values (v_company_id, v_name, v_store_code);
    v_stores := v_stores || json_build_object('name', v_name, 'join_code', v_store_code);
  end loop;
  update public.company_requests
     set status = 'created', company_id = v_company_id, updated_at = now() where id = p_id;
  perform public.log_admin_action('entreprise_creee_depuis_demande', 'entreprise', v_company_id::text,
    coalesce(v_req.company_name, ''),
    json_build_object('demande_id', p_id::text, 'magasins', v_req.store_count)::jsonb);
  return json_build_object('success', true, 'company_id', v_company_id::text,
    'company_code', v_company_code, 'stores', array_to_json(v_stores));
end; $function$;

-- ── La purge ────────────────────────────────────────────────────────────
-- Corps repris de 20260818000001 à l'identique, plus le journal (1 an).

create or replace function public.purge_expired_data()
returns jsonb
language plpgsql security definer set search_path to 'public'
as $function$
declare
  invitations_ttl      constant interval := interval '3 months';
  demandes_sup_ttl     constant interval := interval '1 year';
  demandes_ent_rej_ttl constant interval := interval '1 year';
  demandes_ent_ttl     constant interval := interval '3 years';
  suppressions_ttl     constant interval := interval '1 year';
  journal_admin_ttl    constant interval := interval '1 year';
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

  return rapport || jsonb_build_object('execute_le', now());
end;
$function$;
