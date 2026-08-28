-- VR-002 — on crée ce qui a été devisé, pas ce que le client a déclaré.
--
-- `fulfil_paid_request` bouclait sur `1..v_req.store_count`, une valeur SAISIE
-- PAR LE PROSPECT dans le formulaire public (bornée de 1 à 500 par contrainte),
-- et non sur `quote_lines`, qui décrit ce qui a été devisé et payé. Rien ne
-- vérifiait que les deux coïncidaient.
--
-- ⚠️ Le document que le client signe compte déjà les LIGNES : dans
-- `admin-send-quote`, le PDF fait `const magasins = lignes.length ||
-- q.store_count`. Le devis et la création n'utilisaient donc pas la même
-- source — ils ne pouvaient diverger silencieusement que dans un sens : plus
-- de magasins livrés que facturés.
--
-- Non atteignable au moment de l'écrire : la console appelle
-- `lignesProposees(requete.stores, requete.store_count)`, donc autant de lignes
-- que de magasins déclarés, et /inscription envoie
-- `p_store_count: magasins.length`. Vérifié en base : aucune demande
-- incohérente, la table est vide. C'est une dette qu'on ferme avant qu'elle ne
-- devienne une brèche, pas une brèche ouverte.
--
-- Deux gestes, et il faut les deux :
--
--   1. la création suit le devis — `fulfil_paid_request` boucle sur le nombre
--      de lignes du devis ;
--   2. le devis ne peut plus être incohérent — `admin_quote_company_request`
--      refuse un devis dont les lignes ne correspondent pas aux magasins
--      déclarés.
--
-- Le premier protège la création quoi qu'il arrive en amont ; le second évite
-- qu'un devis faux parte chez un client.
--
-- ⚠️ LE REPLI SUR `store_count` RESTE, ET IL EST NÉCESSAIRE. `p_lines` a pour
-- défaut `'[]'` et `jsonb_array_length('[]')` vaut 0, pas null : un `coalesce`
-- naïf ferait boucler 1..0, donc créerait ZÉRO magasin pour un devis sans
-- lignes. D'où le `nullif(…, 0)`. Un devis sans lignes garde le comportement
-- d'aujourd'hui — l'administrateur a fixé le montant en connaissance de cause.
--
-- ⚠️ ET LE PRIX DE REPLI SE DIVISE PAR LE NOMBRE RÉELLEMENT CRÉÉ, plus par
-- `store_count` : sinon un devis à moins de lignes sous-évaluerait chaque
-- magasin créé.
--
-- Le reste de la fonction est inchangé — le verrou de ligne et la garde de
-- statut de `20260828210001` sont conservés tels quels.

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
  v_name text; v_i int; v_n int; v_stores json[] := '{}';
  v_email text; v_first text; v_company text;
  v_prix bigint; v_ligne jsonb; v_decl jsonb;
begin
  if p_session_id is null or btrim(p_session_id) = '' then
    return json_build_object('success', false, 'error', 'Session absente');
  end if;

  -- `for update` : le verrou de ligne est ce qui sérialise deux webhooks
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
    -- `already`, pas une erreur : Stripe rejoue tant qu'il n'a pas de 200.
    if not found then
      return json_build_object('success', true, 'already', true, 'kind', 'company',
        'status', 'paid', 'company_id', v_req.company_id);
    end if;

    -- Le devis fait foi. `nullif(…, 0)` : un devis sans lignes retombe sur les
    -- magasins déclarés, il ne crée pas zéro magasin.
    v_n := coalesce(nullif(jsonb_array_length(coalesce(v_req.quote_lines, '[]'::jsonb)), 0),
                    v_req.store_count);

    v_company_code := public.gen_company_code();
    insert into public.companies (name, join_code) values (v_req.company_name, v_company_code)
      returning id into v_company_id;
    for v_i in 1..v_n loop
      v_ligne := v_req.quote_lines -> (v_i - 1);
      v_decl  := v_req.stores -> (v_i - 1);
      v_name := coalesce(nullif(btrim(v_ligne ->> 'libelle'), ''),
                         nullif(btrim(v_decl ->> 'name'), ''),
                         'Magasin ' || v_i);
      v_prix := coalesce((v_ligne ->> 'prixCents')::bigint,
                         case when v_req.quote_amount_cents is not null and v_n > 0
                              then v_req.quote_amount_cents / v_n end);
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
      v_req.company_name, json_build_object('demande_id', v_req.id::text, 'magasins', v_n)::jsonb);

    return json_build_object(
      'success', true, 'already', false, 'kind', 'company',
      'company_id', v_company_id, 'company_name', v_req.company_name,
      'stores', array_to_json(v_stores),
      'invite', json_build_object(
        'email', lower(v_req.contact_email),
        'first_name', v_req.contact_first_name,
        'last_name', v_req.contact_last_name));
  end if;

  -- Même verrou côté demande de magasin. Cette branche crée UN magasin nommé,
  -- pas une boucle : VR-002 ne la concerne pas.
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

revoke all on function public.fulfil_paid_request(text, text, text, text) from public, anon, authenticated;
grant execute on function public.fulfil_paid_request(text, text, text, text) to service_role;


-- Et le devis ne peut plus être incohérent.
--
-- ⚠️ Le refus porte sur « des lignes existent ET leur nombre diffère », pas sur
-- « pas de lignes » : `p_lines` a pour défaut `'[]'`, et un devis sans lignes
-- reste un geste délibéré de l'administrateur, dont le montant fait foi. On
-- ferme la divergence, on n'interdit pas le repli.

create or replace function public.admin_quote_company_request(
  p_id uuid, p_reference text, p_amount_cents bigint,
  p_note text default ''::text, p_lines jsonb default '[]'::jsonb)
 returns json
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare v_req public.company_requests%rowtype; v_token uuid; v_n int; v_lignes int;
begin
  if not public.is_admin() then return json_build_object('success', false, 'error', 'Accès refusé'); end if;
  if p_amount_cents is null or p_amount_cents < 0 then
    return json_build_object('success', false, 'error', 'Montant invalide');
  end if;

  -- Autant de lignes que de magasins déclarés, ou pas de lignes du tout.
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
$function$;

revoke all on function public.admin_quote_company_request(uuid, text, bigint, text, jsonb) from public, anon;
grant execute on function public.admin_quote_company_request(uuid, text, bigint, text, jsonb) to authenticated;
