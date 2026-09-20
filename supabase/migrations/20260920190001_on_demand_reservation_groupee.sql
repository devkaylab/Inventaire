-- On-Demand : réserver plusieurs inventaires d'un coup (20 septembre 2026)
--
-- Point 49 du plan. Maquette : Client-Groupe.
--
-- ⚠️ **UNE ENSEIGNE QUI VEUT QUATRE INVENTAIRES NE DOIT PAS RETOMBER DANS UN
-- DEVIS** — c'est toute la promesse du produit, et c'est précisément là qu'on
-- serait tenté d'y revenir « parce que c'est gros ». Un prix par magasin, une
-- seule réservation, une seule facture, et chaque inventaire garde son équipe,
-- son suivi et son rapport.
--
-- ⚠️ **ET CE N'EST PAS UNE ARCHITECTURE, C'EST UN ÉCRAN.** Le modèle porte déjà
-- tout : une entreprise a plusieurs établissements, une mission en vise un. Le
-- groupe n'ajoute qu'un fil entre les missions payées ensemble.

create or replace function public.reserver_un_groupe(p_reservations jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_uid uuid := auth.uid();
  v_company uuid;
  v_groupe uuid;
  v_total integer := 0;
  v_i integer;
  v_ligne jsonb;
  v_r jsonb;
  v_faites jsonb := '[]'::jsonb;
  v_refus jsonb := '[]'::jsonb;
begin
  if v_uid is null then
    return jsonb_build_object('success', false, 'code', 'non_connecte');
  end if;
  if jsonb_typeof(p_reservations) <> 'array' or jsonb_array_length(p_reservations) = 0 then
    return jsonb_build_object('success', false, 'code', 'format');
  end if;
  -- ⚠️ UNE BORNE, PARCE QU'UNE ENSEIGNE PEUT AVOIR CENT QUATRE-VINGT-TROIS
  -- MAGASINS. Réserver les cent quatre-vingt-trois d'un clic engagerait une
  -- capacité qu'on n'a pas, et une facture qu'on ne saurait pas servir. Vingt
  -- est un nombre à revoir quand le vivier existera — pas une limite technique.
  -- Le refus dit quoi faire : une seconde réservation, pas un e-mail.
  if jsonb_array_length(p_reservations) > 20 then
    return jsonb_build_object('success', false, 'code', 'trop_de_magasins');
  end if;

  select p.company_id into v_company from public.profiles p where p.id = v_uid;
  if v_company is null then
    return jsonb_build_object('success', false, 'code', 'pas_d_entreprise');
  end if;

  insert into public.mission_groupes (company_id, reserve_par) values (v_company, v_uid)
    returning id into v_groupe;

  -- ⚠️ CHAQUE LIGNE PASSE PAR `reserver_ma_mission`, ET C'EST LE POINT. Écrire
  -- ici une seconde façon de créer une mission, c'est se réveiller un jour avec
  -- un groupe dont les prix ne suivent pas les mêmes règles que les
  -- réservations à l'unité — ni l'engagement de l'étape 3, ni les conditions
  -- générales, ni le recalcul du prix.
  for v_i in 0 .. jsonb_array_length(p_reservations) - 1 loop
    v_ligne := p_reservations -> v_i;
    v_r := public.reserver_ma_mission(v_ligne);
    if coalesce((v_r ->> 'success')::boolean, false) then
      update public.missions set groupe_id = v_groupe
       where id = (v_r ->> 'mission_id')::uuid;
      v_total := v_total + (v_r ->> 'prix_cents')::integer;
      v_faites := v_faites || jsonb_build_array(v_r);
    else
      -- ⚠️ ON N'ANNULE PAS LES AUTRES. Un magasin hors zone ou une date trop
      -- proche ne doit pas faire tomber les trois qui allaient bien : le client
      -- voit ce qui est passé, ce qui ne l'est pas, et pourquoi.
      v_refus := v_refus || jsonb_build_array(
        jsonb_build_object('magasin', v_ligne ->> 'magasin', 'code', v_r ->> 'code'));
    end if;
  end loop;

  if jsonb_array_length(v_faites) = 0 then
    delete from public.mission_groupes where id = v_groupe;
    return jsonb_build_object('success', false, 'code', 'aucune', 'refus', v_refus);
  end if;

  update public.mission_groupes set total_cents = v_total where id = v_groupe;

  return jsonb_build_object(
    'success', true,
    'groupe_id', v_groupe,
    'total_cents', v_total,
    'missions', v_faites,
    'refus', v_refus);
end;
$function$;

revoke all on function public.reserver_un_groupe(jsonb) from public, anon;
grant execute on function public.reserver_un_groupe(jsonb) to authenticated;
