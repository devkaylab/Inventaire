-- Un inventaire clôturé ne se rouvre que par son créateur (ou l'administrateur
-- de l'entreprise), et ne se supprime plus en direct.
--
-- Deux trous de la même famille que celui de `delete_session` :
--
-- 1. La policy UPDATE acceptait n'importe quel superviseur participant. Un
--    invité pouvait donc rouvrir un inventaire clôturé — et le rapport, déjà
--    exporté, se remettait à bouger. L'app mobile réservait déjà le geste au
--    créateur dans son interface ; le site, non, et rien ne le tenait côté
--    serveur.
--
-- 2. La policy DELETE acceptait elle aussi tout participant. La fonction
--    `delete_session` a beau être fermée au créateur depuis la migration
--    précédente, un client pouvait supprimer la ligne en direct et
--    court-circuiter la garde — en laissant derrière lui comptages, articles
--    et audits orphelins.
--
-- Ce qui reste ouvert aux participants : clôturer un inventaire en cours, et
-- le préparer (`startSession`). Ce sont des gestes de terrain, réversibles par
-- le créateur.
drop policy if exists sessions_supervisor_update on public.inventory_sessions;

create policy sessions_supervisor_update on public.inventory_sessions
for update to authenticated
using (
  public.get_my_role() = 'supervisor'
  and public.is_session_participant(id)
  -- La ligne telle qu'elle est aujourd'hui : si elle est clôturée, seul son
  -- créateur ou l'administrateur de l'entreprise peut encore y toucher.
  and (
    status <> 'closed'
    or created_by = auth.uid()
    or public.is_company_admin(company_id)
  )
)
with check (
  public.get_my_role() = 'supervisor'
  and company_id = public.get_my_company()
);

-- Plus de suppression directe : elle passe par `delete_session`, qui est
-- SECURITY DEFINER (donc hors RLS) et porte la garde créateur / administrateur.
drop policy if exists sessions_supervisor_delete on public.inventory_sessions;
