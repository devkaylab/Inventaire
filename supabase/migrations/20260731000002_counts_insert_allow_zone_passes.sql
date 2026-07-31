-- Correctif : en mode zones, le mode (Comptage=passe 1 / Audit=passe 2) est choisi
-- par participant, indépendamment de current_pass. L'ancienne règle RLS exigeait
-- pass_number = current_pass → l'audit (passe 2) était refusé (42501) tant que la
-- session restait en current_pass = 1. On autorise les passes 1 à 3 pour les
-- sessions à zones ; les sessions classiques gardent pass_number = current_pass.
-- Sécurité inchangée (membre/superviseur de la compagnie, écriture de ses lignes).
-- Appliquée en base live via MCP apply_migration (le dossier migrations diverge).

alter policy counts_insert_member on public.counts
with check (
  counted_by = auth.uid()
  and exists (
    select 1 from public.session_members sm
    where sm.session_id = counts.session_id and sm.user_id = auth.uid()
  )
  and exists (
    select 1 from public.inventory_sessions s
    where s.id = counts.session_id
      and (
        (s.uses_zones and counts.pass_number between 1 and 3)
        or (not s.uses_zones and counts.pass_number = s.current_pass)
      )
  )
);

alter policy counts_insert_supervisor on public.counts
with check (
  counted_by = auth.uid()
  and get_my_role() = 'supervisor'
  and exists (
    select 1 from public.inventory_sessions s
    where s.id = counts.session_id and s.company_id = get_my_company()
      and (
        (s.uses_zones and counts.pass_number between 1 and 3)
        or (not s.uses_zones and counts.pass_number = s.current_pass)
      )
  )
);
