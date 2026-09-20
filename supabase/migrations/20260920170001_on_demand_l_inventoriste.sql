-- On-Demand : l'espace de l'inventoriste (20 septembre 2026)
--
-- Conception : docs/entreprise/on-demand/03-matching-et-score.md
-- Maquette   : Prestataire-Missions, Prestataire-Mission, Prestataire-Zone,
--              Prestataire-Profil, Prestataire-Verification,
--              Prestataire-Disponibilites, Prestataire-Revenus
--
-- ⚠️ CE QU'UN INVENTORISTE VOIT D'UNE MISSION DÉPEND DE S'IL L'A ACCEPTÉE.
-- Avant : le secteur, la ville, l'heure, la durée et ce qu'il touchera. Après :
-- l'adresse exacte et comment entrer. C'est la différence entre « une mission
-- près de chez vous » et « voici l'adresse et l'heure où ce magasin sera
-- ouvert et plein de stock » — une information qui n'a aucune raison de
-- circuler chez quelqu'un qui refuse.

-- ─── 1. La policy de lecture des missions, resserrée ───────────────────────
--
-- ⚠️ **CECI CORRIGE `missions_lire` DE LA MIGRATION DU 20 SEPTEMBRE
-- (`20260920130001`)**, qui ouvrait la ligne entière dès l'état `proposee`.
-- Un inventoriste qui refusait tout aurait pu ramasser l'adresse et l'heure de
-- chaque magasin servi. La proposition passe désormais par
-- `mes_propositions()`, qui ne rend pas l'adresse ; la ligne ne s'ouvre qu'une
-- fois la mission acceptée.
drop policy if exists missions_lire on public.missions;
create policy missions_lire on public.missions
  for select to authenticated
  using (
    company_id = (select p.company_id from public.profiles p where p.id = auth.uid())
    or public.is_admin()
    or exists (select 1 from public.mission_assignments ma
                where ma.mission_id = missions.id
                  and ma.user_id = auth.uid()
                  and ma.etat = 'acceptee')
  );

-- ─── 2. Ce qu'on me propose ────────────────────────────────────────────────
--
-- ⚠️ **LA RÉMUNÉRATION EST ANNONCÉE AVANT D'ACCEPTER, ET NE SE NÉGOCIE PAS.**
-- C'est le seul point du produit où l'inventoriste a une décision à prendre, et
-- il ne peut la prendre que s'il sait ce qu'il touche. Elle est figée sur la
-- ligne d'affectation au moment de la proposition : un changement de réglages
-- ne la déplace pas.
create or replace function public.mes_propositions()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  v_user uuid := auth.uid();
  v jsonb;
begin
  if v_user is null then
    return jsonb_build_object('success', false, 'code', 'non_connecte');
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'mission_id', m.id,
           'role', a.role,
           'secteur', m.secteur,
           -- ⚠️ LA VILLE, PAS L'ADRESSE. Elle suffit pour décider si on peut
           -- s'y rendre ; l'adresse exacte vient avec l'acceptation.
           'ville', coalesce(m.ville, m.code_postal, '—'),
           'code_postal', m.code_postal,
           'debut_prevu', m.debut_prevu,
           'arrivee_prevue', m.arrivee_prevue,
           'duree_minutes', m.duree_prevue_minutes,
           'remuneration_cents', a.remuneration_cents,
           'propose_le', a.propose_le)
         order by m.debut_prevu), '[]'::jsonb)
    into v
    from public.mission_assignments a
    join public.missions m on m.id = a.mission_id
   where a.user_id = v_user
     and a.etat = 'proposee'
     and m.etat in ('confirmee', 'en_constitution', 'equipe_complete', 'prete')
     and m.debut_prevu > now();

  return jsonb_build_object('success', true, 'propositions', v);
end;
$function$;

revoke all on function public.mes_propositions() from public, anon;
grant execute on function public.mes_propositions() to authenticated;

-- ─── 3. Accepter, ou refuser ───────────────────────────────────────────────
create or replace function public.repondre_a_une_mission(
  p_mission uuid, p_accepte boolean, p_motif text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_user uuid := auth.uid();
  v_a record;
  v_m record;
  v_places integer;
  v_pris integer;
begin
  if v_user is null then
    return jsonb_build_object('success', false, 'code', 'non_connecte');
  end if;

  -- ⚠️ La garde est sur la ligne visée : c'est l'existence de MA proposition
  -- sur CETTE mission qui autorise, jamais un rôle transmis.
  select * into v_a from public.mission_assignments
   where mission_id = p_mission and user_id = v_user;
  if not found then
    return jsonb_build_object('success', false, 'code', 'pas_propose');
  end if;
  if v_a.etat <> 'proposee' then
    return jsonb_build_object('success', false, 'code', 'deja_repondu', 'etat', v_a.etat);
  end if;

  select * into v_m from public.missions where id = p_mission;
  if v_m.debut_prevu <= now() then
    return jsonb_build_object('success', false, 'code', 'trop_tard');
  end if;

  if not p_accepte then
    update public.mission_assignments
       set etat = 'refusee', repondu_le = now(),
           motif = nullif(left(btrim(coalesce(p_motif, '')), 300), '')
     where mission_id = p_mission and user_id = v_user;
    return jsonb_build_object('success', true, 'etat', 'refusee');
  end if;

  -- ⚠️ ON REVÉRIFIE LA PLACE À L'ACCEPTATION, pas seulement à la proposition.
  -- Proposer à huit personnes pour six places est la bonne façon de constituer
  -- une équipe ; laisser les huit accepter en serait la mauvaise conclusion.
  select count(*) into v_pris from public.mission_assignments
   where mission_id = p_mission and role = v_a.role and etat = 'acceptee';
  v_places := case when v_a.role = 'responsable' then 1 else v_m.inventoristes end;
  if v_pris >= v_places then
    update public.mission_assignments
       set etat = 'remplacee', repondu_le = now(),
           motif = 'place déjà pourvue'
     where mission_id = p_mission and user_id = v_user;
    return jsonb_build_object('success', false, 'code', 'place_prise');
  end if;

  update public.mission_assignments
     set etat = 'acceptee', repondu_le = now()
   where mission_id = p_mission and user_id = v_user;

  -- L'équipe est-elle au complet ? Si oui, la mission avance toute seule — le
  -- client n'a rien à valider, et nous non plus.
  select count(*) into v_pris from public.mission_assignments
   where mission_id = p_mission and etat = 'acceptee';
  -- ⚠️ L'EFFECTIF COMPLET SE CALCULE AVANT LE TEST, dans une variable. Écrit
  -- en ligne — `if v_pris >= v_m.inventoristes + case … end and …` — le `end`
  -- du `case` est pris pour la fin du bloc et PL/pgSQL ne trouve plus son
  -- `then`. Le vérificateur de migrations l'a refusé ; en base, ce fichier
  -- aurait échoué à mi-transaction.
  v_places := v_m.inventoristes + case when v_m.responsable then 1 else 0 end;
  if v_pris >= v_places and v_m.etat = 'en_constitution' then
    update public.missions set etat = 'equipe_complete' where id = p_mission;
  end if;

  return jsonb_build_object('success', true, 'etat', 'acceptee');
end;
$function$;

revoke all on function public.repondre_a_une_mission(uuid, boolean, text) from public, anon;
grant execute on function public.repondre_a_une_mission(uuid, boolean, text) to authenticated;

-- ─── 4. Mon espace ─────────────────────────────────────────────────────────
--
-- ⚠️ UNE SEULE RÉPONSE POUR TOUT L'ÉCRAN D'ACCUEIL : le profil, ce qu'il reste
-- à vérifier, les disponibilités, les missions acceptées et les revenus. Cinq
-- appels auraient fait cinq allers-retours sur un téléphone en 4G, dans un
-- parking de magasin.
create or replace function public.mon_espace_inventoriste()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  v_user uuid := auth.uid();
  v_p record;
  v_prof record;
  v_dispos jsonb;
  v_missions jsonb;
  v_a_venir integer;
  v_verse integer;
begin
  if v_user is null then
    return jsonb_build_object('success', false, 'code', 'non_connecte');
  end if;

  select * into v_p from public.provider_profiles where user_id = v_user;
  if not found then
    return jsonb_build_object('success', true, 'profil', null);
  end if;

  select first_name, last_name into v_prof from public.profiles where id = v_user;

  select coalesce(jsonb_agg(jsonb_build_object(
           'jour', d.jour, 'debut', d.debut, 'fin', d.fin) order by d.jour), '[]'::jsonb)
    into v_dispos
    from public.provider_availability d where d.user_id = v_user;

  -- Les missions acceptées : ici l'adresse EST rendue, la personne s'y rend.
  select coalesce(jsonb_agg(jsonb_build_object(
           'mission_id', m.id,
           'role', a.role,
           'secteur', m.secteur,
           'magasin', m.magasin_nom,
           'adresse', m.adresse,
           'code_postal', m.code_postal,
           'ville', m.ville,
           'acces_sur_place', m.acces_sur_place,
           'debut_prevu', m.debut_prevu,
           'arrivee_prevue', m.arrivee_prevue,
           'duree_minutes', m.duree_prevue_minutes,
           'remuneration_cents', a.remuneration_cents,
           'pointe_le', a.pointe_le,
           'etat_mission', m.etat,
           'inventory_session_id', case when m.etat in ('en_cours', 'controle_qualite')
                                        then m.inventory_session_id else null end)
         order by m.debut_prevu), '[]'::jsonb)
    into v_missions
    from public.mission_assignments a
    join public.missions m on m.id = a.mission_id
   where a.user_id = v_user and a.etat = 'acceptee'
     and m.etat not in ('annulee', 'remboursee', 'echouee')
     and m.debut_prevu > now() - interval '24 hours';

  select coalesce(sum(a.remuneration_cents), 0) into v_a_venir
    from public.mission_assignments a
    join public.missions m on m.id = a.mission_id
   where a.user_id = v_user and a.etat = 'acceptee'
     and m.etat in ('terminee', 'controle_qualite');

  select coalesce(sum(a.remuneration_cents), 0) into v_verse
    from public.mission_assignments a
    join public.missions m on m.id = a.mission_id
   where a.user_id = v_user and a.etat = 'acceptee' and m.etat = 'payee';

  return jsonb_build_object(
    'success', true,
    'profil', jsonb_build_object(
      'prenom', coalesce(v_prof.first_name, '—'),
      'nom', coalesce(v_prof.last_name, ''),
      'etat', v_p.etat,
      'niveau', v_p.niveau,
      'forme_juridique', v_p.forme_juridique,
      'siret', v_p.siret,
      'experience_annees', v_p.experience_annees,
      'secteurs', v_p.secteurs,
      'langues', v_p.langues,
      'mobilite', v_p.mobilite,
      'rayon_km', v_p.rayon_km,
      'verifie_le', v_p.verifie_le,
      -- ⚠️ CE QUE STRIPE DIT, PAS CE QU'ON DÉCIDE. `paiements_ouverts` recopie
      -- `payouts_enabled` : Quantinvo ne voit ni les papiers ni le compte
      -- bancaire, et n'a pas à trancher à la place de son prestataire de
      -- paiement. Tant que c'est faux, on ne peut pas verser — et on le dit.
      'paiements_ouverts', v_p.paiements_ouverts,
      'compte_paiement_ouvert', v_p.stripe_account_id is not null),
    'missions_faites', (select count(*) from public.mission_assignments a2
                         join public.missions m2 on m2.id = a2.mission_id
                        where a2.user_id = v_user and a2.etat = 'acceptee'
                          and m2.etat in ('terminee', 'payee', 'paiement_prestataires')),
    'disponibilites', v_dispos,
    'missions', v_missions,
    'revenus', jsonb_build_object('a_venir_cents', v_a_venir, 'verse_cents', v_verse));
end;
$function$;

revoke all on function public.mon_espace_inventoriste() from public, anon;
grant execute on function public.mon_espace_inventoriste() to authenticated;

-- ─── 5. Ma zone, sur place ─────────────────────────────────────────────────
--
-- Maquette Prestataire-Zone. ⚠️ Elle ne rend RIEN tant que l'accès n'est pas
-- ouvert : c'est `a_un_acces_mission` qui décide, et son expiration est lue à
-- chaque appel. Une personne affectée mais dont la mission n'a pas commencé
-- n'a pas à voir les zones du magasin d'un client.
create or replace function public.ma_zone_de_mission(p_mission uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  v_session uuid;
  v_zone jsonb;
begin
  select m.inventory_session_id into v_session from public.missions m where m.id = p_mission;
  if v_session is null then
    return jsonb_build_object('success', false, 'code', 'pas_encore');
  end if;
  if not public.a_un_acces_mission(v_session) then
    return jsonb_build_object('success', false, 'code', 'interdit');
  end if;

  -- ⚠️ `session_id` et `zones` sont ceux de Quantinvo OS : le comptage d'une
  -- mission EST un comptage Quantinvo, et l'écran de scan est le même. On ne
  -- rend ici que de quoi ouvrir le bon.
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', z.id, 'nom', z.name, 'statut', z.status) order by z.name), '[]'::jsonb)
    into v_zone
    from public.zones z where z.session_id = v_session;

  return jsonb_build_object(
    'success', true, 'session_id', v_session, 'zones', v_zone);
end;
$function$;

revoke all on function public.ma_zone_de_mission(uuid) from public, anon;
grant execute on function public.ma_zone_de_mission(uuid) to authenticated;
