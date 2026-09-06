-- Archiver un inventaire : douze mois après la clôture (6 septembre 2026)
--
-- Julien : « durée annoncée » et « 12 mois après la clôture ». Rien n'effaçait
-- jamais un inventaire — `purge_expired_data` ne touchait AUCUNE table
-- d'inventaire (vérifié), et un gros inventaire pèse ~680 Mo qui ne
-- redescendent pas.
--
-- ⚠️ ON N'EFFACE QUE LE JOURNAL DES SCANS (`counts`), ET C'EST CE QUI REND CE
-- CHANTIER PETIT. Les 27 fonctions qui touchent `counts` ont été passées en
-- revue : le Rapport, les Écarts et le Rapport magasin lisent tous
-- `article_audit` — le résultat consolidé — jamais le journal. Effacer les
-- scans ne retire donc rien à ce que le client relit, et aucun écran principal
-- ne change. Le référentiel, le stock théorique et l'audit restent entiers.
--
-- Ce qu'on perd, et qui est assumé : la feuille « Détail » de l'export (une
-- ligne par scan, avec qui a compté), le détail d'une balise, et les compteurs
-- d'activité d'une personne qui reculent avec le temps. C'est aussi la donnée
-- NOMINATIVE qui part en premier — `counts.counted_by` — ce qui est le bon sens
-- côté RGPD.
--
-- ⚠️ LA PLACE N'EST PAS RENDUE AU DISQUE POUR AUTANT. Mesuré le 4 septembre :
-- supprimer deux inventaires n'a rendu aucun octet avant un `vacuum full`. Ce
-- que fait cette migration, c'est rendre les pages RÉUTILISABLES (les
-- inventaires suivants les reprennent) et remettre les statistiques d'aplomb.
-- Le `vacuum full`, qui verrouille les tables, reste une opération à programmer
-- à la main, jamais un matin d'inventaire.

-- ---------------------------------------------------------------- le drapeau
alter table public.inventory_sessions
  add column if not exists archived_at timestamptz;

comment on column public.inventory_sessions.archived_at is
  'Date à laquelle le détail des scans a été effacé. Le rapport, lui, reste.';

-- ------------------------------------------------------------- l'archivage
create or replace function public.archiver_inventaires_anciens(
  p_age interval default interval '12 months')
returns jsonb
language plpgsql
security definer
set search_path to 'public'
-- Le premier passage peut porter plusieurs inventaires d'un coup ; les 8 s du
-- rôle client n'ont pas de sens ici, la fonction ne tourne que par la purge.
set statement_timeout to '120s'
as $function$
declare
  v_session record;
  v_lignes bigint;
  v_inventaires int := 0;
  v_comptages bigint := 0;
begin
  -- ⚠️ UNE BORNE BASSE, PARCE QUE LE PARAMÈTRE EFFACE. Elle n'est pas
  -- atteignable depuis un client — la fonction est fermée à `authenticated` —
  -- mais un `interval '0'` passé par erreur en console viderait tous les
  -- inventaires clôturés de la base. Un mois est déjà absurde ; c'est un
  -- garde-fou, pas un réglage.
  if p_age is null or p_age < interval '1 month' then
    raise exception 'archivage : durée trop courte (%), un mois au minimum', p_age;
  end if;

  for v_session in
    select s.id
      from public.inventory_sessions s
     where s.status = 'closed'
       -- ⚠️ `closed_at` NON NUL, sans repli sur `created_at`. Un inventaire
       -- clôturé sans date de clôture existe (des lignes anciennes) : on ne
       -- devine pas une date pour décider d'un effacement.
       and s.closed_at is not null
       and s.closed_at < now() - p_age
       and s.archived_at is null
     order by s.closed_at
  loop
    delete from public.counts where session_id = v_session.id;
    get diagnostics v_lignes = row_count;

    -- ⚠️ RÈGLE DU 3 SEPTEMBRE : toute suppression de comptages efface
    -- l'empreinte. Sans ça, un recalcul retrouverait le même compte et
    -- conclurait à tort que rien n'a bougé. Ici le verrou de
    -- `recompute_session_audit` prend le relais — les deux, pas l'un ou l'autre.
    perform public.oublier_empreinte_audit(v_session.id);

    update public.inventory_sessions set archived_at = now() where id = v_session.id;

    v_inventaires := v_inventaires + 1;
    v_comptages := v_comptages + v_lignes;
  end loop;

  -- ⚠️ LES STATISTIQUES, PAS LE DISQUE. Après une grosse suppression le
  -- planificateur croit encore à l'ancien volume et choisit des plans faits
  -- pour des lignes disparues (constat du 4 septembre : 1,27 million de lignes
  -- supposées dans `counts` pour 165 réelles). `analyze` tient dans une
  -- transaction ; `vacuum` non, et `vacuum full` verrouille — celui-là reste
  -- manuel.
  if v_inventaires > 0 then
    analyze public.counts;
  end if;

  return jsonb_build_object(
    'inventaires_archives', v_inventaires,
    'comptages_effaces', v_comptages);
end; $function$;

-- Elle ne tourne que par la purge, jamais depuis un client.
revoke all on function public.archiver_inventaires_anciens(interval) from public, anon, authenticated;
grant execute on function public.archiver_inventaires_anciens(interval) to service_role;

-- ------------------------------------------- le verrou du recalcul
-- ⚠️ L'EN-TÊTE EST RECOPIÉ DANS LA FORME DU DÉPÔT, PAS DANS CELLE DE LA BASE.
-- `pg_get_functiondef` rend les options en majuscules et entre quotes
-- (`SET enable_nestloop TO 'off'`) ; cinq gardes existantes cherchent la forme
-- minuscule, celle que toutes les migrations écrivent. Repartir de la base est
-- le bon réflexe pour le CORPS — c'est ce qui garantit qu'on ne réécrit que la
-- phrase voulue — mais l'en-tête, lui, se remet dans la langue du dossier.
-- Même famille que le « CREATE OR REPLACE » majuscule du 5 septembre.
create or replace function public.recompute_session_audit(
  p_session_id uuid,
  p_force boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
-- Le ménage final est une anti-jointure : en boucle imbriquée elle est
-- catastrophique, en hachage elle vaut 53 ms. Fermer la boucle rend le mauvais
-- choix impossible quelles que soient les statistiques (3 septembre 2026).
set enable_nestloop to off
-- Le tout premier recalcul d'un inventaire entièrement compté crée autant de
-- lignes qu'il y a de références : ~15 s à 400 000, une seule fois.
set statement_timeout to '60s'
as $function$
declare
  v_failed int; v_pending int; v_total int;
  v_comptages bigint;
  v_connue bigint;
begin
  if not public.can_access_session(p_session_id) then raise exception 'forbidden'; end if;

  -- ⚠️ UN INVENTAIRE ARCHIVÉ NE SE RECALCULE PLUS, ET C'EST VITAL.
  -- Son détail de scans a été effacé : le `delete` de fin, qui retire les
  -- lignes d'audit n'ayant plus aucun comptage, VIDERAIT alors tout son
  -- rapport. Le raccourci de l'empreinte ne protège pas — l'empreinte est
  -- effacée avec les comptages, donc `v_connue` est nul et on tomberait droit
  -- dans le delete. On rend les chiffres tels qu'ils sont, sans rien toucher.
  --
  -- ⚠️ ET CE VERROU PASSE AVANT `p_force`. L'annulation d'un arbitrage force le
  -- recalcul : sur un inventaire archivé, forcer détruirait le rapport. Un
  -- arbitrage reste possible (il écrit directement dans `article_audit`), il ne
  -- fait simplement plus recalculer.
  if exists (select 1 from public.inventory_sessions s
              where s.id = p_session_id and s.archived_at is not null) then
    select count(*) filter (where status = 'failed'),
           count(*) filter (where status = 'pending'),
           count(*)
      into v_failed, v_pending, v_total
      from public.article_audit where session_id = p_session_id;
    return jsonb_build_object('success', true, 'failed', v_failed,
                              'pending', v_pending, 'total', v_total,
                              'inchange', true, 'archive', true);
  end if;

  select count(*) into v_comptages from public.counts where session_id = p_session_id;
  select comptages into v_connue from public.audit_empreintes where session_id = p_session_id;

  if not p_force and v_connue is not null and v_connue = v_comptages then
    select count(*) filter (where status = 'failed'),
           count(*) filter (where status = 'pending'),
           count(*)
      into v_failed, v_pending, v_total
      from public.article_audit where session_id = p_session_id;
    return jsonb_build_object('success', true, 'failed', v_failed,
                              'pending', v_pending, 'total', v_total, 'inchange', true);
  end if;

  with agg as (
    select sku, coalesce(zone, '') as zone,
      sum(qty) filter (where pass_number = 1) as q1,
      sum(qty) filter (where pass_number = 2) as q2,
      sum(qty) filter (where pass_number = 3) as q3
    from public.counts
    where session_id = p_session_id
    group by sku, coalesce(zone, '')
  )
  insert into public.article_audit (session_id, zone, sku, qty_pass1, qty_pass2, qty_pass3, status, final_qty, updated_at)
  select p_session_id, agg.zone, agg.sku, agg.q1, agg.q2, agg.q3,
    case when agg.q1 is not null and agg.q2 is not null and agg.q1 = agg.q2 then 'validated'
         when agg.q1 is not null and agg.q2 is not null and agg.q1 <> agg.q2 then 'failed'
         else 'pending' end,
    case when agg.q1 is not null and agg.q2 is not null and agg.q1 = agg.q2 then agg.q1 else null end,
    now()
  from agg
  on conflict (session_id, zone, sku) do update set
    qty_pass1 = excluded.qty_pass1,
    qty_pass2 = excluded.qty_pass2,
    qty_pass3 = excluded.qty_pass3,
    status    = case when public.article_audit.status = 'resolved' then 'resolved' else excluded.status end,
    final_qty = case when public.article_audit.status = 'resolved' then public.article_audit.final_qty else excluded.final_qty end,
    updated_at = now()
  where public.article_audit.qty_pass1 is distinct from excluded.qty_pass1
     or public.article_audit.qty_pass2 is distinct from excluded.qty_pass2
     or public.article_audit.qty_pass3 is distinct from excluded.qty_pass3
     or (public.article_audit.status <> 'resolved'
         and public.article_audit.status is distinct from excluded.status);

  delete from public.article_audit a
   where a.session_id = p_session_id
     and not exists (
       select 1 from public.counts c
       where c.session_id = a.session_id and c.sku = a.sku and coalesce(c.zone, '') = a.zone
     );

  insert into public.audit_empreintes (session_id, comptages, calcule_le)
  values (p_session_id, v_comptages, now())
  on conflict (session_id) do update set comptages = excluded.comptages, calcule_le = excluded.calcule_le;

  select count(*) filter (where status = 'failed'),
         count(*) filter (where status = 'pending'),
         count(*)
    into v_failed, v_pending, v_total
    from public.article_audit where session_id = p_session_id;
  return jsonb_build_object('success', true, 'failed', v_failed,
                            'pending', v_pending, 'total', v_total);
end; $function$;
revoke all on function public.recompute_session_audit(uuid, boolean) from public, anon;
grant execute on function public.recompute_session_audit(uuid, boolean) to authenticated, service_role;

-- ------------------------------------- la durée entre dans la purge
create or replace function public.purge_expired_data()
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  invitations_ttl      constant interval := interval '3 months';
  demandes_sup_ttl     constant interval := interval '1 year';
  demandes_ent_rej_ttl constant interval := interval '1 year';
  demandes_ent_ttl     constant interval := interval '3 years';
  suppressions_ttl     constant interval := interval '1 year';
  journal_admin_ttl    constant interval := interval '1 year';
  journal_entrep_ttl   constant interval := interval '1 year';
  demandes_mag_ttl     constant interval := interval '1 year';
  evenements_ttl       constant interval := interval '30 days';
  -- ⚠️ TRENTE JOURS, ET C'EST LA MOITIÉ D'UNE PAIRE. La troisième relance part
  -- à J+21 (`inscriptions_a_relancer`) : neuf jours de marge, pas davantage.
  -- Descendre cette valeur sans toucher au calendrier ferait partir un e-mail
  -- sur des réponses déjà effacées. Un test compare les deux.
  inscriptions_ttl     constant interval := interval '30 days';
  -- ⚠️ VINGT-QUATRE HEURES POUR UN CODE, et c'est déjà généreux : il vaut dix
  -- minutes. La ligne porte une adresse e-mail — donc une donnée personnelle —
  -- et rien ne justifiait qu'elle survive à la journée. Sans cette purge, la
  -- table gardait indéfiniment l'adresse de qui a seulement DEMANDÉ un code.
  codes_email_ttl      constant interval := interval '24 hours';
  notifications_ttl    constant interval := interval '90 days';
  messages_ttl         constant interval := interval '1 year';
  appareils_ttl        constant interval := interval '7 days';
  appareils_jour_ttl   constant interval := interval '13 months';
  -- ⚠️ LE DÉTAIL DES SCANS D'UN INVENTAIRE CLÔTURÉ. Arbitré par Julien le
  -- 6 septembre 2026 : une durée annoncée, pas un bouton — « un bouton que
  -- personne ne presse ne rend jamais un octet ». Douze mois, parce qu'un
  -- inventaire se compare d'une année sur l'autre ; au-delà c'est le rapport
  -- qu'on relit, jamais le journal des scans.
  -- ⚠️ CETTE DURÉE EST ANNONCÉE DANS `docs/privacy.html`. Les deux bougent
  -- ensemble — un test compare le nombre de mois écrit ici à celui du document.
  inventaires_ttl      constant interval := interval '12 months';
  rapport              jsonb := '{}'::jsonb;
  n                    int;
begin
  delete from public.team_invitations where created_at < now() - invitations_ttl;
  get diagnostics n = row_count;  rapport := rapport || jsonb_build_object('team_invitations_supprimees', n);

  delete from public.session_invitations where created_at < now() - invitations_ttl;
  get diagnostics n = row_count;  rapport := rapport || jsonb_build_object('session_invitations_supprimees', n);

  update public.supervisor_requests
     set first_name = '', last_name = '',
         email = 'expire+' || id::text || '@invalide.local', phone = ''
   where status in ('active', 'rejected')
     and created_at < now() - demandes_sup_ttl
     and email not like 'expire+%';
  get diagnostics n = row_count;  rapport := rapport || jsonb_build_object('supervisor_requests_anonymisees', n);

  delete from public.company_requests
   where status = 'rejected' and updated_at < now() - demandes_ent_rej_ttl;
  get diagnostics n = row_count;  rapport := rapport || jsonb_build_object('company_requests_supprimees', n);

  update public.company_requests
     set contact_first_name = '', contact_last_name = '',
         contact_email = 'expire+' || id::text || '@invalide.local', contact_phone = ''
   where updated_at < now() - demandes_ent_ttl
     and contact_email not like 'expire+%';
  get diagnostics n = row_count;  rapport := rapport || jsonb_build_object('company_requests_anonymisees', n);

  delete from public.account_deletion_requests where created_at < now() - suppressions_ttl;
  get diagnostics n = row_count;  rapport := rapport || jsonb_build_object('deletion_requests_supprimees', n);

  delete from public.admin_audit_log where created_at < now() - journal_admin_ttl;
  get diagnostics n = row_count;  rapport := rapport || jsonb_build_object('journal_admin_supprime', n);

  delete from public.company_audit_log where created_at < now() - journal_entrep_ttl;
  get diagnostics n = row_count;  rapport := rapport || jsonb_build_object('journal_entreprise_supprime', n);

  delete from public.store_requests
   where handled_at is not null and handled_at < now() - demandes_mag_ttl;
  get diagnostics n = row_count;  rapport := rapport || jsonb_build_object('demandes_magasin_supprimees', n);

  delete from public.stripe_events_traites where recu_le < now() - evenements_ttl;
  get diagnostics n = row_count;  rapport := rapport || jsonb_build_object('evenements_stripe_supprimes', n);

  delete from public.notifications where created_at < now() - notifications_ttl;
  get diagnostics n = row_count;  rapport := rapport || jsonb_build_object('notifications_supprimees', n);

  delete from public.message_fils where dernier_le < now() - messages_ttl;
  get diagnostics n = row_count;  rapport := rapport || jsonb_build_object('fils_supprimes', n);

  delete from public.appareils_actifs where vu_le < now() - appareils_ttl;
  get diagnostics n = row_count;  rapport := rapport || jsonb_build_object('appareils_actifs_supprimes', n);

  delete from public.appareils_par_jour
   where jour < ((now() at time zone 'Europe/Paris')::date - appareils_jour_ttl);
  get diagnostics n = row_count;  rapport := rapport || jsonb_build_object('appareils_par_jour_supprimes', n);

  -- Un brouillon d'inscription jamais déposé. Celui qui a abouti n'est plus un
  -- brouillon : il porte `demande_id`, et c'est la demande qui a sa propre
  -- durée (trois ans).
  delete from public.inscriptions
   where demande_id is null and created_at < now() - inscriptions_ttl;
  get diagnostics n = row_count;  rapport := rapport || jsonb_build_object('inscriptions_abandonnees_supprimees', n);

  delete from public.codes_email where created_at < now() - codes_email_ttl;
  get diagnostics n = row_count;  rapport := rapport || jsonb_build_object('codes_email_supprimes', n);

  -- Le rapport, les écarts et le rapport magasin ne lisent pas `counts` : ils
  -- vivent sur `article_audit`. Effacer le journal des scans ne leur retire
  -- rien — c'est ce qui rend cet archivage possible sans toucher un écran.
  rapport := rapport || public.archiver_inventaires_anciens(inventaires_ttl);

  return rapport || jsonb_build_object('execute_le', now());
end;
$function$;
revoke all on function public.purge_expired_data() from public, anon, authenticated;
grant execute on function public.purge_expired_data() to service_role;

-- ------------------------------------ un inventaire archivé ne se rouvre pas
--
-- ⚠️ SANS CE VERROU, LE TROU EST RÉEL. La réouverture est un simple UPDATE
-- client (`reopenSession`), et le créateur d'un inventaire clôturé y a droit.
-- Rouvert, un inventaire archivé se remettrait à accepter des comptages — mais
-- son recalcul d'audit resterait bloqué par le verrou posé plus haut : les
-- nouveaux scans n'entreraient jamais dans les écarts, en silence. Le retirer,
-- ce verrou, serait pire encore : le recalcul viderait alors le rapport.
--
-- Un inventaire dont le détail a été effacé n'est pas un inventaire qu'on
-- reprend. On le dit, et on refuse.
create or replace function public.inventaire_archive_fige()
returns trigger
-- ⚠️ INVOKER, ET C'EST INDISPENSABLE. En DEFINER, `current_user` vaudrait le
-- propriétaire de la fonction et la condition ne serait jamais vraie : le
-- garde-fou ne s'appliquerait à personne. Même règle que
-- `profiles_pin_privileged`.
language plpgsql security invoker
set search_path to 'public'
as $function$
begin
  if old.archived_at is not null
     and current_user in ('authenticated', 'anon')
     and (new.status is distinct from old.status
          or new.archived_at is distinct from old.archived_at) then
    raise exception 'Cet inventaire est archivé : le détail de ses scans a été effacé douze mois après sa clôture. Son rapport reste consultable, mais il ne se rouvre pas.';
  end if;
  return new;
end; $function$;

-- Le renommage et le reste des colonnes passent : on ne fige que la réouverture.
drop trigger if exists sessions_archive_figee on public.inventory_sessions;
create trigger sessions_archive_figee
  before update on public.inventory_sessions
  for each row execute function public.inventaire_archive_fige();

-- Une fonction de déclencheur n'a aucune raison d'être appelable (constat n°6
-- du 28 août 2026 : `create` rend EXECUTE à PUBLIC, et `anon` en héritait).
revoke all on function public.inventaire_archive_fige() from public, anon, authenticated;
