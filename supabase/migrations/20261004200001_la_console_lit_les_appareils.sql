-- ⚠️ LA CONSOLE DISAIT « 0 APPAREIL », ET SON COMPTE NE TOMBAIT PAS JUSTE
-- (4 octobre 2026).
--
-- Deux défauts, vus sur l'écran d'une mission réelle :
--
--   · `admin_mission` ne rendait pas la colonne `appareils` dans l'objet
--     `mission` — elle n'existait pas encore quand la fonction a été écrite.
--     La console affichait donc le repli, `inventoristes`, qui vaut 0 pour une
--     location ;
--   · `frais_cents` venait de `calcul ->> 'frais_cents'`, une clé que la
--     grille à deux axes ne produit plus. Le tableau montrait « payé 145 €,
--     frais 0 €, reste 126 € » — un écart de 19 € qu'aucune ligne n'expliquait.
--     Ce qui manquait, c'est le coût réel, déjà retenu dans `cout_cents`.
--
-- ⚠️ Cette définition est celle qui tournait, à TROIS LIGNES près. Elle a été
-- reprise de `pg_get_functiondef` et patchée, pas recopiée.
CREATE OR REPLACE FUNCTION public.admin_mission(p_mission uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
      'appareils', v_m.appareils,
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
      'frais_cents', coalesce((v_m.calcul ->> 'frais_cents')::integer,
                              v_m.cout_cents - coalesce((v_m.calcul ->> 'equipe_cents')::integer, 0)),
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
$function$
;

-- `create or replace` rend EXECUTE à PUBLIC : on repose les droits.
revoke all on function public.admin_mission(uuid) from public, anon;
grant execute on function public.admin_mission(uuid) to authenticated, service_role;
