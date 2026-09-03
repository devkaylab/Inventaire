-- Un référentiel de 30 000 articles ne se compte ni ne se remplace plus au
-- rythme d'une ligne à la fois.
--
-- Constat de Julien, 3 septembre 2026, capture à l'appui : l'onglet Set up de
-- « HV » (29 382 articles) affichait un encadré rouge portant `{"message":""}`.
-- Ce n'était pas un défaut d'affichage — c'était un DÉLAI SERVEUR DÉPASSÉ.
--
-- ⚠️ LE MÉCANISME, PARCE QU'IL SE REPRODUIRA. La policy `articles_supervisor`
-- est `get_my_role() = 'supervisor' and is_session_participant(session_id)`.
-- Le second appel PORTE LA COLONNE DE LA LIGNE : Postgres ne peut pas le
-- remonter en InitPlan, il l'évalue UNE FOIS PAR LIGNE. Et
-- `is_session_participant` n'est pas inlinable (elle porte un `set
-- search_path`), donc chaque appel est une invocation complète qui en fait
-- trois autres — `is_admin`, `get_my_company`, `is_company_admin`.
--
-- Mesuré sur la base réelle, session simulée : compter les 29 382 lignes
-- demande 11,7 s. Le délai de `authenticated` est plus court, donc :
--   57014 « canceling statement due to statement timeout »
--     → 500 à corps vide → PostgREST rend `{ message: '' }`
--       → l'écran affichait ce JSON tel quel.
-- Six timeouts ce matin-là : cinq sur le comptage — joué à CHAQUE ouverture du
-- tableau de bord, donc l'onglet était cassé bien avant qu'on importe quoi que
-- ce soit — et un sur le DELETE qui précède un remplacement.
--
-- ⚠️ LE CORRECTIF EST LE MOTIF DÉJÀ EN PLACE, PAS UN INDEX. Les index existent
-- (`articles_session_sku_key` porte `session_id` en tête) et le plan les
-- utilise : le temps ne part pas dans la lecture, il part dans la policy.
-- On contrôle donc le droit UNE FOIS, puis on travaille hors RLS —
-- exactement ce que `get_session_count_totals` a fait pour `counts` le 22 août
-- 2026, et pour la même raison.
--
-- ⚠️ ET LA GARDE NE S'ÉLARGIT PAS D'UN POUCE. `can_access_session` est, à la
-- lettre, la qual de la policy qu'on contourne :
--   `select get_my_role() = 'supervisor' and is_session_participant(p_session_id)`
-- Vérifié sur `pg_get_functiondef` avant d'écrire. Ni plus, ni moins.


-- ── 1. L'état des imports, en un seul appel ─────────────────────────────────
--
-- Elle remplace trois requêtes de `getImportState` : deux comptages exacts en
-- HEAD (ceux qui expiraient) et `get_session_theoretical_total`.
--
-- ⚠️ Elle ne rend que des NOMBRES, jamais des lignes. C'est ce qui la rend
-- indifférente à la taille du référentiel : 30 000 articles ou 300 000, la
-- réponse fait trois valeurs.
create or replace function public.etat_import(p_session_id uuid)
returns table (
  articles bigint,
  stock bigint,
  theorique numeric
)
language plpgsql
stable
security definer
set search_path to 'public'
as $$
begin
  if not public.can_access_session(p_session_id) then raise exception 'forbidden'; end if;

  return query
  select
    (select count(*) from public.articles a where a.session_id = p_session_id),
    (select count(*) from public.theoretical_stock t where t.session_id = p_session_id),
    coalesce((select sum(t.theoretical_qty) from public.theoretical_stock t
              where t.session_id = p_session_id), 0)::numeric;
end; $$;

revoke all on function public.etat_import(uuid) from public, anon;
grant execute on function public.etat_import(uuid) to authenticated, service_role;


-- ── 2. Vider avant de remplacer ─────────────────────────────────────────────
--
-- Un import REMPLACE : un simple upsert laisserait les SKU d'un import
-- précédent qui ne sont plus dans le fichier. Le site faisait donc un DELETE
-- par PostgREST — celui qui expirait.
--
-- ⚠️ CE N'EST PAS LA POLICY RETIRÉE PAR VR-007, et il faut savoir pourquoi
-- avant d'y toucher. Ce qui a été fermé le 28 août 2026, c'est un DELETE **sur
-- un critère choisi par le client**. Ici le périmètre est fixé par le serveur :
-- un inventaire, une des deux tables de fichiers, entière. `p_cible` n'est pas
-- un nom de table qu'on interpole — c'est un choix entre deux branches écrites
-- en clair, et tout autre valeur est refusée.
--
-- ⚠️ ET CE N'EST PAS LE MÊME OBJET QUE `vider_balise` : on n'efface ici aucun
-- comptage. `counts` ne référence pas `articles`, aucune contrainte ne pointe
-- vers ces deux tables (vérifié sur `pg_constraint`) : la suppression ne
-- cascade nulle part. C'est pourquoi elle n'est pas journalisée non plus —
-- remplacer son fichier de préparation est un geste ordinaire, répété, qui ne
-- détruit le travail de personne ; l'inscrire au journal de l'entreprise le
-- noierait sans rien apprendre.
--
-- ⚠️ ELLE N'AJOUTE AUCUNE RESTRICTION QUE LA POLICY N'AVAIT PAS. En
-- particulier elle N'INTERDIT PAS un inventaire clôturé : `articles_supervisor`
-- ne le fait pas davantage, et ce chantier corrige un délai, il ne change pas
-- qui a le droit de faire quoi. Le jour où l'on voudra fermer ce cas, il se
-- ferme des deux côtés à la fois — ici ET dans la policy —, sans quoi le
-- refus dépendrait du chemin emprunté.
create or replace function public.vider_import(p_session_id uuid, p_cible text)
returns bigint
language plpgsql
volatile
security definer
set search_path to 'public'
as $$
declare v_supprimees bigint;
begin
  if not public.can_access_session(p_session_id) then raise exception 'forbidden'; end if;

  if p_cible = 'articles' then
    delete from public.articles a where a.session_id = p_session_id;
  elsif p_cible = 'stock' then
    delete from public.theoretical_stock t where t.session_id = p_session_id;
  else
    raise exception 'cible inconnue';
  end if;

  get diagnostics v_supprimees = row_count;
  return v_supprimees;
end; $$;

revoke all on function public.vider_import(uuid, text) from public, anon;
grant execute on function public.vider_import(uuid, text) to authenticated, service_role;
