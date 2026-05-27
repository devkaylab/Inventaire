-- Phase 2: audit aggregation, failed-audit resolution, and discrepancy results
-- Applied to project: inventaire-smartcount (heabesqvlinzarqenymj)

-- Recompute per-SKU audit aggregates from raw counts.
--   pass1 == pass2  -> validated (final_qty = pass1)
--   pass1 != pass2  -> failed (needs arbitration / pass 3)
--   otherwise       -> pending
-- Rows already 'resolved' by a supervisor are preserved.
CREATE OR REPLACE FUNCTION public.recompute_session_audit(p_session_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_failed int;
  v_total int;
  v_pending int;
BEGIN
  IF public.get_my_role() <> 'supervisor' THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  WITH agg AS (
    SELECT
      sku,
      SUM(qty) FILTER (WHERE pass_number = 1) AS q1,
      SUM(qty) FILTER (WHERE pass_number = 2) AS q2,
      SUM(qty) FILTER (WHERE pass_number = 3) AS q3
    FROM public.counts
    WHERE session_id = p_session_id
    GROUP BY sku
  )
  INSERT INTO public.article_audit (session_id, sku, qty_pass1, qty_pass2, qty_pass3, status, final_qty, updated_at)
  SELECT
    p_session_id, agg.sku, agg.q1, agg.q2, agg.q3,
    CASE
      WHEN agg.q1 IS NOT NULL AND agg.q2 IS NOT NULL AND agg.q1 = agg.q2 THEN 'validated'
      WHEN agg.q1 IS NOT NULL AND agg.q2 IS NOT NULL AND agg.q1 <> agg.q2 THEN 'failed'
      ELSE 'pending'
    END,
    CASE
      WHEN agg.q1 IS NOT NULL AND agg.q2 IS NOT NULL AND agg.q1 = agg.q2 THEN agg.q1
      ELSE NULL
    END,
    now()
  FROM agg
  ON CONFLICT (session_id, sku) DO UPDATE SET
    qty_pass1 = EXCLUDED.qty_pass1,
    qty_pass2 = EXCLUDED.qty_pass2,
    qty_pass3 = EXCLUDED.qty_pass3,
    status = CASE WHEN public.article_audit.status = 'resolved' THEN 'resolved' ELSE EXCLUDED.status END,
    final_qty = CASE WHEN public.article_audit.status = 'resolved' THEN public.article_audit.final_qty ELSE EXCLUDED.final_qty END,
    updated_at = now();

  SELECT
    count(*) FILTER (WHERE status = 'failed'),
    count(*) FILTER (WHERE status = 'pending'),
    count(*)
  INTO v_failed, v_pending, v_total
  FROM public.article_audit WHERE session_id = p_session_id;

  RETURN jsonb_build_object('success', true, 'failed', v_failed, 'pending', v_pending, 'total', v_total);
END;
$$;

-- Supervisor resolves a failed audit by setting the final counted quantity.
CREATE OR REPLACE FUNCTION public.resolve_audit(p_session_id uuid, p_sku text, p_final_qty numeric)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.get_my_role() <> 'supervisor' THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF p_final_qty IS NULL OR p_final_qty < 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_qty');
  END IF;
  UPDATE public.article_audit
  SET final_qty = p_final_qty, status = 'resolved', resolved_by = auth.uid(), updated_at = now()
  WHERE session_id = p_session_id AND sku = p_sku;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_found');
  END IF;
  RETURN jsonb_build_object('success', true);
END;
$$;

-- Per-SKU results with discrepancy vs theoretical stock (units + purchase value).
CREATE OR REPLACE FUNCTION public.get_session_results(p_session_id uuid)
RETURNS TABLE (
  sku text,
  ean text,
  brand text,
  label text,
  unit_purchase_price numeric,
  theoretical_qty numeric,
  counted_qty numeric,
  status text,
  variance_units numeric,
  variance_value numeric
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.get_my_role() <> 'supervisor' THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  RETURN QUERY
  SELECT
    a.sku,
    art.ean,
    COALESCE(art.brand, '')::text,
    COALESCE(art.label, '')::text,
    COALESCE(art.unit_purchase_price, 0)::numeric,
    COALESCE(ts.theoretical_qty, 0)::numeric,
    COALESCE(a.final_qty, a.qty_pass2, a.qty_pass1, 0)::numeric,
    a.status,
    (COALESCE(a.final_qty, a.qty_pass2, a.qty_pass1, 0) - COALESCE(ts.theoretical_qty, 0))::numeric,
    ((COALESCE(a.final_qty, a.qty_pass2, a.qty_pass1, 0) - COALESCE(ts.theoretical_qty, 0)) * COALESCE(art.unit_purchase_price, 0))::numeric
  FROM public.article_audit a
  LEFT JOIN public.articles art ON art.sku = a.sku
  LEFT JOIN public.theoretical_stock ts ON ts.session_id = a.session_id AND ts.sku = a.sku
  WHERE a.session_id = p_session_id
  ORDER BY a.sku;
END;
$$;

-- Lock down execution: revoke from PUBLIC and anon, grant only to authenticated.
-- (Internal role guard further restricts to supervisors.)
REVOKE EXECUTE ON FUNCTION public.recompute_session_audit(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.resolve_audit(uuid, text, numeric) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_session_results(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.recompute_session_audit(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_audit(uuid, text, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_session_results(uuid) TO authenticated;
