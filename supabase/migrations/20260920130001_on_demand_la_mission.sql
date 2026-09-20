-- On-Demand : la mission, ses accès temporaires, et le trou du plafond
-- (20 septembre 2026)
--
-- Conception : docs/entreprise/on-demand/01-comptes-et-droits.md (§ 2 et § 5)
-- Maquette   : https://claude.ai/artifact/BSqAQUPZ7tnjAfdswK35MV
--              (Admin-Mission, Suivi, TeamLeader-Mission, Prestataire-Zone)
--
-- ⚠️ CETTE MIGRATION TOUCHE HUIT POLICIES QUI FONT TOURNER QUANTINVO OS. C'est
-- la seule du chantier dans ce cas, et c'est inévitable : l'appartenance se
-- déduit aujourd'hui de `profiles.company_id`, et un inventoriste est par
-- construction extérieur à l'entreprise du client. Chaque policy est réécrite
-- À PARTIR DE SA DÉFINITION RÉELLE, relue dans `pg_policies` le 20 septembre,
-- et ne gagne qu'une branche en `or` — elle ne peut donc qu'ouvrir, jamais
-- fermer ce qui marche.
--
-- ⚠️ ET ELLE FERME UN DÉFAUT QUI N'A RIEN À VOIR AVEC ON-DEMAND :
-- `plafond_appareils` rend `null` pour tout magasin dont l'offre n'est pas
-- connue — c'est-à-dire pour le cas PAR DÉFAUT, puisque `companies.plan` vaut
-- `'standard'` à la création. `prendre_place_appareil` ne refuse alors rien du
-- tout. Un tel magasin est illimité aujourd'hui.

-- ─── 1. La réservation groupée d'une enseigne ──────────────────────────────
--
-- Point 49 : quatre magasins réservés d'un coup, « chacun garde son équipe,
-- son suivi et son rapport, une seule facture ». Le groupe porte donc le
-- paiement ; les missions portent tout le reste.
create table if not exists public.mission_groupes (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid references public.companies(id) on delete set null,
  reserve_par uuid references auth.users(id) on delete set null,
  total_cents integer not null default 0 check (total_cents >= 0),
  stripe_payment_intent_id text unique,
  created_at  timestamptz not null default now()
);

alter table public.mission_groupes enable row level security;
revoke all on table public.mission_groupes from public, anon, authenticated;
grant select on table public.mission_groupes to authenticated;

comment on table public.mission_groupes is
  'Une réservation qui couvre plusieurs missions : un seul paiement, une seule facture, des missions indépendantes.';

drop policy if exists groupes_lire_les_siens on public.mission_groupes;
create policy groupes_lire_les_siens on public.mission_groupes
  for select to authenticated
  using (company_id = (select p.company_id from public.profiles p where p.id = auth.uid())
         or public.is_admin());

-- ─── 2. La mission ─────────────────────────────────────────────────────────
--
-- ⚠️ UN DEVIS DE VISITEUR N'EST PAS UNE MISSION. Le prix s'affiche à l'étape 3
-- avant tout compte : si le brouillon vivait ici, il faudrait une cinquième
-- fonction ouverte à `anon` pour l'écrire, et il n'y en a que quatre — c'est
-- mesuré à chaque revue. Le devis reste calculé par le serveur et porté par le
-- navigateur ; la mission naît quand l'entreprise existe, et son prix est
-- RECALCULÉ à ce moment-là à partir des mêmes réponses et de la même version
-- de réglages. Même résultat, aucune porte de plus.
--
-- ⚠️ `company_id` ET `store_id` SONT `ON DELETE SET NULL`, PAS `CASCADE`. Une
-- mission payée est une pièce comptable : `admin_delete_company` doit pouvoir
-- effacer le client sans effacer la trace de ce qui a été facturé. D'où les
-- copies `client_nom`, `magasin_nom` et `adresse`, qui survivent — et qui
-- servent de toute façon aux écrans de l'inventoriste, qui n'a accès ni à
-- `companies` ni à `stores`.
create sequence if not exists public.missions_reference_seq;

create table if not exists public.missions (
  id          uuid primary key default gen_random_uuid(),
  reference   text not null unique
                default 'QI-' || to_char(now(), 'YYMM') || '-'
                        || lpad(nextval('public.missions_reference_seq')::text, 4, '0'),
  groupe_id   uuid references public.mission_groupes(id) on delete set null,

  company_id  uuid references public.companies(id) on delete set null,
  store_id    uuid references public.stores(id) on delete set null,
  reserve_par uuid references auth.users(id) on delete set null,
  inventory_session_id uuid references public.inventory_sessions(id) on delete set null,

  -- Ce que le client a décrit (étapes 1 à 3 de la maquette)
  client_nom    text not null,
  magasin_nom   text not null,
  adresse       text not null,
  code_postal   text,
  ville         text,
  acces_sur_place text,                      -- « entrée par la porte de service »
  secteur       text not null
                  check (secteur in ('textile','chaussures','cosmetique','sport','electronique','autre')),
  surface_vente_m2   integer check (surface_vente_m2 is null or surface_vente_m2 between 1 and 100000),
  surface_reserve_m2 integer check (surface_reserve_m2 is null or surface_reserve_m2 between 0 and 100000),
  articles_min  integer not null check (articles_min >= 0),
  articles_max  integer not null check (articles_max >= 0),
  references_min integer check (references_min is null or references_min >= 0),
  references_max integer check (references_max is null or references_max >= 0),
  code_barres   text not null default 'tous' check (code_barres in ('tous','partiel')),

  -- ⚠️ L'ENGAGEMENT DE L'ÉTAPE 3 EST DATÉ, PAS COCHÉ. « Je m'engage à ce que le
  -- stock soit rangé et chaque article scannable » est ce qui autorise le
  -- recalcul sur place (§ 5 du document du prix) : le jour où un client le
  -- conteste, il faut pouvoir dire quand il l'a accepté, comme pour les CGV.
  engagement_range_le timestamptz,
  cgv_version text,

  -- Quand, et pour combien de temps
  debut_prevu  timestamptz not null,
  moment       text check (moment is null or moment in ('avant_ouverture','journee','apres_fermeture')),
  duree_prevue_minutes integer not null check (duree_prevue_minutes between 30 and 1440),
  -- L'équipe arrive un quart d'heure avant pour s'installer (maquette Prix et
  -- Prestataire-Mission) : c'est l'heure qui fait foi pour le pointage.
  arrivee_prevue timestamptz not null,

  -- L'équipe, telle que le prix l'a dimensionnée
  inventoristes integer not null check (inventoristes between 1 and 60),
  responsable   boolean not null default false,

  -- Le prix, verrouillé
  articles_retenus integer not null check (articles_retenus > 0),
  prix_cents    integer not null check (prix_cents >= 0),
  cout_cents    integer not null default 0 check (cout_cents >= 0),
  calcul        jsonb,                        -- la chaîne complète, telle qu'elle a été jouée
  reglages_version integer,

  annulation_gratuite_jusqu_au timestamptz,
  stripe_payment_intent_id text unique,

  etat text not null default 'brouillon' check (etat in (
    'brouillon','prix_calcule','paiement_autorise','confirmee',
    'en_constitution','equipe_complete','prete',
    'en_cours','controle_qualite','terminee',
    'paiement_prestataires','payee',
    'annulee','remboursee','litige','echouee')),

  -- La fenêtre des accès temporaires. Elle est portée par la mission et par
  -- rien d'autre : `mission_access` et le plafond d'appareils la lisent tous
  -- les deux ici, de sorte qu'ils ne peuvent pas diverger.
  acces_ouverts_le   timestamptz,
  acces_expirent_le  timestamptz,

  created_at   timestamptz not null default now(),
  confirmee_le timestamptz,
  commencee_le timestamptz,
  terminee_le  timestamptz,
  annulee_le   timestamptz,
  annulee_par  uuid references auth.users(id) on delete set null,
  motif        text,

  constraint missions_tranche_coherente check (articles_max >= articles_min),
  constraint missions_references_coherentes
    check (references_max is null or references_min is null or references_max >= references_min)
);

create index if not exists missions_company_idx on public.missions (company_id, debut_prevu desc);
create index if not exists missions_store_idx   on public.missions (store_id, debut_prevu desc);
create index if not exists missions_etat_idx    on public.missions (etat, debut_prevu);
create index if not exists missions_session_idx on public.missions (inventory_session_id);

alter table public.missions enable row level security;
revoke all on table public.missions from public, anon, authenticated;

-- ⚠️ LE DROIT DE LECTURE EST DONNÉ COLONNE PAR COLONNE, ET QUATRE MANQUENT :
-- `cout_cents`, `calcul`, `reglages_version` et `stripe_payment_intent_id`. La
-- RLS choisit des LIGNES, pas des colonnes : sans ce grant nominatif, le client
-- qui lit sa mission lirait aussi ce qu'elle nous coûte, ce que touche chaque
-- inventoriste et quelle marge nous prenons. « Le prix affiché est le prix
-- payé » est une promesse sur le montant, pas l'ouverture de la comptabilité.
--
-- ⚠️ ET L'ADMINISTRATEUR NON PLUS NE LES LIT PAS PAR CETTE PORTE — un grant de
-- colonne ne sait pas distinguer les rôles. La console passera par une
-- fonction `admin_*`, qui journalise, comme tout le reste du back-office.
grant select (
  id, reference, groupe_id, company_id, store_id, reserve_par,
  inventory_session_id, client_nom, magasin_nom, adresse, code_postal, ville,
  acces_sur_place, secteur, surface_vente_m2, surface_reserve_m2,
  articles_min, articles_max, references_min, references_max, code_barres,
  engagement_range_le, cgv_version, debut_prevu, moment, duree_prevue_minutes,
  arrivee_prevue, inventoristes, responsable, articles_retenus, prix_cents,
  annulation_gratuite_jusqu_au, etat, acces_ouverts_le, acces_expirent_le,
  created_at, confirmee_le, commencee_le, terminee_le, annulee_le, annulee_par,
  motif
) on table public.missions to authenticated;

comment on table public.missions is
  'Un inventaire vendu à la demande. Le prix y est verrouillé ; les copies client_nom / magasin_nom / adresse survivent à la suppression du client et servent aux écrans des inventoristes.';

-- Sa policy de lecture est posée après `mission_assignments`, qu'elle
-- interroge : une policy ne peut pas nommer une table qui n'existe pas encore.

-- ─── 3. Qui fait la mission ────────────────────────────────────────────────
create table if not exists public.mission_assignments (
  mission_id uuid not null references public.missions(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       text not null default 'inventoriste' check (role in ('inventoriste','responsable')),
  etat       text not null default 'proposee'
               check (etat in ('proposee','acceptee','refusee','retiree','remplacee','absente')),
  remuneration_cents integer not null default 0 check (remuneration_cents >= 0),
  propose_le timestamptz not null default now(),
  repondu_le timestamptz,
  pointe_le  timestamptz,
  motif      text,
  primary key (mission_id, user_id)
);

create index if not exists mission_assignments_user_idx
  on public.mission_assignments (user_id, etat);

alter table public.mission_assignments enable row level security;
revoke all on table public.mission_assignments from public, anon, authenticated;
grant select on table public.mission_assignments to authenticated;

comment on table public.mission_assignments is
  'La proposition faite à un inventoriste, et sa réponse. ⚠️ Le client ne voit JAMAIS cette table : la maquette lui montre « 6 inventoristes », pas des noms — c''est Quantinvo qui choisit l''équipe (point 16).';

-- ⚠️ CHACUN NE VOIT QUE SA LIGNE, ET LE CLIENT N'EN VOIT AUCUNE. Donner au
-- client la liste de son équipe le mettrait en position de la choisir, de la
-- refuser, puis de la débaucher — c'est exactement ce que le produit ne vend
-- pas. Le responsable voit les siens par `equipe_de_ma_mission()` plus bas,
-- qui ne rend que des prénoms.
drop policy if exists assignments_lire_les_siennes on public.mission_assignments;
create policy assignments_lire_les_siennes on public.mission_assignments
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- Le client lit les missions de son entreprise. L'inventoriste lit celles où
-- il est affecté — pas les autres, et rien du client au-delà des copies
-- `client_nom` / `magasin_nom` / `adresse` portées par la mission elle-même.
-- ⚠️ La garde porte sur la ligne visée (`missions.company_id`,
-- `mission_assignments.mission_id`), jamais sur le rôle de l'appelant.
drop policy if exists missions_lire on public.missions;
create policy missions_lire on public.missions
  for select to authenticated
  using (
    company_id = (select p.company_id from public.profiles p where p.id = auth.uid())
    or public.is_admin()
    or exists (select 1 from public.mission_assignments ma
                where ma.mission_id = missions.id
                  and ma.user_id = auth.uid()
                  and ma.etat in ('proposee','acceptee'))
  );

-- Aucune policy d'écriture sur `missions` : une mission se crée, avance et
-- s'annule par les fonctions, jamais par un `update` du navigateur. C'est ce
-- qui rend « le prix affiché est le prix payé » tenable.

-- ─── 4. L'accès temporaire à l'inventaire ──────────────────────────────────
--
-- ⚠️ POURQUOI PAS UNE SIMPLE LIGNE DANS `session_members`. Ce serait plus
-- court, et faux : `session_members_supervisor` est `for all`, donc un
-- superviseur du client pourrait SUPPRIMER la ligne de l'inventoriste et
-- mettre notre équipe dehors au milieu de l'inventaire qu'il paie. Une table à
-- part, sans policy d'écriture, n'est pas révocable par le client.
--
-- Trois propriétés à ne pas défaire (document 01, § 3) :
--   1. il expire, et l'expiration est LUE à chaque vérification — aucun travail
--      de fond n'est supposé être passé ;
--   2. il ne porte que sur l'inventaire de la mission — pas le magasin, pas
--      l'entreprise, pas les autres inventaires du même magasin ;
--   3. il ne rend pas abonné : rien ici n'écrit dans `companies`,
--      `entitlements` ou `stores`.
create table if not exists public.mission_access (
  mission_id uuid not null references public.missions(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  inventory_session_id uuid not null references public.inventory_sessions(id) on delete cascade,
  role       text not null check (role in ('counter','team_leader')),
  ouvert_le  timestamptz not null default now(),
  expire_le  timestamptz not null,
  primary key (mission_id, user_id)
);

-- L'index qui porte la vérification : elle est faite à CHAQUE lecture de
-- chaque ligne de comptage, par la RLS.
create index if not exists mission_access_porte_idx
  on public.mission_access (inventory_session_id, user_id, expire_le);

alter table public.mission_access enable row level security;
revoke all on table public.mission_access from public, anon, authenticated;
grant select on table public.mission_access to authenticated;

comment on table public.mission_access is
  'La deuxième source d''appartenance : le droit de toucher CET inventaire, jusqu''à cette heure. Aucune policy d''écriture — seules ouvrir_les_acces_mission / fermer_les_acces_mission en posent.';

drop policy if exists acces_lire_les_siens on public.mission_access;
create policy acces_lire_les_siens on public.mission_access
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- ─── 5. La question que toutes les règles d'accès vont poser ───────────────
--
-- ⚠️ `expire_le > now()` EST DANS LA REQUÊTE, PAS DANS UN BALAYAGE NOCTURNE.
-- Une mission qui se termine mal, une fonction edge qui n'a pas tourné, un
-- travail de fond en retard : aucun de ces accidents ne doit laisser une porte
-- ouverte. La ligne peut rester, elle ne vaut plus rien.
create or replace function public.a_un_acces_mission(p_session_id uuid, p_role text default null)
returns boolean
language sql
stable
security definer
set search_path = public
as $function$
  select exists (
    select 1 from public.mission_access ma
     where ma.inventory_session_id = p_session_id
       and ma.user_id = auth.uid()
       and ma.expire_le > now()
       and (p_role is null or ma.role = p_role)
  );
$function$;

revoke all on function public.a_un_acces_mission(uuid, text) from public, anon;
grant execute on function public.a_un_acces_mission(uuid, text) to authenticated, service_role;

-- ─── 6. Les règles d'accès de la mission ───────────────────────────────────
--
-- ⚠️ **ON N'A PAS TOUCHÉ UNE SEULE RÈGLE DE QUANTINVO OS, ET C'EST LE POINT.**
-- La première version de cette migration réécrivait huit policies d'OS pour
-- leur ajouter une branche `or`. Elle marchait — le rejeu sur réplique le
-- montrait — mais elle mettait On-Demand DANS le produit qui tourne : une
-- faute de frappe dans l'une d'elles cassait le comptage de tout le monde, et
-- la retirer aurait demandé de restaurer huit définitions à la main.
--
-- ⚠️ **LES POLICIES PERMISSIVES SE COMBINENT EN `OU`.** Il suffit donc d'en
-- AJOUTER à côté de celles d'OS. Trois conséquences qui valent le détour :
--
--   1. aucune ligne de Quantinvo OS n'est modifiée — ni policy, ni fonction ;
--   2. pour quiconque n'a pas de `mission_access`, ces règles rendent FAUX :
--      la table est vide, donc l'effet sur le produit existant est nul, et ça
--      se démontre au lieu de se relire ;
--   3. tout retirer tient en un `drop policy` par ligne ci-dessous.
--
-- `is_session_participant` reste donc telle qu'elle est depuis le 8 septembre.

-- Voir l'inventaire de sa mission — compteur comme responsable.
drop policy if exists sessions_acces_mission on public.inventory_sessions;
create policy sessions_acces_mission on public.inventory_sessions
  for select to authenticated
  using (public.a_un_acces_mission(id));

-- Voir les zones, donc la sienne (maquette Prestataire-Zone).
drop policy if exists zones_acces_mission on public.zones;
create policy zones_acces_mission on public.zones
  for select
  using (public.a_un_acces_mission(session_id));

-- Compter. ⚠️ Les trois autres conditions sont RECOPIÉES de la règle d'OS —
-- on n'écrit que ses propres comptages, sur un inventaire non clôturé, dans
-- une passe connue. Une règle ajoutée qui les oublierait ouvrirait par le
-- côté ce que la règle d'à côté ferme.
drop policy if exists counts_acces_mission_insert on public.counts;
create policy counts_acces_mission_insert on public.counts
for insert
with check (
  counted_by = auth.uid()
  and public.a_un_acces_mission(counts.session_id)
  and exists (
    select 1 from public.inventory_sessions s
    where s.id = counts.session_id and s.status <> 'closed'
  )
  and pass_number >= 1 and pass_number <= 3
);

-- ─── 7. Ce que le responsable a en plus ────────────────────────────────────
--
-- Maquette TeamLeader-Mission : il attribue les zones, contrôle les écarts,
-- demande un recomptage et clôture.
--
-- ⚠️ **IL N'EST PAS « SUPERVISEUR » POUR AUTANT.** Lui écrire
-- `role = 'supervisor'` dans `profiles` serait un droit PERMANENT posé pour un
-- besoin TEMPORAIRE, et le ferait entrer dans `session_members_supervisor`
-- (`for all`) : le droit d'ajouter et de retirer des gens de l'inventaire d'un
-- client. Le responsable mène les zones et les comptages ; il ne décide pas
-- qui appartient. C'est pour ça qu'il n'y a ci-dessous AUCUNE règle sur
-- `session_members` ni sur la création d'inventaire.

-- Lire tous les comptages : c'est ce qui fait l'écran des écarts.
drop policy if exists counts_acces_mission_select on public.counts;
create policy counts_acces_mission_select on public.counts
  for select
  using (public.a_un_acces_mission(session_id, 'team_leader'));

-- Recompter soi-même une balise contestée.
drop policy if exists counts_acces_mission_recompte on public.counts;
create policy counts_acces_mission_recompte on public.counts
for insert
with check (
  counted_by = auth.uid()
  and public.a_un_acces_mission(counts.session_id, 'team_leader')
  and exists (
    select 1 from public.inventory_sessions s
    where s.id = counts.session_id and s.status <> 'closed'
  )
  and pass_number >= 1 and pass_number <= 3
);

-- Attribuer une zone, en ouvrir une, la marquer contrôlée.
drop policy if exists zones_acces_mission_responsable on public.zones;
create policy zones_acces_mission_responsable on public.zones
for all
using (public.a_un_acces_mission(session_id, 'team_leader'))
with check (public.a_un_acces_mission(session_id, 'team_leader'));

-- Commencer et clôturer l'inventaire.
drop policy if exists sessions_acces_mission_update on public.inventory_sessions;
create policy sessions_acces_mission_update on public.inventory_sessions
for update to authenticated
using (public.a_un_acces_mission(id, 'team_leader'))
with check (public.a_un_acces_mission(id, 'team_leader'));


-- ─── 9. La machine d'état ──────────────────────────────────────────────────
--
-- Document 01, § 5. Deux ancrages qui ne sont pas cosmétiques :
--   • `paiement_autorise` AVANT `confirmee` — l'empreinte est prise à la
--     réservation, le débit à `terminee`. C'est ce qui rend les frais
--     d'annulation exécutables sans réclamer de l'argent après coup ;
--   • `confirmee` NE DÉPEND PAS DE L'ÉQUIPE — le client est confirmé avant que
--     le premier inventoriste ait accepté. Constituer l'équipe est notre
--     problème, pas le sien.
--
-- ⚠️ `equipe_complete → en_constitution` EST UN CHEMIN NORMAL, pas un retour en
-- arrière honteux : c'est le désistement, que la maquette Admin-Missions
-- affiche pour Lille Centre. Une machine d'état qui ne sait pas reculer d'un
-- cran oblige à annuler la mission d'un client qui n'a rien fait de mal.
create or replace function public.transition_mission_permise(p_de text, p_vers text)
returns boolean
language sql
immutable
as $function$
  select p_de = p_vers or p_vers = any (case p_de
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
  end);
$function$;

revoke all on function public.transition_mission_permise(text, text) from public, anon;
grant execute on function public.transition_mission_permise(text, text) to authenticated, service_role;

create or replace function public.missions_verifier_transition()
returns trigger
language plpgsql
as $function$
begin
  if not public.transition_mission_permise(old.etat, new.etat) then
    raise exception 'Transition de mission interdite : % vers %', old.etat, new.etat
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

drop trigger if exists missions_transition on public.missions;
create trigger missions_transition
  before update of etat on public.missions
  for each row execute function public.missions_verifier_transition();

-- ─── 10. Ouvrir et fermer les accès, en un seul endroit ────────────────────
--
-- Document 01, § 5 : « Le passage à EN_COURS est le moment où les
-- mission_access s'ouvrent ; le passage à TERMINEE est le moment où ils se
-- ferment. Un seul endroit doit les créer et les fermer. » Ce seul endroit est
-- le déclencheur ci-dessous — pas une fonction edge, pas le back-office, pas
-- l'application du responsable. Trois appelants, ce serait trois façons d'en
-- oublier un.
create or replace function public.ouvrir_les_acces_mission(p_mission uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_m record;
  v_fin timestamptz;
  v_n integer;
begin
  select * into v_m from public.missions where id = p_mission;
  if not found or v_m.inventory_session_id is null then
    return 0;
  end if;

  -- ⚠️ LA MARGE EST DE DEUX HEURES, ET ELLE N'EST PAS DE LA GÉNÉROSITÉ. Un
  -- accès qui expire à la minute annoncée coupe le comptage d'une équipe en
  -- retard — et une mission qui déborde coûte déjà à Quantinvo (document du
  -- prix, § 6) sans avoir besoin de perdre les données en plus. La fermeture
  -- normale, c'est la clôture ; l'expiration n'est qu'un filet.
  v_fin := greatest(now(), v_m.debut_prevu)
           + make_interval(mins => v_m.duree_prevue_minutes)
           + interval '2 hours';

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

  update public.missions
     set acces_ouverts_le = coalesce(acces_ouverts_le, now()),
         acces_expirent_le = v_fin
   where id = v_m.id;

  return v_n;
end;
$function$;

revoke all on function public.ouvrir_les_acces_mission(uuid) from public, anon, authenticated;

-- ⚠️ ON N'EFFACE PAS, ON EXPIRE. La ligne est la trace de qui a eu accès à
-- l'inventaire d'un client, et à quelle heure : c'est exactement ce qu'il faut
-- pouvoir produire le jour où le client demande qui a touché ses données.
-- Comme l'expiration est lue à chaque vérification, une ligne expirée n'ouvre
-- plus rien dans la seconde.
create or replace function public.fermer_les_acces_mission(p_mission uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_n integer;
begin
  update public.mission_access
     set expire_le = least(expire_le, now())
   where mission_id = p_mission and expire_le > now();
  get diagnostics v_n = row_count;

  update public.missions
     set acces_expirent_le = least(coalesce(acces_expirent_le, now()), now())
   where id = p_mission;

  return v_n;
end;
$function$;

revoke all on function public.fermer_les_acces_mission(uuid) from public, anon, authenticated;

create or replace function public.missions_accorder_les_acces()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  if new.etat = 'en_cours' and old.etat <> 'en_cours' then
    perform public.ouvrir_les_acces_mission(new.id);
  elsif new.etat in ('terminee','annulee','echouee','remboursee')
        and old.etat not in ('terminee','annulee','echouee','remboursee') then
    perform public.fermer_les_acces_mission(new.id);
  end if;
  return null;
end;
$function$;

revoke all on function public.missions_accorder_les_acces() from public, anon, authenticated;

drop trigger if exists missions_acces on public.missions;
create trigger missions_acces
  after update of etat on public.missions
  for each row execute function public.missions_accorder_les_acces();

-- ─── 12. Ce que le responsable voit de son équipe ──────────────────────────
--
-- ⚠️ DES PRÉNOMS ET UN ÉTAT DE POINTAGE, RIEN D'AUTRE. Le responsable a besoin
-- de savoir qui est arrivé (maquette : « Un inventoriste n'a pas pointé,
-- 5 présents sur 6 »). Il n'a besoin ni des adresses, ni des SIRET, ni des
-- scores — et une fonction qui les rendrait « au cas où » finirait par les
-- afficher. C'est aussi pour ça que `mission_assignments` n'a pas de policy de
-- lecture pour lui : la porte est cette fonction, et elle est étroite.
create or replace function public.equipe_de_ma_mission(p_mission uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  v_session uuid;
  v_equipe jsonb;
begin
  select m.inventory_session_id into v_session from public.missions m where m.id = p_mission;
  if v_session is null then
    return jsonb_build_object('success', false, 'code', 'introuvable');
  end if;

  -- ⚠️ La garde porte sur la mission visée, pas sur un paramètre : c'est
  -- `a_un_acces_mission` qui regarde si l'appelant est LE responsable de CET
  -- inventaire, maintenant.
  if not (public.is_admin() or public.a_un_acces_mission(v_session, 'team_leader')) then
    return jsonb_build_object('success', false, 'code', 'interdit');
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'prenom', coalesce(p.first_name, '—'),
           'role', a.role,
           'pointe', a.pointe_le is not null,
           'pointe_le', a.pointe_le)
         order by a.role desc, p.first_name), '[]'::jsonb)
    into v_equipe
    from public.mission_assignments a
    join public.profiles p on p.id = a.user_id
   where a.mission_id = p_mission and a.etat = 'acceptee';

  return jsonb_build_object('success', true, 'equipe', v_equipe);
end;
$function$;

revoke all on function public.equipe_de_ma_mission(uuid) from public, anon;
grant execute on function public.equipe_de_ma_mission(uuid) to authenticated;

-- ─── 13. Pointer son arrivée ───────────────────────────────────────────────
--
-- Maquette Prestataire-Mission : « Pointer mon arrivée ». Le pointage sert au
-- responsable, et c'est lui qui déclenche l'attribution de zone.
create or replace function public.pointer_mon_arrivee(p_mission uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_user uuid := auth.uid();
  v_etat text;
begin
  if v_user is null then
    return jsonb_build_object('success', false, 'code', 'non_connecte');
  end if;

  select m.etat into v_etat from public.missions m where m.id = p_mission;
  if v_etat is null then
    return jsonb_build_object('success', false, 'code', 'introuvable');
  end if;
  if v_etat not in ('prete','en_cours') then
    return jsonb_build_object('success', false, 'code', 'pas_le_moment');
  end if;

  -- ⚠️ La garde est sur la ligne visée : c'est l'existence de SON affectation
  -- acceptée sur CETTE mission qui autorise, jamais un rôle transmis.
  update public.mission_assignments
     set pointe_le = coalesce(pointe_le, now())
   where mission_id = p_mission and user_id = v_user and etat = 'acceptee';

  if not found then
    return jsonb_build_object('success', false, 'code', 'pas_affecte');
  end if;

  return jsonb_build_object('success', true);
end;
$function$;

revoke all on function public.pointer_mon_arrivee(uuid) from public, anon;
grant execute on function public.pointer_mon_arrivee(uuid) to authenticated;

-- ─── 14. L'inventaire de la mission ────────────────────────────────────────
--
-- ⚠️ `created_by` EST LE CLIENT, PAS QUANTINVO, et ce n'est pas un détail de
-- politesse. `docs/notes/093` : « un inventaire clôturé n'appartient plus qu'à
-- son créateur ». Si Quantinvo créait l'inventaire en son nom, le client
-- perdrait l'accès à son propre rapport à la seconde où l'équipe clôture. Le
-- magasin reste le sien, l'entreprise reste la sienne, l'inventaire est le
-- sien — nous n'y sommes que de passage, par `mission_access`.
--
-- ⚠️ ET ELLE NE PASSE PAS PAR `create_session`, qui exige d'être superviseur
-- DE L'ENTREPRISE et affecté au magasin. Ni Quantinvo ni le responsable ne le
-- sont. Le numéro et le code suivent en revanche exactement sa forme : un
-- inventaire On-Demand ne doit pas être reconnaissable à son numéro.
create or replace function public.creer_la_session_de_mission(p_mission uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
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
  if v_m.etat not in ('confirmee','en_constitution','equipe_complete','prete') then
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

revoke all on function public.creer_la_session_de_mission(uuid) from public, anon, authenticated;
grant execute on function public.creer_la_session_de_mission(uuid) to service_role;
