-- ─────────────────────────────────────────────────────────────────────────
-- Total du stock théorique attendu sur un inventaire.
--
-- Le tableau de bord annonçait « X / Y références » — un décompte de lignes,
-- pas une quantité. Or ce que le superviseur compare sur le terrain, c'est un
-- nombre de pièces : combien sont attendues, combien ont été scannées. Le
-- décompte de références répondait à une question que personne ne se pose.
--
-- PostgREST ne sait pas agréger sans vue ni fonction, et rapatrier toutes les
-- lignes de `theoretical_stock` pour les sommer côté navigateur serait absurde
-- sur un inventaire de plusieurs milliers de références. D'où cette fonction.
--
-- Renvoie 0 — et non NULL — quand aucun stock théorique n'est importé : c'est
-- un état normal (le fichier est optionnel), que l'interface explique.
--
-- Appliquée en base live via l'outil MCP.
-- ─────────────────────────────────────────────────────────────────────────

create or replace function public.get_session_theoretical_total(p_session_id uuid)
returns numeric
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
begin
  if not public.can_access_session(p_session_id) then
    raise exception 'forbidden';
  end if;
  return coalesce(
    (select sum(ts.theoretical_qty) from public.theoretical_stock ts
      where ts.session_id = p_session_id),
    0);
end;
$function$;

revoke all on function public.get_session_theoretical_total(uuid) from public, anon;
grant execute on function public.get_session_theoretical_total(uuid) to authenticated;
