-- VR-006 et VR-005 — deux appels concurrents ne franchissent plus la même
-- transition d'état.
--
-- Même défaut que `20260828210001` (le webhook Stripe), retrouvé sur cinq
-- autres fonctions par balayage : le statut est contrôlé par une **lecture**,
-- et une lecture ne sérialise rien. Deux exécutions concurrentes lisent toutes
-- deux l'état de départ, passent toutes deux, et font le travail deux fois.
--
-- ⚠️ ICI, `for update` SUFFIT — pas besoin d'ajouter une garde sur l'UPDATE.
-- Ces cinq fonctions portent déjà, après la lecture, un contrôle qui rejette
-- l'état d'arrivée (`status <> 'paid'`, `status <> 'pending'`, `status
-- <> 'quoted'`). Le verrou de ligne fait attendre le second appel ; il relit
-- alors la ligne transformée (READ COMMITTED réévalue après le verrou) et son
-- propre contrôle le refuse. C'est ce qui distingue ce correctif de celui du
-- webhook, où le contrôle laissait passer et où il a fallu garder l'UPDATE.
--
-- ── VR-006 · `decline_quote_by_token` · le plus grave ───────────────────────
--
-- Ouverte à `anon`. `accept_quote_by_token` garde sa transition
-- (`and status = 'quoted'`), celle-ci ne la gardait pas. Or les deux gestes
-- sont sur la même page, sous le même jeton.
--
-- Un accord et un refus concurrents — double clic, ou connexion lente puis
-- nouvelle tentative — se déroulent ainsi : les deux lisent `quoted` ;
-- l'acceptation, gardée, passe et pose `accepted` ; le refus, non gardé, attend
-- la levée du verrou puis **écrase en `declined`**.
--
-- À partir de là `accept-quote` a déjà rendu son adresse Stripe. Le client
-- paie. Le webhook trouve `declined`, répond « Transition impossible depuis
-- declined », donc 500, donc Stripe réessaie indéfiniment : **le client a payé
-- et n'obtiendra jamais rien**, sans réparation automatique.
--
-- Elle reçoit donc `for update` **et** la garde sur ses deux UPDATE, comme sa
-- jumelle — l'asymétrie entre fonctions sœurs était le signe de l'oubli.
--
-- ── VR-005 · les quatre fonctions de la console ────────────────────────────
--
-- L'acteur est de confiance (`is_admin()`), donc ce n'est pas une attaque :
-- c'est un accident. Deux clics sur « Créer le magasin » pendant que la
-- réponse tarde, et l'entreprise ou le magasin est créé deux fois — deux codes
-- d'accès, une licence facturée en trop. `admin_fulfil_store_removal` est la
-- plus désagréable : elle appelle `admin_delete_store`, qui supprime les
-- inventaires du magasin.
--
-- `admin_quote_store_request` reçoit le verrou pour la même raison de forme,
-- mais re-deviser reste permis : c'est voulu, un devis se renvoie.

-- ── VR-006 ─────────────────────────────────────────────────────────────────

create or replace function public.decline_quote_by_token(p_token uuid, p_reason text default ''::text)
 returns json
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_req public.company_requests%rowtype; v_sto public.store_requests%rowtype;
  v_company text; v_reason text := left(btrim(coalesce(p_reason, '')), 500);
begin
  if p_token is null then return json_build_object('success', false, 'error', 'Lien invalide.'); end if;
  if not public.rate_limit_ok('accept_quote', p_token::text, 10, interval '1 hour') then
    return json_build_object('success', false, 'error', 'Trop de tentatives. Réessayez dans une heure.');
  end if;

  select * into v_req from public.company_requests where quote_token = p_token for update;
  if found then
    if v_req.status = 'declined' then
      return json_build_object('success', true, 'already', true, 'kind', 'company');
    end if;
    if v_req.status <> 'quoted' then
      return json_build_object('success', false, 'error', 'Ce devis n''est plus en attente de réponse.');
    end if;
    update public.company_requests
       set status = 'declined', declined_at = now(), decline_reason = v_reason, updated_at = now()
     where id = v_req.id and status = 'quoted';
    if not found then
      return json_build_object('success', false, 'error', 'Ce devis n''est plus en attente de réponse.');
    end if;
    return json_build_object('success', true, 'already', false, 'kind', 'company',
      'company_name', v_req.company_name, 'reference', v_req.quote_reference,
      'amount_cents', v_req.quote_amount_cents, 'reason', v_reason,
      'contact_email', v_req.contact_email, 'contact_first_name', v_req.contact_first_name);
  end if;

  select * into v_sto from public.store_requests where quote_token = p_token for update;
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
   where id = v_sto.id and status = 'quoted';
  if not found then
    return json_build_object('success', false, 'error', 'Ce devis n''est plus en attente de réponse.');
  end if;
  return json_build_object('success', true, 'already', false, 'kind', 'store',
    'company_name', coalesce(v_company, ''), 'store_name', v_sto.store_name,
    'reference', v_sto.quote_reference, 'amount_cents', v_sto.quote_amount_cents, 'reason', v_reason,
    'contact_email', (select lower(u.email::text) from auth.users u where u.id = v_sto.requested_by),
    'contact_first_name', (select p.first_name from public.profiles p where p.id = v_sto.requested_by));
end;
$function$;

revoke all on function public.decline_quote_by_token(uuid, text) from public;
grant execute on function public.decline_quote_by_token(uuid, text) to anon, authenticated, service_role;


-- ── VR-005 · les quatre fonctions de la console ────────────────────────────
-- Seul ajout dans chacune : `for update` sur la lecture initiale. Rien d'autre
-- ne change — ni les contrôles, ni la création, ni les journaux.

create or replace function public.admin_fulfil_company_request(p_id uuid, p_store_names text[] default null::text[])
 returns json language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_req public.company_requests%rowtype;
  v_company_id uuid; v_company_code text; v_store_code text;
  v_name text; v_i int; v_stores json[] := '{}';
  v_declare jsonb; v_units numeric; v_price int;
begin
  if not public.is_admin() then return json_build_object('success', false, 'error', 'Acces refuse'); end if;
  select * into v_req from public.company_requests where id = p_id for update;
  if not found then return json_build_object('success', false, 'error', 'Demande introuvable'); end if;
  if v_req.status <> 'paid' then
    return json_build_object('success', false,
      'error', 'L''entreprise ne peut etre creee qu''apres encaissement de la facture.');
  end if;
  v_company_code := public.gen_company_code();
  insert into public.companies (name, join_code) values (v_req.company_name, v_company_code)
    returning id into v_company_id;

  for v_i in 1..v_req.store_count loop
    v_declare := v_req.stores -> (v_i - 1);
    v_name := coalesce(
      nullif(btrim(p_store_names[v_i]), ''),
      nullif(btrim(coalesce(v_declare ->> 'name', '')), ''),
      'Magasin ' || v_i);

    v_units := nullif(v_declare ->> 'units', '')::numeric;
    v_price := case
      when v_units is null or v_units <= 0 then null
      when v_units <= 10000 then 210000
      when v_units <= 50000 then 420000
      when v_units <= 200000 then 660000
      when v_units <= 500000 then 1020000
      when v_units <= 1000000 then 1440000
      else null
    end;

    v_store_code := public.gen_store_code();
    insert into public.stores (company_id, name, join_code, annual_price_cents)
      values (v_company_id, v_name, v_store_code, v_price);
    v_stores := v_stores || json_build_object(
      'name', v_name, 'join_code', v_store_code, 'annual_price_cents', v_price);
  end loop;

  update public.company_requests
     set status = 'created', company_id = v_company_id, updated_at = now() where id = p_id;
  perform public.log_admin_action('entreprise_creee_depuis_demande', 'entreprise', v_company_id::text,
    coalesce(v_req.company_name, ''),
    json_build_object('demande_id', p_id::text, 'magasins', v_req.store_count)::jsonb);
  return json_build_object('success', true, 'company_id', v_company_id::text,
    'company_code', v_company_code, 'stores', array_to_json(v_stores));
end; $function$;

create or replace function public.admin_fulfil_store_request(p_id uuid)
 returns json language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_req public.store_requests%rowtype;
  v_res json; v_email text; v_first text; v_company text;
begin
  if not public.is_admin() then
    return json_build_object('success', false, 'error', 'Accès refusé');
  end if;
  select * into v_req from public.store_requests where id = p_id for update;
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

  -- Le volume déclaré voyage jusqu'au magasin : c'est lui qui rendra la
  -- mesure d'usage comparable à la tranche facturée.
  v_res := public.admin_add_store(v_req.company_id, v_req.store_name, v_req.units, v_req.sqm);
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
end; $function$;

create or replace function public.admin_fulfil_store_removal(p_id uuid)
 returns json language plpgsql security definer set search_path to 'public'
as $function$
declare v_req public.store_requests%rowtype; v_res json;
begin
  if not public.is_admin() then
    return json_build_object('success', false, 'error', 'Accès refusé');
  end if;
  select * into v_req from public.store_requests where id = p_id for update;
  if not found then
    return json_build_object('success', false, 'error', 'Demande introuvable');
  end if;
  if v_req.kind <> 'remove' then
    return json_build_object('success', false, 'error', 'Cette demande n''est pas une suppression.');
  end if;
  if v_req.status <> 'pending' then
    return json_build_object('success', false, 'error', 'Cette demande a déjà été traitée.');
  end if;
  if v_req.store_id is null then
    return json_build_object('success', false, 'error', 'Ce magasin n''existe plus.');
  end if;

  v_res := public.admin_delete_store(v_req.store_id);
  if not coalesce((v_res ->> 'success')::boolean, false) then
    return v_res;
  end if;

  update public.store_requests
     set status = 'removed', handled_at = now()
   where id = p_id;

  perform public.log_admin_action('demande_magasin_supprimee', 'entreprise', v_req.company_id::text,
    v_req.store_name, json_build_object('inventaires', v_res -> 'sessions_supprimees')::jsonb);

  return v_res;
end;
$function$;

create or replace function public.admin_quote_store_request(p_id uuid, p_reference text, p_amount_cents bigint, p_note text default ''::text, p_lines jsonb default '[]'::jsonb)
 returns json language plpgsql security definer set search_path to 'public'
as $function$
declare v_req public.store_requests%rowtype; v_token uuid; v_company text;
begin
  if not public.is_admin() then return json_build_object('success', false, 'error', 'Accès refusé'); end if;
  if p_amount_cents is null or p_amount_cents < 0 then
    return json_build_object('success', false, 'error', 'Montant invalide');
  end if;
  select * into v_req from public.store_requests where id = p_id for update;
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
$function$;

-- `create or replace function` rend EXECUTE à PUBLIC. Ces quatre fonctions
-- sont gardées par `is_admin()` dans leur corps, mais le droit se repose quand
-- même — leçon de `20260819172706`.
revoke all on function public.admin_fulfil_company_request(uuid, text[]) from public, anon;
grant execute on function public.admin_fulfil_company_request(uuid, text[]) to authenticated;
revoke all on function public.admin_fulfil_store_request(uuid) from public, anon;
grant execute on function public.admin_fulfil_store_request(uuid) to authenticated;
revoke all on function public.admin_fulfil_store_removal(uuid) from public, anon;
grant execute on function public.admin_fulfil_store_removal(uuid) to authenticated;
revoke all on function public.admin_quote_store_request(uuid, text, bigint, text, jsonb) from public, anon;
grant execute on function public.admin_quote_store_request(uuid, text, bigint, text, jsonb) to authenticated;
