-- ⚠️ ANNULER UNE LOCATION EST GRATUIT (4 octobre 2026).
--
-- Décision de Julien, en même temps que le cap : « 1 pas de frais ».
--
-- Les frais existaient pour une raison précise, et elle a disparu : ils
-- payaient les inventoristes qui s'étaient rendus disponibles pour une nuit.
-- L'écran le disait mot pour mot. Plus personne ne se rend disponible : des
-- frais sans cette raison ne seraient plus qu'une punition.
--
-- ⚠️ ON NE SUPPRIME NI `reglages_annulation` NI `remuneration_totale` : la
-- formule équipe est fermée, pas effacée, et ses paliers sont des valeurs
-- validées. La fonction cesse de les lire, voilà tout.
--
-- ⚠️ Et `annuler_ma_mission` n'a pas besoin d'être reprise : elle lit
-- `a_payer_cents` d'ici. Zéro arrive de lui-même.

create or replace function public.frais_annulation(p_mission uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  v_m      record;
  v_heures numeric;
  v_admin  boolean := public.is_admin();
begin
  select * into v_m from public.missions where id = p_mission;
  if not found then
    return jsonb_build_object('success', false, 'code', 'introuvable');
  end if;

  -- La garde porte sur la ligne visée, jamais sur un paramètre de l'appelant.
  if not (v_admin
          or v_m.company_id = (select p.company_id from public.profiles p where p.id = auth.uid())) then
    return jsonb_build_object('success', false, 'code', 'interdit');
  end if;

  v_heures := extract(epoch from (v_m.debut_prevu - now())) / 3600;

  -- ⚠️ `equipe_sur_place` GARDE SON NOM, et ce n'est pas de la paresse : c'est
  -- le même moment — le créneau commencé — et le renommer imposerait de
  -- reprendre l'appelant pour un mot. Ce qu'il dit a changé : l'inventaire a
  -- démarré, donc il ne s'annule plus tout seul.
  return jsonb_build_object(
    'success', true,
    'gratuite_jusqu_au', null,
    'heures_restantes', round(v_heures, 1),
    'equipe_sur_place', v_m.etat = 'en_cours' or now() >= v_m.arrivee_prevue,
    -- ⚠️ ZÉRO, TOUJOURS. Pas « zéro aujourd'hui parce que le palier le dit » :
    -- zéro parce qu'il n'y a plus personne à dédommager.
    'a_payer_cents', 0,
    'prix_cents', v_m.prix_cents,
    'paliers', '[]'::jsonb,
    'equipe_cents', 0);
end;
$function$;

revoke all on function public.frais_annulation(uuid) from public, anon;
grant execute on function public.frais_annulation(uuid) to authenticated, service_role;
