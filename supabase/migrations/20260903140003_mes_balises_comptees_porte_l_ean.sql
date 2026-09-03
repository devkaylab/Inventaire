-- « Ce que j'ai compté » affiche l'EAN quand il en a un (3 septembre 2026)
--
-- Trouvé en branchant l'écran : `CountedBalisesList` choisit entre « EAN … » et
-- « SKU … » sous le libellé, et la première version de `mes_balises_comptees`
-- ne rendait que le libellé et la marque. Sans l'EAN, la ligne aurait changé
-- d'aspect — or ce chantier corrige un délai, il ne redessine rien.
--
-- ⚠️ `create or replace` ne sait pas changer une liste de colonnes de retour :
-- il faut passer par un `drop`. Les droits sont donc reposés ici — `create`
-- rend EXECUTE à PUBLIC, et un `revoke … from public` seul ne retire pas
-- `anon` (constat n°6 du 28 août 2026, qui se reproduit à chaque recréation).
drop function if exists public.mes_balises_comptees(uuid, int);

create function public.mes_balises_comptees(p_session_id uuid, p_pass int default 1)
returns table (zone text, sku text, qty numeric, label text, brand text, ean text)
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
begin
  if not public.membre_ou_superviseur(p_session_id) then raise exception 'forbidden'; end if;

  return query
  select coalesce(c.zone, '') as zone, c.sku, sum(c.qty)::numeric as qty,
         a.label, a.brand, a.ean
  from public.counts c
  left join public.articles a
    on a.session_id = c.session_id and a.sku = c.sku
  where c.session_id = p_session_id
    and c.pass_number = p_pass
    and c.counted_by = auth.uid()
  group by coalesce(c.zone, ''), c.sku, a.label, a.brand, a.ean
  -- `counts` est en ajout pur : une correction est une ligne négative. Une
  -- référence entièrement corrigée n'a plus rien à montrer.
  having sum(c.qty) > 0
  order by coalesce(c.zone, ''), c.sku;
end; $function$;

revoke all on function public.mes_balises_comptees(uuid, int) from public, anon;
grant execute on function public.mes_balises_comptees(uuid, int) to authenticated, service_role;
