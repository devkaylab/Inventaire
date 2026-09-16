-- Les conditions générales acceptées, et l'adresse des magasins déclarés
-- (16 septembre 2026).
--
-- Julien, après la revue des documents légaux : « fais 1 et 2 ».
--   1. Les conditions générales n'étaient acceptées nulle part. Chaque dépôt
--      qui ouvre un paiement exige désormais la version EN VIGUEUR, et la
--      consigne avec sa date — c'est la preuve de l'acceptation.
--   2. L'article 9.5 (usage limité aux magasins déclarés) se prouvait mal : le
--      produit ne demandait que le NOM d'un magasin. L'adresse est exigée à la
--      déclaration, et suit le magasin jusqu'à sa création.
--
-- ⚠️ Les trois dépôts perdent leur ancienne signature (DROP puis CREATE) : un
-- paramètre de plus sur une fonction existante laisserait les deux versions en
-- base, et l'ancienne ne demanderait rien. Les droits sont reposés à la fin.

-- ─── Les colonnes ──────────────────────────────────────────────────────────

alter table public.stores add column if not exists address text;
alter table public.stores drop constraint if exists stores_address_longueur;
alter table public.stores add constraint stores_address_longueur
  check (address is null or length(address) <= 200);

alter table public.company_requests add column if not exists cgv_version text;
alter table public.company_requests add column if not exists cgv_acceptees_le timestamptz;

alter table public.store_requests add column if not exists address text;
alter table public.store_requests add column if not exists cgv_version text;
alter table public.store_requests add column if not exists cgv_acceptees_le timestamptz;
alter table public.store_requests drop constraint if exists store_requests_address_longueur;
alter table public.store_requests add constraint store_requests_address_longueur
  check (address is null or length(address) <= 200);

-- ─── Les deux utilitaires ──────────────────────────────────────────────────

-- ⚠️ JUMELLE DE `VERSION_CONDITIONS` dans `web/lib/conditions.ts`. Un test
-- compare les deux : changer le texte substantiellement, c'est changer les deux.
create or replace function public.version_conditions()
returns text
language sql
immutable
set search_path = public
as $function$ select '2026-09-16'::text $function$;

-- Une adresse de magasin : détourée, espaces resserrés, entre 8 et 200
-- caractères. `null` si elle ne passe pas — c'est le refus.
create or replace function public.adresse_propre(p text)
returns text
language sql
immutable
set search_path = public
as $function$
  select case
    when length(v) between 8 and 200 then v
  end
  from (select regexp_replace(btrim(coalesce(p, '')), '\s+', ' ', 'g') as v) x
$function$;

revoke all on function public.version_conditions() from public, anon, authenticated;
grant execute on function public.version_conditions() to service_role;
revoke all on function public.adresse_propre(text) from public, anon, authenticated;
grant execute on function public.adresse_propre(text) to service_role;

-- ─── Les dépôts ────────────────────────────────────────────────────────────

drop function if exists public.finaliser_inscription(text, text, text, text, text, text, jsonb, text);
create or replace function public.finaliser_inscription(p_company_name text, p_siren text, p_ape text, p_first text, p_last text, p_phone text, p_stores jsonb, p_billing_period text, p_cgv_version text)
returns json
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_uid    uuid := auth.uid();
  v_email  text;
  v_nom    text := btrim(coalesce(p_company_name, ''));
  v_first  text := btrim(coalesce(p_first, ''));
  v_last   text := btrim(coalesce(p_last, ''));
  v_phone  text := btrim(coalesce(p_phone, ''));
  v_siren  text := nullif(regexp_replace(coalesce(p_siren, ''), '\D', '', 'g'), '');
  v_ape    text := nullif(left(btrim(coalesce(p_ape, '')), 8), '');
  v_stores jsonb := coalesce(p_stores, '[]'::jsonb);
  v_propre jsonb := '[]'::jsonb;
  v_lignes jsonb := '[]'::jsonb;
  v_total  bigint := 0;
  v_annuel bigint := 0;
  v_el     jsonb;
  v_sname  text;
  v_adr    text;
  v_dev    integer;
  v_tarif  jsonb;
  v_id     uuid;
  v_i      int;
begin
  if v_uid is null then
    return json_build_object('success', false, 'error', 'Session absente.');
  end if;
  if p_billing_period is null or p_billing_period not in ('monthly', 'yearly') then
    return json_build_object('success', false, 'error', 'Rythme de paiement inconnu.');
  end if;
  -- ⚠️ Sans acceptation des conditions générales EN VIGUEUR, on n'encaisse
  -- pas (16 septembre 2026). Une page restée ouverte sur une ancienne version
  -- est refusée plutôt que de consigner l'accord sur un texte périmé.
  if p_cgv_version is distinct from public.version_conditions() then
    return json_build_object('success', false, 'code', 'conditions', 'error',
      'Acceptez les conditions générales pour continuer.');
  end if;

  -- ⚠️ Les bornes REFUSENT, elles ne tronquent pas : le nom de l'entreprise
  -- devient `companies.name`, puis figure sur la facture Stripe — une pièce
  -- datée, qui ne se réécrit pas. Règle du 28 août 2026.
  if v_nom = '' or length(v_nom) > 80 then
    return json_build_object('success', false, 'error', 'Le nom de l''entreprise est absent ou trop long.');
  end if;
  if v_first = '' or length(v_first) > 80 or v_last = '' or length(v_last) > 80 then
    return json_build_object('success', false, 'error', 'Le prénom ou le nom est absent ou trop long.');
  end if;
  if length(v_phone) > 30 then
    return json_build_object('success', false, 'error', 'Le téléphone est trop long.');
  end if;
  if v_siren is not null and not public.siren_valide(v_siren) then
    return json_build_object('success', false, 'error', 'Ce SIREN ne semble pas valide.');
  end if;
  if jsonb_typeof(v_stores) <> 'array' or jsonb_array_length(v_stores) < 1 then
    return json_build_object('success', false, 'error', 'Déclarez au moins un magasin.');
  end if;
  if jsonb_array_length(v_stores) > 50 then
    return json_build_object('success', false, 'error', 'Au-delà de cinquante magasins, écrivez-nous.');
  end if;

  -- ⚠️ Une seule demande par compte, et elle ne se rejoue pas : deux demandes
  -- pour un même prospect voudraient dire deux entreprises pour une personne.
  if exists (select 1 from public.inscriptions where user_id = v_uid and demande_id is not null) then
    return json_build_object('success', false, 'code', 'deja_finalise',
      'error', 'Votre inscription est déjà déposée.');
  end if;
  if exists (select 1 from public.profiles where id = v_uid and company_id is not null) then
    return json_build_object('success', false, 'code', 'deja_dans_une_entreprise',
      'error', 'Ce compte appartient déjà à une entreprise.');
  end if;

  select lower(u.email) into v_email from auth.users u where u.id = v_uid;
  if coalesce(v_email, '') = '' then
    return json_build_object('success', false, 'error', 'Adresse introuvable.');
  end if;

  for v_i in 0 .. jsonb_array_length(v_stores) - 1 loop
    v_el    := v_stores -> v_i;
    v_sname := btrim(coalesce(v_el ->> 'name', ''));
    v_dev   := nullif(btrim(coalesce(v_el ->> 'devices', '')), '')::integer;
    v_adr   := public.adresse_propre(v_el ->> 'address');
    if v_sname = '' or length(v_sname) > 80 then
      return json_build_object('success', false, 'error',
        'Chaque magasin doit porter un nom d''au plus 80 caractères.');
    end if;
    -- ⚠️ L'adresse rend l'article 9.5 des conditions opposable : sans elle,
    -- un « magasin non déclaré » se prouve mal (16 septembre 2026).
    if v_adr is null then
      return json_build_object('success', false, 'error',
        'Indiquez l''adresse complète du magasin ' || v_sname || '.');
    end if;
    if v_dev is null or v_dev < 1 then
      return json_build_object('success', false, 'error',
        'Indiquez le nombre d''appareils qui comptent en même temps dans ' || v_sname || '.');
    end if;

    -- ⚠️ `prix_offre` rend `null` au-delà de la borne du libre-service (200
    -- appareils, tranché le 5 septembre 2026) : c'est ELLE qui porte le
    -- plafond, on n'en fait pas une copie ici.
    v_tarif := public.prix_offre(v_dev, p_billing_period);
    if v_tarif is null then
      return json_build_object('success', false, 'code', 'hors_grille', 'error',
        'Au-delà de 200 appareils, l''offre d''un magasin ne se prolonge plus : répartissez-les sur plusieurs magasins, ou écrivez-nous depuis votre messagerie Quantinvo.');
    end if;

    v_total  := v_total  + (v_tarif ->> 'prix_cents')::bigint;
    v_annuel := v_annuel + (v_tarif ->> 'annuel_cents')::bigint;
    v_propre := v_propre || jsonb_build_array(jsonb_build_object('name', v_sname, 'devices', v_dev, 'address', v_adr));
    -- La règle des lignes de devis (2 septembre) : `prixCents` est l'échéance,
    -- `annuelCents` ce que le magasin vaut à l'année.
    v_lignes := v_lignes || jsonb_build_array(jsonb_build_object(
      'libelle', v_sname, 'appareils', v_dev,
      'prixCents', (v_tarif ->> 'prix_cents')::bigint,
      'annuelCents', (v_tarif ->> 'annuel_cents')::bigint,
      -- ⚠️ Le PALIER et les TRANCHES voyagent avec la ligne. Sans eux, la
      -- fonction edge devrait redéduire l'offre du nombre d'appareils —
      -- c'est-à-dire porter une copie des frontières de la grille, la
      -- cinquième. Ici la ligne décrit entièrement ce qui sera facturé.
      'plan', v_tarif ->> 'plan',
      'tranches', (v_tarif ->> 'tranches')::integer));
  end loop;

  -- ⚠️ La demande naît en `accepted` : il n'y a rien à négocier, le prix est
  -- public. C'est exactement ce que fait `deposer_souscription` depuis le
  -- 30 août — et c'est ce qui permet à `fulfil_paid_request` de la mener à
  -- `created` sans que sa garde de transition ne change.
  insert into public.company_requests (
    company_name, contact_first_name, contact_last_name, contact_email, contact_phone,
    store_count, message, status, quote_reference, quote_amount_cents,
    siren, ape, stores, quote_lines, billing_period, plan,
    accepted_at, user_id, source, cgv_version, cgv_acceptees_le)
  values (
    v_nom, v_first, v_last, v_email, v_phone,
    jsonb_array_length(v_propre), '', 'accepted',
    'INS-' || to_char(now() at time zone 'Europe/Paris', 'YYYYMMDD') || '-' ||
      upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 4)),
    v_total, v_siren, v_ape, v_propre, v_lignes, p_billing_period,
    (public.prix_offre((v_propre -> 0 ->> 'devices')::integer, p_billing_period) ->> 'plan'),
    now(), v_uid, 'inscription', p_cgv_version, now())
  returning id into v_id;

  update public.inscriptions
     set demande_id = v_id, etape = 8, updated_at = now()
   where user_id = v_uid;

  return json_build_object('success', true, 'demande_id', v_id,
    'montant_cents', v_total, 'annuel_cents', v_annuel,
    'magasins', jsonb_array_length(v_propre), 'lignes', v_lignes);
end;
$function$;

drop function if exists public.deposer_ajout_magasin(text, integer, text);
create or replace function public.deposer_ajout_magasin(p_name text, p_devices integer, p_billing_period text, p_address text, p_cgv_version text)
returns json
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_company uuid;
  v_name  text := btrim(coalesce(p_name, ''));
  v_label text;
  v_adr   text := public.adresse_propre(p_address);
  v_tarif jsonb;
  v_id    uuid;
begin
  if not public.is_company_admin() then
    return json_build_object('success', false, 'error',
      'Accès réservé à l''administrateur de l''entreprise.');
  end if;
  select company_id into v_company from public.profiles where id = auth.uid();

  if v_name = '' then
    return json_build_object('success', false, 'error', 'Le nom du magasin est requis.');
  end if;
  if length(v_name) > 80 then
    return json_build_object('success', false, 'error', 'Le nom du magasin est trop long.');
  end if;
  if v_adr is null then
    return json_build_object('success', false, 'error',
      'Indiquez l''adresse complète du magasin.');
  end if;
  if p_cgv_version is distinct from public.version_conditions() then
    return json_build_object('success', false, 'code', 'conditions', 'error',
      'Acceptez les conditions générales pour continuer.');
  end if;
  if p_devices is null or p_devices <= 0 then
    return json_build_object('success', false, 'error',
      'Indiquez le nombre d''appareils qui comptent en même temps dans ce magasin.');
  end if;
  -- ⚠️ LA GRILLE S'ARRÊTE À 200 APPAREILS (Julien, 5 septembre 2026) : « au bout
  -- d'un moment on n'ajoute plus d'appareils, on passe par une autre offre.
  -- Possible d'ajouter des appareils jusqu'à 200, au-delà → nouvel abonnement. »
  -- L'abonnement est PAR MAGASIN : une enseigne qui compte à 250 appareils
  -- compte en réalité dans plusieurs lieux, et chacun prend le sien.
  if p_devices > 200 then
    return json_build_object('success', false, 'code', 'hors_grille', 'error',
      'Au-delà de 200 appareils, l''offre d''un magasin ne se prolonge plus : répartissez-les sur plusieurs magasins, ou écrivez-nous depuis votre messagerie Quantinvo.');
  end if;
  if p_billing_period is null or p_billing_period not in ('monthly', 'yearly') then
    return json_build_object('success', false, 'error', 'Rythme de paiement inconnu.');
  end if;
  if exists (select 1 from public.stores s
              where s.company_id = v_company and lower(s.name) = lower(v_name)) then
    return json_build_object('success', false, 'error',
      'Un magasin porte déjà ce nom dans votre entreprise.');
  end if;
  -- Un magasin en cours de paiement n'est pas encore un magasin : sans ce
  -- contrôle, deux clics ouvriraient deux demandes et créeraient deux magasins.
  if exists (select 1 from public.store_requests r
              where r.company_id = v_company
                and r.kind = 'add'
                and r.status in ('pending', 'quoted', 'accepted', 'paid')
                and lower(r.store_name) = lower(v_name)) then
    return json_build_object('success', false, 'error',
      'Une demande est déjà en cours pour ce magasin.');
  end if;

  v_tarif := public.prix_offre(p_devices, p_billing_period);

  select coalesce(nullif(btrim(full_name), ''), '') into v_label
    from public.profiles where id = auth.uid();

  insert into public.store_requests (
    company_id, store_name, address, cgv_version, cgv_acceptees_le,
    message, devices, billing_period,
    requested_by, requested_label,
    status, accepted_at,
    quote_amount_cents, quote_lines, admin_note
  ) values (
    v_company, v_name, v_adr, p_cgv_version, now(),
    '', p_devices, p_billing_period,
    auth.uid(), coalesce(v_label, ''),
    'accepted', now(),
    (v_tarif ->> 'prix_cents')::bigint,
    jsonb_build_array(jsonb_build_object(
      'libelle', v_name,
      'appareils', p_devices,
      'prixCents', (v_tarif ->> 'prix_cents')::bigint,
      'annuelCents', (v_tarif ->> 'annuel_cents')::bigint)),
    'Ajout en libre-service'
  ) returning id into v_id;

  perform public.log_company_action(v_company, 'magasin_demande', v_name,
    json_build_object('appareils', p_devices, 'offre', v_tarif ->> 'plan',
                      'rythme', p_billing_period,
                      'montant_cents', (v_tarif ->> 'prix_cents')::bigint)::jsonb);

  return json_build_object('success', true, 'id', v_id::text,
    'store_name', v_name, 'plan', v_tarif ->> 'plan',
    'plafond', (v_tarif ->> 'plafond')::integer,
    'prix_cents', (v_tarif ->> 'prix_cents')::bigint,
    'billing_period', p_billing_period);
end;
$function$;

drop function if exists public.deposer_souscription(text, text, text, text, text, text, text, bigint, bigint);
create or replace function public.deposer_souscription(p_company_name text, p_first_name text, p_last_name text, p_email text, p_store_name text, p_plan text, p_billing_period text, p_amount_cents bigint, p_annual_cents bigint, p_store_address text, p_cgv_version text)
returns json
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_id uuid;
  v_company text := public.nom_propre(p_company_name);
  v_store text := public.nom_propre(p_store_name);
  v_first text := public.nom_propre(p_first_name);
  v_last text := public.nom_propre(p_last_name);
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_adr text := public.adresse_propre(p_store_address);
begin
  if v_company is null or v_store is null or v_first is null or v_last is null then
    return json_build_object('success', false, 'error', 'Renseignez tous les champs.');
  end if;
  if v_adr is null then
    return json_build_object('success', false, 'error',
      'Indiquez l''adresse complète du magasin.');
  end if;
  if p_cgv_version is distinct from public.version_conditions() then
    return json_build_object('success', false, 'code', 'conditions', 'error',
      'Acceptez les conditions générales pour continuer.');
  end if;
  if v_email = '' or v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    return json_build_object('success', false, 'error', 'Adresse e-mail invalide.');
  end if;
  if length(v_email) > 254 then
    return json_build_object('success', false, 'error', 'Adresse e-mail trop longue.');
  end if;
  if p_plan not in ('essential', 'advanced', 'enterprise') then
    return json_build_object('success', false, 'error', 'Offre inconnue.');
  end if;
  if p_billing_period not in ('monthly', 'yearly') then
    return json_build_object('success', false, 'error', 'Rythme de paiement inconnu.');
  end if;
  if p_amount_cents is null or p_amount_cents <= 0 or p_annual_cents is null or p_annual_cents <= 0 then
    return json_build_object('success', false, 'error', 'Montant absent.');
  end if;

  -- La limitation vient APRES la validation de saisie (une faute de frappe ne
  -- consomme pas le quota) et AVANT la recherche par adresse.
  if not public.rate_limit_ok('souscription', v_email, 5, interval '1 hour') then
    return json_build_object('success', false, 'error',
      'Trop de tentatives pour cette adresse. Reessayez dans une heure.');
  end if;

  -- ⚠️ LE CONTROLE QUI EVITE D'ENCAISSER POUR RIEN.
  -- Un compte deja rattache a une entreprise ne peut pas devenir
  -- administrateur d'une autre : la creation reussirait, l'invitation non.
  if exists (
    select 1 from public.profiles p
     join auth.users u on u.id = p.id
    where lower(u.email::text) = v_email
      and p.company_id is not null
  ) then
    return json_build_object('success', false, 'code', 'compte_existant', 'error',
      'Cette adresse est deja rattachee a une entreprise sur Quantinvo. '
      || 'Demandez vos acces a son administrateur, ou souscrivez avec une autre adresse.');
  end if;

  -- Une invitation en attente ailleurs bloquerait de la meme facon.
  if exists (select 1 from public.team_invitations where lower(email) = v_email) then
    return json_build_object('success', false, 'code', 'invitation_en_cours', 'error',
      'Une invitation est deja en attente pour cette adresse. '
      || 'Ouvrez-la pour creer votre mot de passe, ou souscrivez avec une autre adresse.');
  end if;

  -- Une souscription deja payee, dont la creation est en cours.
  if exists (
    select 1 from public.company_requests
     where contact_email = v_email
       and admin_note = 'Souscription en ligne'
       and status in ('paid', 'created')
  ) then
    return json_build_object('success', false, 'code', 'deja_souscrit', 'error',
      'Une souscription existe deja pour cette adresse. '
      || 'Verifiez votre boite de reception, ou ecrivez-nous.');
  end if;

  insert into public.company_requests (
    company_name, contact_first_name, contact_last_name, contact_email,
    store_count, status, accepted_at, plan, billing_period,
    quote_amount_cents, quote_lines, stores, admin_note, cgv_version, cgv_acceptees_le
  ) values (
    v_company, v_first, v_last, v_email,
    1, 'accepted', now(), p_plan, p_billing_period,
    p_annual_cents,
    jsonb_build_array(jsonb_build_object('libelle', v_store, 'prixCents', p_annual_cents)),
    jsonb_build_array(jsonb_build_object('name', v_store, 'address', v_adr)),
    'Souscription en ligne', p_cgv_version, now()
  ) returning id into v_id;

  perform public.log_system_action('Souscription', 'souscription_deposee', 'demande_entreprise',
    v_id::text, v_company,
    json_build_object('plan', p_plan, 'rythme', p_billing_period,
                      'montant_cents', p_amount_cents)::jsonb);

  return json_build_object('success', true, 'request_id', v_id);
end; $function$;

-- ─── La création au paiement ───────────────────────────────────────────────

create or replace function public.fulfil_paid_request(p_session_id text, p_customer_id text DEFAULT NULL::text, p_invoice_id text DEFAULT NULL::text, p_payment_intent_id text DEFAULT NULL::text, p_event_id text DEFAULT NULL::text, p_subscription_id text DEFAULT NULL::text)
returns json
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_req public.company_requests%rowtype;
  v_sto public.store_requests%rowtype;
  v_company_id uuid; v_company_code text; v_store_code text;
  v_name text; v_i int; v_n int; v_stores json[] := '{}';
  v_email text; v_first text; v_company text;
  v_prix bigint; v_annuel bigint; v_devices integer; v_ligne jsonb; v_decl jsonb;
  v_evt text := nullif(btrim(coalesce(p_event_id, '')), '');
  v_promu json;
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
        v_prix := case when v_req.quote_amount_cents is not null and v_n > 0
                       then v_req.quote_amount_cents / v_n end;
        v_annuel := case when v_req.billing_period = 'monthly' then v_prix * 12 else v_prix end;
      end if;
      v_devices := coalesce(nullif(btrim(coalesce(v_ligne ->> 'appareils', '')), '')::integer,
                            nullif(btrim(coalesce(v_decl ->> 'devices', '')), '')::integer);
      v_store_code := public.gen_store_code();
      -- L'adresse déclarée suit le magasin (16 septembre 2026) : c'est elle qui
      -- rend opposable l'article 9.5 des conditions générales.
      insert into public.stores (company_id, name, join_code, annual_price_cents, devices, units, sqm, address)
        values (v_company_id, v_name, v_store_code, v_annuel, v_devices,
                nullif(btrim(coalesce(v_decl ->> 'units', '')), '')::integer,
                nullif(btrim(coalesce(v_decl ->> 'sqm', '')), '')::integer,
                public.adresse_propre(v_decl ->> 'address'));
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

    -- ⚠️ LE PROSPECT A DÉJÀ UN COMPTE, ET ON PROMEUT CELUI-LÀ (5 septembre
    -- 2026). `invite_company_admin_after_payment` refuse une adresse qui a déjà
    -- un compte — c'est la garde VR-003 — donc le parcours d'inscription
    -- l'aurait vue échouer : le client paie et n'obtient rien, exactement le
    -- défaut vécu en vrai le 30 août sur la souscription en ligne.
    --
    -- ⚠️ ON PROMEUT `user_id`, JAMAIS L'ADRESSE RELUE. Quelqu'un qui change
    -- d'adresse entre le dépôt et l'encaissement se verrait sinon attribuer
    -- l'entreprise d'un autre. Le compte est noté sur la demande à sa naissance.
    if v_req.user_id is not null then
      v_promu := public.promouvoir_admin_apres_paiement(v_company_id, v_req.user_id);
    end if;

    return json_build_object(
      'success', true, 'already', false, 'kind', 'company',
      'company_id', v_company_id, 'company_name', v_req.company_name,
      'plan', coalesce(v_req.plan, 'standard'), 'billing_period', v_req.billing_period,
      'stores', array_to_json(v_stores),
      'promu', v_promu,
      'invite', case when v_req.user_id is not null then null else json_build_object(
        'email', lower(v_req.contact_email),
        'first_name', v_req.contact_first_name,
        'last_name', v_req.contact_last_name) end);
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

  v_annuel := coalesce(
    nullif(v_sto.quote_lines -> 0 ->> 'annuelCents', '')::bigint,
    case when v_sto.billing_period = 'monthly' then v_sto.quote_amount_cents * 12
         else v_sto.quote_amount_cents end);

  -- ⚠️ UN CHANGEMENT D'OFFRE MET À JOUR, IL NE CRÉE RIEN.
  -- Le magasin existe depuis le dépôt de la demande ; passer par la création
  -- d'en dessous en fabriquerait un second, avec un second code d'accès.
  if v_sto.kind = 'offre' then
    if v_sto.store_id is null then
      return json_build_object('success', false, 'error', 'Magasin absent de la demande');
    end if;

    update public.stores
       set devices = v_sto.devices,
           annual_price_cents = v_annuel,
           -- ⚠️ L'ABONNEMENT SE NOTE SUR LE MAGASIN, PAS SEULEMENT SUR
           -- L'ENTREPRISE. Voir le commentaire de la branche d'ajout.
           stripe_subscription_id = coalesce(v_sub, stripe_subscription_id)
     where id = v_sto.store_id;

    -- L'entreprise n'avait pas d'abonnement (c'est la condition du dépôt) :
    -- celui-ci devient le sien. On n'écrase JAMAIS un abonnement existant —
    -- ce serait perdre la trace de ce que le client paie déjà.
    update public.companies
       set stripe_customer_id = coalesce(stripe_customer_id, p_customer_id),
           stripe_subscription_id = coalesce(stripe_subscription_id, v_sub),
           billing_period = coalesce(v_sto.billing_period, billing_period)
     where id = v_sto.company_id;

    update public.store_requests
       set status = 'created', handled_at = now()
     where id = v_sto.id;

    select c.name into v_company from public.companies c where c.id = v_sto.company_id;
    select lower(u.email::text), p.first_name into v_email, v_first
      from public.profiles p join auth.users u on u.id = p.id
     where p.id = v_sto.requested_by;

    perform public.log_system_action('Stripe', 'paiement_recu', 'demande_offre', v_sto.id::text,
      v_sto.store_name, json_build_object('session', p_session_id,
        'montant_cents', v_sto.quote_amount_cents, 'rythme', v_sto.billing_period)::jsonb);
    perform public.log_system_action('Stripe', 'offre_changee', 'magasin', v_sto.store_id::text,
      v_sto.store_name, json_build_object('entreprise', coalesce(v_company, ''),
        'appareils', v_sto.devices, 'annuel_cents', v_annuel)::jsonb);

    return json_build_object(
      'success', true, 'already', false, 'kind', 'store_offer',
      'store_id', v_sto.store_id, 'store_name', v_sto.store_name,
      'devices', v_sto.devices,
      'company_id', v_sto.company_id, 'company_name', coalesce(v_company, ''),
      'notify', case when v_email is null then null else json_build_object(
        'email', v_email, 'first_name', coalesce(v_first, ''),
        'store_name', v_sto.store_name, 'company_name', coalesce(v_company, ''),
        'devices', v_sto.devices,
        'store_id', v_sto.store_id::text) end);
  end if;

  v_store_code := public.gen_store_code();
  -- ⚠️⚠️ L'ABONNEMENT SE NOTE SUR LE MAGASIN, ET C'EST CE QUI MANQUAIT.
  -- Un magasin ajouté en libre-service ouvre sa PROPRE souscription Stripe
  -- (`mode: subscription`). Jusqu'ici rien ne l'enregistrait : le premier
  -- paiement réel, le 4 septembre 2026, a créé le magasin sans laisser la
  -- moindre trace de l'abonnement qui le porte. Deux conséquences, et la
  -- seconde coûte de l'argent :
  --   · `sync_subscription_status` cherche l'abonnement sur `companies` — il ne
  --     le trouvait pas, donc impayé, résiliation et reprise passaient inaperçus ;
  --   · `deposer_changement_offre` décide du chemin (Checkout ou modification de
  --     l'article) sur cet abonnement. Nul, il ouvrait un SECOND abonnement, et
  --     le client payait les deux offres — exactement le trou que ce garde-fou
  --     existe pour fermer.
  -- Il se note PAR MAGASIN parce qu'une entreprise peut en porter plusieurs :
  -- l'écrire seulement sur l'entreprise ferait modifier l'article du mauvais
  -- magasin au premier changement d'offre.
  insert into public.stores (company_id, name, join_code, annual_price_cents, devices,
                             units, sqm, stripe_subscription_id, address)
    values (v_sto.company_id, v_sto.store_name, v_store_code, v_annuel,
            v_sto.devices, v_sto.units, v_sto.sqm, v_sub, v_sto.address)
    returning id into v_company_id;

  -- L'entreprise garde le PREMIER abonnement, celui qui porte sa licence : on
  -- ne l'écrase jamais, ce serait perdre la trace de ce que le client paie déjà.
  update public.companies
     set stripe_customer_id = coalesce(stripe_customer_id, p_customer_id),
         stripe_subscription_id = coalesce(stripe_subscription_id, v_sub),
         billing_period = coalesce(billing_period, v_sto.billing_period)
   where id = v_sto.company_id;

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

-- ─── Les droits ────────────────────────────────────────────────────────────
-- ⚠️ `create` rend EXECUTE à PUBLIC, et Supabase l'accorde aussi à `anon` :
-- le revoke vise les deux.

revoke all on function public.finaliser_inscription(text, text, text, text, text, text, jsonb, text, text) from public, anon;
grant execute on function public.finaliser_inscription(text, text, text, text, text, text, jsonb, text, text) to authenticated, service_role;

revoke all on function public.deposer_ajout_magasin(text, integer, text, text, text) from public, anon;
grant execute on function public.deposer_ajout_magasin(text, integer, text, text, text) to authenticated, service_role;

revoke all on function public.deposer_souscription(text, text, text, text, text, text, text, bigint, bigint, text, text) from public, anon, authenticated;
grant execute on function public.deposer_souscription(text, text, text, text, text, text, text, bigint, bigint, text, text) to service_role;

revoke all on function public.fulfil_paid_request(text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.fulfil_paid_request(text, text, text, text, text, text) to service_role;
