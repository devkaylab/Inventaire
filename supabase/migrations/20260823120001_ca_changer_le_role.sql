-- Changer le rôle d'un membre : superviseur ⇄ compteur (23 août 2026)
--
-- Demande de Julien. Il n'existait aucun chemin : `profiles.role` est figé par
-- le déclencheur `profiles_pin_privileged` pour `authenticated`, et les seules
-- fonctions qui l'écrivaient étaient `handle_new_user` (à l'inscription) et la
-- console Quantinvo. Une personne embauchée compteur puis promue chef de rayon
-- devait donc être supprimée et réinvitée — en perdant l'attribution de ses
-- comptages au passage.
--
-- ⚠️ **Le rôle ne se change pas seul : les affectations suivent.** Un
-- superviseur est rattaché par `store_supervisors`, un compteur par
-- `store_team`. Écrire `profiles.role` sans déplacer les lignes donnerait
-- quelqu'un qui a un rôle et ne voit rien — l'impasse exacte que la règle
-- « un superviseur a au moins un magasin » a fermée le matin même
-- (`20260823100001`).
--
-- Trois refus, tous nécessaires :
--   · soi-même — un administrateur qui se rétrograde enferme son entreprise ;
--   · un autre administrateur d'entreprise — son rôle et son drapeau se
--     tiennent, et ils se gèrent chez Quantinvo (même règle que
--     `ca_remove_supervisor` et `ca_delete_user`) ;
--   · une promotion sans magasin — la règle du matin.
--
-- Ce qui ne change pas, et n'a pas à changer : les comptages déjà faits
-- (`counts.counted_by`), les inventaires créés (`inventory_sessions.created_by`)
-- et les participations (`session_members`). `delete_session` prévoyait déjà le
-- cas d'un créateur rétrogradé — « une rétrogradation en compteur retire le
-- droit avec le rôle » — et son test le garde.

create or replace function public.ca_set_user_role(
  p_user uuid, p_role text, p_store_ids uuid[] default null)
returns json
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_company uuid;
  v_target  public.profiles%rowtype;
  v_role    text := btrim(coalesce(p_role, ''));
  v_ids     uuid[];
begin
  if not public.is_company_admin() then
    return json_build_object('success', false, 'error', 'Accès réservé à l''administrateur de l''entreprise.');
  end if;
  if v_role not in ('supervisor', 'employee') then
    return json_build_object('success', false, 'error', 'Rôle inconnu.');
  end if;
  if p_user is null or p_user = auth.uid() then
    return json_build_object('success', false, 'error', 'Vous ne pouvez pas changer votre propre rôle.');
  end if;

  select company_id into v_company from public.profiles where id = auth.uid();

  select * into v_target from public.profiles
   where id = p_user and company_id = v_company;
  if not found then
    return json_build_object('success', false, 'error', 'Personne introuvable dans votre entreprise.');
  end if;
  if v_target.is_company_admin then
    return json_build_object('success', false,
      'error', 'Ce compte est administrateur de l''entreprise : son rôle est géré par Quantinvo.');
  end if;
  -- Un second clic n'est pas une erreur.
  if v_target.role = v_role then
    return json_build_object('success', true, 'already', true);
  end if;

  if v_role = 'supervisor' then
    -- Les magasins demandés s'ils sont donnés, sinon ceux où la personne
    -- comptait déjà : promouvoir quelqu'un ne lui retire pas son terrain.
    if coalesce(array_length(p_store_ids, 1), 0) > 0 then
      select array_agg(st.id) into v_ids
        from public.stores st
       where st.company_id = v_company and st.id = any(p_store_ids);
    else
      select array_agg(stm.store_id) into v_ids
        from public.store_team stm
        join public.stores st on st.id = stm.store_id
       where stm.user_id = p_user and st.company_id = v_company;
    end if;

    if coalesce(array_length(v_ids, 1), 0) = 0 then
      return json_build_object('success', false,
        'error', 'Un superviseur a toujours au moins un magasin. Affectez-en un à cette personne avant de la promouvoir.');
    end if;

    insert into public.store_supervisors (store_id, user_id)
      select unnest(v_ids), p_user
      on conflict do nothing;
    delete from public.store_team stm
     using public.stores st
     where st.id = stm.store_id and st.company_id = v_company and stm.user_id = p_user;
  else
    -- Rétrogradation : la personne garde les mêmes magasins, comme compteur.
    -- Un compteur sans magasin est un état normal ; on ne refuse rien ici.
    select array_agg(ss.store_id) into v_ids
      from public.store_supervisors ss
      join public.stores st on st.id = ss.store_id
     where ss.user_id = p_user and st.company_id = v_company;

    if coalesce(array_length(v_ids, 1), 0) > 0 then
      insert into public.store_team (store_id, user_id)
        select unnest(v_ids), p_user
        on conflict do nothing;
    end if;
    delete from public.store_supervisors ss
     using public.stores st
     where st.id = ss.store_id and st.company_id = v_company and ss.user_id = p_user;
  end if;

  update public.profiles set role = v_role where id = p_user;

  -- Deux actions plutôt qu'une : « promu » et « passé en compteur » se lisent,
  -- « rôle modifié » demanderait d'ouvrir le détail.
  perform public.log_company_action(
    v_company,
    case when v_role = 'supervisor' then 'promu_superviseur' else 'retrograde_compteur' end,
    coalesce(v_target.full_name, ''),
    json_build_object('magasins', coalesce(array_length(v_ids, 1), 0))::jsonb);

  return json_build_object('success', true);
end;
$$;

revoke all on function public.ca_set_user_role(uuid, text, uuid[]) from public, anon;
grant execute on function public.ca_set_user_role(uuid, text, uuid[]) to authenticated, service_role;
