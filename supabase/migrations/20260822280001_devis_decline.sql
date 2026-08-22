-- Le client peut décliner son devis (22 août 2026).
--
-- Julien : « dans le parcours où le devis est décliné, il n'y a pas le bouton,
-- il n'y a que j'accepte ou télécharger ». Un client qui ne veut pas du devis
-- n'avait rien à cliquer : il fermait l'onglet, et la vente restait « en
-- attente du client » sept jours avant une relance pour rien. Un refus est une
-- information aussi utile qu'un accord.
--
-- Statut `declined` sur les deux tables, avec un motif facultatif. La vente
-- sort de « Ventes en cours » ; le motif reste lisible en console. Un devis
-- renvoyé (`admin_quote_*`, qui accepte `declined` comme point de départ)
-- repart de `quoted` avec un nouveau jeton : décliner n'est pas définitif.

alter table public.company_requests drop constraint if exists company_requests_status_check;
alter table public.company_requests add constraint company_requests_status_check
  check (status in ('pending', 'quoted', 'accepted', 'paid', 'created', 'rejected', 'declined'));
alter table public.company_requests
  add column if not exists declined_at timestamptz,
  add column if not exists decline_reason text not null default '';

alter table public.store_requests drop constraint if exists store_requests_status_check;
alter table public.store_requests add constraint store_requests_status_check
  check (status in ('pending', 'quoted', 'accepted', 'paid', 'created', 'removed', 'rejected', 'declined'));
alter table public.store_requests
  add column if not exists declined_at timestamptz,
  add column if not exists decline_reason text not null default '';

-- ── Décliner par le jeton (public) ────────────────────────────────────────
-- Même surface que l'acceptation : le jeton tient lieu de clé, limitation de
-- débit partagée. Seul un devis `quoted` se décline — accepté, il se paie ou
-- se laisse expirer ; la renonciation après accord est une conversation.
create or replace function public.decline_quote_by_token(p_token uuid, p_reason text default '')
returns json
language plpgsql security definer set search_path to 'public'
as $$
declare
  v_req public.company_requests%rowtype; v_sto public.store_requests%rowtype;
  v_company text; v_reason text := left(btrim(coalesce(p_reason, '')), 500);
begin
  if p_token is null then return json_build_object('success', false, 'error', 'Lien invalide.'); end if;
  if not public.rate_limit_ok('accept_quote', p_token::text, 10, interval '1 hour') then
    return json_build_object('success', false, 'error', 'Trop de tentatives. Réessayez dans une heure.');
  end if;

  select * into v_req from public.company_requests where quote_token = p_token;
  if found then
    if v_req.status = 'declined' then
      return json_build_object('success', true, 'already', true, 'kind', 'company');
    end if;
    if v_req.status <> 'quoted' then
      return json_build_object('success', false, 'error', 'Ce devis n''est plus en attente de réponse.');
    end if;
    update public.company_requests
       set status = 'declined', declined_at = now(), decline_reason = v_reason, updated_at = now()
     where id = v_req.id;
    return json_build_object('success', true, 'already', false, 'kind', 'company',
      'company_name', v_req.company_name, 'reference', v_req.quote_reference,
      'amount_cents', v_req.quote_amount_cents, 'reason', v_reason,
      'contact_email', v_req.contact_email, 'contact_first_name', v_req.contact_first_name);
  end if;

  select * into v_sto from public.store_requests where quote_token = p_token;
  if not found or v_sto.kind <> 'add' then
    return json_build_object('success', false, 'error', 'Lien invalide.');
  end if;
  if v_sto.status = 'declined' then
    return json_build_object('success', true, 'already', true, 'kind', 'store');
  end if;
  if v_sto.status <> 'quoted' then
    return json_build_object('success', false, 'error', 'Ce devis n''est plus en attente de réponse.');
  end if;
  select c.name into v_company from public.companies c where c.id = v_sto.company_id;
  update public.store_requests
     set status = 'declined', declined_at = now(), decline_reason = v_reason
   where id = v_sto.id;
  return json_build_object('success', true, 'already', false, 'kind', 'store',
    'company_name', coalesce(v_company, ''), 'store_name', v_sto.store_name,
    'reference', v_sto.quote_reference, 'amount_cents', v_sto.quote_amount_cents, 'reason', v_reason,
    'contact_email', (select lower(u.email::text) from auth.users u where u.id = v_sto.requested_by),
    'contact_first_name', (select p.first_name from public.profiles p where p.id = v_sto.requested_by));
end;
$$;

-- ── La lecture publique dit « décliné » ───────────────────────────────────
-- (Corps de 20260822230001, plus `declined_at`.)
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
      'found', true, 'kind', 'company',
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
      'declined_at', v_req.declined_at,
      'expired', v_req.quote_expires_at is not null and v_req.quote_expires_at < now());
  end if;

  select * into v_sto from public.store_requests where quote_token = p_token;
  if not found then return json_build_object('found', false); end if;
  select c.name into v_company from public.companies c where c.id = v_sto.company_id;

  return json_build_object(
    'found', true, 'kind', 'store',
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
    'declined_at', v_sto.declined_at,
    'expired', v_sto.quote_expires_at is not null and v_sto.quote_expires_at < now());
end;
$$;

-- ── Renvoyer un devis décliné ─────────────────────────────────────────────
-- Les deux fonctions de devis acceptent `declined` comme point de départ :
-- décliner n'est pas définitif, une seconde proposition est une conversation.
-- (Corps de 20260822220001 / 20260822230001, `declined` ajouté aux statuts
-- admis, et la trace du refus effacée au renvoi.)
create or replace function public.admin_quote_company_request(
  p_id uuid, p_reference text, p_amount_cents bigint, p_note text default '', p_lines jsonb default '[]'::jsonb)
returns json
language plpgsql security definer set search_path to 'public'
as $$
declare v_req public.company_requests%rowtype; v_token uuid;
begin
  if not public.is_admin() then return json_build_object('success', false, 'error', 'Accès refusé'); end if;
  if p_amount_cents is null or p_amount_cents < 0 then
    return json_build_object('success', false, 'error', 'Montant invalide');
  end if;
  v_token := gen_random_uuid();
  update public.company_requests
     set status = 'quoted',
         quote_reference = coalesce(btrim(p_reference), ''),
         quote_amount_cents = p_amount_cents,
         quote_lines = coalesce(p_lines, '[]'::jsonb),
         quote_sent_at = now(),
         quote_expires_at = now() + interval '30 days',
         quote_token = v_token,
         declined_at = null, decline_reason = '',
         admin_note = coalesce(nullif(btrim(p_note), ''), admin_note),
         updated_at = now()
   where id = p_id and status in ('pending', 'quoted', 'declined')
  returning * into v_req;
  if not found then
    return json_build_object('success', false, 'error', 'Demande introuvable ou déjà traitée');
  end if;
  perform public.log_admin_action('devis_envoye', 'demande_entreprise', p_id::text,
    coalesce(v_req.company_name, ''),
    json_build_object('reference', v_req.quote_reference, 'montant_cents', p_amount_cents)::jsonb);
  return json_build_object(
    'success', true, 'token', v_token,
    'quote', json_build_object(
      'reference', v_req.quote_reference, 'amount_cents', v_req.quote_amount_cents,
      'lines', v_req.quote_lines, 'company_name', v_req.company_name,
      'store_count', v_req.store_count,
      'contact_first_name', v_req.contact_first_name, 'contact_last_name', v_req.contact_last_name,
      'contact_email', v_req.contact_email, 'siren', v_req.siren,
      'sent_at', v_req.quote_sent_at, 'expires_at', v_req.quote_expires_at));
end;
$$;

create or replace function public.admin_quote_store_request(
  p_id uuid, p_reference text, p_amount_cents bigint, p_note text default '', p_lines jsonb default '[]'::jsonb)
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
  if v_req.status not in ('pending', 'quoted', 'declined') then
    return json_build_object('success', false, 'error', 'Cette demande a déjà été traitée.');
  end if;
  v_token := gen_random_uuid();
  update public.store_requests
     set status = 'quoted',
         quote_reference = coalesce(btrim(p_reference), ''),
         quote_amount_cents = p_amount_cents,
         quote_lines = coalesce(p_lines, '[]'::jsonb),
         quote_sent_at = now(),
         quote_expires_at = now() + interval '30 days',
         quote_token = v_token,
         declined_at = null, decline_reason = '',
         admin_note = coalesce(nullif(btrim(p_note), ''), admin_note)
   where id = p_id
  returning * into v_req;
  select c.name into v_company from public.companies c where c.id = v_req.company_id;
  perform public.log_admin_action('devis_magasin_envoye', 'demande_magasin', p_id::text,
    v_req.store_name,
    json_build_object('reference', v_req.quote_reference, 'montant_cents', p_amount_cents)::jsonb);
  return json_build_object(
    'success', true, 'token', v_token,
    'quote', json_build_object(
      'reference', v_req.quote_reference, 'amount_cents', v_req.quote_amount_cents,
      'lines', v_req.quote_lines, 'company_name', coalesce(v_company, ''),
      'store_name', v_req.store_name, 'store_count', 1,
      'contact_first_name', (select p.first_name from public.profiles p where p.id = v_req.requested_by),
      'contact_last_name', (select p.last_name from public.profiles p where p.id = v_req.requested_by),
      'contact_email', (select lower(u.email::text) from auth.users u where u.id = v_req.requested_by),
      'siren', null,
      'sent_at', v_req.quote_sent_at, 'expires_at', v_req.quote_expires_at));
end;
$$;

-- ── Les listes disent « décliné », motif compris ───────────────────────────
-- Console : une vente déclinée sort de « Ventes en cours » (ce n'est plus en
-- cours) mais reste dans la liste des demandes, motif lisible, pour qu'on
-- puisse renvoyer. Client : elle reste trente jours sur /magasins.
create or replace function public.admin_list_store_requests()
returns json
language plpgsql
stable security definer
set search_path to 'public'
as $$
begin
  if not public.is_admin() then raise exception 'Accès refusé'; end if;
  return (
    select coalesce(json_agg(json_build_object(
             'id', r.id, 'kind', r.kind, 'company_id', r.company_id, 'company_name', c.name,
             'store_id', r.store_id, 'store_name', r.store_name, 'message', r.message,
             'units', r.units, 'sqm', r.sqm, 'status', r.status,
             'requested_label', r.requested_label, 'admin_note', r.admin_note,
             'created_at', r.created_at, 'handled_at', r.handled_at,
             'quote_reference', r.quote_reference, 'quote_amount_cents', r.quote_amount_cents,
             'quote_sent_at', r.quote_sent_at, 'quote_expires_at', r.quote_expires_at,
             'accepted_at', r.accepted_at, 'paid_at', r.paid_at,
             'declined_at', r.declined_at, 'decline_reason', r.decline_reason
           ) order by (r.status in ('pending', 'quoted', 'accepted', 'paid', 'declined')) desc, r.created_at desc), '[]'::json)
      from public.store_requests r
      join public.companies c on c.id = r.company_id
     where r.status in ('pending', 'quoted', 'accepted', 'paid', 'declined')
        or r.handled_at > now() - interval '90 days');
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
             'id', r.id, 'kind', r.kind, 'store_id', r.store_id, 'store_name', r.store_name,
             'message', r.message, 'units', r.units, 'sqm', r.sqm, 'status', r.status,
             'requested_label', r.requested_label, 'admin_note', r.admin_note,
             'created_at', r.created_at, 'handled_at', r.handled_at,
             'quote_reference', r.quote_reference, 'quote_amount_cents', r.quote_amount_cents,
             'quote_token', r.quote_token, 'quote_expires_at', r.quote_expires_at,
             'declined_at', r.declined_at
           ) order by r.created_at desc), '[]'::json)
      from public.store_requests r
     where r.company_id = v_company
       and (r.status in ('pending', 'quoted', 'accepted', 'paid')
            or (r.status in ('rejected', 'declined') and coalesce(r.handled_at, r.declined_at) > now() - interval '30 days')));
end;
$$;

-- La liste des inscriptions en console rend déjà toutes les colonnes par
-- `returns table` : on y ajoute le motif.
drop function if exists public.admin_list_company_requests();
create or replace function public.admin_list_company_requests()
returns table(id uuid, company_name text, contact_first_name text, contact_last_name text,
              contact_email text, contact_phone text, store_count int, message text,
              status text, quote_reference text, quote_amount_cents bigint,
              admin_note text, company_id uuid, created_at timestamptz,
              siren text, stores jsonb, ape text, decline_reason text, declined_at timestamptz)
language plpgsql stable security definer set search_path to 'public'
as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return query
    select r.id, r.company_name, r.contact_first_name, r.contact_last_name, r.contact_email,
           r.contact_phone, r.store_count, r.message, r.status, r.quote_reference,
           r.quote_amount_cents, r.admin_note, r.company_id, r.created_at,
           r.siren, r.stores, r.ape, r.decline_reason, r.declined_at
    from public.company_requests r
    order by case r.status when 'pending' then 0 when 'accepted' then 1 when 'quoted' then 2
                           when 'declined' then 3 when 'paid' then 4 when 'created' then 5 else 6 end,
             r.created_at desc;
end;
$$;

revoke all on function public.decline_quote_by_token(uuid, text) from public;
grant execute on function public.decline_quote_by_token(uuid, text) to anon, authenticated, service_role;
revoke all on function public.quote_by_token(uuid) from public;
grant execute on function public.quote_by_token(uuid) to anon, authenticated, service_role;
revoke all on function public.admin_quote_company_request(uuid, text, bigint, text, jsonb) from public, anon;
grant execute on function public.admin_quote_company_request(uuid, text, bigint, text, jsonb) to authenticated, service_role;
revoke all on function public.admin_quote_store_request(uuid, text, bigint, text, jsonb) from public, anon;
grant execute on function public.admin_quote_store_request(uuid, text, bigint, text, jsonb) to authenticated, service_role;
revoke all on function public.admin_list_store_requests() from public, anon;
grant execute on function public.admin_list_store_requests() to authenticated, service_role;
revoke all on function public.ca_list_store_requests() from public, anon;
grant execute on function public.ca_list_store_requests() to authenticated, service_role;
revoke all on function public.admin_list_company_requests() from public, anon;
grant execute on function public.admin_list_company_requests() to authenticated, service_role;
