-- On-Demand — la grille à deux axes, et la règle des deux inventaires.
--
-- ⚠️⚠️ **LE PRIX NE SE DÉDUIT PLUS DU TRAVAIL, IL VIENT D'UNE TRANCHE.** C'est
-- le changement de fond du 28 septembre 2026, et il a trois causes, mesurées :
--
--   · le marché facture À LA PIÈCE — 220 000 unités ≈ 22 000 € chez un
--     prestataire, quelle que soit la durée. Soit 0,10 € la pièce ;
--   · le modèle « coût + marge » faisait BAISSER le prix à la pièce quand le
--     volume montait (0,064 € à 2 000 articles, 0,035 € à 220 000). Plus le
--     client était gros, moins on gagnait par unité. Aucun réglage ne corrige
--     ça : il fallait changer la formule ;
--   · la productivité de 800 articles/heure violait la règle que le document
--     de conception pose lui-même — rester SOUS les bons inventoristes, dont
--     le score tourne à 814. Le repère de Julien est 500.
--
-- ⚠️ **L'ANCRE EST LA RÈGLE DES DEUX INVENTAIRES** (Julien, 28 septembre 2026) :
-- « comme au cinéma, au-delà de deux séances par mois l'abonnement revient
-- moins cher que la place ». Donc, pour chaque tranche, DEUX réservations
-- restent sous le mois d'abonnement et TROIS le dépassent. L'abonnement
-- mensuel étant résiliable à tout moment, c'est la seule ancre qui tienne :
-- sans elle, un ponctuel plus cher que la moitié d'un mois n'a aucun acheteur.
-- Le taux à la pièce n'est plus choisi, il en découle — et il sort dégressif
-- tout seul, de 0,0195 € sur une boutique à 0,0030 € sur un hypermarché.
--
-- ⚠️ **LA TAILLE IMPOSE UN MINIMUM D'APPAREILS**, sans quoi la règle se
-- retourne : déclarer 100 000 pièces sur 2 appareils ramènerait le mois de
-- référence à Essential, donc le prix à 44 €. Défaut trouvé par Julien en
-- manipulant la maquette. Physiquement, deux appareils ne comptent pas
-- 100 000 pièces en sept jours — à 500 à l'heure, ils en font 70 000 au plus.
--
-- ⚠️ **RIEN DE LA FORMULE ÉQUIPE N'EST RETIRÉ ICI.** Elle est fermée côté site
-- par `FORMULE_EQUIPE_OUVERTE`, pas en base : ses colonnes, ses coefficients et
-- ses zones restent, et la version 1 des réglages reste lisible. Elle rouvrira.
--
-- ⚠️ Cette migration NE TOUCHE À AUCUN OBJET DE QUANTINVO OS (règle du
-- 20 septembre 2026, l'app étant publiée) : elle ajoute une table, ajoute des
-- colonnes à une table On-Demand, et remplace trois fonctions On-Demand.

begin;

-- ── 1. Les réglages gagnent ce que la grille demande ────────────────────────
alter table public.reglages_prix
  add column if not exists supplement_appareil_cents integer not null default 2500
    check (supplement_appareil_cents >= 0),
  add column if not exists tolerance_pct integer not null default 10
    check (tolerance_pct between 0 and 100),
  add column if not exists fenetre_jours integer not null default 7
    check (fenetre_jours between 1 and 31),
  add column if not exists soiree_minutes integer not null default 420
    check (soiree_minutes between 60 and 720),
  add column if not exists productivite_ponctuel integer not null default 500
    check (productivite_ponctuel between 50 and 5000);

comment on column public.reglages_prix.supplement_appareil_cents is
  'Ce que coûte un appareil AU-DELÀ du minimum qu''impose la taille. En deçà, ils sont compris dans la tranche.';
comment on column public.reglages_prix.tolerance_pct is
  'L''écart toléré entre la tranche déclarée et le total réellement compté, DANS LES DEUX SENS. Au-delà, la réservation est réajustée à la clôture. Quantinvo est le seul à connaître le compte réel, puisque c''est son outil qui a compté : la règle est vérifiable des deux côtés.';
comment on column public.reglages_prix.fenetre_jours is
  'La licence ponctuelle s''ouvre le jour choisi et court ce nombre de jours. Sept : « l''inventaire peut durer assez longtemps, on ne compte en général pas plus longtemps » (Julien, 28 septembre 2026).';
comment on column public.reglages_prix.soiree_minutes is
  'La durée sur laquelle on dimensionne le minimum d''appareils. 420 = sept heures.';
comment on column public.reglages_prix.productivite_ponctuel is
  '⚠️ UNE SECONDE PRODUCTIVITÉ, ET C''EST VOULU. `productivite` (800) sert à la formule ÉQUIPE, dont les exemples validés vivent dans `docs/entreprise/on-demand/02-le-prix.md` : cette formule est FERMÉE, et re-chiffrer une formule fermée sans la revalider est pire que la laisser telle quelle. 500 est le repère de Julien (28 septembre 2026) pour un inventoriste moyen, et c''est lui qui dimensionne le ponctuel.';

-- ── 2. Les tranches, qui portent le prix ────────────────────────────────────
create table if not exists public.tranches_prix (
  version          integer not null references public.reglages_prix(version) on delete cascade,
  cle              text    not null check (cle ~ '^[a-z]$'),
  nom              text    not null check (btrim(nom) <> ''),
  plafond_articles integer not null check (plafond_articles > 0),
  prix_cents       integer not null check (prix_cents > 0),
  primary key (version, cle)
);

-- ⚠️ DEPUIS LE 30 OCTOBRE 2026, UNE TABLE NEUVE PORTE SES DROITS : Supabase
-- n'accorde plus l'accès de l'API toute seule. `grant` ouvre la porte, RLS trie
-- les lignes — les deux, toujours.
alter table public.tranches_prix enable row level security;
revoke all on table public.tranches_prix from public, anon, authenticated;
grant select on table public.tranches_prix to authenticated;
grant select, insert, update, delete on table public.tranches_prix to service_role;

drop policy if exists tranches_prix_lire on public.tranches_prix;
create policy tranches_prix_lire on public.tranches_prix
  for select to authenticated
  using (exists (
    select 1 from public.reglages_prix r
     where r.version = tranches_prix.version and r.en_vigueur
  ));

comment on table public.tranches_prix is
  'Le prix d''un inventaire ponctuel, par tranche de pièces. Le haut de la tranche fait foi — jamais le milieu : un prix ferme se calcule sur le cas le plus lourd que le client a lui-même annoncé.';

-- ── 3. La version 2, et ses huit tranches ───────────────────────────────────
-- Les colonnes de la formule équipe sont reprises de la version 1 : elle est
-- fermée, pas supprimée, et ses réglages doivent rester cohérents.
-- ⚠️ LES VALEURS SONT ÉCRITES EN CLAIR, PAS REPRISES PAR `select`. La garde
-- `web/tests/prix-on-demand.test.ts` les LIT ici pour les comparer à la copie
-- d'affichage : un `insert … select` les lui cacherait, et elle passerait au
-- vert sans rien vérifier. Les colonnes de la formule équipe reprennent les
-- valeurs de la version 1 — elle est fermée côté site, pas supprimée.
insert into public.reglages_prix (
  version, taux_inventoriste_cents, taux_responsable_cents, productivite,
  duree_cible_minutes, frais_fixes_cents, responsable_des_n, arrondi_minutes,
  marge_cible, marge_minimum, tarif_appareil_cents, frais_fixes_logiciel_cents,
  supplement_appareil_cents, tolerance_pct, fenetre_jours, soiree_minutes,
  productivite_ponctuel, en_vigueur, note)
values (
  2, 2000, 2800, 800,
  270, 4600, 3, 30,
  0.250, 0.220, 1600, 1900,
  2500, 10, 7, 420, 500,
  false,
  'La grille à deux axes. Le prix du ponctuel vient désormais de `tranches_prix`, plus du coût majoré, et il se dimensionne à 500 articles/heure sur sept heures. Les réglages de la formule équipe sont ceux de la version 1, à l''identique : elle est fermée, et on ne re-chiffre pas une formule fermée.')
on conflict (version) do nothing;

insert into public.tranches_prix (version, cle, nom, plafond_articles, prix_cents) values
  (2, 'a', 'Moins de 2 000 pièces',      2000,   3900),
  (2, 'b', '2 000 à 5 000 pièces',       5000,   4400),
  (2, 'c', '5 000 à 10 000 pièces',     10000,  10900),
  (2, 'd', '10 000 à 20 000 pièces',    20000,  12900),
  (2, 'e', '20 000 à 30 000 pièces',    30000,  14500),
  (2, 'f', '30 000 à 50 000 pièces',    50000,  15500),
  (2, 'g', '50 000 à 100 000 pièces',  100000,  34900),
  (2, 'h', '100 000 à 150 000 pièces', 150000,  44500)
on conflict (version, cle) do nothing;

-- Les coefficients de la version 1 suivent : ils ne servent qu'à la formule
-- équipe, mais la fonction les lit par version et doit les trouver.
insert into public.coefficients_prix (version, famille, cle, valeur)
select 2, famille, cle, valeur from public.coefficients_prix where version = 1
on conflict do nothing;

-- ⚠️ La bascule est le DERNIER geste, et elle passe par l'index unique
-- `reglages_prix_une_seule_en_vigueur` : deux versions actives donneraient
-- deux prix pour le même magasin le même soir.
update public.reglages_prix set en_vigueur = false where version = 1;
update public.reglages_prix set en_vigueur = true  where version = 2;

-- ── 4. Le prix, refait ──────────────────────────────────────────────────────
-- ⚠️ La signature change : `p_appareils` entre. Donc `drop` de l'ancienne, et
-- pas `create or replace` — deux surcharges se disputeraient les appels à
-- sept arguments.
drop function if exists public.prix_mission(integer, text, timestamptz, text, text, integer, text);

create or replace function public.prix_mission(
  p_articles_max integer,
  p_secteur      text,
  p_debut        timestamptz,
  p_code_barres  text default 'tous',
  p_code_postal  text default null,
  p_version      integer default null,
  p_formule      text default 'logiciel_seul',
  p_appareils    integer default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  r            record;
  t            record;
  v_zone       record;
  v_formule    text := coalesce(nullif(btrim(p_formule), ''), 'logiciel_seul');
  v_logiciel   boolean;
  v_heures     numeric;
  v_inv        integer;
  v_resp       boolean;
  v_minimum    integer;
  v_appareils  integer;
  v_minutes    integer;
  v_heures_fac numeric;
  v_equipe     integer;
  v_frais      integer;
  v_cout       integer;
  v_coef       numeric := 1.00;
  v_detail     jsonb := '{}'::jsonb;
  v_c          numeric;
  v_mois       integer;
  v_plafond    integer;
  v_prix       integer;
  v_marge      numeric;
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

  -- Hors zone : seulement quand une ÉQUIPE se déplace. Le logiciel se livre
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

  -- Le dimensionnement, commun aux deux formules : ce qu'il faut pour tenir
  -- en une soirée, à la productivité retenue.
  v_heures := p_articles_max::numeric / r.productivite;
  -- ⚠️ Le ponctuel se dimensionne sur SA productivité (500), pas sur celle de
  -- la planification d'équipe (800) : voir le commentaire de la colonne.
  v_minimum := greatest(1, ceil(
    (p_articles_max::numeric / r.productivite_ponctuel) / (r.soiree_minutes::numeric / 60)
  )::integer);

  if v_logiciel then
    -- ⚠️ LE CLIENT NE PEUT PAS DESCENDRE SOUS LE MINIMUM. C'est ce qui
    -- empêche « 100 000 pièces sur 2 appareils » de ramener le mois de
    -- référence — donc le prix — à celui d'Essential.
    v_appareils := greatest(v_minimum, coalesce(p_appareils, v_minimum));
    v_minutes := ceil((p_articles_max::numeric / (r.productivite_ponctuel * v_appareils)) * 60
                        / r.arrondi_minutes)::integer * r.arrondi_minutes;
    v_inv       := v_appareils;
    v_resp := false;

    select * into t from public.tranches_prix
     where version = r.version and plafond_articles >= p_articles_max
     order by plafond_articles asc limit 1;
    if not found then
      -- Au-dessus de la dernière tranche, il n'y a PAS de prix plus gros :
      -- c'est un inventaire qui se parle, pas qui se réserve en deux clics.
      return jsonb_build_object('success', false, 'code', 'hors_grille');
    end if;

    -- Le mois d'abonnement qui couvre ces appareils, et sa moitié : deux
    -- réservations restent dessous, la troisième passe au-dessus.
    v_mois := case when v_appareils <= 2 then 8900
                   when v_appareils <= 20 then 31000
                   else 89000 end;
    v_plafond := floor(v_mois / 2.0)::integer;
    v_prix := least(
      t.prix_cents + r.supplement_appareil_cents * greatest(0, v_appareils - v_minimum),
      v_plafond);

    v_equipe := 0;
    v_frais := r.frais_fixes_logiciel_cents;
    v_cout := v_frais;
    v_detail := v_detail || jsonb_build_object(
      'tranche', t.cle, 'tranche_nom', t.nom,
      'appareils_compris', v_minimum,
      'plafond_cents', v_plafond,
      'tolerance_pct', r.tolerance_pct,
      'fenetre_jours', r.fenetre_jours);
  else
    -- La formule équipe, inchangée : elle est fermée côté site, pas ici.
    v_inv := ceil(v_heures / (r.duree_cible_minutes::numeric / 60))::integer;
    v_minutes := ceil((v_heures / v_inv) * 60 / r.arrondi_minutes)::integer * r.arrondi_minutes;
    v_resp := v_inv >= r.responsable_des_n;
    v_appareils := v_inv + case when v_resp then 1 else 0 end;
    v_heures_fac := v_minutes::numeric / 60;
    v_equipe := round(
      (v_inv * r.taux_inventoriste_cents
       + case when v_resp then r.taux_responsable_cents else 0 end) * v_heures_fac
    )::integer;
    v_frais := r.frais_fixes_cents;
    v_cout := v_equipe + v_frais;

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
    if coalesce(p_code_barres, 'tous') = 'partiel' then
      select valeur into v_c from public.coefficients_prix
       where version = r.version and famille = 'code_barres' and cle = 'partiel';
      if v_c is not null then
        v_coef := v_coef * v_c;
        v_detail := v_detail || jsonb_build_object('code_barres', v_c);
      end if;
    end if;

    v_prix := round(v_cout / (1 - r.marge_cible) * v_coef / 100)::integer * 100;
  end if;

  v_marge := case when v_prix = 0 then 0 else (v_prix - v_cout)::numeric / v_prix end;
  if not v_logiciel and v_marge < r.marge_minimum then
    return jsonb_build_object('success', false, 'code', 'marge_insuffisante');
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
    'responsable', v_resp,
    'duree_minutes', v_minutes,
    'equipe_cents', v_equipe,
    'cout_cents', v_cout,
    'prix_cents', v_prix,
    'marge_cents', v_prix - v_cout,
    'marge', round(v_marge, 4),
    'coefficient', round(v_coef, 4),
    'detail', v_detail);
end;
$function$;

revoke all on function public.prix_mission(integer, text, timestamptz, text, text, integer, text, integer)
  from public, anon, authenticated;
-- ⚠️⚠️ **PAS `authenticated`.** `prix_mission` rend `cout_cents`,
-- `marge_cents` et les rémunérations : un client qui l'appellerait saurait au
-- centime ce que Quantinvo gagne sur son inventaire. Le tunnel passe par
-- `prix_ferme_mission`, qui ne rend que le prix. Garde :
-- `web/tests/prix-on-demand.test.ts`, « n'est pas appelable depuis un
-- navigateur de client » — elle a mordu sur cette migration même.
grant execute on function public.prix_mission(integer, text, timestamptz, text, text, integer, text, integer)
  to service_role;

-- ── 5. Les deux appelants passent le nombre d'appareils ─────────────────────
-- ⚠️ Leur SIGNATURE ne change pas : ils reçoivent un `jsonb`, donc le nombre
-- d'appareils y entre comme les autres réponses. Seul l'appel change.

create or replace function public.prix_ferme_mission(p_reponses jsonb)
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
    v_formule,
    (p_reponses->>'appareils')::integer);

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
    inventoristes, responsable,
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
commit;
