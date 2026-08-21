-- ─────────────────────────────────────────────────────────────────────────
-- Demande d'inscription : le SIREN et les magasins déclarés.
--
-- Le formulaire ne demandait qu'un nombre de magasins. Or la licence est
-- tarifée à la tranche de volume de stock **de chaque magasin** : trois
-- magasins de 60 000 unités ne se tarifent pas comme un de 180 000. Il faut
-- donc le détail, magasin par magasin.
--
-- Deux ajouts sur `company_requests` :
--
--   `siren`   — neuf chiffres. Demandé plutôt qu'un extrait Kbis : le Kbis
--               porte les date et lieu de naissance, la nationalité et
--               l'adresse du dirigeant, soit beaucoup de données d'identité
--               pour vérifier qu'une société existe, et il est de toute façon
--               téléchargeable par n'importe qui à partir du seul SIREN. Le
--               SIREN est par ailleurs une mention obligatoire de la facture
--               électronique, où il sert d'identifiant de routage.
--
--   `stores`  — le tableau des magasins déclarés : nom, stock théorique en
--               **unités** (pièces physiques, jamais références), surface de
--               vente en m². La surface ne tarife rien : elle sert à recouper
--               une déclaration que le Service ne sait pas vérifier lui-même
--               (article 6.4 des CGV — l'import du stock théorique est
--               facultatif et rattaché à un inventaire, pas à un magasin).
--
-- `store_count` est **conservée** et tenue à jour depuis `stores` : les
-- demandes déjà en base la portent, et `admin_fulfil_company_request` s'en
-- sert pour sa boucle de création. Code déployé d'abord, colonnes retirées
-- ensuite — jamais l'inverse (leçon `get_session_activity`).
--
-- `submit_company_request` est remplacée plutôt qu'ajoutée en surcharge : deux
-- variantes dont l'une accepte un sur-ensemble de l'autre rendraient l'appel
-- ambigu côté PostgREST. Les nouveaux paramètres ont une valeur par défaut, si
-- bien que le site actuellement déployé — qui n'envoie que les anciens —
-- continue de fonctionner jusqu'à la mise en ligne du nouveau formulaire.
-- ─────────────────────────────────────────────────────────────────────────

alter table public.company_requests
  add column if not exists siren text,
  add column if not exists stores jsonb not null default '[]'::jsonb;

comment on column public.company_requests.siren is
  'SIREN à neuf chiffres, contrôlé par la clé de Luhn au dépôt. Remplace la demande d''extrait Kbis.';
comment on column public.company_requests.stores is
  'Magasins déclarés : [{"name":…, "units":…, "sqm":…}]. Le stock est en unités (pièces), jamais en références.';

-- ── Contrôle du SIREN en base ─────────────────────────────────────────────
-- Le formulaire contrôle déjà la clé de Luhn, mais la RPC est ouverte à `anon` :
-- ce qui n'est vérifié que côté navigateur n'est pas vérifié.
create or replace function public.siren_valide(p_siren text)
returns boolean
language plpgsql
immutable
set search_path to 'public'
as $function$
declare
  v text := regexp_replace(coalesce(p_siren, ''), '\D', '', 'g');
  v_somme int := 0;
  v_chiffre int;
  v_i int;
begin
  if length(v) <> 9 then return false; end if;
  -- Neuf fois le même chiffre passe la clé de Luhn quand ce chiffre est zéro,
  -- et n'est jamais un vrai SIREN : écarté explicitement.
  if v ~ '^(\d)\1{8}$' then return false; end if;
  for v_i in 0..8 loop
    v_chiffre := substr(v, 9 - v_i, 1)::int;
    if v_i % 2 = 1 then
      v_chiffre := v_chiffre * 2;
      if v_chiffre > 9 then v_chiffre := v_chiffre - 9; end if;
    end if;
    v_somme := v_somme + v_chiffre;
  end loop;
  return v_somme % 10 = 0;
end; $function$;

revoke all on function public.siren_valide(text) from public, anon;
grant execute on function public.siren_valide(text) to authenticated, service_role;

-- ── Dépôt public, version magasin par magasin ─────────────────────────────
drop function if exists public.submit_company_request(text, text, text, text, text, int, text);

create or replace function public.submit_company_request(
  p_company_name text, p_first_name text, p_last_name text,
  p_email text, p_phone text, p_store_count int, p_message text default '',
  p_siren text default null, p_stores jsonb default '[]'::jsonb)
returns json language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_id uuid;
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_siren text := nullif(regexp_replace(coalesce(p_siren, ''), '\D', '', 'g'), '');
  v_stores jsonb := coalesce(p_stores, '[]'::jsonb);
  v_propre jsonb := '[]'::jsonb;
  v_ligne jsonb;
  v_nom text;
  v_units numeric;
  v_sqm numeric;
  v_count int;
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

  -- Le SIREN reste facultatif : un formulaire public ne doit pas bloquer une
  -- demande sur un numéro que la personne n'a pas sous la main. Mais s'il est
  -- saisi, il doit être juste.
  if v_siren is not null and not public.siren_valide(v_siren) then
    return json_build_object('success', false,
      'error', 'Ces neuf chiffres ne forment pas un SIREN valide.');
  end if;

  if jsonb_typeof(v_stores) <> 'array' then
    v_stores := '[]'::jsonb;
  end if;

  -- Chaque magasin est renormalisé ici plutôt que pris tel quel : la RPC est
  -- ouverte à `anon`, donc rien de ce qui arrive n'est digne de confiance.
  for v_ligne in select * from jsonb_array_elements(v_stores) loop
    v_nom := btrim(coalesce(v_ligne ->> 'name', ''));
    begin
      v_units := nullif(v_ligne ->> 'units', '')::numeric;
      v_sqm := nullif(v_ligne ->> 'sqm', '')::numeric;
    exception when others then
      return json_build_object('success', false,
        'error', 'Le stock et la surface doivent être des nombres.');
    end;
    if v_units is not null and (v_units < 0 or v_units > 100000000) then
      return json_build_object('success', false, 'error', 'Volume de stock hors limites.');
    end if;
    if v_sqm is not null and (v_sqm < 0 or v_sqm > 1000000) then
      return json_build_object('success', false, 'error', 'Surface hors limites.');
    end if;
    v_propre := v_propre || jsonb_build_object(
      'name', left(v_nom, 120),
      'units', v_units,
      'sqm', v_sqm);
  end loop;

  -- Le nombre de magasins se déduit des lignes déclarées ; `p_store_count` ne
  -- sert que de repli pour le formulaire encore déployé, qui n'envoie pas la
  -- liste.
  v_count := greatest(jsonb_array_length(v_propre), coalesce(p_store_count, 0));
  if v_count < 1 or v_count > 500 then
    return json_build_object('success', false,
      'error', 'Le nombre de magasins doit être compris entre 1 et 500.');
  end if;

  if exists (select 1 from public.company_requests
             where lower(contact_email) = v_email
               and status in ('pending','quoted','accepted','paid')) then
    return json_build_object('success', false,
      'error', 'Une demande est déjà en cours pour cette adresse. Notre équipe vous recontacte.');
  end if;

  insert into public.company_requests
    (company_name, contact_first_name, contact_last_name, contact_email, contact_phone,
     store_count, message, siren, stores)
  values
    (btrim(p_company_name), btrim(p_first_name), btrim(p_last_name), v_email,
     coalesce(btrim(p_phone), ''), v_count, coalesce(btrim(p_message), ''),
     v_siren, v_propre)
  returning id into v_id;

  return json_build_object('success', true, 'request_id', v_id::text);
end; $function$;

revoke all on function public.submit_company_request(text, text, text, text, text, int, text, text, jsonb) from public;
grant execute on function public.submit_company_request(text, text, text, text, text, int, text, text, jsonb) to anon, authenticated;

-- ── Console admin : la liste rend le SIREN et les magasins ────────────────
drop function if exists public.admin_list_company_requests();

create or replace function public.admin_list_company_requests()
returns table(id uuid, company_name text, contact_first_name text, contact_last_name text,
              contact_email text, contact_phone text, store_count int, message text,
              status text, quote_reference text, quote_amount_cents bigint,
              admin_note text, company_id uuid, created_at timestamptz,
              siren text, stores jsonb)
language plpgsql stable security definer set search_path to 'public'
as $function$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return query
    select r.id, r.company_name, r.contact_first_name, r.contact_last_name, r.contact_email,
           r.contact_phone, r.store_count, r.message, r.status, r.quote_reference,
           r.quote_amount_cents, r.admin_note, r.company_id, r.created_at,
           r.siren, r.stores
    from public.company_requests r
    order by case r.status when 'pending' then 0 when 'accepted' then 1 when 'quoted' then 2
                           when 'paid' then 3 when 'created' then 4 else 5 end,
             r.created_at desc;
end; $function$;

revoke all on function public.admin_list_company_requests() from public, anon;
grant execute on function public.admin_list_company_requests() to authenticated;

-- ── Création de l'entreprise : reprend les noms et les tarifs déclarés ────
-- Les noms de magasin passés en paramètre gardent la priorité (l'administrateur
-- peut les corriger dans la console) ; à défaut, ceux de la demande servent,
-- et « Magasin N » ne reste qu'en dernier recours.
--
-- Le tarif de chaque magasin est posé depuis la tranche de son volume déclaré,
-- ce qui évite de le ressaisir à la main dans la foulée. Un magasin sans volume
-- déclaré, ou au-delà d'un million d'unités (prix au cas par cas), reste sans
-- tarif : le tableau de bord l'estimera au panier moyen et le signalera, ce qui
-- vaut mieux qu'un chiffre inventé.
create or replace function public.admin_fulfil_company_request(p_id uuid, p_store_names text[] default null::text[])
returns json
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_req public.company_requests%rowtype;
  v_company_id uuid; v_company_code text; v_store_code text;
  v_name text; v_i int; v_stores json[] := '{}';
  v_declare jsonb; v_units numeric; v_price int;
begin
  if not public.is_admin() then return json_build_object('success', false, 'error', 'Accès refusé'); end if;
  select * into v_req from public.company_requests where id = p_id;
  if not found then return json_build_object('success', false, 'error', 'Demande introuvable'); end if;
  if v_req.status <> 'paid' then
    return json_build_object('success', false,
      'error', 'L''entreprise ne peut être créée qu''après encaissement de la facture.');
  end if;
  v_company_code := public.gen_company_code();
  insert into public.companies (name, join_code) values (v_req.company_name, v_company_code)
    returning id into v_company_id;

  for v_i in 1..v_req.store_count loop
    v_declare := v_req.stores -> (v_i - 1);
    v_name := coalesce(
      nullif(btrim(p_store_names[v_i]), ''),
      nullif(btrim(coalesce(v_declare ->> 'name', '')), ''),
      'Magasin ' || v_i);

    v_units := nullif(v_declare ->> 'units', '')::numeric;
    v_price := case
      when v_units is null or v_units <= 0 then null
      when v_units <= 10000 then 210000
      when v_units <= 50000 then 420000
      when v_units <= 200000 then 660000
      when v_units <= 500000 then 1020000
      when v_units <= 1000000 then 1440000
      else null  -- au-delà d'un million : prix au cas par cas
    end;

    v_store_code := public.gen_store_code();
    insert into public.stores (company_id, name, join_code, annual_price_cents)
      values (v_company_id, v_name, v_store_code, v_price);
    v_stores := v_stores || json_build_object(
      'name', v_name, 'join_code', v_store_code, 'annual_price_cents', v_price);
  end loop;

  update public.company_requests
     set status = 'created', company_id = v_company_id, updated_at = now() where id = p_id;
  perform public.log_admin_action('entreprise_creee_depuis_demande', 'entreprise', v_company_id::text,
    coalesce(v_req.company_name, ''),
    json_build_object('demande_id', p_id::text, 'magasins', v_req.store_count)::jsonb);
  return json_build_object('success', true, 'company_id', v_company_id::text,
    'company_code', v_company_code, 'stores', array_to_json(v_stores));
end; $function$;

revoke all on function public.admin_fulfil_company_request(uuid, text[]) from public, anon;
grant execute on function public.admin_fulfil_company_request(uuid, text[]) to authenticated;
