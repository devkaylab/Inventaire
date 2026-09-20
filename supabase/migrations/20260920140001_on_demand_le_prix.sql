-- On-Demand : le prix, en base et verrouillé (20 septembre 2026)
--
-- Conception : docs/entreprise/on-demand/02-le-prix.md
-- Maquette   : https://claude.ai/artifact/BSqAQUPZ7tnjAfdswK35MV (Prix, Admin-Prix)
--
-- ⚠️ LE CALCUL VIT ICI ET NULLE PART AILLEURS. Même règle que `prix_offre` et
-- `finaliser_inscription` : « laisser le client porter un montant, c'est le
-- laisser réserver à un centime » (`docs/notes/074`). Le navigateur affiche ce
-- que le serveur a calculé, et la mission garde la chaîne complète.
--
-- ⚠️ ET LE CALCUL EST DÉTERMINISTE À VERSION DE RÉGLAGES FIXÉE. C'est ce qui
-- permet au visiteur de voir son prix AVANT d'avoir un compte sans qu'on ait à
-- écrire une mission en base — donc sans ouvrir une cinquième fonction à
-- `anon`. Le devis est recalculé à la création de la mission, à partir des
-- mêmes réponses et de la même version : même résultat, aucune porte de plus.

-- ─── 1. Les réglages ───────────────────────────────────────────────────────
--
-- ⚠️ CES VALEURS VIVENT EN BASE, PAS DANS LE CODE. Un prix est une décision
-- commerciale : il ne doit pas demander un déploiement. Et une version ne se
-- modifie jamais — on en pose une neuve, ce qui laisse lisible le prix de
-- chaque mission déjà vendue.
create table if not exists public.reglages_prix (
  version integer primary key,

  taux_inventoriste_cents integer not null check (taux_inventoriste_cents > 0),
  taux_responsable_cents  integer not null check (taux_responsable_cents > 0),
  productivite            integer not null check (productivite between 50 and 5000),
  duree_cible_minutes     integer not null check (duree_cible_minutes between 60 and 720),
  frais_fixes_cents       integer not null check (frais_fixes_cents >= 0),
  responsable_des_n       integer not null default 3 check (responsable_des_n >= 1),
  arrondi_minutes         integer not null default 30 check (arrondi_minutes between 1 and 60),

  marge_cible   numeric(4,3) not null check (marge_cible > 0 and marge_cible < 1),
  marge_minimum numeric(4,3) not null check (marge_minimum > 0 and marge_minimum < 1),

  en_vigueur boolean not null default false,
  pose_le    timestamptz not null default now(),
  pose_par   uuid references auth.users(id) on delete set null,
  note       text,

  constraint reglages_marge_coherente check (marge_minimum <= marge_cible)
);

-- Une seule version en vigueur à la fois. La contrainte est en base : deux
-- versions actives donneraient deux prix pour le même magasin le même soir.
create unique index if not exists reglages_prix_une_seule_en_vigueur
  on public.reglages_prix (en_vigueur) where en_vigueur;

alter table public.reglages_prix enable row level security;
revoke all on table public.reglages_prix from public, anon, authenticated;
grant select on table public.reglages_prix to authenticated;   -- filtré par la policy

comment on table public.reglages_prix is
  'Les réglages du moteur de prix, une ligne par version. Une version ne se modifie pas : on en pose une neuve, et les missions vendues gardent la leur.';

-- ⚠️ CETTE TABLE NE SE LIT PAS DEPUIS UN NAVIGATEUR DE CLIENT. Elle contient
-- le taux horaire qu'on verse et la marge qu'on prend : un client qui la lit
-- sait exactement ce que Quantinvo gagne sur son inventaire. « Le prix affiché
-- est le prix payé » est une promesse sur le MONTANT, pas une obligation
-- d'ouvrir la comptabilité. Le prix sort de `prix_mission`, qui est
-- `security definer` — la table reste fermée.
drop policy if exists reglages_prix_lire on public.reglages_prix;
create policy reglages_prix_lire on public.reglages_prix
  for select to authenticated using (public.is_admin());

-- ─── 2. Les coefficients ───────────────────────────────────────────────────
--
-- ⚠️ ILS JOUENT SUR LE PRIX, PAS SUR LA PAIE. Un inventoriste est payé pareil
-- pour la même durée, dimanche ou mercredi — c'est ce qui rend sa rémunération
-- annonçable avant qu'il accepte (document du prix, § 2.4).
create table if not exists public.coefficients_prix (
  version integer not null references public.reglages_prix(version) on delete cascade,
  famille text not null check (famille in ('secteur','horaire','jour','code_barres')),
  cle     text not null,
  valeur  numeric(4,2) not null check (valeur between 0.50 and 3.00),
  primary key (version, famille, cle)
);

alter table public.coefficients_prix enable row level security;
revoke all on table public.coefficients_prix from public, anon, authenticated;
grant select on table public.coefficients_prix to authenticated;

-- Même raison : un coefficient dit à quel point un secteur est rentable.
drop policy if exists coefficients_prix_lire on public.coefficients_prix;
create policy coefficients_prix_lire on public.coefficients_prix
  for select to authenticated using (public.is_admin());

-- ─── 3. Où l'on va, et ce que ça coûte là-bas ──────────────────────────────
--
-- Une seule table pour deux questions qui sont la même : « intervient-on à
-- cette adresse ? » et « avec quel coefficient ? ». Les séparer, c'est se
-- réveiller un jour avec une ville desservie sans coefficient, ou l'inverse.
--
-- Maquette Etape1-Visiteur : « Nous intervenons à Paris et en Île-de-France, à
-- Lyon et à Lille. » Maquette Client-Groupe : Bordeaux répond « Pas encore
-- desservi », et le magasin reste dans la liste — on ne cache pas un
-- établissement au client parce qu'on ne sait pas encore y aller.
create table if not exists public.zones_desservies (
  prefixe     text primary key check (prefixe ~ '^[0-9]{2}$'),
  libelle     text not null,
  actif       boolean not null default true,
  coefficient numeric(4,2) not null default 1.00 check (coefficient between 0.50 and 3.00),
  ouvert_le   timestamptz not null default now()
);

alter table public.zones_desservies enable row level security;
revoke all on table public.zones_desservies from public, anon, authenticated;
grant select on table public.zones_desservies to authenticated;

comment on table public.zones_desservies is
  'Les départements où une équipe peut être constituée, et leur coefficient de prix. Un code postal dont les deux premiers chiffres n''y sont pas actifs se voit refuser — franchement, sans devis de rattrapage.';

drop policy if exists zones_desservies_lire on public.zones_desservies;
create policy zones_desservies_lire on public.zones_desservies
  for select to authenticated using (true);

insert into public.zones_desservies (prefixe, libelle, actif, coefficient) values
  ('75', 'Paris', true, 1.00),
  ('77', 'Seine-et-Marne', true, 1.00),
  ('78', 'Yvelines', true, 1.00),
  ('91', 'Essonne', true, 1.00),
  ('92', 'Hauts-de-Seine', true, 1.00),
  ('93', 'Seine-Saint-Denis', true, 1.00),
  ('94', 'Val-de-Marne', true, 1.00),
  ('95', 'Val-d''Oise', true, 1.00),
  ('69', 'Rhône — Lyon', true, 1.00),
  ('59', 'Nord — Lille', true, 1.00)
on conflict (prefixe) do nothing;

-- ─── 4. La version 1 ───────────────────────────────────────────────────────
--
-- Les valeurs du document du prix, § 4. ⚠️ Elles retombent EXACTEMENT sur les
-- quatre prix de la maquette : Lille 589 €, Paris Rivoli 949 €, Lyon 949 €,
-- Paris Haussmann 1 309 €, marge 25,0 % sur les quatre.
insert into public.reglages_prix (
  version, taux_inventoriste_cents, taux_responsable_cents, productivite,
  duree_cible_minutes, frais_fixes_cents, marge_cible, marge_minimum,
  en_vigueur, note)
values (
  1, 2000, 2800, 800, 270, 4600, 0.250, 0.220, true,
  'Version de lancement. Aucune mesure réelle derrière la productivité de 800 articles/heure : c''est une hypothèse, que les premières missions doivent corriger.')
on conflict (version) do nothing;

-- ⚠️ TOUS LES COEFFICIENTS PARTENT À 1,00, ET C'EST UNE CORRECTION DU DOCUMENT
-- DE CONCEPTION. Il annonce « cosmétique 1,15 · Paris et petite couronne 1,10
-- · après 22 h 1,25 · dimanche 1,40 · stock non code-barré 1,35 » comme
-- valeurs de départ. Mais SES PROPRES EXEMPLES ne les appliquent pas : Paris
-- Rivoli, en textile code-barré, un mercredi à 20 h, y vaut 949 € — c'est-à-dire
-- 712 ÷ 0,75, sans coefficient. Avec le coefficient parisien, ce serait 1 044 €,
-- et les quatre prix de la maquette seraient faux.
--
-- La maquette est ce qui a été validé, donc c'est elle qui gagne : le mécanisme
-- est là, les familles sont posées, et les valeurs sont neutres. ⚠️ Les
-- allumer est une décision de prix à prendre en connaissance de cause —
-- passer le coefficient parisien à 1,10 fait passer Paris Rivoli de 949 € à
-- 1 044 € et la marge de 25,0 % à 31,8 %.
insert into public.coefficients_prix (version, famille, cle, valeur) values
  (1, 'secteur', 'textile',       1.00),
  (1, 'secteur', 'chaussures',    1.00),
  (1, 'secteur', 'cosmetique',    1.00),
  (1, 'secteur', 'sport',         1.00),
  (1, 'secteur', 'electronique',  1.00),
  (1, 'secteur', 'autre',         1.00),
  (1, 'horaire', 'apres_22h',     1.00),
  (1, 'jour',    'dimanche',      1.00),
  (1, 'code_barres', 'partiel',   1.00)
on conflict (version, famille, cle) do nothing;

-- ─── 5. Le calcul ──────────────────────────────────────────────────────────
--
-- Les cinq pas du document du prix, dans l'ordre, et rien d'autre.
--
-- ⚠️ L'ARRONDI EST LA MARGE DE SÉCURITÉ, ET IL N'EN FAUT PAS D'AUTRE. Monter
-- l'équipe à l'entier supérieur ET la durée à la demi-heure supérieure, c'est
-- déjà payer la prudence deux fois ; y ajouter un pourcentage sortirait du
-- marché. Aucune ligne de cette fonction n'ajoute de coussin.
--
-- ⚠️ ON RETIENT LE HAUT DE LA TRANCHE DÉCLARÉE, JAMAIS LE MILIEU. Un prix
-- ferme se calcule sur le cas le plus lourd que le client a lui-même annoncé —
-- c'est ce qui permet de ne pas revenir vers lui.
create or replace function public.prix_mission(
  p_articles_max integer,
  p_secteur      text,
  p_debut        timestamptz,
  p_code_barres  text default 'tous',
  p_code_postal  text default null,
  p_version      integer default null
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
  v_heures      numeric;
  v_inv         integer;
  v_resp        boolean;
  v_minutes     integer;
  v_heures_fac  numeric;
  v_equipe      integer;
  v_cout        integer;
  v_coef        numeric := 1.00;
  v_detail      jsonb := '{}'::jsonb;
  v_c           numeric;
  v_prix        integer;
  v_marge       numeric;
begin
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
  if p_code_postal is not null then
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

  -- 3. Combien de personnes, et combien de temps.
  v_inv := ceil(v_heures / (r.duree_cible_minutes::numeric / 60))::integer;
  v_minutes := ceil((v_heures / v_inv) * 60 / r.arrondi_minutes)::integer * r.arrondi_minutes;
  -- ⚠️ Un responsable dès trois inventoristes : en dessous, personne ne
  -- contrôlerait les écarts sur place — et c'est Quantinvo qui répond de la
  -- qualité, pas le magasin.
  v_resp := v_inv >= r.responsable_des_n;

  -- 4. Ce que ça coûte.
  v_heures_fac := v_minutes::numeric / 60;
  v_equipe := round(
    (v_inv * r.taux_inventoriste_cents
     + case when v_resp then r.taux_responsable_cents else 0 end) * v_heures_fac
  )::integer;
  v_cout := v_equipe + r.frais_fixes_cents;

  -- Les coefficients, un par famille, multipliés entre eux.
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

  -- ⚠️ LE STOCK PARTIELLEMENT NON CODE-BARRÉ EST LE COEFFICIENT LE PLUS LOURD
  -- DU MODÈLE : ce qui n'a pas de code se compte à la main, référence par
  -- référence. Il est à 1,00 au lancement comme les autres, mais c'est celui
  -- que les premières missions corrigeront en premier.
  if coalesce(p_code_barres, 'tous') = 'partiel' then
    select valeur into v_c from public.coefficients_prix
     where version = r.version and famille = 'code_barres' and cle = 'partiel';
    if v_c is not null then
      v_coef := v_coef * v_c;
      v_detail := v_detail || jsonb_build_object('code_barres', v_c);
    end if;
  end if;

  -- 5. Le prix, arrondi à l'euro.
  v_prix := (round(v_cout / (1 - r.marge_cible) * v_coef / 100))::integer * 100;
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
    'articles_retenus', p_articles_max,
    'heures_personne', round(v_heures, 2),
    'inventoristes', v_inv,
    'responsable', v_resp,
    'duree_minutes', v_minutes,
    'arrivee_minutes_avant', 15,
    'equipe_cents', v_equipe,
    'frais_cents', r.frais_fixes_cents,
    'cout_cents', v_cout,
    'coefficient', round(v_coef, 4),
    'coefficients', v_detail,
    'prix_cents', v_prix,
    'marge_cents', v_prix - v_cout,
    'marge', round(v_marge, 4),
    -- Ce que chacun touche, pour l'écran de proposition de mission : c'est la
    -- même durée que celle vendue au client, et c'est voulu — une mission qui
    -- déborde coûte à Quantinvo, pas à l'inventoriste.
    'remuneration_inventoriste_cents', round(r.taux_inventoriste_cents * v_heures_fac)::integer,
    'remuneration_responsable_cents',
      case when v_resp then round(r.taux_responsable_cents * v_heures_fac)::integer else 0 end
  );
end;
$function$;

-- ⚠️ LE MOTEUR N'EST PAS APPELABLE DEPUIS UN NAVIGATEUR DE CLIENT, parce que
-- ce qu'il rend contient `cout_cents`, `equipe_cents`, `marge_cents` et les
-- rémunérations. C'est exactement ce qu'un client ne doit pas lire : il saurait
-- au centime ce que Quantinvo gagne sur son inventaire, et ce que touche
-- l'inventoriste qui est chez lui. La porte du tunnel est `devis_mission`
-- ci-dessous, qui ne rend que ce que la maquette affiche.
revoke all on function public.prix_mission(integer, text, timestamptz, text, text, integer)
  from public, anon, authenticated;
grant execute on function public.prix_mission(integer, text, timestamptz, text, text, integer)
  to service_role;

-- ─── 6. Le prix ne bouge plus après la réservation ─────────────────────────
--
-- ⚠️ UN CHANGEMENT DE RÉGLAGE NE TOUCHE JAMAIS UNE MISSION DÉJÀ RÉSERVÉE. La
-- mission porte son `prix_cents` et sa `reglages_version` ; rien ne recalcule
-- à l'affichage. Sinon « le prix affiché est le prix payé » ne veut plus rien
-- dire — et c'est le produit entier qui tombe.
--
-- Le déclencheur ci-dessous est la serrure : passé `paiement_autorise`, le
-- montant et ce qui le compose sont figés, y compris pour `service_role`. La
-- seule sortie est l'annulation, et une mission neuve.
create or replace function public.missions_figer_le_prix()
returns trigger
language plpgsql
as $function$
begin
  if old.etat in ('brouillon', 'prix_calcule') then
    return new;
  end if;

  if new.prix_cents is distinct from old.prix_cents
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

drop trigger if exists missions_prix_fige on public.missions;
create trigger missions_prix_fige
  before update on public.missions
  for each row execute function public.missions_figer_le_prix();

-- ─── 7. Le devis d'une mission à venir ─────────────────────────────────────
--
-- Ce que le tunnel appelle : une réponse unique pour « où, quand, combien
-- d'articles » — prix, équipe, durée, et le refus quand il y a refus. Le
-- navigateur n'a rien à calculer, il n'a qu'à afficher.
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
begin
  if jsonb_typeof(p_reponses) <> 'object' then
    return jsonb_build_object('success', false, 'code', 'format');
  end if;

  begin
    v_debut := (p_reponses->>'debut')::timestamptz;
  exception when others then
    return jsonb_build_object('success', false, 'code', 'date');
  end;

  -- ⚠️ ON NE VEND PAS POUR CE SOIR. Constituer une équipe prend du temps, et
  -- une mission acceptée qu'on ne peut pas servir coûte plus cher qu'une
  -- mission refusée. Quarante-huit heures est le délai du lancement ; c'est
  -- un réglage à revoir quand le vivier existera.
  if v_debut < now() + interval '48 hours' then
    return jsonb_build_object('success', false, 'code', 'trop_tot');
  end if;

  v_prix := public.prix_mission(
    (p_reponses->>'articles_max')::integer,
    p_reponses->>'secteur',
    v_debut,
    coalesce(p_reponses->>'code_barres', 'tous'),
    p_reponses->>'code_postal');

  if not (v_prix->>'success')::boolean then
    return v_prix;
  end if;

  return jsonb_build_object(
    'success', true,
    'version', v_prix->'version',
    'prix_cents', v_prix->'prix_cents',
    'inventoristes', v_prix->'inventoristes',
    'responsable', v_prix->'responsable',
    'duree_minutes', v_prix->'duree_minutes',
    'articles_retenus', v_prix->'articles_retenus',
    'debut', v_debut,
    'arrivee', v_debut - interval '15 minutes',
    'fin_prevue', v_debut + make_interval(mins => (v_prix->>'duree_minutes')::integer),
    -- Annulation gratuite jusqu'à trois jours avant (maquette Prix et
    -- Annuler). Le calcul des frais au-delà vit avec les annulations.
    'annulation_gratuite_jusqu_au', v_debut - interval '3 days');
end;
$function$;

revoke all on function public.devis_mission(jsonb) from public, anon;
grant execute on function public.devis_mission(jsonb) to authenticated, service_role;
