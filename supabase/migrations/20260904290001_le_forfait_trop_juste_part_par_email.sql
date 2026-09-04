-- ============================================================================
-- LE FORFAIT TROP JUSTE PART AUSSI PAR E-MAIL (4 septembre 2026)
-- ----------------------------------------------------------------------------
-- Julien : *« pas besoin de proposer d'offre sur l'app je pense, site
-- uniquement et côté admin qui doit recevoir la même alerte de son côté (avec
-- mail). »*
--
-- L'application ne propose rien, et ne doit rien proposer : l'écran de refus
-- s'ouvre devant un compteur debout dans un rayon, qui n'a pas la main. C'est
-- déjà le cas, un test le garde. Ce qui manquait, c'est le second canal côté
-- administrateur : il voyait la cloche et la bannière, encore fallait-il qu'il
-- ouvre le site.
--
-- ⚠️ ELLE NE REDÉTECTE RIEN. L'alerte part des notifications DÉJÀ déposées par
-- `prevenir_forfait_trop_juste`. Une seule détection, donc la cloche et
-- l'e-mail disent la même chose — et le repos de trente jours vaut pour les
-- deux sans qu'on ait à l'écrire deux fois. Une seconde règle de détection
-- aurait divergé de la première au premier ajustement.
--
-- ⚠️ ET C'EST LA PREMIÈRE ALERTE DU TOUR DE GARDE QUI S'ADRESSE AU CLIENT.
-- Les trois autres — paiement sans suite, purge muette, inventaire volumineux —
-- vont aux administrateurs Quantinvo. D'où les deux colonnes `destinataire` et
-- `prenom` : nulles pour les natures internes, renseignées pour celle-ci.
-- ============================================================================

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
      null::text                               as session_id,
      -- ⚠️ Renseignées pour la seule nature « forfait » : c'est la première
      -- qui s'adresse au CLIENT et non à Quantinvo. Nulles ailleurs, et l'edge
      -- s'en sert pour savoir à qui elle écrit et quelle offre nommer.
      null::text                               as destinataire,
      null::text                               as prenom,
      null::integer                            as besoin
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
      null::text, null::text, null::text, null::integer
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
      null::text, null::text, null::text, null::integer
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
      s.id::text, null::text, null::text, null::integer
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

    union all

    -- ⚠️ LE FORFAIT TROP JUSTE — LA PREMIÈRE ALERTE QUI S'ADRESSE AU CLIENT.
    -- Elle ne REDÉTECTE rien : elle part des notifications déjà déposées par
    -- `prevenir_forfait_trop_juste`, celles que l'administrateur voit dans sa
    -- cloche. Une seule détection, donc la cloche et l'e-mail ne peuvent pas
    -- se contredire — et le repos de trente jours de la notification vaut pour
    -- les deux sans qu'on ait à le réécrire.
    select
      'forfait:' || n.id::text,
      'forfait',
      n.donnees ->> 'magasin',
      null::bigint,
      n.created_at,
      (n.donnees ->> 'besoin') || ' appareils auraient été nécessaires, le forfait en couvre '
        || (n.donnees ->> 'forfait'),
      n.donnees ->> 'store_id',
      lower(u.email::text),
      coalesce(nullif(btrim(p.first_name), ''), ''),
      nullif(btrim(coalesce(n.donnees ->> 'besoin', '')), '')::integer
      from public.notifications n
      join auth.users u on u.id = n.user_id
      left join public.profiles p on p.id = n.user_id
     where n.type = 'forfait_trop_juste'
       -- Sept jours : si le tour de garde est resté muet une nuit, l'e-mail
       -- part quand même ; au-delà, le message aurait perdu son actualité.
       and n.created_at > now() - interval '7 days'
       and u.email is not null
  )
  select coalesce(jsonb_agg(to_jsonb(o) order by o.depuis), '[]'::jsonb)
    from ouvertes o
    left join public.alertes_envoyees a on a.cle = o.cle
   -- ⚠️ Un dépassement de volume ne se rappelle PAS tous les jours. Un gros
   -- inventaire le reste jusqu'à sa clôture : le redire chaque matin est le
   -- meilleur moyen qu'on cesse de lire ces messages. Un paiement sans suite,
   -- lui, est une anomalie qui dure et qu'il faut retraiter — d'où le rappel.
   where a.cle is null
      -- ⚠️ NI « volume » NI « forfait » NE SE RAPPELLENT. Un gros inventaire
      -- le reste jusqu'à sa clôture, et une notification de forfait est DÉJÀ
      -- au repos trente jours : la redire chaque matin est le meilleur moyen
      -- qu'on cesse de lire ces messages. Un paiement sans suite, lui, est une
      -- anomalie qui dure et qu'il faut retraiter — d'où le rappel.
      or (o.nature not in ('volume', 'forfait') and a.derniere_le < now() - interval '24 hours');
$function$;

revoke all on function public.anomalies_a_signaler() from public, anon, authenticated;
grant execute on function public.anomalies_a_signaler() to service_role;
