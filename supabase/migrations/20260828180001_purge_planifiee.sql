-- ─────────────────────────────────────────────────────────────────────────
-- La purge des données s'exécute enfin toute seule (28 août 2026).
--
-- Constat n°5 de la revue de sécurité. `purge_expired_data()` porte les durées
-- de conservation en un seul point depuis le 18 août — trois mois, un an,
-- trois ans — et **rien ne l'appelait**. `pg_cron` n'était pas installé, et son
-- corps n'avait jamais été exécuté. Autrement dit, les durées annoncées dans la
-- politique de confidentialité n'étaient pas tenues : tout était conservé
-- indéfiniment. C'est autant un sujet RGPD qu'un sujet de sécurité — plus on
-- garde, plus une fuite coûte cher.
--
-- ⚠️ ESSAYÉE À BLANC AVANT D'ÊTRE PLANIFIÉE, en transaction annulée, le
-- 28 août 2026. Elle s'exécute sans erreur et **ne supprimerait rien
-- aujourd'hui** : les dix compteurs de son rapport sont à zéro, la base est
-- trop jeune pour qu'une durée soit atteinte. C'est le meilleur moment pour la
-- brancher — elle ne peut surprendre personne, et son premier vrai passage
-- portera sur des lignes dont l'échéance sera arrivée normalement.
--
-- Ce qu'elle fait, pour mémoire : supprime les invitations de plus de trois
-- mois, anonymise les demandes superviseur (1 an) et les demandes d'entreprise
-- (3 ans), supprime les demandes d'entreprise refusées (1 an), les demandes de
-- suppression de compte (1 an), les deux journaux d'administration (1 an) et
-- les demandes de magasin traitées (1 an). `submission_attempts` n'y figure
-- pas : `rate_limit_ok` la purge elle-même à 24 h.
--
-- 03 h 15 UTC : hors des heures d'inventaire, et décalé de l'heure ronde où se
-- bousculent les tâches planifiées.
--
-- OÙ SE LIT CE QUI S'EST PASSÉ : `cron.job_run_details` garde le statut, la
-- durée et l'horodatage de chaque passage — c'est la trace, et elle se lit
-- aussi depuis le tableau de bord Supabase. La fonction ne journalise pas dans
-- `admin_audit_log` : ce journal enregistre des gestes faits sur des personnes
-- et des entreprises, et 365 lignes par an disant « rien à purger » le
-- noieraient.
--
-- POUR L'ARRÊTER, si un jour il le faut :
--   select cron.unschedule('purge-donnees-expirees');
-- POUR VOIR LES DERNIERS PASSAGES :
--   select * from cron.job_run_details order by start_time desc limit 20;
-- ─────────────────────────────────────────────────────────────────────────

create extension if not exists pg_cron;

-- Idempotent : rejouer cette migration ne crée pas un second passage par jour.
select cron.unschedule('purge-donnees-expirees')
 where exists (select 1 from cron.job where jobname = 'purge-donnees-expirees');

select cron.schedule(
  'purge-donnees-expirees',
  '15 3 * * *',
  $$select public.purge_expired_data()$$
);
