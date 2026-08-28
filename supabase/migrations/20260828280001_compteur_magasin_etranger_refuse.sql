-- `ca_set_counter_stores` refuse un magasin étranger, comme sa jumelle.
--
-- Relevé pendant le balayage du backend du 28 août 2026, comme observation
-- plutôt que comme faille : aucune affectation croisée entre entreprises
-- n'était possible dans les deux cas. Mais les deux fonctions sœurs ne
-- traitaient pas la même erreur de la même façon.
--
--   · `ca_set_supervisor_stores` COMPTE les magasins de l'entreprise présents
--     dans la liste et REFUSE si le compte diffère — « Un des magasins
--     n'appartient pas à votre entreprise. »
--   · `ca_set_counter_stores` FILTRAIT : elle retirait silencieusement les
--     identifiants étrangers et rendait `success: true`.
--
-- ⚠️ Or les deux servent LE MÊME GESTE À L'ÉCRAN : `changerMagasins` route
-- selon le rôle de la personne. L'administrateur d'entreprise voyait donc son
-- action échouer franchement sur un superviseur, et réussir à moitié sur un
-- compteur — avec moins de magasins affectés qu'il n'en avait cochés, et rien
-- pour le lui dire. Le journal enregistrait le compte filtré, ce qui rendait
-- l'écart invisible après coup.
--
-- ⚠️ CE QUI RESTE DIFFÉRENT, ET DOIT LE RESTER : la liste vide. Un compteur
-- sans magasin est un état normal — c'est même ce qui a justifié l'écriture de
-- cette fonction le 23 août, un compteur retiré de son dernier magasin devenant
-- invisible partout et donc irrécupérable. Un superviseur, lui, garde toujours
-- au moins un magasin : pour le détacher on lui retire le rôle. Ne pas
-- « aligner » cette différence-là.
--
-- Le `coalesce(array_length(v_ids, 1), 0)` vaut 0 sur une liste vide, et
-- `count(*)` vaut 0 également : la comparaison passe, la liste vide reste
-- acceptée.

create or replace function public.ca_set_counter_stores(p_user uuid, p_store_ids uuid[])
 returns json
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_company uuid;
  v_target  public.profiles%rowtype;
  v_ids     uuid[] := coalesce(p_store_ids, '{}');
  n         int;
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

  -- Le même refus que `ca_set_supervisor_stores`, mot pour mot. La liste vide
  -- passe : 0 = 0. C'est la seule différence conservée entre les deux.
  select count(*) into n from public.stores s where s.id = any(v_ids) and s.company_id = v_company;
  if n <> coalesce(array_length(v_ids, 1), 0) then
    return json_build_object('success', false, 'error', 'Un des magasins n''appartient pas à votre entreprise.');
  end if;

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
$function$;

-- `create or replace function` rend EXECUTE à PUBLIC.
revoke all on function public.ca_set_counter_stores(uuid, uuid[]) from public, anon;
grant execute on function public.ca_set_counter_stores(uuid, uuid[]) to authenticated;
