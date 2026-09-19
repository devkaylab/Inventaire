-- Retrait des fonctions mortes (19 septembre 2026).
--
-- Règle du projet : on retire les appels d'abord, l'objet ensuite. C'est fait
-- pour les quatorze ci-dessous — vérifié le jour même :
--   · aucun appel dans src/, web/ ni supabase/functions (hors types générés) ;
--   · aucune fonction SQL ne les appelle (pg_proc.prosrc) ;
--   · les builds de l'application du 13 septembre n'appellent plus
--     `lister_articles` (catalogue par delta depuis le 4 septembre).
--
-- Sans `cascade` : si un objet en dépendait encore, la migration échouerait
-- au lieu d'emporter quelque chose en silence.

-- Balises et zones de l'ancien modèle (droits déjà retirés le 8 septembre).
drop function if exists public.ensure_zone(uuid, text);
drop function if exists public.set_zone_status(uuid, text);
drop function if exists public.generate_zones(uuid, integer);
drop function if exists public.register_balise(uuid, text, text);
drop function if exists public.generate_company_balises(integer);

-- Passes globales, révoquées depuis le 13 août 2026.
drop function if exists public.advance_pass(uuid);
drop function if exists public.revert_pass(uuid, boolean);

-- Oracles et annuaire retirés à anon / authenticated en août.
drop function if exists public.check_invitation(text);
drop function if exists public.get_company_directory();

-- Remplacées : le catalogue par delta (4/09), l'arbitrage à 0 (29/08),
-- la messagerie en fils (30/08), la demande aux appareils (2/09).
drop function if exists public.lister_articles(uuid, text, integer);
drop function if exists public.delete_audit_line(uuid, text, text);
drop function if exists public.deposer_message_admin(text, text);
drop function if exists public.deposer_message_quantinvo(text, text);
drop function if exists public.ca_request_store(text, text, integer, integer);
