# Archiver un inventaire : douze mois après la clôture (6 septembre 2026)

*« Travaille sur l'archivage »*, puis, la décision posée : **durée annoncée**
(pas un bouton) et **douze mois après la clôture**. Document de décision :
https://claude.ai/code/artifact/d4421a04-8bca-4114-ab68-51e2f07efb3d

Rien n'effaçait jamais un inventaire : `purge_expired_data` ne touchait **aucune**
table d'inventaire, et un gros inventaire pèse ~680 Mo qui ne redescendent pas.

## ⚠️ ON EFFACE LE JOURNAL DES SCANS, JAMAIS LE RÉSULTAT

C'est la découverte qui a fait tout le chantier, et elle se vérifie en une
requête : **le Rapport ne lit pas `counts`**. Les 27 fonctions qui touchent
cette table ont été passées en revue — `rapport_page`, `rapport_resume`,
`ecarts_page`, `rapport_magasin_*` vivent toutes sur `article_audit`, le
consolidé. Effacer les scans ne retire donc rien à ce que le client relit, et
**aucun écran principal ne change**.

| | |
|---|---|
| Ce qui part | `counts` — une ligne par scan, avec `counted_by` et l'heure |
| Ce qui reste | le rapport, les écarts, le rapport magasin, le référentiel, le stock théorique, l'audit |
| Ce qu'on perd | la feuille « Détail » de l'export, le détail d'une balise, les compteurs d'activité d'une personne |
| Place rendue | ~34 % d'un inventaire |

C'est aussi la donnée **nominative** qui part en premier, ce qui est le bon sens
côté RGPD.

## ⚠️ LE VERROU DU RECALCUL EST VITAL — sans lui, l'archivage DÉTRUIT

`recompute_session_audit` finit par un `delete from article_audit` qui retire
les lignes n'ayant plus aucun comptage. **Les comptages effacés, ce delete
emporte tout le rapport.** Il suffisait qu'un client ouvre l'onglet Écarts d'un
inventaire archivé.

Et **aucun** des deux états ne protège tout seul : l'empreinte effacée,
`v_connue` est nul et le raccourci ne s'active pas ; l'empreinte gardée, elle
diverge du nouveau compte et le raccourci ne s'active pas davantage. Dans les
deux cas on tombe dans le delete.

D'où une sortie immédiate sur `archived_at is not null`, **posée AVANT
`p_force`** : l'annulation d'un arbitrage force le recalcul, et forcer sur un
inventaire archivé détruirait le rapport. Un arbitrage reste possible — il écrit
directement dans `article_audit` — il ne fait simplement plus recalculer.

## ⚠️ ET UN INVENTAIRE ARCHIVÉ NE SE ROUVRE PAS

Trou trouvé avant l'écran : la réouverture est un simple UPDATE client
(`reopenSession`), ouvert au créateur. Rouvert, un inventaire archivé
accepterait des comptages **dont l'audit ne tiendrait jamais compte**, en
silence — le verrou ci-dessus étant toujours là. Retirer ce verrou serait pire.

Déclencheur `sessions_archive_figee`, qui refuse le changement de statut **et**
l'effacement du drapeau (sinon on efface, puis on rouvre). Le renommage passe.

⚠️ **Il est en SECURITY INVOKER, et ce n'est pas un détail** : en DEFINER,
`current_user` vaudrait le propriétaire et la condition ne serait jamais vraie —
le garde-fou ne s'appliquerait à personne. Même règle que
`profiles_pin_privileged`, même piège.

Côté écran, le menu « ••• » ne propose plus « Rouvrir » sur un inventaire
archivé : **un bouton qui échoue vaut moins que pas de bouton**, on le découvre
après avoir accepté une confirmation.

## La durée vit à deux endroits, et ils bougent ensemble

`inventaires_ttl` dans `purge_expired_data`, et la phrase de `docs/privacy.html`.
Une politique qui promet douze mois pendant que la base en efface six est un
manquement, pas une coquille — un test compare les deux, **et le bandeau de
l'écran**, en toutes lettres.

La politique disait jusqu'ici « conservées tant que l'entreprise cliente utilise
le service, celle-ci en décidant la durée ». C'était vrai de notre rôle de
sous-traitant, et c'est précisément pourquoi **on ne pouvait pas effacer sans
changer cette phrase**. Elle annonce désormais la durée.

## `analyze`, pas `vacuum full`

Après une grosse suppression, le planificateur croit encore à l'ancien volume
(constat du 4 septembre : 1,27 million de lignes supposées pour 165 réelles).
`analyze` tient dans une transaction, la fonction le fait elle-même. **Le
`vacuum full`, qui rend l'espace au disque, verrouille les tables : il reste
manuel, à programmer, jamais un matin d'inventaire.**

## Ce qui a été vérifié

**L'essai à blanc, avant toute application** — règle du projet pour une fonction
destructrice. En transaction annulée, sur « LA Bruket » (83 scans, 101 lignes de
rapport) :

| | |
|---|---|
| Clos il y a 24 jours | **rien n'est archivé** |
| Clôture antidatée de 13 mois | 83 comptages effacés, 1 inventaire archivé |
| Lignes d'audit | 5 → **5** |
| Le recalcul, et le recalcul **forcé** | sortent par le verrou |
| **Le rapport** | **identique au caractère près** (101 lignes, 69 comptés, 719 théorique, −650 d'écart) |

Puis les refus : durée de 3 jours et durée nulle refusées, inventaires **non
clôturés** intacts même antidatés de trois ans, appel refusé à `authenticated`
et à `anon`, réouverture refusée, effacement du drapeau refusé, renommage
accepté. **Neuf sabotages, neuf échecs.** 1 286 tests du site, 416 de
l'application, `tsc` des deux côtés, `eslint .` à zéro erreur, `next build`
inchangé, et la mesure de dérive à zéro.

## ⚠️ TROIS PIÈGES DE GARDE, LE MÊME JOUR

1. **`pg_get_functiondef` rend l'en-tête en MAJUSCULES et entre quotes**
   (`SET enable_nestloop TO 'off'`). Repartir de la base est le bon réflexe pour
   le **corps** — c'est ce qui garantit qu'on ne réécrit que la phrase voulue —
   mais recopier l'en-tête tel quel a fait tomber **cinq gardes** qui cherchent
   la forme minuscule du dossier. L'en-tête se remet dans la langue du dépôt.
   Même famille que le « CREATE OR REPLACE » du 5 septembre.
2. **`fichierDe(fn)` ne parle QUE de `fn`** — deuxième fois. Deux gardes
   lisaient « le fichier de `recompute_session_audit` » pour y vérifier un
   `drop function` et un `create index`, qui n'appartiennent ni l'un ni l'autre
   à cette fonction. Elles sont tombées le jour où une migration l'a redéfinie,
   **sur du code juste** — et ne validaient donc plus rien depuis cet instant.
   Elles balaient désormais tout le dossier (`toutesLesMigrations()`).
3. **⚠️ UNE GARDE QUI DÉDUIT D'UN DOSSIER INCOMPLET DÉDUIT MAL.** Ma première
   version listait les « tables d'inventaire » en cherchant les clés étrangères
   vers `inventory_sessions` dans les migrations — et le sabotage
   `delete from public.articles` **est passé** : `articles.session_id` a été
   ajoutée par une migration des tout premiers jours qui n'a jamais eu de
   fichier. La garde compte maintenant les suppressions **dans la fonction
   elle-même** : une seule, et c'est `counts`. Ne dépendre d'aucune liste vaut
   mieux que déduire d'une source trouée.

## Ce que ça révèle, et qui reste ouvert

⚠️ **`articles.session_id` n'est décrite dans aucune migration.** La mesure de
dérive du 5 septembre compare les **fonctions** et l'existence des **tables** —
pas les colonnes. Ce dixième orphelin est d'une autre nature que les neuf
premiers, et il n'est pas rattrapé. Sans conséquence aujourd'hui ; à reprendre
si l'on veut que le dossier décrive la base **colonne par colonne**.

**Non vu à l'écran** : le bandeau d'un inventaire archivé demande une session de
superviseur ET un inventaire vieux de douze mois — il n'en existe aucun. Ce qui
est tenu, c'est le texte (deux tests le comparent à la durée appliquée) et la
classe, `banner banner-info`, déjà en place.

Tests de garde : `web/tests/archivage.test.ts`.

## Les cinq colonnes des premiers jours (6 septembre 2026)

Suite immédiate, et **trouvée par accident** : la garde de l'archivage
déduisait la liste des tables d'inventaire depuis le dossier, et le sabotage
`delete from public.articles` **est passé** — `articles.session_id` n'y figure
nulle part.

⚠️ **C'EST LE VRAI COÛT D'UNE COLONNE NON DÉCRITE, ET IL EST SILENCIEUX** : une
garde qui déduit d'une source trouée déduit mal, et ne le dit jamais. On croit
être protégé.

Mesuré ensuite sur les 282 colonnes de la base : **cinq** n'étaient décrites par
aucune migration, toutes des huit migrations que la console a appliquées aux
premiers jours sans jamais les versionner.

| Colonne | Ce que c'est |
|---|---|
| `profiles.is_admin` | le drapeau que lit `is_admin()` — donc la garde des dix-huit RPC d'administration et l'exigence aal2 |
| `inventory_sessions.name` | le nom d'un inventaire |
| `inventory_sessions.security_code` | le code que les compteurs saisissent (⚠️ distinct de `security_code_hash`, lui déclaré dès l'origine) |
| `inventory_sessions.uses_zones` | le mode balises, choix irréversible qui gouverne la moitié du produit |
| `articles.session_id` | le rattachement d'un article à son inventaire |

⚠️ **ET `articles.session_id` A REMPLACÉ UNE UNICITÉ GLOBALE.**
`20260526000001` déclare `sku text NOT NULL UNIQUE` — une référence unique sur
TOUTE la base, donc un même SKU impossible dans deux inventaires. C'est cette
contrainte qui a sauté au profit de `(session_id, sku)`. Sans la ligne qui le
dit, une base rebâtie depuis le dossier **refuserait le second inventaire qui
réimporte le même catalogue**. La migration porte donc aussi le
`drop constraint if exists articles_sku_key`.

⚠️ **La plupart des contraintes qui « manquaient » ne manquaient pas.**
`articles_pkey`, `profiles_pkey`, les `check` du `create table` : elles sont
bien décrites, elles portent seulement un nom que Postgres génère. Chercher les
contraintes par leur NOM dans le dossier produit une liste de faux positifs —
ne pas s'y fier, et vérifier ce qui découle d'une déclaration en ligne.

## La mesure de dérive a un troisième volet

`scripts/mesurer-migrations.mjs` comparait les fonctions et les tables. Il
compare désormais aussi les **colonnes** : 282 en base, zéro sans migration.
Retirer le rattrapage lui fait rendre exactement les cinq.

⚠️ **C'est une approximation, et elle est assumée** : on cherche le nom de la
colonne dans ce que le dossier écrit au sujet de sa table (`create table` et
tous les `alter table`). Une colonne renommée, ou dont le nom apparaît par
coïncidence, serait mal jugée. Cinq sur 282 est un résultat qu'on vérifie à la
main ; c'est une mesure, pas un compilateur.

**Vérifié** : empreinte des neuf catalogues identique avant, en transaction
annulée, et après application réelle — aucune ligne modifiée. Le script sort en
erreur (code 1) sans le rattrapage, en 0 avec. Un sabotage sur le volet colonnes
fait échouer la garde hors ligne.

## Les deux policies, et la leçon des familles non mesurées

Question de Julien, à la lecture de la limite ci-dessus : *« Est-ce
problématique ? »* — et j'avais écrit « aucun ne l'est aujourd'hui » **en
m'appuyant sur les empreintes de mes propres migrations, pas sur une
comparaison**. Mesuré pour de vrai, dans la foulée :

| Famille | En base | Sans migration |
|---|---|---|
| Policies | 37 | **2** |
| Déclencheurs | 6 | 0 |
| Index explicites | 29 | 0 |

`articles_member_read` (un membre lit le catalogue de son inventaire) et
`companies_admin_select` (l'administrateur Quantinvo lit toutes les entreprises).

⚠️ **CE N'ÉTAIT PAS UN TROU, ET C'EST VÉRIFIÉ, PAS SUPPOSÉ.** Les deux sont
correctement cloisonnées — l'une par `session_members`, l'autre par
`is_admin()`, qui porte l'exigence aal2. Le problème n'était pas leur contenu :
c'est qu'une revue de sécurité menée depuis le dossier ne les aurait pas vues.
La règle « l'analyse porte sur la base réelle, jamais sur `supabase/migrations/` »
existait précisément pour ça ; elle n'a plus à couvrir ce cas.

⚠️ **LA LEÇON EST DANS L'ORDRE DES DÉCOUVERTES.** Trois passes, trois familles
regardées, deux qui ont livré des orphelins : neuf objets le 5 septembre, cinq
colonnes le 6 au matin, deux policies l'après-midi — et chacune n'est sortie que
parce qu'on l'a mesurée. **On ne saura jamais qu'une famille est saine tant
qu'on ne la regarde pas.** Les déclencheurs et les index le sont ; ça aussi, il
fallait le mesurer pour le dire.

⚠️ **Ce que la discipline couvre maintenant** : fonctions, tables, colonnes,
policies, déclencheurs, index explicites, et les corps. **Ce qu'elle ne couvre
toujours pas** : les **droits** (`grant` / `revoke`) et les **contraintes**. Pour
les contraintes, une mesure par nom donnerait surtout des faux positifs — les
clés primaires et les `check` en ligne portent un nom généré par Postgres, et
sont bien décrits par la création de leur table. Pour les droits, la garde
existante (« toute fonction dont une migration règle les droits y est aussi
définie ») couvre le sens qui compte, mais pas l'inverse.

## « Ce que j'ai compté » ne descend plus d'un bloc (6 septembre 2026)

Dernier reste de la liste « base et exploitation » du 4 septembre.
`mes_balises_comptees` — l'écran où un compteur relit son propre travail —
n'avait **aucune limite**, seule rescapée de la passe de pagination du
3 septembre. Le plus gros cas réel fait 71 lignes ; sur un vrai gros
inventaire, un compteur ayant scanné plusieurs milliers de références aurait vu
**une erreur à la place de son travail**, au moment précis où il vérifie avant
de quitter le magasin.

## ⚠️ ON PAGINE LE TRANSPORT, PAS L'ÉCRAN

C'est la décision de conception, et elle vaut d'être comprise avant d'y toucher.
`CountedBalisesList` regroupe par balise et additionne par référence : il a
besoin de **toutes** les lignes pour que ses totaux soient justes. Un affichage
page par page les ferait grandir au fil du défilement — c'est le défaut « un
zéro se lit comme un résultat », corrigé le 4 septembre sur le rapport, qu'on
réintroduirait ici. Le téléphone reçoit donc la liste entière, mais va la
chercher par tranches de 1 000 : **le serveur ne fait plus jamais une requête
sans borne**, et c'est lui qui tombait à 8 s.

- **Plafond dur à 5 000 quoi que demande l'appelant**, comme ses voisines.
- **Curseur par clé, jamais `offset`** — la page N repaierait le parcours des
  N × 5 000 lignes précédentes (mesuré le 3 septembre : page 1 à 388 ms,
  page 29 à 10 832 ms). Le filtre porte sur les deux colonnes du `group by`,
  donc il découpe l'agrégat sans le fausser.
- **L'ordre est total** — `(zone, sku)` est la clé du regroupement, deux lignes
  ne peuvent pas être à égalité. Sans ça, une ligne se voit deux fois et une
  autre jamais.

## ⚠️ L'ANCIENNE SIGNATURE EST SUPPRIMÉE, ET LES BUILDS INSTALLÉS SURVIVENT

Les trois nouveaux paramètres ont un défaut : Postgres garderait les deux
fonctions et un appel à deux arguments deviendrait ambigu (piège de
`p_event_id` et de `ca_request_store`). D'où le `drop function` — et **un
téléphone déjà installé continue de marcher** : PostgREST appelle par noms de
paramètres, donc un appel qui n'envoie que `p_session_id` et `p_pass` laisse
Postgres appliquer les défauts. Vérifié en transaction annulée. Il prend alors
le plafond de 5 000, ce qui le protège du blocage sans rien changer chez lui.

## Les types de l'application ont été régénérés

⚠️ **Et c'est eux qui ont attrapé un défaut réel** : le curseur était passé à
`null` au premier appel, alors que les paramètres optionnels sont
`string | undefined`. Un paramètre ABSENT laisse Postgres appliquer son défaut ;
un `null` explicite ne dit pas la même chose. `tsc` a refusé — après
régénération seulement, l'ancien fichier de types ne connaissait pas les
nouveaux paramètres et laissait tout passer.

**Vérifié en transaction annulée, sur l'inventaire réel qui a le plus de lignes
pour une personne** : l'appel « ancien build » rend les mêmes 5 lignes ; la même
liste demandée par tranches de 2 rend 5 lignes en 3 appels, **aucune perdue ni
doublée** ; un étranger à l'inventaire est refusé. Quatre sabotages, quatre
échecs. Zéro dérive dossier/base.

⚠️ **L'application doit être reconstruite** pour que la boucle serve — la borne
serveur, elle, protège déjà les builds actuels.

Tests de garde : `web/tests/inventaire-de-toute-taille.test.ts`, blocs « elle est
bornée, comme ses voisines » et « mais l'ÉCRAN, lui, reçoit toujours tout ».
