-- ⚠️ UNE LOCATION N'OUVRAIT AUCUN APPAREIL (4 octobre 2026).
--
-- Trouvé en regardant l'écran d'une réservation réelle : « Équipe —
-- 0 inventoriste ». Le zéro était juste (on n'envoie personne), mais il
-- cachait un défaut.
--
-- `prix_mission` rend DEUX nombres distincts :
--
--   · `inventoristes` — les gens qu'on envoie, et `0` en formule
--     `logiciel_seul` par construction ;
--   · `appareils` — les téléphones que le client utilisera, 9 pour 30 000
--     pièces.
--
-- `reserver_ma_mission` ne gardait que le PREMIER. Le nombre d'appareils —
-- celui que le client a choisi, celui qui fait le prix — n'était écrit nulle
-- part.
--
-- ⚠️⚠️ ET C'EST `plafond_mission_en_cours` QUI LE LISAIT. Cette fonction est
-- la seule pièce d'On-Demand qui touche Quantinvo OS : elle ouvre des
-- appareils supplémentaires pendant la mission. Elle les comptait depuis
-- `inventoristes` — donc **zéro appareil ouvert pour une location**. On vend
-- neuf téléphones pour la semaine, et le neuvième se fait refuser le soir du
-- comptage, avec `forfait_plein`.
--
-- La colonne `inventoristes` reste : elle décrit l'équipe envoyée, et vaudra
-- de nouveau quelque chose le jour où cette formule rouvrira.

alter table public.missions add column if not exists appareils integer;

comment on column public.missions.appareils is
  'Les appareils ouverts au client pendant la mission — ce qu''il a choisi, et '
  'ce qui fait le prix. Distinct d''`inventoristes`, qui compte les gens envoyés '
  'et vaut 0 en formule « logiciel seul ».';

-- ⚠️ Les missions déjà prises gardent leur sens : avant cette colonne, le
-- nombre d'appareils ÉTAIT le nombre d'inventoristes (formule équipe), ou le
-- minimum imposé par la taille (logiciel seul, où il n'était pas écrit).
update public.missions m
   set appareils = greatest(
         1,
         case when m.inventoristes > 0
              then m.inventoristes + case when m.responsable then 1 else 0 end
              else coalesce((public.prix_mission(
                     m.articles_max, m.secteur, m.debut_prevu, m.code_barres,
                     m.code_postal, null, 'logiciel_seul', null
                   ) ->> 'appareils')::integer, 1)
         end)
 where m.appareils is null;

-- ─── Le plafond compte les APPAREILS ───────────────────────────────────────
--
-- ⚠️ Le repli sur l'ancien calcul reste, et il n'est pas décoratif : une
-- mission créée entre le déploiement de cette migration et celui du site
-- aurait `appareils` nul.
create or replace function public.plafond_mission_en_cours(p_store_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $function$
  select coalesce(max(coalesce(
           m.appareils,
           m.inventoristes + case when m.responsable then 1 else 0 end)), 0)
    from public.missions m
   where m.store_id = p_store_id
     and m.etat in ('prete','en_cours','controle_qualite')
     and m.acces_ouverts_le is not null
     and now() >= m.acces_ouverts_le
     and now() < m.acces_expirent_le;
$function$;

revoke all on function public.plafond_mission_en_cours(uuid) from public, anon;
grant execute on function public.plafond_mission_en_cours(uuid) to authenticated, service_role;

-- ─── La réservation écrit les deux nombres ─────────────────────────────────
--
-- ⚠️ CETTE DÉFINITION EST CELLE QUI TOURNAIT, À DEUX LIGNES PRÈS — la colonne
-- `appareils` dans la liste, et `(v_prix ->> 'appareils')` dans les valeurs.
-- Elle a été reprise de `pg_get_functiondef` et patchée, pas recopiée à la
-- main : deux fonctions sœurs divergent à la première correction portée sur
-- une seule des deux.
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
    inventoristes, appareils, responsable,
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

-- `create or replace` rend EXECUTE à PUBLIC : on repose les droits.
revoke all on function public.reserver_ma_mission(jsonb) from public, anon;
grant execute on function public.reserver_ma_mission(jsonb) to authenticated, service_role;
