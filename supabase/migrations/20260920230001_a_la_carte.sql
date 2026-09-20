-- À la carte : Quantinvo OS le temps d'un inventaire.
--
-- ⚠️ **CETTE MIGRATION NE TOUCHE PAS QUANTINVO OS.** Elle ne modifie que des
-- objets posés par le chantier On-Demand les 20 septembre 2026 : `missions`,
-- `reglages_prix`, `prix_mission`, `devis_mission`, `reserver_ma_mission`,
-- `transition_mission_permise`. Aucune policy, aucune fonction, aucun
-- déclencheur d'OS n'est réécrit.
--
-- ⚠️ **LE CONSTAT DE JULIEN, 20 SEPTEMBRE 2026** : « si le client n'a pas
-- besoin de compteurs quantinvo, on lui propose l'abonnement quantinvo os ce
-- qui n'est pas logique, il peut y aller directement par l'offre quantinvo ».
-- La page « À la demande » envoyait « vous, avec votre équipe » vers un
-- abonnement ANNUEL. Quelqu'un qui fait un inventaire par an n'a aucune raison
-- d'acheter douze mois de logiciel, et lui présenter ça comme une option de la
-- page « à la demande » est un contresens : à la demande, c'est justement le
-- contraire de l'engagement.
--
-- D'où une SECONDE FORMULE de la même réservation : le logiciel seul, pour un
-- inventaire, sans notre équipe. Même tunnel, même mission, même prix ferme.
--
-- ⚠️ **CE N'EST PAS UN SECOND PRODUIT, C'EST UNE COLONNE.** Faire un objet à
-- part aurait dupliqué la réservation, le paiement, les dates, l'annulation,
-- la fenêtre d'accès et le plafond d'appareils — six mécanismes déjà écrits et
-- éprouvés. Une mission reste une mission ; ce qui change, c'est qui tient le
-- téléphone, donc ce qu'on facture.

-- ─── 1. Les deux réglages du logiciel seul ─────────────────────────────────
--
-- ⚠️ **16 € PAR APPAREIL, ARBITRÉ PAR JULIEN LE 20 SEPTEMBRE 2026.** L'ancrage
-- est la grille d'abonnement : Advanced vaut 310 € par mois pour 20 appareils,
-- soit 15,50 € l'appareil. Seize euros, c'est donc « un mois d'abonnement,
-- ramené aux appareils dont votre inventaire a besoin » — une phrase qui se
-- défend devant un client, ce qu'un nombre inventé ne fait pas.
--
-- ⚠️ **ET C'EST UN RÉGLAGE, PAS UNE CONSTANTE.** Il vit dans `reglages_prix`,
-- versionné comme le reste : une mission réservée garde le tarif de sa
-- version, et la console `/admin/prix` en pose une nouvelle sans toucher aux
-- missions en cours. C'est la même discipline que le taux inventoriste.
--
-- ⚠️ **LES FRAIS FIXES NE SONT PAS LES MÊMES QUE CEUX DE L'ÉQUIPE.** Les 46 €
-- d'une mission avec équipe couvrent la commission Stripe, **les frais de
-- versement Connect** et l'exploitation. Sans équipe, il n'y a personne à
-- payer : pas de versement Connect, pas de constitution d'équipe, pas de
-- contrôle qualité sur place. 19 €, c'est la commission d'encaissement et
-- l'exploitation, rien d'autre. Reprendre 46 € aurait fait payer au client
-- d'à côté un virement qui n'existe pas.
alter table public.reglages_prix
  add column if not exists tarif_appareil_cents integer not null default 1600,
  add column if not exists frais_fixes_logiciel_cents integer not null default 1900;

alter table public.reglages_prix
  drop constraint if exists reglages_prix_tarif_appareil_check;
alter table public.reglages_prix
  add constraint reglages_prix_tarif_appareil_check
  check (tarif_appareil_cents > 0 and frais_fixes_logiciel_cents >= 0);

-- ─── 2. La formule, sur la mission ─────────────────────────────────────────
--
-- ⚠️ `equipe_quantinvo` PAR DÉFAUT, ET C'EST VOLONTAIRE. Les missions déjà
-- réservées — il n'y en a aucune en base à cette date, mais la règle doit
-- tenir quand il y en aura — sont toutes des missions avec équipe. Un défaut
-- `null` obligerait chaque lecture à décider quoi faire du vide.
alter table public.missions
  add column if not exists formule text not null default 'equipe_quantinvo';

alter table public.missions drop constraint if exists missions_formule_check;
alter table public.missions
  add constraint missions_formule_check
  check (formule in ('equipe_quantinvo', 'logiciel_seul'));

-- ⚠️ LA COLONNE S'AJOUTE À LA LISTE BLANCHE DU CLIENT. `missions` n'est pas
-- lisible en entier par `authenticated` : les colonnes sont accordées une par
-- une, pour que `cout_cents`, `calcul` et le `payment_intent` restent hors de
-- portée. Une colonne neuve n'est donc PAS lisible tant qu'on ne l'accorde
-- pas — et le client doit voir ce qu'il a réservé.
grant select (formule) on table public.missions to authenticated;

-- ─── 3. Le prix, selon la formule ──────────────────────────────────────────
--
-- ⚠️ **LE DIMENSIONNEMENT EST LE MÊME, MOT POUR MOT.** Articles → heures-
-- personne → nombre de personnes → durée : rien ne change. C'est la demande de
-- Julien — « tarifs sur les mêmes critères on demand mais sans les compteurs »
-- — et c'est aussi ce qui rend les deux prix comparables sur la même page.
-- Ce qui change commence à la ligne du coût.
--
-- ⚠️ **TROIS REFUS TOMBENT AVEC L'ÉQUIPE, ET ILS TOMBENT PAR NÉCESSITÉ :**
--
--   • **la zone.** Nous ne savons pas envoyer six personnes à Bordeaux ; le
--     logiciel, lui, y marche. Refuser une licence pour un code postal serait
--     refuser de vendre ce qu'on peut livrer.
--   • **le délai de 48 heures.** Il existe pour constituer une équipe. Sans
--     équipe, il ne protège rien : le client qui veut compter ce soir compte
--     ce soir.
--   • **les coefficients.** Secteur, horaire, dimanche, code-barres : tous
--     décrivent la difficulté du TRAVAIL HUMAIN. Le logiciel coûte la même
--     chose un dimanche à 23 h qu'un mardi à 10 h. Les appliquer serait
--     facturer une pénibilité que personne ne subit.
--
-- ⚠️ **ET LA MARGE MINIMUM RESTE ARMÉE.** Elle ne mordra pas au tarif du
-- lancement — 45 % sur le plus petit inventaire — mais un futur réglage qui
-- descendrait le tarif appareil sous les frais fixes serait refusé, pas servi
-- à perte. La garde ne coûte rien tant qu'elle ne sert pas.
drop function if exists public.prix_mission(integer, text, timestamptz, text, text, integer);

create or replace function public.prix_mission(
  p_articles_max integer,
  p_secteur      text,
  p_debut        timestamptz,
  p_code_barres  text default 'tous',
  p_code_postal  text default null,
  p_version      integer default null,
  p_formule      text default 'equipe_quantinvo'
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  r             record;
  v_zone        record;
  v_formule     text := coalesce(nullif(btrim(p_formule), ''), 'equipe_quantinvo');
  v_logiciel    boolean;
  v_heures      numeric;
  v_inv         integer;
  v_resp        boolean;
  v_appareils   integer;
  v_minutes     integer;
  v_heures_fac  numeric;
  v_equipe      integer;
  v_licence     integer;
  v_frais       integer;
  v_cout        integer;
  v_coef        numeric := 1.00;
  v_detail      jsonb := '{}'::jsonb;
  v_c           numeric;
  v_prix        integer;
  v_marge       numeric;
begin
  if v_formule not in ('equipe_quantinvo', 'logiciel_seul') then
    return jsonb_build_object('success', false, 'code', 'formule');
  end if;
  v_logiciel := v_formule = 'logiciel_seul';

  if p_articles_max is null or p_articles_max < 1 then
    return jsonb_build_object('success', false, 'code', 'articles');
  end if;
  if p_debut is null then
    return jsonb_build_object('success', false, 'code', 'date');
  end if;

  select * into r from public.reglages_prix
   where (p_version is null and en_vigueur) or version = p_version
   limit 1;
  if not found then
    return jsonb_build_object('success', false, 'code', 'pas_de_reglages');
  end if;

  -- Hors zone : on refuse franchement. ⚠️ PAS DE DEVIS DE RATTRAPAGE — c'est
  -- toute la promesse du produit (maquette HorsZone : on propose de prévenir
  -- quand la ville ouvre, on ne propose pas de négocier).
  -- ⚠️ MAIS SEULEMENT QUAND UNE ÉQUIPE SE DÉPLACE : le logiciel se livre
  -- partout, et le refuser sur un code postal serait refuser de vendre ce
  -- qu'on sait livrer.
  if p_code_postal is not null and not v_logiciel then
    select * into v_zone from public.zones_desservies
     where prefixe = substring(btrim(p_code_postal) from 1 for 2);
    if not found or not v_zone.actif then
      return jsonb_build_object('success', false, 'code', 'hors_zone');
    end if;
    v_coef := v_coef * v_zone.coefficient;
    v_detail := v_detail || jsonb_build_object('geographie', v_zone.coefficient);
  end if;

  -- 1 et 2. Ce qu'il y a à compter, et combien d'heures-personne.
  v_heures := p_articles_max::numeric / r.productivite;

  -- 3. Combien de personnes, et combien de temps. IDENTIQUE aux deux formules.
  v_inv := ceil(v_heures / (r.duree_cible_minutes::numeric / 60))::integer;
  v_minutes := ceil((v_heures / v_inv) * 60 / r.arrondi_minutes)::integer * r.arrondi_minutes;
  -- ⚠️ Un responsable dès trois inventoristes : en dessous, personne ne
  -- contrôlerait les écarts sur place — et c'est Quantinvo qui répond de la
  -- qualité, pas le magasin. Pour le logiciel seul, ce n'est plus notre
  -- responsable mais le superviseur du client : il lui faut un appareil de la
  -- même façon, et la règle de seuil est la même.
  v_resp := v_inv >= r.responsable_des_n;
  v_appareils := v_inv + case when v_resp then 1 else 0 end;

  -- 4. Ce que ça coûte, et c'est là que les deux formules se séparent.
  v_heures_fac := v_minutes::numeric / 60;
  if v_logiciel then
    v_equipe := 0;
    v_licence := v_appareils * r.tarif_appareil_cents;
    v_frais := r.frais_fixes_logiciel_cents;
    v_cout := v_frais;
  else
    v_licence := 0;
    v_equipe := round(
      (v_inv * r.taux_inventoriste_cents
       + case when v_resp then r.taux_responsable_cents else 0 end) * v_heures_fac
    )::integer;
    v_frais := r.frais_fixes_cents;
    v_cout := v_equipe + v_frais;
  end if;

  -- Les coefficients, un par famille, multipliés entre eux. ⚠️ AUCUN pour le
  -- logiciel seul : ils décrivent tous la pénibilité du travail humain.
  if not v_logiciel then
    select valeur into v_c from public.coefficients_prix
     where version = r.version and famille = 'secteur' and cle = coalesce(p_secteur, 'autre');
    if v_c is not null then
      v_coef := v_coef * v_c;
      v_detail := v_detail || jsonb_build_object('secteur', v_c);
    end if;

    if extract(hour from (p_debut at time zone 'Europe/Paris')) >= 22 then
      select valeur into v_c from public.coefficients_prix
       where version = r.version and famille = 'horaire' and cle = 'apres_22h';
      if v_c is not null then
        v_coef := v_coef * v_c;
        v_detail := v_detail || jsonb_build_object('horaire', v_c);
      end if;
    end if;

    if extract(isodow from (p_debut at time zone 'Europe/Paris')) = 7 then
      select valeur into v_c from public.coefficients_prix
       where version = r.version and famille = 'jour' and cle = 'dimanche';
      if v_c is not null then
        v_coef := v_coef * v_c;
        v_detail := v_detail || jsonb_build_object('jour', v_c);
      end if;
    end if;

    -- ⚠️ LE STOCK PARTIELLEMENT NON CODE-BARRÉ EST LE COEFFICIENT LE PLUS
    -- LOURD DU MODÈLE : ce qui n'a pas de code se compte à la main, référence
    -- par référence. Il est à 1,00 au lancement comme les autres, mais c'est
    -- celui que les premières missions corrigeront en premier.
    if coalesce(p_code_barres, 'tous') = 'partiel' then
      select valeur into v_c from public.coefficients_prix
       where version = r.version and famille = 'code_barres' and cle = 'partiel';
      if v_c is not null then
        v_coef := v_coef * v_c;
        v_detail := v_detail || jsonb_build_object('code_barres', v_c);
      end if;
    end if;
  end if;

  -- 5. Le prix, arrondi à l'euro.
  -- ⚠️ LE LOGICIEL NE PASSE PAS PAR LA MARGE CIBLE : son prix EST la somme de
  -- la licence et des frais, parce qu'il n'a pas de coût variable à couvrir.
  -- Le diviser par 0,75 reviendrait à inventer un coût pour le majorer —
  -- exactement ce que « le prix affiché est le prix payé » interdit de faire
  -- dans le dos du client.
  if v_logiciel then
    v_prix := (round((v_licence + v_frais) / 100.0))::integer * 100;
  else
    v_prix := (round(v_cout / (1 - r.marge_cible) * v_coef / 100))::integer * 100;
  end if;
  v_marge := case when v_prix = 0 then 0 else (v_prix - v_cout)::numeric / v_prix end;

  -- ⚠️ Mieux vaut ne pas servir une mission que la servir à perte. Le refus
  -- est explicite : un prix qui sort de la grille n'est pas un prix négociable.
  if v_marge < r.marge_minimum then
    return jsonb_build_object('success', false, 'code', 'marge_insuffisante',
      'marge', round(v_marge, 4), 'minimum', r.marge_minimum);
  end if;

  return jsonb_build_object(
    'success', true,
    'version', r.version,
    'formule', v_formule,
    'articles_retenus', p_articles_max,
    'heures_personne', round(v_heures, 2),
    'inventoristes', case when v_logiciel then 0 else v_inv end,
    'compteurs_attendus', v_inv,
    'appareils', v_appareils,
    'responsable', case when v_logiciel then false else v_resp end,
    'duree_minutes', v_minutes,
    'arrivee_minutes_avant', case when v_logiciel then 0 else 15 end,
    'equipe_cents', v_equipe,
    'licence_cents', v_licence,
    'frais_cents', v_frais,
    'cout_cents', v_cout,
    'coefficient', round(v_coef, 4),
    'coefficients', v_detail,
    'prix_cents', v_prix,
    'marge_cents', v_prix - v_cout,
    'marge', round(v_marge, 4),
    -- Ce que chacun touche, pour l'écran de proposition de mission : c'est la
    -- même durée que celle vendue au client, et c'est voulu — une mission qui
    -- déborde coûte à Quantinvo, pas à l'inventoriste.
    'remuneration_inventoriste_cents',
      case when v_logiciel then 0 else round(r.taux_inventoriste_cents * v_heures_fac)::integer end,
    'remuneration_responsable_cents',
      case when v_logiciel or not v_resp then 0
           else round(r.taux_responsable_cents * v_heures_fac)::integer end
  );
end;
$function$;

-- ⚠️ LE MOTEUR N'EST PAS APPELABLE DEPUIS UN NAVIGATEUR DE CLIENT, parce que
-- ce qu'il rend contient `cout_cents`, `equipe_cents`, `marge_cents` et les
-- rémunérations. C'est exactement ce qu'un client ne doit pas lire : il saurait
-- au centime ce que Quantinvo gagne sur son inventaire, et ce que touche
-- l'inventoriste qui est chez lui. La porte du tunnel est `devis_mission`
-- ci-dessous, qui ne rend que ce que la maquette affiche.
revoke all on function public.prix_mission(integer, text, timestamptz, text, text, integer, text)
  from public, anon, authenticated;
grant execute on function public.prix_mission(integer, text, timestamptz, text, text, integer, text)
  to service_role;

-- ─── 4. Le devis, selon la formule ─────────────────────────────────────────
--
-- ⚠️ ELLE RECOPIE LES CHAMPS UN PAR UN, ELLE NE FILTRE PAS. Retirer des clés
-- d'un objet marche jusqu'au jour où `prix_mission` en ajoute une : la
-- nouvelle passe, et personne ne s'en aperçoit. Une liste blanche se trompe
-- dans l'autre sens — il manque quelque chose à l'écran, et ça se voit.
create or replace function public.devis_mission(p_reponses jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  v_debut timestamptz;
  v_prix jsonb;
  v_formule text;
  v_logiciel boolean;
begin
  if jsonb_typeof(p_reponses) <> 'object' then
    return jsonb_build_object('success', false, 'code', 'format');
  end if;

  v_formule := coalesce(nullif(btrim(p_reponses ->> 'formule'), ''), 'equipe_quantinvo');
  if v_formule not in ('equipe_quantinvo', 'logiciel_seul') then
    return jsonb_build_object('success', false, 'code', 'formule');
  end if;
  v_logiciel := v_formule = 'logiciel_seul';

  begin
    v_debut := (p_reponses->>'debut')::timestamptz;
  exception when others then
    return jsonb_build_object('success', false, 'code', 'date');
  end;

  -- ⚠️ ON NE VEND PAS POUR CE SOIR. Constituer une équipe prend du temps, et
  -- une mission acceptée qu'on ne peut pas servir coûte plus cher qu'une
  -- mission refusée. Quarante-huit heures est le délai du lancement ; c'est
  -- un réglage à revoir quand le vivier existera.
  --
  -- ⚠️ SAUF POUR LE LOGICIEL SEUL : il n'y a pas d'équipe à constituer. Le
  -- délai ne protégerait rien, il empêcherait seulement de servir quelqu'un
  -- qui compte ce soir. La date doit rester dans le futur, c'est tout.
  if not v_logiciel and v_debut < now() + interval '48 hours' then
    return jsonb_build_object('success', false, 'code', 'trop_tot');
  end if;
  if v_logiciel and v_debut < now() then
    return jsonb_build_object('success', false, 'code', 'trop_tot');
  end if;

  v_prix := public.prix_mission(
    (p_reponses->>'articles_max')::integer,
    p_reponses->>'secteur',
    v_debut,
    coalesce(p_reponses->>'code_barres', 'tous'),
    p_reponses->>'code_postal',
    null,
    v_formule);

  if not (v_prix->>'success')::boolean then
    return v_prix;
  end if;

  return jsonb_build_object(
    'success', true,
    'version', v_prix->'version',
    'formule', v_prix->'formule',
    'prix_cents', v_prix->'prix_cents',
    'inventoristes', v_prix->'inventoristes',
    'compteurs_attendus', v_prix->'compteurs_attendus',
    'appareils', v_prix->'appareils',
    'responsable', v_prix->'responsable',
    'duree_minutes', v_prix->'duree_minutes',
    'articles_retenus', v_prix->'articles_retenus',
    'debut', v_debut,
    'arrivee', v_debut - make_interval(mins => (v_prix->>'arrivee_minutes_avant')::integer),
    'fin_prevue', v_debut + make_interval(mins => (v_prix->>'duree_minutes')::integer),
    -- Annulation gratuite jusqu'à trois jours avant (maquette Prix et
    -- Annuler). Le calcul des frais au-delà vit avec les annulations.
    'annulation_gratuite_jusqu_au', v_debut - interval '3 days');
end;
$function$;

revoke all on function public.devis_mission(jsonb) from public, anon;
grant execute on function public.devis_mission(jsonb) to authenticated, service_role;

-- ─── 5. La machine d'état connaît les deux formules ────────────────────────
--
-- ⚠️ **UNE MISSION SANS ÉQUIPE N'A PAS D'ÉTAPE DE CONSTITUTION D'ÉQUIPE.**
-- `en_constitution`, `equipe_complete` et `paiement_prestataires` décrivent
-- des choses qui n'arrivent pas : il n'y a personne à proposer, personne à
-- attendre, personne à payer. Les laisser ouvertes ferait d'une console un
-- écran qui demande d'affecter des inventoristes à une mission qui n'en a pas.
--
-- ⚠️ ET C'EST LA MACHINE QUI LE SAIT, PAS L'ÉCRAN. Une règle d'état tenue par
-- l'interface se contourne par n'importe quel autre chemin.
drop function if exists public.transition_mission_permise(text, text);

create or replace function public.transition_mission_permise(
  p_de text, p_vers text, p_formule text default 'equipe_quantinvo')
returns boolean
language sql
immutable
set search_path = public
as $function$
  select case when coalesce(p_formule, 'equipe_quantinvo') = 'logiciel_seul' then
    p_de = p_vers or p_vers = any (case p_de
      when 'brouillon'             then array['prix_calcule','annulee']
      when 'prix_calcule'          then array['brouillon','paiement_autorise','annulee','echouee']
      when 'paiement_autorise'     then array['confirmee','annulee','echouee']
      -- Pas d'équipe à constituer : confirmée, elle est prête.
      when 'confirmee'             then array['prete','annulee']
      when 'prete'                 then array['en_cours','annulee','echouee']
      when 'en_cours'              then array['controle_qualite','litige','echouee']
      when 'controle_qualite'      then array['terminee','en_cours','litige']
      -- Personne à payer : terminée, elle est payée.
      when 'terminee'              then array['payee','litige']
      when 'payee'                 then array['litige']
      when 'annulee'               then array['remboursee']
      when 'echouee'               then array['remboursee']
      when 'litige'                then array['terminee','payee','remboursee']
      else array[]::text[]
    end)
  else
    p_de = p_vers or p_vers = any (case p_de
      when 'brouillon'             then array['prix_calcule','annulee']
      when 'prix_calcule'          then array['brouillon','paiement_autorise','annulee','echouee']
      when 'paiement_autorise'     then array['confirmee','annulee','echouee']
      when 'confirmee'             then array['en_constitution','annulee']
      when 'en_constitution'       then array['equipe_complete','annulee','echouee']
      when 'equipe_complete'       then array['prete','en_constitution','annulee','echouee']
      when 'prete'                 then array['en_cours','en_constitution','annulee','echouee']
      when 'en_cours'              then array['controle_qualite','litige','echouee']
      when 'controle_qualite'      then array['terminee','en_cours','litige']
      when 'terminee'              then array['paiement_prestataires','litige']
      when 'paiement_prestataires' then array['payee','litige']
      when 'payee'                 then array['litige']
      when 'annulee'               then array['remboursee']
      when 'echouee'               then array['remboursee']
      when 'litige'                then array['terminee','payee','remboursee']
      else array[]::text[]
    end)
  end;
$function$;

revoke all on function public.transition_mission_permise(text, text, text) from public, anon;
grant execute on function public.transition_mission_permise(text, text, text)
  to authenticated, service_role;

create or replace function public.missions_verifier_transition()
returns trigger
language plpgsql
set search_path = public
as $function$
begin
  if not public.transition_mission_permise(old.etat, new.etat, new.formule) then
    raise exception 'Transition de mission interdite : % vers % (formule %)',
      old.etat, new.etat, new.formule
      using errcode = 'check_violation';
  end if;

  -- Les dates de la mission se posent ici et nulle part ailleurs : une date
  -- écrite à la main finit toujours par contredire l'état.
  if new.etat = 'confirmee' and old.etat <> 'confirmee' then
    new.confirmee_le := now();
  end if;
  if new.etat = 'en_cours' and old.etat <> 'en_cours' then
    new.commencee_le := coalesce(new.commencee_le, now());
  end if;
  if new.etat = 'terminee' and old.etat <> 'terminee' then
    new.terminee_le := now();
  end if;
  if new.etat in ('annulee','echouee') and old.etat not in ('annulee','echouee') then
    new.annulee_le := now();
  end if;

  return new;
end;
$function$;

revoke all on function public.missions_verifier_transition() from public, anon, authenticated;

-- ─── 6. La formule est figée avec le prix ──────────────────────────────────
--
-- ⚠️ SANS ÇA, ON POURRAIT BASCULER UNE MISSION PAYÉE 131 € EN FORMULE ÉQUIPE
-- ET ENVOYER SEPT PERSONNES CHEZ QUELQU'UN QUI A ACHETÉ UNE LICENCE. La
-- formule fait partie de ce que le client a acheté, au même titre que le
-- montant : elle se fige au même moment, par la même serrure.
create or replace function public.missions_figer_le_prix()
returns trigger
language plpgsql
set search_path = public
as $function$
begin
  if old.etat in ('brouillon', 'prix_calcule') then
    return new;
  end if;

  if new.prix_cents is distinct from old.prix_cents
     or new.formule is distinct from old.formule
     or new.articles_retenus is distinct from old.articles_retenus
     or new.reglages_version is distinct from old.reglages_version
     or new.debut_prevu is distinct from old.debut_prevu
     or new.duree_prevue_minutes is distinct from old.duree_prevue_minutes
     or new.inventoristes is distinct from old.inventoristes then
    raise exception
      'Le prix et le dimensionnement d''une mission réservée ne se modifient pas (mission %, état %)',
      old.reference, old.etat
      using errcode = 'check_violation';
  end if;

  return new;
end;
$function$;

revoke all on function public.missions_figer_le_prix() from public, anon, authenticated;

-- ─── 7. Réserver, dans l'une ou l'autre formule ────────────────────────────
--
-- ⚠️ **C'EST LA FONCTION D'ORIGINE, PATCHÉE, PAS RÉÉCRITE.** Elle porte une
-- vingtaine de garde-fous payés un par un — une entreprise par compte, les
-- conditions en vigueur, l'engagement de l'étape 3, l'adresse refusée plutôt
-- que tronquée, la réservation en attente unique par magasin, le prix
-- recalculé et jamais relu. Les retaper pour ajouter une colonne, c'est les
-- perdre un par un sans s'en apercevoir. Cinq endroits changent, et cinq
-- seulement : la lecture de la formule, son passage à `prix_mission`, le
-- délai, la colonne à l'insertion, et ce qui sort.

create or replace function public.reserver_ma_mission(p_reponses jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
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
  v_formule text := coalesce(nullif(btrim(p_reponses ->> 'formule'), ''), 'equipe_quantinvo');
  v_logiciel boolean;
begin
  if v_uid is null then
    return jsonb_build_object('success', false, 'code', 'non_connecte');
  end if;

  -- ⚠️ LA FORMULE SE VALIDE ICI AUSSI, PAS SEULEMENT DANS `prix_mission`. Une
  -- valeur inconnue qui traverserait la validation du prix finirait dans la
  -- colonne `formule` et serait refusée par la contrainte — avec un message
  -- de base de données au lieu d'un refus lisible.
  if v_formule not in ('equipe_quantinvo', 'logiciel_seul') then
    return jsonb_build_object('success', false, 'code', 'formule');
  end if;
  v_logiciel := v_formule = 'logiciel_seul';

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
    v_formule);
  if not coalesce((v_prix ->> 'success')::boolean, false) then
    return v_prix;
  end if;
  -- ⚠️ LE DÉLAI DE 48 HEURES EXISTE POUR CONSTITUER UNE ÉQUIPE. Sans équipe,
  -- il n'empêche que de servir quelqu'un qui compte ce soir.
  if not v_logiciel and v_debut < now() + interval '48 hours' then
    return jsonb_build_object('success', false, 'code', 'trop_tot');
  end if;
  if v_logiciel and v_debut < now() then
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
    inventoristes, responsable,
    articles_retenus, prix_cents, cout_cents, calcul, reglages_version,
    annulation_gratuite_jusqu_au, etat, formule)
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
    v_debut - make_interval(mins => (v_prix ->> 'arrivee_minutes_avant')::integer),
    (v_prix ->> 'inventoristes')::integer,
    coalesce((v_prix ->> 'responsable')::boolean, false),
    (v_prix ->> 'articles_retenus')::integer,
    (v_prix ->> 'prix_cents')::integer,
    (v_prix ->> 'cout_cents')::integer,
    v_prix,
    (v_prix ->> 'version')::integer,
    v_debut - interval '3 days',
    'prix_calcule', v_formule)
  returning id, reference into v_id, v_ref;

  -- ⚠️ CE QUI SORT D'ICI EST CE QUE LE CLIENT PEUT VOIR, ET RIEN DE PLUS : ni
  -- `cout_cents`, ni la rémunération de l'équipe, ni la marge. La mission les
  -- porte ; le `grant select` colonne par colonne les retient.
  return jsonb_build_object(
    'success', true,
    'mission_id', v_id,
    'reference', v_ref,
    'formule', v_formule,
    'prix_cents', (v_prix ->> 'prix_cents')::integer,
    'inventoristes', (v_prix ->> 'inventoristes')::integer,
    'compteurs_attendus', (v_prix ->> 'compteurs_attendus')::integer,
    'appareils', (v_prix ->> 'appareils')::integer,
    'responsable', (v_prix ->> 'responsable')::boolean,
    'duree_minutes', (v_prix ->> 'duree_minutes')::integer,
    'entreprise_creee', v_neuve);
end;
$function$;

revoke all on function public.reserver_ma_mission(jsonb) from public, anon;
grant execute on function public.reserver_ma_mission(jsonb) to authenticated;

-- ─── 8. La console voit la formule ─────────────────────────────────────────
--
-- ⚠️ **TROIS FONCTIONS PATCHÉES, PAS RÉÉCRITES**, pour la même raison que la
-- réservation : elles portent des décisions — `admin_candidats_mission`
-- n'écarte personne, l'économie d'une mission se lit dans son `calcul` figé et
-- pas dans les réglages du jour — qu'un nouveau jet perdrait sans bruit.

create or replace function public.admin_missions(p_limite integer default 60)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  v jsonb;
begin
  if not public.is_admin() then
    return jsonb_build_object('success', false, 'error', 'Accès refusé');
  end if;

  select coalesce(jsonb_agg(x order by x.debut_prevu), '[]'::jsonb) into v
  from (
    select m.id, m.reference, m.magasin_nom, m.client_nom, m.ville,
           m.debut_prevu, m.duree_prevue_minutes, m.etat,
           m.formule,
           m.inventoristes, m.responsable,
           m.prix_cents, m.cout_cents,
           m.prix_cents - m.cout_cents as marge_cents,
           case when m.prix_cents = 0 then 0
                else round((m.prix_cents - m.cout_cents)::numeric / m.prix_cents, 4) end as marge,
           -- L'effectif VOULU et l'effectif ACQUIS : c'est la seule colonne que
           -- la maquette met en tête, parce que c'est elle qui décide s'il faut
           -- agir aujourd'hui.
           -- ⚠️ ZÉRO PLACE À POURVOIR SUR UNE MISSION SANS ÉQUIPE, et ce
           -- n'est pas cosmétique : la colonne « effectif » est celle qui
           -- décide s'il faut agir aujourd'hui. Afficher « 0/7 » sur une
           -- licence ferait courir quelqu'un après des inventoristes que
           -- personne n'attend.
           case when m.formule = 'logiciel_seul' then 0
                else m.inventoristes + case when m.responsable then 1 else 0 end end as places,
           (select count(*) from public.mission_assignments a
             where a.mission_id = m.id and a.etat = 'acceptee') as confirmes,
           (select count(*) from public.mission_assignments a
             where a.mission_id = m.id and a.etat = 'proposee') as en_attente,
           (select max(a.repondu_le) from public.mission_assignments a
             where a.mission_id = m.id and a.etat = 'retiree') as dernier_desistement
      from public.missions m
     where m.etat not in ('brouillon', 'annulee', 'remboursee')
     order by m.debut_prevu
     limit greatest(coalesce(p_limite, 60), 1)
  ) x;

  return jsonb_build_object('success', true, 'missions', v);
end;
$function$;

revoke all on function public.admin_missions(integer) from public, anon;
grant execute on function public.admin_missions(integer) to authenticated;

create or replace function public.admin_mission(p_mission uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  v_m record;
  v_equipe jsonb;
begin
  if not public.is_admin() then
    return jsonb_build_object('success', false, 'error', 'Accès refusé');
  end if;

  select * into v_m from public.missions where id = p_mission;
  if not found then
    return jsonb_build_object('success', false, 'error', 'Mission introuvable');
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'user_id', a.user_id,
           'prenom', coalesce(p.first_name, '—'),
           'nom', coalesce(p.last_name, ''),
           'role', a.role,
           'niveau', coalesce(pp.niveau, 'nouveau'),
           'etat', a.etat,
           'remuneration_cents', a.remuneration_cents,
           'propose_le', a.propose_le,
           'repondu_le', a.repondu_le,
           'pointe_le', a.pointe_le)
         order by a.role desc, a.propose_le), '[]'::jsonb)
    into v_equipe
    from public.mission_assignments a
    join public.profiles p on p.id = a.user_id
    left join public.provider_profiles pp on pp.user_id = a.user_id
   where a.mission_id = p_mission;

  return jsonb_build_object(
    'success', true,
    'mission', jsonb_build_object(
      'id', v_m.id, 'reference', v_m.reference, 'etat', v_m.etat,
      'formule', v_m.formule,
      'client_nom', v_m.client_nom, 'magasin_nom', v_m.magasin_nom,
      'adresse', v_m.adresse, 'code_postal', v_m.code_postal, 'ville', v_m.ville,
      'acces_sur_place', v_m.acces_sur_place,
      'secteur', v_m.secteur, 'code_barres', v_m.code_barres,
      'surface_vente_m2', v_m.surface_vente_m2, 'surface_reserve_m2', v_m.surface_reserve_m2,
      'articles_min', v_m.articles_min, 'articles_max', v_m.articles_max,
      'articles_retenus', v_m.articles_retenus,
      'debut_prevu', v_m.debut_prevu, 'arrivee_prevue', v_m.arrivee_prevue,
      'duree_prevue_minutes', v_m.duree_prevue_minutes,
      'inventoristes', v_m.inventoristes, 'responsable', v_m.responsable,
      'inventory_session_id', v_m.inventory_session_id,
      'annulation_gratuite_jusqu_au', v_m.annulation_gratuite_jusqu_au),
    -- ⚠️ L'économie de la mission : c'est CE bloc qui n'existe que pour la
    -- console. Il dit ce que le client paie, ce que l'équipe touche, ce que les
    -- frais prennent, et ce qui reste.
    'economie', jsonb_build_object(
      'prix_cents', v_m.prix_cents,
      'equipe_cents', coalesce((v_m.calcul ->> 'equipe_cents')::integer, 0),
      'licence_cents', coalesce((v_m.calcul ->> 'licence_cents')::integer, 0),
      'appareils', coalesce((v_m.calcul ->> 'appareils')::integer, 0),
      'frais_cents', coalesce((v_m.calcul ->> 'frais_cents')::integer, 0),
      'cout_cents', v_m.cout_cents,
      'marge_cents', v_m.prix_cents - v_m.cout_cents,
      'marge', case when v_m.prix_cents = 0 then 0
                    else round((v_m.prix_cents - v_m.cout_cents)::numeric / v_m.prix_cents, 4) end,
      'remuneration_inventoriste_cents',
        coalesce((v_m.calcul ->> 'remuneration_inventoriste_cents')::integer, 0),
      'remuneration_responsable_cents',
        coalesce((v_m.calcul ->> 'remuneration_responsable_cents')::integer, 0)),
    'equipe', v_equipe);
end;
$function$;

revoke all on function public.admin_mission(uuid) from public, anon;
grant execute on function public.admin_mission(uuid) to authenticated;

-- ⚠️ LA SIGNATURE CHANGE : l'ancienne à deux arguments est supprimée, sinon
-- les deux coexistent et un appel à deux arguments devient ambigu.
drop function if exists public.admin_apercu_prix(integer, text);

create or replace function public.admin_apercu_prix(
  p_articles integer default 20000, p_secteur text default 'textile',
  p_formule text default 'equipe_quantinvo')
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $function$
begin
  if not public.is_admin() then
    return jsonb_build_object('success', false, 'error', 'Accès refusé');
  end if;
  -- Un mardi à 20 h, dans trois semaines : hors coefficient horaire, hors
  -- dimanche, et au-delà du délai de constitution.
  return public.prix_mission(
    p_articles, p_secteur,
    date_trunc('week', now() + interval '3 weeks') + interval '1 day 20 hours',
    'tous', '75001', null, p_formule);
end;
$function$;

revoke all on function public.admin_apercu_prix(integer, text, text) from public, anon;
grant execute on function public.admin_apercu_prix(integer, text, text) to authenticated;

create or replace function public.admin_proposer_mission(
  p_mission uuid, p_user uuid, p_role text default 'inventoriste')
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_m record;
  v_places integer;
  v_pris integer;
  v_remu integer;
begin
  if not public.is_admin() then
    return jsonb_build_object('success', false, 'error', 'Accès refusé');
  end if;
  if p_role not in ('inventoriste', 'responsable') then
    return jsonb_build_object('success', false, 'error', 'Rôle inconnu');
  end if;

  select * into v_m from public.missions where id = p_mission;
  if not found then
    return jsonb_build_object('success', false, 'error', 'Mission introuvable');
  end if;

  -- ⚠️ **ON N'ENVOIE PERSONNE CHEZ QUELQU'UN QUI A ACHETÉ UNE LICENCE.** Le
  -- client en formule `logiciel_seul` a payé le logiciel pour un inventaire,
  -- pas une équipe : voir arriver six inventoristes chez lui serait une
  -- intrusion, et Quantinvo paierait des gens pour un travail que personne n'a
  -- commandé. La console masque déjà le bouton ; la règle est ici, parce qu'un
  -- écran ne garde rien.
  if v_m.formule = 'logiciel_seul' then
    return jsonb_build_object('success', false, 'code', 'formule',
      'error', 'Cette réservation est une licence : le client compte avec sa propre équipe.');
  end if;
  if v_m.etat not in ('confirmee', 'en_constitution', 'equipe_complete', 'prete') then
    return jsonb_build_object('success', false, 'code', 'pas_le_moment',
      'error', 'Une équipe se constitue entre la confirmation et le départ.');
  end if;
  if not exists (select 1 from public.provider_profiles where user_id = p_user) then
    return jsonb_build_object('success', false, 'error', 'Cette personne n''est pas inventoriste.');
  end if;

  -- ⚠️ UN SEUL RESPONSABLE, ET PAS PLUS DE PLACES QUE LE PRIX N'EN A VENDUES.
  -- Une place de trop, c'est une personne payée que le client n'a pas achetée ;
  -- et deux responsables sur place, c'est deux personnes qui attribuent les
  -- mêmes zones.
  if p_role = 'responsable' then
    if not v_m.responsable then
      return jsonb_build_object('success', false, 'code', 'pas_de_responsable',
        'error', 'Cette mission n''a pas de place de responsable.');
    end if;
    if exists (select 1 from public.mission_assignments
                where mission_id = p_mission and role = 'responsable'
                  and etat in ('proposee', 'acceptee')) then
      return jsonb_build_object('success', false, 'code', 'deja_un_responsable',
        'error', 'Cette mission a déjà un responsable.');
    end if;
    v_remu := coalesce((v_m.calcul ->> 'remuneration_responsable_cents')::integer, 0);
  else
    select count(*) into v_pris from public.mission_assignments
     where mission_id = p_mission and role = 'inventoriste'
       and etat in ('proposee', 'acceptee');
    v_places := v_m.inventoristes;
    if v_pris >= v_places then
      -- ⚠️ La variable est à la FIN. Une phrase qui commence par elle laisse
      -- « Les » comme fragment traduisible, et un préfixe aussi court
      -- attraperait n'importe quel autre message.
      return jsonb_build_object('success', false, 'code', 'complete',
        'error', 'Toutes les places d''inventoriste sont pourvues : ' || v_places || '.');
    end if;
    v_remu := coalesce((v_m.calcul ->> 'remuneration_inventoriste_cents')::integer, 0);
  end if;

  insert into public.mission_assignments (mission_id, user_id, role, etat, remuneration_cents)
  values (p_mission, p_user, p_role, 'proposee', v_remu)
  on conflict (mission_id, user_id) do update
    set role = excluded.role, etat = 'proposee',
        remuneration_cents = excluded.remuneration_cents,
        propose_le = now(), repondu_le = null, motif = null;

  if v_m.etat = 'confirmee' then
    update public.missions set etat = 'en_constitution' where id = p_mission;
  end if;

  perform public.log_admin_action(
    'mission_proposee', 'mission', p_mission::text, v_m.reference,
    jsonb_build_object('user_id', p_user, 'role', p_role, 'remuneration_cents', v_remu));

  return jsonb_build_object('success', true, 'remuneration_cents', v_remu);
end;
$function$;

revoke all on function public.admin_proposer_mission(uuid, uuid, text) from public, anon;
grant execute on function public.admin_proposer_mission(uuid, uuid, text) to authenticated;

-- ─── 9. La console pose aussi les réglages du logiciel seul ────────────────

create or replace function public.admin_poser_reglages_prix(p_valeurs jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_actuelle record;
  v_version integer;
  v_coef record;
begin
  if not public.is_admin() then
    return jsonb_build_object('success', false, 'error', 'Accès refusé');
  end if;

  select * into v_actuelle from public.reglages_prix where en_vigueur;
  if not found then
    return jsonb_build_object('success', false, 'error', 'Aucune version en vigueur');
  end if;

  select coalesce(max(version), 0) + 1 into v_version from public.reglages_prix;

  -- ⚠️ ON RETIRE L'ANCIENNE AVANT DE POSER LA NEUVE. L'index unique partiel
  -- refuse deux versions en vigueur, et il a raison : deux versions actives,
  -- ce serait deux prix pour le même magasin le même soir.
  update public.reglages_prix set en_vigueur = false where version = v_actuelle.version;

  -- Ce qui n'est pas fourni est repris de la version en cours : une console qui
  -- n'envoie qu'un champ ne doit pas remettre les autres à zéro.
  insert into public.reglages_prix (
    version, taux_inventoriste_cents, taux_responsable_cents, productivite,
    duree_cible_minutes, frais_fixes_cents, responsable_des_n, arrondi_minutes,
    marge_cible, marge_minimum,
    tarif_appareil_cents, frais_fixes_logiciel_cents,
    en_vigueur, pose_par, note)
  values (
    v_version,
    coalesce((p_valeurs ->> 'taux_inventoriste_cents')::integer, v_actuelle.taux_inventoriste_cents),
    coalesce((p_valeurs ->> 'taux_responsable_cents')::integer, v_actuelle.taux_responsable_cents),
    coalesce((p_valeurs ->> 'productivite')::integer, v_actuelle.productivite),
    coalesce((p_valeurs ->> 'duree_cible_minutes')::integer, v_actuelle.duree_cible_minutes),
    coalesce((p_valeurs ->> 'frais_fixes_cents')::integer, v_actuelle.frais_fixes_cents),
    coalesce((p_valeurs ->> 'responsable_des_n')::integer, v_actuelle.responsable_des_n),
    coalesce((p_valeurs ->> 'arrondi_minutes')::integer, v_actuelle.arrondi_minutes),
    coalesce((p_valeurs ->> 'marge_cible')::numeric, v_actuelle.marge_cible),
    coalesce((p_valeurs ->> 'marge_minimum')::numeric, v_actuelle.marge_minimum),
    -- ⚠️ LES DEUX RÉGLAGES DU LOGICIEL SEUL SUIVENT LA MÊME RÈGLE QUE LES
    -- AUTRES : ce qui n'est pas fourni est repris de la version en cours. Les
    -- oublier ici ferait qu'une version posée pour changer un taux horaire
    -- remettrait le tarif appareil à son défaut, sans que personne l'ait
    -- demandé — et une mission réservée après coup partirait au mauvais prix.
    coalesce((p_valeurs ->> 'tarif_appareil_cents')::integer, v_actuelle.tarif_appareil_cents),
    coalesce((p_valeurs ->> 'frais_fixes_logiciel_cents')::integer,
             v_actuelle.frais_fixes_logiciel_cents),
    true, auth.uid(), nullif(btrim(coalesce(p_valeurs ->> 'note', '')), ''));

  -- Les coefficients et le barème d'annulation suivent la version : sans cette
  -- recopie, une version neuve n'aurait aucun coefficient et le prix changerait
  -- sans que personne ne l'ait demandé.
  insert into public.coefficients_prix (version, famille, cle, valeur)
    select v_version, c.famille, c.cle,
           coalesce((p_valeurs -> 'coefficients' -> c.famille ->> c.cle)::numeric, c.valeur)
      from public.coefficients_prix c where c.version = v_actuelle.version;

  insert into public.reglages_annulation (version, heures_avant, part_client, part_equipe)
    select v_version, a.heures_avant, a.part_client, a.part_equipe
      from public.reglages_annulation a where a.version = v_actuelle.version;

  perform public.log_admin_action(
    'reglages_prix_poses', 'reglages_prix', v_version::text,
    'version ' || v_version,
    jsonb_build_object('depuis', v_actuelle.version, 'valeurs', p_valeurs));

  return jsonb_build_object('success', true, 'version', v_version);
end;
$function$;

revoke all on function public.admin_poser_reglages_prix(jsonb) from public, anon;
grant execute on function public.admin_poser_reglages_prix(jsonb) to authenticated;
