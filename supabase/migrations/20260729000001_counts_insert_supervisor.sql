-- ─────────────────────────────────────────────────────────────────────────
-- Correctif : un superviseur non-créateur ne pouvait pas enregistrer de
-- comptage sur une session de son entreprise.
--
-- La migration multi-tenant (20260619000005) a ouvert la LECTURE et la
-- SUPPRESSION des `counts` à tout superviseur de l'entreprise propriétaire de
-- la session, mais l'INSERT est resté sur `counts_insert_member`, qui exige
-- d'être présent dans `session_members`. Seul le créateur de la session y est
-- ajouté (create_session). Un second superviseur voyait donc la session mais
-- se faisait refuser ses scans :
--   « new row violates row-level security policy for table "counts" [42501] ».
--
-- On ajoute une policy INSERT permissive (OR avec l'existante) pour les
-- superviseurs de l'entreprise de la session — en miroir de
-- counts_select_supervisor / counts_delete_supervisor.
-- ─────────────────────────────────────────────────────────────────────────

drop policy if exists counts_insert_supervisor on public.counts;
create policy counts_insert_supervisor on public.counts
  for insert
  with check (
    counted_by = auth.uid()
    and get_my_role() = 'supervisor'
    and exists (select 1 from public.inventory_sessions s
                where s.id = counts.session_id and s.company_id = get_my_company())
    and pass_number = (select current_pass from public.inventory_sessions where id = counts.session_id)
  );
