-- Le prix payé se reporte sur le magasin (22 août 2026).
--
-- Trou trouvé au test complet du parcours : l'entreprise créée par le webhook
-- avait ses magasins avec `annual_price_cents` nul. Le devis portait pourtant
-- 2 100 € et 4 200 € ligne par ligne — le tableau de bord estimait ensuite ces
-- magasins au panier moyen, alors qu'on connaît le prix exact payé. Le revenu
-- annuel affiché était faux dès le premier client.
--
-- Règle : **le prix d'un magasin, c'est ce que le devis a facturé pour lui.**
--   · inscription : la ligne du devis dont le libellé correspond au magasin
--     (c'est elle qui a nommé le magasin) ; à défaut, le total divisé par le
--     nombre de magasins — un prix approché vaut mieux qu'un panier moyen ;
--   · ajout de magasin : le montant du devis, il n'y a qu'un magasin.
--
-- Même corps que 20260822250001, plus le report du prix. Le reste ne bouge
-- pas — rejeu, session inconnue, journal, invitation.

create or replace function public.fulfil_paid_request(
  p_session_id text,
  p_customer_id text default null,
  p_invoice_id text default null,
  p_payment_intent_id text default null)
returns json
language plpgsql security definer set search_path to 'public'
as $$
declare
  v_req public.company_requests%rowtype;
  v_sto public.store_requests%rowtype;
  v_company_id uuid; v_company_code text; v_store_code text;
  v_name text; v_i int; v_stores json[] := '{}';
  v_email text; v_first text; v_company text;
  v_prix bigint; v_ligne jsonb;
begin
  if p_session_id is null or btrim(p_session_id) = '' then
    return json_build_object('success', false, 'error', 'Session absente');
  end if;

  select * into v_req from public.company_requests where stripe_checkout_session_id = p_session_id;
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
     where id = v_req.id;

    v_company_code := public.gen_company_code();
    insert into public.companies (name, join_code) values (v_req.company_name, v_company_code)
      returning id into v_company_id;
    for v_i in 1..v_req.store_count loop
      v_ligne := v_req.quote_lines -> (v_i - 1);
      v_name := coalesce(nullif(btrim(v_ligne ->> 'libelle'), ''),
                         nullif(btrim(v_req.stores -> (v_i - 1) ->> 'name'), ''),
                         'Magasin ' || v_i);
      -- Le prix de la ligne du devis ; à défaut, le total réparti.
      v_prix := coalesce((v_ligne ->> 'prixCents')::bigint,
                         case when v_req.quote_amount_cents is not null and v_req.store_count > 0
                              then v_req.quote_amount_cents / v_req.store_count end);
      v_store_code := public.gen_store_code();
      insert into public.stores (company_id, name, join_code, annual_price_cents)
        values (v_company_id, v_name, v_store_code, v_prix);
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

  select * into v_sto from public.store_requests where stripe_checkout_session_id = p_session_id;
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
   where id = v_sto.id;

  v_store_code := public.gen_store_code();
  insert into public.stores (company_id, name, join_code, annual_price_cents)
    values (v_sto.company_id, v_sto.store_name, v_store_code, v_sto.quote_amount_cents)
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
end;
$$;

revoke all on function public.fulfil_paid_request(text, text, text, text) from public, anon, authenticated;
grant execute on function public.fulfil_paid_request(text, text, text, text) to service_role;

-- Rattrapage des magasins créés par le webhook avant ce correctif : le prix de
-- la ligne du devis, retrouvé par le nom du magasin.
update public.stores s
   set annual_price_cents = (l ->> 'prixCents')::bigint
  from public.company_requests r, jsonb_array_elements(r.quote_lines) l
 where r.company_id = s.company_id and r.status = 'created'
   and btrim(l ->> 'libelle') = s.name
   and s.annual_price_cents is null and (l ->> 'prixCents') is not null;

update public.stores s
   set annual_price_cents = r.quote_amount_cents
  from public.store_requests r
 where r.store_id = s.id and r.status = 'created'
   and s.annual_price_cents is null and r.quote_amount_cents is not null;
