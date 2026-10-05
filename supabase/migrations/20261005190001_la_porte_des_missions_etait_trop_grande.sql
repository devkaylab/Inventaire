-- ⚠️⚠️ LA PORTE DES MISSIONS ÉTAIT TROP GRANDE — ET C'EST MOI QUI L'AI OUVERTE
-- (constat du 5 octobre 2026).
--
-- `20261004180001_la_porte_des_missions.sql` a écrit, pour réparer un
-- « permission denied for table missions » :
--
--     grant select on public.missions to authenticated;
--
-- **Un `grant select` sans liste de colonnes porte sur TOUTES LES COLONNES, et
-- il supersède le grant nominatif posé la veille.** Le client qui ouvre « Vos
-- inventaires » lisait donc aussi :
--
--   · `cout_cents`              — ce que la location nous coûte ;
--   · `calcul`                  — le détail, dont la rémunération d'une équipe ;
--   · `reglages_version`        — la version de grille qui l'a tarifé ;
--   · `stripe_payment_intent_id`.
--
-- Mesuré sur la base d'essai : `information_schema.column_privileges` rendait
-- les 47 colonnes pour `authenticated`. La migration du 20 septembre disait
-- pourtant l'intention mot pour mot : « le client qui lit sa mission lirait
-- aussi ce qu'elle nous coûte, ce que touche chaque inventoriste et quelle
-- marge nous prenons. "Le prix affiché est le prix payé" est une promesse sur
-- le montant, pas l'ouverture de la comptabilité. »
--
-- ⚠️ **AUCUNE EXPOSITION RÉELLE** : cette migration n'est pas en production —
-- On-Demand n'y est pas. Le défaut n'a vécu qu'un jour, sur la base d'essai.
--
-- ⚠️ ET CE N'EST PAS UN CONTRÔLE DE SÉCURITÉ QUI L'A VU, mais un SCÉNARIO :
-- `scripts/replique/50-sans-abonnement.sql` demandait « CLIENT NON ABONNÉ — ne
-- voit PAS ce qu'elle nous coûte » et a répondu `1900`. Il ne le demandait plus
-- depuis le 4 octobre, parce qu'il mourait seize lignes plus haut sur une
-- transition devenue interdite. Un scénario qui s'arrête tôt ne dit pas qu'il
-- ne mesure plus — c'est pour ça qu'il a fallu le reprendre.
--
-- Rien ne se perd côté client : `web/lib/onDemandClient.ts` nomme ses colonnes
-- (`COLONNES`), et aucune des quatre n'y figure. La console, elle, passe par
-- les fonctions `admin_*`, qui journalisent.

revoke select on table public.missions from authenticated;

-- La liste du 20 septembre, plus les deux colonnes nées depuis — `appareils`
-- (ce que le client a choisi, et qui fait le prix) et `formule`. Les quatre
-- colonnes de comptabilité restent dehors.
grant select (
  id, reference, groupe_id, company_id, store_id, reserve_par,
  inventory_session_id, client_nom, magasin_nom, adresse, code_postal, ville,
  acces_sur_place, secteur, surface_vente_m2, surface_reserve_m2,
  articles_min, articles_max, references_min, references_max, code_barres,
  engagement_range_le, cgv_version, debut_prevu, moment, duree_prevue_minutes,
  arrivee_prevue, formule, inventoristes, appareils, responsable,
  articles_retenus, prix_cents,
  annulation_gratuite_jusqu_au, etat, acces_ouverts_le, acces_expirent_le,
  created_at, confirmee_le, commencee_le, terminee_le, annulee_le, annulee_par,
  motif
) on table public.missions to authenticated;
