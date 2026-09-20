-- ⚠️⚠️ CETTE MIGRATION TOUCHE QUANTINVO OS. C'EST LA SEULE. ⚠️⚠️
--
-- On-Demand, 20 septembre 2026. Toutes les autres migrations de ce chantier
-- n'AJOUTENT que des objets neufs : des tables, des fonctions, et des policies
-- POSÉES À CÔTÉ de celles d'OS (les policies permissives se combinent en
-- `OU`). Les retirer tient en un `drop`, et pour quiconque n'a pas de
-- `mission_access`, elles rendent faux — l'effet sur le produit existant est
-- nul, et ça se démontre.
--
-- Celle-ci est différente : elle REMPLACE `prendre_place_appareil`, une
-- fonction de Quantinvo OS qui décide si un téléphone a le droit de compter.
-- Elle est à part, et elle est en dernier, pour qu'on puisse l'appliquer —
-- ou pas — comme une décision distincte.
--
-- ELLE FAIT DEUX CHOSES, ET IL FAUT LES VOULOIR TOUTES LES DEUX :
--
--   1. **Elle ferme un défaut d'OS qui n'a rien à voir avec On-Demand.**
--      `companies.plan` vaut `'standard'` par défaut et `stores.devices` est
--      nul tant que personne ne l'a saisi : `plafond_appareils` rend alors
--      `null`, que `prendre_place_appareil` traduit par « ne rien refuser ».
--      Un magasin dont l'offre n'a pas été saisie est donc ILLIMITÉ — c'est-à-
--      dire le cas par défaut de toute entreprise créée à la main.
--      ⚠️ AU 20 SEPTEMBRE 2026, UN MAGASIN EST CONCERNÉ : « Oberlin Lyon »
--      passe d'illimité à deux. Son pic jamais atteint est de deux, et aucun
--      refus n'a jamais été enregistré — mais une démonstration à trois
--      téléphones serait refusée. `update public.stores set devices = 20
--      where name = 'Oberlin Lyon';` règle le cas.
--
--   2. **Elle laisse entrer les inventoristes d'une mission.** Sans elle, un
--      inventoriste affecté passe toutes les règles de comptage — il peut
--      écrire dans `counts` — et se fait refuser sa place d'appareil, donc
--      l'écran de comptage ne s'ouvre pas. Trouvé en rejouant les migrations
--      sur une réplique (`scripts/replique/verifier.sh`), pas à la lecture.
--
-- ⚠️ **SON ANNULATION EST ÉCRITE, ET ELLE EST OBLIGATOIRE** :
-- `scripts/replique/91-restaurer-quantinvo-os.sql`. Retirer On-Demand sans la
-- jouer laisse `prendre_place_appareil` appeler une fonction qui n'existe
-- plus — le comptage s'arrête pour TOUT LE MONDE. Le contrôle de retrait de
-- la réplique le vérifie.
--
-- ⚠️ SANS ELLE, ON-DEMAND NE COMPTE PAS. Les sept autres migrations peuvent
-- s'appliquer seules : elles construisent le tunnel, le prix, les missions et
-- la console. C'est le COMPTAGE SUR PLACE qui attend celle-ci.

-- ─── 11. Le plafond d'appareils, et le trou qu'il laissait ─────────────────
--
-- ⚠️ `plafond_appareils` N'EST PAS MODIFIÉE, ET C'EST UNE CORRECTION DU
-- DOCUMENT DE CONCEPTION, qui annonçait qu'elle deviendrait « le plus élevé de
-- l'abonnement et de la mission ». En la relisant, elle a DEUX appelants qui
-- posent deux questions différentes :
--
--   • `deposer_changement_offre` demande « qu'est-ce que ce client a acheté ? »
--     pour refuser de lui vendre ce qu'il a déjà (`code = 'deja_couvert'`) ;
--   • `prendre_place_appareil` demande « combien d'appareils peuvent se
--     connecter maintenant ? ».
--
-- Y verser le plafond de la mission répondrait faux à la première : pendant
-- une mission à sept, un client qui veut acheter sept appareils s'entendrait
-- dire « votre forfait couvre déjà neuf appareils », et la vente serait
-- bloquée par un inventaire qu'il paie. Et son `null` — « rien n'est vendu » —
-- est la bonne réponse commerciale, même si c'est une réponse dangereuse
-- côté technique.
--
-- Donc : `plafond_appareils` garde son sens commercial, et c'est la NOUVELLE
-- fonction ci-dessous qui répond à la question technique — plancher compris.
create or replace function public.plafond_mission_en_cours(p_store_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $function$
  select coalesce(max(m.inventoristes + case when m.responsable then 1 else 0 end), 0)
    from public.missions m
   where m.store_id = p_store_id
     and m.etat in ('prete','en_cours','controle_qualite')
     and m.acces_ouverts_le is not null
     and now() >= m.acces_ouverts_le
     and now() < m.acces_expirent_le;
$function$;

revoke all on function public.plafond_mission_en_cours(uuid) from public, anon, authenticated;
grant execute on function public.plafond_mission_en_cours(uuid) to service_role;

-- ⚠️ LE PLAFOND DE LA MISSION S'AJOUTE, IL NE REMPLACE PAS. Le prendre « le
-- plus élevé des deux » ferait manger les places du client par notre équipe :
-- six inventoristes et un responsable rempliraient le magasin, et le
-- superviseur du client qui ouvre son téléphone pour suivre le comptage se
-- verrait refuser l'entrée chez lui, un soir où il paie 949 €. Les appareils
-- de la mission viennent avec la mission.
--
-- ⚠️ ET LE CAS `null` CESSE D'ÊTRE PERMISSIF. C'est le vrai défaut :
-- `companies.plan` vaut `'standard'` par défaut, `stores.devices` est nul tant
-- que personne ne l'a renseigné, et ces deux-là réunis donnent `null`, que
-- `prendre_place_appareil` traduit par « ne rien refuser ». Un magasin dont
-- l'offre n'a pas encore été saisie était donc illimité — c'est-à-dire le cas
-- par défaut de toute entreprise créée à la main.
--
-- ⚠️ LE PLANCHER EST DEUX, ET C'EST UN CHOIX DISCUTABLE ASSUMÉ. Zéro
-- fermerait l'application à un client dont le devis n'est pas encore saisi ;
-- l'illimité est le défaut d'aujourd'hui. Deux, c'est le plus petit palier de
-- la grille : de quoi travailler à deux, pas de quoi mener un inventaire
-- d'équipe sans rien avoir acheté. ⚠️ AU 20 SEPTEMBRE 2026, UN MAGASIN EST
-- CONCERNÉ — « Oberlin Lyon », qui passe d'illimité à deux. S'il en faut plus
-- pour les captures, c'est `stores.devices` qu'on renseigne, pas ce plancher
-- qu'on relève.
create or replace function public.plafond_appareils_effectif(p_store_id uuid)
returns integer
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  plancher constant integer := 2;
  v_abo integer;
begin
  if not exists (select 1 from public.stores where id = p_store_id) then
    return 0;
  end if;
  v_abo := coalesce(public.plafond_appareils(p_store_id), plancher);
  return v_abo + public.plafond_mission_en_cours(p_store_id);
end;
$function$;

revoke all on function public.plafond_appareils_effectif(uuid) from public, anon, authenticated;
grant execute on function public.plafond_appareils_effectif(uuid) to service_role;

-- ── `prendre_place_appareil` : deux lignes changent, le reste est recopié ──
--
-- ⚠️ DÉFINITION RELUE DANS `pg_get_functiondef` LE 20 SEPTEMBRE 2026. Les
-- seules différences : `v_plafond` vient maintenant de
-- `plafond_appareils_effectif`, et le courriel « votre forfait est trop juste »
-- ne part plus pendant une mission.
--
-- ⚠️ CE COURRIEL EST UNE RELANCE COMMERCIALE. L'envoyer parce qu'un huitième
-- appareil a été refusé pendant une mission à sept dirait au client que son
-- abonnement est trop petit alors que c'est NOTRE équipe qui a rempli le
-- magasin. Le refus reste compté — il est réel — mais la relance attend.
create or replace function public.prendre_place_appareil(p_session_id uuid, p_appareil text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  fenetre constant interval := interval '90 seconds';
  v_store   uuid;
  v_cle     text;
  v_plafond integer;
  v_mission integer;
  v_deja    boolean;
  v_refuse  boolean;
  v_actifs  integer;
  v_besoin  integer;
  v_jour    date := (now() at time zone 'Europe/Paris')::date;
begin
  -- ⚠️ **`is_session_participant` NE SUFFIT PAS POUR UN COMPTEUR DE MISSION**,
  -- et ça ne se voit pas en relisant : sa branche On-Demand ne couvre que le
  -- RESPONSABLE. Un inventoriste ordinaire passait toutes les policies de
  -- comptage — il pouvait écrire dans `counts` — et se faisait refuser ICI sa
  -- place d'appareil, donc l'écran de comptage ne s'ouvrait pas. Trouvé en
  -- rejouant les migrations sur une réplique, pas à la lecture.
  if not (public.is_session_participant(p_session_id)
          or public.a_un_acces_mission(p_session_id)) then
    return jsonb_build_object('accorde', false, 'code', 'interdit');
  end if;

  v_cle := btrim(coalesce(p_appareil, ''));
  if v_cle = '' or length(v_cle) > 64 or v_cle !~ '^[A-Za-z0-9._:-]+$' then
    return jsonb_build_object('accorde', false, 'code', 'cle_invalide');
  end if;

  select s.store_id into v_store
    from public.inventory_sessions s
   where s.id = p_session_id;
  if v_store is null then
    return jsonb_build_object('accorde', false, 'code', 'introuvable');
  end if;

  perform 1 from public.stores where id = v_store for update;

  delete from public.appareils_actifs
   where store_id = v_store and vu_le < now() - fenetre;

  v_mission := public.plafond_mission_en_cours(v_store);
  v_plafond := public.plafond_appareils_effectif(v_store);

  select coalesce(bool_or(not refuse), false), coalesce(bool_or(refuse), false)
    into v_deja, v_refuse
    from public.appareils_actifs
   where store_id = v_store and appareil = v_cle;

  if not v_deja and v_plafond is not null then
    select count(*) into v_actifs
      from public.appareils_actifs where store_id = v_store and not refuse;
    if v_actifs >= v_plafond then
      if not v_refuse then
        insert into public.appareils_par_jour (store_id, jour, pic, refus)
          values (v_store, v_jour, 0, 1)
          on conflict (store_id, jour)
          do update set refus = appareils_par_jour.refus + 1;

        select a.pic + a.refus into v_besoin
          from public.appareils_par_jour a
         where a.store_id = v_store and a.jour = v_jour;

        if v_mission = 0 then
          begin
            perform public.prevenir_forfait_trop_juste(v_store, v_plafond, v_besoin);
          exception when others then
            null;
          end;
        end if;
      end if;
      insert into public.appareils_actifs (store_id, appareil, vu_le, refuse)
        values (v_store, v_cle, now(), true)
        on conflict (store_id, appareil) do update set vu_le = now(), refuse = true;
      return jsonb_build_object(
        'accorde', false, 'code', 'forfait_plein',
        'plafond', v_plafond, 'appareils', v_actifs);
    end if;
  end if;

  insert into public.appareils_actifs (store_id, appareil, vu_le, refuse)
    values (v_store, v_cle, now(), false)
    on conflict (store_id, appareil) do update set vu_le = now(), refuse = false;

  select count(*) into v_actifs
    from public.appareils_actifs where store_id = v_store and not refuse;

  insert into public.appareils_par_jour (store_id, jour, pic, refus)
    values (v_store, v_jour, v_actifs, 0)
    on conflict (store_id, jour)
    do update set pic = greatest(appareils_par_jour.pic, excluded.pic);

  return jsonb_build_object(
    'accorde', true, 'plafond', v_plafond, 'appareils', v_actifs);
end;
$function$;

revoke all on function public.prendre_place_appareil(uuid, text) from public, anon;
grant execute on function public.prendre_place_appareil(uuid, text) to authenticated, service_role;

