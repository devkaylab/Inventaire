-- On-Demand, 20 septembre 2026 — les trois fonctions qui manquaient à l'appel.
--
-- ⚠️ TROUVÉ PAR LE CONTRÔLE DE SÉCURITÉ DE SUPABASE APRÈS APPLICATION, pas à
-- la relecture : `function_search_path_mutable` sur trois fonctions de ce
-- chantier, et sur AUCUNE autre de la base. Les 190 fonctions de Quantinvo OS
-- fixent toutes leur `search_path` ; ces trois-là l'avaient oublié.
--
-- ⚠️ CE N'ÉTAIT PAS EXPLOITABLE, ET ÇA SE CORRIGE QUAND MÊME. Aucune des trois
-- ne lit de table sans la qualifier : `missions_verifier_transition` appelle
-- `public.transition_mission_permise`, qui ne lit rien du tout, et
-- `missions_figer_le_prix` ne compare que `old` et `new`. Il n'y a donc pas de
-- chemin par lequel un appelant qui pose son propre `search_path` détourne
-- quoi que ce soit. Mais la règle de ce dépôt est que TOUTE fonction fixe son
-- `search_path`, et une exception non écrite finit par être recopiée.
--
-- ⚠️ `create or replace` REND `EXECUTE` À `PUBLIC` : les droits sont reposés
-- ci-dessous, à l'identique de ce que posaient les migrations d'origine
-- (`20260920130001` et `20260920140001`). Ne pas les reposer ouvrirait à
-- `anon` deux déclencheurs et la machine d'état.

-- ── La machine d'état, et son déclencheur ─────────────────────────────────
create or replace function public.transition_mission_permise(p_de text, p_vers text)
returns boolean
language sql
immutable
set search_path = public
as $function$
  select p_de = p_vers or p_vers = any (case p_de
    when 'brouillon'             then array['prix_calcule','annulee']
    when 'prix_calcule'          then array['brouillon','paiement_autorise','annulee','echouee']
    when 'paiement_autorise'     then array['confirmee','annulee','echouee']
    when 'confirmee'             then array['en_constitution','annulee']
    when 'en_constitution'       then array['equipe_complete','annulee','echouee']
    when 'equipe_complete'       then array['prete','en_constitution','annulee','echouee']
    when 'prete'                 then array['en_cours','en_constitution','annulee','echouee']
    when 'en_cours'              then array['controle_qualite','litige','echouee']
    when 'controle_qualite'      then array['terminee','en_cours','litige']
    when 'terminee'              then array['paiement_prestataires','litige']
    when 'paiement_prestataires' then array['payee','litige']
    when 'payee'                 then array['litige']
    when 'annulee'               then array['remboursee']
    when 'echouee'               then array['remboursee']
    when 'litige'                then array['terminee','payee','remboursee']
    else array[]::text[]
  end);
$function$;

revoke all on function public.transition_mission_permise(text, text) from public, anon;
grant execute on function public.transition_mission_permise(text, text) to authenticated, service_role;

create or replace function public.missions_verifier_transition()
returns trigger
language plpgsql
set search_path = public
as $function$
begin
  if not public.transition_mission_permise(old.etat, new.etat) then
    raise exception 'Transition de mission interdite : % vers %', old.etat, new.etat
      using errcode = 'check_violation';
  end if;

  -- Les dates de la mission se posent ici et nulle part ailleurs : une date
  -- écrite à la main finit toujours par contredire l'état.
  if new.etat = 'confirmee' and old.etat <> 'confirmee' then
    new.confirmee_le := now();
  end if;
  if new.etat = 'en_cours' and old.etat <> 'en_cours' then
    new.commencee_le := coalesce(new.commencee_le, now());
  end if;
  if new.etat = 'terminee' and old.etat <> 'terminee' then
    new.terminee_le := now();
  end if;
  if new.etat in ('annulee','echouee') and old.etat not in ('annulee','echouee') then
    new.annulee_le := now();
  end if;

  return new;
end;
$function$;

revoke all on function public.missions_verifier_transition() from public, anon, authenticated;

-- ── La serrure sur le prix ────────────────────────────────────────────────
create or replace function public.missions_figer_le_prix()
returns trigger
language plpgsql
set search_path = public
as $function$
begin
  if old.etat in ('brouillon', 'prix_calcule') then
    return new;
  end if;

  if new.prix_cents is distinct from old.prix_cents
     or new.articles_retenus is distinct from old.articles_retenus
     or new.reglages_version is distinct from old.reglages_version
     or new.debut_prevu is distinct from old.debut_prevu
     or new.duree_prevue_minutes is distinct from old.duree_prevue_minutes
     or new.inventoristes is distinct from old.inventoristes then
    raise exception
      'Le prix et le dimensionnement d''une mission réservée ne se modifient pas (mission %, état %)',
      old.reference, old.etat
      using errcode = 'check_violation';
  end if;

  return new;
end;
$function$;

revoke all on function public.missions_figer_le_prix() from public, anon, authenticated;
