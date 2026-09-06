-- « Ce que j'ai compté » ne descend plus d'un seul bloc (6 septembre 2026)
--
-- Dernier reste de la liste « base et exploitation » du 4 septembre.
-- `mes_balises_comptees` rend l'écran du compteur qui liste son propre travail
-- — une ligne par balise et par référence — et elle n'avait **aucune limite**.
--
-- Toutes ses voisines ont été bornées début septembre quand on a préparé les
-- inventaires de 400 000 références : le Rapport et les Écarts se lisent par
-- pages, plafond dur à 5 000 lignes par appel. Celle-ci est passée à travers.
-- Aujourd'hui le plus gros cas réel fait 71 lignes ; sur un vrai gros
-- inventaire, un compteur qui a scanné plusieurs milliers de références verrait
-- sa liste dépasser les 8 s du rôle client — donc **une erreur à la place de
-- son travail**, au moment précis où il vérifie avant de quitter le magasin.
--
-- ⚠️ ON PAGINE LE TRANSPORT, PAS L'ÉCRAN. L'écran regroupe par balise et
-- additionne par référence : il a besoin de TOUTES les lignes pour que ses
-- totaux soient justes. Afficher page par page donnerait des totaux qui
-- grandissent au fil du défilement — c'est le défaut « un zéro se lit comme un
-- résultat », corrigé le 4 septembre sur le rapport, qu'on réintroduirait ici.
-- Le téléphone reçoit donc tout, mais en plusieurs fois : le serveur ne fait
-- plus jamais une requête sans borne.

-- ⚠️ L'ANCIENNE SIGNATURE EST SUPPRIMÉE, PAS LAISSÉE À CÔTÉ. Les trois nouveaux
-- paramètres ont un défaut : Postgres garderait les deux fonctions et un appel
-- à deux arguments deviendrait ambigu. Même piège que `p_event_id` le 28 août
-- et `ca_request_store` le 22.
drop function if exists public.mes_balises_comptees(uuid, integer);

-- ⚠️ ET LES BUILDS DÉJÀ INSTALLÉS CONTINUENT DE MARCHER. PostgREST appelle par
-- noms de paramètres : un téléphone qui n'envoie que `p_session_id` et `p_pass`
-- laisse Postgres appliquer les défauts. C'est ce qui permet d'appliquer cette
-- migration avant que l'application ne soit reconstruite — vérifié, et c'est la
-- même raison qui avait rendu `p_event_id` facultatif.
create function public.mes_balises_comptees(
  p_session_id uuid,
  p_pass integer default 1,
  -- Le curseur : la dernière ligne rendue. Nuls au premier appel.
  p_apres_zone text default null,
  p_apres_sku text default null,
  p_limite integer default 5000
)
returns table(zone text, sku text, qty numeric, label text, brand text, ean text)
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  -- ⚠️ PLAFOND DUR, QUOI QUE DEMANDE L'APPELANT. C'est la règle des autres
  -- écrans depuis le 3 septembre : sans elle, on redemande les 400 000 lignes
  -- par la porte de derrière. Un vieux build, qui ne passe rien, prend ce
  -- plafond — donc il est protégé du blocage sans rien changer chez lui.
  v_limite int := least(coalesce(p_limite, 5000), 5000);
begin
  if not public.membre_ou_superviseur(p_session_id) then raise exception 'forbidden'; end if;

  return query
  select coalesce(c.zone, '') as zone, c.sku, sum(c.qty)::numeric as qty,
         a.label, a.brand, a.ean
  from public.counts c
  left join public.articles a
    on a.session_id = c.session_id and a.sku = c.sku
  where c.session_id = p_session_id
    and c.pass_number = p_pass
    and c.counted_by = auth.uid()
    -- ⚠️ LE CURSEUR SE POSE AVANT L'AGRÉGATION, ET PAR CLÉ, JAMAIS PAR
    -- `offset`. Avec un décalage, la page N repaierait le parcours des N × 5 000
    -- lignes précédentes — un coût qui croît avec le carré de la liste, et
    -- c'est exactement ce qui empêchait le cache hors ligne de se remplir
    -- au-delà de 20 000 articles (3 septembre 2026). Le filtre porte sur les
    -- deux colonnes du `group by`, donc il découpe l'agrégat sans le fausser.
    and (p_apres_zone is null or p_apres_sku is null
         or (coalesce(c.zone, ''), c.sku) > (p_apres_zone, p_apres_sku))
  group by coalesce(c.zone, ''), c.sku, a.label, a.brand, a.ean
  having sum(c.qty) > 0
  -- ⚠️ L'ORDRE EST TOTAL — (zone, sku) est la clé du regroupement, deux lignes
  -- ne peuvent pas être à égalité. Sans ordre total, une ligne se voit deux
  -- fois et une autre jamais : le piège classique de la pagination, et il ne
  -- se remarque qu'en production.
  order by coalesce(c.zone, ''), c.sku
  limit v_limite;
end; $function$;

revoke all on function public.mes_balises_comptees(uuid, integer, text, text, integer) from public, anon;
grant execute on function public.mes_balises_comptees(uuid, integer, text, text, integer) to authenticated, service_role;
