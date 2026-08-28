-- VR-001 — un même paiement ne crée plus deux entreprises.
--
-- `fulfil_paid_request` contrôlait le statut par une LECTURE, puis faisait son
-- UPDATE sans condition. Deux livraisons concurrentes du même événement Stripe
-- lisaient toutes deux `accepted`, passaient toutes deux, et créaient chacune
-- une entreprise complète avec ses magasins.
--
-- ⚠️ L'index unique `company_requests_stripe_session_idx` ne protégeait PAS de
-- ça : il porte sur la table des demandes, alors que le doublon naît dans
-- `companies` et `stores`, que rien ne contraint.
--
-- Le déclencheur n'est pas un attaquant : Stripe redélivre tant qu'il n'a pas
-- reçu de 200, et le webhook ne mémorise aucun identifiant d'événement. Le
-- risque se nourrit lui-même — `gen_store_code()` fait une requête par
-- tentative, une fois par magasin, donc une grosse commande est lente, donc
-- Stripe expire et réessaie pendant que la première exécution tourne encore.
--
-- Deux corrections, la première suffit :
--
--   1. `for update` sur les deux SELECT initiaux. Le verrou de ligne sérialise
--      les webhooks concurrents ; le second attend, RELIT la ligne (READ
--      COMMITTED réévalue après le verrou), y trouve `paid`, et sort par la
--      branche `already` qui existait déjà.
--   2. `and status = 'accepted'` sur les deux UPDATE de transition — le motif
--      exact d'`accept_quote_by_token`, qui l'avait et que celle-ci n'avait
--      pas. Ceinture : après le verrou, la garde matche toujours ; elle sert le
--      jour où quelqu'un retirerait le `for update`.
--
-- ⚠️ Le `if not found` répond `already: true`, JAMAIS une erreur. Stripe rejoue
-- tant qu'il n'a pas de 200 : une erreur ici relancerait la boucle qu'on ferme.
--
-- Rien d'autre ne change : ni la logique de création, ni les journaux, ni les
-- valeurs de retour lues par `stripe-webhook`.

create or replace function public.fulfil_paid_request(
  p_session_id text,
  p_customer_id text default null::text,
  p_invoice_id text default null::text,
  p_payment_intent_id text default null::text)
 returns json
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_req public.company_requests%rowtype;
  v_sto public.store_requests%rowtype;
  v_company_id uuid; v_company_code text; v_store_code text;
  v_name text; v_i int; v_stores json[] := '{}';
  v_email text; v_first text; v_company text;
  v_prix bigint; v_ligne jsonb; v_decl jsonb;
begin
  if p_session_id is null or btrim(p_session_id) = '' then
    return json_build_object('success', false, 'error', 'Session absente');
  end if;

  -- ⚠️ `for update` : le verrou de ligne est ce qui sérialise deux webhooks
  -- concurrents. Sans lui, le contrôle de statut ci-dessous n'est qu'une
  -- lecture, et une lecture ne sérialise rien.
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
    -- ⚠️ `already`, pas une erreur : Stripe rejoue tant qu'il n'a pas de 200.
    if not found then
      return json_build_object('success', true, 'already', true, 'kind', 'company',
        'status', 'paid', 'company_id', v_req.company_id);
    end if;

    v_company_code := public.gen_company_code();
    insert into public.companies (name, join_code) values (v_req.company_name, v_company_code)
      returning id into v_company_id;
    for v_i in 1..v_req.store_count loop
      v_ligne := v_req.quote_lines -> (v_i - 1);
      v_decl  := v_req.stores -> (v_i - 1);
      v_name := coalesce(nullif(btrim(v_ligne ->> 'libelle'), ''),
                         nullif(btrim(v_decl ->> 'name'), ''),
                         'Magasin ' || v_i);
      v_prix := coalesce((v_ligne ->> 'prixCents')::bigint,
                         case when v_req.quote_amount_cents is not null and v_req.store_count > 0
                              then v_req.quote_amount_cents / v_req.store_count end);
      v_store_code := public.gen_store_code();
      insert into public.stores (company_id, name, join_code, annual_price_cents, units, sqm)
        values (v_company_id, v_name, v_store_code, v_prix,
                nullif(btrim(coalesce(v_decl ->> 'units', '')), '')::integer,
                nullif(btrim(coalesce(v_decl ->> 'sqm', '')), '')::integer);
      v_stores := v_stores || json_build_object('name', v_name, 'join_code', v_store_code, 'price_cents', v_prix);
    end loop;

    update public.company_requests
       set status = 'created', company_id = v_company_id, updated_at = now()
     where id = v_req.id;

    perform public.log_system_action('Stripe', 'paiement_recu', 'demande_entreprise', v_req.id::text,
      v_req.company_name, json_build_object('session', p_session_id, 'montant_cents', v_req.quote_amount_cents)::jsonb);
    perform public.log_system_action('Stripe', 'entreprise_creee_depuis_demande', 'entreprise', v_company_id::text,
      v_req.company_name, json_build_object('demande_id', v_req.id::text, 'magasins', v_req.store_count)::jsonb);

    return json_build_object(
      'success', true, 'already', false, 'kind', 'company',
      'company_id', v_company_id, 'company_name', v_req.company_name,
      'stores', array_to_json(v_stores),
      'invite', json_build_object(
        'email', lower(v_req.contact_email),
        'first_name', v_req.contact_first_name,
        'last_name', v_req.contact_last_name));
  end if;

  -- Même verrou côté demande de magasin.
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

  v_store_code := public.gen_store_code();
  insert into public.stores (company_id, name, join_code, annual_price_cents, units, sqm)
    values (v_sto.company_id, v_sto.store_name, v_store_code, v_sto.quote_amount_cents,
            v_sto.units, v_sto.sqm)
    returning id into v_company_id;

  update public.store_requests
     set status = 'created', handled_at = now(), store_id = v_company_id
   where id = v_sto.id;

  select c.name into v_company from public.companies c where c.id = v_sto.company_id;
  select lower(u.email::text), p.first_name into v_email, v_first
    from public.profiles p join auth.users u on u.id = p.id
   where p.id = v_sto.requested_by;

  perform public.log_system_action('Stripe', 'paiement_recu', 'demande_magasin', v_sto.id::text,
    v_sto.store_name, json_build_object('session', p_session_id, 'montant_cents', v_sto.quote_amount_cents)::jsonb);
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
end; $function$;

-- ⚠️ `create or replace function` rend EXECUTE à PUBLIC. Les droits se
-- reposent dans la même migration — leçon de `20260819172706`, oubliée deux
-- fois depuis. Cette fonction crée des entreprises : elle reste réservée au
-- rôle serveur, que seul le webhook porte.
revoke all on function public.fulfil_paid_request(text, text, text, text) from public, anon, authenticated;
grant execute on function public.fulfil_paid_request(text, text, text, text) to service_role;
