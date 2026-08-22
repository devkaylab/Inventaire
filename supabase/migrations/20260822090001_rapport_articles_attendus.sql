-- Le rapport recense les articles ATTENDUS, pas seulement ceux qui ont été
-- comptés.
--
-- Constat de Julien, 22 août 2026 : deux écrans du même inventaire se
-- contredisaient. Sur « Test », l'onglet Set up annonçait 1 015 pièces
-- attendues quand le Rapport en affichait 395, sur 11 lignes alors que le
-- fichier théorique en compte 21.
--
-- Cause : la fonction partait de `article_audit`, qui ne contient une ligne
-- que pour un SKU déjà scanné. Un article attendu et jamais trouvé n'avait
-- donc aucune ligne — son théorique n'était pas additionné, et son manque
-- n'entrait pas dans l'écart. Autrement dit, l'inventaire ne montrait pas la
-- démarque qu'il est censé révéler.
--
-- Règle donnée par Julien : **le fichier qui fait foi est le stock théorique,
-- pas le référentiel**. Sans stock théorique, seuls les SKU comptés
-- apparaissent ; avec, tout l'attendu apparaît.
--
-- D'où l'`union` ci-dessous, qui couvre les deux cas sans condition : quand
-- `theoretical_stock` est vide, elle se réduit d'elle-même aux SKU comptés.
--
-- Ce qui NE change pas, et ne doit pas changer :
--   · la quantité qui fait foi reste `final_qty → qty_pass2 → qty_pass1` —
--     une quantité arbitrée l'emporte sur l'audit, qui l'emporte sur le
--     comptage ;
--   · la priorité des statuts d'audit reste `failed > pending > resolved >
--     validated`.
-- Le seul ajout est `uncounted`, qui ne peut jamais écraser un statut
-- d'audit : il ne s'applique qu'aux SKU sans aucune ligne d'audit.
--
-- Les jointures sur `articles` et `theoretical_stock` portent sur des clés
-- uniques (session_id, sku) : aucune duplication de ligne possible.

create or replace function public.get_session_results(p_session_id uuid)
returns table(sku text, ean text, brand text, label text, unit_purchase_price numeric,
              theoretical_qty numeric, counted_qty numeric, status text,
              variance_units numeric, variance_value numeric)
language plpgsql stable security definer set search_path to 'public'
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
  )
  select u.s,
         art.ean::text,
         coalesce(art.brand, '')::text,
         coalesce(art.label, '')::text,
         coalesce(art.unit_purchase_price, 0)::numeric,
         coalesce(ts.theoretical_qty, 0)::numeric,
         coalesce(l.compte, 0)::numeric,
         coalesce(l.statut, 'uncounted')::text,
         (coalesce(l.compte, 0) - coalesce(ts.theoretical_qty, 0))::numeric,
         ((coalesce(l.compte, 0) - coalesce(ts.theoretical_qty, 0)) * coalesce(art.unit_purchase_price, 0))::numeric
  from univers u
  left join lignes l on l.s = u.s
  left join public.articles art on art.session_id = p_session_id and art.sku = u.s
  left join public.theoretical_stock ts on ts.session_id = p_session_id and ts.sku = u.s
  order by u.s;
end; $function$;

-- `create or replace` rend EXECUTE à PUBLIC : on repose les droits dans la
-- même migration (leçon du 19 août 2026 sur `get_session_activity`).
revoke all on function public.get_session_results(uuid) from public, anon;
grant execute on function public.get_session_results(uuid) to authenticated, service_role;
