-- ─────────────────────────────────────────────────────────────────────────
-- Fermeture des contournements du parcours d'inscription.
--
-- Le parcours cible veut que l'entreprise, ses magasins et ses superviseurs
-- passent tous par l'administrateur Quantinvo. Trois portes de service
-- restaient ouvertes, toutes atteignables via PostgREST par n'importe quel
-- compte authentifié :
--
--   1. `create_company` — un superviseur pouvait créer son entreprise et son
--      code, sans demande, sans devis, sans facture. Appelée par aucun écran
--      (code mort dans src/lib/queries.ts), mais exposée à `authenticated`.
--      Portée réelle limitée : sans magasin, `is_assigned_store` reste faux et
--      aucun inventaire n'est créable. C'était donc de la pollution de
--      données, pas un accès indu — ce qui ne justifie pas de la laisser.
--
--   2. `join_company` — même profil : rattachement à n'importe quelle
--      entreprise sur simple connaissance du code.
--
--   3. `join_store` — auto-affectation à un magasin par saisie de son code.
--      C'est l'inverse du parcours cible : le code magasin accompagne
--      désormais la *demande* (`submit_supervisor_request`), et c'est la
--      validation Quantinvo qui affecte, via `handle_new_user`.
--
-- Les fonctions restent en base (service_role et postgres gardent
-- l'exécution) : elles servent encore au back-office et à la maintenance.
--
-- La quatrième porte — une `session_invitations` de rôle 'supervisor' qui
-- créait un profil superviseur — a été fermée dans 20260813000003, où
-- `handle_new_user` force désormais le profil à 'employee'.
--
-- Appliquée en base live via l'outil MCP.
-- ─────────────────────────────────────────────────────────────────────────

revoke execute on function public.create_company(text) from authenticated, anon;
revoke execute on function public.join_company(text)   from authenticated, anon;
revoke execute on function public.join_store(text)     from authenticated, anon;
