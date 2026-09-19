# Le hors ligne : trois trous sur l'écran de comptage (2 septembre 2026)

Constat de Julien, captures à l'appui sur **les deux plateformes** : scanner un
article inconnu en mode avion répondait « Erreur — fetch failed »
(`java.net.UnknownHostException` sur Android, « The Internet connection appears
to be offline » sur iOS). La revue du hors ligne demandée dans la foulée en a
sorti deux autres, dont un qui corrompt des données.

## 1. « Article inconnu » n'était pas dans la couche hors ligne

`scanner.tsx` importait `insertArticle` de `@/lib/queries` — **la seule écriture
du comptage restée en dehors de `@/lib/offlineSync`**. Toutes les autres
(comptage, ouverture et clôture de balise) y étaient depuis le premier jour.

Il vient donc de `offlineSync`, avec le motif habituel : serveur si possible,
file d'attente sinon, et **le cache local mis à jour dans les deux cas**.

- **⚠️ Un genre d'opération de plus dans la file** (`kind: 'article'`), rangé
  dans la tranche de **sa balise**, avant le comptage qui le suit. `counts` ne
  référence pas `articles` — rien ne l'exige — mais le rapport lit le libellé
  dans `articles` : un comptage arrivé seul s'afficherait sous une référence
  nue.
- **⚠️ `ean_norm` ne part JAMAIS dans la charge.** C'est une colonne générée
  STORED (`NULLIF(ltrim(ean,'0'),'')`) : Postgres refuse toute écriture dessus.
  Un article mis en file avec cette clé serait rejeté à la synchronisation —
  donc perdu — sans que rien à l'écran ne le laisse deviner. `enqueueArticle`
  la retire ; `eanNorm()` la recalcule pour la **copie en cache**, qui est ce
  qui permet de retrouver un EAN dont Excel a mangé les zéros de tête.
- **⚠️ `primeOfflineCache` réécrit le référentiel en entier** à chaque entrée
  sur l'écran de scan. Sans relecture de la file, un article saisi en réserve
  disparaissait du cache à la première barre de réseau, et le code redevenait
  inconnu pendant que son comptage attendait toujours. Les articles en attente
  sont donc rajoutés — **en une seule écriture**, pas une par article : le
  cache se réécrit à chaque appel, boucler dessus coûterait le carré.
- **⚠️ Et le cache sert de repli MÊME EN LIGNE**, quand le serveur ne connaît
  pas le code. C'est la fenêtre entre la création en réserve et la remontée :
  sans ce repli, retrouver du réseau rouvrait « Article inconnu » sur un code
  qu'on venait de saisir, et une seconde saisie fabriquait un doublon dans la
  file. **Trouvé par le test, pas à l'écran** (`tests/offlineSync.test.ts`) —
  c'est ce qui justifiait d'écrire un test sur le vrai module de bascule.
- L'identifiant est tiré côté client : la copie en cache et la ligne qui
  arrivera en base portent le même `id`, et un renvoi retombe sur la clé.

## 2. Le serveur refusait cet article à un compteur — même en ligne

`articles` n'avait que deux policies : lecture pour les membres de
l'inventaire, écriture (`FOR ALL`) pour les seuls **superviseurs**. Un compteur
qui remplissait « Article inconnu » recevait `42501`. Vérifié en base, session
simulée, transaction annulée.

Autrement dit, **la fonctionnalité était inatteignable pour le rôle à qui elle
est destinée**, et rien à l'écran ne l'expliquait. Le hors ligne n'a fait que
déplacer l'échec : la file l'aurait envoyée au retour du réseau, et le serveur
l'aurait refusée.

Migration `20260902100001`, policy `articles_insert_member`, **trois bornes** :

- **INSERT seulement.** Un compteur ajoute ce qui manque ; il ne récrit ni
  n'efface le fichier importé par le superviseur. `articles_supervisor` reste la
  seule policy `ALL`, et l'unicité `(session_id, sku)` empêche de remplacer un
  article existant par une insertion.
- **Inventaire ouvert**, comme `counts_insert_member`.
- **⚠️ Prix d'achat à zéro.** Un compteur constate une **présence**, pas une
  valeur : la valorisation vient du fichier du superviseur. Sans cette borne,
  n'importe quel membre poserait un prix arbitraire sur une référence qu'il
  invente et gonflerait l'« écart valeur » du rapport. C'est exactement ce que
  la modale envoie — elle n'a pas de champ prix. Un champ prix ajouté un jour
  serait donc refusé en 42501 : le changer suppose de changer la policy.

Vérifié en base, transactions annulées, sept cas : sa session à prix nul passe ;
prix non nul, inventaire d'un autre et inventaire clôturé sont refusés ; UPDATE
et DELETE touchent zéro ligne ; le rejeu du même SKU rend 23505, que la file
traite comme « déjà passé ». Zéro résidu contrôlé.

## 3. ⚠️ La liste d'une balise gardait celle de la balise précédente

Le plus grave des trois, et il écrit de fausses données. L'effet qui réamorce la
liste appelait `getMyScanEntries` en direct, avec
`.catch(() => { /* liste vide si erreur */ })` — **qui ne vidait rien**. Sans
réseau, passer de la balise A à la balise B laissait donc les scans de A
affichés sous B. Or ce sont ces lignes que les boutons « + / − » corrigent : un
« − » posé là écrivait une correction négative **dans B** pour un article compté
en A.

`getScanEntries` (offlineSync) remplace l'appel : réponse du serveur **plus** ce
qui attend en file, et l'échec vide pour de bon.

- **La file est ajoutée dans les deux cas, pas seulement hors ligne.** Au retour
  du réseau une partie des scans est déjà partie et l'autre attend encore ;
  n'afficher que le serveur ferait clignoter la liste entre les deux.
- Le libellé d'une ligne en attente vient du **cache local** — c'est là que
  vivent aussi les articles créés en réserve, qui n'existent encore nulle part
  ailleurs.
- Une référence entièrement corrigée (net nul ou négatif) quitte la liste, comme
  côté serveur.

**Au passage** : `(supervisor)/[sessionId]/scan.tsx` lisait encore `getSession`
depuis `@/lib/queries`, là où l'écran du compteur passait par le cache. Hors
ligne, `if (!session) return null` laissait donc **l'écran blanc** à un
superviseur qui compte lui aussi en réserve. Les deux écrans sont désormais
alignés — un test les compare.

## Vérifications

- **En base**, sur les fonctions et policies réellement appliquées : les sept
  cas de la policy, en transactions annulées, zéro résidu.
- **En Node, sur les vrais modules** : `tests/offlineSync.test.ts` fait tourner
  `offlineSync.ts` avec un faux serveur qu'on met en panne — coupure constatée
  au premier code, article mis en file, rescan qui le retrouve, retour du réseau,
  article puis comptage envoyés dans cet ordre, `ean_norm` absent de la charge,
  seconde synchro à vide. C'est ce test qui a trouvé le défaut du repli en ligne.
- **Au simulateur** : l'application se construit, s'ouvre et restaure sa session
  (les nouveaux imports se résolvent).
- **⚠️ NON VÉRIFIÉ appareil en main** : le mode avion. Un simulateur partage le
  réseau du Mac, et les données du compte de démonstration servaient à une autre
  session — je n'ai pas voulu y écrire un article d'essai. C'est le scénario que
  Julien a lui-même joué pour trouver le défaut : c'est à lui qu'il revient,
  après reconstruction des deux applications.

Tests de garde : `tests/offlineSync.test.ts`, `tests/offline.test.ts` (bloc « un
article créé hors ligne ») et `tests/comptage.test.ts` (blocs « “Article
inconnu” passe par la couche hors ligne », « un compteur peut créer l'article
qu'il scanne » et « la liste des scans se reconstruit hors ligne »).
