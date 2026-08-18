-- ─────────────────────────────────────────────────────────────────────────
-- Formulaires publics : limitation de débit et réponses uniformes (M3).
--
-- Deux défauts sur `/inscription` et `/superviseur` :
--
--   1. rien ne limitait le nombre d'envois — un script peut remplir la file de
--      l'administrateur et déclencher autant d'e-mails ;
--   2. `submit_supervisor_request` répondait différemment selon le cas. Trois
--      réponses distinctes, dont deux qui renseignent sur le contenu de la
--      base : « code magasin introuvable » (donc quels codes sont valides) et
--      « un compte existe déjà » (donc qui est inscrit). Le succès lui-même
--      renvoyait le nom du magasin. Or le code magasin est confidentiel : son
--      SELECT est révoqué à `anon` et `authenticated` depuis la migration
--      20260813000006. Le formulaire donnait par la porte ce qui est verrouillé
--      par la fenêtre — et le second cas rouvrait l'énumération d'adresses
--      fermée en 20260813000010.
--
-- Correctif : la fonction publique répond **toujours la même chose**. Le détail
-- reste calculé, mais n'est accessible qu'au rôle serveur, pour qu'une fonction
-- edge puisse envoyer par e-mail l'explication à l'adresse saisie — un canal
-- qui n'atteint que le propriétaire de l'adresse.
--
-- Les erreurs de saisie (nom manquant, adresse malformée) restent explicites :
-- elles ne parlent que de ce que la personne vient de taper, pas de la base.
-- ─────────────────────────────────────────────────────────────────────────

-- ── Compteur de tentatives ─────────────────────────────────────────────────
create table if not exists public.submission_attempts (
  id         bigserial primary key,
  scope      text        not null,
  key        text        not null,
  created_at timestamptz not null default now()
);

create index if not exists submission_attempts_lookup
  on public.submission_attempts (scope, key, created_at desc);

alter table public.submission_attempts enable row level security;
-- Aucune policy : seules les fonctions SECURITY DEFINER y touchent.

comment on table public.submission_attempts is
  'Tentatives d''envoi des formulaires publics, pour la limitation de débit (M3). Purgé au-delà de 24 h.';

-- Adresse de l'appelant, telle que PostgREST la transmet. Absente hors requête
-- HTTP (psql, migrations) : la limitation par adresse est alors simplement
-- inopérante, celle par e-mail continue de s'appliquer.
create or replace function public.client_ip()
returns text language plpgsql stable security definer set search_path = public as $$
declare v_entete text;
begin
  v_entete := current_setting('request.headers', true)::json ->> 'x-forwarded-for';
  if v_entete is null or btrim(v_entete) = '' then return null; end if;
  -- `x-forwarded-for` est une liste : la première valeur est le client.
  return btrim(split_part(v_entete, ',', 1));
exception when others then
  return null;
end $$;

-- Enregistre la tentative et dit si le seuil est encore respecté.
create or replace function public.rate_limit_ok(
  p_scope text, p_key text, p_max int, p_window interval)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_cle text := lower(btrim(coalesce(p_key, ''))); v_n int;
begin
  if v_cle = '' then return true; end if;      -- rien à compter

  -- Purge opportuniste : ces lignes ne servent qu'à la fenêtre glissante.
  delete from public.submission_attempts where created_at < now() - interval '1 day';

  insert into public.submission_attempts (scope, key) values (p_scope, v_cle);

  select count(*) into v_n
    from public.submission_attempts
   where scope = p_scope and key = v_cle and created_at > now() - p_window;

  return v_n <= p_max;
end $$;

revoke all on function public.client_ip() from public, anon, authenticated;
revoke all on function public.rate_limit_ok(text, text, int, interval) from public, anon, authenticated;

-- ── Demande superviseur : le détail, réservé au rôle serveur ───────────────
-- `outcome` vaut 'created', 'unknown_store', 'account_exists' ou
-- 'request_pending'. Seule une fonction edge en `service_role` peut l'obtenir,
-- pour envoyer l'explication par e-mail.
create or replace function public.submit_supervisor_request_detailed(
  p_first_name text, p_last_name text, p_email text, p_phone text, p_store_code text)
returns json language plpgsql security definer set search_path to 'public', 'auth'
as $$
declare
  v_store public.stores%rowtype;
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_id uuid;
begin
  if coalesce(btrim(p_first_name), '') = '' or coalesce(btrim(p_last_name), '') = '' then
    return json_build_object('success', false, 'error', 'Le prénom et le nom sont requis.');
  end if;
  if v_email = '' or position('@' in v_email) = 0 then
    return json_build_object('success', false, 'error', 'Adresse e-mail invalide.');
  end if;

  select * into v_store from public.stores
   where join_code = upper(btrim(coalesce(p_store_code, '')));
  if not found then
    return json_build_object('success', true, 'outcome', 'unknown_store', 'email', v_email);
  end if;

  if exists (select 1 from auth.users u where lower(u.email) = v_email) then
    return json_build_object('success', true, 'outcome', 'account_exists', 'email', v_email);
  end if;

  if exists (select 1 from public.supervisor_requests
             where lower(email) = v_email and status in ('pending','approved')) then
    return json_build_object('success', true, 'outcome', 'request_pending', 'email', v_email);
  end if;

  insert into public.supervisor_requests
    (first_name, last_name, email, phone, store_id, company_id)
  values
    (btrim(p_first_name), btrim(p_last_name), v_email, coalesce(btrim(p_phone), ''),
     v_store.id, v_store.company_id)
  returning id into v_id;

  return json_build_object('success', true, 'outcome', 'created', 'email', v_email,
                           'request_id', v_id::text, 'store_name', v_store.name,
                           'first_name', btrim(p_first_name));
end $$;

revoke all on function public.submit_supervisor_request_detailed(text, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.submit_supervisor_request_detailed(text, text, text, text, text)
  to service_role;

-- ── Demande superviseur : la fonction publique, muette ─────────────────────
create or replace function public.submit_supervisor_request(
  p_first_name text, p_last_name text, p_email text, p_phone text, p_store_code text)
returns json language plpgsql security definer set search_path to 'public'
as $$
declare v_detail json; v_email text := lower(btrim(coalesce(p_email, '')));
begin
  -- 5 envois par heure et par adresse, 20 par heure et par point de connexion.
  if not public.rate_limit_ok('supervisor_request', v_email, 5, interval '1 hour')
     or not public.rate_limit_ok('supervisor_request_ip', public.client_ip(), 20, interval '1 hour') then
    return json_build_object('success', false,
      'error', 'Trop de tentatives depuis cette adresse. Réessayez dans une heure.');
  end if;

  v_detail := public.submit_supervisor_request_detailed(
    p_first_name, p_last_name, p_email, p_phone, p_store_code);

  -- Les erreurs de saisie restent dites : elles ne révèlent rien de la base.
  if (v_detail ->> 'success')::boolean is not true then
    return v_detail;
  end if;

  -- Tout le reste — code inconnu, compte existant, demande déjà en cours,
  -- création réussie — donne exactement la même réponse. Sans nom de magasin.
  return json_build_object('success', true, 'received', true);
end $$;

grant execute on function public.submit_supervisor_request(text, text, text, text, text)
  to anon, authenticated;

-- ── Demande entreprise : débit limité, doublon silencieux ──────────────────
-- Pas de code secret ici, mais « une demande est déjà en cours pour cette
-- adresse » disait tout de même si une adresse figurait dans la base. Et du
-- point de vue de la personne, la réponse est vraie dans les deux cas : sa
-- demande est bien enregistrée chez nous.
create or replace function public.submit_company_request(
  p_company_name text, p_first_name text, p_last_name text,
  p_email text, p_phone text, p_store_count int, p_message text default '')
returns json language plpgsql security definer set search_path to 'public'
as $$
declare v_id uuid; v_email text := lower(btrim(coalesce(p_email, '')));
begin
  if coalesce(btrim(p_company_name), '') = '' then
    return json_build_object('success', false, 'error', 'Le nom de l''entreprise est requis.');
  end if;
  if coalesce(btrim(p_first_name), '') = '' or coalesce(btrim(p_last_name), '') = '' then
    return json_build_object('success', false, 'error', 'Le prénom et le nom du contact sont requis.');
  end if;
  if v_email = '' or position('@' in v_email) = 0 then
    return json_build_object('success', false, 'error', 'Adresse e-mail invalide.');
  end if;
  if p_store_count is null or p_store_count < 1 or p_store_count > 500 then
    return json_build_object('success', false, 'error', 'Le nombre de magasins doit être compris entre 1 et 500.');
  end if;

  if not public.rate_limit_ok('company_request', v_email, 5, interval '1 hour')
     or not public.rate_limit_ok('company_request_ip', public.client_ip(), 20, interval '1 hour') then
    return json_build_object('success', false,
      'error', 'Trop de tentatives depuis cette adresse. Réessayez dans une heure.');
  end if;

  if exists (select 1 from public.company_requests
             where lower(contact_email) = v_email
               and status in ('pending','quoted','accepted','paid')) then
    return json_build_object('success', true, 'received', true);
  end if;

  insert into public.company_requests
    (company_name, contact_first_name, contact_last_name, contact_email, contact_phone,
     store_count, message)
  values
    (btrim(p_company_name), btrim(p_first_name), btrim(p_last_name), v_email,
     coalesce(btrim(p_phone), ''), p_store_count, coalesce(btrim(p_message), ''))
  returning id into v_id;

  return json_build_object('success', true, 'received', true);
end $$;

grant execute on function public.submit_company_request(text, text, text, text, text, int, text)
  to anon, authenticated;
