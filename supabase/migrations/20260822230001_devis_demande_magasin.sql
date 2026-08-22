-- Une demande de magasin passe par un devis, comme une inscription (22 août 2026).
--
-- Constat de Julien, une heure après la mise en ligne du devis automatique :
-- « pourquoi j'ai pu créer deux magasins à l'instant sans qu'un devis ne soit
-- envoyé ? ». Le journal le confirme — `admin_fulfil_store_request` menait la
-- demande de `pending` à `created` d'un seul geste. Or **la licence se facture
-- par magasin** : un magasin ajouté est une ligne de revenu, pas une faveur.
--
-- Le parcours d'une demande d'ajout devient donc celui d'une inscription :
--   pending → quoted → accepted → paid → created
-- et `admin_fulfil_store_request` **exige `paid`**, exactement comme
-- `admin_fulfil_company_request`.
--
-- ⚠️ **Une demande de suppression (`kind = 'remove'`) n'a pas de devis** :
-- elle reste `pending → removed`. Toutes les fonctions de devis la refusent
-- explicitement — sans cela on facturerait un client pour lui retirer un
-- magasin.
--
-- Aucune demande n'était en cours au moment de la bascule (vérifié : trois
-- lignes, toutes `created`), donc rien ne se retrouve coincé dans un statut
-- que l'écran ne saurait pas traiter.

alter table public.store_requests
  add column if not exists quote_reference    text not null default '',
  add column if not exists quote_amount_cents bigint,
  add column if not exists quote_sent_at      timestamptz,
  add column if not exists quote_expires_at   timestamptz,
  add column if not exists quote_token        uuid,
  add column if not exists quote_lines        jsonb not null default '[]'::jsonb,
  add column if not exists accepted_at        timestamptz,
  add column if not exists paid_at            timestamptz;

create unique index if not exists store_requests_quote_token_idx
  on public.store_requests (quote_token) where quote_token is not null;

alter table public.store_requests drop constraint if exists store_requests_status_check;
alter table public.store_requests add constraint store_requests_status_check
  check (status in ('pending', 'quoted', 'accepted', 'paid', 'created', 'removed', 'rejected'));

-- ── Établir le devis d'un ajout de magasin ────────────────────────────────
create or replace function public.admin_quote_store_request(
  p_id uuid,
  p_reference text,
  p_amount_cents bigint,
  p_note text default '',
  p_lines jsonb default '[]'::jsonb)
returns json
language plpgsql security definer set search_path to 'public'
as $$
declare v_req public.store_requests%rowtype; v_token uuid; v_company text;
begin
  if not public.is_admin() then return json_build_object('success', false, 'error', 'Accès refusé'); end if;
  if p_amount_cents is null or p_amount_cents < 0 then
    return json_build_object('success', false, 'error', 'Montant invalide');
  end if;

  select * into v_req from public.store_requests where id = p_id;
  if not found then return json_build_object('success', false, 'error', 'Demande introuvable'); end if;
  if v_req.kind <> 'add' then
    return json_build_object('success', false, 'error', 'Une demande de suppression ne se devise pas.');
  end if;
  if v_req.status not in ('pending', 'quoted') then
    return json_build_object('success', false, 'error', 'Cette demande a déjà été traitée.');
  end if;

  -- Un nouveau jeton à chaque envoi : renvoyer un devis invalide l'ancien lien.
  v_token := gen_random_uuid();

  update public.store_requests
     set status = 'quoted',
         quote_reference = coalesce(btrim(p_reference), ''),
         quote_amount_cents = p_amount_cents,
         quote_lines = coalesce(p_lines, '[]'::jsonb),
         quote_sent_at = now(),
         quote_expires_at = now() + interval '30 days',
         quote_token = v_token,
         admin_note = coalesce(nullif(btrim(p_note), ''), admin_note)
   where id = p_id
  returning * into v_req;

  select c.name into v_company from public.companies c where c.id = v_req.company_id;

  perform public.log_admin_action('devis_magasin_envoye', 'demande_magasin', p_id::text,
    v_req.store_name,
    json_build_object('reference', v_req.quote_reference, 'montant_cents', p_amount_cents)::jsonb);

  -- De quoi écrire le message : la fonction edge ne va pas chercher l'adresse
  -- elle-même.
  return json_build_object(
    'success', true,
    'token', v_token,
    'quote', json_build_object(
      'reference', v_req.quote_reference,
      'amount_cents', v_req.quote_amount_cents,
      'lines', v_req.quote_lines,
      'company_name', coalesce(v_company, ''),
      'store_name', v_req.store_name,
      'store_count', 1,
      'contact_first_name', (select p.first_name from public.profiles p where p.id = v_req.requested_by),
      'contact_last_name', (select p.last_name from public.profiles p where p.id = v_req.requested_by),
      'contact_email', (select lower(u.email::text) from auth.users u where u.id = v_req.requested_by),
      'siren', null,
      'sent_at', v_req.quote_sent_at,
      'expires_at', v_req.quote_expires_at));
end;
$$;

-- ── Encaissement, puis création ───────────────────────────────────────────
-- Déclaré à la main, comme pour une inscription — et **c'est ici que Stripe se
-- branchera**, sur la même transition `accepted → paid`.
create or replace function public.admin_set_store_request_status(
  p_id uuid, p_status text, p_note text default '')
returns json
language plpgsql security definer set search_path to 'public'
as $$
declare v_req public.store_requests%rowtype; v_allowed text[];
begin
  if not public.is_admin() then return json_build_object('success', false, 'error', 'Accès refusé'); end if;
  v_allowed := case p_status
    when 'accepted' then array['quoted']
    when 'paid'     then array['accepted']
    else null end;
  if v_allowed is null then
    return json_build_object('success', false, 'error', 'Statut invalide');
  end if;

  update public.store_requests
     set status = p_status,
         accepted_at = case when p_status = 'accepted' then now() else accepted_at end,
         paid_at     = case when p_status = 'paid'     then now() else paid_at end,
         admin_note  = coalesce(nullif(btrim(p_note), ''), admin_note)
   where id = p_id and kind = 'add' and status = any(v_allowed)
  returning * into v_req;
  if not found then
    return json_build_object('success', false, 'error', 'Transition impossible depuis le statut actuel');
  end if;

  perform public.log_admin_action('demande_magasin_' || p_status, 'demande_magasin', p_id::text,
    v_req.store_name, '{}'::jsonb);
  return json_build_object('success', true);
end;
$$;

-- La création exige désormais l'encaissement. Le reste ne bouge pas : elle
-- appelle toujours `admin_add_store`, jamais une copie de la génération de code.
create or replace function public.admin_fulfil_store_request(p_id uuid)
returns json
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_req public.store_requests%rowtype;
  v_res json;
  v_email text;
  v_first text;
  v_company text;
begin
  if not public.is_admin() then
    return json_build_object('success', false, 'error', 'Accès refusé');
  end if;
  select * into v_req from public.store_requests where id = p_id;
  if not found then
    return json_build_object('success', false, 'error', 'Demande introuvable');
  end if;
  if v_req.status = 'created' then
    return json_build_object('success', false, 'error', 'Cette demande a déjà été traitée.');
  end if;
  if v_req.status <> 'paid' then
    return json_build_object('success', false,
      'error', 'Le magasin ne peut être créé qu''après encaissement de la facture.');
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

  select lower(u.email::text), p.first_name
    into v_email, v_first
    from public.profiles p
    join auth.users u on u.id = p.id
   where p.id = v_req.requested_by;

  select c.name into v_company from public.companies c where c.id = v_req.company_id;

  return (v_res::jsonb || jsonb_build_object(
    'notify', case when v_email is null then null else jsonb_build_object(
      'email', v_email,
      'first_name', coalesce(v_first, ''),
      'store_name', v_req.store_name,
      'company_name', coalesce(v_company, ''),
      'store_id', v_res ->> 'store_id'
    ) end
  ))::json;
end;
$$;

-- ── Un jeton, une page ────────────────────────────────────────────────────
-- `quote_by_token` et `accept_quote_by_token` cherchent maintenant dans les
-- **deux** tables : une inscription d'entreprise et un ajout de magasin
-- s'affichent et s'acceptent au même endroit, `/devis/<jeton>`. Deux pages
-- auraient voulu dire deux mises en page à tenir d'accord.
create or replace function public.quote_by_token(p_token uuid)
returns json
language plpgsql
stable security definer
set search_path to 'public'
as $$
declare v_req public.company_requests%rowtype; v_sto public.store_requests%rowtype; v_company text;
begin
  if p_token is null then return json_build_object('found', false); end if;

  select * into v_req from public.company_requests where quote_token = p_token;
  if found then
    return json_build_object(
      'found', true,
      'kind', 'company',
      'company_name', v_req.company_name,
      'contact_first_name', v_req.contact_first_name,
      'contact_name', btrim(v_req.contact_first_name || ' ' || v_req.contact_last_name),
      'siren', v_req.siren,
      'reference', v_req.quote_reference,
      'amount_cents', v_req.quote_amount_cents,
      'lines', v_req.quote_lines,
      'status', v_req.status,
      'sent_at', v_req.quote_sent_at,
      'expires_at', v_req.quote_expires_at,
      'accepted_at', v_req.accepted_at,
      'expired', v_req.quote_expires_at is not null and v_req.quote_expires_at < now());
  end if;

  select * into v_sto from public.store_requests where quote_token = p_token;
  if not found then return json_build_object('found', false); end if;
  select c.name into v_company from public.companies c where c.id = v_sto.company_id;

  return json_build_object(
    'found', true,
    'kind', 'store',
    'store_name', v_sto.store_name,
    'company_name', coalesce(v_company, ''),
    'contact_first_name', (select p.first_name from public.profiles p where p.id = v_sto.requested_by),
    'contact_name', (select btrim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, ''))
                       from public.profiles p where p.id = v_sto.requested_by),
    'siren', null,
    'reference', v_sto.quote_reference,
    'amount_cents', v_sto.quote_amount_cents,
    'lines', v_sto.quote_lines,
    'status', v_sto.status,
    'sent_at', v_sto.quote_sent_at,
    'expires_at', v_sto.quote_expires_at,
    'accepted_at', v_sto.accepted_at,
    'expired', v_sto.quote_expires_at is not null and v_sto.quote_expires_at < now());
end;
$$;

create or replace function public.accept_quote_by_token(p_token uuid)
returns json
language plpgsql security definer set search_path to 'public'
as $$
declare v_req public.company_requests%rowtype; v_sto public.store_requests%rowtype; v_company text;
begin
  if p_token is null then
    return json_build_object('success', false, 'error', 'Lien invalide.');
  end if;
  if not public.rate_limit_ok('accept_quote', p_token::text, 10, interval '1 hour') then
    return json_build_object('success', false, 'error', 'Trop de tentatives. Réessayez dans une heure.');
  end if;

  -- Inscription d'entreprise
  select * into v_req from public.company_requests where quote_token = p_token;
  if found then
    if v_req.status in ('accepted', 'paid', 'created') then
      return json_build_object('success', true, 'already', true,
        'accepted_at', v_req.accepted_at, 'company_name', v_req.company_name,
        'reference', v_req.quote_reference);
    end if;
    if v_req.status <> 'quoted' then
      return json_build_object('success', false, 'error', 'Ce devis n''est plus en attente d''accord.');
    end if;
    if v_req.quote_expires_at is not null and v_req.quote_expires_at < now() then
      return json_build_object('success', false, 'error',
        'Ce devis a expiré. Demandez-nous une nouvelle proposition.');
    end if;

    update public.company_requests
       set status = 'accepted', accepted_at = now(), updated_at = now()
     where id = v_req.id and status = 'quoted'
    returning * into v_req;
    if not found then
      return json_build_object('success', false, 'error', 'Ce devis n''est plus en attente d''accord.');
    end if;

    return json_build_object(
      'success', true, 'already', false, 'kind', 'company',
      'accepted_at', v_req.accepted_at,
      'company_name', v_req.company_name,
      'reference', v_req.quote_reference,
      'amount_cents', v_req.quote_amount_cents,
      'contact_email', v_req.contact_email,
      'contact_first_name', v_req.contact_first_name);
  end if;

  -- Ajout de magasin
  select * into v_sto from public.store_requests where quote_token = p_token;
  if not found then
    return json_build_object('success', false, 'error', 'Lien invalide.');
  end if;
  if v_sto.kind <> 'add' then
    return json_build_object('success', false, 'error', 'Lien invalide.');
  end if;
  select c.name into v_company from public.companies c where c.id = v_sto.company_id;

  if v_sto.status in ('accepted', 'paid', 'created') then
    return json_build_object('success', true, 'already', true,
      'accepted_at', v_sto.accepted_at, 'company_name', coalesce(v_company, ''),
      'reference', v_sto.quote_reference);
  end if;
  if v_sto.status <> 'quoted' then
    return json_build_object('success', false, 'error', 'Ce devis n''est plus en attente d''accord.');
  end if;
  if v_sto.quote_expires_at is not null and v_sto.quote_expires_at < now() then
    return json_build_object('success', false, 'error',
      'Ce devis a expiré. Demandez-nous une nouvelle proposition.');
  end if;

  update public.store_requests
     set status = 'accepted', accepted_at = now()
   where id = v_sto.id and status = 'quoted'
  returning * into v_sto;
  if not found then
    return json_build_object('success', false, 'error', 'Ce devis n''est plus en attente d''accord.');
  end if;

  return json_build_object(
    'success', true, 'already', false, 'kind', 'store',
    'accepted_at', v_sto.accepted_at,
    'company_name', coalesce(v_company, ''),
    'store_name', v_sto.store_name,
    'reference', v_sto.quote_reference,
    'amount_cents', v_sto.quote_amount_cents,
    'contact_email', (select lower(u.email::text) from auth.users u where u.id = v_sto.requested_by),
    'contact_first_name', (select p.first_name from public.profiles p where p.id = v_sto.requested_by));
end;
$$;

-- ── Ce que le client voit de sa demande ───────────────────────────────────
-- Le devis en attente d'accord **doit** rester à l'écran : c'est justement ce
-- sur quoi il peut agir. Seules les demandes abouties (`created`, `removed`)
-- disparaissent, et les refusées restent trente jours avec leur motif.
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
             'kind', r.kind,
             'store_id', r.store_id,
             'store_name', r.store_name,
             'message', r.message,
             'units', r.units,
             'sqm', r.sqm,
             'status', r.status,
             'requested_label', r.requested_label,
             'admin_note', r.admin_note,
             'created_at', r.created_at,
             'handled_at', r.handled_at,
             'quote_reference', r.quote_reference,
             'quote_amount_cents', r.quote_amount_cents,
             'quote_token', r.quote_token,
             'quote_expires_at', r.quote_expires_at
           ) order by r.created_at desc), '[]'::json)
      from public.store_requests r
     where r.company_id = v_company
       and (r.status in ('pending', 'quoted', 'accepted', 'paid')
            or (r.status = 'rejected' and r.handled_at > now() - interval '30 days')));
end;
$$;

-- ── Droits ────────────────────────────────────────────────────────────────
revoke all on function public.admin_quote_store_request(uuid, text, bigint, text, jsonb) from public, anon;
grant execute on function public.admin_quote_store_request(uuid, text, bigint, text, jsonb) to authenticated, service_role;
revoke all on function public.admin_set_store_request_status(uuid, text, text) from public, anon;
grant execute on function public.admin_set_store_request_status(uuid, text, text) to authenticated, service_role;
revoke all on function public.admin_fulfil_store_request(uuid) from public, anon;
grant execute on function public.admin_fulfil_store_request(uuid) to authenticated, service_role;
revoke all on function public.ca_list_store_requests() from public, anon;
grant execute on function public.ca_list_store_requests() to authenticated, service_role;
revoke all on function public.quote_by_token(uuid) from public;
grant execute on function public.quote_by_token(uuid) to anon, authenticated, service_role;
revoke all on function public.accept_quote_by_token(uuid) from public;
grant execute on function public.accept_quote_by_token(uuid) to anon, authenticated, service_role;
