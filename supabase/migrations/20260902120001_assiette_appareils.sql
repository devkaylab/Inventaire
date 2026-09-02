-- ============================================================================
-- L'assiette passe du volume de stock au NOMBRE D'APPAREILS (2 septembre 2026)
-- ----------------------------------------------------------------------------
-- La grille est passée aux trois offres le 30 août (hypothèse 4) : on facture
-- le nombre d'appareils qui comptent EN MÊME TEMPS dans un magasin. Le site
-- public le disait déjà ; le parcours de demande, lui, réclamait toujours un
-- stock théorique et une surface, et le devis se calculait sur des tranches de
-- volume. C'est ce décalage que cette migration ferme, de bout en bout.
--
-- ⚠️ CE QU'ELLE NE FAIT PAS, ET POURQUOI
--
--   · Elle **ne supprime ni `units` ni `sqm`**. Règle du projet : on retire les
--     appels d'abord, les objets plus tard. Les magasins déclarés avant ce jour
--     portent leur volume, et deux écrans le lisent encore — le recoupement
--     stock / surface d'`admin_pipeline` et `/admin/usage`. Ces deux-là n'ont
--     plus de source sur les demandes nouvelles ; c'est assumé.
--   · Elle **ne touche pas à `deposer_souscription`** : le parcours de
--     souscription en ligne a été vérifié de bout en bout le 30 août, paiement
--     réel compris. Voir la règle des lignes de devis, plus bas.
--   · Elle **ne change aucun prix**. Les six Price Stripe restent à recréer aux
--     montants du 31 août — c'est Julien qui les pose.
--
-- ⚠️ LA RÈGLE DES LIGNES DE DEVIS, à connaître avant d'y toucher
--
--   Dans `quote_lines`, `prixCents` est ce qui est facturé **à l'échéance**, et
--   `annuelCents` — quand il est présent — ce que le magasin vaut **à l'année**.
--   `fulfil_paid_request` écrit donc `annual_price_cents = coalesce(annuelCents,
--   prixCents)`. Une ligne sans `annuelCents` est annuelle par construction :
--   c'est le cas de toutes celles écrites avant cette migration, et de celles
--   de la souscription en ligne. Ne jamais annualiser en multipliant par douze
--   selon le rythme : cela casserait précisément ce second cas, dont la ligne
--   porte déjà un montant annuel avec `billing_period = 'monthly'`.
-- ============================================================================

-- ── 1. Ce qui porte le nombre d'appareils et le rythme ─────────────────────

alter table public.stores
  add column if not exists devices integer;
alter table public.store_requests
  add column if not exists devices integer,
  add column if not exists billing_period text;

comment on column public.stores.devices is
  'Appareils comptant en meme temps dans ce magasin — l''assiette de la licence depuis le 2 septembre 2026.';
comment on column public.store_requests.devices is
  'Appareils declares a la demande. Nul pour les demandes anterieures au 2 septembre 2026.';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'stores_devices_check') then
    alter table public.stores
      add constraint stores_devices_check check (devices is null or (devices >= 1 and devices <= 1000));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'store_requests_devices_check') then
    alter table public.store_requests
      add constraint store_requests_devices_check check (devices is null or (devices >= 1 and devices <= 1000));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'store_requests_rythme_connu') then
    alter table public.store_requests
      add constraint store_requests_rythme_connu
        check (billing_period is null or billing_period in ('monthly', 'yearly'));
  end if;
end $$;

-- ── 2. La demande d'ajout de magasin ───────────────────────────────────────
--
-- ⚠️ L'ancienne signature à quatre arguments N'EST PAS SUPPRIMÉE ICI, et c'est
-- délibéré — c'est même le seul endroit de cette migration qui ne soit pas
-- purement additif. Règle du projet : **le code se déploie d'abord, l'objet se
-- retire ensuite** (leçon `get_session_activity`, 19 août 2026). Tant que le
-- site en ligne et la fonction edge `ca-request-store` appellent encore avec un
-- stock et une surface, les supprimer ferait répondre « function does not
-- exist » à un client qui demande un magasin.
--
-- Elle devient donc un **refus lisible**, et rien d'autre. À supprimer dans une
-- migration ultérieure, une fois le site et l'edge déployés.
--
-- ⚠️ Ses quatre paramètres n'ont PLUS de défaut, et c'est ce qui évite
-- l'ambiguïté que le projet a déjà payée deux fois (`p_event_id` le 28 août,
-- `ca_request_store` le 22) : un appel nommé à trois arguments ne peut viser
-- que la nouvelle, un appel à quatre que celle-ci, et un appel à deux la
-- nouvelle seule.

-- Le `drop` puis `create` — et non un `create or replace` — parce qu'on retire
-- les valeurs par défaut de trois paramètres, ce qu'un remplacement ne fait
-- pas. Les deux tiennent dans la même transaction : il n'y a pas de fenêtre.
drop function if exists public.ca_request_store(text, text, integer, integer);

create function public.ca_request_store(
  p_name text, p_message text, p_units integer, p_sqm integer
) returns json
language plpgsql security definer set search_path to 'public'
as $function$
begin
  return json_build_object('success', false, 'error',
    'Le formulaire d''ajout de magasin a changé : rechargez la page, puis indiquez le '
    || 'nombre d''appareils qui comptent en même temps dans ce magasin.');
end;
$function$;

revoke all on function public.ca_request_store(text, text, integer, integer) from public, anon;
grant execute on function public.ca_request_store(text, text, integer, integer)
  to authenticated, service_role;

create or replace function public.ca_request_store(
  p_name text,
  p_message text default '',
  p_devices integer default null
) returns json
language plpgsql security definer set search_path to 'public'
as $function$
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
  -- Le nombre d'appareils est ce qui tarife : sans lui, il n'y a pas de devis
  -- possible, et l'écran le dit avant d'envoyer.
  if p_devices is null or p_devices <= 0 then
    return json_build_object('success', false, 'error',
      'Indiquez le nombre d''appareils qui comptent en même temps dans ce magasin.');
  end if;
  if p_devices > 1000 then
    return json_build_object('success', false, 'error',
      'Ce nombre d''appareils sort de la grille : écrivez-nous, nous construisons le tarif avec vous.');
  end if;
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

  insert into public.store_requests
    (company_id, store_name, message, devices, requested_by, requested_label)
  values
    (v_company, v_name, v_msg, p_devices, auth.uid(), coalesce(v_label, ''))
  returning id into v_id;

  perform public.log_company_action(v_company, 'magasin_demande', v_name,
    json_build_object('message', v_msg, 'appareils', p_devices)::jsonb);

  return json_build_object('success', true, 'id', v_id::text, 'store_name', v_name);
end;
$function$;

-- ⚠️ Les droits se reposent dans la même migration, à chaque fois — et le
-- `revoke` vise `public` ET `anon`. `create or replace` rend EXECUTE à PUBLIC
-- (leçon `20260819172706`), mais un `create` tout court accorde en plus à
-- `anon` par les droits par défaut de Supabase : c'est le constat n°6 du
-- 28 août, et il se reproduit à chaque fonction nouvelle. Relevé ici sur la
-- base réelle après application, pas déduit.
revoke all on function public.ca_request_store(text, text, integer) from public, anon;
grant execute on function public.ca_request_store(text, text, integer)
  to authenticated, service_role;

-- ── 3. La demande d'inscription ────────────────────────────────────────────
-- Chaque magasin déclaré porte désormais `devices`. `units` et `sqm` restent
-- acceptés et bornés : le formulaire ne les envoie plus, mais une charge qui
-- les porterait encore ne doit pas passer sans contrôle.

create or replace function public.submit_company_request_detailed(
  p_company_name text, p_first_name text, p_last_name text, p_email text, p_phone text,
  p_store_count integer, p_message text default '', p_siren text default null,
  p_stores jsonb default '[]'::jsonb, p_ape text default null
) returns json
language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_id uuid;
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_siren text := nullif(regexp_replace(coalesce(p_siren, ''), '\D', '', 'g'), '');
  v_ape text := nullif(left(btrim(coalesce(p_ape, '')), 8), '');
  v_stores jsonb := coalesce(p_stores, '[]'::jsonb);
  v_propre jsonb := '[]'::jsonb;
  v_ligne jsonb;
  v_nom text;
  v_devices numeric;
  v_units numeric;
  v_sqm numeric;
  v_count int;
begin
  if coalesce(btrim(p_company_name), '') = '' then
    return json_build_object('success', false, 'error', 'Le nom de l''entreprise est requis.');
  end if;
  if coalesce(btrim(p_first_name), '') = '' or coalesce(btrim(p_last_name), '') = '' then
    return json_build_object('success', false, 'error', 'Le prénom et le nom du contact sont requis.');
  end if;
  if v_email = '' or position('@' in v_email) = 0 then
    return json_build_object('success', false, 'error', 'Adresse e-mail invalide.');
  end if;

  -- Bornes de longueur (20260828130001), avant la limitation de débit.
  if length(btrim(p_company_name)) > 80 then
    return json_build_object('success', false,
      'error', 'Le nom de l''entreprise ne peut pas dépasser 80 caractères.');
  end if;
  if length(btrim(p_first_name)) > 80 or length(btrim(p_last_name)) > 80 then
    return json_build_object('success', false,
      'error', 'Le prénom et le nom ne peuvent pas dépasser 80 caractères.');
  end if;
  if length(v_email) > 254 then
    return json_build_object('success', false,
      'error', 'Cette adresse e-mail est trop longue.');
  end if;
  if length(btrim(coalesce(p_phone, ''))) > 30 then
    return json_build_object('success', false,
      'error', 'Ce numéro de téléphone est trop long.');
  end if;
  if length(btrim(coalesce(p_message, ''))) > 2000 then
    return json_build_object('success', false,
      'error', 'Votre message dépasse 2 000 caractères. Dites-nous l''essentiel, nous vous rappelons.');
  end if;

  if v_siren is not null and not public.siren_valide(v_siren) then
    return json_build_object('success', false,
      'error', 'Ces neuf chiffres ne forment pas un SIREN valide.');
  end if;

  if v_siren is null then
    v_ape := null;
  end if;

  if jsonb_typeof(v_stores) <> 'array' then
    v_stores := '[]'::jsonb;
  end if;

  for v_ligne in select * from jsonb_array_elements(v_stores) loop
    v_nom := btrim(coalesce(v_ligne ->> 'name', ''));
    begin
      v_devices := nullif(v_ligne ->> 'devices', '')::numeric;
      v_units := nullif(v_ligne ->> 'units', '')::numeric;
      v_sqm := nullif(v_ligne ->> 'sqm', '')::numeric;
    exception when others then
      return json_build_object('success', false,
        'error', 'Le nombre d''appareils doit être un nombre.');
    end;
    if v_devices is not null and (v_devices < 1 or v_devices > 1000) then
      return json_build_object('success', false,
        'error', 'Le nombre d''appareils par magasin doit être compris entre 1 et 1 000.');
    end if;
    if v_units is not null and (v_units < 0 or v_units > 100000000) then
      return json_build_object('success', false, 'error', 'Volume de stock hors limites.');
    end if;
    if v_sqm is not null and (v_sqm < 0 or v_sqm > 1000000) then
      return json_build_object('success', false, 'error', 'Surface hors limites.');
    end if;
    v_propre := v_propre || jsonb_build_object(
      'name', left(v_nom, 80), 'devices', v_devices, 'units', v_units, 'sqm', v_sqm);
  end loop;

  v_count := greatest(jsonb_array_length(v_propre), coalesce(p_store_count, 0));
  if v_count < 1 or v_count > 500 then
    return json_build_object('success', false,
      'error', 'Le nombre de magasins doit être compris entre 1 et 500.');
  end if;

  -- Le verrou (M3, rétabli par 20260828120001). Il ne renseigne plus personne
  -- depuis que la réponse est uniforme, mais il protège de l'inondation.
  if not public.rate_limit_ok('company_request', v_email, 5, interval '1 hour')
     or not public.rate_limit_ok('company_request_ip', public.client_ip(), 20, interval '1 hour') then
    return json_build_object('success', false,
      'error', 'Trop de tentatives depuis cette adresse. Réessayez dans une heure.');
  end if;

  -- Une demande déjà en cours n'est pas une erreur : c'est une issue, et elle
  -- se dit par e-mail à qui possède l'adresse. Rien n'est créé deux fois.
  if exists (select 1 from public.company_requests
             where lower(contact_email) = v_email
               and status in ('pending','quoted','accepted','paid')) then
    return json_build_object('success', true, 'outcome', 'request_pending',
      'email', v_email, 'first_name', btrim(p_first_name),
      'company_name', btrim(p_company_name));
  end if;

  insert into public.company_requests
    (company_name, contact_first_name, contact_last_name, contact_email, contact_phone,
     store_count, message, siren, stores, ape)
  values
    (btrim(p_company_name), btrim(p_first_name), btrim(p_last_name), v_email,
     coalesce(btrim(p_phone), ''), v_count, coalesce(btrim(p_message), ''),
     v_siren, v_propre, v_ape)
  returning id into v_id;

  return json_build_object('success', true, 'outcome', 'created',
    'request_id', v_id::text, 'email', v_email,
    'first_name', btrim(p_first_name), 'company_name', btrim(p_company_name));
end;
$function$;

-- ⚠️ Elle rend le détail (`outcome`), donc elle reste au SEUL rôle serveur :
-- l'ouvrir rouvrirait l'oracle d'énumération que le 28 août a fermé.
revoke all on function public.submit_company_request_detailed(text, text, text, text, text, integer, text, text, jsonb, text) from public, anon, authenticated;
grant execute on function public.submit_company_request_detailed(text, text, text, text, text, integer, text, text, jsonb, text) to service_role;

-- ── 4. Le devis porte son rythme ───────────────────────────────────────────
-- Un devis se règle désormais à l'année OU au mois, comme les trois offres du
-- site public. Le rythme est choisi en console, il voyage jusqu'au PDF, jusqu'à
-- la page publique du devis et jusqu'à Stripe — qui n'ouvre pas la même session
-- selon le cas (paiement unique pour l'année, abonnement pour le mois).
--
-- ⚠️ Les anciennes signatures à cinq arguments sont SUPPRIMÉES : le nouveau
-- paramètre ayant un défaut, Postgres garderait les deux et un appel à cinq
-- deviendrait ambigu.

drop function if exists public.admin_quote_company_request(uuid, text, bigint, text, jsonb);
drop function if exists public.admin_quote_store_request(uuid, text, bigint, text, jsonb);

create or replace function public.admin_quote_company_request(
  p_id uuid, p_reference text, p_amount_cents bigint,
  p_note text default '', p_lines jsonb default '[]'::jsonb,
  p_billing_period text default 'yearly'
) returns json
language plpgsql security definer set search_path to 'public'
as $function$
declare v_req public.company_requests%rowtype; v_token uuid; v_n int; v_lignes int;
begin
  if not public.is_admin() then return json_build_object('success', false, 'error', 'Accès refusé'); end if;
  if p_amount_cents is null or p_amount_cents < 0 then
    return json_build_object('success', false, 'error', 'Montant invalide');
  end if;
  if p_billing_period not in ('monthly', 'yearly') then
    return json_build_object('success', false, 'error', 'Rythme de paiement inconnu.');
  end if;

  select store_count into v_n from public.company_requests where id = p_id;
  if v_n is null then
    return json_build_object('success', false, 'error', 'Demande introuvable ou déjà traitée');
  end if;
  v_lignes := jsonb_array_length(coalesce(p_lines, '[]'::jsonb));
  if v_lignes <> 0 and v_lignes <> v_n then
    return json_build_object('success', false, 'error',
      'Le devis porte ' || v_lignes || ' ligne(s) pour ' || v_n ||
      ' magasin(s) déclaré(s) : ce sont les lignes qui seront créées et facturées.');
  end if;

  v_token := gen_random_uuid();
  update public.company_requests
     set status = 'quoted',
         quote_reference = coalesce(btrim(p_reference), ''),
         quote_amount_cents = p_amount_cents,
         quote_lines = coalesce(p_lines, '[]'::jsonb),
         billing_period = p_billing_period,
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
    json_build_object('reference', v_req.quote_reference, 'montant_cents', p_amount_cents,
                      'rythme', p_billing_period)::jsonb);
  return json_build_object(
    'success', true, 'token', v_token,
    'quote', json_build_object(
      'reference', v_req.quote_reference, 'amount_cents', v_req.quote_amount_cents,
      'lines', v_req.quote_lines, 'company_name', v_req.company_name,
      'store_count', v_req.store_count, 'billing_period', v_req.billing_period,
      'contact_first_name', v_req.contact_first_name, 'contact_last_name', v_req.contact_last_name,
      'contact_email', v_req.contact_email, 'siren', v_req.siren,
      'sent_at', v_req.quote_sent_at, 'expires_at', v_req.quote_expires_at));
end;
$function$;

revoke all on function public.admin_quote_company_request(uuid, text, bigint, text, jsonb, text) from public, anon;
grant execute on function public.admin_quote_company_request(uuid, text, bigint, text, jsonb, text)
  to authenticated, service_role;

create or replace function public.admin_quote_store_request(
  p_id uuid, p_reference text, p_amount_cents bigint,
  p_note text default '', p_lines jsonb default '[]'::jsonb,
  p_billing_period text default 'yearly'
) returns json
language plpgsql security definer set search_path to 'public'
as $function$
declare v_req public.store_requests%rowtype; v_token uuid; v_company text;
begin
  if not public.is_admin() then return json_build_object('success', false, 'error', 'Accès refusé'); end if;
  if p_amount_cents is null or p_amount_cents < 0 then
    return json_build_object('success', false, 'error', 'Montant invalide');
  end if;
  if p_billing_period not in ('monthly', 'yearly') then
    return json_build_object('success', false, 'error', 'Rythme de paiement inconnu.');
  end if;
  -- `for update` : le second clic attend, relit la ligne transformée, et son
  -- propre contrôle de statut le refuse (VR-005, 28 août 2026).
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
         billing_period = p_billing_period,
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
    json_build_object('reference', v_req.quote_reference, 'montant_cents', p_amount_cents,
                      'rythme', p_billing_period)::jsonb);
  return json_build_object(
    'success', true, 'token', v_token,
    'quote', json_build_object(
      'reference', v_req.quote_reference, 'amount_cents', v_req.quote_amount_cents,
      'lines', v_req.quote_lines, 'company_name', coalesce(v_company, ''),
      'store_name', v_req.store_name, 'store_count', 1,
      'billing_period', v_req.billing_period,
      'contact_first_name', (select p.first_name from public.profiles p where p.id = v_req.requested_by),
      'contact_last_name', (select p.last_name from public.profiles p where p.id = v_req.requested_by),
      'contact_email', (select lower(u.email::text) from auth.users u where u.id = v_req.requested_by),
      'siren', null,
      'sent_at', v_req.quote_sent_at, 'expires_at', v_req.quote_expires_at));
end;
$function$;

revoke all on function public.admin_quote_store_request(uuid, text, bigint, text, jsonb, text) from public, anon;
grant execute on function public.admin_quote_store_request(uuid, text, bigint, text, jsonb, text)
  to authenticated, service_role;

-- ── 5. Le rythme voyage jusqu'à la page publique et jusqu'à Stripe ─────────
-- `quote_by_token` sert la page `/devis/<jeton>` ; `accept_quote_by_token` sert
-- la fonction edge, qui doit savoir quelle session Stripe ouvrir. Les deux
-- rendent donc `billing_period`. Le reste est inchangé, à la ligne près.

create or replace function public.quote_by_token(p_token uuid)
returns json language plpgsql stable security definer set search_path to 'public'
as $function$
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
      'billing_period', coalesce(v_req.billing_period, 'yearly'),
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
    'billing_period', coalesce(v_sto.billing_period, 'yearly'),
    'status', v_sto.status,
    'sent_at', v_sto.quote_sent_at,
    'expires_at', v_sto.quote_expires_at,
    'accepted_at', v_sto.accepted_at,
    'declined_at', v_sto.declined_at,
    'expired', v_sto.quote_expires_at is not null and v_sto.quote_expires_at < now());
end;
$function$;

revoke all on function public.quote_by_token(uuid) from public;
grant execute on function public.quote_by_token(uuid) to anon, authenticated, service_role;

create or replace function public.accept_quote_by_token(p_token uuid)
returns json language plpgsql security definer set search_path to 'public'
as $function$
declare v_req public.company_requests%rowtype; v_sto public.store_requests%rowtype; v_company text;
begin
  if p_token is null then
    return json_build_object('success', false, 'error', 'Lien invalide.');
  end if;
  if not public.rate_limit_ok('accept_quote', p_token::text, 10, interval '1 hour') then
    return json_build_object('success', false, 'error', 'Trop de tentatives. Réessayez dans une heure.');
  end if;

  select * into v_req from public.company_requests where quote_token = p_token;
  if found then
    if v_req.status in ('accepted', 'paid', 'created') then
      return json_build_object('success', true, 'already', true, 'kind', 'company',
        'request_id', v_req.id, 'status', v_req.status,
        'checkout_session_id', v_req.stripe_checkout_session_id,
        'accepted_at', v_req.accepted_at, 'company_name', v_req.company_name,
        'reference', v_req.quote_reference, 'amount_cents', v_req.quote_amount_cents,
        'billing_period', coalesce(v_req.billing_period, 'yearly'),
        'contact_email', v_req.contact_email, 'contact_first_name', v_req.contact_first_name);
    end if;
    if v_req.status <> 'quoted' then
      return json_build_object('success', false, 'error', 'Ce devis n''est plus en attente d''accord.');
    end if;
    if v_req.quote_expires_at is not null and v_req.quote_expires_at < now() then
      return json_build_object('success', false, 'error',
        'Ce devis a expiré. Demandez-nous une nouvelle proposition.');
    end if;

    -- La garde de transition (VR-006, 28 août 2026) : un refus concurrent ne
    -- doit pas écraser une acceptation, et réciproquement.
    update public.company_requests
       set status = 'accepted', accepted_at = now(), updated_at = now()
     where id = v_req.id and status = 'quoted'
    returning * into v_req;
    if not found then
      return json_build_object('success', false, 'error', 'Ce devis n''est plus en attente d''accord.');
    end if;

    return json_build_object(
      'success', true, 'already', false, 'kind', 'company',
      'request_id', v_req.id, 'status', v_req.status,
      'accepted_at', v_req.accepted_at,
      'company_name', v_req.company_name,
      'reference', v_req.quote_reference,
      'amount_cents', v_req.quote_amount_cents,
      'billing_period', coalesce(v_req.billing_period, 'yearly'),
      'contact_email', v_req.contact_email,
      'contact_first_name', v_req.contact_first_name);
  end if;

  select * into v_sto from public.store_requests where quote_token = p_token;
  if not found then
    return json_build_object('success', false, 'error', 'Lien invalide.');
  end if;
  if v_sto.kind <> 'add' then
    return json_build_object('success', false, 'error', 'Lien invalide.');
  end if;
  select c.name into v_company from public.companies c where c.id = v_sto.company_id;

  if v_sto.status in ('accepted', 'paid', 'created') then
    return json_build_object('success', true, 'already', true, 'kind', 'store',
      'request_id', v_sto.id, 'status', v_sto.status,
      'checkout_session_id', v_sto.stripe_checkout_session_id,
      'accepted_at', v_sto.accepted_at, 'company_name', coalesce(v_company, ''),
      'store_name', v_sto.store_name,
      'reference', v_sto.quote_reference, 'amount_cents', v_sto.quote_amount_cents,
      'billing_period', coalesce(v_sto.billing_period, 'yearly'),
      'contact_email', (select lower(u.email::text) from auth.users u where u.id = v_sto.requested_by),
      'contact_first_name', (select p.first_name from public.profiles p where p.id = v_sto.requested_by));
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
    'request_id', v_sto.id, 'status', v_sto.status,
    'accepted_at', v_sto.accepted_at,
    'company_name', coalesce(v_company, ''),
    'store_name', v_sto.store_name,
    'reference', v_sto.quote_reference,
    'amount_cents', v_sto.quote_amount_cents,
    'billing_period', coalesce(v_sto.billing_period, 'yearly'),
    'contact_email', (select lower(u.email::text) from auth.users u where u.id = v_sto.requested_by),
    'contact_first_name', (select p.first_name from public.profiles p where p.id = v_sto.requested_by));
end;
$function$;

revoke all on function public.accept_quote_by_token(uuid) from public;
grant execute on function public.accept_quote_by_token(uuid) to anon, authenticated, service_role;

-- ── 6. La création reporte les appareils, et ce que le magasin vaut à l'an ──
--
-- Deux ajouts, le reste est inchangé — verrous de ligne (VR-001), idempotence
-- par événement Stripe, gardes de transition compris.
--
-- 1. `stores.devices` reçoit ce qui a été déclaré : c'est l'assiette, elle doit
--    survivre à la demande qui l'a portée. Sans elle, on ne saurait plus, six
--    mois après, pour combien d'appareils un magasin a été facturé.
-- 2. `annual_price_cents` suit la règle des lignes (voir l'en-tête) :
--    `annuelCents` s'il est là, `prixCents` sinon. Le repli sans ligne, lui,
--    annualise selon le rythme — c'est le seul cas où le rythme décide, parce
--    que c'est le seul où il n'y a aucune ligne pour le dire.

create or replace function public.fulfil_paid_request(
  p_session_id text, p_customer_id text default null, p_invoice_id text default null,
  p_payment_intent_id text default null, p_event_id text default null,
  p_subscription_id text default null
) returns json
language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_req public.company_requests%rowtype;
  v_sto public.store_requests%rowtype;
  v_company_id uuid; v_company_code text; v_store_code text;
  v_name text; v_i int; v_n int; v_stores json[] := '{}';
  v_email text; v_first text; v_company text;
  v_prix bigint; v_annuel bigint; v_devices integer; v_ligne jsonb; v_decl jsonb;
  v_evt text := nullif(btrim(coalesce(p_event_id, '')), '');
  v_sub text := nullif(btrim(coalesce(p_subscription_id, '')), '');
begin
  if p_session_id is null or btrim(p_session_id) = '' then
    return json_build_object('success', false, 'error', 'Session absente');
  end if;

  if v_evt is not null then
    insert into public.stripe_events_traites (event_id) values (v_evt)
      on conflict (event_id) do nothing;
    if not found then
      return json_build_object('success', true, 'already', true,
        'kind', 'evenement', 'event_id', v_evt);
    end if;
  end if;

  select * into v_req from public.company_requests
   where stripe_checkout_session_id = p_session_id
     for update;
  if found then
    if v_req.status in ('paid', 'created') then
      return json_build_object('success', true, 'already', true, 'kind', 'company',
        'status', v_req.status, 'company_id', v_req.company_id);
    end if;
    if v_req.status <> 'accepted' then
      return json_build_object('success', false, 'error',
        'Transition impossible depuis ' || v_req.status);
    end if;

    update public.company_requests
       set status = 'paid', paid_at = now(),
           stripe_customer_id = coalesce(p_customer_id, stripe_customer_id),
           stripe_invoice_id = coalesce(p_invoice_id, stripe_invoice_id),
           stripe_payment_intent_id = coalesce(p_payment_intent_id, stripe_payment_intent_id),
           updated_at = now()
     where id = v_req.id and status = 'accepted';
    if not found then
      return json_build_object('success', true, 'already', true, 'kind', 'company',
        'status', 'paid', 'company_id', v_req.company_id);
    end if;

    v_n := coalesce(nullif(jsonb_array_length(coalesce(v_req.quote_lines, '[]'::jsonb)), 0),
                    v_req.store_count);

    v_company_code := public.gen_company_code();
    insert into public.companies (name, join_code, plan, billing_period,
                                  stripe_customer_id, stripe_subscription_id)
      values (v_req.company_name, v_company_code,
              coalesce(v_req.plan, 'standard'), v_req.billing_period,
              p_customer_id, v_sub)
      returning id into v_company_id;

    for v_i in 1..v_n loop
      v_ligne := v_req.quote_lines -> (v_i - 1);
      v_decl  := v_req.stores -> (v_i - 1);
      v_name := coalesce(nullif(btrim(v_ligne ->> 'libelle'), ''),
                         nullif(btrim(v_decl ->> 'name'), ''),
                         'Magasin ' || v_i);
      if v_ligne ? 'prixCents' and (v_ligne ->> 'prixCents') is not null then
        v_prix := (v_ligne ->> 'prixCents')::bigint;
        v_annuel := coalesce(nullif(v_ligne ->> 'annuelCents', '')::bigint, v_prix);
      else
        -- Aucune ligne chiffrée : le total réparti, annualisé si le devis est
        -- mensuel. C'est le seul endroit où le rythme décide.
        v_prix := case when v_req.quote_amount_cents is not null and v_n > 0
                       then v_req.quote_amount_cents / v_n end;
        v_annuel := case when v_req.billing_period = 'monthly' then v_prix * 12 else v_prix end;
      end if;
      v_devices := coalesce(nullif(btrim(coalesce(v_ligne ->> 'appareils', '')), '')::integer,
                            nullif(btrim(coalesce(v_decl ->> 'devices', '')), '')::integer);
      v_store_code := public.gen_store_code();
      insert into public.stores (company_id, name, join_code, annual_price_cents, devices, units, sqm)
        values (v_company_id, v_name, v_store_code, v_annuel, v_devices,
                nullif(btrim(coalesce(v_decl ->> 'units', '')), '')::integer,
                nullif(btrim(coalesce(v_decl ->> 'sqm', '')), '')::integer);
      v_stores := v_stores || json_build_object('name', v_name, 'join_code', v_store_code,
                                                'price_cents', v_prix, 'devices', v_devices);
    end loop;

    update public.company_requests
       set status = 'created', company_id = v_company_id, updated_at = now()
     where id = v_req.id;

    perform public.log_system_action('Stripe', 'paiement_recu', 'demande_entreprise', v_req.id::text,
      v_req.company_name, json_build_object('session', p_session_id,
        'montant_cents', v_req.quote_amount_cents, 'plan', v_req.plan,
        'rythme', v_req.billing_period)::jsonb);
    perform public.log_system_action('Stripe', 'entreprise_creee_depuis_demande', 'entreprise', v_company_id::text,
      v_req.company_name, json_build_object('demande_id', v_req.id::text, 'magasins', v_n,
        'plan', coalesce(v_req.plan, 'standard'))::jsonb);

    return json_build_object(
      'success', true, 'already', false, 'kind', 'company',
      'company_id', v_company_id, 'company_name', v_req.company_name,
      'plan', coalesce(v_req.plan, 'standard'), 'billing_period', v_req.billing_period,
      'stores', array_to_json(v_stores),
      'invite', json_build_object(
        'email', lower(v_req.contact_email),
        'first_name', v_req.contact_first_name,
        'last_name', v_req.contact_last_name));
  end if;

  select * into v_sto from public.store_requests
   where stripe_checkout_session_id = p_session_id
     for update;
  if not found then
    return json_build_object('success', false, 'error', 'Session inconnue');
  end if;
  if v_sto.status in ('paid', 'created') then
    return json_build_object('success', true, 'already', true, 'kind', 'store',
      'status', v_sto.status, 'store_id', v_sto.store_id);
  end if;
  if v_sto.status <> 'accepted' then
    return json_build_object('success', false, 'error',
      'Transition impossible depuis ' || v_sto.status);
  end if;

  update public.store_requests
     set status = 'paid', paid_at = now(),
         stripe_customer_id = coalesce(p_customer_id, stripe_customer_id),
         stripe_invoice_id = coalesce(p_invoice_id, stripe_invoice_id),
         stripe_payment_intent_id = coalesce(p_payment_intent_id, stripe_payment_intent_id)
   where id = v_sto.id and status = 'accepted';
  if not found then
    return json_build_object('success', true, 'already', true, 'kind', 'store',
      'status', 'paid', 'store_id', v_sto.store_id);
  end if;

  -- Une demande de magasin ne vient jamais de la souscription en ligne : ici le
  -- rythme peut annualiser sans réserve.
  v_annuel := coalesce(
    nullif(v_sto.quote_lines -> 0 ->> 'annuelCents', '')::bigint,
    case when v_sto.billing_period = 'monthly' then v_sto.quote_amount_cents * 12
         else v_sto.quote_amount_cents end);

  v_store_code := public.gen_store_code();
  insert into public.stores (company_id, name, join_code, annual_price_cents, devices, units, sqm)
    values (v_sto.company_id, v_sto.store_name, v_store_code, v_annuel,
            v_sto.devices, v_sto.units, v_sto.sqm)
    returning id into v_company_id;

  update public.store_requests
     set status = 'created', handled_at = now(), store_id = v_company_id
   where id = v_sto.id;

  select c.name into v_company from public.companies c where c.id = v_sto.company_id;
  select lower(u.email::text), p.first_name into v_email, v_first
    from public.profiles p join auth.users u on u.id = p.id
   where p.id = v_sto.requested_by;

  perform public.log_system_action('Stripe', 'paiement_recu', 'demande_magasin', v_sto.id::text,
    v_sto.store_name, json_build_object('session', p_session_id,
      'montant_cents', v_sto.quote_amount_cents, 'rythme', v_sto.billing_period)::jsonb);
  perform public.log_system_action('Stripe', 'magasin_ajoute', 'entreprise', v_sto.company_id::text,
    v_sto.store_name, json_build_object('entreprise', coalesce(v_company, ''), 'magasin', v_company_id::text)::jsonb);

  return json_build_object(
    'success', true, 'already', false, 'kind', 'store',
    'store_id', v_company_id, 'store_name', v_sto.store_name,
    'company_id', v_sto.company_id, 'company_name', coalesce(v_company, ''),
    'notify', case when v_email is null then null else json_build_object(
      'email', v_email, 'first_name', coalesce(v_first, ''),
      'store_name', v_sto.store_name, 'company_name', coalesce(v_company, ''),
      'store_id', v_company_id::text) end);
end;
$function$;

-- ⚠️ Le webhook n'a pas de session : cette fonction reste au SEUL `service_role`.
revoke all on function public.fulfil_paid_request(text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.fulfil_paid_request(text, text, text, text, text, text) to service_role;
