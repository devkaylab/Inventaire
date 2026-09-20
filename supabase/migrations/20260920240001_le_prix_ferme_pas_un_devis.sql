-- `devis_mission` devient `prix_ferme_mission` — le nom disait le contraire.
--
-- ⚠️ **CE PRODUIT NE FAIT PAS DE DEVIS, C'EST SA PHRASE FONDATRICE.** « Trois
-- questions et votre prix s'affiche », « le prix affiché est le prix payé ».
-- Cette fonction rend exactement ça : le montant ferme du tunnel. Elle ne
-- chiffre rien à valider, elle n'ouvre aucune négociation, et rien ne se passe
-- entre elle et le paiement.
--
-- ⚠️ **ET LE MOT EST DÉJÀ PRIS, AILLEURS, POUR LE VRAI SENS.** Quantinvo OS a
-- de vrais devis : `/devis/[token]`, `quote_by_token`, `accept_quote_by_token`
-- — des abonnements négociés qu'un client accepte ou refuse. Deux choses
-- opposées sous le même mot dans la même base, c'est la garantie qu'on les
-- confondra le jour où il faudra aller vite.
--
-- Relevé par Julien le 20 septembre 2026, d'une question de trois mots :
-- « quel devis ? ».
--
-- ⚠️ **AUCUN CHANGEMENT DE COMPORTEMENT.** Le corps est celui de
-- `20260920230001_a_la_carte`, recopié sans une virgule de différence : c'est
-- un renommage, et un renommage qui corrige au passage serait un renommage
-- qu'on ne peut plus relire.
--
-- ⚠️ **L'ANCIENNE EST SUPPRIMÉE, PAS LAISSÉE EN PLACE.** Garder les deux
-- laisserait `devis_mission` appelable par `authenticated` — donc par un
-- navigateur — et le mot continuerait de vivre dans les journaux, dans les
-- outils, et dans la tête de la prochaine personne.

create or replace function public.prix_ferme_mission(p_reponses jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  v_debut timestamptz;
  v_prix jsonb;
  v_formule text;
  v_logiciel boolean;
begin
  if jsonb_typeof(p_reponses) <> 'object' then
    return jsonb_build_object('success', false, 'code', 'format');
  end if;

  v_formule := coalesce(nullif(btrim(p_reponses ->> 'formule'), ''), 'equipe_quantinvo');
  if v_formule not in ('equipe_quantinvo', 'logiciel_seul') then
    return jsonb_build_object('success', false, 'code', 'formule');
  end if;
  v_logiciel := v_formule = 'logiciel_seul';

  begin
    v_debut := (p_reponses->>'debut')::timestamptz;
  exception when others then
    return jsonb_build_object('success', false, 'code', 'date');
  end;

  -- ⚠️ ON NE VEND PAS POUR CE SOIR. Constituer une équipe prend du temps, et
  -- une mission acceptée qu'on ne peut pas servir coûte plus cher qu'une
  -- mission refusée. Quarante-huit heures est le délai du lancement ; c'est
  -- un réglage à revoir quand le vivier existera.
  --
  -- ⚠️ SAUF POUR LE LOGICIEL SEUL : il n'y a pas d'équipe à constituer. Le
  -- délai ne protégerait rien, il empêcherait seulement de servir quelqu'un
  -- qui compte ce soir. La date doit rester dans le futur, c'est tout.
  if not v_logiciel and v_debut < now() + interval '48 hours' then
    return jsonb_build_object('success', false, 'code', 'trop_tot');
  end if;
  if v_logiciel and v_debut < now() then
    return jsonb_build_object('success', false, 'code', 'trop_tot');
  end if;

  v_prix := public.prix_mission(
    (p_reponses->>'articles_max')::integer,
    p_reponses->>'secteur',
    v_debut,
    coalesce(p_reponses->>'code_barres', 'tous'),
    p_reponses->>'code_postal',
    null,
    v_formule);

  if not (v_prix->>'success')::boolean then
    return v_prix;
  end if;

  return jsonb_build_object(
    'success', true,
    'version', v_prix->'version',
    'formule', v_prix->'formule',
    'prix_cents', v_prix->'prix_cents',
    'inventoristes', v_prix->'inventoristes',
    'compteurs_attendus', v_prix->'compteurs_attendus',
    'appareils', v_prix->'appareils',
    'responsable', v_prix->'responsable',
    'duree_minutes', v_prix->'duree_minutes',
    'articles_retenus', v_prix->'articles_retenus',
    'debut', v_debut,
    'arrivee', v_debut - make_interval(mins => (v_prix->>'arrivee_minutes_avant')::integer),
    'fin_prevue', v_debut + make_interval(mins => (v_prix->>'duree_minutes')::integer),
    -- Annulation gratuite jusqu'à trois jours avant (maquette Prix et
    -- Annuler). Le calcul des frais au-delà vit avec les annulations.
    'annulation_gratuite_jusqu_au', v_debut - interval '3 days');
end;
$function$;
revoke all on function public.prix_ferme_mission(jsonb) from public, anon;
grant execute on function public.prix_ferme_mission(jsonb) to authenticated, service_role;

drop function if exists public.devis_mission(jsonb);
