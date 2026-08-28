-- ─────────────────────────────────────────────────────────────────────────
-- `submit_company_request` retrouve sa limitation de débit (28 août 2026).
--
-- CE QUI S'ÉTAIT PASSÉ. La migration 20260818000002 (constat M3) avait posé
-- deux verrous sur ce formulaire, qui est **appelable sans compte** : cinq
-- envois par heure et par adresse e-mail, vingt par point de connexion. Deux
-- migrations plus tard — 20260821210001 (SIREN et magasins déclarés) puis
-- 20260821230001 (code APE) — la fonction a été **réécrite en entier**, et le
-- bloc de limitation n'a pas été recopié. Personne ne s'en est aperçu : un
-- `create or replace` ne signale pas ce qu'il fait disparaître.
--
-- Relevé le 28 août 2026 en interrogeant `pg_get_functiondef` sur la
-- définition en vigueur : plus une trace de `rate_limit_ok`.
--
-- CE QUE LE VERROU PROTÈGE, et pourquoi il est placé ici. Deux choses :
--
--   1. l'inondation — un script remplit la file de l'administrateur et
--      déclenche autant d'accusés de réception envoyés par `submit-company-request` ;
--
--   2. l'énumération d'adresses — la fonction répond « Une demande est déjà en
--      cours pour cette adresse » quand elle connaît l'adresse, et autre chose
--      sinon. Le contrôle est donc placé **avant** cette recherche : sans quoi
--      on pourrait interroger la base autant de fois qu'on veut et n'être
--      freiné qu'après avoir obtenu la réponse.
--
-- ⚠️ La réponse reste différenciée, contrairement à la version du 18 août qui
-- répondait `{success: true, received: true}` dans les deux cas. C'est une
-- décision de produit — un client qui a déjà déposé une demande mérite qu'on
-- le lui dise — et elle n'est pas défaite ici. La limitation la rend tenable :
-- cinq essais par heure ne font pas un annuaire.
--
-- Rien d'autre ne change dans le corps de la fonction : ni la validation, ni
-- le SIREN, ni les magasins déclarés, ni le texte des messages.
-- ─────────────────────────────────────────────────────────────────────────

create or replace function public.submit_company_request(
  p_company_name text, p_first_name text, p_last_name text,
  p_email text, p_phone text, p_store_count int, p_message text default '',
  p_siren text default null, p_stores jsonb default '[]'::jsonb,
  p_ape text default null)
returns json language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_id uuid;
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_siren text := nullif(regexp_replace(coalesce(p_siren, ''), '\D', '', 'g'), '');
  v_ape text := nullif(left(btrim(coalesce(p_ape, '')), 8), '');
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

  if v_siren is not null and not public.siren_valide(v_siren) then
    return json_build_object('success', false,
      'error', 'Ces neuf chiffres ne forment pas un SIREN valide.');
  end if;

  -- Un code d'activité sans numéro d'entreprise ne veut rien dire.
  if v_siren is null then
    v_ape := null;
  end if;

  if jsonb_typeof(v_stores) <> 'array' then
    v_stores := '[]'::jsonb;
  end if;

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
      'name', left(v_nom, 120), 'units', v_units, 'sqm', v_sqm);
  end loop;

  v_count := greatest(jsonb_array_length(v_propre), coalesce(p_store_count, 0));
  if v_count < 1 or v_count > 500 then
    return json_build_object('success', false,
      'error', 'Le nombre de magasins doit être compris entre 1 et 500.');
  end if;

  -- ── Le verrou (M3), rétabli ──────────────────────────────────────────────
  -- Après la validation de saisie — une faute de frappe ne doit pas consommer
  -- le quota de quelqu'un — et **avant** la recherche par adresse, qui est ce
  -- qu'un script viendrait interroger.
  --
  -- `client_ip()` rend null hors requête HTTP (psql, migration) : la seconde
  -- limite est alors inopérante, la première continue de s'appliquer.
  if not public.rate_limit_ok('company_request', v_email, 5, interval '1 hour')
     or not public.rate_limit_ok('company_request_ip', public.client_ip(), 20, interval '1 hour') then
    return json_build_object('success', false,
      'error', 'Trop de tentatives depuis cette adresse. Réessayez dans une heure.');
  end if;

  if exists (select 1 from public.company_requests
             where lower(contact_email) = v_email
               and status in ('pending','quoted','accepted','paid')) then
    return json_build_object('success', false,
      'error', 'Une demande est déjà en cours pour cette adresse. Notre équipe vous recontacte.');
  end if;

  insert into public.company_requests
    (company_name, contact_first_name, contact_last_name, contact_email, contact_phone,
     store_count, message, siren, stores, ape)
  values
    (btrim(p_company_name), btrim(p_first_name), btrim(p_last_name), v_email,
     coalesce(btrim(p_phone), ''), v_count, coalesce(btrim(p_message), ''),
     v_siren, v_propre, v_ape)
  returning id into v_id;

  return json_build_object('success', true, 'request_id', v_id::text);
end; $function$;

-- ⚠️ `create or replace` rend EXECUTE à PUBLIC. Sans ces deux lignes dans la
-- même migration, la fonction ressortirait exécutable par tout le monde —
-- c'est la leçon de 20260819172706, à ne pas réapprendre.
revoke all on function public.submit_company_request(text, text, text, text, text, int, text, text, jsonb, text) from public;
grant execute on function public.submit_company_request(text, text, text, text, text, int, text, text, jsonb, text) to anon, authenticated;
