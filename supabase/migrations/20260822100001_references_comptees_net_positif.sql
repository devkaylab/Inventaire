-- « Références comptées » ne compte que celles dont il reste quelque chose.
--
-- Décision de Julien, 22 août 2026. La table `counts` est append-only : une
-- correction est une ligne négative. Un article scanné puis entièrement
-- corrigé a donc des lignes, mais un net nul — il figurait pourtant dans le
-- décompte des références, qui annonçait « 25 références comptées » là où il
-- n'en restait que 23 avec du stock.
--
-- Le décompte porte maintenant sur le **net par SKU**, strictement positif.
-- Un net négatif (anomalie de saisie) est exclu par la même condition : il ne
-- reste rien non plus.
--
-- Les deux totaux de PIÈCES ne bougent pas : sommer par SKU puis additionner
-- donne le même résultat que sommer directement. Vérifié après application.
--
-- La même règle s'applique aux références auditées, par cohérence — les deux
-- chiffres se lisent côte à côte sur la tuile.

create or replace function public.get_session_count_totals(p_session_id uuid)
returns table(counted numeric, audited numeric, counted_skus bigint, audited_skus bigint)
language plpgsql
stable security definer
set search_path to 'public'
as $function$
begin
  if not (
    public.can_access_session(p_session_id)
    or exists (select 1 from public.session_members sm
               where sm.session_id = p_session_id and sm.user_id = auth.uid())
  ) then
    raise exception 'forbidden';
  end if;

  return query
  with par_sku as (
    select c.sku,
           sum(c.qty) filter (where c.pass_number = 1) as net_comptage,
           sum(c.qty) filter (where c.pass_number = 2) as net_audit
    from public.counts c
    where c.session_id = p_session_id
    group by c.sku
  )
  select
    coalesce(sum(p.net_comptage), 0)::numeric,
    coalesce(sum(p.net_audit), 0)::numeric,
    count(*) filter (where p.net_comptage > 0),
    count(*) filter (where p.net_audit > 0)
  from par_sku p;
end;
$function$;

-- `create or replace` rend EXECUTE à PUBLIC : on repose les droits ici même.
revoke all on function public.get_session_count_totals(uuid) from public, anon;
grant execute on function public.get_session_count_totals(uuid) to authenticated, service_role;
