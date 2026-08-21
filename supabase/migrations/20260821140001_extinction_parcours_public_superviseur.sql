-- Extinction du parcours public superviseur — phase 2 : les objets.
--
-- Le code qui les appelait est déployé depuis le 21 août 2026 (commit
-- 50bbf6e) : /superviseur n'est plus qu'une explication, la section des
-- demandes a quitté la console. On supprime donc les objets APRÈS, jamais
-- l'inverse — c'est la leçon de get_session_activity, dont la suppression
-- prématurée avait cassé le tableau de bord en production.
--
-- Ce qui disparaît, et pourquoi :
--   · submit_supervisor_request          — LA surface publique (exécutable
--                                          par anon). Sa disparition est le
--                                          bénéfice sécurité de l'extinction :
--                                          plus d'oracle d'énumération à
--                                          défendre, plus de limitation de
--                                          débit à maintenir.
--   · submit_supervisor_request_detailed — appelée par l'edge function.
--   · admin_list_supervisor_requests     — alimentait la section supprimée.
--   · admin_review_supervisor_request    — validait les demandes.
--
-- Ce qui RESTE, volontairement :
--   · la table supervisor_requests, vide, RLS active sans aucune policy
--     (donc refus par défaut pour anon et authenticated). La garder ne coûte
--     rien et laisse la marche arrière possible ; la supprimer obligerait à
--     réécrire handle_new_user — la fonction qui conditionne toute création
--     de compte — pour un gain nul.
--   · les branches qui la lisent (handle_new_user, purge_expired_data,
--     export_my_data, anonymize_on_user_delete, ca_invite_supervisor) : sur
--     une table qui restera vide, ce sont des non-opérations.

drop function if exists public.submit_supervisor_request(text, text, text, text, text);
drop function if exists public.submit_supervisor_request_detailed(text, text, text, text, text);
drop function if exists public.admin_list_supervisor_requests();
drop function if exists public.admin_review_supervisor_request(uuid, boolean, text);
