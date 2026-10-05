-- ⚠️⚠️ UNE RÉSERVATION OUVRE UN ACCÈS. RIEN DE PLUS (Julien, 5 octobre 2026).
--
-- « On veut juste que On-Demand donne accès à Quantinvo OS juste le temps d'un
-- inventaire, c'est tout, le reste doit être la même chose que pour un
-- utilisateur lambda Quantinvo OS. Ce qui change c'est la facturation et la
-- durée d'utilisation. »
--
-- Et, dans la foulée : « une réservation ne crée pas automatiquement
-- l'inventaire, c'est le client qui créera son inventaire ».
--
-- ⚠️ **CE QUE JE M'ÉTAIS MIS À CONSTRUIRE ÉTAIT PLUS COMPLIQUÉ QUE LE
-- PRODUIT.** J'avais fait naître l'inventaire avec la réservation, puis
-- débattu du mode de comptage « puisque personne n'est là pour choisir » —
-- alors qu'il y a toujours quelqu'un : le client. Trois migrations pour une
-- question qui ne se posait pas.
--
-- Ce qu'une réservation est vraiment :
--
--   · une FENÊTRE d'accès sur un magasin, avec des appareils en plus ;
--   · un MONTANT.
--
-- Le reste — créer l'inventaire, le nommer, choisir les zones, importer,
-- compter, clôturer — c'est Quantinvo OS, à l'identique, par le client.
--
-- Trois changements :
--
--   1. `reserver_ma_mission` ne crée plus d'inventaire ;
--   2. `admin_avancer_mission` non plus ;
--   3. `ouvrir_les_acces_mission` n'exige plus qu'il en existe un — et la
--      fenêtre devient celle qu'on VEND.
--
-- ⚠️ **LA FENÊTRE ÉTAIT D'UNE NUIT, ET ON VEND UNE SEMAINE.** Elle valait
-- « début + durée estimée + 2 h » : le modèle de l'équipe qui vient un soir et
-- repart. La page de réservation, elle, promet au client « vous comptez quand
-- vous voulez dans cette semaine, autant de fois qu'il le faut ». Les
-- appareils se seraient refermés la nuit même.
--
-- `creer_la_session_de_mission` n'est pas supprimée : plus personne ne
-- l'appelle, et elle reste pour la formule équipe, fermée mais pas effacée.
--
-- ⚠️ Les trois définitions sont celles qui tournaient, reprises de
-- `pg_get_functiondef` et patchées.
CREATE OR REPLACE FUNCTION public.ouvrir_les_acces_mission(p_mission uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_m record;
  v_fin timestamptz;
  v_n integer;
  v_jours integer;
begin
  select * into v_m from public.missions where id = p_mission;
  if not found then
    return 0;
  end if;

  -- ⚠️ LA MARGE EST DE DEUX HEURES, ET ELLE N'EST PAS DE LA GÉNÉROSITÉ. Un
  -- accès qui expire à la minute annoncée coupe le comptage d'une équipe en
  -- retard — et une mission qui déborde coûte déjà à Quantinvo (document du
  -- prix, § 6) sans avoir besoin de perdre les données en plus. La fermeture
  -- normale, c'est la clôture ; l'expiration n'est qu'un filet.
  -- ⚠️ LA FENÊTRE EST CELLE QU'ON VEND : une semaine, pas une nuit. Elle
  -- valait « début + durée estimée + 2 h » — le modèle de l'équipe qui vient
  -- un soir et repart. On loue Quantinvo pour sept jours, et la page de
  -- réservation le dit au client : « vous comptez quand vous voulez dans cette
  -- semaine, autant de fois qu'il le faut ».
  select coalesce(r.fenetre_jours, 7) into v_jours
    from public.reglages_prix r
   where r.version = coalesce(v_m.reglages_version, (select version from public.reglages_prix where en_vigueur));
  -- ⚠️ ELLE COURT DEPUIS LA DATE CHOISIE PAR LE CLIENT, pas depuis le jour où
  -- Quantinvo appuie sur le bouton. Mesuré avant correction : une réservation
  -- du 20 octobre ouverte le 5 donnait **22 jours** d'accès. La page de
  -- réservation annonce « du mercredi 7 au mercredi 14 » : c'est cette
  -- semaine-là qui est vendue, et aucune autre.
  v_fin := v_m.debut_prevu + make_interval(days => coalesce(v_jours, 7));

  insert into public.mission_access (mission_id, user_id, inventory_session_id, role, expire_le)
  select v_m.id, a.user_id, v_m.inventory_session_id,
         case when a.role = 'responsable' then 'team_leader' else 'counter' end,
         v_fin
    from public.mission_assignments a
   where a.mission_id = v_m.id and a.etat = 'acceptee'
  on conflict (mission_id, user_id) do update
    set inventory_session_id = excluded.inventory_session_id,
        role = excluded.role,
        expire_le = excluded.expire_le;

  get diagnostics v_n = row_count;

  -- ⚠️ Et elle ne s'ouvre pas AVANT : préparer un inventaire ne demande aucun
  -- appareil, et ouvrir la veille offrirait une journée qui n'a pas été
  -- vendue. Ouvrir en retard, en revanche, ne rallonge pas la fin.
  update public.missions
     set acces_ouverts_le = coalesce(acces_ouverts_le, greatest(now(), v_m.debut_prevu)),
         acces_expirent_le = v_fin
   where id = v_m.id;

  return v_n;
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

CREATE OR REPLACE FUNCTION public.admin_avancer_mission(p_mission uuid, p_etat text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_m record;
begin
  if not public.is_admin() then
    return jsonb_build_object('success', false, 'error', 'Accès refusé');
  end if;

  select * into v_m from public.missions where id = p_mission;
  if not found then
    return jsonb_build_object('success', false, 'error', 'Mission introuvable');
  end if;

  -- ⚠️ `en_cours` OUVRE LES ACCÈS DE TOUTE L'ÉQUIPE : sans inventaire, ils
  -- n'ouvrent sur rien. On le crée d'abord, une seule fois.
  begin
    update public.missions set etat = p_etat where id = p_mission;
  exception when check_violation then
    return jsonb_build_object('success', false, 'code', 'transition',
      'error', 'Cette mission ne peut pas passer de « ' || v_m.etat || ' » à « ' || p_etat || ' ».');
  end;

  perform public.log_admin_action(
    'mission_etat', 'mission', p_mission::text, v_m.reference,
    jsonb_build_object('de', v_m.etat, 'vers', p_etat));

  return jsonb_build_object('success', true, 'etat', p_etat);
end;
$function$;

-- `create or replace` rend EXECUTE à PUBLIC : on repose les droits.
revoke all on function public.ouvrir_les_acces_mission(uuid) from public, anon;
revoke all on function public.reserver_ma_mission(jsonb) from public, anon;
revoke all on function public.admin_avancer_mission(uuid, text) from public, anon;
grant execute on function public.reserver_ma_mission(jsonb) to authenticated, service_role;
grant execute on function public.admin_avancer_mission(uuid, text) to authenticated, service_role;
