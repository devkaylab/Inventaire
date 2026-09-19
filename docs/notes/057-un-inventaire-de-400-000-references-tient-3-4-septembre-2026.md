# Un inventaire de 400 000 références tient (3–4 septembre 2026)

Julien, après une matinée d'inventaire ratée chez un client : *« un inventaire
peut se faire avec la participation d'une centaine de participants, sur un
magasin avec plus de 500 000 unités, pour plus de 400 000 références […]
N'invente pas et vérifie réellement et sois honnête sur les limites de
l'app. »*

Deux journées de mesures et de corrections. Le compte rendu chiffré vit dans
`docs/exploitation/mode-demploi.md` §1 ; ce qui suit est ce qu'il ne faut pas
défaire.

## ⚠️ LE PLAFOND EST 8 SECONDES, ET IL DÉCIDE DE TOUT

Le rôle `authenticated` porte un `statement_timeout` de **8 s** (relevé sur
`pg_roles`, pas supposé). Toute requête plus longue est tuée et l'écran affiche
une erreur. C'est **le** chiffre à avoir en tête avant d'écrire une fonction
qui balaie un inventaire.

**Peut-on le relever ? Oui, et on le fait déjà — sélectivement.**
`recompute_session_audit` s'accorde 60 s, parce que son premier calcul est long
par nature et n'arrive qu'une fois par inventaire. **Jamais globalement** :

- c'est un **fusible**, pas un mur. Une requête lente occupe une des 90
  connexions pendant tout ce temps ; relever le plafond transforme « un écran
  tombe en erreur » en « le site rame pour tout le monde » ;
- 8 s dépasse déjà ce qu'un humain attend — on échangerait une erreur franche
  contre une attente inutile ;
- c'est le réflexe « monter le serveur » sous un autre nom. **Le plafond n'a
  jamais été la cause : il révèle du travail inutile.**

La bonne forme, pour une opération longue par nature : un `set
statement_timeout` **sur cette fonction-là**.

## ⚠️ LA RÈGLE QUI GOUVERNE TOUT CE CHANTIER

> **Le travail du serveur doit dépendre de ce qu'on AFFICHE, pas de la taille
> de l'inventaire.**

Un écran de 50 lignes doit coûter le prix de 50 lignes, que l'inventaire en
compte 500 ou 500 000.

Les facteurs mesurés, sur le même écran, disent lequel des deux leviers
compte :

| | Facteur gagné |
|---|---|
| Monter la machine (Micro → Small) | **×1,3** |
| Ne charger que 50 lignes au lieu de 400 000 | **×30** |
| Ne pas refaire un calcul déjà fait (l'empreinte) | **×80** |

**Ne pas répondre « il faut monter le serveur » à un écran lent.** La machine
achète de la marge, elle ne change pas d'ordre de grandeur. Elle compte, en
revanche, pour la **concurrence** — 90 connexions au lieu de 60, deux fois le
cache — et c'est le seul argument qui tienne pour le Small.

## Le tableau des balises (`get_zone_dashboard`, `20260903170001`)

Il est tombé **en 500 en production** pendant la mesure. C'est l'appel le plus
fréquent du produit : le tableau de bord **et** l'écran de comptage de chaque
téléphone, rejoué à chaque ouverture et à chaque clôture de balise.

- **⚠️ `auth.uid()` était appelée PAR LIGNE**, dans quatre `filter (...)`. Elle
  est lue **une fois** dans une variable (`v_moi`). Piège Supabase classique :
  le planificateur ne remonte pas un appel de fonction placé dans un agrégat.
- **⚠️ Les quatre `count(distinct sku)` forçaient un tri global** qui débordait
  sur disque. Remplacés par une agrégation par `(zone, sku, passe)` puis un
  simple `count(*)`. **6 225 → 1 916 ms**, sortie identique (501 balises
  d'essai, 70 réelles).
- Index `counts_session_zone_sku_pass_idx (session_id, zone, sku, pass_number)`.
- Le plafond de 8 s passe d'environ **1,1 à 3,7 millions de comptages**.

## La pagination (`20260903190001`, `…200001`, `…210001`)

Le Rapport et les Écarts rendaient 400 000 lignes d'un coup. Ils en lisent
**50 à la fois**, recherche, tri et totaux calculés en base.

- **⚠️ L'EXPORT CONTIENT TOUJOURS TOUT.** C'est ce que le client reçoit : le
  navigateur parcourt les pages par tranches de 5 000 et assemble le fichier.
  Ne jamais « simplifier » l'export en le limitant à la page affichée.
- **⚠️ Les totaux portent sur l'inventaire ENTIER**, jamais sur la page. Des
  tuiles qui changeraient en tournant les pages ne voudraient rien dire.
- **⚠️ L'ORDRE DOIT ÊTRE TOTAL** — le SKU départage toujours. Sans lui, deux
  lignes de même valeur changent de place entre deux pages : on en voit une
  deux fois et une autre jamais. C'est le piège classique de la pagination, et
  il ne se voit qu'en production.
- **⚠️ Deux ordres différents, et c'est voulu** : le site range par balise (on
  relève méthodiquement), **le téléphone met en premier ce qui reste à
  trancher** (`p_ordre = 'a_traiter'`) — quelqu'un debout dans un rayon veut le
  travail qui reste. Tant que tout tenait dans une réponse, chacun triait chez
  lui ; avec la pagination l'ordre décide du CONTENU de la page, donc il vient
  du serveur.
- **⚠️ Le périmètre reste fixé par le serveur** : une page ne dépasse pas
  5 000 lignes quoi que demande l'appelant. Sans ça on redemande les 400 000
  par la porte de derrière.
- **La règle qui décide ce qui est un écart est passée EN BASE**, clause par
  clause : elle avait besoin de toutes les lignes pour trancher, donc elle ne
  pouvait pas paginer depuis le navigateur.

## ⚠️ Les gros écrans n'assemblent plus l'univers des articles (`20260904120001`)

Constat de Julien avec deux inventaires de 400 000 références en base : le
tableau de bord d'atterrissage **ne se rafraîchit plus**. Reproduit :
`tableau_de_bord_superviseur` mettait **8 459 ms**. Dont **5 767** à fabriquer
l'univers des SKU — une union de 800 000 lignes, triée et dédoublonnée **sur
disque** — pour rendre un anneau à cinq parts.

- **⚠️ L'ÉCART D'UN INVENTAIRE SE DÉCOMPOSE.**
  `Σ (compté − théo) × prix = Σ compté×prix − Σ théo×prix`. Chaque terme est
  **une** jointure et **une** somme : plus d'univers, plus de tri. C'est une
  identité arithmétique, pas une approximation — vérifiée **identique au
  centime** sur les quatre inventaires réels et deux jeux de 400 000
  références. → **8 459 → 3 438 ms**.
- **⚠️ L'univers du Rapport est une JOINTURE EXTERNE COMPLÈTE, pas une union.**
  Lui a besoin d'une ligne par SKU, donc pas de décomposition possible — mais
  `théorique ∪ compté` puis trois jointures gauches, c'est ce que fait un
  `full join` entre deux ensembles déjà uniques par SKU, en une passe.
  → `rapport_page` **3 358 → 2 336 ms**, `rapport_resume` **3 051 → 1 969 ms**.
- **⚠️ LE FILTRE D'INVENTAIRE SE POSE AVANT LA JOINTURE, JAMAIS DANS LE `ON`.**
  Dans un `full join`, une condition du `on` ne filtre pas : elle décide de
  l'appariement, et les lignes des **autres** inventaires ressortent du côté
  externe. Essayé : 800 156 lignes au lieu de 400 000. D'où la CTE `theo`, qui
  filtre d'abord. Le même piège avait déjà fait croire à une régression la
  veille, dans un test.
- **⚠️ LE TRI FINAL N'ÉTAIT PAS LE COUPABLE** — c'est un « top-N heapsort » de
  31 ko. Tout le coût était dans l'assemblage. **Mesurer avant de conclure
  qu'il faut un index de tri** : la première hypothèse, annoncée à Julien,
  était fausse.
- **Un défaut trouvé en PROUVANT l'équivalence** : deux inventaires à égalité
  à 0,00 € sortaient dans un ordre différent d'une exécution à l'autre — donc
  la cinquième part de l'anneau changeait d'inventaire. Antérieur à la
  réécriture ; corrigé par un départage (`, f.id`). Même règle que la
  pagination : **un ordre doit être total.**
- **Écarté, et pourquoi** : monter `work_mem` sur ces fonctions gagne encore
  ~200 ms, pour 100 à 300 Mo de mémoire par requête sur une machine qui en a
  2 Go, avec 90 connexions possibles. **Le gain ne vaut pas le risque** ; la
  réécriture, elle, ne coûte rien.

## On est prévenu avant le client (`20260903180001`, `…180002`)

Quantinvo est en **libre-service** : le client lance ses inventaires quand il
veut, sans nous prévenir. Rien ne s'anticipe. Le tour de garde pose donc une
**troisième** question toutes les heures : *un inventaire s'approche-t-il de ce
que le produit tient ?* E-mail **et** cloche, à deux repères — **150 000
références** (à l'import, souvent des jours avant) et **400 000 comptages**
(pendant le comptage).

- **Il ne se répète pas** : un gros inventaire le reste jusqu'à sa clôture, et
  le redire chaque matin ferait qu'on cesse de le lire.
- **⚠️ Le message se compose par NATURE** (`paiement`, `purge`, `volume`) :
  un texte unique ferait dire « un paiement sans suite » à propos du ménage.
- **⚠️ Défaut trouvé en le testant pour de vrai : la cloche restait muette
  pendant que l'e-mail partait.** DEUX filtres refusaient le type
  `inventaire_volumineux` — la contrainte `notifications_type_check` **et** la
  liste blanche de `mes_notifications`. Ajouter un type de notification
  demande de toucher les deux.
- Les seuils vivent dans la migration, et nulle part ailleurs.

## Lire un long tableau sans se tromper (4 septembre 2026)

Trois constats de Julien sur l'inventaire de démonstration.

- **⚠️ SANS RÉSUMÉ, LES TUILES ÉCRIVENT « — », JAMAIS « 0 ».** Quand le calcul
  dépassait le délai, elles retombaient à zéro : *« c'est juste écrit 0 écart,
  si le client n'attend pas, il pourrait crier victoire alors qu'en réalité ça
  load »*. Un zéro se lit comme un résultat. Un échec de calcul s'affiche
  désormais avec de quoi réessayer.
- **L'attente se DIT** (`.chargement-note`, une ligne + une roue) : une
  ossature grise muette ressemble à une page vide.
- **⚠️ LES BOUTONS DE PAGE SONT EN HAUT AUTANT QU'EN BAS.** Sur un écran de
  14 pouces — la taille de travail habituelle — cinquante lignes passent sous
  le pli et ceux du bas restent hors de vue. Composant unique
  (`components/ui/Pagination.tsx`), rendu deux fois.
- **Changer de page ramène le haut du tableau sous les yeux**
  (`useRetourEnHaut`), **jamais au premier rendu** : on ferait sauter la page
  de quelqu'un qui vient d'arriver sur l'onglet.

## Les nombres se lisent (4 septembre 2026)

- **⚠️ SÉPARATEUR DE MILLIERS PARTOUT.** *« 1000 > 1 000, plus facile à
  lire. »* Ce n'est pas un ornement : la colonne des quantités porte des
  nombres à cinq ou six chiffres, et « 128400 » ressemble à « 12840 » au coup
  d'œil — à l'endroit précis où l'on cherche un écart. Site : `fmtQty`,
  `plural`, `nb`. Application : **`src/lib/nombres.ts`**, qui remplace les deux
  copies de `fmt` qui vivaient chacune dans son écran.
- **⚠️ AFFICHAGE SEULEMENT.** Ni l'import, ni l'export, ni une valeur envoyée
  en base : `toLocaleString` insère une espace **insécable étroite** (U+202F)
  qu'aucun tableur ne relit comme un chiffre. Un test balaie `src/` pour l'un
  et l'autre point.
- **⚠️ La locale est TOUJOURS nommée.** `toLocaleString()` nu suit la langue du
  téléphone — « 1,000 » sur un appareil anglais, au milieu d'une interface en
  français. Un test l'interdit dans tout `src/`.
- **Les montants du tableau de bord s'abrègent en k€** à partir de 1 000
  (`moneyCourt`), **avec le chiffre exact au survol** — un montant arrondi
  qu'on ne peut pas déplier est un montant faux. **Jamais les pièces**, qui se
  comptent.
- ⚠️ Piège de test : comparer à une chaîne tapée au clavier échoue, avec un
  message où les deux valeurs **paraissent identiques**. Normaliser
  les deux espaces invisibles — `U+202F` (insécable étroite, celle que pose
  `fr-FR`) et `U+00A0` — avant d'assertir.

## La concurrence, enfin mesurée (4 septembre 2026)

C'était le trou de ce chantier : toutes les mesures étaient faites **une
requête à la fois**, et « cent compteurs en même temps » restait de
l'arithmétique. Julien : *« Et tu ne peux pas faire ce test ? »*

**⚠️ LE BANC PASSE PAR `pg_cron`, ET C'EST LE POINT DE MÉTHODE À RETENIR.**
`cron.use_background_workers` vaut `off` sur ce projet : chaque tâche ouvre
**une vraie connexion**, donc N tâches programmées à la même minute donnent N
requêtes réellement simultanées. `cron.max_running_jobs = 32` fixe le plafond
du banc. Rien à installer.

- **⚠️ NE PAS INSTALLER `dblink` POUR ÇA.** Il est disponible et il ferait le
  travail — mais c'est une porte de connexions sortantes ouverte en
  production, la famille de `pg_net`. Le gain ne vaut pas la surface.
- **Chaque tâche se désinscrit elle-même** (`cron.unschedule` en second
  ordre), **et** un nettoyage explicite balaie `charge-%` derrière. Une tâche
  de test oubliée tourne toutes les heures, indéfiniment.
- Table de résultats et fonctions de banc **révoquées** à `anon` et
  `authenticated` le temps de leur existence, puis supprimées.
- Rester **loin du plafond de connexions** : 19 étaient déjà prises sur 60,
  donc 32 au maximum. Saturer `max_connections` sur la base de production
  rendrait le site indisponible.

### Ce que ça donne, sur `get_zone_dashboard` (l'appel le plus fréquent)

**Inventaire de 400 000 références** — le pire cas :

| Simultanés | Réponse | Débit |
|---|---|---|
| 1 | 1 649 ms | 0,6 /s |
| 5 | 3 154 ms | 1,57 /s |
| 10 | 5 840 ms | 1,67 /s |
| 20 | **11 881 ms** | 1,65 /s |

**Inventaire de taille réelle** (30 000 références, 400 balises) :

| Simultanés | Réponse | Débit |
|---|---|---|
| 1 | 174 ms | 5,7 /s |
| 20 | 651 ms | 25,2 /s |
| 32 | 1 063 ms | 23,0 /s |

**⚠️ LE DÉBIT EST PLAT, ET C'EST TOUTE LA LEÇON.** 1,65 appel/s sur le gros
inventaire, 24/s sur un inventaire normal — quel que soit le nombre de gens.
La machine a deux cœurs ; au-delà, chaque personne de plus ne fait
qu'**attendre son tour**, et le temps de réponse monte en ligne droite.

Conséquences, en clair :

- **Sur un inventaire normal, 100 compteurs passent** : ≈ 4,2 s si tous
  appuyaient à la même seconde, et en réalité une centaine de compteurs
  produit ~2 appels/s, soit **8 % de la capacité**.
- **⚠️ Sur un inventaire de 400 000 références, le 13e appel simultané dépasse
  déjà les 8 s** et l'écran tombe en erreur. Mesuré : 11,9 s à vingt. **Le mur
  n'est pas le nombre de compteurs, c'est la taille de l'inventaire.**

### L'écriture n'est pas le problème, et c'est maintenant prouvé

32 compteurs simultanés, 10 scans chacun, **RLS active** (le chemin réel d'un
téléphone) : **320 écritures en 774 ms, soit 413 scans/seconde, zéro erreur.**

Cent compteurs à six scans par minute font 10 écritures/s — **2,4 % de cette
capacité**. Le chiffre de 3 ms par scan, mesuré en solo depuis le 3 septembre,
tient sous contention. Ne pas chercher le problème de ce côté.

## Le catalogue hors ligne ne part plus en entier (4 septembre 2026)

Julien, après la mesure de charge : *« ne télécharger que ce dont chaque
compteur a besoin »*. C'était le seul point que la mesure désignait comme un
vrai risque, et le seul hors de notre contrôle : le wifi du magasin.

**Mesuré avant d'agir** : chaque téléphone téléchargeait **304 octets par
référence**, à chaque ouverture de l'écran de comptage — 8,9 Mo pour 30 000
références, **116 Mo pour 400 000**. Cent compteurs, 11,6 Go.

Deux leviers, une seule fonction nouvelle (`20260904160001`) :
**304 → 110 octets, soit −64 %**, et **zéro octet quand rien n'a changé**.

- **⚠️ Le serveur n'envoie plus que ce que le scanner LIT** — `sku`, `ean`,
  `label`, `brand`, `prix`. Vérifié champ par champ dans `src/` avant de
  retirer quoi que ce soit : l'identifiant interne, celui de l'inventaire et
  la date de modification ne sont jamais lus d'un article téléchargé, et le
  code-barres partait **en double** (brut et normalisé).
  · **Le NOM des colonnes compte** : `unit_purchase_price` pèse 21 octets
    **par ligne** dans le JSON, `prix` en pèse 6. Sur 400 000 lignes, 6 Mo.
  · `ean_norm` se recalcule sur le téléphone. **⚠️ Les deux copies clientes
    doivent reproduire la colonne générée mot pour mot** (`NULLIF(ltrim(ean,
    '0'), '')`) — sinon un code scanné ne retrouve plus son article. Un test
    les compare.
  · **⚠️ Un article téléchargé n'a pas d'identité locale** (`id: ''`). Seuls
    ceux créés en réserve en ont besoin, pour partir dans la file.
- **⚠️ Le repère se prend AVANT la pagination.** Ce qui change pendant qu'on
  tourne les pages porte une date postérieure : ce sera pour le passage
  suivant, et rien n'est perdu. L'ordre inverse ouvrirait un trou.
- **⚠️ `p_depuis` compare en STRICTEMENT SUPÉRIEUR.** Un import écrit toutes
  ses lignes dans une seule transaction, donc avec le même `updated_at` : un
  `>=` les redemanderait **toutes** à chaque passage et le levier ne servirait
  plus à rien.
- **⚠️ ET LE DÉCOMPTE RATTRAPE LES SUPPRESSIONS.** C'est la moitié qu'on
  oublie : une date de modification ne dit **rien** d'une ligne effacée — et
  remplacer un fichier d'import en efface. Le téléphone compare ce qu'il croit
  connaître au total du serveur ; au moindre écart il retélécharge tout. Sans
  ça, le cache garderait des fantômes et un code scanné se résoudrait sur un
  article que le référentiel ne contient plus. C'est aussi ce qui ferme le
  trou théorique du `>` (deux transactions à la microseconde près).
- **⚠️ Les articles saisis en réserve sont écartés du décompte** : ils sont
  dans le cache et pas encore en base. Les compter ferait diverger le total à
  chaque saisie manuelle, donc retélécharger pour rien.
- **⚠️ `lister_articles` N'EST PAS TOUCHÉE**, et l'ancienne enveloppe
  `getSessionArticles` non plus : les téléphones déjà sur le terrain les
  appellent. Règle du projet — le code se déploie d'abord, l'objet se retire
  ensuite. À supprimer quand le build de septembre sera partout.

**Ce qui a été écarté, et pourquoi** : découper le catalogue par rayon. Un
compteur peut être envoyé sur n'importe quelle balise — s'il n'a que son rayon
en poche, le premier article scanné ailleurs devient « inconnu ». C'est la
fonction même du cache qui tombe.

Tests de garde : `tests/offlineSync.test.ts` (le delta, la suppression, la
saisie en réserve, sur le VRAI module) et `tests/compte.test.ts`.

## Dix inventaires de cette taille (4 septembre 2026)

Question de Julien : *« si demain on en a dix de cette ampleur, tout plante
non ? »* Réponse mesurée : **non, ce n'est pas la vitesse qui casse — c'est la
place.** Trois constats, dans l'ordre où ils comptent.

### 1. Les écrans NE ralentissent PAS, et c'est contre-intuitif

Chaque écran travaille sur **un seul inventaire**, et les quatre grosses
tables ont toutes un index qui commence par `session_id`. Aujourd'hui le
moteur balaie parfois la table entière — uniquement parce qu'un inventaire de
démonstration en représentait **la moitié**. À dix inventaires, il n'en
représente plus qu'un dixième et le planificateur bascule sur l'index.

Vérifié en le forçant (`set enable_seqscan = off`) :

| Écran, sur 400 000 réf. | Balayage | Par index |
|---|---|---|
| Rapport — les totaux | 2 767 ms | **2 593 ms** |
| Rapport — une page | 2 966 ms | **2 707 ms** |
| Tableau des balises | 1 649 ms | **1 442 ms** |

**Aussi rapide, voire un peu plus.** Le travail dépend de l'inventaire qu'on
regarde, pas de ce qu'il y a à côté — la règle du chantier tient ici aussi.
**Ne pas répondre « il faut monter le serveur » à cette question-là.**

### 2. ⚠️ LE MUR EST LA PLACE, ET RIEN N'EFFACE JAMAIS UN INVENTAIRE

Un inventaire de 400 000 références pèse **~680 Mo** (comptages, articles,
stock théorique, audit, et leurs index). Dix font **~6,8 Go**, pour un disque
de l'ordre de 8 Go. Et quand un disque Postgres se remplit, ce n'est pas un
ralentissement : **la base refuse d'écrire**, l'inventaire s'arrête.

**⚠️ `purge_expired_data` ne touche AUCUNE table d'inventaire** — vérifié, elle
ne nettoie que les demandes, invitations, journaux, notifications et
événements Stripe. Les 635 000 lignes de scan d'un inventaire clôturé il y a
deux ans sont toujours là, entières.

Ce n'est pas un défaut : c'est **une décision jamais prise**. Combien de temps
garde-t-on le détail brut d'un inventaire clôturé ? Le rapport et les écarts
font foi et doivent rester ; les scans qui les ont produits, un an après, sont
une autre question — et elle a un versant RGPD, ces lignes portant qui a
compté quoi.

### 3. ⚠️ SUPPRIMER NE REND PAS LA PLACE — le constat qui change le plan

Les deux inventaires de démonstration supprimés, la base **ne bougeait pas
d'un octet** : 1 382 Mo avant, 1 382 Mo après. Postgres marque les pages
réutilisables, il ne les rend pas.

| Étape | Base |
|---|---|
| Avant suppression | 1 382 Mo |
| Après le `DELETE` | **1 382 Mo** |
| Après `VACUUM ANALYZE` | 976 Mo |
| Après `VACUUM FULL` | **25 Mo** |

Le plus parlant : après le ménage ordinaire, `counts` occupait encore
**470 Mo pour 165 lignes** — ce sont les index qu'un `VACUUM` simple ne
compacte pas.

- **⚠️ `VACUUM ANALYZE` n'est PAS optionnel après une grosse suppression.** Le
  planificateur croyait encore à 1,27 million de lignes dans `counts` : il
  aurait choisi des plans faits pour un volume disparu.
- **⚠️ `VACUUM FULL` prend un verrou exclusif** : la table est inutilisable
  pendant la réécriture, et il lui faut autant d'espace libre que la table
  qu'il refait. Sur des tables devenues minuscules c'est instantané ; sur un
  vrai gros inventaire en production, **c'est une opération à programmer, pas à
  lancer un matin d'inventaire**.
- **La conséquence pour la facturation** : le coût de stockage suit le
  **point haut**, pas l'usage courant. Un client qui fait un énorme inventaire
  une fois relève le plancher pour de bon, à moins d'un `VACUUM FULL`
  programmé.

### ⚠️ Ce que ça ouvre côté commercial — DIRECTION, PAS DÉCISION

Julien, à la lecture de ce qui précède : *« on va certainement prendre ces
deux cas pour mettre des critères de subscription. Faire payer les plus gros
consommateurs, un peu comme avec l'IA et le token, crédit. »*

**« Certainement » : c'est une direction.** Rien n'est arrêté, rien n'est à
construire. Ce qui suit sert le jour où le sujet est relancé — et surtout,
quatre pièges déjà payés par le projet.

- **⚠️ LA BASE DE FACTURATION NE CHANGE PAS.** Le 30 août 2026 a tranché : on
  facture **les appareils qui comptent**, et le volume de stock a été
  explicitement écarté comme assiette. Ce qui se discute ici est un
  **plafond**, un dépassement — pas un retour au volume comme base. Confondre
  les deux, c'est défaire une décision documentée.
- **⚠️ LE PLAFOND DOIT ÊTRE SOUPLE.** Règle déjà posée pour l'offre Solo : un
  dépassement ne bloque **jamais** un comptage en cours ni la lecture d'un
  rapport. Au pire, il refuse la **création d'un nouvel inventaire**, et il
  prévient. On ne coupe pas un magasin un soir de comptage.
- **⚠️ LA MESURE NE DOIT PAS SE DÉCOUPER.** Constat de Julien du 27 août : un
  client contournerait un plafond par fichier en scindant son stock en cinq
  petits inventaires. D'où la mesure retenue à l'époque — **les pièces
  comptées, agrégées sur 30 jours glissants**. La même prudence vaut pour
  toute nouvelle mesure.
- **⚠️ LA PLACE EST LA SEULE MESURE QUI COÛTE VRAIMENT, ET ELLE NE REDESCEND
  PAS TOUTE SEULE.** C'est l'apport du jour : ~680 Mo par inventaire de
  400 000 références, jamais purgés, et un disque qui ne se rétracte qu'à la
  main. Si un critère de stockage entre dans la grille, il doit venir **avec**
  une politique d'archivage — sinon on facture une place qu'on ne sait pas
  reprendre.

Les deux faits chiffrés à reprendre le jour venu : **680 Mo par inventaire de
400 000 références**, et **le plafond de 8 s atteint à 13 personnes
simultanées sur un inventaire de cette taille** (contre une centaine sur un
inventaire normal). Ce sont eux qui décrivent « un gros consommateur ».

## Ce qui n'est TOUJOURS pas prouvé

Dit explicitement, parce qu'une absence de constat ne vaut que si on sait ce
qui n'a pas été regardé.

- **⚠️ Le banc mesure la BASE, pas la chaîne complète.** PostgREST et son pool
  de connexions, le réseau, le canal temps réel : rien de tout cela n'est dans
  ces chiffres. La base est le terme dominant, ce n'est pas le seul.
- **L'import d'un fichier de 400 000 lignes** depuis le navigateur.
- **Le trafic sortant** : chaque téléphone télécharge le catalogue entier.
- Le jeu d'essai portait **8 compteurs distincts**, pas 100 — la concurrence
  est prouvée, la diversité des comptes ne l'est pas.

## Les inventaires de démonstration (supprimés le 4 septembre 2026)

« DEMO 400 000 references » et son jumeau sur La Samaritaine ont servi à tout
ce qui précède, puis ont été supprimés à la demande de Julien. Deux choses à
retenir d'eux.

⚠️ **Un jeu d'essai se pose sur le compte de qui va le regarder.** Le premier
avait été créé sur le compte de démonstration : invisible depuis le compte de
Julien, qui a cherché son inventaire dans une liste qui ne pouvait pas le
contenir.

⚠️ **ET SUPPRIMER NE REND PAS LA PLACE** — voir la section suivante, c'est le
constat le plus utile de la journée.
