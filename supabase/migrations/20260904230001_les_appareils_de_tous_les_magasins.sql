-- ============================================================================
-- LES APPAREILS DE TOUS LES MAGASINS D'UNE ENTREPRISE (4 septembre 2026)
-- ----------------------------------------------------------------------------
-- La fiche d'un magasin dit où en est CE magasin (`appareils_du_magasin`). La
-- console Quantinvo, elle, regarde une entreprise entière : il lui faut la même
-- chose pour tous ses magasins **en un appel**. Une boucle d'appels par magasin
-- serait le motif retiré partout ailleurs pour la tenue en charge.
--
-- ⚠️ ELLE NE REND PAS `pic`. Depuis que le verrou ferme la porte au troisième
-- appareil, le pic ne peut plus dépasser le plafond : il ne dit plus rien. Ce
-- qui décide, c'est `refus` — et `besoin` (`pic + refus` du jour le plus
-- chargé), qui estime ce qu'il aurait fallu. Voir la section « Le décompte
-- d'appareils, et le verrou » d'AGENTS.md.
--
-- ⚠️ La garde est celle de l'entreprise, pas celle d'un magasin :
-- `is_admin() or is_company_admin(p_company_id)`. C'est le même périmètre que
-- `peut_lire_rapport_magasin`, à l'échelle au-dessus — l'état d'une licence ne
-- regarde ni un superviseur de secteur ni un compteur.
-- ============================================================================

create or replace function public.appareils_des_magasins(p_company_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  fenetre constant interval := interval '90 seconds';
  jours   constant integer := 30;
  v_depuis date := (now() at time zone 'Europe/Paris')::date - jours;
  v_res jsonb;
begin
  if not (public.is_admin() or public.is_company_admin(p_company_id)) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'store_id', s.id,
           'nom', s.name,
           'plafond', public.plafond_appareils(s.id),
           'maintenant', (select count(*) from public.appareils_actifs a
                           where a.store_id = s.id and not a.refuse
                             and a.vu_le >= now() - fenetre),
           'refus', coalesce((select sum(j.refus) from public.appareils_par_jour j
                               where j.store_id = s.id and j.jour >= v_depuis), 0),
           'besoin', coalesce((select max(j.pic + j.refus) from public.appareils_par_jour j
                                where j.store_id = s.id and j.jour >= v_depuis), 0)
         ) order by s.name), '[]'::jsonb)
    into v_res
    from public.stores s
   where s.company_id = p_company_id;

  return v_res;
end;
$$;

revoke all on function public.appareils_des_magasins(uuid) from public, anon;
grant execute on function public.appareils_des_magasins(uuid) to authenticated, service_role;
