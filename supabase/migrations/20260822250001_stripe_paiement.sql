-- Le paiement passe par Stripe, et la création suit le paiement (22 août 2026).
--
-- Julien : « on ne fournit pas de RIB, le paiement doit passer par Stripe » —
-- puis « crée automatiquement une fois payé ». Le parcours devient :
--
--   devis accepté → session Stripe Checkout → paiement (carte ou SEPA)
--   → webhook `checkout.session.completed` → `paid` → création → invitation.
--
-- La section « Paiement : Stripe à terme » d'AGENTS.md avait fixé les règles,
-- elles sont tenues : le seul point d'accroche est la transition
-- `accepted → paid`, la création reste derrière le paiement et n'est jamais
-- déclenchée par le client, et la ré-émission d'un webhook est un cas normal.
--
-- ⚠️ Le webhook arrive **sans session utilisateur** : `auth.uid()` est nul,
-- donc ni `is_admin()` ni `log_admin_action` (qui lit `auth.uid()`) ne peuvent
-- servir. D'où une fonction dédiée, `fulfil_paid_request`, exécutable par le
-- **seul `service_role`**, qui journalise sous l'auteur « Stripe ».

-- ── Corrélation ───────────────────────────────────────────────────────────
alter table public.company_requests
  add column if not exists stripe_checkout_session_id text,
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_invoice_id text,
  add column if not exists stripe_payment_intent_id text;

alter table public.store_requests
  add column if not exists stripe_checkout_session_id text,
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_invoice_id text,
  add column if not exists stripe_payment_intent_id text;

-- Une session Checkout ne sert qu'une demande : c'est ce qui rend le rejeu
-- d'un webhook inoffensif (on retrouve la même ligne, déjà payée).
create unique index if not exists company_requests_stripe_session_idx
  on public.company_requests (stripe_checkout_session_id) where stripe_checkout_session_id is not null;
create unique index if not exists store_requests_stripe_session_idx
  on public.store_requests (stripe_checkout_session_id) where stripe_checkout_session_id is not null;

-- ── Poser la session Checkout sur la demande ──────────────────────────────
-- Appelée par `accept-quote` juste après l'acceptation, en `service_role`.
create or replace function public.attach_checkout_session(
  p_kind text, p_id uuid, p_session_id text, p_customer_id text default null)
returns json
language plpgsql security definer set search_path to 'public'
as $$
begin
  if p_kind = 'company' then
    update public.company_requests
       set stripe_checkout_session_id = p_session_id,
           stripe_customer_id = coalesce(p_customer_id, stripe_customer_id),
           updated_at = now()
     where id = p_id and status = 'accepted';
  elsif p_kind = 'store' then
    update public.store_requests
       set stripe_checkout_session_id = p_session_id,
           stripe_customer_id = coalesce(p_customer_id, stripe_customer_id)
     where id = p_id and status = 'accepted';
  else
    return json_build_object('success', false, 'error', 'Genre inconnu');
  end if;
  if not found then
    return json_build_object('success', false, 'error', 'Demande introuvable ou pas en attente de paiement');
  end if;
  return json_build_object('success', true);
end;
$$;

-- ── Le journal, sans session ──────────────────────────────────────────────
-- `log_admin_action` lit `auth.uid()` : ici il n'y en a pas. Même table, même
-- contrat — une action qui ne peut pas se journaliser échoue.
create or replace function public.log_system_action(
  p_actor text, p_action text, p_target_type text, p_target_id text,
  p_target_label text, p_details jsonb default '{}'::jsonb)
returns void
language plpgsql security definer set search_path to 'public'
as $$
begin
  insert into public.admin_audit_log
    (actor_id, actor_label, action, target_type, target_id, target_label, details)
  values
    (null, coalesce(p_actor, 'système'), p_action,
     coalesce(p_target_type, ''), coalesce(p_target_id, ''),
     coalesce(p_target_label, ''), coalesce(p_details, '{}'::jsonb));
end;
$$;

-- ── Payé, donc créé ───────────────────────────────────────────────────────
-- Une seule fonction pour les deux parcours, et pour les deux rejeux :
--   · demande `accepted` + session connue → `paid`, puis création ;
--   · demande déjà `paid` / `created` → succès sans rien faire (`already`),
--     c'est le webhook rejoué, et Stripe attend un 200 ;
--   · session inconnue → erreur, c'est un vrai problème.
--
-- Elle rend de quoi inviter le contact comme **administrateur de son
-- entreprise** : pour une inscription, l'entreprise vient de naître, il en
-- est le premier compte. Pour un ajout de magasin, le demandeur existe déjà.
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
  v_name text; v_i int; v_stores json[] := '{}'; v_res json;
  v_email text; v_first text; v_company text;
begin
  if p_session_id is null or btrim(p_session_id) = '' then
    return json_build_object('success', false, 'error', 'Session absente');
  end if;

  -- Inscription d'entreprise
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

    -- Création : même corps qu'`admin_fulfil_company_request`, les noms des
    -- magasins venant du devis (ses lignes) plutôt que d'une saisie console.
    v_company_code := public.gen_company_code();
    insert into public.companies (name, join_code) values (v_req.company_name, v_company_code)
      returning id into v_company_id;
    for v_i in 1..v_req.store_count loop
      v_name := coalesce(nullif(btrim(v_req.quote_lines -> (v_i - 1) ->> 'libelle'), ''),
                         nullif(btrim(v_req.stores -> (v_i - 1) ->> 'name'), ''),
                         'Magasin ' || v_i);
      v_store_code := public.gen_store_code();
      insert into public.stores (company_id, name, join_code)
        values (v_company_id, v_name, v_store_code);
      v_stores := v_stores || json_build_object('name', v_name, 'join_code', v_store_code);
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

  -- Ajout de magasin
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

  -- `admin_add_store` exige `is_admin()` : on reprend son geste à l'identique
  -- (code par `gen_store_code`), sans passer par elle.
  v_store_code := public.gen_store_code();
  insert into public.stores (company_id, name, join_code)
    values (v_sto.company_id, v_sto.store_name, v_store_code)
    returning id into v_company_id;  -- réutilisé comme store_id ci-dessous

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

-- ── Inviter le premier administrateur, sans session ───────────────────────
-- Même écriture qu'`admin_invite_company_admin` (branche « invited »), sans
-- `is_admin()` ni `auth.uid()` : `created_by` prend le premier administrateur
-- Quantinvo, faute d'acteur. `handle_new_user` fera le reste à la connexion.
create or replace function public.invite_company_admin_after_payment(
  p_company uuid, p_email text, p_first text, p_last text)
returns json
language plpgsql security definer set search_path to 'public'
as $$
declare v_email text := lower(btrim(coalesce(p_email, ''))); v_by uuid;
begin
  if v_email = '' then return json_build_object('success', false, 'error', 'Adresse absente'); end if;
  if exists (select 1 from auth.users u where lower(u.email) = v_email) then
    -- Le compte existe déjà (client qui ajoute une seconde entreprise ?) :
    -- on ne touche pas à son rattachement, c'est un cas pour Quantinvo.
    return json_build_object('success', false, 'error', 'account_exists');
  end if;
  select id into v_by from public.profiles where is_admin order by created_at limit 1;
  delete from public.team_invitations where lower(email) = v_email;
  insert into public.team_invitations
    (company_id, email, first_name, last_name, full_name, created_by, store_ids, role)
  values
    (p_company, v_email, btrim(p_first), btrim(p_last), btrim(btrim(p_first) || ' ' || btrim(p_last)),
     v_by, '{}', 'company_admin');
  return json_build_object('success', true, 'email', v_email);
end;
$$;

-- ── Droits : tout cela n'appartient qu'au serveur ─────────────────────────
revoke all on function public.attach_checkout_session(text, uuid, text, text) from public, anon, authenticated;
grant execute on function public.attach_checkout_session(text, uuid, text, text) to service_role;
revoke all on function public.log_system_action(text, text, text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.log_system_action(text, text, text, text, text, jsonb) to service_role;
revoke all on function public.fulfil_paid_request(text, text, text, text) from public, anon, authenticated;
grant execute on function public.fulfil_paid_request(text, text, text, text) to service_role;
revoke all on function public.invite_company_admin_after_payment(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.invite_company_admin_after_payment(uuid, text, text, text) to service_role;

-- ── accept_quote_by_token rend l'identifiant et le statut ─────────────────
-- `accept-quote` en a besoin pour ouvrir la session Checkout et la rattacher à
-- la demande. Les deux branches « déjà accepté » rendent aussi de quoi
-- reproposer le paiement : un second clic sur « J'accepte » doit remener au
-- même Checkout, jamais dire « déjà fait » sans issue.
-- (Corps identique à 20260822230001, plus `request_id` et `status`.)
create or replace function public.accept_quote_by_token(p_token uuid)
returns json
language plpgsql security definer set search_path to 'public'
as $$
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
        'accepted_at', v_req.accepted_at, 'company_name', v_req.company_name,
        'reference', v_req.quote_reference, 'amount_cents', v_req.quote_amount_cents,
        'contact_email', v_req.contact_email, 'contact_first_name', v_req.contact_first_name);
    end if;
    if v_req.status <> 'quoted' then
      return json_build_object('success', false, 'error', 'Ce devis n''est plus en attente d''accord.');
    end if;
    if v_req.quote_expires_at is not null and v_req.quote_expires_at < now() then
      return json_build_object('success', false, 'error',
        'Ce devis a expiré. Demandez-nous une nouvelle proposition.');
    end if;

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
      'accepted_at', v_sto.accepted_at, 'company_name', coalesce(v_company, ''),
      'store_name', v_sto.store_name,
      'reference', v_sto.quote_reference, 'amount_cents', v_sto.quote_amount_cents,
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
    'contact_email', (select lower(u.email::text) from auth.users u where u.id = v_sto.requested_by),
    'contact_first_name', (select p.first_name from public.profiles p where p.id = v_sto.requested_by));
end;
$$;

revoke all on function public.accept_quote_by_token(uuid) from public;
grant execute on function public.accept_quote_by_token(uuid) to anon, authenticated, service_role;
