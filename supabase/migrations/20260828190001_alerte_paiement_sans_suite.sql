-- ─────────────────────────────────────────────────────────────────────────
-- Un paiement resté sans suite se dit tout seul (28 août 2026).
--
-- Dernier manque de la revue de sécurité : les journaux existaient, mais
-- **personne n'était prévenu de rien**. Le cas qui coûte de l'argent est
-- toujours le même : un client paie par carte, Stripe prévient le serveur, et
-- si ce message ne passe pas — panne, bug, fonction tombée — l'entreprise
-- n'est jamais créée. Le client a payé, il n'a rien, et nous l'apprenons quand
-- il écrit.
--
-- ⚠️ LA DÉTECTION EXISTAIT DÉJÀ. `web/lib/pipeline.ts` sait lire un `paid`
-- sans création (« Payé — création en attente », passé en alerte au bout d'un
-- jour) et /admin l'affiche. Ce qui manquait n'était pas l'intelligence, c'est
-- le **facteur** : il fallait aller chercher l'information. On ne surveille
-- donc pas la machine — pas les erreurs techniques des fonctions, qui sont
-- bruyantes et le plus souvent sans conséquence — mais le **résultat**.
--
-- Trois pièces :
--   1. `anomalies_a_signaler()` — la question, posée en lecture seule ;
--   2. `alertes_envoyees` — la mémoire, pour ne pas écrire vingt-quatre fois
--      par jour à propos du même paiement ;
--   3. `declencher_alerte()` — le déclencheur horaire, qui réveille la
--      fonction edge chargée d'écrire le message.
--
-- ⚠️ QUINZE MINUTES DE GRÂCE. Le webhook crée dans la foulée du paiement, mais
-- Stripe réessaie plusieurs fois quand une réponse tarde. Alerter à la seconde
-- ferait sonner pour des paiements qui se règlent tout seuls deux minutes plus
-- tard — et une alerte qui se trompe est une alerte qu'on cesse de lire.
-- ─────────────────────────────────────────────────────────────────────────

create extension if not exists pg_net;

-- ── La mémoire des alertes ────────────────────────────────────────────────
create table if not exists public.alertes_envoyees (
  cle          text primary key,
  premiere_le  timestamptz not null default now(),
  derniere_le  timestamptz not null default now(),
  nombre       int         not null default 1
);

alter table public.alertes_envoyees enable row level security;
-- Aucune policy : seules les fonctions SECURITY DEFINER y touchent.

comment on table public.alertes_envoyees is
  'Ce dont on a deja prevenu, pour ne pas ecrire toutes les heures a propos du meme incident. Une anomalie qui dure est rappelee une fois par jour, pas davantage.';

-- ── La question ───────────────────────────────────────────────────────────
-- Rend les anomalies ouvertes **dont on n'a pas déjà prévenu** — jamais, ou
-- pas depuis 24 h. Lecture seule : c'est la fonction edge qui marquera, et
-- seulement une fois le message parti. Si l'envoi échoue, l'heure suivante
-- réessaie.
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
  )
  select coalesce(jsonb_agg(to_jsonb(o) order by o.depuis), '[]'::jsonb)
    from ouvertes o
    left join public.alertes_envoyees a on a.cle = o.cle
   where a.cle is null
      or a.derniere_le < now() - interval '24 hours';
$function$;

-- ── La mémoire, écrite après coup ─────────────────────────────────────────
create or replace function public.marquer_alertes(p_cles text[])
returns int
language plpgsql
security definer
set search_path to 'public'
as $function$
declare n int;
begin
  -- Ménage : une anomalie réglée finit par disparaître de la mémoire, de sorte
  -- qu'une récidive redonne lieu à une alerte plutôt qu'à un silence.
  delete from public.alertes_envoyees where derniere_le < now() - interval '30 days';

  insert into public.alertes_envoyees (cle)
  select unnest(coalesce(p_cles, '{}'::text[]))
  on conflict (cle) do update
    set derniere_le = now(),
        nombre = public.alertes_envoyees.nombre + 1;

  get diagnostics n = row_count;
  return n;
end;
$function$;

-- ⚠️ Les deux fonctions ne s'ouvrent qu'au rôle serveur : la première dit
-- combien un client a payé, la seconde éteint une alerte.
revoke all on function public.anomalies_a_signaler() from public, anon, authenticated;
revoke all on function public.marquer_alertes(text[]) from public, anon, authenticated;

-- ── Le déclencheur horaire ────────────────────────────────────────────────
-- ⚠️ La clé partagée vit dans le **coffre** (`vault`), jamais en clair dans la
-- définition d'une fonction : `pg_get_functiondef` est lisible par qui peut
-- lire le catalogue.
--
-- ⚠️ Et ce n'est PAS la clé de service : c'est un jeton dédié qui n'autorise
-- qu'une chose — demander à la fonction edge de faire son tour de garde. Si la
-- base fuyait, ce jeton ne permettrait pas de lire les données.
--
-- Tant que le secret n'est pas posé, la fonction **ne fait rien** : la tâche
-- planifiée est donc inoffensive avant sa configuration.
create or replace function public.declencher_alerte()
returns void
language plpgsql
security definer
set search_path to 'public', 'vault', 'net'
as $function$
declare v_cle text;
begin
  select decrypted_secret into v_cle
    from vault.decrypted_secrets where name = 'alerte_cle' limit 1;

  if v_cle is null or btrim(v_cle) = '' then
    raise notice 'alerte : secret « alerte_cle » absent du coffre, rien à faire';
    return;
  end if;

  -- Et rien à envoyer ? On ne réveille personne.
  if jsonb_array_length(public.anomalies_a_signaler()) = 0 then
    return;
  end if;

  perform net.http_post(
    url     := 'https://heabesqvlinzarqenymj.supabase.co/functions/v1/alerte-anomalies',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-alerte-cle', v_cle),
    body    := '{}'::jsonb,
    timeout_milliseconds := 20000
  );
end;
$function$;

revoke all on function public.declencher_alerte() from public, anon, authenticated;

-- Toutes les heures, à la minute 7 — décalée de l'heure ronde, où se
-- bousculent les tâches planifiées de la moitié de la planète.
select cron.unschedule('alerte-paiement-sans-suite')
 where exists (select 1 from cron.job where jobname = 'alerte-paiement-sans-suite');

select cron.schedule(
  'alerte-paiement-sans-suite',
  '7 * * * *',
  $$select public.declencher_alerte()$$
);
