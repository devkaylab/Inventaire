-- Allow advancing the session pass (e.g. Compte -> Audit) not only by the
-- supervisor-owner but also by any member of the session (an employee), to
-- mirror revert_pass. SECURITY DEFINER updates the session under RLS.
-- Applied to project: inventaire-smartcount (heabesqvlinzarqenymj)

CREATE OR REPLACE FUNCTION public.advance_pass(p_session_id uuid)
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

  -- Supervisor-owner OR a member of the session may advance.
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

  IF v_current >= 3 THEN
    RETURN json_build_object('success', false, 'error', 'Passe maximale atteinte');
  END IF;

  UPDATE public.inventory_sessions
  SET current_pass = current_pass + 1, status = 'counting'
  WHERE id = p_session_id;

  RETURN json_build_object('success', true, 'current_pass', v_current + 1);
END;
$$;
