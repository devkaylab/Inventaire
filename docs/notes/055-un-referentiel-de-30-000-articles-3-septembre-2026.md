# Un référentiel de 30 000 articles (3 septembre 2026)

Constat de Julien, capture à l'appui : l'onglet Set up de l'inventaire « HV »
(29 382 articles) affichait un encadré rouge portant **`{"message":""}`**.

Ce n'était pas un défaut d'affichage. C'était un **délai serveur dépassé**, et
le JSON n'en était que la trace.

## ⚠️ Le mécanisme, parce qu'il se reproduira

La policy `articles_supervisor` est
`get_my_role() = 'supervisor' and is_session_participant(session_id)`.

**Le second appel porte la colonne de la LIGNE.** Postgres ne peut donc pas le
remonter en InitPlan comme il le fait de `get_my_role()` : il l'évalue **une
fois par ligne**. Et `is_session_participant` n'est pas inlinable — elle porte
un `set search_path` —, donc chaque appel est une invocation complète qui en
déclenche trois autres (`is_admin`, `get_my_company`, `is_company_admin`).

Mesuré sur la base réelle, session simulée : **compter 29 382 lignes demande
11,7 s**. Le délai de `authenticated` est plus court, d'où l'enchaînement :

```
57014 « canceling statement due to statement timeout »
  → 500 à CORPS VIDE
    → postgrest-js fabrique { message: <corps> }, donc { message: '' }
      → errorMessage n'y trouve rien de lisible et sérialise en JSON
        → {"message":""} à l'écran
```

**⚠️ Et le défaut ne tenait pas à l'import.** Cinq des six timeouts de la
matinée venaient de `getImportState`, jouée à **chaque ouverture du tableau de
bord** : au-delà d'une vingtaine de milliers d'articles, l'onglet tombait en
erreur avant qu'on ait touché à quoi que ce soit. Le sixième était le `DELETE`
qui précède un remplacement.

**⚠️ Ce n'est PAS un défaut d'index, et il ne faut pas partir par là.** Les
index existent (`articles_session_sku_key` porte `session_id` en tête) et le
plan les utilise — `Index Only Scan`, `Heap Fetches: 0`. Le temps ne part pas
dans la lecture, il part dans la policy. Un index de plus n'aurait rien donné.

## Le correctif est le motif déjà en place

`etat_import` et `vider_import` (migration `20260903120001`) contrôlent le
droit **une fois**, puis travaillent hors RLS — exactement ce que
`get_session_count_totals` a fait pour `counts` le 22 août 2026, et pour la
même raison.

| | avant | après |
|---|---|---|
| compter (3 chiffres) | 11 726 ms, un timeout | **24 ms**, un seul appel |
| vider 29 382 lignes | timeout | **57 ms** |

- **⚠️ La garde ne s'élargit pas d'un pouce.** `can_access_session` **est**, à
  la lettre, la qual des policies contournées :
  `select get_my_role() = 'supervisor' and is_session_participant(p_session_id)`.
  Vérifié sur `pg_get_functiondef` avant d'écrire, pas supposé.
- **⚠️ `p_cible` n'est pas un nom de table**, c'est un choix entre deux
  branches écrites en clair ; toute autre valeur est refusée. Aucun SQL n'est
  fabriqué à partir du paramètre, et un test refuse `execute` et `format(`.
- **⚠️ Ce n'est pas le DELETE fermé par VR-007.** Ce qui a été retiré le
  28 août, c'est une suppression **sur un critère choisi par le client**. Ici
  le périmètre est fixé par le serveur : un inventaire, une des deux tables de
  fichiers, entière. Ne jamais l'élargir à une liste — un test refuse un
  paramètre tableau.
- **Pas de journal**, contrairement à `vider_balise` : on n'efface ici aucun
  comptage (`counts` ne référence pas `articles`, et **aucune contrainte ne
  pointe vers ces deux tables** — vérifié sur `pg_constraint`, la suppression
  ne cascade nulle part). Remplacer son fichier de préparation est un geste
  ordinaire et répété ; l'inscrire au journal de l'entreprise le noierait.
- **⚠️ Elle n'ajoute AUCUNE restriction que la policy n'avait pas** — un
  inventaire clôturé n'est pas refusé, `articles_supervisor` ne le refuse pas
  davantage. Ce chantier corrige un délai, il ne change pas qui a le droit de
  faire quoi. Le jour où on voudra fermer ce cas, il se ferme **des deux côtés
  à la fois**, sans quoi le refus dépendrait du chemin emprunté.

## ⚠️ L'insertion, elle, n'avait pas besoin d'être touchée — mesuré

Tentant de tout basculer d'un coup. Mesuré plutôt que supposé : un lot de
1 000 lignes prend **488 ms** sous la même RLS par ligne (linéaire : 4,4 s pour
10 000). Avec `BATCH_SIZE = 1000` la marge tient quelle que soit la taille du
fichier — c'est pourquoi les insertions passaient ce matin-là alors que le
comptage et le vidage expiraient. **Ne pas augmenter `BATCH_SIZE`** : c'est lui
qui garde cette marge.

## Ce qui n'a pas de texte ne se sérialise pas en JSON

Second défaut, indépendant, et il vaut pour les deux plateformes :
`errorMessage` finissait par `JSON.stringify(e)`. Or PostgREST fabrique
`{ message: <corps> }` **chaque fois que le serveur répond en erreur avec un
corps vide** — délai dépassé, passerelle qui coupe. Le cas est donc exactement
celui où la personne a le plus besoin d'une phrase, et c'est celui où elle
recevait du JSON.

- **Le code technique survit quand il existe** (`Erreur inconnue [57014]`) :
  c'est ce qui retrouve l'incident dans les journaux. L'objet brut, lui, est
  déjà tracé par le `console.error` de l'appelant — il n'a rien à faire à
  l'écran.
- **Le délai dépassé se dit, et ne se confond pas avec une coupure réseau** :
  l'opération est partie et a été interrompue en route, ce n'est ni un refus ni
  une panne de connexion. La branche `57014` passe **avant** la branche réseau,
  qui capterait « statement timeout » sur son `/timeout/`.
- Les deux `lib/errors.ts` divergent par conception (noms et textes
  différents) ; ils portaient le **même** défaut, corrigé des deux côtés.
- Les deux `lib/import.ts` sont dupliqués volontairement et **bougent
  ensemble** : l'application portait le même DELETE, donc le même mur.

## Vérifications

- **En base, en transactions annulées, sur les fonctions réellement
  appliquées** : les deux temps ci-dessus ; le compteur refusé sur les deux
  fonctions, le superviseur non participant refusé, un inventaire d'un autre
  superviseur refusé, une cible inconnue refusée ; le vidage réel de 29 382
  lignes **laissant l'autre inventaire intact** (29 389) ; `anon` sans droit
  d'exécution sur les deux. Zéro résidu contrôlé après coup — 0 ligne à la
  forme des données d'essai, total inchangé à 58 935.
- **Les gardes mordent** : les cinq assertions de code ont été rejouées contre
  la version d'avant et **échouent toutes les cinq**. Un test qui passe sans
  rien vérifier ne protège rien.
- 849 tests du site, 380 de l'application, `tsc --noEmit` des deux côtés,
  `eslint .` à **zéro erreur** (les 39 avertissements sont la famille
  `react-hooks/*` déjà documentée, aucun sur les fichiers touchés), et
  `next build` avec la même table de routes.
- **⚠️ La migration est purement ADDITIVE** : deux fonctions nouvelles, aucune
  policy ni fonction existante modifiée. Le site en ligne, qui tourne encore
  sur l'ancien code, n'en souffre pas — il reste simplement à corriger jusqu'à
  son déploiement.

**Non vérifié à l'écran** : l'onglet Set up demande une session de superviseur,
que je n'ai pas. Ce qui est prouvé, c'est que les deux chemins serveur
répondent juste et vite, et que les messages d'erreur ne peuvent plus être du
JSON. Le contrôle qui reste à Julien tient en un geste : **rouvrir « HV » et
réimporter le fichier**.

Tests de garde : `web/tests/import-gros-referentiel.test.ts`.

## Un constat ne s'affiche pas comme une erreur (3 septembre 2026)

Suite du chantier ci-dessus. L'import réussi de 29 389 articles affichait, juste
sous le vert, un encadré **rouge** : « 7318 SKU en double dans le fichier —
dernière valeur conservée ». Question de Julien : *« pourquoi j'ai cette alerte
si on peut utiliser les doublons sans problème ? »*

**Il avait raison, et le mécanisme qu'il avait en tête n'était pas en cause.**
Un SKU répété avec un EAN **différent** est bien conservé à part (règle du
25 août). Ce qui déclenchait le rouge, c'était l'autre cas : le SKU répété avec
le **même** EAN — donc la même référence listée plusieurs fois, ce qui est
l'ordinaire d'un référentiel (une ligne par emplacement). Vérifié en base sur
« HV W&J » : 29 382 EAN sur 29 389 articles, et **zéro** ligne insérée sous son
EAN, donc `keptByEan = 0`. Rien n'était perdu ; l'écran criait sur un import
parfaitement réussi.

## ⚠️ `errors` et `notes` : ce qui manque, et ce qui a été regroupé

`ImportResult` porte désormais **deux listes**, des deux côtés du produit :

- **`errors`** — ce qui n'a PAS été importé, donc ce qui appelle un geste
  (« Ligne 412 : ni SKU ni EAN — ignorée »), plus l'échec fatal côté mobile ;
- **`notes`** — ce que l'import a regroupé ou dédoublé. Aucune référence perdue.

Les trois constats qui sortaient en rouge sont passés en notes : les doublons
stricts, les lignes gardées sous leur EAN, et l'agrégation multi-emplacements du
stock.

- **⚠️ Le texte dit ce qui s'est passé, et le mot « doublon » seul a disparu**
  — il laissait croire à un défaut du fichier. Désormais : « N ligne(s)
  répètent une référence déjà vue — une seule fiche par référence, **la
  dernière ligne fait foi** ». Cette fin n'est pas décorative : c'est la seule
  conséquence réelle, si les lignes répétées portaient un libellé, une marque
  ou un prix différents.
- **⚠️ La boîte neutre ne prend JAMAIS les jetons `danger`** — un test lit le
  bloc CSS et refuse le mot. Côté mobile, même règle : `noteBox` est sur
  `t.surface` + `t.hairline`, jamais `t.dangerSoft`.
- **`--bg`, pas `--surface-2`, pour le fond de `.import-notes`** : en clair
  `--surface-2` vaut `#ffffff`, donc la boîte n'avait aucun fond sur un panneau
  blanc et ne tenait qu'à son filet. **Trouvé à l'écran, pas dans le code** —
  c'est exactement ce que la capture apporte de plus que les tests.
- Les titres disent ce qu'ils contiennent : « Lignes non importées » (rouge) et
  « À savoir » (neutre). « Lignes signalées » ne distinguait rien.
- **⚠️ Côté mobile, `errors` porte AUSSI l'échec fatal** (`errors:
  [errorMessage(e)]` dans le `catch`) : on ne pouvait donc pas simplement
  recolorer la boîte existante. Le `catch` vide désormais `notes`, sans quoi les
  constats d'un import précédent survivraient à un échec.

## ⚠️ La garde « aucun emoji » ne voyait pas les commentaires JSX

Cinquième variante du même piège sur ce dépôt, et elle méritait mieux qu'un
contournement. `codeSeul` (`tests/compte.test.ts`) filtrait **ligne à ligne** les
débuts `//`, `*` et `/*` — donc un commentaire JSX lui échappait : `{/* … */}` ne
commence par aucun des trois, et ses lignes du milieu ne commencent par rien de
reconnaissable. Un `⚠️` posé dans un commentaire d'écran faisait échouer un test
qui vérifie ce que l'écran **affiche**.

Elle retire maintenant les blocs `/* … */` et `{/* … */}` **d'un coup**, avant
de filtrer les `//`. Vérifié dans les deux sens : un emoji remis dans du vrai
JSX la fait toujours échouer.

## Vérifications

- 853 tests du site (dont 5 nouveaux), 380 de l'application, `tsc --noEmit` des
  deux côtés, `eslint .` à zéro erreur, `next build` avec la même table de
  routes.
- **Au navigateur, clair ET sombre**, par route jetable (retirée, `git status`
  contrôlé) : les trois boîtes ensemble, puis le cas de Julien seul — vert +
  neutre, aucun rouge. Débordement horizontal nul, aucune erreur de console.
- ⚠️ **Piège de méthode** : une route jetable survit dans `.next/dev/types`
  après un `next dev`, et le `next build` suivant échoue sur un module
  introuvable. Ce n'est pas une régression — `rm -rf .next` avant de conclure.
- **Non vérifié à l'écran** : l'écran mobile d'import, qui demande une session
  de superviseur sur le téléphone. Le rendu est tenu par le test qui compare
  `noteBox` à `t.surface`.

Tests de garde : `web/tests/import.test.ts`, bloc « un constat ne s'affiche pas
comme une erreur ».
