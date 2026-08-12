-- Détail par (article, balise) : réparer les lignes auditées jamais comptées.
--
-- L'ancienne version partait du comptage (`from cnt left join aud`) : un article
-- relevé par l'auditeur en passe 2 alors que le compteur ne l'avait pas vu en
-- passe 1 disparaissait purement et simplement du détail — donc de l'onglet
-- « Détail par zone » de l'export Excel. C'est pourtant l'écart le plus parlant
-- pour un superviseur : « l'auditeur a trouvé un article que personne n'avait
-- compté ».
--
-- On construit désormais la clé (sku, balise) à partir de l'UNION des deux
-- passes, puis on rattache chaque passe en LEFT JOIN. Un `full outer join`
-- direct aurait obligé à écrire `coalesce(cnt.sku, aud.sku)` dans les jointures
-- aval et les quatre termes du ORDER BY : six occasions d'en oublier une et de
-- réintroduire le bug. Avec la CTE `k`, les clés sont non-nulles par
-- construction et le reste de la requête reste lisible.
--
-- Colonnes, types et ordre inchangés : l'export mobile (src/lib/report.ts)
-- continue de produire exactement les mêmes en-têtes. `counted_by` peut
-- désormais être NULL sur une ligne audit-seule, ce que le code mobile
-- gère déjà (`r.counted_by ?? ''`).
--
-- Changement de comportement à noter : le filtre `where cnt.qty <> 0` devient
-- « comptage net ≠ 0 OU audit net ≠ 0 ». Une ligne comptée puis annulée par une
-- ligne négative mais auditée apparaît maintenant avec counted_qty = 0 — c'est
-- précisément le cas qu'un superviseur doit voir.
--
-- Appliquée en base live via l'outil MCP apply_migration (le dossier migrations
-- diverge de la base, cf. les migrations précédentes).

create or replace function public.get_session_detail(p_session_id uuid)
returns table(
  sku text, ean text, brand text, label text,
  zone text, zone_name text,
  counted_qty numeric, counted_by text,
  audited boolean, audited_qty numeric, audited_by text)
language plpgsql stable security definer set search_path to 'public' as $function$
#variable_conflict use_column
begin
  if not public.can_access_session(p_session_id) then raise exception 'forbidden'; end if;

  return query
  with c as (
    select c.sku as sku,
           coalesce(c.zone, '') as zone,
           c.pass_number as pass_number,
           sum(c.qty) as qty,
           string_agg(distinct p.full_name, ', ') as who
    from public.counts c
    left join public.profiles p on p.id = c.counted_by
    where c.session_id = p_session_id
    group by c.sku, coalesce(c.zone, ''), c.pass_number
  ),
  cnt as (select c.sku as sku, c.zone as zone, c.qty as qty, c.who as who from c where c.pass_number = 1),
  aud as (select c.sku as sku, c.zone as zone, c.qty as qty, c.who as who from c where c.pass_number = 2),
  k as (
    -- une ligne dès qu'il y a un comptage OU un audit
    select cnt.sku as sku, cnt.zone as zone from cnt
    union
    select aud.sku as sku, aud.zone as zone from aud
  )
  select k.sku,
         a.ean, a.brand, a.label,
         nullif(k.zone, '')              as zone,
         z.name                          as zone_name,
         coalesce(cnt.qty, 0)::numeric   as counted_qty,
         cnt.who                         as counted_by,
         (aud.sku is not null)           as audited,
         coalesce(aud.qty, 0)::numeric   as audited_qty,
         aud.who                         as audited_by
  from k
  left join cnt on cnt.sku = k.sku and cnt.zone = k.zone
  left join aud on aud.sku = k.sku and aud.zone = k.zone
  left join public.articles a on a.session_id = p_session_id and a.sku = k.sku
  left join public.zones    z on z.session_id = p_session_id and z.code = nullif(k.zone, '')
  where coalesce(cnt.qty, 0) <> 0 or coalesce(aud.qty, 0) <> 0
  order by z.name nulls last, nullif(k.zone, ''), a.label, k.sku;
end; $function$;

revoke all on function public.get_session_detail(uuid) from anon;
grant execute on function public.get_session_detail(uuid) to authenticated;
