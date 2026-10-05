-- ⚠️ UN SEUL INVENTAIRE, ET IL NAÎT AVEC LA RÉSERVATION (4 octobre 2026).
--
-- Julien a tranché entre deux sorties, et c'est la B : « la mission crée
-- l'inventaire dès la réservation, et c'est celui-là que le client prépare ».
--
-- Le défaut : louer fait du client un utilisateur ORDINAIRE de Quantinvo OS —
-- il atterrit sur son tableau de bord, avec « Nouvel inventaire » et « Mon
-- équipe ». Il préparait donc naturellement son inventaire à lui : import du
-- stock, balises imprimées, équipe invitée. Puis, le jour venu, l'ouverture de
-- la mission lui en créait un SECOND, vide. Deux à l'écran, rien pour dire
-- lequel compte, et tout son travail dans l'autre.
--
-- Deux changements, et un seul inventaire :
--
--   1. `creer_la_session_de_mission` accepte d'être appelée dès
--      `prix_calcule` — elle exigeait `confirmee`, ce qui n'avait de sens que
--      pour une équipe qui se constitue après la confirmation ;
--   2. `reserver_ma_mission` l'appelle dans la foulée de l'insert.
--
-- ⚠️ `admin_avancer_mission` n'a pas besoin d'être reprise : elle n'appelle la
-- création que si `inventory_session_id is null`, et la fonction elle-même
-- rend `{deja: true}` quand la session existe. Rien ne se crée deux fois.
--
-- ⚠️ Les deux définitions sont celles qui tournaient, à une ligne près chacune.
-- Reprises de `pg_get_functiondef`, pas recopiées.
CREATE OR REPLACE FUNCTION public.creer_la_session_de_mission(p_mission uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_m record;
  v_code text;
  v_number text;
  v_id uuid;
begin
  -- ⚠️ LA GARDE EST LE `GRANT`, PAS UN TEST ICI, et c'est voulu : la seule
  -- forme qui laisserait passer `service_role` serait « is_admin() OU
  -- auth.uid() est nul » — une condition qui ouvre à `anon` le jour où
  -- quelqu'un élargit le grant sans relire la fonction. Même choix que
  -- `plafond_appareils` : `service_role` uniquement, et la console
  -- d'administration passera par un `admin_*` qui journalise (règle AGENTS.md).
  select * into v_m from public.missions where id = p_mission;
  if not found then
    return jsonb_build_object('success', false, 'code', 'introuvable');
  end if;

  -- Déjà créé : on rend le même, on n'en ouvre pas un second. Une mission
  -- relancée deux fois par le back-office ne doit pas couper l'inventaire en
  -- deux moitiés dont aucune ne fait un rapport.
  if v_m.inventory_session_id is not null then
    return jsonb_build_object('success', true, 'session_id', v_m.inventory_session_id, 'deja', true);
  end if;

  if v_m.company_id is null or v_m.store_id is null then
    return jsonb_build_object('success', false, 'code', 'client_efface');
  end if;
  if v_m.etat not in ('prix_calcule','paiement_autorise','confirmee','en_constitution','equipe_complete','prete') then
    return jsonb_build_object('success', false, 'code', 'pas_le_moment');
  end if;

  v_code   := lpad((floor(random() * 1000000))::integer::text, 6, '0');
  v_number := 'INV-' || to_char(now(), 'YYYYMMDD') || '-'
              || upper(substring(md5(random()::text) from 1 for 4));

  insert into public.inventory_sessions
    (inventory_number, security_code_hash, security_code, store_name, store_id,
     name, created_by, uses_zones, company_id)
  values
    (v_number, encode(sha256(v_code::bytea), 'hex'), v_code, v_m.magasin_nom, v_m.store_id,
     v_m.magasin_nom || ' — ' || to_char(v_m.debut_prevu at time zone 'Europe/Paris', 'DD/MM/YYYY'),
     v_m.reserve_par,
     -- Une équipe de trois et plus travaille par zones : c'est ce qui permet
     -- au responsable d'attribuer, et au client de suivre l'avancement.
     (v_m.inventoristes >= 3),
     v_m.company_id)
  returning id into v_id;

  -- Le client qui a réservé est membre de son inventaire, comme tout créateur.
  if v_m.reserve_par is not null then
    insert into public.session_members (session_id, user_id)
      values (v_id, v_m.reserve_par)
      on conflict do nothing;
  end if;

  update public.missions set inventory_session_id = v_id where id = p_mission;

  return jsonb_build_object('success', true, 'session_id', v_id, 'inventory_number', v_number);
end;
$function$;

CREATE OR REPLACE FUNCTION public.reserver_ma_mission(p_reponses jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_company uuid;
  v_store uuid;
  v_nom_entreprise text := btrim(coalesce(p_reponses ->> 'entreprise', ''));
  v_siren text := nullif(regexp_replace(coalesce(p_reponses ->> 'siren', ''), '\D', '', 'g'), '');
  v_magasin text := btrim(coalesce(p_reponses ->> 'magasin', ''));
  v_adresse text := btrim(coalesce(p_reponses ->> 'adresse', ''));
  v_cp text := nullif(regexp_replace(coalesce(p_reponses ->> 'code_postal', ''), '\D', '', 'g'), '');
  v_ville text := btrim(coalesce(p_reponses ->> 'ville', ''));
  v_complete text;
  v_debut timestamptz;
  v_prix jsonb;
  v_id uuid;
  v_ref text;
  v_neuve boolean := false;
begin
  if v_uid is null then
    return jsonb_build_object('success', false, 'code', 'non_connecte');
  end if;

  -- ⚠️ Sans acceptation des conditions EN VIGUEUR, on ne réserve pas — même
  -- règle que `finaliser_inscription` depuis le 16 septembre. Une page restée
  -- ouverte sur une ancienne version est refusée plutôt que de consigner
  -- l'accord sur un texte périmé.
  if (p_reponses ->> 'cgv_version') is distinct from public.version_conditions() then
    return jsonb_build_object('success', false, 'code', 'conditions');
  end if;
  -- ⚠️ Et sans l'engagement de l'étape 3 non plus : c'est lui qui autorise le
  -- recalcul sur place, donc lui qui rend le prix ferme tenable.
  if coalesce((p_reponses ->> 'engagement')::boolean, false) is not true then
    return jsonb_build_object('success', false, 'code', 'engagement');
  end if;

  begin
    v_debut := (p_reponses ->> 'debut')::timestamptz;
  exception when others then
    return jsonb_build_object('success', false, 'code', 'date');
  end;
  if v_debut is null then
    return jsonb_build_object('success', false, 'code', 'date');
  end if;

  -- ⚠️ Les bornes REFUSENT, elles ne tronquent pas : ces valeurs deviennent le
  -- nom d'un magasin et l'adresse où une équipe se déplacera la nuit.
  if v_cp is null or length(v_cp) <> 5 then
    return jsonb_build_object('success', false, 'code', 'code_postal');
  end if;
  v_complete := public.adresse_propre(
    v_adresse || ', ' || v_cp || case when v_ville = '' then '' else ' ' || v_ville end);
  if v_complete is null then
    return jsonb_build_object('success', false, 'code', 'adresse');
  end if;
  if v_magasin = '' then v_magasin := coalesce(nullif(v_ville, ''), left(v_adresse, 80)); end if;
  if length(v_magasin) > 80 then
    return jsonb_build_object('success', false, 'code', 'magasin');
  end if;

  -- ⚠️ LE PRIX EST RECALCULÉ, PAS RELU. Ce que le navigateur a affiché n'entre
  -- nulle part : « laisser le client porter un montant, c'est le laisser
  -- réserver à un centime » (docs/notes/074). C'est aussi `prix_mission` qui
  -- porte le refus hors zone — on n'en fait pas une copie ici.
  v_prix := public.prix_mission(
    (p_reponses ->> 'articles_max')::integer,
    p_reponses ->> 'secteur',
    v_debut,
    coalesce(p_reponses ->> 'code_barres', 'tous'),
    v_cp,
    null,
    coalesce(nullif(btrim(p_reponses ->> 'formule'), ''), 'logiciel_seul'),
    (p_reponses ->> 'appareils')::integer);
  if not coalesce((v_prix ->> 'success')::boolean, false) then
    return v_prix;
  end if;
  if v_debut < now() + interval '48 hours' then
    return jsonb_build_object('success', false, 'code', 'trop_tot');
  end if;

  select p.company_id into v_company from public.profiles p where p.id = v_uid;

  if v_company is null then
    if v_nom_entreprise = '' or length(v_nom_entreprise) > 80 then
      return jsonb_build_object('success', false, 'code', 'entreprise');
    end if;
    if v_siren is not null and not public.siren_valide(v_siren) then
      return jsonb_build_object('success', false, 'code', 'siren');
    end if;

    -- ⚠️ `gen_company_code()` et `gen_store_code()` posent les codes d'accès :
    -- ils vérifient l'unicité et emploient l'alphabet sans caractères
    -- ambigus. Les fabriquer ici en aurait fait une quatrième copie.
    insert into public.companies (name, join_code)
      values (v_nom_entreprise, public.gen_company_code())
      returning id into v_company;
    v_neuve := true;

    -- Le déclencheur `companies_ouvrir_on_demand` vient de poser le droit
    -- On-Demand. OS reste fermé : aucun abonnement n'a été payé.
    update public.profiles
       set company_id = v_company, role = 'supervisor', is_company_admin = true
     where id = v_uid;
  end if;

  -- ⚠️ LE DROIT ON-DEMAND SE POSE ICI, pas par un déclencheur sur `companies`.
  -- Un déclencheur mettrait du code de ce chantier sur le chemin de création
  -- d'entreprise de Quantinvo OS — celui qu'emprunte un client qui vient de
  -- payer. On-Demand s'ouvre quand On-Demand sert.
  insert into public.entitlements (company_id, produit, etat, source)
    values (v_company, 'on_demand', 'actif', 'libre')
    on conflict (company_id, produit) do nothing;

  -- Un établissement déjà connu se réutilise — c'est ce que promet l'écran du
  -- compte : « la prochaine réservation partira de là ».
  select s.id into v_store
    from public.stores s
   where s.company_id = v_company and lower(s.name) = lower(v_magasin)
   limit 1;

  if v_store is null then
    insert into public.stores (company_id, name, join_code, address, sqm)
    values (v_company, v_magasin, public.gen_store_code(), v_complete,
            nullif(regexp_replace(coalesce(p_reponses ->> 'surface_vente', ''), '\D', '', 'g'), '')::integer)
    returning id into v_store;
  end if;

  -- ⚠️ UNE RÉSERVATION EN ATTENTE À LA FOIS PAR MAGASIN. Sans ce garde-fou, un
  -- parcours rejoué — retour arrière, double clic, onglet rouvert — laisse
  -- derrière lui des missions fantômes qui comptent dans les tableaux et dans
  -- la capacité.
  update public.missions
     set etat = 'annulee', motif = 'remplacée par une réservation plus récente'
   where company_id = v_company and store_id = v_store
     and etat in ('brouillon', 'prix_calcule');

  insert into public.missions (
    company_id, store_id, reserve_par,
    client_nom, magasin_nom, adresse, code_postal, ville,
    secteur, surface_vente_m2, surface_reserve_m2,
    articles_min, articles_max, references_min, references_max, code_barres,
    engagement_range_le, cgv_version,
    debut_prevu, moment, duree_prevue_minutes, arrivee_prevue,
    formule, inventoristes, appareils, responsable,
    articles_retenus, prix_cents, cout_cents, calcul, reglages_version,
    annulation_gratuite_jusqu_au, etat)
  values (
    v_company, v_store, v_uid,
    (select c.name from public.companies c where c.id = v_company), v_magasin,
    v_complete, v_cp, nullif(v_ville, ''),
    p_reponses ->> 'secteur',
    nullif(regexp_replace(coalesce(p_reponses ->> 'surface_vente', ''), '\D', '', 'g'), '')::integer,
    nullif(regexp_replace(coalesce(p_reponses ->> 'surface_reserve', ''), '\D', '', 'g'), '')::integer,
    coalesce((p_reponses ->> 'articles_min')::integer, 0),
    (p_reponses ->> 'articles_max')::integer,
    nullif(p_reponses ->> 'references_min', '')::integer,
    nullif(p_reponses ->> 'references_max', '')::integer,
    coalesce(p_reponses ->> 'code_barres', 'tous'),
    now(), p_reponses ->> 'cgv_version',
    v_debut, p_reponses ->> 'moment',
    (v_prix ->> 'duree_minutes')::integer,
    v_debut - interval '15 minutes',
    coalesce(v_prix ->> 'formule', 'logiciel_seul'),
    (v_prix ->> 'inventoristes')::integer,
    (v_prix ->> 'appareils')::integer,
    coalesce((v_prix ->> 'responsable')::boolean, false),
    (v_prix ->> 'articles_retenus')::integer,
    (v_prix ->> 'prix_cents')::integer,
    (v_prix ->> 'cout_cents')::integer,
    v_prix,
    (v_prix ->> 'version')::integer,
    v_debut - interval '3 days',
    'prix_calcule')
  returning id, reference into v_id, v_ref;

  -- ⚠️ CE QUI SORT D'ICI EST CE QUE LE CLIENT PEUT VOIR, ET RIEN DE PLUS : ni
  -- `cout_cents`, ni la rémunération de l'équipe, ni la marge. La mission les
  -- porte ; le `grant select` colonne par colonne les retient.
  -- ⚠️ L'INVENTAIRE NAÎT AVEC LA RÉSERVATION (4 octobre 2026). Il naissait à
  -- l'ouverture de la mission — et le client, qui atterrit sur son tableau de
  -- bord Quantinvo OS comme n'importe qui, en créait un AUTRE pour préparer.
  -- Deux inventaires à l'écran, rien pour dire lequel compte. Décision de
  -- Julien : un seul, et c'est celui de la mission.
  perform public.creer_la_session_de_mission(v_id);

  return jsonb_build_object(
    'success', true,
    'mission_id', v_id,
    'reference', v_ref,
    'prix_cents', (v_prix ->> 'prix_cents')::integer,
    'inventoristes', (v_prix ->> 'inventoristes')::integer,
    'responsable', (v_prix ->> 'responsable')::boolean,
    'duree_minutes', (v_prix ->> 'duree_minutes')::integer,
    'entreprise_creee', v_neuve);
end;
$function$;

-- `create or replace` rend EXECUTE à PUBLIC : on repose les droits.
revoke all on function public.creer_la_session_de_mission(uuid) from public, anon;
revoke all on function public.reserver_ma_mission(jsonb) from public, anon;
grant execute on function public.creer_la_session_de_mission(uuid) to authenticated, service_role;
grant execute on function public.reserver_ma_mission(jsonb) to authenticated, service_role;
