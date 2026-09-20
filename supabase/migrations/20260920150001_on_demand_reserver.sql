-- On-Demand : réserver, et annuler (20 septembre 2026)
--
-- Conception : docs/entreprise/on-demand/02-le-prix.md (§ 1) et 06-annulations.md
-- Maquette   : Compte, Connexion, Paiement, Confirme, Annuler
--
-- ⚠️ C'EST ICI QUE LE PRIX DEVIENT ENGAGEANT. Le navigateur a montré un
-- montant pendant le parcours (`web/lib/prixOnDemand.ts`) ; celui qui compte
-- est recalculé ici, à partir des MÊMES réponses et de la version de réglages
-- en vigueur. Si les deux diffèrent, c'est celui-ci qui gagne — et le client le
-- voit avant de payer, jamais après.

-- ─── 1. Le barème d'annulation ─────────────────────────────────────────────
--
-- ⚠️ CE SONT DES RÉGLAGES, PAS DU CODE, pour la même raison que le prix : un
-- barème d'annulation est une décision commerciale.
--
-- ⚠️ ET LES DEUX PARTS NE S'ARRONDISSENT PAS DANS LE MÊME SENS. Ce que le
-- client paie descend à l'euro inférieur, ce que l'équipe touche monte à
-- l'euro supérieur — chaque arrondi va contre Quantinvo. Une pénalité qui
-- rapporte est une pénalité qu'on finit par souhaiter, et le client le sent.
create table if not exists public.reglages_annulation (
  version       integer not null references public.reglages_prix(version) on delete cascade,
  -- Le PLANCHER du palier, en heures avant le début : on retient le plus grand
  -- palier encore atteint. 100 h restantes → palier 72 ; 48 h → palier 24 ;
  -- 10 h → palier 0.
  heures_avant  integer not null check (heures_avant >= 0),
  part_client   numeric(4,3) not null check (part_client between 0 and 1),
  part_equipe   numeric(4,3) not null check (part_equipe between 0 and 1),
  primary key (version, heures_avant)
);

alter table public.reglages_annulation enable row level security;
revoke all on table public.reglages_annulation from public, anon, authenticated;
grant select on table public.reglages_annulation to authenticated;

comment on table public.reglages_annulation is
  'Le barème d''annulation, par palier d''heures avant le début. Lisible par tout le monde : il ne dit rien de notre coût, et le client doit pouvoir vérifier ce qu''on lui applique.';

drop policy if exists annulation_lire on public.reglages_annulation;
create policy annulation_lire on public.reglages_annulation
  for select to authenticated using (true);

insert into public.reglages_annulation (version, heures_avant, part_client, part_equipe) values
  (1, 72, 0.000, 0.000),   -- plus de 72 h avant : gratuit
  (1, 24, 0.300, 0.100),   -- de 72 h à 24 h
  (1,  0, 0.500, 0.300)    -- moins de 24 h
on conflict (version, heures_avant) do nothing;

-- Ce que l'équipe de cette mission touche en tout si elle la fait. Lue dans la
-- chaîne verrouillée sur la mission, jamais recalculée : les réglages ont pu
-- changer depuis, la mission garde les siens.
create or replace function public.remuneration_totale(p_mission uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $function$
  select coalesce((m.calcul ->> 'equipe_cents')::integer, 0)
    from public.missions m where m.id = p_mission;
$function$;

revoke all on function public.remuneration_totale(uuid) from public, anon, authenticated;
grant execute on function public.remuneration_totale(uuid) to service_role;

-- ─── 2. Ce que coûterait l'annulation, maintenant ──────────────────────────
--
-- ⚠️ LE CLIENT VOIT DES EUROS, JAMAIS DES POURCENTAGES SEULS. « 30 % » ne veut
-- rien dire au moment de décider ; « 284 € » se comprend tout de suite. Cette
-- fonction rend donc les paliers CHIFFRÉS sur SA réservation, et celui qui
-- s'applique à l'instant.
create or replace function public.frais_annulation(p_mission uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  v_m record;
  v_version integer;
  v_heures numeric;
  v_palier record;
  v_paliers jsonb;
  v_client integer := 0;
  v_equipe integer := 0;
  v_sur_place boolean;
  v_admin boolean := public.is_admin();
begin
  select * into v_m from public.missions where id = p_mission;
  if not found then
    return jsonb_build_object('success', false, 'code', 'introuvable');
  end if;

  -- ⚠️ La garde porte sur la mission visée — son entreprise — jamais sur un
  -- rôle transmis par l'appelant.
  if not (v_admin
          or v_m.company_id = (select p.company_id from public.profiles p where p.id = auth.uid())) then
    return jsonb_build_object('success', false, 'code', 'interdit');
  end if;

  v_version := coalesce(v_m.reglages_version,
                        (select version from public.reglages_prix where en_vigueur));
  v_heures := extract(epoch from (v_m.debut_prevu - now())) / 3600;

  -- ⚠️ « L'ÉQUIPE EST SUR PLACE » N'EST PAS UNE PUNITION, C'EST LA RÉALITÉ :
  -- sept personnes se sont déplacées la nuit. Elles sont payées entièrement, et
  -- Quantinvo ne gagne rien de plus que sur une mission faite.
  v_sur_place := v_m.etat = 'en_cours' or now() >= v_m.arrivee_prevue;

  select * into v_palier
    from public.reglages_annulation
   where version = v_version and heures_avant <= greatest(v_heures, 0)
   order by heures_avant desc
   limit 1;

  if found then
    -- Vers le bas : en faveur du client.
    v_client := floor(v_m.prix_cents * v_palier.part_client / 100)::integer * 100;
    -- Vers le haut : en faveur de l'équipe.
    v_equipe := ceil(public.remuneration_totale(p_mission) * v_palier.part_equipe / 100)::integer * 100;
  end if;

  if v_sur_place then
    v_client := v_m.prix_cents;
    v_equipe := public.remuneration_totale(p_mission);
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'heures_avant', a.heures_avant,
           'client_cents', floor(v_m.prix_cents * a.part_client / 100)::integer * 100)
         order by a.heures_avant desc), '[]'::jsonb)
    into v_paliers
    from public.reglages_annulation a where a.version = v_version;

  return jsonb_build_object(
    'success', true,
    'gratuite_jusqu_au', v_m.annulation_gratuite_jusqu_au,
    'heures_restantes', round(v_heures, 1),
    'equipe_sur_place', v_sur_place,
    'a_payer_cents', v_client,
    'prix_cents', v_m.prix_cents,
    'paliers', v_paliers,
    -- ⚠️ Ce que l'équipe touche ne sort QUE pour la console : c'est un coût, et
    -- un client n'a pas à lire la paie des gens qui viennent chez lui.
    'equipe_cents', case when v_admin then v_equipe else null end);
end;
$function$;

revoke all on function public.frais_annulation(uuid) from public, anon;
grant execute on function public.frais_annulation(uuid) to authenticated, service_role;

-- ─── 3. Réserver ───────────────────────────────────────────────────────────
--
-- ⚠️ L'ENTREPRISE SE CRÉE ICI, SANS PAIEMENT, et c'est le point 41 du plan :
-- le compte est gratuit et n'engage à rien. Le parcours d'abonnement passe par
-- `company_requests` puis `fulfil_paid_request` parce qu'il y a un encaissement
-- à attendre ; On-Demand n'a rien à attendre — c'est la MISSION qui attend
-- l'empreinte bancaire pour devenir `confirmee`, pas le compte.
--
-- ⚠️ UNE ENTREPRISE PAR COMPTE, ET PAS DEUX. Un compte qui appartient déjà à
-- une entreprise réserve POUR ELLE ; il n'en ouvre pas une seconde. Sinon le
-- même parcours, joué deux fois, donnerait à une personne deux entreprises et
-- deux facturations — et c'est exactement ce que `finaliser_inscription`
-- refuse déjà de son côté (`deja_dans_une_entreprise`).
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
    v_cp);
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

revoke all on function public.reserver_ma_mission(jsonb) from public, anon;
grant execute on function public.reserver_ma_mission(jsonb) to authenticated;

-- ─── 4. Annuler ────────────────────────────────────────────────────────────
create or replace function public.annuler_ma_mission(p_mission uuid, p_motif text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_uid uuid := auth.uid();
  v_m record;
  v_frais jsonb;
begin
  if v_uid is null then
    return jsonb_build_object('success', false, 'code', 'non_connecte');
  end if;

  select * into v_m from public.missions where id = p_mission;
  if not found then
    return jsonb_build_object('success', false, 'code', 'introuvable');
  end if;

  -- La garde est sur la ligne visée, comme partout ailleurs.
  if not (public.is_admin()
          or v_m.company_id = (select p.company_id from public.profiles p where p.id = v_uid)) then
    return jsonb_build_object('success', false, 'code', 'interdit');
  end if;

  if v_m.etat in ('annulee', 'remboursee', 'terminee', 'payee', 'paiement_prestataires') then
    return jsonb_build_object('success', false, 'code', 'deja_fini');
  end if;
  -- ⚠️ UN INVENTAIRE COMMENCÉ NE S'ANNULE PAS DEPUIS UN NAVIGATEUR. L'équipe
  -- compte, les données arrivent : ça se règle au téléphone, et c'est un
  -- litige s'il le faut — pas un bouton.
  if v_m.etat = 'en_cours' then
    return jsonb_build_object('success', false, 'code', 'deja_commencee');
  end if;

  -- Lus AVANT le changement d'état : après, `frais_annulation` verrait une
  -- mission annulée et le montant n'aurait plus de sens.
  v_frais := public.frais_annulation(p_mission);

  update public.missions
     set etat = 'annulee',
         annulee_par = v_uid,
         motif = nullif(left(btrim(coalesce(p_motif, '')), 300), '')
   where id = p_mission;

  return jsonb_build_object(
    'success', true,
    'reference', v_m.reference,
    'a_payer_cents', v_frais -> 'a_payer_cents');
end;
$function$;

revoke all on function public.annuler_ma_mission(uuid, text) from public, anon;
grant execute on function public.annuler_ma_mission(uuid, text) to authenticated;
