-- Modèle final des balises : un STOCK au niveau ENTREPRISE (séquentiel, pré-imprimé
-- une fois, réutilisable d'un inventaire à l'autre). L'affectation aux emplacements
-- se fait par PLAGE, par session, via define_zone (« Réserve = 1 à 10 »).
-- Le QR n'encode que le numéro (SCB1:<code>), indépendant de l'inventaire.
-- Appliquée en base live via MCP apply_migration (le dossier migrations diverge de la base).

alter table public.companies add column if not exists balise_count int not null default 0;

-- Génère p_count nouvelles balises au-delà du stock existant. Superviseur.
create or replace function public.generate_company_balises(p_count int)
returns json language plpgsql security definer set search_path to 'public' as $$
declare v_company uuid; v_from int; v_to int;
begin
  if get_my_role() <> 'supervisor' then
    return json_build_object('success', false, 'error', 'Accès refusé');
  end if;
  v_company := get_my_company();
  if v_company is null then
    return json_build_object('success', false, 'error', 'Entreprise introuvable');
  end if;
  if p_count is null or p_count < 1 or p_count > 5000 then
    return json_build_object('success', false, 'error', 'Nombre invalide (1 à 5000)');
  end if;
  update public.companies set balise_count = balise_count + p_count
    where id = v_company returning balise_count into v_to;
  v_from := v_to - p_count + 1;
  return json_build_object('success', true, 'from', v_from, 'to', v_to, 'total', v_to);
end; $$;

-- L'ancienne génération par session (generate_balises) est remplacée par ce modèle
-- (génération entreprise + affectation par plage). define_zone(session, name, start, end)
-- reste la voie d'affectation (cf. 20260730000002).
drop function if exists public.generate_balises(uuid, text, integer);
