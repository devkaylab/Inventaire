-- ─────────────────────────────────────────────────────────────────────────
-- Le tour de garde surveille aussi la purge (28 août 2026).
--
-- Julien, à qui je venais de demander de lancer une requête chaque matin pour
-- vérifier que la purge avait tourné : *« elle ne peut pas se run seule la
-- commande ? »*. Elle peut, et surtout **elle ne devrait pas exister** : une
-- vérification qu'un humain doit penser à faire est une vérification qui
-- s'arrête au bout de trois jours.
--
-- La surveillance existait déjà (`anomalies_a_signaler`, 20260828190001) : on
-- lui ajoute une question. Le principe ne change pas — **on surveille le
-- résultat, pas la machine** : non pas « la tâche a-t-elle renvoyé une
-- erreur ? », mais « le ménage a-t-il eu lieu ? ».
--
-- ⚠️ QUARANTE-HUIT HEURES, pas vingt-quatre. La purge passe une fois par jour :
-- alerter au bout de 24 h ferait sonner pour un passage décalé de quelques
-- minutes, ou pour une base momentanément indisponible. Deux nuits manquées,
-- en revanche, ce n'est plus un hasard.
--
-- ⚠️ ET LE PIÈGE DU DÉMARRAGE. Au moment où cette migration est écrite, la
-- purge **n'a encore jamais tourné** — son premier passage est cette nuit. Une
-- condition naïve (« aucun passage réussi depuis 48 h ») serait donc vraie tout
-- de suite, et l'alerte partirait avant même que le ménage ait eu sa chance.
-- D'où le repli sur `INSTALLATION` : tant que 48 h ne se sont pas écoulées
-- depuis la pose de cette surveillance, on se tait. Et si la tâche ne démarrait
-- jamais du tout, l'alerte finirait par partir quand même — ce qui est
-- exactement ce qu'on veut.
--
-- Ce qui est conservé du mécanisme : la mémoire des alertes (un rappel par
-- jour, pas davantage), l'envoi par la fonction edge, et le marquage après
-- l'envoi seulement.
-- ─────────────────────────────────────────────────────────────────────────

create or replace function public.anomalies_a_signaler()
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $function$
  with ouvertes as (
    -- Une inscription payée dont l'entreprise n'a jamais été créée.
    select
      'paiement:company:' || r.id::text        as cle,
      'paiement'                               as nature,
      r.company_name                           as objet,
      r.quote_amount_cents                     as montant_centimes,
      r.paid_at                                as depuis,
      'inscription'                            as parcours
      from public.company_requests r
     where r.status = 'paid'
       and r.company_id is null
       and r.paid_at is not null
       and r.paid_at < now() - interval '15 minutes'

    union all

    -- Un ajout de magasin payé dont le magasin n'a jamais été créé.
    select
      'paiement:store:' || s.id::text,
      'paiement',
      s.store_name,
      s.quote_amount_cents,
      s.paid_at,
      'ajout de magasin'
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
      'ménage quotidien'
      from (
        select greatest(
                 coalesce(max(d.end_time), '-infinity'::timestamptz),
                 -- Le repli du démarrage : voir l'en-tête de la migration.
                 timestamptz '2026-08-28 13:30:00+00'
               ) as dernier
          from cron.job j
          left join cron.job_run_details d
                 on d.jobid = j.jobid and d.status = 'succeeded'
         where j.jobname = 'purge-donnees-expirees'
      ) p
     where p.dernier < now() - interval '48 hours'
  )
  select coalesce(jsonb_agg(to_jsonb(o) order by o.depuis), '[]'::jsonb)
    from ouvertes o
    left join public.alertes_envoyees a on a.cle = o.cle
   where a.cle is null
      or a.derniere_le < now() - interval '24 hours';
$function$;

revoke all on function public.anomalies_a_signaler() from public, anon, authenticated;

comment on function public.anomalies_a_signaler() is
  'Ce qui merite un e-mail : un paiement encaisse sans creation (15 min de grace), et la purge quotidienne qui n''a pas abouti depuis 48 h. Reservee au role serveur. Ne rend que ce dont on n''a pas deja prevenu depuis 24 h.';
