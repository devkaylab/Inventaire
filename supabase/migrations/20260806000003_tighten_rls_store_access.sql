-- A4 : resserrer le RLS superviseur — l'entreprise ne suffit plus, il faut être
-- affecté au magasin de la session. Les accès employé (via session_members) restent
-- inchangés. On ré-écrit chaque politique superviseur avec is_assigned_store(store_id).

-- Sessions ---------------------------------------------------------------------
alter policy sessions_supervisor_company on public.inventory_sessions
  using (
    get_my_role() = 'supervisor'
    and company_id = get_my_company()
    and public.is_assigned_store(store_id)
  )
  with check (
    get_my_role() = 'supervisor'
    and company_id = get_my_company()
    and public.is_assigned_store(store_id)
  );

-- Articles ---------------------------------------------------------------------
alter policy articles_supervisor on public.articles
  using (
    get_my_role() = 'supervisor'
    and exists (select 1 from public.inventory_sessions s
                where s.id = articles.session_id
                  and s.company_id = get_my_company()
                  and public.is_assigned_store(s.store_id))
  )
  with check (
    get_my_role() = 'supervisor'
    and exists (select 1 from public.inventory_sessions s
                where s.id = articles.session_id
                  and s.company_id = get_my_company()
                  and public.is_assigned_store(s.store_id))
  );

-- Stock théorique --------------------------------------------------------------
alter policy theoretical_stock_supervisor on public.theoretical_stock
  using (
    get_my_role() = 'supervisor'
    and exists (select 1 from public.inventory_sessions s
                where s.id = theoretical_stock.session_id
                  and s.company_id = get_my_company()
                  and public.is_assigned_store(s.store_id))
  )
  with check (
    get_my_role() = 'supervisor'
    and exists (select 1 from public.inventory_sessions s
                where s.id = theoretical_stock.session_id
                  and s.company_id = get_my_company()
                  and public.is_assigned_store(s.store_id))
  );

-- Audit ------------------------------------------------------------------------
alter policy audit_supervisor on public.article_audit
  using (
    get_my_role() = 'supervisor'
    and exists (select 1 from public.inventory_sessions s
                where s.id = article_audit.session_id
                  and s.company_id = get_my_company()
                  and public.is_assigned_store(s.store_id))
  )
  with check (
    get_my_role() = 'supervisor'
    and exists (select 1 from public.inventory_sessions s
                where s.id = article_audit.session_id
                  and s.company_id = get_my_company()
                  and public.is_assigned_store(s.store_id))
  );

-- Zones ------------------------------------------------------------------------
alter policy zones_supervisor_company on public.zones
  using (
    get_my_role() = 'supervisor'
    and exists (select 1 from public.inventory_sessions s
                where s.id = zones.session_id
                  and s.company_id = get_my_company()
                  and public.is_assigned_store(s.store_id))
  )
  with check (
    get_my_role() = 'supervisor'
    and exists (select 1 from public.inventory_sessions s
                where s.id = zones.session_id
                  and s.company_id = get_my_company()
                  and public.is_assigned_store(s.store_id))
  );

-- Comptages : sélection / suppression / insertion superviseur ------------------
alter policy counts_select_supervisor on public.counts
  using (
    get_my_role() = 'supervisor'
    and exists (select 1 from public.inventory_sessions s
                where s.id = counts.session_id
                  and s.company_id = get_my_company()
                  and public.is_assigned_store(s.store_id))
  );

alter policy counts_delete_supervisor on public.counts
  using (
    get_my_role() = 'supervisor'
    and exists (select 1 from public.inventory_sessions s
                where s.id = counts.session_id
                  and s.company_id = get_my_company()
                  and public.is_assigned_store(s.store_id))
  );

alter policy counts_insert_supervisor on public.counts
  with check (
    counted_by = auth.uid()
    and get_my_role() = 'supervisor'
    and exists (
      select 1 from public.inventory_sessions s
      where s.id = counts.session_id
        and s.company_id = get_my_company()
        and public.is_assigned_store(s.store_id)
        and (
          (s.uses_zones and counts.pass_number >= 1 and counts.pass_number <= 3)
          or ((not s.uses_zones) and counts.pass_number = s.current_pass)
        )
    )
  );
