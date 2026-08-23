-- Pointes de charge applicative (23 août 2026)
--
-- Le flux de métriques du projet donne l'état de l'instance À L'INSTANT du
-- relevé — connexions, disque, mémoire. Il ne dit rien du pic : une page
-- ouverte à 14 h ne saura jamais ce qui s'est passé la nuit du gros
-- inventaire. Or c'est le pic qui décide de la taille de machine.
--
-- Cette fonction le retrouve dans `counts`, minute par minute. Elle mesure la
-- charge que l'APPLICATION a produite, pas celle que l'instance a encaissée —
-- c'est le chiffre à comparer au plafond d'écritures d'une Micro (200 à 400
-- par seconde, étude de charge du 21 août 2026).
--
-- Par minute et non par seconde : la seconde est trop fine pour un comptage
-- humain, et une rafale d'une seconde ne dimensionne rien.
--
-- Lecture seule, gardée par `is_admin()`, donc pas de journalisation :
-- `log_admin_action` est pour les fonctions qui écrivent.

create or replace function public.admin_charge_pointes()
returns json
language plpgsql stable security definer set search_path to 'public'
as $$
declare v json;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;

  with par_minute as (
    select date_trunc('minute', c.created_at)   as minute,
           count(*)                             as ecritures,
           count(distinct c.counted_by)         as compteurs,
           count(distinct c.session_id)         as inventaires
      from public.counts c
     where c.created_at > now() - interval '12 months'
     group by 1
  ),
  pointe as (
    select ecritures, compteurs, inventaires, minute
      from par_minute
     order by ecritures desc, minute desc
     limit 1
  )
  select json_build_object(
    'ecritures_min',    (select ecritures from pointe),
    'ecritures_quand',  (select minute from pointe),
    'compteurs_max',    (select max(compteurs) from par_minute),
    'inventaires_max',  (select max(inventaires) from par_minute),
    'minutes_actives',  (select count(*) from par_minute),
    'lignes',           (select coalesce(sum(ecritures), 0) from par_minute)
  ) into v;

  return v;
end; $$;

revoke all on function public.admin_charge_pointes() from public, anon;
grant execute on function public.admin_charge_pointes() to authenticated;

comment on function public.admin_charge_pointes() is
  'Pointes de charge applicative sur 12 mois, relevées dans `counts` minute par minute. Le flux de métriques donne l''instant ; celle-ci donne le pic, qui est ce qui dimensionne la machine.';
