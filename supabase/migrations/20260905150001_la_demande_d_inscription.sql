-- Le parcours d'inscription : la demande, et le paiement qui promeut (5 sept. 2026)
--
-- Deuxième tranche. Le socle (`20260905140001`) donne un compte au prospect ;
-- celle-ci lui donne un brouillon qui survit à un abandon, et fait que le
-- paiement promeut CE compte-là.

-- ─── Le brouillon vit à part, et c'est le point ────────────────────────────
--
-- ⚠️ PAS DANS `company_requests`. `admin_pipeline` rend « tout ce qui n'est pas
-- terminé » dans cette table : un brouillon abandonné à l'étape 4 s'y
-- afficherait comme une vente en cours, avec un nom d'entreprise vide et un
-- revenu en attente de zéro. La console se remplirait de gens qui n'ont rien
-- demandé.
--
-- Le brouillon devient une `company_requests` À LA FINALISATION, en `accepted`
-- — et à partir de là c'est la machinerie du 22 août, inchangée : Checkout,
-- webhook, `fulfil_paid_request`. **Aucun second chemin de création
-- d'entreprise**, la règle qui tient depuis le premier jour.
create table if not exists public.inscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null unique references auth.users(id) on delete cascade,
  email       text not null,
  etape       smallint not null default 1,
  reponses    jsonb not null default '{}'::jsonb,
  demande_id  uuid references public.company_requests(id) on delete set null,
  relances    smallint not null default 0,
  derniere_relance_le timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint inscriptions_etape check (etape between 1 and 8),
  -- ⚠️ Le texte libre est BORNÉ, et la borne est en table : elle vaudra aussi
  -- pour la fonction qu'on écrira demain. Même ceinture que
  -- `company_requests_longueurs` (28 août 2026).
  constraint inscriptions_reponses_taille check (length(reponses::text) <= 4000)
);

alter table public.inscriptions enable row level security;
revoke all on table public.inscriptions from public, anon, authenticated;

comment on table public.inscriptions is
  'Le brouillon d''un parcours d''inscription. Aucune policy : tout passe par les RPC. Purgé à 30 jours, avec trois relances (J+1, J+8, J+21).';

create index if not exists inscriptions_relance_idx
  on public.inscriptions (created_at) where demande_id is null;

-- ─── Ce que la demande doit savoir du compte ───────────────────────────────
--
-- ⚠️ `user_id` EST LE POINT DE SÉCURITÉ DE CETTE TRANCHE. Le webhook promeut
-- CE compte, jamais l'adresse relue au moment du paiement : quelqu'un qui
-- change d'adresse entre le dépôt et l'encaissement se verrait sinon attribuer
-- l'entreprise d'un autre. C'est la famille de VR-003 (28 août 2026).
alter table public.company_requests
  add column if not exists user_id uuid references auth.users(id) on delete set null,
  add column if not exists source  text not null default 'devis';

do $$ begin
  alter table public.company_requests
    add constraint company_requests_source check (source in ('devis', 'inscription'));
exception when duplicate_object then null; end $$;

-- ─── Enregistrer l'avancement ──────────────────────────────────────────────
--
-- Appelée avec le jeton du prospect : `auth.uid()` désigne la ligne, jamais un
-- paramètre. Personne ne peut donc écrire le brouillon d'un autre.
create or replace function public.enregistrer_inscription(p_etape smallint, p_reponses jsonb)
returns json
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_uid   uuid := auth.uid();
  v_email text;
begin
  if v_uid is null then
    return json_build_object('success', false, 'error', 'Session absente.');
  end if;
  if p_etape is null or p_etape < 1 or p_etape > 8 then
    return json_build_object('success', false, 'error', 'Étape inconnue.');
  end if;
  if p_reponses is null or jsonb_typeof(p_reponses) <> 'object' then
    return json_build_object('success', false, 'error', 'Réponses illisibles.');
  end if;
  -- ⚠️ Refus, pas troncature : une réponse amputée en silence ferait proposer
  -- la mauvaise offre. Règle du 28 août 2026.
  if length(p_reponses::text) > 4000 then
    return json_build_object('success', false, 'error', 'Réponses trop longues.');
  end if;

  -- ⚠️ Un parcours déjà finalisé ne se réécrit plus : les réponses ont servi à
  -- établir un prix, et ce prix part chez Stripe.
  if exists (select 1 from public.inscriptions where user_id = v_uid and demande_id is not null) then
    return json_build_object('success', false, 'code', 'deja_finalise',
      'error', 'Votre inscription est déjà déposée.');
  end if;

  select lower(u.email) into v_email from auth.users u where u.id = v_uid;

  insert into public.inscriptions (user_id, email, etape, reponses)
       values (v_uid, coalesce(v_email, ''), p_etape, p_reponses)
  on conflict (user_id) do update
     set etape = excluded.etape,
         reponses = excluded.reponses,
         updated_at = now();

  return json_build_object('success', true, 'etape', p_etape);
end;
$function$;

revoke all on function public.enregistrer_inscription(smallint, jsonb) from public, anon;
grant execute on function public.enregistrer_inscription(smallint, jsonb) to authenticated, service_role;

-- ─── Reprendre où on s'est arrêté ──────────────────────────────────────────
create or replace function public.mon_inscription()
returns json
language plpgsql
security definer
set search_path = public
as $function$
declare v_uid uuid := auth.uid(); v_i public.inscriptions%rowtype; v_statut text;
begin
  if v_uid is null then
    return json_build_object('success', false, 'error', 'Session absente.');
  end if;
  select * into v_i from public.inscriptions where user_id = v_uid;
  if not found then
    return json_build_object('success', true, 'existe', false);
  end if;
  select status into v_statut from public.company_requests where id = v_i.demande_id;
  return json_build_object('success', true, 'existe', true,
    'etape', v_i.etape, 'reponses', v_i.reponses,
    'demande_id', v_i.demande_id, 'statut', v_statut);
end;
$function$;

revoke all on function public.mon_inscription() from public, anon;
grant execute on function public.mon_inscription() to authenticated, service_role;

-- ─── Finaliser : le brouillon devient une demande payable ──────────────────
--
-- ⚠️ LE PRIX VIENT DU SERVEUR, JAMAIS DE L'APPELANT. Cette fonction est appelée
-- avec le jeton du prospect : lui laisser porter un montant le laisserait
-- s'inscrire à un centime. C'est la raison d'être de `prix_offre` (4 septembre
-- 2026), et la même règle que les deux dépôts du libre-service.
create or replace function public.finaliser_inscription(
  p_company_name text, p_siren text, p_ape text,
  p_first text, p_last text, p_phone text,
  p_stores jsonb, p_billing_period text)
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
    if v_sname = '' or length(v_sname) > 80 then
      return json_build_object('success', false, 'error',
        'Chaque magasin doit porter un nom d''au plus 80 caractères.');
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
    v_propre := v_propre || jsonb_build_array(jsonb_build_object('name', v_sname, 'devices', v_dev));
    -- La règle des lignes de devis (2 septembre) : `prixCents` est l'échéance,
    -- `annuelCents` ce que le magasin vaut à l'année.
    v_lignes := v_lignes || jsonb_build_array(jsonb_build_object(
      'libelle', v_sname, 'appareils', v_dev,
      'prixCents', (v_tarif ->> 'prix_cents')::bigint,
      'annuelCents', (v_tarif ->> 'annuel_cents')::bigint));
  end loop;

  -- ⚠️ La demande naît en `accepted` : il n'y a rien à négocier, le prix est
  -- public. C'est exactement ce que fait `deposer_souscription` depuis le
  -- 30 août — et c'est ce qui permet à `fulfil_paid_request` de la mener à
  -- `created` sans que sa garde de transition ne change.
  insert into public.company_requests (
    company_name, contact_first_name, contact_last_name, contact_email, contact_phone,
    store_count, message, status, quote_reference, quote_amount_cents,
    siren, ape, stores, quote_lines, billing_period, plan,
    accepted_at, user_id, source)
  values (
    v_nom, v_first, v_last, v_email, v_phone,
    jsonb_array_length(v_propre), '', 'accepted',
    'INS-' || to_char(now() at time zone 'Europe/Paris', 'YYYYMMDD') || '-' ||
      upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 4)),
    v_total, v_siren, v_ape, v_propre, v_lignes, p_billing_period,
    (public.prix_offre((v_propre -> 0 ->> 'devices')::integer, p_billing_period) ->> 'plan'),
    now(), v_uid, 'inscription')
  returning id into v_id;

  update public.inscriptions
     set demande_id = v_id, etape = 8, updated_at = now()
   where user_id = v_uid;

  return json_build_object('success', true, 'demande_id', v_id,
    'montant_cents', v_total, 'annuel_cents', v_annuel,
    'magasins', jsonb_array_length(v_propre), 'lignes', v_lignes);
end;
$function$;

revoke all on function public.finaliser_inscription(text, text, text, text, text, text, jsonb, text) from public, anon;
grant execute on function public.finaliser_inscription(text, text, text, text, text, text, jsonb, text) to authenticated, service_role;

-- ─── Le paiement promeut le compte, il n'invite pas ────────────────────────
--
-- ⚠️ `invite_company_admin_after_payment` REFUSE une adresse qui a déjà un
-- compte (`account_exists`) — c'est la garde VR-003, et c'est exactement le cas
-- du prospect. Sans cette fonction, il paierait et n'obtiendrait rien : le
-- défaut vécu en vrai le 30 août sur la souscription en ligne.
create or replace function public.promouvoir_admin_apres_paiement(p_company uuid, p_user uuid)
returns json
language plpgsql
security definer
set search_path = public
as $function$
declare v_ok int;
begin
  if p_company is null or p_user is null then
    return json_build_object('success', false, 'error', 'Paramètres absents');
  end if;

  -- ⚠️ On ne promeut QUE le compte qui n'appartient à personne. Un compte déjà
  -- rattaché à une entreprise ne se déplace pas : ce serait le sortir de la
  -- sienne, et c'est la famille de VR-003.
  update public.profiles
     set role = 'supervisor', company_id = p_company, is_company_admin = true
   where id = p_user and company_id is null;
  get diagnostics v_ok = row_count;

  if v_ok = 0 then
    return json_build_object('success', false, 'error', 'compte_indisponible');
  end if;
  return json_build_object('success', true, 'user_id', p_user);
end;
$function$;

revoke all on function public.promouvoir_admin_apres_paiement(uuid, uuid) from public, anon, authenticated;
grant execute on function public.promouvoir_admin_apres_paiement(uuid, uuid) to service_role;

-- ─── fulfil_paid_request promeut au lieu d'inviter ─────────────────────────
--
-- ⚠️ Reprise de `pg_get_functiondef`, pas du dépôt : elle a été redéfinie
-- plusieurs fois depuis le 22 août, et repartir d'un fichier ancien
-- ressusciterait une version périmée. Seules la promotion et le `case` de
-- l'invitation changent.

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
                             units, sqm, stripe_subscription_id)
    values (v_sto.company_id, v_sto.store_name, v_store_code, v_annuel,
            v_sto.devices, v_sto.units, v_sto.sqm, v_sub)
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

-- ⚠️ La ligne du revoke reste D'UN SEUL TENANT : une garde de
-- `web/tests/stripe.test.ts` la lit telle quelle depuis le 22 août, et la
-- couper en deux l'avait déjà fait tomber le 4 septembre.
revoke all on function public.fulfil_paid_request(text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.fulfil_paid_request(text, text, text, text, text, text) to service_role;
