-- ─────────────────────────────────────────────────────────────────────────
-- Fermeture de l'oracle d'énumération d'adresses e-mail. (Constat M2.)
--
-- `check_invitation(email)` répond par un booléen à « cette adresse a-t-elle
-- été invitée ? », et elle était exécutable par `anon` — donc par n'importe
-- qui, sans compte. De quoi tester des adresses une à une pour savoir qui
-- travaille chez un client : une divulgation par inférence, utile à qui
-- prépare un hameçonnage ciblé.
--
-- Elle servait de garde-fou avant `signUp` dans l'application. Ce parcours a
-- disparu avec le passage au lien magique (20260813000003) : le compte auth
-- est créé par `invite-teammate`, la personne ne s'inscrit plus. La fonction
-- n'était donc plus que du code mort exposé.
--
-- On la conserve en base — sans droit d'exécution client — plutôt que de la
-- supprimer : elle ne coûte rien et reste utile au back-office.
--
-- Au passage, `compose_full_name` reçoit un `search_path` figé : l'advisor
-- Supabase la signalait comme mutable. Sans conséquence pratique ici (elle est
-- IMMUTABLE et ne touche aucune table), mais autant ne pas laisser
-- d'exception à la règle que suivent toutes les autres fonctions.
--
-- Appliquée en base live via l'outil MCP.
-- ─────────────────────────────────────────────────────────────────────────

revoke execute on function public.check_invitation(text) from anon, authenticated;

alter function public.compose_full_name(text, text, text) set search_path to 'public';
