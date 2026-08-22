-- Le devis part tout seul, et s'accepte en ligne (22 août 2026).
--
-- Jusqu'ici : l'administrateur saisissait référence et montant dans la console,
-- fabriquait le PDF à la main depuis `docs/entreprise/modeles/devis.html`, et
-- l'envoyait depuis sa messagerie. Le statut passait à `quoted` sans que rien
-- ne parte. L'acceptation se déclarait à la main, elle aussi.
--
-- Ce que cette migration apporte, et rien de plus : de quoi **écrire** le devis
-- (ses lignes), de quoi **y renvoyer** (un jeton), et de quoi **l'accepter sans
-- compte**. L'envoi et le PDF sont le travail des fonctions edge ; la création
-- de l'entreprise ne bouge pas d'un pouce — elle reste derrière le paiement.
--
-- ⚠️ Le prospect **n'a pas de compte** à ce stade : c'est tout l'objet du
-- parcours d'inscription. L'acceptation est donc ouverte à `anon`, et c'est le
-- **jeton** qui tient lieu d'authentification. D'où trois précautions :
--   · un uuid v4 aléatoire, ni devinable ni énumérable ;
--   · aucune adresse e-mail rendue par la lecture — un lien transféré ne doit
--     rien apprendre de plus que le devis lui-même ;
--   · la limitation de débit de `rate_limit_ok`, comme les formulaires publics.

alter table public.company_requests
  add column if not exists quote_token uuid,
  add column if not exists quote_lines jsonb not null default '[]'::jsonb,
  add column if not exists quote_expires_at timestamptz;

create unique index if not exists company_requests_quote_token_idx
  on public.company_requests (quote_token) where quote_token is not null;

-- ── Envoyer le devis ──────────────────────────────────────────────────────
-- L'ancienne signature à quatre arguments est **supprimée** plutôt que laissée
-- à côté : Postgres garderait les deux et un appel à quatre arguments
-- deviendrait ambigu. La nouvelle les accepte tous les quatre (p_lines a un
-- défaut), donc le site déployé continue de fonctionner pendant la bascule.
drop function if exists public.admin_quote_company_request(uuid, text, bigint, text);

create or replace function public.admin_quote_company_request(
  p_id uuid,
  p_reference text,
  p_amount_cents bigint,
  p_note text default '',
  p_lines jsonb default '[]'::jsonb)
returns json
language plpgsql security definer set search_path to 'public'
as $$
declare v_req public.company_requests%rowtype; v_token uuid;
begin
  if not public.is_admin() then return json_build_object('success', false, 'error', 'Accès refusé'); end if;
  if p_amount_cents is null or p_amount_cents < 0 then
    return json_build_object('success', false, 'error', 'Montant invalide');
  end if;

  -- Un nouveau jeton à chaque envoi : renvoyer un devis invalide l'ancien lien,
  -- qui porterait sinon un montant périmé.
  v_token := gen_random_uuid();

  update public.company_requests
     set status = 'quoted',
         quote_reference = coalesce(btrim(p_reference), ''),
         quote_amount_cents = p_amount_cents,
         quote_lines = coalesce(p_lines, '[]'::jsonb),
         quote_sent_at = now(),
         quote_expires_at = now() + interval '30 days',
         quote_token = v_token,
         admin_note = coalesce(nullif(btrim(p_note), ''), admin_note),
         updated_at = now()
   where id = p_id and status in ('pending', 'quoted')
  returning * into v_req;
  if not found then
    return json_build_object('success', false, 'error', 'Demande introuvable ou déjà traitée');
  end if;

  perform public.log_admin_action('devis_envoye', 'demande_entreprise', p_id::text,
    coalesce(v_req.company_name, ''),
    json_build_object('reference', v_req.quote_reference, 'montant_cents', p_amount_cents)::jsonb);

  -- De quoi écrire le message : la fonction edge n'a pas d'autre moyen de
  -- connaître l'adresse du contact, et ne doit pas aller la chercher elle-même.
  return json_build_object(
    'success', true,
    'token', v_token,
    'quote', json_build_object(
      'reference', v_req.quote_reference,
      'amount_cents', v_req.quote_amount_cents,
      'lines', v_req.quote_lines,
      'company_name', v_req.company_name,
      'store_count', v_req.store_count,
      'contact_first_name', v_req.contact_first_name,
      'contact_last_name', v_req.contact_last_name,
      'contact_email', v_req.contact_email,
      'siren', v_req.siren,
      'sent_at', v_req.quote_sent_at,
      'expires_at', v_req.quote_expires_at));
end;
$$;

-- ── Lire un devis par son jeton (public) ──────────────────────────────────
-- Ce que la page publique affiche, et rien d'autre. Pas d'adresse e-mail, pas
-- de note interne, pas d'identifiant de demande : le devis, son état, ses
-- lignes.
create or replace function public.quote_by_token(p_token uuid)
returns json
language plpgsql
stable security definer
set search_path to 'public'
as $$
declare v_req public.company_requests%rowtype;
begin
  if p_token is null then return json_build_object('found', false); end if;
  select * into v_req from public.company_requests where quote_token = p_token;
  if not found then return json_build_object('found', false); end if;

  return json_build_object(
    'found', true,
    'company_name', v_req.company_name,
    'contact_first_name', v_req.contact_first_name,
    -- Nom complet et SIREN : ils figurent déjà sur le PDF que ce même jeton
    -- télécharge. Les taire ici ne protégerait rien et donnerait deux devis
    -- différents — celui reçu par e-mail et celui téléchargé.
    'contact_name', btrim(v_req.contact_first_name || ' ' || v_req.contact_last_name),
    'siren', v_req.siren,
    'reference', v_req.quote_reference,
    'amount_cents', v_req.quote_amount_cents,
    'lines', v_req.quote_lines,
    'status', v_req.status,
    'sent_at', v_req.quote_sent_at,
    'expires_at', v_req.quote_expires_at,
    'accepted_at', v_req.accepted_at,
    'expired', v_req.quote_expires_at is not null and v_req.quote_expires_at < now());
end;
$$;

-- ── Accepter un devis par son jeton (public) ──────────────────────────────
-- L'acceptation **ne crée rien** : elle pose une date et un statut. La création
-- de l'entreprise reste derrière le paiement (`admin_fulfil_company_request`
-- exige `paid`), et c'est ce qui rendra la bascule Stripe indolore.
--
-- Un devis périmé est refusé : le montant a pu changer entre-temps, et laisser
-- accepter un prix de l'an dernier créerait un désaccord au moment de facturer.
create or replace function public.accept_quote_by_token(p_token uuid)
returns json
language plpgsql security definer set search_path to 'public'
as $$
declare v_req public.company_requests%rowtype;
begin
  if p_token is null then
    return json_build_object('success', false, 'error', 'Lien invalide.');
  end if;
  -- Surface publique : même limitation de débit que les formulaires ouverts.
  if not public.rate_limit_ok('accept_quote', p_token::text, 10, interval '1 hour') then
    return json_build_object('success', false, 'error', 'Trop de tentatives. Réessayez dans une heure.');
  end if;

  select * into v_req from public.company_requests where quote_token = p_token;
  if not found then
    return json_build_object('success', false, 'error', 'Lien invalide.');
  end if;
  if v_req.status = 'accepted' or v_req.status = 'paid' or v_req.status = 'created' then
    -- Déjà accepté : ce n'est pas une erreur, c'est un second clic.
    return json_build_object('success', true, 'already', true,
      'accepted_at', v_req.accepted_at, 'company_name', v_req.company_name,
      'reference', v_req.quote_reference);
  end if;
  if v_req.status <> 'quoted' then
    return json_build_object('success', false, 'error', 'Ce devis n’est plus en attente d’accord.');
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
    return json_build_object('success', false, 'error', 'Ce devis n’est plus en attente d’accord.');
  end if;

  return json_build_object(
    'success', true,
    'already', false,
    'accepted_at', v_req.accepted_at,
    'company_name', v_req.company_name,
    'reference', v_req.quote_reference,
    'amount_cents', v_req.quote_amount_cents,
    -- Pour l'accusé de réception. La lecture publique, elle, ne rend jamais
    -- l'adresse : ici c'est la fonction edge qui reçoit, pas le navigateur.
    'contact_email', v_req.contact_email,
    'contact_first_name', v_req.contact_first_name);
end;
$$;

-- ── Droits ────────────────────────────────────────────────────────────────
-- La garde est dans chaque fonction, jamais dans le GRANT. `quote_by_token` et
-- `accept_quote_by_token` sont ouvertes à `anon` : le prospect n'a pas encore
-- de compte, le jeton tient lieu de clé.
revoke all on function public.admin_quote_company_request(uuid, text, bigint, text, jsonb) from public, anon;
grant execute on function public.admin_quote_company_request(uuid, text, bigint, text, jsonb) to authenticated, service_role;
revoke all on function public.quote_by_token(uuid) from public;
grant execute on function public.quote_by_token(uuid) to anon, authenticated, service_role;
revoke all on function public.accept_quote_by_token(uuid) from public;
grant execute on function public.accept_quote_by_token(uuid) to anon, authenticated, service_role;
