-- Audit & écarts PAR BALISE : la comparaison comptage vs audit se fait au sein de
-- chaque (zone, article). article_audit passe à la clé (session_id, zone, sku).
-- zone = '' pour les inventaires classiques (sans zones).
-- Le rapport (get_session_results) agrège par article (le théorique reste par article).
-- Appliquée en base live via MCP apply_migration (le dossier migrations diverge).

alter table public.article_audit add column if not exists zone text not null default '';
alter table public.article_audit drop constraint if exists article_audit_session_id_sku_key;
create unique index if not exists article_audit_session_zone_sku
  on public.article_audit (session_id, zone, sku);

-- recompute_session_audit : agrège par (sku, coalesce(zone,'')) ; préserve les
-- lignes 'resolved' ; purge les lignes sans comptage restant.
create or replace function public.recompute_session_audit(p_session_id uuid)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare v_failed int; v_pending int; v_total int;
begin
  if public.get_my_role() <> 'supervisor' then raise exception 'forbidden'; end if;
  if not exists (select 1 from public.inventory_sessions s
                 where s.id = p_session_id and s.company_id = get_my_company()) then
    raise exception 'forbidden';
  end if;

  with agg as (
    select sku, coalesce(zone, '') as zone,
      sum(qty) filter (where pass_number = 1) as q1,
      sum(qty) filter (where pass_number = 2) as q2,
      sum(qty) filter (where pass_number = 3) as q3
    from public.counts where session_id = p_session_id
    group by sku, coalesce(zone, '')
  )
  insert into public.article_audit (session_id, zone, sku, qty_pass1, qty_pass2, qty_pass3, status, final_qty, updated_at)
  select p_session_id, agg.zone, agg.sku, agg.q1, agg.q2, agg.q3,
    case when agg.q1 is not null and agg.q2 is not null and agg.q1 = agg.q2 then 'validated'
         when agg.q1 is not null and agg.q2 is not null and agg.q1 <> agg.q2 then 'failed'
         else 'pending' end,
    case when agg.q1 is not null and agg.q2 is not null and agg.q1 = agg.q2 then agg.q1 else null end,
    now()
  from agg
  on conflict (session_id, zone, sku) do update set
    qty_pass1 = excluded.qty_pass1, qty_pass2 = excluded.qty_pass2, qty_pass3 = excluded.qty_pass3,
    status    = case when public.article_audit.status = 'resolved' then 'resolved' else excluded.status end,
    final_qty = case when public.article_audit.status = 'resolved' then public.article_audit.final_qty else excluded.final_qty end,
    updated_at = now();

  delete from public.article_audit a
   where a.session_id = p_session_id
     and not exists (select 1 from public.counts c
                     where c.session_id = a.session_id and c.sku = a.sku and coalesce(c.zone, '') = a.zone);

  select count(*) filter (where status = 'failed'), count(*) filter (where status = 'pending'), count(*)
    into v_failed, v_pending, v_total from public.article_audit where session_id = p_session_id;
  return jsonb_build_object('success', true, 'failed', v_failed, 'pending', v_pending, 'total', v_total);
end; $$;

drop function if exists public.resolve_audit(uuid, text, numeric);
create or replace function public.resolve_audit(
  p_session_id uuid, p_sku text, p_final_qty numeric, p_zone text default '')
returns jsonb language plpgsql security definer set search_path to 'public' as $$
begin
  if public.get_my_role() <> 'supervisor' then raise exception 'forbidden'; end if;
  if not exists (select 1 from public.inventory_sessions s
                 where s.id = p_session_id and s.company_id = get_my_company()) then
    raise exception 'forbidden';
  end if;
  if p_final_qty is null or p_final_qty < 0 then
    return jsonb_build_object('success', false, 'error', 'invalid_qty');
  end if;
  update public.article_audit
    set final_qty = p_final_qty, status = 'resolved', resolved_by = auth.uid(), updated_at = now()
    where session_id = p_session_id and sku = p_sku and zone = coalesce(p_zone, '');
  if not found then return jsonb_build_object('success', false, 'error', 'not_found'); end if;
  return jsonb_build_object('success', true);
end; $$;

drop function if exists public.delete_audit_line(uuid, text);
create or replace function public.delete_audit_line(
  p_session_id uuid, p_sku text, p_zone text default '')
returns jsonb language plpgsql security definer set search_path to 'public' as $$
begin
  if public.get_my_role() <> 'supervisor' then raise exception 'forbidden'; end if;
  if not exists (select 1 from public.inventory_sessions s
                 where s.id = p_session_id and s.company_id = get_my_company()) then
    raise exception 'forbidden';
  end if;
  delete from public.counts
    where session_id = p_session_id and sku = p_sku and coalesce(zone, '') = coalesce(p_zone, '');
  delete from public.article_audit
    where session_id = p_session_id and sku = p_sku and zone = coalesce(p_zone, '');
  return jsonb_build_object('success', true);
end; $$;

-- get_session_results : agrégé par ARTICLE (somme des quantités retenues sur toutes
-- les balises), le théorique restant par article.
create or replace function public.get_session_results(p_session_id uuid)
returns table(sku text, ean text, brand text, label text, unit_purchase_price numeric,
              theoretical_qty numeric, counted_qty numeric, status text,
              variance_units numeric, variance_value numeric)
language plpgsql stable security definer set search_path to 'public' as $$
begin
  if public.get_my_role() <> 'supervisor' then raise exception 'forbidden'; end if;
  if not exists (select 1 from public.inventory_sessions s
                 where s.id = p_session_id and s.company_id = get_my_company()) then
    raise exception 'forbidden';
  end if;
  return query
  select a.sku, max(art.ean)::text, coalesce(max(art.brand), '')::text, coalesce(max(art.label), '')::text,
    coalesce(max(art.unit_purchase_price), 0)::numeric,
    coalesce(max(ts.theoretical_qty), 0)::numeric,
    sum(coalesce(a.final_qty, a.qty_pass2, a.qty_pass1, 0))::numeric,
    case when bool_or(a.status = 'failed') then 'failed'
         when bool_or(a.status = 'pending') then 'pending'
         when bool_or(a.status = 'resolved') then 'resolved'
         else 'validated' end,
    (sum(coalesce(a.final_qty, a.qty_pass2, a.qty_pass1, 0)) - coalesce(max(ts.theoretical_qty), 0))::numeric,
    ((sum(coalesce(a.final_qty, a.qty_pass2, a.qty_pass1, 0)) - coalesce(max(ts.theoretical_qty), 0))
      * coalesce(max(art.unit_purchase_price), 0))::numeric
  from public.article_audit a
  left join public.articles art on art.sku = a.sku and art.session_id = a.session_id
  left join public.theoretical_stock ts on ts.session_id = a.session_id and ts.sku = a.sku
  where a.session_id = p_session_id
  group by a.sku
  order by a.sku;
end; $$;
