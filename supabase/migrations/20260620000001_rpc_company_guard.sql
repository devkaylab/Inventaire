-- Défense en profondeur : cloisonner par entreprise les RPC SECURITY DEFINER
-- qui prennent un p_session_id et ne validaient que le rôle 'supervisor'.
-- Comme SECURITY DEFINER contourne les RLS, un superviseur d'une autre
-- entreprise connaissant l'UUID d'une session pouvait agir dessus. On ajoute
-- la vérification que la session appartient bien à l'entreprise de l'appelant.
--
-- Note : advance_pass et revert_pass ne sont PAS modifiées — elles autorisent
-- déjà uniquement le créateur OU un membre de la session (ce qui exclut un
-- superviseur étranger), et y ajouter un test company_id casserait l'usage des
-- employés (qui n'ont pas de company_id).

create or replace function public.delete_session(p_session_id uuid)
returns json language plpgsql security definer set search_path = public
as $function$
begin
  if get_my_role() <> 'supervisor' then
    return json_build_object('success', false, 'error', 'Accès refusé');
  end if;
  if not exists (select 1 from public.inventory_sessions s
                 where s.id = p_session_id and s.company_id = get_my_company()) then
    return json_build_object('success', false, 'error', 'Accès refusé');
  end if;
  delete from public.zones             where session_id = p_session_id;
  delete from public.counts            where session_id = p_session_id;
  delete from public.theoretical_stock where session_id = p_session_id;
  delete from public.article_audit     where session_id = p_session_id;
  delete from public.articles          where session_id = p_session_id;
  delete from public.session_members   where session_id = p_session_id;
  delete from public.inventory_sessions where id = p_session_id;
  return json_build_object('success', true);
end;
$function$;

create or replace function public.delete_audit_line(p_session_id uuid, p_sku text)
returns jsonb language plpgsql security definer set search_path = public
as $function$
begin
  if public.get_my_role() <> 'supervisor' then
    raise exception 'forbidden';
  end if;
  if not exists (select 1 from public.inventory_sessions s
                 where s.id = p_session_id and s.company_id = get_my_company()) then
    raise exception 'forbidden';
  end if;
  delete from public.counts        where session_id = p_session_id and sku = p_sku;
  delete from public.article_audit where session_id = p_session_id and sku = p_sku;
  return jsonb_build_object('success', true);
end;
$function$;

create or replace function public.resolve_audit(p_session_id uuid, p_sku text, p_final_qty numeric)
returns jsonb language plpgsql security definer set search_path = public
as $function$
begin
  if public.get_my_role() <> 'supervisor' then
    raise exception 'forbidden';
  end if;
  if not exists (select 1 from public.inventory_sessions s
                 where s.id = p_session_id and s.company_id = get_my_company()) then
    raise exception 'forbidden';
  end if;
  if p_final_qty is null or p_final_qty < 0 then
    return jsonb_build_object('success', false, 'error', 'invalid_qty');
  end if;
  update public.article_audit
  set final_qty = p_final_qty, status = 'resolved', resolved_by = auth.uid(), updated_at = now()
  where session_id = p_session_id and sku = p_sku;
  if not found then
    return jsonb_build_object('success', false, 'error', 'not_found');
  end if;
  return jsonb_build_object('success', true);
end;
$function$;

create or replace function public.recompute_session_audit(p_session_id uuid)
returns jsonb language plpgsql security definer set search_path = public
as $function$
declare
  v_failed int;
  v_total int;
  v_pending int;
begin
  if public.get_my_role() <> 'supervisor' then
    raise exception 'forbidden';
  end if;
  if not exists (select 1 from public.inventory_sessions s
                 where s.id = p_session_id and s.company_id = get_my_company()) then
    raise exception 'forbidden';
  end if;

  with agg as (
    select
      sku,
      sum(qty) filter (where pass_number = 1) as q1,
      sum(qty) filter (where pass_number = 2) as q2,
      sum(qty) filter (where pass_number = 3) as q3
    from public.counts
    where session_id = p_session_id
    group by sku
  )
  insert into public.article_audit (session_id, sku, qty_pass1, qty_pass2, qty_pass3, status, final_qty, updated_at)
  select
    p_session_id, agg.sku, agg.q1, agg.q2, agg.q3,
    case
      when agg.q1 is not null and agg.q2 is not null and agg.q1 = agg.q2 then 'validated'
      when agg.q1 is not null and agg.q2 is not null and agg.q1 <> agg.q2 then 'failed'
      else 'pending'
    end,
    case
      when agg.q1 is not null and agg.q2 is not null and agg.q1 = agg.q2 then agg.q1
      else null
    end,
    now()
  from agg
  on conflict (session_id, sku) do update set
    qty_pass1 = excluded.qty_pass1,
    qty_pass2 = excluded.qty_pass2,
    qty_pass3 = excluded.qty_pass3,
    status = case when public.article_audit.status = 'resolved' then 'resolved' else excluded.status end,
    final_qty = case when public.article_audit.status = 'resolved' then public.article_audit.final_qty else excluded.final_qty end,
    updated_at = now();

  select
    count(*) filter (where status = 'failed'),
    count(*) filter (where status = 'pending'),
    count(*)
  into v_failed, v_pending, v_total
  from public.article_audit where session_id = p_session_id;

  return jsonb_build_object('success', true, 'failed', v_failed, 'pending', v_pending, 'total', v_total);
end;
$function$;

create or replace function public.get_session_results(p_session_id uuid)
returns table(sku text, ean text, brand text, label text, unit_purchase_price numeric, theoretical_qty numeric, counted_qty numeric, status text, variance_units numeric, variance_value numeric)
language plpgsql stable security definer set search_path = public
as $function$
begin
  if public.get_my_role() <> 'supervisor' then
    raise exception 'forbidden';
  end if;
  if not exists (select 1 from public.inventory_sessions s
                 where s.id = p_session_id and s.company_id = get_my_company()) then
    raise exception 'forbidden';
  end if;
  return query
  select
    a.sku,
    art.ean,
    coalesce(art.brand, '')::text,
    coalesce(art.label, '')::text,
    coalesce(art.unit_purchase_price, 0)::numeric,
    coalesce(ts.theoretical_qty, 0)::numeric,
    coalesce(a.final_qty, a.qty_pass2, a.qty_pass1, 0)::numeric,
    a.status,
    (coalesce(a.final_qty, a.qty_pass2, a.qty_pass1, 0) - coalesce(ts.theoretical_qty, 0))::numeric,
    ((coalesce(a.final_qty, a.qty_pass2, a.qty_pass1, 0) - coalesce(ts.theoretical_qty, 0))
      * coalesce(art.unit_purchase_price, 0))::numeric
  from public.article_audit a
  left join public.articles art
         on art.sku = a.sku and art.session_id = a.session_id
  left join public.theoretical_stock ts
         on ts.session_id = a.session_id and ts.sku = a.sku
  where a.session_id = p_session_id
  order by a.sku;
end;
$function$;
