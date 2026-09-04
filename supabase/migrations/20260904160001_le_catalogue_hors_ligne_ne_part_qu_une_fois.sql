-- Le catalogue hors ligne : plus léger, et il ne repart pas en entier
-- (4 septembre 2026).
--
-- Chaque téléphone télécharge le référentiel complet de l'inventaire pour
-- pouvoir compter sans réseau. Mesuré : **304 octets par référence**, soit
-- 8,9 Mo pour 30 000 références et **116 Mo pour 400 000** — par appareil.
-- Cent compteurs, c'est 11,6 Go sur le wifi d'un magasin, un matin
-- d'inventaire. C'est le point que la modélisation de charge du 4 septembre
-- a désigné comme le vrai risque, celui qui est hors de notre contrôle.
--
-- Deux leviers, et une seule fonction nouvelle pour les deux.
--
-- 1. NE PAS ENVOYER CE QUI NE SERT PAS. `lister_articles` transporte
--    l'identifiant interne, l'identifiant de l'inventaire, la date de
--    modification, et le code-barres EN DOUBLE (brut et normalisé). Le
--    scanner n'utilise rien de tout cela : vérifié champ par champ dans
--    `src/`, seuls `sku`, `ean`, `label`, `brand` et le prix sont lus.
--    `ean_norm` se recalcule sur le téléphone — `off.eanNorm()` existe depuis
--    le 2 septembre et reproduit exactement la colonne générée.
--    Le nom de colonne compte aussi : `unit_purchase_price` pèse 21 octets
--    PAR LIGNE dans le JSON, `prix` en pèse 6.
--
-- 2. NE RETÉLÉCHARGER QUE CE QUI A CHANGÉ. `p_depuis` filtre sur
--    `updated_at`. Un téléphone qui rouvre le même inventaire le lendemain
--    ne rapatrie rien.
--
-- ⚠️ `lister_articles` N'EST PAS TOUCHÉE, et c'est délibéré : les téléphones
-- déjà sur le terrain l'appellent. Règle du projet — le code se déploie
-- d'abord, l'objet se retire ensuite. Elle sera supprimée quand le nouveau
-- build sera partout.

-- Le repère : où en est le catalogue, en une ligne et sans le télécharger.
--
-- ⚠️ IL SE PREND AVANT LA PAGINATION, jamais après. Une modification qui
-- survient pendant que le téléphone tourne ses pages porte forcément un
-- `updated_at` postérieur au repère : elle sera donc rapatriée au passage
-- suivant. L'ordre inverse ouvrirait un trou.
--
-- ⚠️ `total` EST CE QUI RATTRAPE LES SUPPRESSIONS. Une date de modification
-- ne dit rien d'une ligne effacée — et remplacer un fichier d'import en
-- efface. Le téléphone compare le nombre d'articles qu'il croit connaître au
-- total du serveur : dès qu'ils divergent, il retélécharge tout. C'est la
-- seule garde contre un catalogue local qui garderait des fantômes.
create or replace function public.catalogue_repere(p_session_id uuid)
returns table(repere timestamptz, total bigint)
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
begin
  if not public.membre_ou_superviseur(p_session_id) then raise exception 'forbidden'; end if;
  return query
  select max(a.updated_at), count(*)::bigint
  from public.articles a
  where a.session_id = p_session_id;
end; $function$;

revoke all on function public.catalogue_repere(uuid) from public, anon;
grant execute on function public.catalogue_repere(uuid) to authenticated, service_role;

-- Le catalogue lui-même, épuré, et filtrable sur la date.
--
-- ⚠️ `p_depuis` compare en STRICTEMENT SUPÉRIEUR. Un import écrit toutes ses
-- lignes dans une seule transaction, donc avec le même `updated_at` : un
-- `>=` sur le repère les redemanderait TOUTES à chaque passage, et le levier
-- ne servirait plus à rien. Le trou théorique que `>` laisse — deux
-- transactions à la microseconde près — est fermé par le décompte total.
create or replace function public.catalogue_hors_ligne(
  p_session_id uuid,
  p_apres_sku text default null,
  p_limite integer default 1000,
  p_depuis timestamptz default null)
returns table(sku text, ean text, label text, brand text, prix numeric)
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  -- Le périmètre reste fixé par le SERVEUR, comme partout ailleurs.
  v_limite int := least(greatest(coalesce(p_limite, 1000), 1), 5000);
begin
  if not public.membre_ou_superviseur(p_session_id) then raise exception 'forbidden'; end if;
  return query
  select a.sku, a.ean, a.label, a.brand, a.unit_purchase_price
  from public.articles a
  where a.session_id = p_session_id
    and (p_apres_sku is null or a.sku > p_apres_sku)
    and (p_depuis is null or a.updated_at > p_depuis)
  order by a.sku
  limit v_limite;
end; $function$;

revoke all on function public.catalogue_hors_ligne(uuid, text, integer, timestamptz) from public, anon;
grant execute on function public.catalogue_hors_ligne(uuid, text, integer, timestamptz) to authenticated, service_role;
