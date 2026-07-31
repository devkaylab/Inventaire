-- Allow a supervisor to delete an article line from the audit entirely:
-- removes every count row for that SKU (all passes) and its audit aggregate.
-- counts has no DELETE RLS policy, so this must run as SECURITY DEFINER.
-- Applied to project: inventaire-smartcount (heabesqvlinzarqenymj)

CREATE OR REPLACE FUNCTION public.delete_audit_line(p_session_id uuid, p_sku text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.get_my_role() <> 'supervisor' THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  DELETE FROM public.counts        WHERE session_id = p_session_id AND sku = p_sku;
  DELETE FROM public.article_audit WHERE session_id = p_session_id AND sku = p_sku;

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.delete_audit_line(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_audit_line(uuid, text) TO authenticated;
