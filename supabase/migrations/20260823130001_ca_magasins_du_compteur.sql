-- Affecter un magasin à un compteur (23 août 2026)
--
-- Il n'existait que `remove_counter_from_store` : on pouvait retirer un
-- compteur d'un magasin, jamais lui en donner un. Conséquences vues en vrai le
-- même jour : un compteur retiré de son dernier magasin devient **invisible
-- partout** (les listes se lisent magasin par magasin), donc irrécupérable —
-- et impossible à promouvoir, puisqu'un superviseur a toujours au moins un
-- magasin.
--
-- Miroir de `ca_set_supervisor_stores`, à une différence près, et elle est
-- volontaire : **un compteur sans magasin est un état normal**, on ne refuse
-- donc pas la liste vide. C'est un compte en attente d'affectation, pas une
-- impasse — l'écran le montre et permet d'en sortir.

create or replace function public.ca_set_counter_stores(p_user uuid, p_store_ids uuid[])
returns json
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_company uuid;
  v_target  public.profiles%rowtype;
  v_ids     uuid[] := coalesce(p_store_ids, '{}');
begin
  if not public.is_company_admin() then
    return json_build_object('success', false, 'error', 'Accès réservé à l''administrateur de l''entreprise.');
  end if;
  select company_id into v_company from public.profiles where id = auth.uid();

  select * into v_target from public.profiles
   where id = p_user and company_id = v_company and role = 'employee';
  if not found then
    return json_build_object('success', false, 'error', 'Compteur introuvable dans votre entreprise.');
  end if;

  -- Les magasins doivent être ceux de l'entreprise : sans ce filtre, un appel
  -- direct à l'API rattacherait un compteur au magasin d'un autre client.
  select coalesce(array_agg(st.id), '{}') into v_ids
    from public.stores st
   where st.company_id = v_company and st.id = any(v_ids);

  delete from public.store_team stm
   using public.stores st
   where st.id = stm.store_id and st.company_id = v_company and stm.user_id = p_user;

  if coalesce(array_length(v_ids, 1), 0) > 0 then
    insert into public.store_team (store_id, user_id)
      select unnest(v_ids), p_user
      on conflict do nothing;
  end if;

  perform public.log_company_action(v_company, 'compteur_magasins_modifies',
    coalesce(v_target.full_name, ''),
    json_build_object('magasins', coalesce(array_length(v_ids, 1), 0))::jsonb);

  return json_build_object('success', true);
end;
$$;

revoke all on function public.ca_set_counter_stores(uuid, uuid[]) from public, anon;
grant execute on function public.ca_set_counter_stores(uuid, uuid[]) to authenticated, service_role;
