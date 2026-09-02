-- Ce que QUELQU'UN D'AUTRE a compté sur une balise.
--
-- CONSTAT (2 septembre 2026, test de Julien sur « Seouliste 020926 ») : deux
-- superviseurs ont compté la même balise, et leurs relevés se sont additionnés
-- sans que rien ne les prévienne. L'addition est le modèle — `counts` est un
-- journal en ajout pur, c'est ce qui permet les corrections par lignes
-- négatives. Ce qui manquait, c'est l'avertissement : il ne se déclenchait que
-- sur une balise CLÔTURÉE, jamais sur une balise qu'un collègue avait laissée
-- ouverte.
--
-- ⚠️ POURQUOI « PAR QUELQU'UN D'AUTRE » ET PAS UNE COLONNE « PROPRIÉTAIRE ».
-- Le premier réflexe était d'ajouter à `zones` qui a ouvert la balise. C'est la
-- mauvaise question : deux personnes qui se relaient sur un rayon rendraient
-- cette colonne fausse immédiatement. Ce que l'écran veut savoir, c'est « est-ce
-- que quelqu'un d'autre a compté ici ? » — donc une somme, pas un propriétaire.
-- Aucune migration de schéma, et ça donne gratuitement le cas qui compte le
-- plus : rouvrir SA PROPRE balise ne doit rien demander. Une carte qui
-- s'affiche à chaque retour devient une carte qu'on ferme sans lire.
--
-- ⚠️ Les colonnes s'ajoutent À LA FIN. Les applications déjà installées lisent
-- les neuf premières et ignorent le reste : elles continuent de fonctionner
-- sans être reconstruites.
--
-- ⚠️ DROP puis CREATE — on ne peut pas changer le type de retour d'une fonction
-- par un simple `create or replace`. Les droits sont donc reposés ici même :
-- `create` rend EXECUTE à PUBLIC (donc à `anon`), et un `revoke … from public`
-- ne suffit pas à retirer `anon`. C'est le constat n°6 du 28 août, qui se
-- reproduit à chaque fonction recréée.

drop function if exists public.get_zone_dashboard(uuid);

create function public.get_zone_dashboard(p_session_id uuid)
returns table (
  id uuid,
  code text,
  name text,
  count_status text,
  audit_status text,
  count_units numeric,
  count_lines bigint,
  audit_units numeric,
  audit_lines bigint,
  count_units_autres numeric,
  count_lines_autres bigint,
  audit_units_autres numeric,
  audit_lines_autres bigint
)
language plpgsql
stable
security definer
set search_path to 'public'
as $$
begin
  if not (
    public.can_access_session(p_session_id)
    or exists (select 1 from public.session_members sm
               where sm.session_id = p_session_id and sm.user_id = auth.uid())
  ) then
    raise exception 'forbidden';
  end if;
  return query
  select z.id, z.code, z.name, z.count_status, z.audit_status,
         coalesce(sum(c.qty) filter (where c.pass_number = 1), 0)::numeric,
         count(distinct c.sku) filter (where c.pass_number = 1),
         coalesce(sum(c.qty) filter (where c.pass_number = 2), 0)::numeric,
         count(distinct c.sku) filter (where c.pass_number = 2),
         -- ⚠️ `counted_by is distinct from auth.uid()` et non `<>` : une ligne
         -- dont l'auteur a été supprimé porte `null` (détachée par
         -- `on delete set null`). Elle vient bien de quelqu'un d'autre, et un
         -- `<>` la laisserait passer pour la nôtre.
         coalesce(sum(c.qty) filter (
           where c.pass_number = 1 and c.counted_by is distinct from auth.uid()), 0)::numeric,
         count(distinct c.sku) filter (
           where c.pass_number = 1 and c.counted_by is distinct from auth.uid()),
         coalesce(sum(c.qty) filter (
           where c.pass_number = 2 and c.counted_by is distinct from auth.uid()), 0)::numeric,
         count(distinct c.sku) filter (
           where c.pass_number = 2 and c.counted_by is distinct from auth.uid())
  from public.zones z
  left join public.counts c
    on c.session_id = z.session_id and c.zone = z.code
  where z.session_id = p_session_id
  group by z.id, z.code, z.name, z.count_status, z.audit_status
  order by nullif(regexp_replace(z.code, '\D', '', 'g'), '')::bigint nulls last, z.code;
end; $$;

revoke all on function public.get_zone_dashboard(uuid) from public, anon;
grant execute on function public.get_zone_dashboard(uuid) to authenticated, service_role;
