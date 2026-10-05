-- ⚠️⚠️ LA LOCATION COÛTE 10 % DE PLUS QUE LE MOIS D'ABONNEMENT (Julien, 5 octobre 2026).
--
-- En relisant la grille : « 129 € pour 10/20 000 pièces, 6 appareils, ça semble
-- peu crédible non ? ». Oui — et le défaut était plus grave que l'apparence.
--
-- **La location cassait l'abonnement.** Six appareils, c'est Advanced : 310 €
-- par mois, 3 300 € par an. On vendait une semaine du MÊME produit — zones,
-- balises, audit, rapport — à 129 €, soit 2,4 fois moins qu'un seul mois. Deux
-- inventaires par an : 258 € au lieu de 3 300 €. Il aurait fallu vingt-six
-- réservations dans l'année pour que s'abonner redevienne intéressant.
--
-- Sa règle, validée : **la semaine vaut le mois + 10 %**, interpolée entre les
-- trois paliers pour ne pas laisser un mur à chaque changement de palier.
--
-- ⚠️ **ET UN TARIF D'ENTRÉE JUSQU'À 10 000 PIÈCES** (son arbitrage, après
-- mesure). La règle sèche aurait donné 341 € dès 5 000 pièces, contre 589 €
-- pour qu'une équipe entière vienne tout faire : 58 % du service complet, pour
-- un logiciel que le client exploite lui-même. Au-dessus, le rapport redevient
-- tenable — 341 contre 949, soit 36 % — et le palier plein s'applique.
--
-- Ce que ça donne :
--
--   | pièces          | appareils | location | équipe  | part |
--   |-----------------|-----------|----------|---------|------|
--   | < 5 000         | 1–2       |     98 € |       — |    — |
--   | 5 000 – 10 000  | 3         |    111 € |   589 € |  19 % |
--   | 10 000 – 50 000 | 6–15      |    341 € |   949 € |  36 % |
--   | 50 000 et plus  | 29+       |    979 € | 3 000 € |  33 % |
--
-- ⚠️ **UNE NOUVELLE VERSION, PAS UNE CORRECTION DE LA 2.** `missions` fige
-- `reglages_version` à la réservation, et `missions_figer_le_prix` interdit d'y
-- toucher : une réservation déjà prise doit continuer de se lire avec la grille
-- qui l'a chiffrée. La version 2 reste donc en base, hors vigueur.
--
-- ⚠️ `prix_mission` est la définition qui tourne, à deux endroits près : même
-- `md5(prosrc)` sur la base d'essai que la copie du dépôt avant patch
-- (`605a735ccc9584264334d40d4cbd01d6`).

-- ── 1. Le réglage : la part du mois que coûte une semaine ───────────────────
alter table public.reglages_prix
  add column if not exists part_du_mois numeric not null default 1.10;

alter table public.reglages_prix
  drop constraint if exists reglages_prix_part_du_mois_check;
alter table public.reglages_prix
  add constraint reglages_prix_part_du_mois_check check (part_du_mois > 0 and part_du_mois <= 5);

comment on column public.reglages_prix.part_du_mois is
  'Ce qu''une semaine de location coûte, rapporté au mois d''abonnement qui couvre '
  'les mêmes appareils. 1.10 = dix pour cent de plus que le mois, pour que louer '
  'ne soit jamais moins cher que s''abonner quand on en a l''usage toute l''année.';

-- ⚠️ La version 2 valait la moitié d'un mois : on l'écrit, pour qu'une
-- réservation figée sur elle reste lisible telle qu'elle a été vendue.
update public.reglages_prix set part_du_mois = 0.50 where version <= 2;

-- ── 2. La version 3 ─────────────────────────────────────────────────────────
-- Tout est repris de la version 2, sauf `part_du_mois`. Les réglages de la
-- formule équipe ne bougent pas : elle est fermée, et on ne re-chiffre pas une
-- formule fermée (même raison qu'au 28 septembre).
insert into public.reglages_prix (
  version, taux_inventoriste_cents, taux_responsable_cents, productivite,
  duree_cible_minutes, frais_fixes_cents, responsable_des_n, arrondi_minutes,
  marge_cible, marge_minimum, tarif_appareil_cents, frais_fixes_logiciel_cents,
  supplement_appareil_cents, tolerance_pct, fenetre_jours, soiree_minutes,
  productivite_ponctuel, part_du_mois, en_vigueur, note)
values (
  -- ⚠️ EN CLAIR, PAS `select … from version 2`. Une migration qui recopie une
  -- version par requête ne dit pas ce qu'elle pose : ni le lecteur ni la garde
  -- (`web/tests/prix-on-demand.test.ts`, qui lit cet `insert`) ne peuvent le
  -- savoir sans jouer la migration. Les valeurs de l'équipe sont celles de la
  -- version 2, à l'identique.
  3, 2000, 2800, 800,
  270, 4600, 3, 30,
  0.250, 0.220, 1600, 1900,
  2500, 10, 7, 420, 500,
  1.10, false,
  'Le prix de la location suit l''abonnement : une semaine vaut le mois qui couvre les mêmes appareils, majoré de dix pour cent, en pente entre les paliers. La version 2 le plafonnait à la MOITIÉ d''un mois — louer revenait alors moins cher que s''abonner, et le mangeait.')
on conflict (version) do nothing;

-- ⚠️ Les tranches suivent, et leur `prix_cents` ne fait plus le prix : il dit
-- ce que coûte cette tranche AU MINIMUM D'APPAREILS qu'elle impose. La colonne
-- reste vraie au lieu de rester vieille — c'est elle que lit une vitrine qui
-- veut écrire « à partir de ».
insert into public.tranches_prix (version, cle, nom, plafond_articles, prix_cents) values
  (3, 'a', 'Moins de 2 000 pièces',      2000,   9800),
  (3, 'b', '2 000 à 5 000 pièces',       5000,   9800),
  (3, 'c', '5 000 à 10 000 pièces',     10000,  11100),
  (3, 'd', '10 000 à 20 000 pièces',    20000,  34100),
  (3, 'e', '20 000 à 30 000 pièces',    30000,  34100),
  (3, 'f', '30 000 à 50 000 pièces',    50000,  34100),
  (3, 'g', '50 000 à 100 000 pièces',  100000,  97900),
  (3, 'h', '100 000 à 150 000 pièces', 150000,  97900)
on conflict (version, cle) do nothing;

insert into public.coefficients_prix (version, famille, cle, valeur)
select 3, famille, cle, valeur from public.coefficients_prix where version = 2
on conflict (version, famille, cle) do nothing;

-- ⚠️ Une seule en vigueur : la contrainte `reglages_prix_une_seule_en_vigueur`
-- refuserait les deux.
update public.reglages_prix set en_vigueur = false where version = 2;
update public.reglages_prix set en_vigueur = true  where version = 3;

-- ── 3. La fonction ──────────────────────────────────────────────────────────
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

    -- ⚠️⚠️ **LE PRIX SUIT L'ABONNEMENT, EN PENTE** (Julien, 5 octobre 2026).
    --
    -- Il valait la MOITIÉ du mois qui couvre ces appareils. Conséquence, vue en
    -- relisant la grille avec lui : une semaine de location coûtait 2,4 fois
    -- MOINS qu'un mois d'abonnement du même produit. Un magasin qui fait deux
    -- inventaires par an payait 258 € au lieu de 3 300 € — il aurait fallu
    -- qu'il en fasse vingt-six pour que s'abonner devienne intéressant. La
    -- location mangeait l'abonnement, et les deux pages sont sur le même site.
    --
    -- Sa règle : **la semaine coûte 10 % de plus que le mois**. `part_du_mois`.
    --
    -- ⚠️ **AVEC UN TARIF D'ENTRÉE JUSQU'À TROIS APPAREILS**, soit 10 000 pièces,
    -- le volume d'un petit magasin. Le palier plein dès le premier appareil
    -- aurait donné 341 € là où envoyer une ÉQUIPE ENTIÈRE en coûte 589 : 58 %
    -- du service rendu complet, pour un logiciel que le client exploite
    -- lui-même. Il se serait dit « pour 250 € de plus, ils viennent le faire ».
    -- Au-dessus de 10 000 pièces le rapport redevient tenable — 341 contre 949,
    -- soit 36 % — et le palier plein s'applique.
    --
    -- Le point d'entrée n'est pas inventé : il est sur la droite qui joint
    -- Essential à Advanced.
    --
    -- ⚠️ `t.prix_cents` ne fait PLUS le prix : la tranche garde son nom, son
    -- plafond d'articles (au-delà, `hors_grille`) et le minimum d'appareils
    -- qu'elle impose. `supplement_appareil_cents` ne sert plus non plus.
    v_mois := case
      when v_appareils <= 2   then 8900
      when v_appareils <= 3   then round(8900 + (31000 - 8900) * (v_appareils - 2) / 18.0)
      when v_appareils <= 20  then 31000
      when v_appareils <= 100 then 89000
      -- Au-delà du dernier palier, l'abonnement avance de 64 € par dix
      -- appareils : la location suit, majorée comme le reste.
      else 89000 + 6400 * ceil((v_appareils - 100) / 10.0)
    end::integer;
    -- Arrondi à l'euro : un prix public ne se lit pas en centimes.
    v_prix := round(v_mois * r.part_du_mois / 100.0)::integer * 100;
    v_plafond := v_mois;

    v_equipe := 0;
    v_frais := r.frais_fixes_logiciel_cents;
    v_cout := v_frais;
    v_detail := v_detail || jsonb_build_object(
      'tranche', t.cle, 'tranche_nom', t.nom,
      'appareils_compris', v_minimum,
      'mois_couvrant_cents', v_plafond,
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

-- `create or replace` rend EXECUTE à PUBLIC : on repose les droits.
--
-- ⚠️⚠️ **PAS `authenticated`**, et une garde l'a rattrapé le jour même : la
-- première version de cette migration écrivait `from public, anon` puis
-- `to authenticated, service_role`. `prix_mission` rend `cout_cents`,
-- `marge_cents` et les rémunérations — un client qui l'appellerait saurait au
-- centime ce que Quantinvo gagne sur son inventaire. Le navigateur passe par
-- `prix_ferme_mission`, qui ne rend que ce qui le regarde.
revoke all on function public.prix_mission(integer, text, timestamptz, text, text, integer, text, integer)
  from public, anon, authenticated;
grant execute on function public.prix_mission(integer, text, timestamptz, text, text, integer, text, integer)
  to service_role;
