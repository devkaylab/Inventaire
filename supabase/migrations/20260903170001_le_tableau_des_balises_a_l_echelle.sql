-- Le tableau des balises, à l'échelle (3 septembre 2026)
--
-- `get_zone_dashboard` est l'appel le plus fréquent du produit : le tableau de
-- bord du superviseur ET l'écran de comptage de chaque téléphone, rejoué à
-- chaque ouverture et à chaque clôture de balise. Mesuré sur un inventaire
-- d'essai de 400 000 références, 500 balises et 900 000 comptages : **6 225 ms**,
-- pour un plafond `authenticated` de 8 s. Il est TOMBÉ EN 500 en production
-- pendant la mesure (POST /rest/v1/rpc/get_zone_dashboard, 16:40:56 UTC).
--
-- Deux causes, mesurées séparément, et il faut les deux.
--
-- ⚠️ 1. `auth.uid()` ÉTAIT APPELÉE DANS LA REQUÊTE — donc par ligne.
--    Elle figure dans quatre `filter (...)`, sur 900 000 lignes : jusqu'à 3,6
--    millions d'appels, chacun relisant et analysant le JSON des claims. La
--    lire UNE FOIS dans une variable fait passer la fonction de 6 225 ms à
--    3 459 ms — 44 % du temps, pour une ligne de code.
--    C'est un piège général : toute fonction qui met `auth.uid()` dans un
--    `where`/`filter` portant sur des lignes le paie.
--
-- ⚠️ 2. Les quatre `count(distinct sku)` forçaient un TRI GLOBAL des 900 000
--    lignes. `work_mem` valant 3,5 Mo, il débordait sur disque (« external
--    merge Disk: 33 Mo », vu au plan). On regroupe donc d'abord par
--    (balise, référence, passe) — après quoi il n'y a plus de « distinct » à
--    calculer, seulement des lignes déjà uniques à compter.
--
-- Résultat cumulé : **6 225 ms → 1 916 ms**, soit 3,2×. Le plafond de 8 s
-- passe d'environ 1,1 million de comptages à environ 3,7 millions.
--
-- ⚠️ LE RÉSULTAT EST RIGOUREUSEMENT IDENTIQUE, vérifié avant d'appliquer :
-- 0 différence sur 501 balises d'essai et 70 balises réelles (deux
-- superviseurs), en couvrant la balise sans aucun comptage, la balise sans
-- audit, celle comptée par d'autres, et les 125 balises où l'appelant avait
-- compté lui-même — c'est cette dernière qui exerce la branche « autrui ».
--
-- ⚠️ Ce que ça ne fait PAS : supprimer la croissance. Le calcul reste
-- proportionnel au nombre de comptages de l'inventaire. Le rendre constant
-- demanderait un compteur par balise tenu à l'écriture — plus puissant, mais
-- un invariant de plus à ne jamais laisser dériver (même famille que
-- `audit_empreintes`). À ouvrir seulement si un client dépasse cette marge.

-- L'index manquant, signalé dans le dépôt depuis le 21 août. Il sert la
-- pré-agrégation ci-dessous, qui regroupe par (session, balise, référence,
-- passe) : l'ordre de l'index est exactement celui du regroupement.
create index if not exists counts_session_zone_sku_pass_idx
  on public.counts (session_id, zone, sku, pass_number);

create or replace function public.get_zone_dashboard(p_session_id uuid)
returns table(id uuid, code text, name text, count_status text, audit_status text,
  count_units numeric, count_lines bigint, audit_units numeric, audit_lines bigint,
  count_units_autres numeric, count_lines_autres bigint,
  audit_units_autres numeric, audit_lines_autres bigint)
language plpgsql
stable security definer
set search_path to 'public'
as $function$
-- ⚠️ Lue UNE FOIS. Dans la requête, elle serait évaluée par ligne — voir l'en-tête.
declare v_moi uuid := auth.uid();
begin
  if not (
    public.can_access_session(p_session_id)
    or exists (select 1 from public.session_members sm
               where sm.session_id = p_session_id and sm.user_id = auth.uid())
  ) then
    raise exception 'forbidden';
  end if;

  return query
  -- Une ligne par (balise, référence, passe). C'est ce regroupement qui
  -- remplace les `count(distinct)` : ensuite, compter les références d'une
  -- balise revient à compter des lignes déjà uniques.
  with par_ref as (
    select c.zone as z, c.pass_number as p,
           sum(c.qty) as qty,
           -- ⚠️ `is distinct from` et non `<>` : une ligne dont l'auteur a été
           -- supprimé porte `null` (détachée par `on delete set null`). Elle
           -- vient bien de quelqu'un d'autre, et un `<>` la laisserait passer
           -- pour la nôtre.
           sum(c.qty) filter (where c.counted_by is distinct from v_moi) as qty_autres,
           bool_or(c.counted_by is distinct from v_moi) as autrui
    from public.counts c
    where c.session_id = p_session_id
    group by c.zone, c.sku, c.pass_number
  )
  select z.id, z.code, z.name, z.count_status, z.audit_status,
         coalesce(sum(r.qty)        filter (where r.p = 1), 0)::numeric,
         count(*)                   filter (where r.p = 1),
         coalesce(sum(r.qty)        filter (where r.p = 2), 0)::numeric,
         count(*)                   filter (where r.p = 2),
         coalesce(sum(r.qty_autres) filter (where r.p = 1), 0)::numeric,
         count(*)                   filter (where r.p = 1 and r.autrui),
         coalesce(sum(r.qty_autres) filter (where r.p = 2), 0)::numeric,
         count(*)                   filter (where r.p = 2 and r.autrui)
  from public.zones z
  left join par_ref r on r.z = z.code
  where z.session_id = p_session_id
  group by z.id, z.code, z.name, z.count_status, z.audit_status
  order by nullif(regexp_replace(z.code, '\D', '', 'g'), '')::bigint nulls last, z.code;
end; $function$;

-- ⚠️ `create or replace` rend EXECUTE à PUBLIC. On repose les droits, `anon`
-- nommément — constat n°6 du 28 août 2026, qui se reproduit à chaque fois.
revoke all on function public.get_zone_dashboard(uuid) from public, anon;
grant execute on function public.get_zone_dashboard(uuid) to authenticated, service_role;
