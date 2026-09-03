-- Le rapport se lit par pages (3 septembre 2026)
--
-- `get_session_results` rendait TOUTES les lignes — 400 000 sur un gros
-- inventaire, soit des dizaines de mégaoctets envoyés au navigateur, qui
-- calculait ensuite les totaux, la recherche et le tri sur place. Mesuré :
-- 6,3 s pour la requête sœur `get_session_detail`, et un navigateur qui peine
-- à afficher une liste pareille.
--
-- Trois fonctions remplacent ce tout-ou-rien :
--   · `rapport_resume`      — les totaux, calculés en base, sur TOUT le rapport
--   · `rapport_page`        — une page, recherchée et triée en base
--   · `rapport_detail_page` — le détail par balise, page par page (export)
--
-- ⚠️ LES TOTAUX NE SONT PAS CEUX DE LA PAGE. Ils portent sur l'inventaire
-- entier, et ne bougent pas quand on cherche : c'est ce que le tableau de bord
-- affichait déjà, et un total qui suivrait la page ne voudrait rien dire.
--
-- ⚠️ AUCUN SQL N'EST FABRIQUÉ À PARTIR D'UN PARAMÈTRE. Le tri passe par des
-- `case` écrits en clair, pas par du texte concaténé — règle du projet, déjà
-- posée pour `vider_import`.
--
-- ⚠️ ET L'ORDRE EST TOTAL : le `sku` départage toujours. Sans lui, deux lignes
-- de même valeur peuvent changer de place entre deux pages — on en verrait une
-- deux fois et une autre jamais. C'est le piège classique de la pagination, et
-- il ne se voit qu'en production. Vérifié : 7 tris × 2 sens, parcourus par
-- pages de 7 sur 101 lignes réelles, 101 lignes distinctes à chaque fois.
--
-- Équivalence prouvée avant d'appliquer : totaux identiques, contenu identique
-- à `get_session_results` et à `get_session_detail`, 0 différence.

create or replace function public.rapport_resume(p_session_id uuid)
returns table(lignes bigint, theorique numeric, compte numeric,
              ecart_unites numeric, ecart_valeur numeric, non_arbitres bigint)
language plpgsql
stable security definer
set search_path to 'public'
as $function$
begin
  if not public.can_access_session(p_session_id) then raise exception 'forbidden'; end if;
  return query
  with lignes as (
    select a.sku as s,
           sum(coalesce(a.final_qty, a.qty_pass2, a.qty_pass1, 0))::numeric as compte,
           case when bool_or(a.status = 'failed') then 'failed'
                when bool_or(a.status = 'pending') then 'pending'
                when bool_or(a.status = 'resolved') then 'resolved'
                else 'validated' end as statut
      from public.article_audit a
     where a.session_id = p_session_id
     group by a.sku
  ),
  univers as (
    select t.sku as s from public.theoretical_stock t where t.session_id = p_session_id
    union
    select l.s from lignes l
  ),
  tout as (
    select coalesce(ts.theoretical_qty, 0)::numeric as theo,
           coalesce(l.compte, 0)::numeric           as cnt,
           coalesce(art.unit_purchase_price, 0)::numeric as prix,
           coalesce(l.statut, 'uncounted')          as statut
      from univers u
      left join lignes l on l.s = u.s
      left join public.articles art on art.session_id = p_session_id and art.sku = u.s
      left join public.theoretical_stock ts on ts.session_id = p_session_id and ts.sku = u.s
  )
  select count(*)::bigint,
         coalesce(sum(theo), 0)::numeric,
         coalesce(sum(cnt), 0)::numeric,
         coalesce(sum(cnt - theo), 0)::numeric,
         coalesce(sum((cnt - theo) * prix), 0)::numeric,
         count(*) filter (where statut = 'failed')::bigint
    from tout;
end; $function$;

revoke all on function public.rapport_resume(uuid) from public, anon;
grant execute on function public.rapport_resume(uuid) to authenticated, service_role;

create or replace function public.rapport_page(
  p_session_id uuid,
  p_recherche  text default null,
  p_tri        text default 'variance_value',
  p_sens       text default 'desc',
  p_offset     integer default 0,
  p_limite     integer default 100
)
returns table(sku text, ean text, brand text, label text, unit_purchase_price numeric,
              theoretical_qty numeric, counted_qty numeric, status text,
              variance_units numeric, variance_value numeric, total bigint)
language plpgsql
stable security definer
set search_path to 'public'
as $function$
declare
  -- ⚠️ Le périmètre reste fixé par le SERVEUR : une page ne dépasse pas 5 000
  -- lignes, quoi que demande l'appelant. C'est ce qui empêche qu'un client
  -- redemande les 400 000 d'un coup par la porte de derrière.
  v_lim int := least(greatest(coalesce(p_limite, 100), 1), 5000);
  v_off int := greatest(coalesce(p_offset, 0), 0);
  v_q   text := nullif(btrim(coalesce(p_recherche, '')), '');
begin
  if not public.can_access_session(p_session_id) then raise exception 'forbidden'; end if;
  return query
  with lignes as (
    select a.sku as s,
           sum(coalesce(a.final_qty, a.qty_pass2, a.qty_pass1, 0))::numeric as compte,
           case when bool_or(a.status = 'failed') then 'failed'
                when bool_or(a.status = 'pending') then 'pending'
                when bool_or(a.status = 'resolved') then 'resolved'
                else 'validated' end as statut
      from public.article_audit a
     where a.session_id = p_session_id
     group by a.sku
  ),
  univers as (
    select t.sku as s from public.theoretical_stock t where t.session_id = p_session_id
    union
    select l.s from lignes l
  ),
  tout as (
    select u.s                                              as r_sku,
           art.ean::text                                    as r_ean,
           coalesce(art.brand, '')::text                    as r_brand,
           coalesce(art.label, '')::text                    as r_label,
           coalesce(art.unit_purchase_price, 0)::numeric    as r_prix,
           coalesce(ts.theoretical_qty, 0)::numeric         as r_theo,
           coalesce(l.compte, 0)::numeric                   as r_cnt,
           coalesce(l.statut, 'uncounted')::text            as r_statut,
           (coalesce(l.compte, 0) - coalesce(ts.theoretical_qty, 0))::numeric as r_vu,
           ((coalesce(l.compte, 0) - coalesce(ts.theoretical_qty, 0))
             * coalesce(art.unit_purchase_price, 0))::numeric                 as r_vv
      from univers u
      left join lignes l on l.s = u.s
      left join public.articles art on art.session_id = p_session_id and art.sku = u.s
      left join public.theoretical_stock ts on ts.session_id = p_session_id and ts.sku = u.s
  ),
  filtre as (
    select * from tout
     where v_q is null
        or r_sku   ilike '%' || v_q || '%'
        or coalesce(r_ean, '')   ilike '%' || v_q || '%'
        or r_label ilike '%' || v_q || '%'
        or r_brand ilike '%' || v_q || '%'
  )
  select f.r_sku, f.r_ean, f.r_brand, f.r_label, f.r_prix,
         f.r_theo, f.r_cnt, f.r_statut, f.r_vu, f.r_vv,
         count(*) over ()::bigint
    from filtre f
   order by
     -- Colonnes de texte
     (case when p_sens <> 'desc' then
        case p_tri when 'label'  then lower(f.r_label)
                   when 'status' then f.r_statut
                   when 'sku'    then f.r_sku end end) asc nulls last,
     (case when p_sens = 'desc' then
        case p_tri when 'label'  then lower(f.r_label)
                   when 'status' then f.r_statut
                   when 'sku'    then f.r_sku end end) desc nulls last,
     -- Colonnes de nombres
     (case when p_sens <> 'desc' then
        case p_tri when 'theoretical_qty' then f.r_theo
                   when 'counted_qty'     then f.r_cnt
                   when 'variance_units'  then f.r_vu
                   when 'variance_value'  then f.r_vv end end) asc nulls last,
     (case when p_sens = 'desc' then
        case p_tri when 'theoretical_qty' then f.r_theo
                   when 'counted_qty'     then f.r_cnt
                   when 'variance_units'  then f.r_vu
                   when 'variance_value'  then f.r_vv end end) desc nulls last,
     -- ⚠️ DÉPARTAGE OBLIGATOIRE. Voir l'en-tête.
     f.r_sku
   offset v_off limit v_lim;
end; $function$;

revoke all on function public.rapport_page(uuid, text, text, text, integer, integer) from public, anon;
grant execute on function public.rapport_page(uuid, text, text, text, integer, integer) to authenticated, service_role;

create or replace function public.rapport_detail_page(
  p_session_id uuid, p_offset integer default 0, p_limite integer default 5000
)
returns table(sku text, ean text, brand text, label text, zone text, zone_name text,
              counted_qty numeric, counted_by text, audited boolean,
              audited_qty numeric, audited_by text, total bigint)
language plpgsql
stable security definer
set search_path to 'public'
as $function$
declare
  v_lim int := least(greatest(coalesce(p_limite, 5000), 1), 5000);
  v_off int := greatest(coalesce(p_offset, 0), 0);
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
  ),
  tout as (
    select agg.a_sku, a.ean, a.brand, a.label,
           nullif(agg.a_zone, '')       as d_zone,
           z.name                       as d_zone_name,
           coalesce(agg.q1, 0)::numeric as d_cnt,
           agg.who1                     as d_who1,
           (agg.q2 is not null)         as d_audited,
           coalesce(agg.q2, 0)::numeric as d_aqty,
           agg.who2                     as d_who2
      from agg
      left join public.articles a on a.session_id = p_session_id and a.sku = agg.a_sku
      left join public.zones    z on z.session_id = p_session_id and z.code = nullif(agg.a_zone, '')
     where coalesce(agg.q1, 0) <> 0 or coalesce(agg.q2, 0) <> 0
  )
  select t.a_sku, t.ean, t.brand, t.label, t.d_zone, t.d_zone_name,
         t.d_cnt, t.d_who1, t.d_audited, t.d_aqty, t.d_who2,
         count(*) over ()::bigint
    from tout t
   -- Le même ordre qu'avant, plus le sku qui départage : l'export doit rester
   -- reproductible d'une page à l'autre.
   order by t.d_zone_name nulls last, t.d_zone, t.label, t.a_sku
   offset v_off limit v_lim;
end; $function$;

revoke all on function public.rapport_detail_page(uuid, integer, integer) from public, anon;
grant execute on function public.rapport_detail_page(uuid, integer, integer) to authenticated, service_role;
