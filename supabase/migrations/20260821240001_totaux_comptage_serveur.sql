-- Totaux d'un inventaire : calculés par le serveur, plus par le navigateur.
--
-- Le tableau de bord affiche quatre nombres (unités comptées, unités auditées,
-- références comptées, références auditées) et les rafraîchit toutes les huit
-- secondes. Jusqu'ici, `getCountTotals` téléchargeait **toutes les lignes de
-- `counts` de l'inventaire** (qty, pass_number, sku) et faisait l'addition en
-- JavaScript. Sur un inventaire à cent compteurs, cela représente des centaines
-- de milliers de lignes sérialisées par PostgREST, transférées, puis parcourues
-- — toutes les huit secondes, et par superviseur connecté. C'est le deuxième
-- mur identifié dans l'étude de charge du 21 août 2026 (le premier étant la
-- présence temps réel, traitée côté code, contrat v3).
--
-- Le contrôle d'accès est **le même** que `get_zone_dashboard` : superviseur de
-- l'inventaire, ou participant. Ne pas l'assouplir — les totaux disent le
-- volume compté d'un magasin, donnée d'entreprise.
--
-- L'agrégat s'appuie sur `counts_session_pass_idx (session_id, pass_number)`,
-- déjà en place.

create or replace function public.get_session_count_totals(p_session_id uuid)
returns table(
  counted numeric,
  audited numeric,
  counted_skus bigint,
  audited_skus bigint
)
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
begin
  if not (
    public.can_access_session(p_session_id)
    or exists (select 1 from public.session_members sm
               where sm.session_id = p_session_id and sm.user_id = auth.uid())
  ) then
    raise exception 'forbidden';
  end if;

  return query
  select
    coalesce(sum(c.qty) filter (where c.pass_number = 1), 0)::numeric,
    coalesce(sum(c.qty) filter (where c.pass_number = 2), 0)::numeric,
    count(distinct c.sku) filter (where c.pass_number = 1),
    count(distinct c.sku) filter (where c.pass_number = 2)
  from public.counts c
  where c.session_id = p_session_id;
end;
$function$;

-- `create or replace` rend EXECUTE à PUBLIC : on repose les droits dans la même
-- migration, sans quoi la fonction serait appelable par `anon`.
revoke all on function public.get_session_count_totals(uuid) from public;
revoke all on function public.get_session_count_totals(uuid) from anon;
grant execute on function public.get_session_count_totals(uuid) to authenticated;

comment on function public.get_session_count_totals(uuid) is
  'Totaux comptés et audités d''un inventaire (unités et références). Remplace '
  'le téléchargement intégral de counts par le tableau de bord.';
