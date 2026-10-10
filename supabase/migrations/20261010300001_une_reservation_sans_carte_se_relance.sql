-- Une réservation sans carte se relance (10 octobre 2026)
--
-- Julien : « Si la réservation n'est pas finalisée, on envoie un lien au bout
-- d'un moment pour inviter le client à finaliser sa réservation. »
--
-- ⚠️ **CE N'EST PLUS LE COMPTE QUI PEUT RESTER EN PLAN.** Depuis ce matin, le
-- compte et la réservation se font dans le même geste : un refus ne laisse
-- rien derrière lui. Le seul abandon encore possible est **la carte** — et il
-- est silencieux : la réservation existe, le prix est figé, mais la fenêtre
-- d'accès n'est PAS ouverte (`docs/notes/122`). Le client croit avoir réservé.
--
-- ⚠️ **ON REPREND LE MÉCANISME DES RELANCES D'INSCRIPTION**, à l'identique :
-- une fonction qui dit QUI relancer, une qui MARQUE après l'envoi, un
-- déclencheur horaire. Écrire un second mécanisme aurait fait deux calendriers
-- à tenir, deux endroits où oublier de s'arrêter.

-- ─── Ce qu'une mission retient de ses relances ─────────────────────────────
alter table public.missions
  add column if not exists relances smallint not null default 0,
  add column if not exists derniere_relance_le timestamptz;

comment on column public.missions.relances is
  'Combien de fois on a invité ce client à enregistrer sa carte. Trois au plus.';
comment on column public.missions.derniere_relance_le is
  'Quand la dernière invitation est partie. Marqué APRÈS l''envoi, jamais avant.';

-- ⚠️ Ces deux colonnes ne sont PAS données au client. Elles ne lui apprennent
-- rien d'utile, et `grant select` sans liste rouvrirait la table entière —
-- le piège du 5 octobre 2026, documenté dans AGENTS.
revoke select (relances, derniere_relance_le) on public.missions from authenticated;

-- ─── Qui relancer ──────────────────────────────────────────────────────────
--
-- ⚠️ **LE CALENDRIER SE COMPTE EN HEURES, PAS EN JOURS**, et c'est la seule
-- différence avec les relances d'inscription. Une inscription abandonnée peut
-- attendre une semaine ; une réservation a une DATE, souvent la semaine même.
-- Relancer à J+8 un inventaire prévu samedi, c'est écrire après la bataille.
--
-- H+2, H+24, H+72 — et jamais après le créneau choisi.
--
-- ⚠️ **LES DEUX ÉTATS SONT CEUX D'AVANT LA CARTE**, et rien d'autre :
-- `enregistrer_l_empreinte` fait passer à `paiement_autorise` puis `confirmee`.
-- Relancer au-delà écrirait à quelqu'un qui a déjà payé son empreinte.
create or replace function public.missions_a_relancer()
returns table (
  id uuid, user_id uuid, email text, reference text, magasin text,
  prix_cents integer, debut_prevu timestamptz, rang smallint)
language plpgsql
security definer
set search_path = public
as $function$
declare
  -- Le calendrier, en heures. Un seul endroit.
  v_jalons constant integer[] := array[2, 24, 72];
begin
  return query
  select m.id, m.reserve_par, u.email::text, m.reference, m.magasin_nom,
         m.prix_cents, m.debut_prevu,
         (m.relances + 1)::smallint as rang
    from public.missions m
    join auth.users u on u.id = m.reserve_par
   where m.acces_ouverts_le is null              -- la carte n'est pas passée
     and m.etat in ('brouillon', 'prix_calcule')
     and m.annulee_le is null
     and m.debut_prevu > now()                   -- après, ça ne sert plus à rien
     and m.relances < array_length(v_jalons, 1)  -- trois, jamais quatre
     and m.created_at <= now() - (v_jalons[m.relances + 1] || ' hours')::interval
     -- Deux passages du tour de garde ne doivent pas en envoyer deux.
     and (m.derniere_relance_le is null
          or m.derniere_relance_le < now() - interval '2 hours')
   order by m.debut_prevu;
end;
$function$;

revoke all on function public.missions_a_relancer() from public, anon, authenticated;
grant execute on function public.missions_a_relancer() to service_role;

-- ⚠️ ON MARQUE APRÈS L'ENVOI, jamais avant. Un e-mail qui ne part pas laisse la
-- relance ouverte, et l'heure suivante réessaie. L'ordre inverse la ferait
-- taire pour de bon sur un incident réseau d'une seconde.
create or replace function public.marquer_relance_mission(p_mission uuid)
returns json
language plpgsql
security definer
set search_path = public
as $function$
declare v_n int;
begin
  update public.missions
     set relances = relances + 1, derniere_relance_le = now()
   where id = p_mission and acces_ouverts_le is null and relances < 3;
  get diagnostics v_n = row_count;
  return json_build_object('success', v_n > 0);
end;
$function$;

revoke all on function public.marquer_relance_mission(uuid) from public, anon, authenticated;
grant execute on function public.marquer_relance_mission(uuid) to service_role;

-- ─── Le déclencheur horaire ────────────────────────────────────────────────
--
-- ⚠️ La clé partagée vit dans le **coffre**, jamais en clair dans la
-- définition d'une fonction : `pg_get_functiondef` est lisible par qui peut
-- lire le catalogue. Même règle que `declencher_alerte`.
--
-- ⚠️⚠️ **ET L'ADRESSE AUSSI, CONTRAIREMENT À `declencher_alerte`.** Celle-là
-- porte l'adresse du projet de production EN DUR dans son corps. Ce chantier
-- vit sur DEUX projets — le jumeau aujourd'hui, la production le jour J — et
-- une adresse en dur ferait relancer les clients du jumeau depuis la
-- production, ou l'inverse. Chaque base porte la sienne dans son coffre.
--
-- Tant que l'un des deux secrets manque, la fonction **ne fait rien** : la
-- tâche planifiée est donc inoffensive avant sa configuration.
create or replace function public.declencher_relance_reservation()
returns void
language plpgsql
security definer
set search_path to 'public', 'vault', 'net'
as $function$
declare
  v_cle  text;
  v_base text;
begin
  select decrypted_secret into v_cle
    from vault.decrypted_secrets where name = 'alerte_cle' limit 1;
  select decrypted_secret into v_base
    from vault.decrypted_secrets where name = 'base_fonctions' limit 1;

  if v_cle is null or btrim(v_cle) = '' then
    raise notice 'relance : secret « alerte_cle » absent du coffre, rien à faire';
    return;
  end if;
  if v_base is null or btrim(v_base) = '' then
    raise notice 'relance : secret « base_fonctions » absent du coffre, rien à faire';
    return;
  end if;

  -- Rien à envoyer ? On ne réveille personne.
  if not exists (select 1 from public.missions_a_relancer()) then
    return;
  end if;

  perform net.http_post(
    url     := rtrim(btrim(v_base), '/') || '/functions/v1/relance-reservation',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-alerte-cle', v_cle),
    body    := '{}'::jsonb,
    timeout_milliseconds := 20000
  );
end;
$function$;

revoke all on function public.declencher_relance_reservation() from public, anon, authenticated;

-- ⚠️ Le bloc vérifie que `pg_cron` est là : `scripts/replique/verifier.sh`
-- rejoue les vraies migrations sur une base locale qui n'a pas l'extension.
do $$
begin
  if not exists (select 1 from pg_namespace where nspname = 'cron') then
    raise notice 'pg_cron absent : la tâche n''est pas programmée (réplique locale).';
    return;
  end if;

  if exists (select 1 from cron.job where jobname = 'relance-reservation') then
    perform cron.unschedule('relance-reservation');
  end if;

  -- À la minute 23, décalée de l'heure ronde comme les trois autres tâches.
  perform cron.schedule(
    'relance-reservation',
    '23 * * * *',
    $sql$select public.declencher_relance_reservation()$sql$
  );
end
$$;
