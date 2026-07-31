-- Allow stepping the session back one pass (e.g. Audit -> Compte) so the team
-- can resume counting. Unlike advance_pass (supervisor-only), this is allowed
-- for the supervisor who owns the session OR any member of it (an employee),
-- per product decision. Optionally wipes the counts of the pass being left.
-- SECURITY DEFINER because it updates the session and may delete counts, both
-- of which the client cannot do directly under RLS.
-- Applied to project: inventaire-smartcount (heabesqvlinzarqenymj)

CREATE OR REPLACE FUNCTION public.revert_pass(p_session_id uuid, p_delete_counts boolean DEFAULT false)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_current int;
  v_allowed boolean;
BEGIN
  SELECT current_pass INTO v_current
  FROM public.inventory_sessions
  WHERE id = p_session_id;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Session introuvable');
  END IF;

  -- Supervisor-owner OR a member of the session may revert.
  SELECT EXISTS (
    SELECT 1 FROM public.inventory_sessions s
    WHERE s.id = p_session_id AND s.created_by = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM public.session_members m
    WHERE m.session_id = p_session_id AND m.user_id = auth.uid()
  ) INTO v_allowed;

  IF NOT v_allowed THEN
    RETURN json_build_object('success', false, 'error', 'Accès refusé');
  END IF;

  IF v_current <= 1 THEN
    RETURN json_build_object('success', false, 'error', 'Déjà en comptage (passe 1)');
  END IF;

  -- Optionally discard everything counted in the pass we are leaving.
  IF p_delete_counts THEN
    DELETE FROM public.counts
    WHERE session_id = p_session_id AND pass_number = v_current;
  END IF;

  UPDATE public.inventory_sessions
  SET current_pass = current_pass - 1, status = 'counting'
  WHERE id = p_session_id;

  RETURN json_build_object(
    'success', true,
    'current_pass', v_current - 1,
    'deleted_counts', p_delete_counts,
    'left_pass', v_current
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.revert_pass(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.revert_pass(uuid, boolean) TO authenticated;
