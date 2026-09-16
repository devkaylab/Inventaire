-- Modifier l'adresse d'un magasin depuis sa fiche (16 septembre 2026).
--
-- Demande de Julien : les magasins déclarés avant l'adresse obligatoire
-- (`20260916120001`) n'en ont pas, et rien ne permettait d'en poser une.
--
-- ⚠️ L'ADRESSE EST CONTRACTUELLE : l'article 9.5 des conditions générales
-- attache une licence au magasin déclaré. Changer d'adresse, c'est dire où la
-- licence sert — d'où le journal, qui garde l'adresse d'AVANT. Un changement se
-- lit ensuite sur /journal ; il ne se fait pas en silence.
--
-- Même garde que `ca_rename_store` : l'administrateur de l'entreprise, sur un
-- magasin de SON entreprise — lue sur le magasin, jamais sur un paramètre.

create or replace function public.ca_set_store_address(p_store_id uuid, p_address text)
returns json
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_adr     text := public.adresse_propre(p_address);
  v_company uuid;
  v_nom     text;
  v_avant   text;
begin
  if not public.is_company_admin() then
    return json_build_object('success', false, 'error',
      'Accès réservé à l''administrateur de l''entreprise.');
  end if;
  if v_adr is null then
    return json_build_object('success', false, 'error',
      'Indiquez l''adresse complète du magasin.');
  end if;

  select company_id into v_company from public.profiles where id = auth.uid();
  select name, address into v_nom, v_avant
    from public.stores where id = p_store_id and company_id = v_company;
  if v_nom is null then
    return json_build_object('success', false, 'error', 'Magasin introuvable dans votre entreprise.');
  end if;
  if v_avant is not distinct from v_adr then
    return json_build_object('success', true, 'already', true);
  end if;

  update public.stores set address = v_adr where id = p_store_id;
  perform public.log_company_action(v_company, 'adresse_magasin_modifiee', v_nom,
    json_build_object('avant', v_avant, 'apres', v_adr)::jsonb);
  return json_build_object('success', true);
end;
$function$;

revoke all on function public.ca_set_store_address(uuid, text) from public, anon;
grant execute on function public.ca_set_store_address(uuid, text) to authenticated, service_role;
