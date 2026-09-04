-- ============================================================================
-- L'ABONNEMENT SUIT LE MAGASIN (4 septembre 2026)
-- ----------------------------------------------------------------------------
-- Trouvé en vérifiant le PREMIER PAIEMENT RÉEL du libre-service. Le magasin est
-- bien créé, au bon prix, avec sa facture — mais `companies.stripe_customer_id`
-- et `stripe_subscription_id` sont restés nuls : la branche d'ajout de
-- `fulfil_paid_request` créait le magasin sans jamais enregistrer l'abonnement
-- que le paiement venait d'ouvrir.
--
-- ⚠️ CE N'EST PAS COSMÉTIQUE, ET LA SECONDE CONSÉQUENCE COÛTE DE L'ARGENT :
--   · `sync_subscription_status` cherche l'abonnement sur `companies` — impayé,
--     résiliation et reprise passaient inaperçus pour ce magasin ;
--   · `deposer_changement_offre` décide du chemin sur cet abonnement. Nul, il
--     ouvrait un SECOND abonnement au premier changement d'offre, et le client
--     payait les deux — le trou même que ce garde-fou existe pour fermer.
--
-- ⚠️ ET IL SE NOTE PAR MAGASIN. Une entreprise peut porter plusieurs
-- abonnements (un par magasin ajouté en libre-service) : l'écrire seulement sur
-- l'entreprise ferait modifier l'article du MAUVAIS magasin au premier
-- changement d'offre. L'entreprise garde le premier, celui de sa licence.
--
-- C'est la limite notée le 2 septembre — « un magasin ajouté en mensuel crée un
-- second abonnement que rien ne suit » — qui n'était plus une limite mais un
-- défaut, depuis que ce chemin est celui de tout le monde.
-- ============================================================================

alter table public.stores
  add column if not exists stripe_subscription_id text;

comment on column public.stores.stripe_subscription_id is
  'L''abonnement Stripe qui porte CE magasin. Une entreprise peut en porter plusieurs.';

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
$$;

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
           -- ⚠️ Celui du MAGASIN d'abord : une entreprise peut porter
           -- plusieurs abonnements, et c'est l'article de CE magasin qu'on
           -- s'apprête à modifier. Repli sur celui de l'entreprise pour les
           -- magasins nés d'une souscription en ligne, où il n'y en a qu'un.
           'abonnement', coalesce(s.stripe_subscription_id, c.stripe_subscription_id),
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
  select s.id, s.name, s.company_id,
         -- ⚠️ L'abonnement DU MAGASIN d'abord (voir `etat_abonnement_magasin`).
         coalesce(s.stripe_subscription_id, c.stripe_subscription_id) as stripe_subscription_id
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


revoke all on function public.fulfil_paid_request(text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.fulfil_paid_request(text, text, text, text, text, text) to service_role;

revoke all on function public.etat_abonnement_magasin(uuid) from public, anon, authenticated;
grant execute on function public.etat_abonnement_magasin(uuid) to service_role;

revoke all on function public.deposer_changement_offre(uuid, integer, text) from public, anon;
grant execute on function public.deposer_changement_offre(uuid, integer, text) to authenticated, service_role;


-- ── Le cycle de vie retrouve un magasin, pas seulement une entreprise ──────
create or replace function public.sync_subscription_status(
  p_subscription_id text, p_status text, p_event_id text default null)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sub text := nullif(btrim(coalesce(p_subscription_id, '')), '');
  v_evt text := nullif(btrim(coalesce(p_event_id, '')), '');
  v_company public.companies%rowtype;
  v_etat text;
begin
  if v_sub is null then
    return json_build_object('success', false, 'error', 'Abonnement absent');
  end if;
  v_etat := case p_status
    when 'past_due' then 'past_due'
    when 'unpaid' then 'past_due'
    when 'canceled' then 'canceled'
    when 'active' then 'active'
    else null end;
  if v_etat is null then
    return json_build_object('success', true, 'ignored', p_status);
  end if;

  if v_evt is not null then
    insert into public.stripe_events_traites (event_id) values (v_evt)
      on conflict (event_id) do nothing;
    if not found then
      return json_build_object('success', true, 'already', true, 'event_id', v_evt);
    end if;
  end if;

  select * into v_company from public.companies
   where stripe_subscription_id = v_sub for update;

  -- ⚠️ SINON, ON CHERCHE DU CÔTÉ DES MAGASINS. Un magasin ajouté en
  -- libre-service porte son propre abonnement : sans cette seconde lecture, son
  -- impayé et sa résiliation restaient invisibles.
  if not found then
    select c.* into v_company
      from public.stores s
      join public.companies c on c.id = s.company_id
     where s.stripe_subscription_id = v_sub
     limit 1;
    if found then
      select * into v_company from public.companies where id = v_company.id for update;
    end if;
  end if;

  if not found then
    -- L'abonnement peut arriver avant que la creation n'ait eu lieu (course
    -- entre deux evenements Stripe). On ne leve pas : Stripe rejouerait sans
    -- fin un evenement qui n'a pas d'objet.
    return json_build_object('success', true, 'unknown', true);
  end if;
  if v_company.license_status = v_etat then
    return json_build_object('success', true, 'already', true, 'status', v_etat);
  end if;

  update public.companies set license_status = v_etat where id = v_company.id;

  perform public.log_system_action('Stripe', 'licence_' || v_etat, 'entreprise',
    v_company.id::text, v_company.name,
    json_build_object('abonnement', v_sub, 'avant', v_company.license_status)::jsonb);

  return json_build_object('success', true, 'company_id', v_company.id, 'status', v_etat);
end; $$;

revoke all on function public.sync_subscription_status(text, text, text)
  from public, anon, authenticated;
grant execute on function public.sync_subscription_status(text, text, text) to service_role;
