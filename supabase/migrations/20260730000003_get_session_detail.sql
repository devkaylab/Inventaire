-- Rapport « Détail par zone » : une ligne par (article, balise) COMPTÉE (passe 1),
-- sans sommer entre zones. Pas de comptage → pas de ligne (l'audit seul n'en crée pas).
-- Compté par / Audité par = identités des scanneurs (passe 1 = compte, passe 2 = audit).
-- « Audité ? » au niveau article-dans-la-balise. Superviseur de la compagnie uniquement.
-- Appliquée en base live via l'outil MCP apply_migration (le dossier migrations diverge de la base).
create or replace function public.get_session_detail(p_session_id uuid)
returns table(
  sku text, ean text, brand text, label text,
  zone text, zone_name text,
  counted_qty numeric, counted_by text,
  audited boolean, audited_qty numeric, audited_by text)
language plpgsql stable security definer set search_path to 'public' as $$
#variable_conflict use_column
begin
  if public.get_my_role() <> 'supervisor' then
    raise exception 'forbidden';
  end if;
  if not exists (select 1 from public.inventory_sessions s
                 where s.id = p_session_id and s.company_id = public.get_my_company()) then
    raise exception 'forbidden';
  end if;

  return query
  with c as (
    select c.sku as sku, coalesce(c.zone, '') as zone, c.pass_number as pass_number,
           sum(c.qty) as qty,
           string_agg(distinct p.full_name, ', ') as who
    from public.counts c
    left join public.profiles p on p.id = c.counted_by
    where c.session_id = p_session_id
    group by c.sku, coalesce(c.zone, ''), c.pass_number
  ),
  cnt as (select c.sku as sku, c.zone as zone, c.qty as qty, c.who as who from c where c.pass_number = 1),
  aud as (select c.sku as sku, c.zone as zone, c.qty as qty, c.who as who, true as present from c where c.pass_number = 2)
  select cnt.sku, a.ean, a.brand, a.label,
         nullif(cnt.zone, '') as zone,
         z.name as zone_name,
         cnt.qty::numeric as counted_qty,
         cnt.who as counted_by,
         coalesce(aud.present, false) as audited,
         coalesce(aud.qty, 0)::numeric as audited_qty,
         aud.who as audited_by
  from cnt
  left join aud on aud.sku = cnt.sku and aud.zone = cnt.zone
  left join public.articles a on a.session_id = p_session_id and a.sku = cnt.sku
  left join public.zones z on z.session_id = p_session_id and z.code = nullif(cnt.zone, '')
  where cnt.qty <> 0
  order by z.name nulls last, nullif(cnt.zone, ''), a.label, cnt.sku;
end; $$;
