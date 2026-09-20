-- Retirer On-Demand en entier.
--
-- ⚠️ C'EST LE CONTRÔLE QUI COMPTE LE JOUR OÙ ÇA VA MAL. Après ce fichier,
-- Quantinvo OS doit se comporter EXACTEMENT comme avant. S'il reste une
-- différence, c'est qu'On-Demand s'est installé dans le produit qui tourne au
-- lieu de vivre à côté.
--
-- ⚠️ Les policies se retirent une par une AVANT les tables : celles posées sur
-- `inventory_sessions`, `zones` et `counts` vivent sur des tables d'OS, qui
-- restent. Un `drop table ... cascade` ne les emporterait pas.
-- ⚠️ D'ABORD REMETTRE CE QUI APPARTIENT À QUANTINVO OS. `prendre_place_appareil`
-- a été remplacée par la migration du plafond : la laisser en l'état après
-- avoir supprimé `a_un_acces_mission` arrête le comptage pour tout le monde.
\ir 91-restaurer-quantinvo-os.sql

drop policy if exists sessions_acces_mission on public.inventory_sessions;
drop policy if exists sessions_acces_mission_update on public.inventory_sessions;
drop policy if exists zones_acces_mission on public.zones;
drop policy if exists zones_acces_mission_responsable on public.zones;
drop policy if exists counts_acces_mission_insert on public.counts;
drop policy if exists counts_acces_mission_select on public.counts;
drop policy if exists counts_acces_mission_recompte on public.counts;

drop table if exists public.mission_access cascade;
drop table if exists public.mission_assignments cascade;
drop table if exists public.missions cascade;
drop table if exists public.mission_groupes cascade;
drop sequence if exists public.missions_reference_seq cascade;
drop table if exists public.reglages_annulation cascade;
drop table if exists public.coefficients_prix cascade;
drop table if exists public.reglages_prix cascade;
drop table if exists public.zones_desservies cascade;
drop table if exists public.provider_availability cascade;
drop table if exists public.provider_profiles cascade;
drop table if exists public.entitlements cascade;

drop function if exists public.a_un_acces_mission(uuid, text) cascade;
drop function if exists public.mon_acces() cascade;
drop function if exists public.enregistrer_mon_profil_inventoriste(text, text, integer, text[], text[], text, integer) cascade;
drop function if exists public.enregistrer_mes_disponibilites(jsonb) cascade;
drop function if exists public.plafond_mission_en_cours(uuid) cascade;
drop function if exists public.plafond_appareils_effectif(uuid) cascade;
drop function if exists public.transition_mission_permise(text, text) cascade;
drop function if exists public.transition_mission_permise(text, text, text) cascade;
drop function if exists public.missions_verifier_transition() cascade;
drop function if exists public.ouvrir_les_acces_mission(uuid) cascade;
drop function if exists public.fermer_les_acces_mission(uuid) cascade;
drop function if exists public.missions_accorder_les_acces() cascade;
drop function if exists public.missions_figer_le_prix() cascade;
drop function if exists public.equipe_de_ma_mission(uuid) cascade;
drop function if exists public.pointer_mon_arrivee(uuid) cascade;
drop function if exists public.creer_la_session_de_mission(uuid) cascade;
drop function if exists public.prix_mission(integer, text, timestamptz, text, text, integer) cascade;
drop function if exists public.prix_mission(integer, text, timestamptz, text, text, integer, text) cascade;
drop function if exists public.devis_mission(jsonb) cascade;
drop function if exists public.remuneration_totale(uuid) cascade;
drop function if exists public.frais_annulation(uuid) cascade;
drop function if exists public.reserver_ma_mission(jsonb) cascade;
drop function if exists public.annuler_ma_mission(uuid, text) cascade;
drop function if exists public.reserver_un_groupe(jsonb) cascade;
drop function if exists public.admin_missions(integer) cascade;
drop function if exists public.admin_mission(uuid) cascade;
drop function if exists public.admin_candidats_mission(uuid) cascade;
drop function if exists public.admin_proposer_mission(uuid, uuid, text) cascade;
drop function if exists public.admin_retirer_de_la_mission(uuid, uuid, text) cascade;
drop function if exists public.admin_avancer_mission(uuid, text) cascade;
drop function if exists public.admin_poser_reglages_prix(jsonb) cascade;
drop function if exists public.admin_apercu_prix(integer, text) cascade;
drop function if exists public.admin_apercu_prix(integer, text, text) cascade;
drop function if exists public.admin_paiements(timestamptz, timestamptz) cascade;
drop function if exists public.mes_propositions() cascade;
drop function if exists public.repondre_a_une_mission(uuid, boolean, text) cascade;
drop function if exists public.mon_espace_inventoriste() cascade;
drop function if exists public.ma_zone_de_mission(uuid) cascade;
