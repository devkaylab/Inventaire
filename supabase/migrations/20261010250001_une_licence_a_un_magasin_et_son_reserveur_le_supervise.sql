-- ⚠️⚠️ UNE LICENCE A UN MAGASIN — ET CELUI QUI RÉSERVE LE SUPERVISE.
--
-- Deuxième correction du jour sur ce bloc, et c'est la première qui était
-- fausse. J'avais dispensé la licence d'adresse en raisonnant sur la donnée :
-- « personne ne se déplace, donc pas d'adresse ». L'écran l'a démenti en deux
-- minutes — le client paie, obtient ses accès, et tombe sur :
--
--   « Aucun magasin ne vous est affecté. Un inventaire est toujours rattaché à
--     un magasin. Demandez à votre administrateur de vous affecter au magasin. »
--
-- Une licence A un magasin : celui que le client va inventorier. Ce qui change
-- entre les deux formules, c'est **qui s'y déplace**, pas l'existence du lieu.
-- Julien : « il faut les mêmes infos qu'un onboarding OS, c'est juste le profil
-- de client qui change. »
--
-- ⚠️⚠️ **ET LE VRAI BLOCAGE ÉTAIT AILLEURS, depuis toujours, pour les DEUX
-- formules.** `get_my_stores` — ce que lit l'écran « Nouvel inventaire » — joint
-- `store_supervisors`. Et `reserver_ma_mission` n'y écrivait JAMAIS. Mesuré sur
-- le client qui venait de payer : **zéro ligne**. Le magasin aurait existé
-- qu'il ne l'aurait pas vu — et le message lui disait de s'adresser à son
-- administrateur, alors qu'il EST l'administrateur, seul dans son entreprise
-- neuve. Un cul-de-sac après paiement.
--
-- Trois changements :
--   1. le magasin et son adresse sont exigés des deux côtés ;
--   2. le SIREN devient obligatoire — une location est un contrat avec une
--      entreprise, et la facture l'exige ;
--   3. celui qui réserve est rattaché au magasin comme superviseur.
--
-- Ce qui RESTE de la correction précédente : `secteur` nullable et la
-- normalisation des chaînes vides. Ces deux champs-là ne sont toujours pas
-- demandés par le parcours « logiciel seul », et `coalesce` ne rattrape
-- toujours pas une chaîne vide.

create or replace function public.reserver_ma_mission(p_reponses jsonb)
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
  -- ⚠️ LA FORMULE DÉCIDE DE CE QUI EST EXIGÉ. Elle était relue au vol dans
  -- l'appel à `prix_mission` et nulle part ailleurs : c'est ce qui a permis à
  -- l'adresse de rester obligatoire pour une location de LOGICIEL.
  v_formule text := coalesce(nullif(btrim(p_reponses ->> 'formule'), ''), 'logiciel_seul');
  v_logiciel boolean := v_formule = 'logiciel_seul';
  v_debut timestamptz;
  v_prix jsonb;
  v_id uuid;
  v_ref text;
  v_neuve boolean := false;
  v_role text;
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

  -- ⚠️⚠️ **L'ADRESSE N'EST EXIGÉE QUE SI UNE ÉQUIPE SE DÉPLACE** (10 octobre
  -- 2026). Elle l'était pour les DEUX formules, alors que le parcours
  -- « logiciel seul » ne la demande jamais : ses étapes sont Volume puis Date.
  -- Ce parcours ne pouvait donc aboutir POUR PERSONNE — il refusait
  -- `code_postal`, un champ qu'aucun de ses écrans n'affiche. Julien l'a vu en
  -- le jouant : « on me parle de code postal ».
  --
  -- ⚠️ Et `prix_mission` avait déjà tranché, en toutes lettres : « Hors zone :
  -- seulement quand une ÉQUIPE se déplace. Le logiciel se livre » partout. La
  -- règle existait, elle n'avait pas été reportée ici. Ce n'est donc pas une
  -- décision neuve, c'est un oubli qu'on rattrape.
  --
  -- Les bornes REFUSENT, elles ne tronquent pas : ces valeurs deviennent le nom
  -- d'un magasin et l'adresse où une équipe se déplacera la nuit.
  -- ⚠️⚠️ **LE MAGASIN ET SON ADRESSE SONT EXIGÉS DES DEUX CÔTÉS** (10 octobre
  -- 2026, deuxième correction du jour sur ce même bloc).
  --
  -- J'avais d'abord dispensé la licence d'adresse, en raisonnant sur la donnée :
  -- « personne ne se déplace, donc pas d'adresse ». C'était faux, et l'écran
  -- l'a montré tout de suite — le client a payé, obtenu ses accès, et n'a rien
  -- pu faire : « Aucun magasin ne vous est affecté. Un inventaire est toujours
  -- rattaché à un magasin. » Une licence A un magasin : celui que le client va
  -- inventorier. Ce qui change entre les deux formules, c'est qui s'y déplace,
  -- pas l'existence du lieu.
  --
  -- Julien : « il faut les mêmes infos qu'un onboarding OS, c'est juste le
  -- profil de client qui change. »
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
    public.normaliser_reponse_mission(p_reponses ->> 'code_barres', 'tous'),
    v_cp,
    null,
    v_formule,
    (p_reponses ->> 'appareils')::integer);
  if not coalesce((v_prix ->> 'success')::boolean, false) then
    return v_prix;
  end if;
  if v_debut < now() + interval '48 hours' then
    return jsonb_build_object('success', false, 'code', 'trop_tot');
  end if;

  select p.company_id, p.role into v_company, v_role
    from public.profiles p where p.id = v_uid;

  -- ⚠️ CELUI QUI PASSE EN CAISSE DEVIENT LE CLIENT (Julien, 5 octobre 2026) :
  -- « c'est le compte client que l'on garde, celui qui a payé, pas celui qui
  --   participe à un inventaire ».
  --
  -- Un compteur appartient à l'entreprise de QUELQU'UN D'AUTRE — celle qui l'a
  -- invité à compter. Le laisser réserver attachait la location à cet employeur,
  -- et `create_session` le refusait juste après : elle exige le rôle superviseur.
  -- Il payait un inventaire qu'il ne pouvait pas créer.
  --
  -- On le traite donc comme un nouveau venu : sa propre entreprise, superviseur
  -- et administrateur. Sa place de compteur ne le suit pas, et il n'y a rien à
  -- effacer — `is_session_participant` exige `s.company_id = get_my_company()`,
  -- donc ses anciennes participations ne lui montrent plus rien.
  if v_role = 'employee' then
    v_company := null;
  end if;

  if v_company is null then
    if v_nom_entreprise = '' or length(v_nom_entreprise) > 80 then
      return jsonb_build_object('success', false, 'code', 'entreprise');
    end if;
    -- ⚠️ SIREN OBLIGATOIRE (Julien, 10 octobre 2026) : « il faut les mêmes
    -- infos qu'un onboarding OS ». Une location est un contrat avec une
    -- entreprise, pas avec une personne — et la facture l'exige.
    if v_siren is null or not public.siren_valide(v_siren) then
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

  -- ⚠️ AUCUN MAGASIN N'EST INVENTÉ POUR UNE LICENCE. Créer un établissement
  -- sans adresse pour une location de logiciel polluerait « Mes magasins » du
  -- client avec un lieu qui n'existe pas, et lui en ferait porter le décompte
  -- d'appareils. La mission reste rattachée à l'entreprise, `store_id` nul.
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

  -- ⚠️⚠️ **ET CELUI QUI RÉSERVE DEVIENT SUPERVISEUR DE CE MAGASIN.** C'était LE
  -- blocage, et il valait pour les DEUX formules depuis toujours :
  -- `get_my_stores` — ce que lit « Nouvel inventaire » — joint
  -- `store_supervisors`, et rien n'y écrivait. Mesuré : zéro ligne pour le
  -- client qui venait de payer. Il obtenait ses accès et tombait sur « Aucun
  -- magasin ne vous est affecté… demandez à votre administrateur » — alors
  -- qu'il EST l'administrateur, seul dans son entreprise neuve.
  insert into public.store_supervisors (store_id, user_id)
  values (v_store, v_uid)
  on conflict do nothing;

  -- ⚠️ UNE RÉSERVATION EN ATTENTE À LA FOIS PAR MAGASIN. Sans ce garde-fou, un
  -- parcours rejoué — retour arrière, double clic, onglet rouvert — laisse
  -- derrière lui des missions fantômes qui comptent dans les tableaux et dans
  -- la capacité.
  update public.missions
     set etat = 'annulee', motif = 'remplacée par une réservation plus récente'
   -- ⚠️ `is not distinct from` : une licence n'a pas de magasin, et `= null`
   -- n'est jamais vrai — le garde-fou aurait laissé s'empiler les missions
   -- fantômes exactement sur la formule qui vient d'être débloquée.
   where company_id = v_company and store_id is not distinct from v_store
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
    -- ⚠️ `nullif(btrim(...), '')` ET PAS `coalesce` : une chaîne VIDE n'est pas
    -- NULL, et `coalesce` ne la remplace pas. C'est ce qui a fait exploser la
    -- contrainte de `code_barres` au visage du client, et ce qui aurait fait
    -- exploser celle de `secteur` juste après. La formule « logiciel seul » ne
    -- pose ni l'un ni l'autre : son parcours n'a pas d'étape 3.
    nullif(btrim(coalesce(p_reponses ->> 'secteur', '')), ''),
    nullif(regexp_replace(coalesce(p_reponses ->> 'surface_vente', ''), '\D', '', 'g'), '')::integer,
    nullif(regexp_replace(coalesce(p_reponses ->> 'surface_reserve', ''), '\D', '', 'g'), '')::integer,
    coalesce((p_reponses ->> 'articles_min')::integer, 0),
    (p_reponses ->> 'articles_max')::integer,
    nullif(p_reponses ->> 'references_min', '')::integer,
    nullif(p_reponses ->> 'references_max', '')::integer,
    public.normaliser_reponse_mission(p_reponses ->> 'code_barres', 'tous'),
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
$function$
;

revoke all on function public.reserver_ma_mission(jsonb) from public, anon;
grant execute on function public.reserver_ma_mission(jsonb) to authenticated, service_role;
