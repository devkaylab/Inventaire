-- Le rapport d'un inventaire de 30 000 références (3 septembre 2026)
--
-- Trouvé en mesurant la migration précédente : `get_session_detail` — le
-- tableau ligne à ligne du Rapport, et sa source d'export — dépassait elle
-- aussi le délai serveur sur 29 389 références, alors qu'elle est
-- `SECURITY DEFINER` donc hors RLS. Même famille que
-- `recompute_session_audit` : le PLAN s'effondre quand les statistiques sont
-- périmées, c'est-à-dire juste après un import.
--
-- ⚠️ LA CAUSE ÉTAIT LA CTE JOINTE À ELLE-MÊME. `c` était découpée en `cnt`
-- (passe 1) et `aud` (passe 2), réunies par `k`, puis RE-JOINTES deux fois.
-- Une CTE n'a aucune statistique : le planificateur devine, et s'il devine
-- petit il choisit une boucle imbriquée — soit 29 389 × 29 389 parcours.
--
-- La réécriture fait UNE SEULE passe d'agrégation avec des `filter`, puis deux
-- jointures sur des tables indexées (`articles_session_sku_key`,
-- `zones_session_id_code_key`). Il n'y a plus de jointure sans statistiques,
-- donc plus de plan à rater.
--
-- Le résultat est identique colonne par colonne — y compris `audited`, qui
-- valait « il existe une ligne de passe 2 » et vaut maintenant « la somme
-- filtrée sur la passe 2 n'est pas nulle », ce qui est la même chose.
create or replace function public.get_session_detail(p_session_id uuid)
returns table(
  sku text, ean text, brand text, label text, zone text, zone_name text,
  counted_qty numeric, counted_by text,
  audited boolean, audited_qty numeric, audited_by text
)
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
begin
  if not public.can_access_session(p_session_id) then raise exception 'forbidden'; end if;

  return query
  with agg as (
    select c.sku as a_sku,
           coalesce(c.zone, '') as a_zone,
           sum(c.qty) filter (where c.pass_number = 1) as q1,
           sum(c.qty) filter (where c.pass_number = 2) as q2,
           string_agg(distinct p.full_name, ', ') filter (where c.pass_number = 1) as who1,
           string_agg(distinct p.full_name, ', ') filter (where c.pass_number = 2) as who2
    from public.counts c
    left join public.profiles p on p.id = c.counted_by
    where c.session_id = p_session_id
    group by c.sku, coalesce(c.zone, '')
  )
  select agg.a_sku,
         a.ean, a.brand, a.label,
         nullif(agg.a_zone, '')          as zone,
         z.name                          as zone_name,
         coalesce(agg.q1, 0)::numeric    as counted_qty,
         agg.who1                        as counted_by,
         (agg.q2 is not null)            as audited,
         coalesce(agg.q2, 0)::numeric    as audited_qty,
         agg.who2                        as audited_by
  from agg
  left join public.articles a on a.session_id = p_session_id and a.sku = agg.a_sku
  left join public.zones    z on z.session_id = p_session_id and z.code = nullif(agg.a_zone, '')
  where coalesce(agg.q1, 0) <> 0 or coalesce(agg.q2, 0) <> 0
  order by z.name nulls last, nullif(agg.a_zone, ''), a.label, agg.a_sku;
end; $function$;

revoke all on function public.get_session_detail(uuid) from public, anon;
grant execute on function public.get_session_detail(uuid) to authenticated, service_role;
