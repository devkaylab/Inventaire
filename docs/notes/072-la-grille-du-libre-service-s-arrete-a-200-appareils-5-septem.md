# La grille du libre-service s'arrête à 200 appareils (5 septembre 2026)

*« Non, au bout d'un moment on n'ajoute plus d'appareils, on passe par une
autre offre. Il est rare d'aller au-delà de 100 appareils en général. Possible
d'ajouter des appareils jusqu'à 200 appareils, au-delà → nouvel abonnement. Au
pire le client nous contactera. »*

La borne valait **1 000**, un chiffre posé le 4 septembre faute de décision : un
client pouvait souscrire mille appareils en libre-service (~6 700 €/mois) sans
que personne ne regarde. Elle vaut **200**. Migration `20260905130001`.

Ce que la grille vend désormais, en entier : Essential jusqu'à 2, Advanced
jusqu'à 20, Enterprise jusqu'à 100, puis le palier Enterprise se prolonge par
tranches de dix **entamées** jusqu'à 200 — soit **1 530 €/mois ou 16 350 €/an**
au dernier cran (890 + 10 × 64 ; 9 450 + 10 × 690).

## ⚠️ CE N'EST PAS UNE BORNE DE LECTURE

`plafond_appareils` **n'est pas touchée**, et un test le vérifie. Elle calcule
ce qu'un magasin a le **droit** de faire tourner — y compris un magasin devisé
plus haut hors libre-service. La borner couperait le verrou d'un client
légitime, c'est-à-dire l'empêcherait de compter. **C'est la VENTE qui s'arrête
à 200, pas le produit.**

## ⚠️ AU-DELÀ, IL N'Y A PAS DE PRIX — pas un prix plus gros, pas de devis

L'abonnement est **par magasin** : une enseigne qui compte à 250 appareils
compte en réalité dans plusieurs lieux, et chacun prend le sien. Les deux
écrans le disent en toutes lettres et proposent l'adresse de contact en second
recours (par `ecrivezNous()`, qui **se tait** si `NEXT_PUBLIC_CONTACT_EMAIL`
n'est pas posée — règle du 22 août : on n'invite jamais à écrire sans dire où).

Le message d'avant renvoyait vers un devis (« nous construisons le tarif avec
vous ») : c'est le parcours supprimé le 4 septembre. Un test refuse son retour.

## ⚠️ LE REFUS SE DIT AVANT LE CLIC — et c'est un renversement

Le commentaire de `ChangerOffre` disait, le 5 septembre au matin : « la borne
haute reste au serveur — c'est une règle de grille, on n'en fait pas une copie
de plus ». **C'était juste à 1 000 et faux à 200** : personne ne tape mille
appareils, une enseigne en tape deux cent cinquante sans y penser. Elle serait
donc découverte après un prix calculé et un clic — exactement le défaut que
`deja_couvert` avait fermé la veille.

`PLAFOND_LIBRE_SERVICE` (`web/lib/offres.ts`) est donc la **cinquième copie
assumée** de la grille, à côté de `prix_offre` qui fait foi côté serveur. Un
test compare les deux. Elle borne `prixCents` **et** `proposer`, en un seul
point chacun ; les écrans lisent le drapeau, ils ne recalculent rien.

⚠️ **`proposer()` rend maintenant `null` pour DEUX raisons** — « le forfait
couvre déjà » et « hors grille » — et les écrans doivent les distinguer : un
écran qui n'afficherait rien laisserait croire à une panne.

## Un refus qui décide d'un achat se LIT (`.offre-refus`)

Mesuré au navigateur : `.field-hint` est en `--text-3` à 12 px, soit **~3:1**
sur la carte, dans les deux thèmes — sous le seuil AA. C'est mot pour mot le
défaut corrigé le 22 août 2026 sur la ligne de tranche, « à l'endroit précis où
l'on lit le prix ». Les deux phrases qui disent qu'on ne peut pas acheter — la
nouvelle et sa jumelle « déjà couvert » — passent en `--text-2` à 13 px
(**6,0:1** en clair, **6,9:1** en sombre). Un test refuse le retour de
`field-hint` sur ce bloc.

## ⚠️ Piège de méthode : la première garde des écrans ne mordait pas

Elle vérifiait que les mots `PLAFOND_LIBRE_SERVICE` et `horsGrille` figuraient
dans le fichier. Le sabotage `const horsGrille = false` **laisse les deux mots
en place** : deux sabotages sur sept sont passés. Elle vérifie désormais que le
drapeau se **calcule** sur la borne (`/horsGrille\s*=[^\n]*>\s*PLAFOND…/`) et
que le message est bien rendu dessous. *Une garde qui cherche un nom ne garde
pas ce que ce nom fait.*

## Ce qui a été vérifié

- **En base, en transaction annulée**, session d'administrateur simulée : 200
  accepté par les deux dépôts, 201 et 1 000 refusés avec le code
  `hors_grille` ; `prix_offre` rend un prix à 200 et `null` à 201 ;
  `plafond_appareils` intacte ; 137 inchangé (1 146 €/mois). **Zéro résidu** :
  0 demande, 2 magasins.
- **Parité dépôt/base** : les corps normalisés des trois fonctions ont la même
  empreinte MD5. ⚠️ Les trois sont **reprises de `pg_get_functiondef`**, pas
  des fichiers du dépôt — `deposer_changement_offre` avait été redéfinie par
  `20260905120001`, et repartir du premier fichier aurait ressuscité une
  version périmée.
- **Sept sabotages, sept échecs.**
- **Au navigateur** (route jetable, retirée, `git status` contrôlé) : 12 →
  Advanced 310 €/3 300 € ; 200 → Enterprise, « 100 appareils + 10 tranches de
  10 », 1 530 €/16 350 € — **les mêmes montants que la base** ; 250 → le refus,
  sans prix ni bouton. Débordement horizontal nul.
- 1 160 tests du site, `tsc --noEmit`, `eslint .` à zéro erreur, `next build`
  avec la table de routes inchangée.

**Non vérifié** : la page `/magasins` complète, qui demande une session
d'administrateur d'entreprise. C'est la même phrase et le même drapeau que la
fiche magasin, tenus par les mêmes gardes.

La décision 3 de la maquette d'inscription a été réécrite dans le même sens :
https://claude.ai/code/artifact/27d8f3e6-5e7a-4de7-a1eb-6da9d39cce3a

Tests de garde : `web/tests/libre-service.test.ts`, bloc « la grille s'arrête à
200 appareils ».
