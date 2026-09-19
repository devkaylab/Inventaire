# Un inventaire de n'importe quelle taille (3 septembre 2026)

*« Nous étions en inventaire ce matin et n'avons pas pu utiliser l'outil. »*
Constat de Julien, après le correctif de la veille. Les journaux le confirment :
**sept erreurs entre 06:39 et 06:47 UTC**, toutes sur `/rest/v1/articles`, cinq
depuis son PC et **une depuis l'iPhone**.

Le correctif de la veille (`etat_import` / `vider_import`) était bon, mais il ne
fermait qu'une partie du chemin. Le balayage complet a trouvé **deux causes
distinctes**, de familles différentes, et il fallait les deux.

## ⚠️ Cause 1 : la policy RLS s'évalue UNE FOIS PAR LIGNE

`is_session_participant(session_id)` prend la colonne de la **ligne** : le
planificateur ne peut pas la remonter en InitPlan, et la fonction porte un
`set search_path`, donc elle n'est jamais inlinée.

**Mesuré sur la base réelle : 0,44 ms par appel.** Le délai d'`authenticated`
valant **8 s** (relevé sur `pg_roles`, pas supposé), on a un plafond dur :

> **~18 000 lignes** d'un même inventaire pour toute lecture directe.

- **⚠️ Un COMPTEUR ne paie pas.** Le plan montre que sa branche part en
  `hashed SubPlan`, évaluée une seule fois. C'est le **superviseur** qui paie,
  parce que sa branche est la première du `OR`. Ne pas chercher le défaut du
  côté des compteurs.
- **⚠️ Ce n'est PAS un défaut d'index**, et c'est la première fausse piste à
  écarter : le plan fait bien `Index Only Scan`, `Heap Fetches: 0`. Le temps ne
  part pas dans la lecture, il part dans la policy. Un index de plus n'aurait
  rien donné.

## ⚠️ Cause 2 : deux fonctions dépendaient de la fraîcheur des STATISTIQUES

Et celle-là ne se voit dans aucun code. `recompute_session_audit` finissait par
un `not exists` **corrélé**. Même requête, mêmes données, 29 389 lignes d'audit
contre 58 778 comptages :

| statistiques | plan | temps |
|---|---|---|
| à jour | `Hash Right Anti Join` | **53 ms** |
| périmées | boucle imbriquée | **> 45 s** (délai dépassé) |

Un rapport de mille. Et elles sont périmées **exactement au moment qui compte** :
juste après l'import de 30 000 lignes, avant qu'autovacuum ne soit passé.

`get_session_detail` — le tableau du Rapport — avait la même maladie sous une
autre forme : **une CTE jointe à elle-même** (`cnt` et `aud`, deux découpes de
`c`, réunies puis re-jointes). Une CTE n'a **aucune statistique** : le
planificateur devine, et s'il devine petit il choisit une boucle imbriquée, soit
29 389 × 29 389 parcours.

**La leçon, plus large que ce chantier** : `SECURITY DEFINER` met à l'abri de la
RLS, pas du planificateur. Une fonction qui joint une CTE à elle-même, ou qui
corrèle une sous-requête sur une colonne, est une bombe à retardement qui
n'explose que sur un gros volume ET des statistiques fraîches d'un import.

## Ce qui a été fait

Trois migrations (`20260903140001..3`). Tout est mesuré **avec des statistiques
volontairement périmées**, sur les 29 389 articles réels de « HV W&J » :

| chemin | avant | après |
|---|---|---|
| `recompute_session_audit` (onglet Écarts, écran audits) | **> 45 s** | **1 025 ms** |
| `get_session_detail` (Rapport, export) | **> 45 s** | **445 ms** |
| écarts + libellés (`getAudits` + 150 requêtes) | ~13 s + 150 A/R | **190 ms** |
| cache hors ligne complet, 30 pages | ~170 s, échec dès la page 20 | **391 ms** |
| dernière page du référentiel | 10 832 ms | **2 ms** |
| « ce que j'ai compté » | balayait tout | **273 ms** |
| liste des scans d'une balise | somme au téléphone + 10 A/R | **246 ms** |

- **⚠️ Le ménage de l'audit passe par un MARQUEUR, plus par une jointure.**
  L'upsert touche exactement les couples (zone, sku) qui portent des comptages
  et leur pose `v_marque` ; ce qui reste avec une autre valeur n'a plus aucun
  comptage. C'est la définition même de ce que le `not exists` cherchait, **sans
  jointure, donc sans plan à rater**. Ne pas « simplifier » en revenant à un
  `not exists`.
- **⚠️ LA PAGINATION DU RÉFÉRENTIEL EST PAR CLÉ, PLUS PAR `OFFSET`.** Avec
  `range()`, la page N repayait le contrôle sur les N × 1 000 lignes
  précédentes — un coût qui croît avec le carré du catalogue. Le cache hors
  ligne d'un superviseur ne se remplissait **plus du tout** au-delà de ~20 000
  articles, **en silence** (`primeOfflineCache` rend `false`, l'écran dit
  seulement « hors ligne dégradé »).
- **⚠️ `mes_balises_comptees` corrige aussi un CONTRESENS, antérieur au sujet de
  la charge.** `getMyCounts` ne filtrait sur personne : c'est
  `counts_select_own` qui bornait un **compteur** à ses lignes. Un
  **superviseur** relève de `counts_select_supervisor` — il voyait donc **toute
  l'équipe** sous un écran intitulé « ce que ce compteur a déjà compté ». Le
  filtre `auth.uid()` est maintenant dans la fonction : il ne dépend plus du
  rôle de qui appelle. Même défaut, même correctif que `get_my_count_totals` le
  22 août 2026.
- **⚠️ Le périmètre reste fixé par le SERVEUR.** Un inventaire, une balise, une
  tranche bornée à 5 000. Jamais une liste choisie par le client — c'est ce que
  VR-007 a fermé le 28 août, et un test refuse un paramètre tableau.
- **`membre_ou_superviseur` n'est PAS une surface cliente** : révoquée à `anon`
  **et** à `authenticated`. Les fonctions qui l'appellent sont `SECURITY
  DEFINER`, elles s'exécutent avec les droits du propriétaire. Elle existe parce
  que quatre fonctions portaient le même garde, et que le projet a déjà payé le
  prix de deux fonctions sœurs qui divergent.
- **`getTheoreticalStock` a été retirée** : aucun appelant depuis longtemps.

## ⚠️ Le garde-fou des gardes-fous, corrigé au passage

`derniereDefinition` ne reconnaissait que `create or replace function`. Or
changer la liste des colonnes de retour impose un `drop` préalable, et le
`create` qui suit n'a pas besoin du `or replace` — c'est ce qu'a fait
`mes_balises_comptees`. Le helper serait donc remonté à la définition
**précédente**, celle qui ne tourne plus : **exactement le défaut qu'il existe
pour empêcher**. Il accepte maintenant les deux formes.

## Vérifications

- **En base, tout en transactions annulées**, sur les fonctions réellement
  appliquées, statistiques volontairement périmées : les sept temps du tableau ;
  le ménage qui supprime bien ses 500 lignes orphelines **et préserve un
  arbitrage** ; et la matrice d'accès complète — un **compteur** lit le
  référentiel, ses balises et ses scans mais est **refusé** sur les écarts et le
  rapport ; un **étranger** est refusé sur les cinq ; un **superviseur** obtient
  **0 ligne** de `mes_balises_comptees`, puisqu'il n'a rien compté lui-même
  (c'est le contresens corrigé, visible en une mesure).
- **Zéro résidu contrôlé** après coup : 165 comptages, 156 lignes de stock,
  62 audits, 29 553 articles, 5 inventaires — identiques à avant.
- **Les gardes mordent** : les huit assertions d'absence rejouées contre la
  version d'avant échouent toutes les huit.
- 876 tests du site, 380 de l'application, `tsc --noEmit` des deux côtés,
  `eslint .` à **zéro erreur** (39 avertissements, la famille `react-hooks/*`
  déjà documentée), `next build` avec la même table de routes.

**Non vérifié à l'écran** : l'onglet Écarts, le Rapport et les écrans mobiles
demandent une session de superviseur, que je n'ai pas. Ce qui est prouvé, c'est
que les sept chemins serveur répondent juste, vite, et aux bonnes personnes.

⚠️ **L'application doit être reconstruite** : le correctif de l'import du
2 septembre **et** celui-ci vivent dans le dépôt, pas sur le téléphone. C'est
l'iPhone qui a produit la sixième erreur de la matinée.

**Piste laissée ouverte, et pourquoi** : `get_balise_detail` (2 septembre) porte
la même forme de CTE jointe à elle-même. Elle est bornée à **une balise** —
quelques centaines de références —, donc même une boucle imbriquée y reste
indolore. À reprendre le jour où une balise porterait des milliers de
références, pas avant.

Tests de garde : `web/tests/inventaire-de-toute-taille.test.ts`.

## 400 000 références — le plafond, mesuré (3 septembre 2026)

*« Jusqu'à combien peux-tu monter le plafond ? Un vrai inventaire peut aller
jusqu'à 400 000 références, on doit voir large. »*

Mesuré d'abord, sur un inventaire synthétique de **382 057 références et
764 114 comptages**, en transactions annulées, **statistiques volontairement
périmées**. Tout passait, sauf une chose :

| chemin | à 382 057 références |
|---|---|
| cache hors ligne complet (383 pages) | 709 ms |
| liste des écarts | 2 058 ms |
| rapport | ~2 500 ms |
| **recalcul des écarts** | **16 503 ms** |

### ⚠️ Il n'existe pas de version rapide du recalcul COMPLET

Trois optimisations essayées, mesurées, et le plancher n'a pas bougé :

- index d'expression sur l'agrégat → l'agrégat tombe à **541 ms** ;
- `where` sur le `do update` → n'écrit plus que ce qui change ;
- `enable_nestloop` fermé → l'anti-jointure passe en hachage.

Et pourtant un recalcul « rien n'a changé » coûtait encore **6,6 s**. La raison
est structurelle : **`insert … on conflict` doit insérer puis détecter le
conflit sur CHACUNE des 382 057 lignes**, même quand la clause `where` l'empêche
d'écrire au bout. Sonder 400 000 lignes prend cinq secondes, un point c'est
tout.

**La seule issue est de ne plus tout recalculer à chaque ouverture.**

### L'empreinte

`counts` est en **ajout pur** : hors suppression explicite, le nombre de lignes
ne peut que croître. Le nombre de comptages est donc une empreinte **exacte** —
inchangé ⟹ rien n'est arrivé ⟹ l'audit est déjà juste.

| | avant | après |
|---|---|---|
| 1er recalcul (382 057 lignes à créer) | 16 503 ms | **15 003 ms** |
| recalcul, rien n'a bougé | 16 503 ms | **423 ms** |
| recalcul, 500 scans de plus | 16 503 ms | **7 194 ms** |

- **⚠️ L'exactitude tient à une règle, pas à une heuristique : TOUTE
  suppression de comptages efface l'empreinte.** Sans cela, une suppression
  suivie d'un ajout redonnerait le même compte et l'audit resterait faux **en
  silence**. `vider_balise` et `delete_audit_line` appellent donc
  `oublier_empreinte_audit`. Un test de garde balaie **toutes** les migrations,
  retrouve la dernière définition de chaque fonction contenant
  `delete from public.counts`, et exige l'appel — avec deux exemptions nommées :
  `delete_session` (la ligne part en cascade) et `revert_pass` (révoquée à
  `authenticated` depuis le 13 août 2026, donc injoignable ; la redéfinir
  rendrait EXECUTE à PUBLIC et rouvrirait ce trou pour un gain nul).
- **⚠️ L'empreinte ne peut PAS vivre sur `inventory_sessions`** : un superviseur
  a le droit d'y écrire (`sessions_supervisor_update`), il pourrait donc figer
  une empreinte fausse depuis le navigateur et **geler ses propres chiffres
  d'audit**. Table à part, RLS active, aucune policy, révoquée à
  `authenticated` — le motif de `stripe_events_traites`.
- **⚠️ `p_force` n'est pas une commodité.** L'annulation d'un arbitrage écrit
  **directement** dans `article_audit` sans toucher aux comptages : l'empreinte
  ne bouge pas, le raccourci s'activerait, et la ligne resterait « à traiter »
  au lieu de retrouver son vrai statut. C'est le **seul** appelant qui force,
  des deux côtés. L'ancienne signature à un argument est **supprimée** (piège de
  `p_event_id` et de `ca_request_store`) ; un appel nommé à un argument continue
  de fonctionner.
- **`set statement_timeout to '60s'` sur la fonction** : le tout premier
  recalcul d'un inventaire entièrement compté crée autant de lignes qu'il y a de
  références — ~15 s à 400 000, incompressible, et une seule fois. Les 8 s par
  défaut le tuaient.

### ⚠️ Le marqueur du matin n'a pas survécu à l'après-midi

Le premier correctif du jour remplaçait l'anti-jointure par un **marqueur**
(`v_marque` posé par l'upsert, relu par le delete) — plan-proof, 87 ms sur
29 889 lignes. Il exige de **réécrire toutes les lignes à chaque recalcul** :
dix secondes d'écriture pour rien à 400 000. La protection est donc passée du
côté du **plan** : `set enable_nestloop to off` rend le mauvais choix impossible
quelles que soient les statistiques (mesuré : boucle imbriquée > 45 s, hachage
53 ms), et l'upsert n'écrit plus que ce qui change. Le bloc de garde a été
**récrit, pas affaibli** — il vérifie désormais que la boucle est fermée et que
le marqueur a disparu.

### Vérifications

- **Sept contrôles de justesse sur les données réelles**, en transaction
  annulée : l'audit reproduit exactement l'agrégat des comptages, les statuts
  suivent la même règle qu'avant, une ligne orpheline est retirée, un arbitrage
  survit, un scan arrivé après l'empreinte est bien pris, le raccourci ne
  s'active que si rien n'a bougé, et vider une balise efface l'empreinte.
- **Zéro résidu contrôlé** : 29 553 articles, 165 comptages, 62 audits,
  156 lignes de stock — identiques à avant.
- **La garde du §empreinte mord** : en retirant l'appel dans `vider_balise`,
  elle échoue **en nommant la fonction fautive**.
- 884 tests du site, 380 de l'application, `eslint .` à zéro erreur,
  `next build` avec la même table de routes.

⚠️ **Piège de méthode du jour** : un premier contrôle a annoncé 8 lignes
divergentes. C'était le TEST, pas la fonction — dans un `full join`, une
condition sur la table de droite posée dans le `ON` laisse remonter **toutes les
lignes des autres inventaires** comme si elles divergeaient (62 audits au total
− 54 pour cet inventaire = les 8). Filtrer la table AVANT la jointure. Ne pas
conclure à une régression sur un `full join` mal écrit.

### Ce qui reste, et à quel prix

Sur un inventaire de 400 000 références en cours d'audit, **une ouverture de
l'onglet Écarts après de nouveaux scans coûte ~7 s** — le plancher du sondage
décrit plus haut. Le rendre instantané demanderait de ne recalculer que les
couples (balise, référence) réellement touchés, donc une colonne d'**ordre
d'arrivée posée par le serveur** sur `counts`. ⚠️ **`created_at` ne peut pas
servir** : la file hors ligne envoie l'heure réelle du scan
(`src/lib/offline.ts`), donc un téléphone qui se synchronise après coup insère
des lignes **antidatées** — un repère fondé sur `created_at` les manquerait, et
l'audit serait faux sans que rien ne le dise. Chantier à ouvrir seulement si un
client atteint réellement cette taille.
