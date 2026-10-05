-- ⚠️ UN INVENTAIRE LOUÉ NAISSAIT SANS ZONES (5 octobre 2026).
--
-- `creer_la_session_de_mission` décidait du mode ainsi :
--
--     uses_zones := (v_m.inventoristes >= 3)
--
-- « Une équipe de trois et plus travaille par zones. » C'était juste quand une
-- mission voulait dire « on envoie des gens ». En location, `inventoristes`
-- vaut **0** par construction — le nombre qui compte est `appareils`.
--
-- Donc tout inventaire loué naissait en mode « Classique (sans balise) », même
-- à neuf téléphones. Vu à l'écran sur une réservation réelle de l'aperçu.
--
-- Les zones sont ce qui répartit le magasin et fait suivre l'avancement : à
-- neuf compteurs sans elles, personne ne sait qui compte quoi, et deux
-- personnes recomptent le même rayon.
--
-- ⚠️ Le repli sur `inventoristes` reste : une mission d'avant la colonne
-- `appareils` garde le mode qu'elle aurait eu.
--
-- ⚠️ Définition reprise de `pg_get_functiondef`, patchée d'une ligne.
CREATE OR REPLACE FUNCTION public.creer_la_session_de_mission(p_mission uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_m record;
  v_code text;
  v_number text;
  v_id uuid;
begin
  -- ⚠️ LA GARDE EST LE `GRANT`, PAS UN TEST ICI, et c'est voulu : la seule
  -- forme qui laisserait passer `service_role` serait « is_admin() OU
  -- auth.uid() est nul » — une condition qui ouvre à `anon` le jour où
  -- quelqu'un élargit le grant sans relire la fonction. Même choix que
  -- `plafond_appareils` : `service_role` uniquement, et la console
  -- d'administration passera par un `admin_*` qui journalise (règle AGENTS.md).
  select * into v_m from public.missions where id = p_mission;
  if not found then
    return jsonb_build_object('success', false, 'code', 'introuvable');
  end if;

  -- Déjà créé : on rend le même, on n'en ouvre pas un second. Une mission
  -- relancée deux fois par le back-office ne doit pas couper l'inventaire en
  -- deux moitiés dont aucune ne fait un rapport.
  if v_m.inventory_session_id is not null then
    return jsonb_build_object('success', true, 'session_id', v_m.inventory_session_id, 'deja', true);
  end if;

  if v_m.company_id is null or v_m.store_id is null then
    return jsonb_build_object('success', false, 'code', 'client_efface');
  end if;
  if v_m.etat not in ('prix_calcule','paiement_autorise','confirmee','en_constitution','equipe_complete','prete') then
    return jsonb_build_object('success', false, 'code', 'pas_le_moment');
  end if;

  v_code   := lpad((floor(random() * 1000000))::integer::text, 6, '0');
  v_number := 'INV-' || to_char(now(), 'YYYYMMDD') || '-'
              || upper(substring(md5(random()::text) from 1 for 4));

  insert into public.inventory_sessions
    (inventory_number, security_code_hash, security_code, store_name, store_id,
     name, created_by, uses_zones, company_id)
  values
    (v_number, encode(sha256(v_code::bytea), 'hex'), v_code, v_m.magasin_nom, v_m.store_id,
     v_m.magasin_nom || ' — ' || to_char(v_m.debut_prevu at time zone 'Europe/Paris', 'DD/MM/YYYY'),
     v_m.reserve_par,
     -- Une équipe de trois et plus travaille par zones : c'est ce qui permet
     -- au responsable d'attribuer, et au client de suivre l'avancement.
     -- ⚠️ TROIS APPAREILS ET PLUS TRAVAILLENT PAR ZONES, et c'est bien
     -- `appareils` qu'il faut lire (5 octobre 2026). La règle disait
     -- `inventoristes >= 3` : les gens qu'on envoyait. En location ce nombre
     -- vaut 0, donc tout inventaire loué naissait SANS zones — même à neuf
     -- téléphones. Les zones sont ce qui répartit le magasin et fait suivre
     -- l'avancement : à neuf compteurs sans elles, personne ne sait qui
     -- compte quoi.
     (coalesce(v_m.appareils, v_m.inventoristes) >= 3),
     v_m.company_id)
  returning id into v_id;

  -- Le client qui a réservé est membre de son inventaire, comme tout créateur.
  if v_m.reserve_par is not null then
    insert into public.session_members (session_id, user_id)
      values (v_id, v_m.reserve_par)
      on conflict do nothing;
  end if;

  update public.missions set inventory_session_id = v_id where id = p_mission;

  return jsonb_build_object('success', true, 'session_id', v_id, 'inventory_number', v_number);
end;
$function$;

-- `create or replace` rend EXECUTE à PUBLIC : on repose les droits.
revoke all on function public.creer_la_session_de_mission(uuid) from public, anon;
grant execute on function public.creer_la_session_de_mission(uuid) to authenticated, service_role;
