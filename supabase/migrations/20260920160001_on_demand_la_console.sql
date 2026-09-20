-- On-Demand : la console d'administration (20 septembre 2026)
--
-- Conception : docs/entreprise/on-demand/03-matching-et-score.md
-- Maquette   : Admin-Missions, Admin-Mission, Admin-Matching
--
-- ⚠️ TOUTE FONCTION `admin_*` JOURNALISE DANS LA MÊME TRANSACTION QUE SON
-- ACTION, avec son test de garde (règle d'AGENTS.md). Une console qui affecte
-- des gens à des missions de nuit et qui déclenche des versements ne peut pas
-- avoir de geste anonyme.
--
-- ⚠️ ET ELLE RENVOIE CE QU'UN CLIENT NE VOIT PAS : coût, marge, rémunérations.
-- C'est la raison d'être de ces fonctions — la RLS choisit des lignes, pas des
-- colonnes, et `missions` retient `cout_cents` et `calcul` par un grant
-- nominatif. Ici, `is_admin()` est le seul laissez-passer.

-- ─── 1. La liste des missions ──────────────────────────────────────────────
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
           m.inventoristes, m.responsable,
           m.prix_cents, m.cout_cents,
           m.prix_cents - m.cout_cents as marge_cents,
           case when m.prix_cents = 0 then 0
                else round((m.prix_cents - m.cout_cents)::numeric / m.prix_cents, 4) end as marge,
           -- L'effectif VOULU et l'effectif ACQUIS : c'est la seule colonne que
           -- la maquette met en tête, parce que c'est elle qui décide s'il faut
           -- agir aujourd'hui.
           m.inventoristes + case when m.responsable then 1 else 0 end as places,
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

-- ─── 2. Une mission, en entier ─────────────────────────────────────────────
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

-- ─── 3. Qui pourrait faire cette mission ───────────────────────────────────
--
-- ⚠️ **CETTE FONCTION N'ÉCARTE PERSONNE, ELLE CLASSE.** Un score ou un filtre
-- qui retire automatiquement quelqu'un d'une mission est une décision
-- automatisée au sens de l'article 22 du RGPD : il faut pouvoir l'expliquer et
-- permettre une intervention humaine. Chaque profil sort donc avec `retenu`
-- ET `pourquoi` — l'écran montre d'abord les retenus, « Élargir » montre les
-- autres, et rien n'est caché.
--
-- ⚠️ **ET IL N'Y A PAS DE DISTANCE, PARCE QU'ON NE SAIT PAS LA CALCULER.** Ni
-- `stores` ni `provider_profiles` ne portent de coordonnées, et aucun service
-- de géocodage n'est branché. La maquette affiche « 3,2 km » ; ce qu'on peut
-- honnêtement dire aujourd'hui, c'est « même département » et le rayon que la
-- personne a déclaré. Un kilométrage inventé se lirait comme une mesure.
create or replace function public.admin_candidats_mission(p_mission uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  v_m record;
  v_jour smallint;
  v_debut time;
  v_fin time;
  v jsonb;
begin
  if not public.is_admin() then
    return jsonb_build_object('success', false, 'error', 'Accès refusé');
  end if;

  select * into v_m from public.missions where id = p_mission;
  if not found then
    return jsonb_build_object('success', false, 'error', 'Mission introuvable');
  end if;

  v_jour  := extract(isodow from (v_m.arrivee_prevue at time zone 'Europe/Paris'))::smallint;
  v_debut := (v_m.arrivee_prevue at time zone 'Europe/Paris')::time;
  v_fin   := ((v_m.debut_prevu + make_interval(mins => v_m.duree_prevue_minutes))
               at time zone 'Europe/Paris')::time;

  select coalesce(jsonb_agg(c order by c.rang desc, c.missions_faites desc), '[]'::jsonb) into v
  from (
    select
      pp.user_id,
      coalesce(p.first_name, '—') as prenom,
      coalesce(p.last_name, '')   as nom,
      pp.niveau,
      pp.etat,
      pp.secteurs,
      pp.rayon_km,
      pp.mobilite,
      pp.paiements_ouverts,
      (select count(*) from public.mission_assignments a
        where a.user_id = pp.user_id and a.etat = 'acceptee') as missions_faites,
      dispo.ok as disponible,
      (v_m.secteur = any (pp.secteurs)) as secteur_connu,
      occupe.ok as deja_pris,
      -- Le classement : disponibilité d'abord, puis secteur, puis niveau. Il
      -- n'entre AUCUN score dans ce calcul — il n'y en a pas encore, et le
      -- document du matching dit de ne pas en inventer un.
      (case when dispo.ok then 4 else 0 end
       + case when v_m.secteur = any (pp.secteurs) then 2 else 0 end
       + case pp.niveau when 'responsable' then 2 when 'expert' then 2
              when 'confirme' then 1 else 0 end
       - case when occupe.ok then 10 else 0 end) as rang,
      (pp.etat in ('verifie', 'actif')
       and pp.paiements_ouverts
       and not occupe.ok) as retenu,
      case
        when occupe.ok then 'Déjà sur une mission ce soir'
        when pp.etat not in ('verifie', 'actif') then 'Profil non vérifié'
        when not pp.paiements_ouverts then 'Compte de paiement incomplet chez Stripe'
        when not dispo.ok then 'Hors des disponibilités déclarées'
        when not (v_m.secteur = any (pp.secteurs)) then 'Jamais compté dans ce secteur'
        else 'Disponible, secteur connu'
      end as pourquoi
    from public.provider_profiles pp
    join public.profiles p on p.id = pp.user_id
    cross join lateral (
      select exists (
        select 1 from public.provider_availability d
         where d.user_id = pp.user_id and d.jour = v_jour
           and d.debut <= v_debut
           -- Un créneau qui passe minuit a sa fin AVANT son début.
           and (d.fin >= v_fin or d.fin < d.debut)
      ) as ok
    ) dispo
    cross join lateral (
      select exists (
        select 1 from public.mission_assignments a
          join public.missions m2 on m2.id = a.mission_id
         where a.user_id = pp.user_id
           and a.etat in ('proposee', 'acceptee')
           and m2.id <> v_m.id
           and m2.etat not in ('annulee', 'echouee', 'remboursee')
           and tstzrange(m2.arrivee_prevue,
                         m2.debut_prevu + make_interval(mins => m2.duree_prevue_minutes))
               && tstzrange(v_m.arrivee_prevue,
                            v_m.debut_prevu + make_interval(mins => v_m.duree_prevue_minutes))
      ) as ok
    ) occupe
    where not exists (
      select 1 from public.mission_assignments a
       where a.mission_id = v_m.id and a.user_id = pp.user_id
         and a.etat in ('proposee', 'acceptee')
    )
  ) c;

  return jsonb_build_object(
    'success', true,
    'creneau', jsonb_build_object('jour', v_jour, 'debut', v_debut, 'fin', v_fin),
    'code_postal', v_m.code_postal,
    'secteur', v_m.secteur,
    'candidats', v);
end;
$function$;

revoke all on function public.admin_candidats_mission(uuid) from public, anon;
grant execute on function public.admin_candidats_mission(uuid) to authenticated;

-- ─── 4. Proposer une mission à quelqu'un ───────────────────────────────────
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

-- ─── 5. Retirer quelqu'un ──────────────────────────────────────────────────
--
-- ⚠️ `retiree` PLUTÔT QUE SUPPRIMER LA LIGNE. Un désistement est un fait : il
-- compte dans le score de la personne, il explique pourquoi une équipe est
-- redevenue incomplète, et il se lit dans le journal. Effacer la ligne
-- effacerait l'explication.
create or replace function public.admin_retirer_de_la_mission(
  p_mission uuid, p_user uuid, p_motif text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_m record;
begin
  if not public.is_admin() then
    return jsonb_build_object('success', false, 'error', 'Accès refusé');
  end if;

  select * into v_m from public.missions where id = p_mission;
  if not found then
    return jsonb_build_object('success', false, 'error', 'Mission introuvable');
  end if;

  update public.mission_assignments
     set etat = 'retiree', repondu_le = now(),
         motif = nullif(left(btrim(coalesce(p_motif, '')), 300), '')
   where mission_id = p_mission and user_id = p_user
     and etat in ('proposee', 'acceptee');
  if not found then
    return jsonb_build_object('success', false, 'error', 'Cette personne n''est pas sur la mission.');
  end if;

  -- ⚠️ ET L'ACCÈS SE FERME AVEC. Une personne retirée d'une mission en cours
  -- garderait sinon la porte de l'inventaire d'un client ouverte jusqu'à
  -- l'expiration. Le passage par la table, ici, est volontaire : c'est un
  -- retrait individuel, pas la fin de la mission.
  update public.mission_access
     set expire_le = least(expire_le, now())
   where mission_id = p_mission and user_id = p_user and expire_le > now();

  -- L'équipe n'est plus complète : la mission redescend d'un cran. C'est le
  -- « désistement » de la maquette, et c'est un chemin normal.
  if v_m.etat in ('equipe_complete', 'prete') then
    update public.missions set etat = 'en_constitution' where id = p_mission;
  end if;

  perform public.log_admin_action(
    'mission_retrait', 'mission', p_mission::text, v_m.reference,
    jsonb_build_object('user_id', p_user, 'motif', p_motif));

  return jsonb_build_object('success', true);
end;
$function$;

revoke all on function public.admin_retirer_de_la_mission(uuid, uuid, text) from public, anon;
grant execute on function public.admin_retirer_de_la_mission(uuid, uuid, text) to authenticated;

-- ─── 6. Faire avancer une mission ──────────────────────────────────────────
--
-- ⚠️ ELLE NE CONNAÎT PAS LES TRANSITIONS, ET C'EST VOULU. Le déclencheur
-- `missions_transition` les porte déjà ; les recopier ici donnerait deux
-- vérités qui divergeraient. Cette fonction pose l'état demandé et laisse la
-- base refuser — le message remonte tel quel.
create or replace function public.admin_avancer_mission(p_mission uuid, p_etat text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_m record;
begin
  if not public.is_admin() then
    return jsonb_build_object('success', false, 'error', 'Accès refusé');
  end if;

  select * into v_m from public.missions where id = p_mission;
  if not found then
    return jsonb_build_object('success', false, 'error', 'Mission introuvable');
  end if;

  -- ⚠️ `en_cours` OUVRE LES ACCÈS DE TOUTE L'ÉQUIPE : sans inventaire, ils
  -- n'ouvrent sur rien. On le crée d'abord, une seule fois.
  if p_etat = 'en_cours' and v_m.inventory_session_id is null then
    perform public.creer_la_session_de_mission(p_mission);
  end if;

  begin
    update public.missions set etat = p_etat where id = p_mission;
  exception when check_violation then
    return jsonb_build_object('success', false, 'code', 'transition',
      'error', 'Cette mission ne peut pas passer de « ' || v_m.etat || ' » à « ' || p_etat || ' ».');
  end;

  perform public.log_admin_action(
    'mission_etat', 'mission', p_mission::text, v_m.reference,
    jsonb_build_object('de', v_m.etat, 'vers', p_etat));

  return jsonb_build_object('success', true, 'etat', p_etat);
end;
$function$;

revoke all on function public.admin_avancer_mission(uuid, text) from public, anon;
grant execute on function public.admin_avancer_mission(uuid, text) to authenticated;
