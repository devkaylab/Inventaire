-- ============================================================================
-- LE LIBRE-SERVICE : CHANGER D'OFFRE, AJOUTER UN MAGASIN — SANS DEVIS
-- (4 septembre 2026)
-- ----------------------------------------------------------------------------
-- Julien : « nous avons une offre claire aujourd'hui, plus besoin de passer par
-- un devis pour quoi que ce soit. Donc il faut créer les produits pour les
-- magasins supplémentaires, appareils supplémentaires. »
--
-- Le bouton « Passer à Advanced » de la fiche magasin menait à /tarifs, faute
-- de mieux. Ce fichier pose la moitié BASE des deux parcours ; la fonction edge
-- et les écrans suivent.
--
-- ⚠️ LE PARCOURS RÉUTILISE CELUI DU 22 AOÛT, VÉRIFIÉ DE BOUT EN BOUT. Une
-- demande naît directement en `accepted` (il n'y a rien à négocier), la session
-- Checkout s'y attache, et `fulfil_paid_request` la mène à `created`. Aucun
-- second chemin de création : c'est ce qui a évité, jusqu'ici, que deux façons
-- de créer un magasin divergent.
--
-- ⚠️⚠️ LA RÈGLE QUI ÉVITE DE FACTURER DEUX FOIS. Un changement d'offre a deux
-- chemins, et ils ne sont pas interchangeables :
--   · l'entreprise n'a PAS d'abonnement Stripe → session Checkout, comme une
--     souscription ordinaire ;
--   · elle en a un → on MODIFIE son abonnement (Stripe calcule le prorata),
--     jamais un second Checkout. Ouvrir un second abonnement ferait payer les
--     deux offres en même temps, et rien ne le signalerait.
-- `deposer_changement_offre` refuse donc le second cas : c'est l'edge qui
-- prend le chemin d'API, sur ce que lui dit `etat_abonnement_magasin`.
-- ============================================================================


-- ── 1. Ce qui relie un magasin à son article d'abonnement ──────────────────
alter table public.stores
  add column if not exists stripe_item_offre text,
  add column if not exists stripe_item_appareils text;

comment on column public.stores.stripe_item_offre is
  'Article d''abonnement Stripe qui porte l''offre de ce magasin. Nul tant que la licence n''est pas souscrite en ligne.';
comment on column public.stores.stripe_item_appareils is
  'Article d''abonnement portant les tranches de dix appareils au-dela du plafond Enterprise. Sa quantite est le nombre de tranches.';


-- ── 2. Un troisième genre de demande : le changement d'offre ───────────────
--
-- ⚠️ Il réutilise `store_requests` au lieu d'une table à lui. La demande porte
-- déjà tout ce qu'il faut — `devices`, `billing_period`, les lignes de devis,
-- les identifiants Stripe — et surtout elle est DÉJÀ branchée sur
-- `attach_checkout_session`, sur `fulfil_paid_request` et sur la purge. Une
-- table de plus, ce serait un quatrième chemin à garder d'accord avec les
-- autres.
--
-- Un `kind = 'offre'` porte un `store_id` DÈS LE DÉPART : le magasin existe, il
-- n'y a rien à créer, seulement à mettre à jour.
alter table public.store_requests drop constraint if exists store_requests_kind_check;
alter table public.store_requests
  add constraint store_requests_kind_check check (kind in ('add', 'remove', 'offre'));


-- ── 3. La grille, en base ──────────────────────────────────────────────────
--
-- ⚠️ QUATRIÈME COPIE DE LA GRILLE, ET ELLE EST NÉCESSAIRE. Le réflexe serait
-- de faire porter le montant par l'appelant, comme `deposer_souscription` le
-- fait pour la page publique — mais celle-ci est appelée par l'edge en clé de
-- service, alors que les deux dépôts ci-dessous sont appelés AVEC LE JETON DU
-- CLIENT (règle du 22 août : une fonction edge n'ajoute aucun droit). Un
-- administrateur d'entreprise pourrait donc déposer sa propre demande à un
-- centime. Le prix doit venir du serveur.
--
-- Les trois autres copies : `web/lib/offres.ts` (euros, le site),
-- `subscribe-online` (centimes, l'edge) et les paliers de `plafond_appareils`.
-- Un test compare celle-ci à la première, comme pour les autres.
create or replace function public.prix_offre(p_devices integer, p_billing_period text)
returns jsonb
language plpgsql
immutable
set search_path = public
as $$
declare
  v_t integer;          -- tranches de dix au-delà du plafond d'Enterprise
  v_plan text;
  v_plafond integer;
  v_mois bigint;
  v_an bigint;
begin
  if p_devices is null or p_devices < 1 then
    return null;
  end if;
  if p_billing_period is null or p_billing_period not in ('monthly', 'yearly') then
    return null;
  end if;

  if p_devices <= 2 then
    v_plan := 'essential'; v_plafond := 2;   v_mois := 8900;  v_an := 95000;
  elsif p_devices <= 20 then
    v_plan := 'advanced';  v_plafond := 20;  v_mois := 31000; v_an := 330000;
  elsif p_devices <= 100 then
    v_plan := 'enterprise'; v_plafond := 100; v_mois := 89000; v_an := 945000;
  else
    -- Au-delà de cent appareils, par tranche de dix ENTAMÉE — exactement comme
    -- `plafond_appareils` les compte et comme la grille les facture.
    v_t := ceil((p_devices - 100) / 10.0)::integer;
    v_plan := 'enterprise';
    v_plafond := 100 + 10 * v_t;
    v_mois := 89000 + v_t * 6400;
    v_an   := 945000 + v_t * 69000;
  end if;

  -- ⚠️ LA RÈGLE DES LIGNES DE DEVIS (2 septembre 2026) : `prixCents` est ce
  -- qui est facturé à l'échéance, `annuelCents` ce que le magasin vaut à
  -- l'année. `fulfil_paid_request` écrit le second dans `annual_price_cents`.
  return jsonb_build_object(
    'plan', v_plan,
    'plafond', v_plafond,
    'tranches', coalesce(v_t, 0),
    'prix_cents', case when p_billing_period = 'monthly' then v_mois else v_an end,
    'annuel_cents', case when p_billing_period = 'monthly' then v_mois * 12 else v_an end);
end;
$$;

revoke all on function public.prix_offre(integer, text) from public, anon;
grant execute on function public.prix_offre(integer, text) to authenticated, service_role;


-- ── 4. Ce que l'edge doit savoir avant d'appeler Stripe ────────────────────
--
-- Une seule lecture, gardée : l'entreprise du magasin, son abonnement s'il en
-- a un, son client Stripe, l'article du magasin et son forfait actuel. L'edge
-- n'a alors plus qu'à choisir entre « modifier l'article » et « ouvrir une
-- session Checkout ».
create or replace function public.etat_abonnement_magasin(p_store_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v jsonb;
begin
  select jsonb_build_object(
           'store_id', s.id,
           'magasin', s.name,
           'company_id', c.id,
           'entreprise', c.name,
           'abonnement', c.stripe_subscription_id,
           'client', c.stripe_customer_id,
           'rythme', c.billing_period,
           'item_offre', s.stripe_item_offre,
           'item_appareils', s.stripe_item_appareils,
           'appareils', s.devices,
           'plafond', public.plafond_appareils(s.id))
    into v
    from public.stores s
    join public.companies c on c.id = s.company_id
   where s.id = p_store_id;

  if v is null then
    return null;
  end if;
  return v;
end;
$$;

-- ⚠️ `service_role` seul : elle rend des identifiants Stripe, et l'edge
-- l'appelle avec sa clé de service APRÈS avoir vérifié l'appelant par les
-- fonctions gardées ci-dessous. Les rendre au navigateur n'apporterait rien et
-- exposerait la plomberie.
revoke all on function public.etat_abonnement_magasin(uuid) from public, anon, authenticated;
grant execute on function public.etat_abonnement_magasin(uuid) to service_role;


-- ── 5. Ajouter un magasin, sans devis ──────────────────────────────────────
--
-- Miroir de `ca_request_store`, à une différence près qui est tout l'objet du
-- chantier : la demande naît en `accepted`, avec son prix, prête à être payée.
create or replace function public.deposer_ajout_magasin(
  p_name text,
  p_devices integer,
  p_billing_period text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company uuid;
  v_name  text := btrim(coalesce(p_name, ''));
  v_label text;
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
  if p_devices is null or p_devices <= 0 then
    return json_build_object('success', false, 'error',
      'Indiquez le nombre d''appareils qui comptent en même temps dans ce magasin.');
  end if;
  if p_devices > 1000 then
    return json_build_object('success', false, 'error',
      'Ce nombre d''appareils sort de la grille : écrivez-nous, nous construisons le tarif avec vous.');
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
    company_id, store_name, message, devices, billing_period,
    requested_by, requested_label,
    status, accepted_at,
    quote_amount_cents, quote_lines, admin_note
  ) values (
    v_company, v_name, '', p_devices, p_billing_period,
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
$$;

revoke all on function public.deposer_ajout_magasin(text, integer, text) from public, anon;
grant execute on function public.deposer_ajout_magasin(text, integer, text) to authenticated, service_role;


-- ── 6. Changer d'offre, sans devis ─────────────────────────────────────────
create or replace function public.deposer_changement_offre(
  p_store_id uuid,
  p_devices integer,
  p_billing_period text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_store   record;
  v_label   text;
  v_tarif   jsonb;
  v_plafond integer;
  v_id      uuid;
begin
  select s.id, s.name, s.company_id, c.stripe_subscription_id
    into v_store
    from public.stores s
    join public.companies c on c.id = s.company_id
   where s.id = p_store_id;
  if not found then
    return json_build_object('success', false, 'error', 'Magasin introuvable.');
  end if;

  -- ⚠️ La garde porte sur l'entreprise DU MAGASIN, jamais sur un paramètre de
  -- l'appelant — sinon on change l'offre du magasin d'un autre client.
  if not (public.is_admin() or public.is_company_admin(v_store.company_id)) then
    return json_build_object('success', false, 'error',
      'Accès réservé à l''administrateur de l''entreprise.');
  end if;

  if p_devices is null or p_devices <= 0 then
    return json_build_object('success', false, 'error',
      'Indiquez le nombre d''appareils qui comptent en même temps.');
  end if;
  if p_devices > 1000 then
    return json_build_object('success', false, 'error',
      'Ce nombre d''appareils sort de la grille : écrivez-nous, nous construisons le tarif avec vous.');
  end if;
  if p_billing_period is null or p_billing_period not in ('monthly', 'yearly') then
    return json_build_object('success', false, 'error', 'Rythme de paiement inconnu.');
  end if;

  -- Rien à vendre : le forfait couvre déjà ce besoin.
  v_plafond := public.plafond_appareils(p_store_id);
  if v_plafond is not null and p_devices <= v_plafond then
    return json_build_object('success', false, 'code', 'deja_couvert', 'error',
      'Votre forfait couvre déjà ' || v_plafond || ' appareils.');
  end if;

  -- ⚠️ UNE ENTREPRISE QUI A UN ABONNEMENT NE PASSE PAS PAR ICI. Un second
  -- Checkout ouvrirait un second abonnement, et le client paierait les deux.
  -- C'est l'edge qui modifie l'abonnement existant, et `appliquer_changement_offre`
  -- qui enregistre le résultat.
  if nullif(btrim(coalesce(v_store.stripe_subscription_id, '')), '') is not null then
    return json_build_object('success', false, 'code', 'abonnement_en_cours', 'error',
      'Cette entreprise a un abonnement en cours : le changement se fait dessus.');
  end if;

  if exists (select 1 from public.store_requests r
              where r.store_id = p_store_id
                and r.kind = 'offre'
                and r.status in ('pending', 'quoted', 'accepted', 'paid')) then
    return json_build_object('success', false, 'code', 'deja_en_cours', 'error',
      'Un changement d''offre est déjà en cours pour ce magasin.');
  end if;

  v_tarif := public.prix_offre(p_devices, p_billing_period);

  select coalesce(nullif(btrim(full_name), ''), '') into v_label
    from public.profiles where id = auth.uid();

  insert into public.store_requests (
    company_id, store_id, store_name, message, devices, billing_period,
    kind, requested_by, requested_label,
    status, accepted_at,
    quote_amount_cents, quote_lines, admin_note
  ) values (
    v_store.company_id, p_store_id, v_store.name, '', p_devices, p_billing_period,
    'offre', auth.uid(), coalesce(v_label, ''),
    'accepted', now(),
    (v_tarif ->> 'prix_cents')::bigint,
    jsonb_build_array(jsonb_build_object(
      'libelle', v_store.name,
      'appareils', p_devices,
      'prixCents', (v_tarif ->> 'prix_cents')::bigint,
      'annuelCents', (v_tarif ->> 'annuel_cents')::bigint)),
    'Changement d''offre en libre-service'
  ) returning id into v_id;

  perform public.log_company_action(v_store.company_id, 'offre_changee', v_store.name,
    json_build_object('appareils', p_devices, 'offre', v_tarif ->> 'plan',
                      'rythme', p_billing_period,
                      'montant_cents', (v_tarif ->> 'prix_cents')::bigint)::jsonb);

  return json_build_object('success', true, 'id', v_id::text,
    'store_name', v_store.name, 'plan', v_tarif ->> 'plan',
    'plafond', (v_tarif ->> 'plafond')::integer,
    'prix_cents', (v_tarif ->> 'prix_cents')::bigint,
    'billing_period', p_billing_period);
end;
$$;

revoke all on function public.deposer_changement_offre(uuid, integer, text) from public, anon;
grant execute on function public.deposer_changement_offre(uuid, integer, text) to authenticated, service_role;


-- ── 7. Le chemin d'API : l'abonnement existant a été modifié ───────────────
--
-- Appelée par l'edge APRÈS que Stripe a confirmé la modification de l'article
-- (c'est Stripe qui calcule et facture le prorata). Elle n'encaisse rien, elle
-- enregistre.
create or replace function public.appliquer_changement_offre(
  p_store_id uuid,
  p_devices integer,
  p_annuel_cents bigint,
  p_item text default null,
  p_item_appareils text default null)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_store record;
begin
  select s.id, s.name, s.company_id, c.name as entreprise
    into v_store
    from public.stores s
    join public.companies c on c.id = s.company_id
   where s.id = p_store_id
     for update;
  if not found then
    return json_build_object('success', false, 'error', 'Magasin introuvable');
  end if;
  if p_devices is null or p_devices < 1 then
    return json_build_object('success', false, 'error', 'Appareils absents');
  end if;

  update public.stores
     set devices = p_devices,
         annual_price_cents = coalesce(p_annuel_cents, annual_price_cents),
         stripe_item_offre = coalesce(nullif(btrim(coalesce(p_item, '')), ''), stripe_item_offre),
         -- ⚠️ Une chaîne VIDE efface l'article des appareils (le client est
         -- redescendu sous cent) ; `null` le laisse tel quel. Sans cette
         -- distinction, on ne saurait pas dire « il n'y en a plus ».
         stripe_item_appareils = case
           when p_item_appareils is null then stripe_item_appareils
           when btrim(p_item_appareils) = '' then null
           else btrim(p_item_appareils) end
   where id = p_store_id;

  perform public.log_system_action('Stripe', 'offre_changee', 'magasin', p_store_id::text,
    v_store.name, json_build_object('entreprise', v_store.entreprise,
      'appareils', p_devices, 'annuel_cents', p_annuel_cents)::jsonb);
  perform public.log_company_action(v_store.company_id, 'offre_appliquee', v_store.name,
    json_build_object('appareils', p_devices)::jsonb);

  return json_build_object('success', true, 'store_id', p_store_id,
    'store_name', v_store.name, 'devices', p_devices);
end;
$$;

-- ⚠️ L'ancienne signature à quatre arguments est SUPPRIMÉE : `p_item_appareils`
-- ayant un défaut, Postgres garderait les deux et un appel à quatre deviendrait
-- ambigu. Même piège que `p_event_id` le 28 août et `ca_request_store` le 22.
drop function if exists public.appliquer_changement_offre(uuid, integer, bigint, text);

-- Elle écrit la licence d'un magasin sans rien encaisser : `service_role` seul,
-- comme `fulfil_paid_request`. Jamais `authenticated`.
revoke all on function public.appliquer_changement_offre(uuid, integer, bigint, text, text)
  from public, anon, authenticated;
grant execute on function public.appliquer_changement_offre(uuid, integer, bigint, text, text)
  to service_role;


-- ── 8. Le webhook sait mettre à jour, plus seulement créer ─────────────────
--
-- Seule addition : la branche `kind = 'offre'`, posée APRÈS le calcul du prix
-- annuel et AVANT la création du magasin. Tout le reste est la fonction du
-- 2 septembre 2026, recopiée à l'identique.
create or replace function public.fulfil_paid_request(
  p_session_id text,
  p_customer_id text default null,
  p_invoice_id text default null,
  p_payment_intent_id text default null,
  p_event_id text default null,
  p_subscription_id text default null)
returns json
language plpgsql
security definer
set search_path = public
as $$
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
           annual_price_cents = v_annuel
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
$$;

revoke all on function public.fulfil_paid_request(text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.fulfil_paid_request(text, text, text, text, text, text) to service_role;


-- ── 9. La console ne crée pas un magasin sur un changement d'offre ─────────
--
-- ⚠️ SANS CE REFUS, LE BOUTON « Créer le magasin » DE LA FICHE ENTREPRISE
-- FABRIQUERAIT UN DOUBLON. Une demande `offre` passe par `paid` comme une
-- autre ; rien dans `admin_fulfil_store_request` ne regardait le genre.
create or replace function public.admin_fulfil_store_request(p_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_req public.store_requests%rowtype;
  v_res json; v_email text; v_first text; v_company text; v_annuel bigint;
begin
  if not public.is_admin() then
    return json_build_object('success', false, 'error', 'Accès refusé');
  end if;
  select * into v_req from public.store_requests where id = p_id for update;
  if not found then
    return json_build_object('success', false, 'error', 'Demande introuvable');
  end if;
  if v_req.kind <> 'add' then
    return json_build_object('success', false, 'error',
      'Cette demande ne crée pas de magasin.');
  end if;
  if v_req.status = 'created' then
    return json_build_object('success', false, 'error', 'Cette demande a déjà été traitée.');
  end if;
  if v_req.status <> 'paid' then
    return json_build_object('success', false,
      'error', 'Le magasin ne peut être créé qu''après encaissement de la facture.');
  end if;

  v_annuel := coalesce(
    nullif(v_req.quote_lines -> 0 ->> 'annuelCents', '')::bigint,
    case when v_req.billing_period = 'monthly' then v_req.quote_amount_cents * 12
         else v_req.quote_amount_cents end);

  v_res := public.admin_add_store(v_req.company_id, v_req.store_name,
                                  v_req.units, v_req.sqm, v_req.devices, v_annuel::integer);
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

revoke all on function public.admin_fulfil_store_request(uuid) from public, anon;
grant execute on function public.admin_fulfil_store_request(uuid) to authenticated, service_role;


-- ── 10. Et la console range un changement d'offre à sa place ───────────────
--
-- Un `kind = 'offre'` ressortait de `admin_pipeline` étiqueté « store », donc
-- avec le bouton de création. Il a son propre genre.
create or replace function public.admin_pipeline()
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Accès refusé';
  end if;

  return (
    select coalesce(json_agg(x order by x.created_at desc), '[]'::json)
      from (
        select json_build_object(
                 'kind', 'company',
                 'id', r.id,
                 'company_id', r.company_id,
                 'company_name', r.company_name,
                 'label', r.company_name,
                 'detail', r.store_count::text || ' magasin' || case when r.store_count > 1 then 's' else '' end,
                 'contact', btrim(r.contact_first_name || ' ' || r.contact_last_name),
                 'status', r.status,
                 'quote_reference', r.quote_reference,
                 'quote_amount_cents', r.quote_amount_cents,
                 'billing_period', r.billing_period,
                 'annual_cents', public.annuel_du_devis(r.quote_lines, r.quote_amount_cents, r.billing_period),
                 'created_at', r.created_at,
                 'quote_sent_at', r.quote_sent_at,
                 'quote_expires_at', r.quote_expires_at,
                 'accepted_at', r.accepted_at,
                 'paid_at', r.paid_at,
                 'ape', r.ape,
                 'stores', r.stores
               ) as x, r.created_at
          from public.company_requests r
         where r.status in ('pending', 'quoted', 'accepted', 'paid')

        union all

        select json_build_object(
                 'kind', case r.kind
                           when 'remove' then 'store_removal'
                           when 'offre'  then 'store_offer'
                           else 'store' end,
                 'id', r.id,
                 'company_id', r.company_id,
                 'company_name', c.name,
                 'label', r.store_name,
                 'detail', c.name,
                 'contact', r.requested_label,
                 'status', r.status,
                 'quote_reference', r.quote_reference,
                 'quote_amount_cents', r.quote_amount_cents,
                 'billing_period', r.billing_period,
                 'annual_cents', public.annuel_du_devis(r.quote_lines, r.quote_amount_cents, r.billing_period),
                 'created_at', r.created_at,
                 'quote_sent_at', r.quote_sent_at,
                 'quote_expires_at', r.quote_expires_at,
                 'accepted_at', r.accepted_at,
                 'paid_at', r.paid_at,
                 'ape', null,
                 'stores', case when r.kind = 'add'
                   then json_build_array(json_build_object(
                          'name', r.store_name, 'devices', r.devices,
                          'units', r.units, 'sqm', r.sqm))
                   else '[]'::json end
               ) as x, r.created_at
          from public.store_requests r
          join public.companies c on c.id = r.company_id
         where r.status in ('pending', 'quoted', 'accepted', 'paid')
      ) x);
end;
$$;

revoke all on function public.admin_pipeline() from public, anon;
grant execute on function public.admin_pipeline() to authenticated, service_role;


-- ── 11. Et un changement d'offre ne se devise pas ──────────────────────────
--
-- Le refus existait pour les suppressions ; son message ne parlait que d'elles.
create or replace function public.admin_quote_store_request(
  p_id uuid, p_reference text, p_amount_cents bigint,
  p_note text default '', p_lines jsonb default '[]'::jsonb,
  p_billing_period text default 'yearly')
returns json
language plpgsql
security definer
set search_path = public
as $$
declare v_req public.store_requests%rowtype; v_token uuid; v_company text;
begin
  if not public.is_admin() then return json_build_object('success', false, 'error', 'Accès refusé'); end if;
  if p_amount_cents is null or p_amount_cents < 0 then
    return json_build_object('success', false, 'error', 'Montant invalide');
  end if;
  if p_billing_period not in ('monthly', 'yearly') then
    return json_build_object('success', false, 'error', 'Rythme de paiement inconnu.');
  end if;
  select * into v_req from public.store_requests where id = p_id for update;
  if not found then return json_build_object('success', false, 'error', 'Demande introuvable'); end if;
  if v_req.kind = 'remove' then
    return json_build_object('success', false, 'error', 'Une demande de suppression ne se devise pas.');
  end if;
  if v_req.kind <> 'add' then
    return json_build_object('success', false, 'error',
      'Un changement d''offre se règle en ligne, il ne se devise pas.');
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
$$;

revoke all on function public.admin_quote_store_request(uuid, text, bigint, text, jsonb, text)
  from public, anon;
grant execute on function public.admin_quote_store_request(uuid, text, bigint, text, jsonb, text)
  to authenticated, service_role;


-- ── 12. La garde du chemin d'API, explicite ────────────────────────────────
--
-- ⚠️ POURQUOI ELLE EXISTE PLUTÔT QUE DE SE DÉDUIRE. Quand une entreprise a
-- déjà un abonnement, `deposer_changement_offre` refuse — et ce refus n'arrive
-- qu'APRÈS sa garde, donc le recevoir prouve que l'appelant était autorisé.
-- L'edge pourrait s'en contenter. Elle ne le fait pas : une autorisation qui
-- tient à l'ordre des `if` d'une autre fonction se perd au premier
-- réagencement, sans que rien ne le signale. Sur le chemin de l'argent, la
-- garde se demande.
create or replace function public.peut_changer_offre(p_store_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare v_company uuid;
begin
  select s.company_id into v_company from public.stores s where s.id = p_store_id;
  if v_company is null then
    return false;
  end if;
  -- ⚠️ La garde porte sur l'entreprise DU MAGASIN, jamais sur un paramètre de
  -- l'appelant.
  return public.is_admin() or public.is_company_admin(v_company);
end;
$$;

revoke all on function public.peut_changer_offre(uuid) from public, anon;
grant execute on function public.peut_changer_offre(uuid) to authenticated, service_role;
