-- Les totaux d'un compteur, calculés sur le serveur.
--
-- L'écran d'un compteur affichait « N pièces comptées · M auditées » en
-- téléchargeant **ses lignes de comptage** puis en les additionnant dans le
-- téléphone. Deux défauts :
--
--   · le volume — sur une journée chargée, des milliers de lignes traversent
--     le réseau mobile pour produire deux nombres ;
--   · surtout, ce que la requête rend dépend de **qui la pose**. Elle ne filtre
--     pas sur la personne : c'est la policy `counts_select_own` qui limite un
--     compteur à ses propres lignes. Un superviseur, lui, relève de
--     `counts_select_supervisor` et verrait **toute l'équipe**, présentée comme
--     son travail à lui. Le groupe de routes `(employee)` ne vérifie pas le
--     rôle, seulement la présence d'un profil.
--
-- Cette fonction lève l'ambiguïté : elle ne compte que `auth.uid()`, quel que
-- soit le rôle de l'appelant.
--
-- Pendant du site : `get_session_count_totals`, qui rend les totaux de
-- l'inventaire entier et sert désormais aussi à l'écran du superviseur.

create or replace function public.get_my_count_totals(p_session_id uuid)
returns table(counted numeric, audited numeric)
language plpgsql
stable security definer
set search_path to 'public'
as $function$
begin
  if auth.uid() is null then
    raise exception 'forbidden';
  end if;

  return query
  select
    coalesce(sum(c.qty) filter (where c.pass_number = 1), 0)::numeric,
    coalesce(sum(c.qty) filter (where c.pass_number = 2), 0)::numeric
  from public.counts c
  where c.session_id = p_session_id
    and c.counted_by = auth.uid();
end;
$function$;

revoke all on function public.get_my_count_totals(uuid) from public, anon;
grant execute on function public.get_my_count_totals(uuid) to authenticated, service_role;
