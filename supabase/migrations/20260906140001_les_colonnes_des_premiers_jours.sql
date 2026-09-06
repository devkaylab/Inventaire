-- Les cinq colonnes des premiers jours (6 septembre 2026)
--
-- Suite du rattrapage de la veille, et trouvé par accident : en écrivant une
-- garde pour l'archivage, le sabotage « efface aussi la table `articles` » EST
-- PASSÉ. La garde déduisait la liste des tables d'inventaire en cherchant les
-- clés étrangères vers `inventory_sessions` dans le dossier — et
-- `articles.session_id` n'y figure nulle part.
--
-- ⚠️ C'EST LE VRAI COÛT D'UNE COLONNE NON DÉCRITE, ET IL EST SILENCIEUX : une
-- garde qui déduit d'une source trouée déduit mal, et ne le dit jamais.
--
-- Mesuré ensuite sur les 282 colonnes de la base : **cinq** ne sont décrites
-- par aucune migration, toutes des tout premiers jours (les huit migrations
-- appliquées par la console et jamais versionnées). Elles ne sont pas anodines
-- — le drapeau d'administrateur Quantinvo en fait partie.
--
-- ⚠️ COMME HIER : CE FICHIER DÉCLARE L'EXISTANT, IL NE CHANGE RIEN. Chaque
-- instruction est un no-op sur la production (`if not exists`, `set not null`
-- sur une colonne déjà non nulle, `drop constraint if exists` sur une
-- contrainte déjà absente). Vérifié par empreinte de catalogue avant et après.

-- --------------------------------------------------- profiles.is_admin
--
-- Le drapeau qui décide qui est administrateur Quantinvo. C'est lui que lit
-- `is_admin()`, donc la garde des dix-huit RPC d'administration et de l'exigence
-- aal2. Il n'était écrit nulle part — la règle du projet (« mener les revues de
-- sécurité depuis la base, jamais depuis le dossier ») en était l'illustration
-- involontaire.
--
-- ⚠️ Il est figé par `profiles_pin_privileged` pour `authenticated` et `anon` :
-- sans ce déclencheur, un compteur se promouvait d'un simple UPDATE.
alter table public.profiles add column if not exists is_admin boolean not null default false;

-- ------------------------------------------- inventory_sessions, trois colonnes
--
-- `name` : le nom que porte un inventaire. Défaut vide, jamais nul — les écrans
-- retombent sur le nom du magasin quand il est vide.
alter table public.inventory_sessions add column if not exists name text not null default '';

-- `security_code` : le code que les compteurs saisissent avec le numéro
-- d'inventaire pour rejoindre. ⚠️ À ne pas confondre avec `security_code_hash`,
-- déclaré dès `20260526000001` : les deux coexistent, et c'est celui-ci que
-- l'application affiche.
alter table public.inventory_sessions add column if not exists security_code text;

-- `uses_zones` : le mode balises. ⚠️ Ce choix ne se change plus après la
-- création — c'est ce que l'écran de création dit en gras — et il gouverne la
-- moitié du produit : l'écran de comptage, la progression, l'audit par balise.
alter table public.inventory_sessions add column if not exists uses_zones boolean not null default false;

-- ------------------------------------------------- articles.session_id
--
-- Le rattachement d'un article à son inventaire, avec ses deux contraintes :
-- elles viennent du même geste manquant, la migration `scope_articles_to_session`
-- des premiers jours.
--
-- ⚠️ ET ELLE A REMPLACÉ UNE UNICITÉ GLOBALE. `20260526000001` déclare
-- `sku text NOT NULL UNIQUE`, donc une référence unique sur TOUTE la base — un
-- même SKU n'aurait pas pu exister dans deux inventaires. C'est cette contrainte
-- qui a sauté au profit de `(session_id, sku)`. Sans cette ligne, une base
-- rebâtie depuis le dossier refuserait le second inventaire qui réimporte le
-- même catalogue.
do $colonnes$
begin
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'articles'
                    and column_name = 'session_id') then
    alter table public.articles add column session_id uuid;
    -- La table est vide sur une base neuve ; en production la colonne existe
    -- déjà et ce bloc ne s'exécute pas.
    alter table public.articles alter column session_id set not null;
  end if;
end;
$colonnes$;

do $contraintes$
begin
  if not exists (select 1 from pg_constraint where conname = 'articles_session_id_fkey') then
    alter table public.articles
      add constraint articles_session_id_fkey
      foreign key (session_id) references public.inventory_sessions(id) on delete cascade;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'articles_session_sku_key') then
    alter table public.articles
      add constraint articles_session_sku_key unique (session_id, sku);
  end if;
end;
$contraintes$;

-- L'unicité globale du SKU n'existe plus en base : on le dit, sinon une base
-- rebâtie la garderait.
alter table public.articles drop constraint if exists articles_sku_key;
