-- ─────────────────────────────────────────────────────────────────────────
-- Correctif : l'audit (passe 2) était refusé sur les inventaires SANS balises.
--
-- Symptôme terrain : sur l'inventaire « LA Bruket » (uses_zones = false,
-- current_pass = 1), le comptage passait (18 lignes en passe 1) mais chaque
-- scan en mode Audit remontait
--   « new row violates row-level security policy for table "counts" [42501] »
-- traduit dans l'app par « Enregistrement refusé. Vous n'êtes peut-être plus
-- inscrit à cette session… ». Le message trompe : l'inscription est bonne,
-- c'est la passe qui est rejetée.
--
-- Origine : 20260731000002 a rendu le mode (Comptage = passe 1 / Audit = passe 2)
-- choisi PAR PARTICIPANT, indépendamment de `current_pass`… mais uniquement pour
-- les sessions à zones. Les deux policies d'insertion ont gardé, pour les
-- sessions classiques, la règle `pass_number = s.current_pass`. Or l'app
-- (`scan.tsx`, superviseur comme employé) déduit désormais la passe du mode dans
-- les deux cas : « Comptage→1, Audit→2, en mode zones comme sans balise ».
-- Et plus rien n'appelle `advance_pass` : `current_pass` reste donc à 1 pour
-- toujours → sur un inventaire sans balises, l'audit était structurellement
-- impossible, pour tout le monde (compteur employé comme superviseur invité).
--
-- On aligne donc la base sur le modèle de l'app : la passe ne dépend plus de
-- l'état global de la session. Les garde-fous réels sont conservés à
-- l'identique — on écrit ses propres lignes (`counted_by = auth.uid()`), on est
-- participant de l'inventaire, l'inventaire n'est pas clôturé, et la passe
-- reste bornée à 1..3 (déjà garanti par `counts_pass_number_check`).
--
-- Appliquée en base live via l'outil MCP apply_migration.
-- ─────────────────────────────────────────────────────────────────────────

drop policy if exists counts_insert_member on public.counts;
create policy counts_insert_member on public.counts for insert
with check (
  counted_by = auth.uid()
  and exists (
    select 1 from public.session_members sm
    where sm.session_id = counts.session_id and sm.user_id = auth.uid()
  )
  and exists (
    select 1 from public.inventory_sessions s
    where s.id = counts.session_id
      and s.status <> 'closed'
  )
  and counts.pass_number >= 1 and counts.pass_number <= 3
);

drop policy if exists counts_insert_supervisor on public.counts;
create policy counts_insert_supervisor on public.counts for insert
with check (
  counted_by = auth.uid()
  and public.get_my_role() = 'supervisor'
  and public.is_session_participant(counts.session_id)
  and exists (
    select 1 from public.inventory_sessions s
    where s.id = counts.session_id
      and s.status <> 'closed'
  )
  and counts.pass_number >= 1 and counts.pass_number <= 3
);
