-- On-Demand : régler le prix, et suivre l'argent (20 septembre 2026)
--
-- Maquette : Admin-Prix et Admin-Paiements.
-- Conception : docs/entreprise/on-demand/02-le-prix.md § 4, 04-economie-et-tva.md

-- ─── 1. Poser une version de réglages ──────────────────────────────────────
--
-- ⚠️ **UNE VERSION NE SE MODIFIE PAS, ON EN POSE UNE NEUVE.** C'est ce qui
-- permet de relire, dans un an, le prix d'une mission vendue aujourd'hui : elle
-- porte son numéro de version, et ce numéro pointe sur des valeurs qui n'ont
-- pas bougé. Un `update` sur la ligne en vigueur réécrirait l'histoire de
-- toutes les missions passées.
--
-- ⚠️ **ET LES MISSIONS DÉJÀ RÉSERVÉES NE BOUGENT PAS.** Le déclencheur
-- `missions_prix_fige` les tient ; cette fonction ne les touche pas.
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
    marge_cible, marge_minimum, en_vigueur, pose_par, note)
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

-- ─── 2. Ce que le prix donne sur une mission type ──────────────────────────
--
-- ⚠️ **L'APERÇU PASSE PAR LE MOTEUR, IL NE LE REFAIT PAS.** La console montre
-- « sur une mission type : 6 + 1, 4 h 30, 666 €, 949 €, 25,0 % ». Recalculer
-- ces six nombres dans la page donnerait une septième copie de la chaîne, et
-- c'est elle qu'on lirait en décidant d'un taux horaire.
create or replace function public.admin_apercu_prix(
  p_articles integer default 20000, p_secteur text default 'textile')
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
    'tous', '75001');
end;
$function$;

revoke all on function public.admin_apercu_prix(integer, text) from public, anon;
grant execute on function public.admin_apercu_prix(integer, text) to authenticated;

-- ─── 3. L'argent, sur une période ──────────────────────────────────────────
--
-- ⚠️ **QUATRE NOMBRES QUI S'ADDITIONNENT, PAS CINQ QUI SE RESSEMBLENT.**
-- Encaissé − versé − frais = ce qui reste. Si les quatre ne se recomposent pas
-- à l'euro près, c'est que l'un d'eux ment — et ce tableau est ce qu'on regarde
-- pour décider d'un prix.
--
-- ⚠️ **ET LE VERSÉ EST CELUI DES AFFECTATIONS ACCEPTÉES**, pas la ligne
-- `equipe_cents` du calcul. Les deux coïncident sur une mission servie à
-- l'effectif prévu ; ils divergent dès qu'une place est restée vide — et c'est
-- la réalité des versements qui compte, pas la prévision.
create or replace function public.admin_paiements(
  p_debut timestamptz default date_trunc('month', now()),
  p_fin timestamptz default now())
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  v_encaisse integer := 0;
  v_frais integer := 0;
  v_nb integer := 0;
  v_verse integer := 0;
  v_personnes integer := 0;
  v_du jsonb;
begin
  if not public.is_admin() then
    return jsonb_build_object('success', false, 'error', 'Accès refusé');
  end if;

  select coalesce(sum(m.prix_cents), 0),
         coalesce(sum((m.calcul ->> 'frais_cents')::integer), 0),
         count(*)
    into v_encaisse, v_frais, v_nb
    from public.missions m
   where m.etat in ('terminee', 'paiement_prestataires', 'payee')
     and m.terminee_le >= p_debut and m.terminee_le < p_fin;

  select coalesce(sum(a.remuneration_cents), 0), count(distinct a.user_id)
    into v_verse, v_personnes
    from public.mission_assignments a
    join public.missions m on m.id = a.mission_id
   where a.etat = 'acceptee'
     and m.etat in ('terminee', 'paiement_prestataires', 'payee')
     and m.terminee_le >= p_debut and m.terminee_le < p_fin;

  -- Ce qui reste à verser, personne par personne. ⚠️ `paiements_ouverts` dit si
  -- Stripe accepte de verser : quand c'est faux, la personne garde son dû et
  -- l'écran doit dire que c'est Stripe qui bloque, pas nous.
  select coalesce(jsonb_agg(jsonb_build_object(
           'user_id', a.user_id,
           'prenom', coalesce(p.first_name, '—'),
           'nom', coalesce(p.last_name, ''),
           'niveau', coalesce(pp.niveau, 'nouveau'),
           'role', a.role,
           'mission', m.magasin_nom,
           'debut_prevu', m.debut_prevu,
           'montant_cents', a.remuneration_cents,
           'paiements_ouverts', coalesce(pp.paiements_ouverts, false),
           'compte_ouvert', pp.stripe_account_id is not null)
         order by m.debut_prevu), '[]'::jsonb)
    into v_du
    from public.mission_assignments a
    join public.missions m on m.id = a.mission_id
    join public.profiles p on p.id = a.user_id
    left join public.provider_profiles pp on pp.user_id = a.user_id
   where a.etat = 'acceptee' and m.etat in ('terminee', 'paiement_prestataires');

  return jsonb_build_object(
    'success', true,
    'debut', p_debut, 'fin', p_fin,
    'encaisse_cents', v_encaisse, 'inventaires', v_nb,
    'verse_cents', v_verse, 'personnes', v_personnes,
    'frais_cents', v_frais,
    'reste_cents', v_encaisse - v_verse - v_frais,
    'marge', case when v_encaisse = 0 then 0
                  else round((v_encaisse - v_verse - v_frais)::numeric / v_encaisse, 4) end,
    'a_verser', v_du);
end;
$function$;

revoke all on function public.admin_paiements(timestamptz, timestamptz) from public, anon;
grant execute on function public.admin_paiements(timestamptz, timestamptz) to authenticated;
