-- ⚠️ AU BOUT DE SEPT JOURS, L'INVENTAIRE SE CLÔTURE (Julien, 5 octobre 2026).
--
-- « L'accès reste ouvert 7 j oui, l'inventaire est automatiquement clôturé
-- au-delà de ce délai, pas supprimé. »
--
-- Sans ça, la fenêtre se referme — les appareils en plus disparaissent — mais
-- l'inventaire reste « ouvert » pour toujours : un travail en suspens que
-- personne ne peut plus avancer, et qui fausse les tableaux de bord du client.
--
-- ⚠️ **CLÔTURER, PAS SUPPRIMER.** Un inventaire clôturé garde ses comptages,
-- son rapport et ses écarts : c'est ce que le client a payé. L'archivage, lui,
-- vient un an plus tard et par une autre fonction.
--
-- ⚠️ **ON NE CLÔTURE QUE CE QUI EST NÉ DANS LA FENÊTRE.** Un magasin peut
-- avoir par ailleurs une licence permanente : ses inventaires d'avant la
-- réservation ne regardent pas cette location. La borne basse est donc
-- `acces_ouverts_le`, pas seulement le magasin.
--
-- Cas connu, et assumé : un client qui aurait une licence permanente ET une
-- réservation verrait clôturer un inventaire créé pendant la semaine louée. Il
-- n'aurait pas eu besoin de louer.

create or replace function public.cloturer_les_inventaires_hors_fenetre()
returns jsonb
language plpgsql
security definer
set search_path = public
set statement_timeout to '60s'
as $function$
declare
  v_n integer := 0;
begin
  with finies as (
    select m.store_id, m.acces_ouverts_le, m.acces_expirent_le
      from public.missions m
     where m.acces_ouverts_le is not null
       and m.acces_expirent_le is not null
       and m.acces_expirent_le < now()
  )
  update public.inventory_sessions s
     set status = 'closed',
         closed_at = coalesce(s.closed_at, now())
    from finies f
   where s.store_id = f.store_id
     and s.status <> 'closed'
     and s.created_at >= f.acces_ouverts_le
     and s.created_at <= f.acces_expirent_le;

  get diagnostics v_n = row_count;
  return jsonb_build_object('success', true, 'clotures', v_n);
end;
$function$;

-- ⚠️ PERSONNE NE L'APPELLE DEPUIS UN CLIENT : c'est une tâche d'entretien, et
-- elle ferme des inventaires sans rien demander. `cron` tourne en
-- `service_role`.
revoke all on function public.cloturer_les_inventaires_hors_fenetre() from public, anon, authenticated;
grant execute on function public.cloturer_les_inventaires_hors_fenetre() to service_role;

-- ─── Qui l'appelle ─────────────────────────────────────────────────────────
--
-- ⚠️ TOUTES LES HEURES, et pas une fois par nuit : une fenêtre se referme à
-- l'heure près — sept jours après le créneau choisi, qui est souvent 20:00 ou
-- 22:00. Une tâche nocturne laisserait l'inventaire ouvert jusqu'au lendemain
-- matin, et le client compterait dans un inventaire qu'il croit encore à lui
-- alors que ses appareils en plus ont déjà disparu.
--
-- Le motif est celui des deux tâches existantes : on déprogramme d'abord, pour
-- que rejouer la migration ne crée pas un doublon silencieux.
--
-- ⚠️ **ET LE TOUT PASSE PAR UN BLOC QUI VÉRIFIE QUE `pg_cron` EST LÀ** (ajouté
-- le 5 octobre 2026). `scripts/replique/verifier.sh` rejoue les VRAIES
-- migrations sur une base locale, qui n'a pas l'extension : écrites en clair,
-- ces trois lignes faisaient échouer le contrôle, et le contrôle s'arrête au
-- premier échec. Une migration qu'on ne peut pas rejouer dans la réplique est
-- une migration qu'on n'éprouve pas.
do $$
begin
  if not exists (select 1 from pg_namespace where nspname = 'cron') then
    raise notice 'pg_cron absent : la tâche n''est pas programmée (réplique locale).';
    return;
  end if;

  if exists (select 1 from cron.job where jobname = 'cloturer-hors-fenetre') then
    perform cron.unschedule('cloturer-hors-fenetre');
  end if;

  perform cron.schedule(
    'cloturer-hors-fenetre',
    '5 * * * *',
    $sql$select public.cloturer_les_inventaires_hors_fenetre()$sql$
  );
end
$$;
