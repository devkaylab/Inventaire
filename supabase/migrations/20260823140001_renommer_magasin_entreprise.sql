-- Renommer un magasin, renommer une entreprise (23 août 2026)
--
-- Demande de Julien : « les comptes admin doivent pouvoir renommer un magasin
-- et entreprise ». Rien ne le permettait — un nom saisi de travers à la
-- création, ou une enseigne qui change, obligeait à supprimer et recréer,
-- c'est-à-dire à perdre les inventaires du magasin.
--
-- Quatre fonctions, deux par autorité, parce que les deux ont de bonnes
-- raisons de le faire : Quantinvo corrige ce qu'il a saisi au moment du devis,
-- l'entreprise cliente porte son propre nom.
--
-- ⚠️ **Renommer ne touche à rien d'autre.** Le code d'accès, la licence, les
-- inventaires et les comptages sont attachés à l'identifiant, jamais au nom.
-- Les documents déjà émis (devis, factures Stripe) gardent le nom qu'ils
-- portaient : ce sont des pièces datées, elles ne se réécrivent pas.

-- Nom propre : détouré, non vide, borné. 80 caractères tiennent dans une
-- ligne de liste et dans un PDF de devis.
create or replace function public.nom_propre(p_nom text)
returns text
language sql
immutable
set search_path to 'public'
as $$ select nullif(left(btrim(coalesce(p_nom, '')), 80), '') $$;

create or replace function public.admin_rename_company(p_company_id uuid, p_name text)
returns json
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_nom text := public.nom_propre(p_name); v_avant text;
begin
  if not public.is_admin() then return json_build_object('success', false, 'error', 'Accès refusé'); end if;
  if v_nom is null then return json_build_object('success', false, 'error', 'Le nom ne peut pas être vide.'); end if;

  select name into v_avant from public.companies where id = p_company_id;
  if v_avant is null then return json_build_object('success', false, 'error', 'Entreprise introuvable.'); end if;
  if v_avant = v_nom then return json_build_object('success', true, 'already', true); end if;

  update public.companies set name = v_nom where id = p_company_id;
  perform public.log_admin_action('entreprise_renommee', 'entreprise', p_company_id::text, v_nom,
    json_build_object('avant', v_avant)::jsonb);
  return json_build_object('success', true);
end;
$$;

create or replace function public.admin_rename_store(p_store_id uuid, p_name text)
returns json
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_nom text := public.nom_propre(p_name); v_avant text; v_company uuid;
begin
  if not public.is_admin() then return json_build_object('success', false, 'error', 'Accès refusé'); end if;
  if v_nom is null then return json_build_object('success', false, 'error', 'Le nom ne peut pas être vide.'); end if;

  select name, company_id into v_avant, v_company from public.stores where id = p_store_id;
  if v_avant is null then return json_build_object('success', false, 'error', 'Magasin introuvable.'); end if;
  if v_avant = v_nom then return json_build_object('success', true, 'already', true); end if;
  -- Deux magasins de même nom dans la même entreprise ne se distinguent plus
  -- nulle part : ni dans une liste, ni dans un devis. Même règle qu'à l'ajout.
  if exists (select 1 from public.stores s
              where s.company_id = v_company and s.id <> p_store_id and lower(s.name) = lower(v_nom)) then
    return json_build_object('success', false, 'error', 'Un autre magasin de cette entreprise porte déjà ce nom.');
  end if;

  update public.stores set name = v_nom where id = p_store_id;
  perform public.log_admin_action('magasin_renomme', 'magasin', p_store_id::text, v_nom,
    json_build_object('avant', v_avant)::jsonb);
  return json_build_object('success', true);
end;
$$;

create or replace function public.ca_rename_company(p_name text)
returns json
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_nom text := public.nom_propre(p_name); v_company uuid; v_avant text;
begin
  if not public.is_company_admin() then
    return json_build_object('success', false, 'error', 'Accès réservé à l''administrateur de l''entreprise.');
  end if;
  if v_nom is null then return json_build_object('success', false, 'error', 'Le nom ne peut pas être vide.'); end if;

  select company_id into v_company from public.profiles where id = auth.uid();
  select name into v_avant from public.companies where id = v_company;
  if v_avant is null then return json_build_object('success', false, 'error', 'Entreprise introuvable.'); end if;
  if v_avant = v_nom then return json_build_object('success', true, 'already', true); end if;

  update public.companies set name = v_nom where id = v_company;
  perform public.log_company_action(v_company, 'entreprise_renommee', v_nom,
    json_build_object('avant', v_avant)::jsonb);
  return json_build_object('success', true);
end;
$$;

create or replace function public.ca_rename_store(p_store_id uuid, p_name text)
returns json
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_nom text := public.nom_propre(p_name); v_company uuid; v_avant text;
begin
  if not public.is_company_admin() then
    return json_build_object('success', false, 'error', 'Accès réservé à l''administrateur de l''entreprise.');
  end if;
  if v_nom is null then return json_build_object('success', false, 'error', 'Le nom ne peut pas être vide.'); end if;

  select company_id into v_company from public.profiles where id = auth.uid();
  -- ⚠️ La garde porte sur l'entreprise DU MAGASIN, jamais sur un paramètre de
  -- l'appelant : sans cela on renommerait le magasin d'un autre client.
  select name into v_avant from public.stores where id = p_store_id and company_id = v_company;
  if v_avant is null then
    return json_build_object('success', false, 'error', 'Magasin introuvable dans votre entreprise.');
  end if;
  if v_avant = v_nom then return json_build_object('success', true, 'already', true); end if;
  if exists (select 1 from public.stores s
              where s.company_id = v_company and s.id <> p_store_id and lower(s.name) = lower(v_nom)) then
    return json_build_object('success', false, 'error', 'Un autre de vos magasins porte déjà ce nom.');
  end if;

  update public.stores set name = v_nom where id = p_store_id;
  perform public.log_company_action(v_company, 'magasin_renomme', v_nom,
    json_build_object('avant', v_avant)::jsonb);
  return json_build_object('success', true);
end;
$$;

revoke all on function public.nom_propre(text) from public, anon;
revoke all on function public.admin_rename_company(uuid, text) from public, anon;
revoke all on function public.admin_rename_store(uuid, text) from public, anon;
revoke all on function public.ca_rename_company(text) from public, anon;
revoke all on function public.ca_rename_store(uuid, text) from public, anon;
grant execute on function public.nom_propre(text) to authenticated, service_role;
grant execute on function public.admin_rename_company(uuid, text) to authenticated, service_role;
grant execute on function public.admin_rename_store(uuid, text) to authenticated, service_role;
grant execute on function public.ca_rename_company(text) to authenticated, service_role;
grant execute on function public.ca_rename_store(uuid, text) to authenticated, service_role;
