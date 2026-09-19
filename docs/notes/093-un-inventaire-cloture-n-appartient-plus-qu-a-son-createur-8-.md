# Un inventaire clôturé n'appartient plus qu'à son créateur (8 septembre 2026)

*« Une personne invitée à un inventaire qui a été clôturé ne le voit plus […]
ça n'a pas d'intérêt »*, puis *« seul le créateur de l'inventaire peut le
clôturer »*. Migration `20260908140001`.

Constat de départ : `julien.thiong-kay@samaritaine.com` voyait encore
« LA Bruket », créé par Théo et clôturé le 13 août, sans rien pouvoir en faire.
**Mesuré avant d'écrire** : c'est la seule personne concernée, sur un seul
inventaire.

## ⚠️ UN SEUL POINT DE PASSAGE — `is_session_participant`

Elle garde **10 policies** et, par `can_access_session`, une trentaine de
fonctions : comptages, zones, articles, stock théorique, rapport, écarts. Une
ligne ferme donc tout de façon cohérente — c'est le raisonnement qui avait servi
le 22 août pour **ouvrir** l'accès à l'administrateur d'entreprise, au même
endroit. La même règle recopiée dans dix policies aurait garanti un oubli.

Conséquence voulue : pour un invité, un inventaire clôturé ne disparaît pas
seulement de sa liste — il n'en reste rien à moitié lisible.

- **⚠️ Le créateur et l'administrateur d'entreprise gardent tout.** Le second
  voit tout ce qui appartient à son entreprise depuis le 22 août, et le
  **rapport consolidé d'un magasin additionne des inventaires CLÔTURÉS** : le
  lui retirer viderait cet écran.
- **⚠️ Les compteurs ont leur PROPRE policy** (`sessions_employee_select`), qui
  teste `session_members` en direct sans passer par la garde. Sans ce second
  geste, un compteur aurait continué de voir un inventaire que plus personne ne
  lui ouvre.
- **⚠️ `counts_select_own` n'est PAS touchée**, et c'est délibéré : chacun
  garde la vue de **ses propres** lignes, quel que soit l'inventaire. Aucun
  écran ne les affiche plus (l'inventaire est invisible), aucune fuite — ce
  sont ses données, et l'export RGPD les contient de toute façon.
- **⚠️ `create or replace` rend EXECUTE à PUBLIC** : les droits sont reposés
  dans la même migration.

## ⚠️ SEUL LE CRÉATEUR CLÔTURE — et ça révoque une règle du 22 août

Celle qui disait : « clôturer est ouvert à tout superviseur participant, c'est
un geste de terrain que le créateur peut défaire ». Elle ne tient plus avec ce
qui précède : un invité qui clôture se retirerait l'écran sous les doigts.

**⚠️ LA DISTINCTION SE FAIT PAR LE `WITH CHECK`, PAS PAR LE `USING`**, et c'est
ce qui permet de ne fermer QUE la clôture :

| | Regarde | Ce qu'il garde |
|---|---|---|
| `USING` | la ligne AVANT | la **réouverture** d'un clôturé, au créateur (21 août, inchangé) |
| `WITH CHECK` | la ligne APRÈS | la **clôture** : si la nouvelle valeur est `closed`, il faut être le créateur |

**« Commencer l'inventaire » (`status = 'counting'`) reste ouvert à tout
superviseur participant** : c'est un geste de préparation, pas une fin. Vérifié
en transaction annulée — l'invité démarre, et sa clôture est refusée (42501).

## Les écrans ne proposent pas ce que la base refuse

Un bouton qui échoue vaut moins que pas de bouton : on le découvre **après**
avoir accepté une confirmation.

- **Site** : `canReopen` existait déjà et valait « créateur ou administrateur
  d'entreprise ». Il gouverne désormais les deux gestes, et un non-créateur lit
  « Seul le créateur de l'inventaire peut le clôturer ».
- **App** : la fiche d'un inventaire conditionnait déjà « Clôturer » à
  `isCreator` — elle était conforme d'avance. Seule **la liste** l'offrait à
  tous ; elle passe par `peutCloturer`.
- **⚠️ Le coup d'œil du balayage suit** : il ne se joue que sur un rang qui
  porte réellement un volet, et les deux volets ont maintenant la même
  condition.

## Vérifications

- **Essai à blanc AVANT d'appliquer**, en transaction annulée, sur les vraies
  données : l'invité passe de 3 à 2 inventaires et ne voit plus LA Bruket ni
  ses comptages ; le créateur voit tout (83 comptages) ; un inventaire **en
  cours** reste visible à l'invité ; le créateur démarre, clôture et rouvre ;
  l'invité démarre mais **sa clôture est refusée**.
- **Six sabotages, six échecs** ; deux gardes existantes réorientées, aucune
  affaiblie.
- 512 tests de l'application, 1 353 du site, `tsc` des deux côtés, `eslint .` à
  zéro erreur, `next build` inchangé, dérive dossier/base à zéro, et les
  données intactes (5 inventaires, 175 comptages, 73 zones, 7 membres).

⚠️ ~~L'application doit être reconstruite~~ — **FAIT, le 13 septembre 2026**
(Julien : « le build est déjà fait »). La réserve tenait cinq jours : la base
refusait déjà la clôture par un invité, mais un téléphone d'avant ce build lui
montrait encore le volet « Clôturer » de la liste et il recevait un refus. Le
site, lui, avait pris effet au déploiement.

Tests de garde : `web/tests/backend-durcissement.test.ts`, bloc « un inventaire
clôturé n'appartient plus qu'à son créateur ».
