-- Rétablissement temporaire de `get_session_activity`.
--
-- La migration précédente (20260819171741) l'a supprimée alors que le site en
-- production l'appelait encore : le code qui s'en passe était prêt, mais pas
-- déployé. Conséquence immédiate — `refreshLive` lève dans son `Promise.all`,
-- l'erreur remonte au chargement du tableau de bord, et ouvrir un inventaire
-- affichait « Cet inventaire n'est pas accessible ».
--
-- L'ordre correct est : déployer d'abord le code qui n'appelle plus la
-- fonction, supprimer la fonction ensuite. On restaure donc l'état d'origine,
-- à l'identique, et la suppression sera rejouée une fois le contrat de
-- présence v2 en production.

create or replace function public.get_session_activity(
  p_session_id uuid,
  p_window_minutes int default 15
)
returns table(
  user_id uuid,
  full_name text,
  last_action_at timestamptz,
  last_zone text,
  last_pass int,
  events_window bigint,
  units_window numeric,
  events_total bigint,
  first_action_at timestamptz)
language plpgsql stable security definer set search_path to 'public' as $function$
begin
  if not public.can_access_session(p_session_id) then raise exception 'forbidden'; end if;

  return query
  with w as (
    select now() - make_interval(mins => greatest(coalesce(p_window_minutes, 15), 1)) as since
  ),
  last as (
    select distinct on (c.counted_by)
           c.counted_by as uid, c.created_at as at, c.zone as zone, c.pass_number as pass
    from public.counts c
    where c.session_id = p_session_id and c.counted_by is not null
    order by c.counted_by, c.created_at desc
  ),
  agg as (
    select c.counted_by as uid,
           count(*) filter (where c.created_at >= w.since)                 as ev_w,
           coalesce(sum(c.qty) filter (where c.created_at >= w.since), 0)  as un_w,
           count(*)                                                        as ev_t,
           min(c.created_at)                                               as first_at
    from public.counts c cross join w
    where c.session_id = p_session_id and c.counted_by is not null
    group by c.counted_by
  )
  select l.uid, p.full_name, l.at, l.zone, l.pass,
         a.ev_w, a.un_w::numeric, a.ev_t, a.first_at
  from last l
  join agg a on a.uid = l.uid
  left join public.profiles p on p.id = l.uid
  order by l.at desc;
end; $function$;

revoke all on function public.get_session_activity(uuid, int) from anon;
grant execute on function public.get_session_activity(uuid, int) to authenticated;
