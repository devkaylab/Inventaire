-- Prévenir avant que le client ne le découvre (3 septembre 2026)
--
-- Quantinvo est en libre-service : un client lance ses inventaires quand il
-- veut, sans nous prévenir. On ne peut donc RIEN anticiper — ni monter la
-- machine la veille, ni surveiller à la main. La seule chose possible, c'est
-- d'être prévenu automatiquement quand un inventaire s'approche de ce que le
-- produit tient.
--
-- Les seuils viennent des mesures du 3 septembre 2026, sur la vraie base :
--
--   · à 400 000 références et 900 000 comptages, `lister_ecarts` demande
--     12,9 s et le premier recalcul des écarts 27,6 s — au-delà du plafond de
--     8 s du rôle `authenticated` ;
--   · le tableau des balises, corrigé le même jour, tient jusque vers
--     3,7 millions de comptages.
--
-- D'où deux repères, volontairement BAS : ils servent à prévenir, pas à
-- constater la panne. Les changer se fait ici, et nulle part ailleurs.
--
--   150 000 références  → le fichier vient d'être importé, souvent plusieurs
--                         jours avant le comptage : c'est le moment utile.
--   400 000 comptages   → le comptage lui-même devient lourd.
--
-- ⚠️ Deux repères distincts, donc deux clés distinctes : ce sont deux moments
-- différents du même inventaire, et le second mérite d'être signalé même si le
-- premier l'a déjà été.

create or replace function public.anomalies_a_signaler()
returns jsonb
language sql
stable security definer
set search_path to 'public'
as $function$
  with ouvertes as (
    select
      'paiement:company:' || r.id::text        as cle,
      'paiement'                               as nature,
      r.company_name                           as objet,
      r.quote_amount_cents                     as montant_centimes,
      r.paid_at                                as depuis,
      'inscription'                            as parcours,
      null::text                               as session_id
      from public.company_requests r
     where r.status = 'paid'
       and r.company_id is null
       and r.paid_at is not null
       and r.paid_at < now() - interval '15 minutes'

    union all

    select
      'paiement:store:' || s.id::text,
      'paiement',
      s.store_name,
      s.quote_amount_cents,
      s.paid_at,
      'ajout de magasin',
      null::text
      from public.store_requests s
     where s.status = 'paid'
       and s.store_id is null
       and s.paid_at is not null
       and s.paid_at < now() - interval '15 minutes'

    union all

    -- Le ménage quotidien n'a pas abouti depuis deux nuits.
    select
      'purge:silencieuse',
      'purge',
      'Purge des données',
      null::bigint,
      p.dernier,
      'ménage quotidien',
      null::text
      from (
        select greatest(
                 coalesce(max(d.end_time), '-infinity'::timestamptz),
                 timestamptz '2026-08-28 13:30:00+00'
               ) as dernier
          from cron.job j
          left join cron.job_run_details d
                 on d.jobid = j.jobid and d.status = 'succeeded'
         where j.jobname = 'purge-donnees-expirees'
      ) p
     where p.dernier < now() - interval '48 hours'

    union all

    -- Un inventaire OUVERT qui passe l'un des deux repères.
    -- ⚠️ Seulement les inventaires ouverts : un inventaire clôturé ne se
    -- compte plus, il ne présente aucun risque, et le signaler chaque jour
    -- ferait du bruit pour rien.
    select
      'volume:' || v.repere || ':' || s.id::text,
      'volume',
      coalesce(nullif(s.name, ''), s.store_name),
      null::bigint,
      s.created_at,
      v.mesure,
      s.id::text
      from public.inventory_sessions s
      cross join lateral (
        select (select count(*) from public.articles a where a.session_id = s.id) as refs,
               (select count(*) from public.counts   c where c.session_id = s.id) as cpts
      ) t
      cross join lateral (
        values
          ('references', t.refs, 150000::bigint,
           t.refs || ' références importées'),
          ('comptages',  t.cpts, 400000::bigint,
           t.cpts || ' comptages enregistrés · ' || t.refs || ' références')
      ) v(repere, valeur, seuil, mesure)
     where s.status in ('open', 'counting')
       and v.valeur >= v.seuil
  )
  select coalesce(jsonb_agg(to_jsonb(o) order by o.depuis), '[]'::jsonb)
    from ouvertes o
    left join public.alertes_envoyees a on a.cle = o.cle
   -- ⚠️ Un dépassement de volume ne se rappelle PAS tous les jours. Un gros
   -- inventaire le reste jusqu'à sa clôture : le redire chaque matin est le
   -- meilleur moyen qu'on cesse de lire ces messages. Un paiement sans suite,
   -- lui, est une anomalie qui dure et qu'il faut retraiter — d'où le rappel.
   where a.cle is null
      or (o.nature <> 'volume' and a.derniere_le < now() - interval '24 hours');
$function$;

revoke all on function public.anomalies_a_signaler() from public, anon, authenticated;
grant execute on function public.anomalies_a_signaler() to service_role;

-- La cloche, en plus de l'e-mail : Julien voit l'alerte en arrivant sur le
-- site, même s'il n'a pas ouvert sa boîte.
--
-- ⚠️ `service_role` seul. `notifications` n'a aucune policy d'écriture, et
-- c'est ce qui garantit qu'aucun client ne peut faire sonner la cloche de
-- quelqu'un d'autre. Cette fonction est appelée par la fonction edge du tour
-- de garde, jamais par un navigateur.
create or replace function public.deposer_notification_admins(
  p_type text, p_donnees jsonb
) returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v_n integer;
begin
  insert into public.notifications (user_id, type, donnees)
  select p.id, p_type, p_donnees
    from public.profiles p
   where p.is_admin = true;
  get diagnostics v_n = row_count;
  return v_n;
end; $function$;

revoke all on function public.deposer_notification_admins(text, jsonb) from public, anon, authenticated;
grant execute on function public.deposer_notification_admins(text, jsonb) to service_role;
