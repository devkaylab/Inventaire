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

-- ⚠️ LE DÉCLENCHEUR SUR `inventory_sessions` AUSSI, et pour la même raison que
-- les policies : il vit sur une table de Quantinvo OS, qui reste. Un
-- `drop table missions cascade` ne l'emporte pas — il LIT `missions`, il n'en
-- dépend pas au sens de Postgres. Le laisser, c'est garder la règle
-- « un inventaire à la fois » dans un produit d'où On-Demand a été retiré,
-- adossée à une table disparue.
drop trigger if exists sessions_un_seul_en_location on public.inventory_sessions;

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
drop table if exists public.tranches_prix cascade;
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
drop function if exists public.un_seul_inventaire_sur_un_magasin_loue() cascade;
-- ⚠️ ET LA TÂCHE HORAIRE, qui manquait (constat du 5 octobre 2026, en relisant
-- ce fichier pour y ajouter le déclencheur). `cloturer_les_inventaires_hors_fenetre`
-- ÉCRIT dans `inventory_sessions` toutes les heures : la laisser programmée
-- après le retrait, c'est une tâche qui échoue chaque heure sur une table
-- `missions` disparue — exactement ce que ce fichier existe pour empêcher.
-- ⚠️ **DEUX `if` IMBRIQUÉS, PAS UN `and`.** Première version écrite
-- `if exists(pg_namespace…) and exists(cron.job…)` : PL/pgSQL prépare
-- l'expression ENTIÈRE comme une seule requête SQL, donc `cron.job` est résolu
-- même quand le premier membre est faux. Le contrôle de réplique l'a dit tout
-- de suite — `ERROR: relation "cron.job" does not exist`. Un court-circuit de
-- langage ne protège pas d'une analyse de requête.
do $$
begin
  if not exists (select 1 from pg_namespace where nspname = 'cron') then
    return;
  end if;
  if exists (select 1 from cron.job where jobname = 'cloturer-hors-fenetre') then
    perform cron.unschedule('cloturer-hors-fenetre');
  end if;
end
$$;
drop function if exists public.cloturer_les_inventaires_hors_fenetre() cascade;
drop function if exists public.creer_la_session_de_mission(uuid) cascade;
drop function if exists public.prix_mission(integer, text, timestamptz, text, text, integer) cascade;
drop function if exists public.prix_mission(integer, text, timestamptz, text, text, integer, text) cascade;
-- ⚠️ LES DEUX NOMS. `devis_mission` a été renommée en `prix_ferme_mission` le
-- 20 septembre 2026 ; un retrait joué sur une base restée à l'ancien nom doit
-- la trouver quand même.
drop function if exists public.devis_mission(jsonb) cascade;
drop function if exists public.prix_ferme_mission(jsonb) cascade;
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
