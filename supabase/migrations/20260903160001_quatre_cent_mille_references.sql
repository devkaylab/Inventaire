-- 400 000 références (3 septembre 2026)
--
-- *« Jusqu'à combien peux-tu monter le plafond ? Un vrai inventaire peut aller
-- jusqu'à 400 000 références, on doit voir large. »* — Julien.
--
-- Mesuré d'abord, sur un inventaire synthétique de 382 057 références et
-- 764 114 comptages, en transactions annulées. Tout passait, sauf UNE chose :
--
--   | chemin                          | à 382 057 références |
--   |---------------------------------|----------------------|
--   | cache hors ligne complet         |   709 ms             |
--   | liste des écarts                 | 2 058 ms             |
--   | rapport                          | ~2 500 ms            |
--   | **recalcul des écarts**          | **16 503 ms**        |
--
-- ⚠️ ET IL N'Y A PAS DE VERSION RAPIDE DU RECALCUL COMPLET. Mesuré morceau par
-- morceau : l'`insert … on conflict` doit insérer puis détecter le conflit sur
-- CHACUNE des 382 057 lignes, même quand il n'écrit rien au bout. C'est un
-- plancher d'environ 6 s, quelles que soient les statistiques et le plan.
-- Trois tentatives d'optimisation l'ont confirmé (index d'expression sur
-- l'agrégat : 541 ms ; `where` sur le `do update` ; `enable_nestloop` fermé).
--
-- La seule issue est donc de NE PLUS TOUT RECALCULER À CHAQUE OUVERTURE.

-- ── 1. L'empreinte : « quelque chose a-t-il bougé ? » ───────────────────────
--
-- `counts` est en AJOUT PUR : hors suppression explicite, le nombre de lignes
-- ne peut que croître. Le nombre de comptages est donc une empreinte EXACTE —
-- s'il n'a pas changé, aucun comptage n'est arrivé, et l'audit est à jour.
--
-- ⚠️ C'est exact SEULEMENT parce que toute suppression efface l'empreinte
-- (§4). Sans cela, une suppression suivie d'un ajout redonnerait le même
-- compte et l'audit resterait faux, en silence. Ne jamais ajouter de chemin qui
-- supprime des comptages sans appeler `oublier_empreinte_audit` — un test de
-- garde le vérifie.
--
-- ⚠️ Et l'empreinte ne peut PAS vivre sur `inventory_sessions` : un superviseur
-- a le droit d'y écrire (policy `sessions_supervisor_update`), il pourrait donc
-- figer une empreinte fausse depuis le navigateur et geler ses propres chiffres
-- d'audit. Table à part, RLS active, AUCUNE policy — le motif de
-- `stripe_events_traites` et d'`alertes_envoyees`.
create table if not exists public.audit_empreintes (
  session_id uuid primary key references public.inventory_sessions(id) on delete cascade,
  comptages bigint not null,
  calcule_le timestamptz not null default now()
);

alter table public.audit_empreintes enable row level security;
revoke all on table public.audit_empreintes from public, anon, authenticated;

create or replace function public.oublier_empreinte_audit(p_session_id uuid)
returns void
language sql
volatile
security definer
set search_path to 'public'
as $function$
  delete from public.audit_empreintes where session_id = p_session_id;
$function$;

revoke all on function public.oublier_empreinte_audit(uuid) from public, anon, authenticated;
grant execute on function public.oublier_empreinte_audit(uuid) to service_role;

-- ── 2. L'agrégat n'a plus à trier ──────────────────────────────────────────
--
-- Sans lui, regrouper 764 114 comptages passait par un tri sur disque. Avec,
-- le regroupement suit l'ordre de l'index : 541 ms mesurés.
-- ⚠️ L'expression `coalesce(zone, '')` doit être IDENTIQUE à celle du `group
-- by`, sinon l'index n'est pas utilisable et le tri revient sans prévenir.
create index if not exists counts_session_sku_zone_idx
  on public.counts (session_id, sku, (coalesce(zone, '')));

-- ── 3. Le recalcul ─────────────────────────────────────────────────────────
--
-- ⚠️ L'ANCIENNE SIGNATURE À UN ARGUMENT EST SUPPRIMÉE. `p_force` ayant un
-- défaut, Postgres garderait les deux et un appel à un argument deviendrait
-- ambigu — même piège que `p_event_id` le 28 août et `ca_request_store` le 22.
-- Un appel nommé à un seul argument continue de fonctionner.
drop function if exists public.recompute_session_audit(uuid);

create function public.recompute_session_audit(
  p_session_id uuid,
  p_force boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
-- ⚠️ Le ménage final est une anti-jointure. En boucle imbriquée elle est
-- catastrophique (mesuré : le sous-plan ne retient que `session_id` dans sa
-- condition d'index et reparcourt tous les comptages de l'inventaire pour
-- CHAQUE ligne d'audit) ; en hachage elle vaut 53 ms. Fermer la boucle
-- imbriquée rend le mauvais choix impossible, quelles que soient les
-- statistiques. Aucune autre requête de cette fonction ne fait de jointure.
set enable_nestloop to off
-- Le tout premier recalcul d'un inventaire entièrement compté crée autant de
-- lignes qu'il y a de références : ~15 s à 400 000. C'est incompressible, et
-- cela n'arrive qu'une fois. Le délai par défaut de 8 s le tuerait.
set statement_timeout to '60s'
as $function$
declare
  v_failed int; v_pending int; v_total int;
  v_comptages bigint;
  v_connue bigint;
begin
  if not public.can_access_session(p_session_id) then raise exception 'forbidden'; end if;

  select count(*) into v_comptages from public.counts where session_id = p_session_id;
  select comptages into v_connue from public.audit_empreintes where session_id = p_session_id;

  -- Rien n'est arrivé depuis le dernier passage : l'audit est déjà juste.
  -- ⚠️ `p_force` existe pour un cas précis : l'annulation d'un arbitrage écrit
  -- directement dans `article_audit` sans toucher aux comptages, donc
  -- l'empreinte ne bouge pas. Sans lui, la ligne resterait « pending » au lieu
  -- de retrouver son vrai statut.
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
  -- ⚠️ On n'écrit QUE ce qui change. Réécrire 400 000 lignes identiques coûte
  -- dix secondes et fait mentir `updated_at`, que l'écran affiche à côté d'un
  -- arbitrage : il donnait la date du dernier recalcul, pas celle de la
  -- décision.
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

-- ── 4. Toute suppression de comptages efface l'empreinte ───────────────────
--
-- C'est ce qui rend le raccourci du §1 exact. Deux fonctions suppriment des
-- comptages et sont atteignables depuis un écran.
--
-- ⚠️ `revert_pass` en supprime aussi, et n'est PAS touchée ici : elle est
-- révoquée à `authenticated` depuis le 13 août 2026 (elle permettait de rouvrir
-- un inventaire clôturé), donc injoignable. La redéfinir rendrait EXECUTE à
-- PUBLIC et rouvrirait ce trou pour un gain nul. Le test de garde la nomme
-- explicitement : si elle redevient appelable un jour, il faudra lui ajouter
-- l'appel.
create or replace function public.vider_balise(p_session_id uuid, p_code text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_key text; v_zone text; v_name text;
  v_company uuid; v_inv text;
  v_counts int; v_audits int; v_pieces numeric;
begin
  if not public.can_access_session(p_session_id) then
    return jsonb_build_object('success', false, 'error', 'Accès refusé');
  end if;
  select s.company_id, s.inventory_number into v_company, v_inv
  from public.inventory_sessions s
  where s.id = p_session_id and s.status <> 'closed';
  if not found then
    return jsonb_build_object('success', false, 'error', 'Inventaire clôturé');
  end if;
  v_key := public.norm_balise(p_code);
  if v_key = '' then
    return jsonb_build_object('success', false, 'error', 'Balise invalide');
  end if;
  select z.code, z.name into v_zone, v_name
  from public.zones z
  where z.session_id = p_session_id and public.norm_balise(z.code) = v_key
  for update;
  if not found then
    return jsonb_build_object('success', false, 'error', 'Balise non définie');
  end if;
  select coalesce(sum(c.qty), 0) into v_pieces
  from public.counts c
  where c.session_id = p_session_id
    and public.norm_balise(coalesce(c.zone, '')) = v_key;
  delete from public.counts c
  where c.session_id = p_session_id
    and public.norm_balise(coalesce(c.zone, '')) = v_key;
  get diagnostics v_counts = row_count;
  delete from public.article_audit aa
  where aa.session_id = p_session_id
    and public.norm_balise(coalesce(aa.zone, '')) = v_key;
  get diagnostics v_audits = row_count;
  perform public.oublier_empreinte_audit(p_session_id);
  update public.zones z
  set count_status = 'pending', audit_status = 'pending',
      count_done_at = null, audit_done_at = null
  where z.session_id = p_session_id and public.norm_balise(z.code) = v_key;
  insert into public.company_audit_log (company_id, actor_id, actor_label, action, target_label, details)
  values (
    v_company, auth.uid(),
    coalesce((select p.full_name from public.profiles p where p.id = auth.uid()), 'Compte supprimé'),
    'balise_videe', 'balise ' || v_zone,
    jsonb_build_object('inventaire', v_inv, 'emplacement', v_name,
                       'lignes', v_counts, 'audits', v_audits, 'pieces', v_pieces)
  );
  return jsonb_build_object('success', true, 'code', v_zone,
                            'lignes', v_counts, 'pieces', v_pieces);
end; $function$;

revoke all on function public.vider_balise(uuid, text) from public, anon;
grant execute on function public.vider_balise(uuid, text) to authenticated, service_role;

create or replace function public.delete_audit_line(p_session_id uuid, p_sku text, p_zone text default ''::text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if not public.can_access_session(p_session_id) then raise exception 'forbidden'; end if;
  delete from public.counts
    where session_id = p_session_id and sku = p_sku and coalesce(zone, '') = coalesce(p_zone, '');
  delete from public.article_audit
    where session_id = p_session_id and sku = p_sku and zone = coalesce(p_zone, '');
  perform public.oublier_empreinte_audit(p_session_id);
  return jsonb_build_object('success', true);
end; $function$;

revoke all on function public.delete_audit_line(uuid, text, text) from public, anon;
grant execute on function public.delete_audit_line(uuid, text, text) to authenticated, service_role;
