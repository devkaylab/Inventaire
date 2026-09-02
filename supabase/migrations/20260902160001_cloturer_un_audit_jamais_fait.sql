-- « Marquer auditée » reprend le comptage quand personne n'a audité.
--
-- CONSTAT de Julien, 2 septembre 2026 : « marquer auditée alors qu'il n'y a pas
-- de quantité auditée doit prendre le compte d'origine, c'est-à-dire celui du
-- compteur ».
--
-- Jusqu'ici, ce bouton ne faisait que basculer `zones.audit_status` à « done ».
-- La conséquence se lisait ailleurs, et elle était fausse : l'audit étant
-- déclaré terminé, l'écart devient calculable — et toutes les références de la
-- balise sortaient à **moins la totalité du comptage**, comme si l'auditeur
-- était passé et n'avait rien trouvé. Un superviseur qui range un audit que
-- personne n'a fait fabriquait ainsi une démarque intégrale sur ce rayon.
--
-- Reprendre le comptage dit la seule chose vraie dans ce cas : personne n'a
-- recompté, il n'y a donc rien à opposer au comptage.

-- ⚠️ SEULEMENT SI LA BALISE N'A AUCUNE LIGNE DE PASSE 2, jamais référence par
-- référence. La différence est celle qui protège le produit :
--
--   · aucune ligne d'audit sur la balise → personne n'est passé, il n'existe
--     aucun jugement d'auditeur à contredire. On reprend, sans rien effacer ;
--   · l'auditeur est passé et n'a PAS retrouvé un article compté → c'est
--     précisément la démarque que l'inventaire existe pour révéler. Reprendre
--     le comptage sur cette référence l'effacerait en silence.
--
-- Une balise auditée à moitié reste donc telle quelle : ses références non
-- auditées gardent leur écart. Ne pas « compléter » cette fonction en la
-- passant par SKU.
--
-- ⚠️ ELLE ÉCRIT DE VRAIES LIGNES DE COMPTAGE, et c'est obligatoire :
-- `article_audit` est **dérivée** de `counts` par `recompute_session_audit`.
-- Poser `final_qty` à la main serait défait au premier recalcul, que l'onglet
-- Écarts déclenche à la demande. Les lignes portent `counted_by = auth.uid()` :
-- c'est le superviseur qui prend la responsabilité de cette reprise, et le
-- rapport doit pouvoir le nommer.
--
-- ⚠️ RÉSERVÉE AU SITE. L'application mobile garde `set_balise` : un auditeur
-- qui est physiquement devant le rayon et n'a rien scanné n'a rien trouvé —
-- lui reprendre le comptage effacerait son constat.

create or replace function public.cloturer_audit_balise(p_session_id uuid, p_code text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_key text; v_zone text; v_reprises int := 0;
begin
  if not public.can_access_session(p_session_id) then
    return jsonb_build_object('success', false, 'error', 'Accès refusé');
  end if;

  if not exists (select 1 from public.inventory_sessions s
                 where s.id = p_session_id and s.status <> 'closed') then
    return jsonb_build_object('success', false, 'error', 'Inventaire clôturé');
  end if;

  v_key := public.norm_balise(p_code);
  if v_key = '' then
    return jsonb_build_object('success', false, 'error', 'Balise invalide');
  end if;

  select z.code into v_zone
  from public.zones z
  where z.session_id = p_session_id and public.norm_balise(z.code) = v_key
  for update;
  if not found then
    return jsonb_build_object('success', false, 'error', 'Balise non définie');
  end if;

  if not exists (
    select 1 from public.counts c
    where c.session_id = p_session_id
      and public.norm_balise(coalesce(c.zone, '')) = v_key
      and c.pass_number = 2
  ) then
    -- Une ligne par référence dont il reste quelque chose. Une référence
    -- ramenée à zéro par des corrections n'est pas reprise : il n'y a rien à
    -- confirmer, et `counts` est en ajout pur.
    insert into public.counts (session_id, sku, pass_number, qty, counted_by, zone)
    select p_session_id, c.sku, 2, sum(c.qty), auth.uid(), v_zone
    from public.counts c
    where c.session_id = p_session_id
      and public.norm_balise(coalesce(c.zone, '')) = v_key
      and c.pass_number = 1
    group by c.sku
    having sum(c.qty) > 0;
    get diagnostics v_reprises = row_count;
  end if;

  update public.zones z
  set audit_status = 'done', audit_done_at = now()
  where z.session_id = p_session_id and public.norm_balise(z.code) = v_key;

  -- `article_audit` se dérive de `counts` : sans ce recalcul, l'onglet Écarts
  -- continuerait d'afficher l'état d'avant jusqu'à ce que quelqu'un le demande.
  perform public.recompute_session_audit(p_session_id);

  return jsonb_build_object('success', true, 'code', v_zone, 'reprises', v_reprises);
end; $$;

revoke all on function public.cloturer_audit_balise(uuid, text) from public, anon;
grant execute on function public.cloturer_audit_balise(uuid, text) to authenticated, service_role;
