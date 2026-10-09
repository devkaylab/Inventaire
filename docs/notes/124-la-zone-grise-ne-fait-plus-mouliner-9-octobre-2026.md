# ⚠️⚠️ La zone grise ne fait plus mouliner — 9 octobre 2026

Julien, depuis le terrain :

> « Le mode hors ligne fonctionne parfaitement et j'en suis satisfait. En
> revanche ce qui me fait peur ce sont les zones fantômes où le téléphone pense
> avoir du réseau alors qu'en fait ça ne capte pas bien. Ça affiche 5G mais en
> réalité il n'y a rien qui se passe, donc le téléphone mouline. […] J'ai
> l'impression que l'app a besoin du réseau dès que je scanne, et en cas où ça
> capte mal c'est frustrant. »

**Les deux impressions étaient exactes.** Mesuré avant de proposer quoi que ce
soit.

## Ce qui n'allait pas, et qui n'était pas le hors ligne

Le hors ligne lui-même est bon, et il le dit. Trois constats :

**1. L'app ne regarde jamais l'état du réseau.** Aucun module de connectivité,
et c'est un choix écrit : « ce qui compte est de joindre Supabase, pas d'avoir
une barre de signal ». Le raisonnement est juste — un hotspot capté sans route
vers Internet est hors ligne pour nous, et une API de connectivité dirait le
contraire. Mais il suppose que l'échec arrive **vite**.

**2. Aucun délai d'attente, nulle part.** Pas un `AbortController` dans tout
`src/`. L'app attendait donc celui d'iOS, qui se compte en dizaines de secondes.
C'est ça, la mouline — et elle frappait **au premier scan**, avant que
`offlineSync` ne bascule. (La lenteur *répétée* avait déjà été corrigée : une
fois hors ligne, l'app cesse d'essayer à chaque code.)

**3. Oui, chaque scan passait par le réseau** — deux fois même : une lecture
pour résoudre le code, une écriture pour le comptage. Or le catalogue est
**entier sur le téléphone**, téléchargé en delta et réconcilié par
`primeOfflineCache` à l'ouverture de l'écran.

## Ce qui a été fait, et ce qui ne l'a PAS été

### A — un budget d'attente, à deux étages

- **`DELAI_INTERACTIF_MS` = 2,5 s** sur les trois appels qu'un compteur attend,
  caméra en main : résoudre un code, enregistrer un comptage, ouvrir ou clôturer
  une balise. Au-delà, c'est une panne de son point de vue, quelle que soit la
  vérité du réseau.
- **`DELAI_DE_FOND_MS` = 20 s** en filet dans le client Supabase lui-même, pour
  qu'aucune requête ne soit immortelle — la remontée de la file, le catalogue,
  le rafraîchissement du jeton. Volontairement large : il n'est pas là pour
  rendre l'app vive.

⚠️ **Le filet s'efface devant le signal de l'appelant.** `postgrest-js` passe le
signal de `.abortSignal()` dans `init.signal` : l'écraser annulerait les budgets
courts et ne laisserait que les vingt secondes. Une garde tient cette priorité.

⚠️ **ON ANNULE POUR DE VRAI, ON NE COURSE PAS.** La première idée était de faire
courir la promesse contre un minuteur. Elle est **fausse pour une écriture** :
la requête abandonnée continue en vol et peut arriver **après** la mise en file,
ce qui ferait deux lignes pour un scan — sur le chemin en ligne, c'est le serveur
qui choisit l'identifiant. `AbortSignal` coupe la requête, donc ce cas n'existe
pas.

⚠️⚠️ **LA PIÈCE LA PLUS FRAGILE : une annulation doit être comprise comme une
PANNE RÉSEAU.** Sans ça, tout le dispositif se retourne — le budget coupe la
requête et l'écran affiche « Enregistrement impossible » au lieu de basculer
hors ligne. L'app serait **plus cassante qu'avant**. Vérifié dans le code de
`postgrest-js` : il **relance l'`AbortError` d'origine** au lieu de le convertir
en `{ error }` (`executeWithRetry`), donc son nom arrive intact jusqu'à
`isNetworkError`, qui le reconnaît désormais. Et son signal couvre aussi les
nouvelles tentatives internes de postgrest : le budget est celui de l'opération
entière, pas d'un essai.

### B — le scan lit le cache avant le réseau

`resolveArticle` interroge le **cache local d'abord, toujours**. Un code du
référentiel se résout par une lecture de `Map`, sans toucher le disque une fois
l'index chauffé.

Le serveur reste interrogé **quand le cache rate** — un article créé par un
collègue pendant le comptage n'est pas dans un cache antérieur — mais avec le
budget court, et une seule fois puisque l'app bascule ensuite.

**Ce qu'on accepte de perdre** : un article *modifié* en cours de route s'affiche
dans sa version d'avant. Le comptage porte sur le SKU, donc la donnée reste
juste ; c'est l'étiquette qui retarde, jusqu'au prochain `primeOfflineCache`.

### ⚠️ Ce que je n'ai PAS fait, et pourquoi

J'avais proposé d'aller plus loin : **mettre le comptage en file systématiquement**
et drainer en arrière-plan, pour que « Compter » ne touche jamais le réseau.

**Une règle écrite en tête d'`offlineSync.ts` l'interdit**, et elle a raison :

> « On ne passe en local que sur une panne réseau. Un refus du serveur (balise
> inconnue, inventaire clôturé, droits insuffisants) doit rester un refus
> visible immédiatement — le masquer derrière une mise en attente ferait croire
> au compteur que son travail est enregistré alors qu'il sera rejeté à la
> synchronisation. »

Le budget court donne l'essentiel du gain sans y toucher : en zone grise, le
premier scan coûte 2,5 s, l'app bascule, et **tout le reste est instantané et
local**. Un refus, lui, reste synchrone et visible. Une garde vérifie d'ailleurs
qu'un refus n'est **pas** confondu avec une panne.

Le jour où l'on voudra vraiment zéro appel sur l'écriture, il faudra décider que
« le refus reste visible » veut dire « une seconde plus tard, et visiblement »,
pas « au scan ». C'est une décision de produit, pas une optimisation.

## Ce qui a été mesuré

⚠️ **Trois mesures qui COMPTENT LES APPELS, pas des gardes textuelles** — c'est
la seule façon de prouver « zéro appel » (`tests/offlineSync.test.ts`) :

| | |
|---|---|
| un code du référentiel | **0 appel au serveur** |
| un code que le cache ignore | **1 appel** (il faut bien le résoudre) |
| hors ligne, un code inconnu | **0 appel** — plus de requête vouée à expirer |

Et le mécanisme lui-même, éprouvé (`tests/reseau.test.ts`) : le budget annule le
signal, l'appel rapide rend sans attendre, l'erreur produite est reconnue comme
une panne réseau, et un refus du serveur ne l'est pas.

**Sept sabotages, sept gardes qui mordent** : le scan qui redemande au serveur
d'abord, l'annulation qui cesse d'être une panne, les budgets qui disparaissent
un par un, le budget qui dérive à dix secondes, le filet qui écrase le signal de
l'appelant, le filet qui ne nettoie plus son minuteur.

## ⚠️ Ce qui n'est pas vérifié

**Rien n'a été joué dans une vraie zone grise.** C'est le genre de défaut qui ne
se reproduit pas sur un bureau : il faut une réserve, un sous-sol, un ascenseur.
Les tests prouvent le mécanisme et l'absence d'appels ; ils ne prouvent pas que
l'expérience est bonne au cinquième sous-sol.

**Et le site n'est pas touché**, délibérément : c'est un outil d'ordinateur, sur
un réseau d'ordinateur. `web/lib/inventory.ts` garde ses appels tels quels.

**Rien n'est en production** : tout est sur `on-demand`, et l'app publiée
continue de mouliner jusqu'à la mise à jour unique (fiche 109).

## Ce qui reste sur la table

Les autres leviers discutés le même jour, non faits :

- **le battement d'appareil** — chaque téléphone écrit toutes les 30 s, sans
  fin ; le serveur renvoie déjà le plafond, donc le téléphone pourrait ralentir
  quand il reste de la marge. C'est le plus gros gain structurel côté serveur ;
- **le téléphone calcule sa propre contribution** au lieu de la demander ;
- **la liste des balises terminées**, un agrégat recalculé par téléphone pour un
  simple avertissement.

Et la règle qui les encadre : le téléphone peut garder **ce qu'il a produit** et
**ce qui ne change pas pendant la session**. Jamais ce qu'un autre téléphone peut
changer et qui commande une décision — le plafond d'appareils, l'état partagé
d'une balise, l'arbitrage des écarts. En cache pour l'affichage, oui ; pour
décider, non.
