-- Remettre Quantinvo OS exactement comme il était.
--
-- ⚠️ **CE FICHIER EST L'ANNULATION DE `20260920200001_on_demand_le_plafond_d_appareils`**,
-- la seule migration d'On-Demand qui touche Quantinvo OS. Elle remplace
-- `prendre_place_appareil` — la fonction qui décide si un téléphone a le droit
-- de compter. Si On-Demand doit être retiré après l'avoir appliquée, il faut
-- REMETTRE cette fonction, sinon elle continue d'appeler `a_un_acces_mission`,
-- qui n'existe plus : **le comptage s'arrête pour tout le monde.**
--
-- Trouvé le 20 septembre 2026 par le contrôle de retrait de
-- `scripts/replique/verifier.sh` — un retrait qui marchait sur le papier
-- laissait Quantinvo OS cassé.
--
-- La définition ci-dessous est celle de la production au 20 septembre 2026,
-- relue dans `pg_get_functiondef`. ⚠️ Elle REND LE DÉFAUT DU PLAFOND `null` :
-- un magasin dont l'offre n'est pas saisie redevient illimité. C'est le prix
-- du retour en arrière, et il faut le savoir.

drop function if exists public.plafond_appareils_effectif(uuid) cascade;
drop function if exists public.plafond_mission_en_cours(uuid) cascade;

CREATE OR REPLACE FUNCTION public.prendre_place_appareil(p_session_id uuid, p_appareil text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare
  fenetre constant interval := interval '90 seconds';
  v_store uuid; v_cle text; v_plafond integer; v_deja boolean; v_refuse boolean;
  v_actifs integer; v_besoin integer; v_jour date := (now() at time zone 'Europe/Paris')::date;
begin
  if not public.is_session_participant(p_session_id) then
    return jsonb_build_object('accorde', false, 'code', 'interdit'); end if;
  v_cle := btrim(coalesce(p_appareil, ''));
  if v_cle = '' or length(v_cle) > 64 or v_cle !~ '^[A-Za-z0-9._:-]+$' then
    return jsonb_build_object('accorde', false, 'code', 'cle_invalide'); end if;
  select s.store_id into v_store from public.inventory_sessions s where s.id = p_session_id;
  if v_store is null then return jsonb_build_object('accorde', false, 'code', 'introuvable'); end if;
  perform 1 from public.stores where id = v_store for update;
  delete from public.appareils_actifs where store_id = v_store and vu_le < now() - fenetre;
  v_plafond := public.plafond_appareils(v_store);
  select coalesce(bool_or(not refuse), false), coalesce(bool_or(refuse), false)
    into v_deja, v_refuse from public.appareils_actifs where store_id = v_store and appareil = v_cle;
  if not v_deja and v_plafond is not null then
    select count(*) into v_actifs from public.appareils_actifs where store_id = v_store and not refuse;
    if v_actifs >= v_plafond then
      if not v_refuse then
        insert into public.appareils_par_jour (store_id, jour, pic, refus) values (v_store, v_jour, 0, 1)
          on conflict (store_id, jour) do update set refus = appareils_par_jour.refus + 1;
        select a.pic + a.refus into v_besoin from public.appareils_par_jour a
         where a.store_id = v_store and a.jour = v_jour;
        begin perform public.prevenir_forfait_trop_juste(v_store, v_plafond, v_besoin);
        exception when others then null; end;
      end if;
      insert into public.appareils_actifs (store_id, appareil, vu_le, refuse) values (v_store, v_cle, now(), true)
        on conflict (store_id, appareil) do update set vu_le = now(), refuse = true;
      return jsonb_build_object('accorde', false, 'code', 'forfait_plein', 'plafond', v_plafond, 'appareils', v_actifs);
    end if;
  end if;
  insert into public.appareils_actifs (store_id, appareil, vu_le, refuse) values (v_store, v_cle, now(), false)
    on conflict (store_id, appareil) do update set vu_le = now(), refuse = false;
  select count(*) into v_actifs from public.appareils_actifs where store_id = v_store and not refuse;
  insert into public.appareils_par_jour (store_id, jour, pic, refus) values (v_store, v_jour, v_actifs, 0)
    on conflict (store_id, jour) do update set pic = greatest(appareils_par_jour.pic, excluded.pic);
  return jsonb_build_object('accorde', true, 'plafond', v_plafond, 'appareils', v_actifs);
end; $function$;

revoke all on function public.prendre_place_appareil(uuid, text) from public, anon;
grant execute on function public.prendre_place_appareil(uuid, text) to authenticated, service_role;
