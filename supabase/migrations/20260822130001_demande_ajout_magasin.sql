-- Demander l'ajout d'un magasin (22 août 2026, demande de Julien).
--
-- Un client ouvre un magasin. Jusqu'ici il n'avait aucun moyen de le dire
-- depuis le produit : seul Quantinvo crée un magasin (`admin_add_store`,
-- gardée par `is_admin()`), parce que **la licence se facture par magasin**.
-- Il fallait donc téléphoner ou écrire.
--
-- Ce parcours ne change rien à cette règle, et c'est le point important : la
-- demande **ne crée aucun magasin**. Elle inscrit un signal dans la console
-- Quantinvo, qui reste seule à créer — le devis et l'encaissement demeurent une
-- conversation, comme pour une nouvelle entreprise.

create table if not exists public.store_requests (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references public.companies(id) on delete cascade,
  store_name      text not null,
  message         text not null default '',
  status          text not null default 'pending'
                    check (status in ('pending', 'created', 'rejected')),
  requested_by    uuid references public.profiles(id) on delete set null,
  -- Le nom du demandeur est figé : la demande doit rester lisible même si la
  -- personne quitte l'entreprise entre-temps.
  requested_label text not null default '',
  admin_note      text not null default '',
  store_id        uuid references public.stores(id) on delete set null,
  created_at      timestamptz not null default now(),
  handled_at      timestamptz
);

create index if not exists store_requests_company_idx on public.store_requests (company_id, status);
create index if not exists store_requests_pending_idx on public.store_requests (status, created_at desc);

alter table public.store_requests enable row level security;

-- Lecture seule, et pour les seuls concernés. Aucune policy d'écriture : tout
-- passe par les fonctions ci-dessous, qui portent les contrôles.
drop policy if exists store_requests_select on public.store_requests;
create policy store_requests_select on public.store_requests
  for select using (public.is_admin() or public.is_company_admin(company_id));

-- ── Côté entreprise ───────────────────────────────────────────────────────

create or replace function public.ca_request_store(p_name text, p_message text default '')
returns json
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_company uuid;
  v_name    text := btrim(coalesce(p_name, ''));
  v_msg     text := left(btrim(coalesce(p_message, '')), 500);
  v_label   text;
  v_id      uuid;
begin
  if not public.is_company_admin() then
    return json_build_object('success', false, 'error', 'Accès réservé à l''administrateur de l''entreprise.');
  end if;
  select company_id into v_company from public.profiles where id = auth.uid();

  if v_name = '' then
    return json_build_object('success', false, 'error', 'Le nom du magasin est requis.');
  end if;
  if length(v_name) > 80 then
    return json_build_object('success', false, 'error', 'Le nom du magasin est trop long.');
  end if;
  -- Les deux doublons possibles, dits à la saisie plutôt que découverts par
  -- Quantinvo trois demandes plus tard.
  if exists (select 1 from public.stores s
              where s.company_id = v_company and lower(s.name) = lower(v_name)) then
    return json_build_object('success', false, 'error', 'Un magasin porte déjà ce nom dans votre entreprise.');
  end if;
  if exists (select 1 from public.store_requests r
              where r.company_id = v_company and r.status = 'pending'
                and lower(r.store_name) = lower(v_name)) then
    return json_build_object('success', false, 'error', 'Une demande est déjà en cours pour ce magasin.');
  end if;

  select coalesce(nullif(btrim(full_name), ''), '') into v_label
    from public.profiles where id = auth.uid();

  insert into public.store_requests (company_id, store_name, message, requested_by, requested_label)
  values (v_company, v_name, v_msg, auth.uid(), coalesce(v_label, ''))
  returning id into v_id;

  perform public.log_company_action(v_company, 'magasin_demande', v_name,
    json_build_object('message', v_msg)::jsonb);

  return json_build_object('success', true, 'id', v_id::text, 'store_name', v_name);
end;
$$;

create or replace function public.ca_list_store_requests()
returns json
language plpgsql
stable security definer
set search_path to 'public'
as $$
declare v_company uuid;
begin
  if not public.is_company_admin() then
    raise exception 'Accès réservé à l''administrateur de l''entreprise.';
  end if;
  select company_id into v_company from public.profiles where id = auth.uid();

  return (
    select coalesce(json_agg(json_build_object(
             'id', r.id,
             'store_name', r.store_name,
             'message', r.message,
             'status', r.status,
             'requested_label', r.requested_label,
             'admin_note', r.admin_note,
             'created_at', r.created_at,
             'handled_at', r.handled_at
           ) order by r.created_at desc), '[]'::json)
      from public.store_requests r
     where r.company_id = v_company
       and (r.status = 'pending' or r.handled_at > now() - interval '30 days'));
end;
$$;

create or replace function public.ca_cancel_store_request(p_id uuid)
returns json
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_company uuid; v_req public.store_requests%rowtype;
begin
  if not public.is_company_admin() then
    return json_build_object('success', false, 'error', 'Accès réservé à l''administrateur de l''entreprise.');
  end if;
  select company_id into v_company from public.profiles where id = auth.uid();

  -- Seule une demande encore en attente s'annule : une demande déjà traitée
  -- est une trace, pas un brouillon.
  delete from public.store_requests
   where id = p_id and company_id = v_company and status = 'pending'
  returning * into v_req;
  if not found then
    return json_build_object('success', false, 'error', 'Demande introuvable ou déjà traitée.');
  end if;

  perform public.log_company_action(v_company, 'magasin_demande_annulee', v_req.store_name);
  return json_build_object('success', true);
end;
$$;

-- ── Côté Quantinvo ────────────────────────────────────────────────────────

create or replace function public.admin_list_store_requests()
returns json
language plpgsql
stable security definer
set search_path to 'public'
as $$
begin
  if not public.is_admin() then
    raise exception 'Accès refusé';
  end if;
  return (
    select coalesce(json_agg(json_build_object(
             'id', r.id,
             'company_id', r.company_id,
             'company_name', c.name,
             'store_name', r.store_name,
             'message', r.message,
             'status', r.status,
             'requested_label', r.requested_label,
             'admin_note', r.admin_note,
             'created_at', r.created_at,
             'handled_at', r.handled_at
           ) order by (r.status = 'pending') desc, r.created_at desc), '[]'::json)
      from public.store_requests r
      join public.companies c on c.id = r.company_id
     where r.status = 'pending' or r.handled_at > now() - interval '90 days');
end;
$$;

-- Créer le magasin demandé — exactement ce que fait le formulaire d'à côté.
-- On réutilise `admin_add_store` plutôt que de recopier la génération du code :
-- deux chemins de création divergeraient un jour.
create or replace function public.admin_fulfil_store_request(p_id uuid)
returns json
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_req public.store_requests%rowtype; v_res json;
begin
  if not public.is_admin() then
    return json_build_object('success', false, 'error', 'Accès refusé');
  end if;
  select * into v_req from public.store_requests where id = p_id;
  if not found then
    return json_build_object('success', false, 'error', 'Demande introuvable');
  end if;
  if v_req.status <> 'pending' then
    return json_build_object('success', false, 'error', 'Cette demande a déjà été traitée.');
  end if;

  v_res := public.admin_add_store(v_req.company_id, v_req.store_name);
  if not coalesce((v_res ->> 'success')::boolean, false) then
    return v_res;
  end if;

  update public.store_requests
     set status = 'created', handled_at = now(), store_id = (v_res ->> 'store_id')::uuid
   where id = p_id;

  perform public.log_admin_action('demande_magasin_creee', 'entreprise', v_req.company_id::text,
    v_req.store_name, json_build_object('magasin', v_res ->> 'store_id')::jsonb);

  return v_res;
end;
$$;

create or replace function public.admin_reject_store_request(p_id uuid, p_note text default '')
returns json
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_req public.store_requests%rowtype; v_note text := left(btrim(coalesce(p_note, '')), 500);
begin
  if not public.is_admin() then
    return json_build_object('success', false, 'error', 'Accès refusé');
  end if;
  update public.store_requests
     set status = 'rejected', handled_at = now(), admin_note = v_note
   where id = p_id and status = 'pending'
  returning * into v_req;
  if not found then
    return json_build_object('success', false, 'error', 'Demande introuvable ou déjà traitée.');
  end if;

  perform public.log_admin_action('demande_magasin_refusee', 'entreprise', v_req.company_id::text,
    v_req.store_name, json_build_object('note', v_note)::jsonb);

  return json_build_object('success', true);
end;
$$;

-- Droits : la garde est dans chaque fonction, jamais dans le GRANT.
revoke all on function public.ca_request_store(text, text) from public, anon;
revoke all on function public.ca_list_store_requests() from public, anon;
revoke all on function public.ca_cancel_store_request(uuid) from public, anon;
revoke all on function public.admin_list_store_requests() from public, anon;
revoke all on function public.admin_fulfil_store_request(uuid) from public, anon;
revoke all on function public.admin_reject_store_request(uuid, text) from public, anon;
grant execute on function public.ca_request_store(text, text) to authenticated, service_role;
grant execute on function public.ca_list_store_requests() to authenticated, service_role;
grant execute on function public.ca_cancel_store_request(uuid) to authenticated, service_role;
grant execute on function public.admin_list_store_requests() to authenticated, service_role;
grant execute on function public.admin_fulfil_store_request(uuid) to authenticated, service_role;
grant execute on function public.admin_reject_store_request(uuid, text) to authenticated, service_role;

-- ── Conservation ──────────────────────────────────────────────────────────
-- Les durées vivent en un seul point. Une demande traitée porte le nom de la
-- personne qui l'a faite : elle suit la même durée que les journaux, un an.
-- (create or replace → les droits sont reposés juste après.)
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
  demandes_mag_ttl     constant interval := interval '1 year';
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

  delete from public.store_requests
   where handled_at is not null and handled_at < now() - demandes_mag_ttl;
  get diagnostics n = row_count;  rapport := rapport || jsonb_build_object('demandes_magasin_supprimees', n);

  return rapport || jsonb_build_object('execute_le', now());
end;
$$;

revoke all on function public.purge_expired_data() from public, anon, authenticated;
grant execute on function public.purge_expired_data() to service_role;
