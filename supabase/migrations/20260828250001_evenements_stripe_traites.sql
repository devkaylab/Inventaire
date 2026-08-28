-- La vraie idempotence du webhook : un événement Stripe ne se traite qu'une fois.
--
-- `20260828210001` a fermé la course avec `for update`, et le contrôle de statut
-- répond déjà `already` à une redélivrance. Cette table est la **défense en
-- profondeur** : elle tient l'invariant au niveau de l'ÉVÉNEMENT, indépendamment
-- de l'état de la demande, et elle laisse une trace de ce qui a été reçu et
-- quand — ce qui manquait pour répondre à « a-t-on bien reçu ce webhook ? ».
--
-- Elle prépare aussi `checkout.session.async_payment_succeeded`, que le
-- prélèvement SEPA ajoutera : deux types d'événement pour un même paiement.
--
-- ⚠️ LE MARQUAGE EST DANS `fulfil_paid_request`, PAS DANS LA FONCTION EDGE, et
-- c'est le point de conception. Marquer depuis le webhook, avant d'appeler la
-- création, rendrait tout échec DÉFINITIF : le client paie, la création échoue,
-- Stripe réessaie, et le rejeu est écarté comme « déjà vu ». Il faudrait alors
-- démarquer sur chaque chemin d'erreur — une compensation qu'on finirait par
-- oublier sur un chemin ajouté plus tard.
--
-- Dans la même transaction que la création, il n'y a rien à compenser : si la
-- fonction lève, la marque disparaît avec le travail. C'est tout l'intérêt.
--
-- ⚠️ ET LE MARQUAGE VIENT EN PREMIER, avant même la lecture de la demande : un
-- `insert … on conflict do nothing` qui ne pose aucune ligne dit que
-- l'événement est déjà passé, et on sort par `already` sans rien relire.
--
-- ⚠️ `p_event_id` est FACULTATIF, et le rester. Un appel sans identifiant se
-- comporte exactement comme avant. C'est ce qui permet de déployer la migration
-- avant la fonction edge — l'ordre imposé par la règle du projet, code d'abord,
-- et ici la base ne peut pas attendre que le webhook soit à jour.

create table if not exists public.stripe_events_traites (
  event_id text primary key,
  recu_le   timestamptz not null default now()
);

-- RLS active, aucune policy : refus par défaut. Rien ne lit cette table depuis
-- un client — même figure que `submission_attempts` et `alertes_envoyees`.
alter table public.stripe_events_traites enable row level security;

create index if not exists stripe_events_traites_recu_le_idx
  on public.stripe_events_traites (recu_le);


create or replace function public.fulfil_paid_request(
  p_session_id text,
  p_customer_id text default null::text,
  p_invoice_id text default null::text,
  p_payment_intent_id text default null::text,
  p_event_id text default null::text)
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
  v_evt text := nullif(btrim(coalesce(p_event_id, '')), '');
begin
  if p_session_id is null or btrim(p_session_id) = '' then
    return json_build_object('success', false, 'error', 'Session absente');
  end if;

  -- Un événement déjà traité ne se rejoue pas. Dans la même transaction que
  -- tout ce qui suit : si le travail échoue, cette marque disparaît avec lui.
  if v_evt is not null then
    insert into public.stripe_events_traites (event_id) values (v_evt)
      on conflict (event_id) do nothing;
    if not found then
      return json_build_object('success', true, 'already', true,
        'kind', 'evenement', 'event_id', v_evt);
    end if;
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

  -- Même verrou côté demande de magasin. Cette branche crée UN magasin nommé.
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

-- ⚠️ L'ANCIENNE SIGNATURE À QUATRE ARGUMENTS EST SUPPRIMÉE. `p_event_id` ayant
-- une valeur par défaut, Postgres garderait les deux et un appel à quatre
-- arguments deviendrait ambigu — même piège que `ca_request_store` le 22 août.
drop function if exists public.fulfil_paid_request(text, text, text, text);

revoke all on function public.fulfil_paid_request(text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.fulfil_paid_request(text, text, text, text, text) to service_role;


-- La table entre dans la purge, comme tout le reste. Trente jours : Stripe ne
-- rejoue pas au-delà, et garder plus longtemps n'apprendrait rien.
create or replace function public.purge_expired_data()
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  invitations_ttl      constant interval := interval '3 months';
  demandes_sup_ttl     constant interval := interval '1 year';
  demandes_ent_rej_ttl constant interval := interval '1 year';
  demandes_ent_ttl     constant interval := interval '3 years';
  suppressions_ttl     constant interval := interval '1 year';
  journal_admin_ttl    constant interval := interval '1 year';
  journal_entrep_ttl   constant interval := interval '1 year';
  demandes_mag_ttl     constant interval := interval '1 year';
  evenements_ttl       constant interval := interval '30 days';
  rapport              jsonb := '{}'::jsonb;
  n                    int;
begin
  delete from public.team_invitations where created_at < now() - invitations_ttl;
  get diagnostics n = row_count;  rapport := rapport || jsonb_build_object('team_invitations_supprimees', n);

  delete from public.session_invitations where created_at < now() - invitations_ttl;
  get diagnostics n = row_count;  rapport := rapport || jsonb_build_object('session_invitations_supprimees', n);

  update public.supervisor_requests
     set first_name = '', last_name = '',
         email = 'expire+' || id::text || '@invalide.local', phone = ''
   where status in ('active', 'rejected')
     and created_at < now() - demandes_sup_ttl
     and email not like 'expire+%';
  get diagnostics n = row_count;  rapport := rapport || jsonb_build_object('supervisor_requests_anonymisees', n);

  delete from public.company_requests
   where status = 'rejected' and updated_at < now() - demandes_ent_rej_ttl;
  get diagnostics n = row_count;  rapport := rapport || jsonb_build_object('company_requests_supprimees', n);

  update public.company_requests
     set contact_first_name = '', contact_last_name = '',
         contact_email = 'expire+' || id::text || '@invalide.local', contact_phone = ''
   where updated_at < now() - demandes_ent_ttl
     and contact_email not like 'expire+%';
  get diagnostics n = row_count;  rapport := rapport || jsonb_build_object('company_requests_anonymisees', n);

  delete from public.account_deletion_requests where created_at < now() - suppressions_ttl;
  get diagnostics n = row_count;  rapport := rapport || jsonb_build_object('deletion_requests_supprimees', n);

  delete from public.admin_audit_log where created_at < now() - journal_admin_ttl;
  get diagnostics n = row_count;  rapport := rapport || jsonb_build_object('journal_admin_supprime', n);

  delete from public.company_audit_log where created_at < now() - journal_entrep_ttl;
  get diagnostics n = row_count;  rapport := rapport || jsonb_build_object('journal_entreprise_supprime', n);

  delete from public.store_requests
   where handled_at is not null and handled_at < now() - demandes_mag_ttl;
  get diagnostics n = row_count;  rapport := rapport || jsonb_build_object('demandes_magasin_supprimees', n);

  delete from public.stripe_events_traites where recu_le < now() - evenements_ttl;
  get diagnostics n = row_count;  rapport := rapport || jsonb_build_object('evenements_stripe_supprimes', n);

  return rapport || jsonb_build_object('execute_le', now());
end;
$function$;

revoke all on function public.purge_expired_data() from public, anon, authenticated;
