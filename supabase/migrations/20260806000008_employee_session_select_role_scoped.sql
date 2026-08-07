-- La visibilité « membre de session » ne concerne que les employés. Les superviseurs
-- sont désormais bornés au magasin affecté (sessions_supervisor_company) ; sans ce
-- resserrement, un superviseur créateur (auto-membre) verrait ses sessions même après
-- avoir été désaffecté du magasin.
alter policy sessions_employee_select on public.inventory_sessions
  using (
    get_my_role() = 'employee'
    and exists (select 1 from public.session_members sm
                where sm.session_id = inventory_sessions.id and sm.user_id = auth.uid())
  );
