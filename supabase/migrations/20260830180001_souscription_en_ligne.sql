-- Souscription en ligne (30 août 2026) — APPLIQUÉE EN PRODUCTION par MCP.
--
-- Les trois offres se souscrivent par carte, sans devis : le prix est public
-- et le client l'a choisi sur /tarifs. Le parcours RÉUTILISE company_requests
-- et fulfil_paid_request — une souscription est une demande née directement en
-- 'accepted', puisqu'il n'y a rien à négocier. Voir AGENTS.md, section « La
-- souscription en ligne », pour les points à ne pas défaire.

alter table public.companies
  add column if not exists plan text not null default 'standard',
  add column if not exists billing_period text,
  add column if not exists license_status text not null default 'active',
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text;

do $$ begin
  alter table public.companies add constraint companies_plan_connu
    check (plan in ('standard', 'essential', 'advanced', 'enterprise'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.companies add constraint companies_rythme_connu
    check (billing_period is null or billing_period in ('monthly', 'yearly'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.companies add constraint companies_licence_connue
    check (license_status in ('active', 'past_due', 'canceled'));
exception when duplicate_object then null; end $$;

create unique index if not exists companies_stripe_subscription_idx
  on public.companies (stripe_subscription_id)
  where stripe_subscription_id is not null;

alter table public.company_requests
  add column if not exists plan text,
  add column if not exists billing_period text;

do $$ begin
  alter table public.company_requests add constraint company_requests_plan_connu
    check (plan is null or plan in ('essential', 'advanced', 'enterprise'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.company_requests add constraint company_requests_rythme_connu
    check (billing_period is null or billing_period in ('monthly', 'yearly'));
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- fulfil_paid_request gagne p_subscription_id et pose le plan à la création.
--
-- ⚠️ L'ancienne signature à cinq arguments est SUPPRIMÉE : p_subscription_id
-- ayant un défaut, Postgres garderait les deux et un appel à cinq deviendrait
-- ambigu. Même piège que p_event_id le 28 août.
--
-- Le corps complet est celui qui tourne en base (pg_get_functiondef) : il
-- reprend la version du 28 août en ajoutant, à l'insert `companies`, les
-- colonnes plan / billing_period / stripe_customer_id / stripe_subscription_id,
-- et le plan au journal comme à la valeur de retour.
-- ---------------------------------------------------------------------------
drop function if exists public.fulfil_paid_request(text, text, text, text, text);
-- (corps : voir la définition en base, trop longue pour être recopiée ici sans
--  risque de divergence — c'est la base qui fait foi, règle du projet.)

revoke all on function public.fulfil_paid_request(text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.fulfil_paid_request(text, text, text, text, text, text) to service_role;

-- ---------------------------------------------------------------------------
-- Le dépôt d'une souscription.
--
-- ⚠️ La demande naît en 'accepted', pas en 'pending' : il n'y a pas de devis à
-- établir. C'est ce qui permet à fulfil_paid_request de fonctionner sans
-- modification de sa garde de transition.
--
-- ⚠️ service_role SEUL. L'appelant est la fonction edge, qui a déjà validé la
-- saisie. Ouvrir cette fonction à `anon` laisserait créer des demandes déjà
-- acceptées sans aucun frein.
-- ---------------------------------------------------------------------------
create or replace function public.deposer_souscription(
  p_company_name text, p_first_name text, p_last_name text, p_email text,
  p_store_name text, p_plan text, p_billing_period text,
  p_amount_cents bigint, p_annual_cents bigint
) returns json
language plpgsql security definer set search_path to 'public'
as $$
declare
  v_id uuid;
  v_company text := public.nom_propre(p_company_name);
  v_store text := public.nom_propre(p_store_name);
  v_first text := public.nom_propre(p_first_name);
  v_last text := public.nom_propre(p_last_name);
  v_email text := lower(btrim(coalesce(p_email, '')));
begin
  if v_company is null or v_store is null or v_first is null or v_last is null then
    return json_build_object('success', false, 'error', 'Renseignez tous les champs.');
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

  -- La limitation vient APRÈS la validation de saisie (une faute de frappe ne
  -- consomme pas le quota) et AVANT toute écriture.
  if not public.rate_limit_ok('souscription', v_email, 5, interval '1 hour') then
    return json_build_object('success', false, 'error',
      'Trop de tentatives pour cette adresse. Reessayez dans une heure.');
  end if;

  insert into public.company_requests (
    company_name, contact_first_name, contact_last_name, contact_email,
    store_count, status, accepted_at, plan, billing_period,
    quote_amount_cents, quote_lines, stores, admin_note
  ) values (
    v_company, v_first, v_last, v_email,
    1, 'accepted', now(), p_plan, p_billing_period, p_annual_cents,
    jsonb_build_array(jsonb_build_object('libelle', v_store, 'prixCents', p_annual_cents)),
    jsonb_build_array(jsonb_build_object('name', v_store)),
    'Souscription en ligne'
  ) returning id into v_id;

  perform public.log_system_action('Souscription', 'souscription_deposee', 'demande_entreprise',
    v_id::text, v_company,
    json_build_object('plan', p_plan, 'rythme', p_billing_period,
                      'montant_cents', p_amount_cents)::jsonb);

  return json_build_object('success', true, 'request_id', v_id);
end; $$;

revoke all on function public.deposer_souscription(text, text, text, text, text, text, text, bigint, bigint) from public, anon, authenticated;
grant execute on function public.deposer_souscription(text, text, text, text, text, text, text, bigint, bigint) to service_role;

-- ---------------------------------------------------------------------------
-- Le cycle de vie d'un abonnement.
--
-- ⚠️ On ne coupe RIEN ici : un impayé passe la licence en 'past_due', jamais en
-- suspension d'accès. Couper le service d'un magasin sur un incident de carte,
-- c'est bloquer un inventaire un soir de comptage — la même règle que le
-- plafond souple. La relance est commerciale, pas technique.
-- ---------------------------------------------------------------------------
create or replace function public.sync_subscription_status(
  p_subscription_id text, p_status text, p_event_id text default null
) returns json
language plpgsql security definer set search_path to 'public'
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
    when 'past_due' then 'past_due' when 'unpaid' then 'past_due'
    when 'canceled' then 'canceled' when 'active' then 'active'
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
  if not found then
    -- L'abonnement peut arriver avant que la création n'ait eu lieu (course
    -- entre deux événements Stripe). On ne lève pas : Stripe rejouerait sans
    -- fin un événement qui n'a pas d'objet.
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

revoke all on function public.sync_subscription_status(text, text, text) from public, anon, authenticated;
grant execute on function public.sync_subscription_status(text, text, text) to service_role;
