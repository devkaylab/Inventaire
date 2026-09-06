-- Le socle des premiers jours, enfin écrit (6 septembre 2026)
--
-- Neuf objets vivaient en base sans aucune migration : les trois tables
-- `stores`, `zones` et `account_deletion_requests`, et six fonctions
-- (`norm_balise`, `ensure_zone`, `generate_zones`, `register_balise`,
-- `set_zone_status`, `request_account_deletion`). Ils datent des tout premiers
-- jours, créés à la main par la console, avant que la discipline ne soit tenue.
-- Tout le reste — 181 fonctions et 28 tables — est déjà décrit par le dossier,
-- corps identiques au MD5 près (mesure du 4 septembre 2026).
--
-- ⚠️ CE FICHIER DÉCLARE L'EXISTANT, IL NE REJOUE RIEN. Appliqué sur la base
-- réelle il ne doit changer AUCUNE ligne de catalogue : chaque table est sous
-- une garde d'absence, et les fonctions sont recopiées de `pg_get_functiondef`
-- à l'octet près. C'est vérifié avant et après application, pas supposé.
--
-- ⚠️ ET LE DOSSIER N'EST PAS REJOUABLE DE ZÉRO — ce n'est ni prétendu ici, ni
-- corrigé par ce fichier. Mesuré : `20260806000001_store_supervisors.sql` crée
-- une policy `using (public.is_admin())` alors qu'`is_admin()` n'est défini
-- qu'au 19 août (`20260819123621_mfa_admin_aal2.sql`) — une policy valide son
-- expression à la création, donc un rejeu s'arrête là, indépendamment de ce
-- rattrapage. La règle du projet ne change pas : on applique par la console ou
-- par `supabase db query --file`, JAMAIS par `db push`. Ce que ce fichier
-- apporte est ailleurs, et c'est concret : plus aucun objet de la base n'est
-- invisible au dépôt, donc `derniereDefinition()` répond enfin pour ces six
-- fonctions — une garde posée sur elles ne cherchait rien jusqu'ici.
--
-- Les tables sont déclarées dans leur forme d'AUJOURD'HUI, colonnes tardives
-- comprises : c'est ce que la base porte, et c'est ce qu'il faut pour la
-- rebâtir sans archéologie. Les morceaux qu'une autre migration possède déjà
-- (le code magasin, les colonnes de prix, le déclencheur des administrateurs,
-- les statuts de balise) sont nommés au passage — ils ne sont ici que pour que
-- la table soit complète.

-- ---------------------------------------------------------------- zones
do $rattrapage$
begin
  if to_regclass('public.zones') is null then
    create table public.zones (
      id uuid primary key default gen_random_uuid(),
      session_id uuid not null references public.inventory_sessions(id) on delete cascade,
      code text not null,
      status text not null default 'open',
      created_at timestamptz not null default now(),
      -- Les cinq suivantes viennent de `20260730000002_zones_balises_count_audit.sql`.
      name text,
      count_status text not null default 'pending',
      audit_status text not null default 'pending',
      count_done_at timestamptz,
      audit_done_at timestamptz,
      constraint zones_status_check check (status = any (array['open'::text, 'done'::text])),
      constraint zones_count_status_check check (count_status = any (array['pending'::text, 'open'::text, 'done'::text])),
      constraint zones_audit_status_check check (audit_status = any (array['pending'::text, 'open'::text, 'done'::text])),
      -- ⚠️ Cette unicité n'était écrite NULLE PART, et `ensure_zone` en dépend :
      -- son `on conflict (session_id, code)` est ce qui rend l'ouverture d'une
      -- balise idempotente. Deux migrations la citent en commentaire, aucune ne
      -- la crée.
      constraint zones_session_id_code_key unique (session_id, code)
    );

    create index zones_session_idx on public.zones (session_id);

    alter table public.zones enable row level security;

    -- Un compteur lit les balises des inventaires où il est membre.
    create policy zones_member_select on public.zones for select using (
      exists (select 1 from public.session_members sm
              where sm.session_id = zones.session_id and sm.user_id = auth.uid())
    );
    -- Celle-ci est posée par `20260619000005`, puis resserrée par
    -- `20260806000003` et `20260807000005` ; elle est ici pour la complétude.
    create policy zones_supervisor_company on public.zones for all
      using (get_my_role() = 'supervisor' and is_session_participant(session_id))
      with check (get_my_role() = 'supervisor' and is_session_participant(session_id));

    grant all on table public.zones to anon, authenticated, service_role;
  end if;
end;
$rattrapage$;

-- ---------------------------------------------------------------- stores
do $rattrapage$
begin
  if to_regclass('public.stores') is null then
    create table public.stores (
      id uuid primary key default gen_random_uuid(),
      company_id uuid not null references public.companies(id) on delete cascade,
      name text not null,
      created_at timestamptz not null default now(),
      -- `20260807000002_store_join_codes.sql`
      join_code text not null constraint stores_join_code_key unique,
      -- `20260821190001_tarif_par_magasin_et_revenu.sql`
      annual_price_cents integer,
      -- `20260822140001_volumes_demande_magasin.sql`
      units integer,
      sqm integer,
      -- `20260902120001_assiette_appareils.sql`
      devices integer,
      -- `20260904240001` et `20260904270001` — le libre-service
      stripe_item_offre text,
      stripe_item_appareils text,
      stripe_subscription_id text,
      constraint stores_annual_price_positive check (annual_price_cents is null or annual_price_cents >= 0),
      constraint stores_devices_check check (devices is null or (devices >= 1 and devices <= 1000))
    );

    create index stores_company_id_idx on public.stores (company_id);

    alter table public.stores enable row level security;

    -- On lit les magasins de son entreprise, l'administrateur Quantinvo les lit tous.
    create policy stores_select on public.stores for select
      using (company_id = get_my_company() or is_admin());
    -- ⚠️ Seul Quantinvo écrit : la licence se facture par magasin. C'est cette
    -- policy, et l'absence de toute autre en écriture, qui rend le code
    -- d'accès non modifiable — voir VR-009 (28 août 2026).
    create policy stores_admin_write on public.stores for all
      using (is_admin()) with check (is_admin());

    -- `20260822150001` : un magasin créé affecte tous les administrateurs de l'entreprise.
    create trigger stores_sync_company_admins after insert on public.stores
      for each row execute function sync_company_admin_stores();

    -- ⚠️ L'état final des droits, tel qu'il est en base : le code magasin et
    -- les colonnes de facturation sont ILLISIBLES à un client, et rien n'est
    -- écrivable. Posé par `20260807000002` (les colonnes lisibles) puis
    -- `20260828270001` (le retrait d'insert/update/references, VR-009).
    grant all on table public.stores to anon, authenticated, service_role;
    revoke select, insert, update, references on public.stores from anon, authenticated;
    grant select (id, company_id, name, created_at) on public.stores to anon, authenticated;
  end if;
end;
$rattrapage$;

-- ------------------------------------------ account_deletion_requests
do $rattrapage$
begin
  if to_regclass('public.account_deletion_requests') is null then
    create table public.account_deletion_requests (
      id uuid primary key default gen_random_uuid(),
      user_id uuid not null references auth.users(id) on delete cascade,
      -- L'identité est FIGÉE à la demande : après la suppression, ni le profil
      -- ni l'adresse n'existent, et la ligne n'aurait qu'un identifiant à
      -- montrer. Même règle que les journaux.
      email text,
      full_name text,
      company_id uuid,
      role text,
      status text not null default 'pending',
      created_at timestamptz not null default now()
    );

    alter table public.account_deletion_requests enable row level security;

    -- Aucune policy d'écriture : le dépôt passe par `request_account_deletion`,
    -- le traitement par les fonctions d'administration.
    create policy adr_select on public.account_deletion_requests for select
      using (user_id = auth.uid() or is_admin());

    grant all on table public.account_deletion_requests to anon, authenticated, service_role;
  end if;
end;
$rattrapage$;

-- ---------------------------------------------------------------- fonctions
--
-- Recopiées de `pg_get_functiondef` à l'octet près, en-tête mis en minuscules
-- comme tout le dépôt. Elles ne changent rien à la base ; elles la rendent
-- lisible depuis le dossier.
--
-- ⚠️ ET LEURS DROITS SONT REPOSÉS JUSTE APRÈS. `create or replace` rend EXECUTE
-- à PUBLIC : c'est la leçon de `20260819172706`, et le constat n°6 du 28 août
-- 2026 (`admin_list_audit_log` et une fonction de déclencheur ouvertes à `anon`
-- sans raison). Aucune des six n'est publique : `anon` n'en exécute aucune.

-- Le code d'une balise, normalisé : sans espaces, en capitales. Une seule
-- définition, parce que le scan et la base doivent tomber sur la même clé.
create or replace function public.norm_balise(p text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  select upper(regexp_replace(coalesce(p, ''), '\s', '', 'g'))
$function$;
revoke all on function public.norm_balise(text) from public, anon;
grant execute on function public.norm_balise(text) to authenticated, service_role;

-- Ouvre une balise, ou la retrouve. L'`on conflict` s'appuie sur
-- `zones_session_id_code_key`, déclarée plus haut.
create or replace function public.ensure_zone(p_session_id uuid, p_code text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_id uuid; v_status text; v_code text;
BEGIN
  IF NOT (
    get_my_role() = 'supervisor'
    OR EXISTS (SELECT 1 FROM public.session_members sm WHERE sm.session_id = p_session_id AND sm.user_id = auth.uid())
  ) THEN
    RETURN json_build_object('success', false, 'error', 'Accès refusé');
  END IF;
  v_code := lpad(regexp_replace(COALESCE(p_code, ''), '\D', '', 'g'), 4, '0');
  IF v_code = '' THEN
    RETURN json_build_object('success', false, 'error', 'Balise invalide');
  END IF;
  INSERT INTO public.zones (session_id, code)
  VALUES (p_session_id, v_code)
  ON CONFLICT (session_id, code) DO UPDATE SET code = EXCLUDED.code
  RETURNING id, code, status INTO v_id, v_code, v_status;
  RETURN json_build_object('success', true, 'id', v_id::text, 'code', v_code, 'status', v_status);
END;
$function$;
revoke all on function public.ensure_zone(uuid, text) from public, anon;
grant execute on function public.ensure_zone(uuid, text) to authenticated, service_role;

-- La planche de balises d'un inventaire, numérotée à la suite de l'existante.
create or replace function public.generate_zones(p_session_id uuid, p_count integer)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_start int; v_codes text[];
BEGIN
  IF get_my_role() <> 'supervisor' THEN
    RETURN json_build_object('success', false, 'error', 'Accès refusé');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.inventory_sessions WHERE id = p_session_id AND created_by = auth.uid()) THEN
    RETURN json_build_object('success', false, 'error', 'Session introuvable');
  END IF;
  IF p_count IS NULL OR p_count < 1 OR p_count > 2000 THEN
    RETURN json_build_object('success', false, 'error', 'Nombre de balises invalide (1 à 2000)');
  END IF;
  SELECT COALESCE(MAX(code::int), 0) + 1 INTO v_start FROM public.zones WHERE session_id = p_session_id;
  WITH ins AS (
    INSERT INTO public.zones (session_id, code)
    SELECT p_session_id, lpad(g::text, 4, '0')
    FROM generate_series(v_start, v_start + p_count - 1) AS g
    RETURNING code
  )
  SELECT array_agg(code ORDER BY code) INTO v_codes FROM ins;
  RETURN json_build_object('success', true, 'created', p_count, 'codes', to_json(v_codes));
END;
$function$;
revoke all on function public.generate_zones(uuid, integer) from public, anon;
grant execute on function public.generate_zones(uuid, integer) to authenticated, service_role;

-- Nomme une balise, ou la crée. La recherche passe par `norm_balise` : une
-- balise saisie « 10 00 » retrouve la balise « 1000 ».
create or replace function public.register_balise(p_session_id uuid, p_code text, p_name text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_code text; v_name text; v_created boolean;
begin
  if get_my_role() <> 'supervisor' then
    return json_build_object('success', false, 'error', 'Accès refusé');
  end if;
  if not exists (select 1 from public.inventory_sessions
                 where id = p_session_id and created_by = auth.uid()) then
    return json_build_object('success', false, 'error', 'Session introuvable');
  end if;
  v_code := btrim(coalesce(p_code, ''));
  if v_code = '' then
    return json_build_object('success', false, 'error', 'Balise invalide');
  end if;
  v_name := nullif(btrim(coalesce(p_name, '')), '');

  -- Si une balise avec le même code normalisé existe déjà, on la renomme.
  update public.zones
    set name = coalesce(v_name, name)
    where session_id = p_session_id and public.norm_balise(code) = public.norm_balise(v_code)
    returning code into v_code;
  if found then
    return json_build_object('success', true, 'code', v_code, 'name', v_name, 'created', false);
  end if;

  insert into public.zones (session_id, code, name) values (p_session_id, v_code, v_name);
  return json_build_object('success', true, 'code', v_code, 'name', v_name, 'created', true);
end; $function$;
revoke all on function public.register_balise(uuid, text, text) from public, anon;
grant execute on function public.register_balise(uuid, text, text) to authenticated, service_role;

-- Ouvrir ou clôturer une balise, pour un membre de l'inventaire.
create or replace function public.set_zone_status(p_zone_id uuid, p_status text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_session uuid;
BEGIN
  IF p_status NOT IN ('open','done') THEN
    RETURN json_build_object('success', false, 'error', 'Statut invalide');
  END IF;
  SELECT session_id INTO v_session FROM public.zones WHERE id = p_zone_id;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Balise introuvable');
  END IF;
  IF NOT (
    get_my_role() = 'supervisor'
    OR EXISTS (SELECT 1 FROM public.session_members sm WHERE sm.session_id = v_session AND sm.user_id = auth.uid())
  ) THEN
    RETURN json_build_object('success', false, 'error', 'Accès refusé');
  END IF;
  UPDATE public.zones SET status = p_status WHERE id = p_zone_id;
  RETURN json_build_object('success', true);
END;
$function$;
revoke all on function public.set_zone_status(uuid, text) from public, anon;
grant execute on function public.set_zone_status(uuid, text) to authenticated, service_role;

-- La personne demande la suppression de son compte. Le traitement reste chez
-- Quantinvo ; la ligne fige l'identité, elle ne supprime rien.
create or replace function public.request_account_deletion()
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
declare v_uid uuid := auth.uid(); v_email text; v_name text; v_company uuid; v_role text;
begin
  if v_uid is null then return json_build_object('success', false, 'error', 'Non authentifié.'); end if;
  if exists (select 1 from public.account_deletion_requests where user_id = v_uid and status = 'pending') then
    return json_build_object('success', true, 'already', true);
  end if;
  select p.full_name, p.company_id, p.role into v_name, v_company, v_role from public.profiles p where p.id = v_uid;
  select u.email into v_email from auth.users u where u.id = v_uid;
  insert into public.account_deletion_requests (user_id, email, full_name, company_id, role)
  values (v_uid, v_email, v_name, v_company, v_role);
  return json_build_object('success', true);
end; $function$;
revoke all on function public.request_account_deletion() from public, anon;
grant execute on function public.request_account_deletion() to authenticated, service_role;
