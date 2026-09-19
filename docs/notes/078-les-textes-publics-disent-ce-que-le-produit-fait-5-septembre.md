# Les textes publics disent ce que le produit fait (5 septembre 2026)

*« Ce texte sur la page tarifs n'est plus d'actualité : "Rien ce jour-là. Nous
ne refusons jamais un appareil pendant un comptage… Le dépassement se règle au
renouvellement." Profites-en pour faire un tour sur le site et actualiser les
anciens textes. »*

## ⚠️ LA PAGE PROMETTAIT LE CONTRAIRE DU PRODUIT

Ce texte était vrai du **plafond souple** du 27 août. Le 4 septembre Julien a
tranché l'inverse — « on n'accepte ni magasin, ni appareil supplémentaires sans
paiement » — et le verrou refuse réellement le troisième appareil. La page
vendait donc une promesse que le produit dément **à l'heure la plus tendue de
la journée** : un soir d'inventaire.

Ce qui reste vrai, et qu'il fallait garder : **personne n'est jamais interrompu
en plein comptage**. C'est la première borne du verrou, pas une formule de
politesse — le texte le dit maintenant, et il dit aussi que l'offre s'élargit
en ligne, dans la minute.

## Le tour du site — cinq autres textes périmés

| Où | Ce qui était écrit | Pourquoi c'était faux |
|---|---|---|
| `/tarifs`, licences | « nous établissons un devis pour l'ensemble » | le devis a disparu de la vente le 4 septembre |
| `/tarifs`, lead **et** description SEO | « sans engagement et résiliable à tout moment » | **l'article 7 des CGV** : l'annuel court douze mois, payés d'avance, sans remboursement |
| `TarifsGrille` | « au-delà de 100 appareils — parlons-en » | ça s'achète en ligne par tranches de dix, et la grille s'arrête à 200 (5 septembre) |
| `/tarifs`, bouton | `href="/inscription"` en dur | il promettait l'inscription alors que la vente est fermée |
| `/devis/<jeton>`, expiré | « Écrivez-nous : nous vous en établissons un nouveau » | **sans donner l'adresse** — ses deux voisins la donnent, pas lui |
| `/souscrire` | « contactez-nous » quand l'adresse manque | même règle du 22 août : l'adresse, ou le silence |

⚠️ **Les trois derniers ont été trouvés PAR LA GARDE, pas à l'œil.** C'est
l'argument pour l'écrire : un balayage relit tout le site à chaque `vitest`,
un humain relit ce qu'il a en tête.

## ⚠️ CES GARDES DÉFENDENT DES DÉCISIONS, PAS DES PHRASES

Une garde qui citerait la phrase d'aujourd'hui ne protégerait que celle-là.
`web/tests/textes-a-jour.test.ts` balaie **toutes** les pages publiques (la
liste se déduit de `app/`, l'espace connecté est écarté) plus tous les
composants, et vérifie six règles :

- aucune ne promet qu'on ne refuse jamais un appareil ;
- aucune ne renvoie au parcours de devis (`sur devis`, `parlons-en`,
  `nous établissons un devis`) ;
- **toute phrase contenant « résiliable » doit dire « mois »** — c'est la seule
  forme que les CGV tiennent ;
- la grille ne cite aucun montant ni palier en dur, et dit où elle s'arrête ;
- aucun texte n'invite à écrire sans donner l'adresse ;
- **aucun lien `/inscription` en dur** — tout passe par `InscriptionLink`, sauf
  les composants qui lisent `venteOuverte()` eux-mêmes.

Le dernier point est une leçon en soi : la garde du 5 septembre au matin
cherchait le libellé « Inscrire mon entreprise », donc « Équiper plusieurs
magasins » lui a échappé. **Celle-ci vise le LIEN, pas le mot** — n'importe
quel libellé futur est couvert.

## ⚠️ DEUX PIÈGES PAYÉS DANS LA MÊME HEURE

1. **Une espace INSÉCABLE avant le point-virgule** a fait échouer une garde
   dont le message d'erreur montrait deux chaînes identiques à l'œil
   (`engagement ;` contre `engagement ;`). Piège déjà payé le 4 septembre
   sur le séparateur de milliers : **on normalise U+00A0 et U+202F avant
   d'assertir**, jamais on ne tape l'attendu au clavier.
2. **⚠️ TROIS FICHIERS S'APPELLENT `page.tsx`.** Mes sauvegardes de sabotage
   (`cp <f> /tmp/t_$(basename <f>)`) se sont donc écrasées entre elles, et la
   restauration a remplacé `app/tarifs/page.tsx` par le contenu de
   `app/souscrire/page.tsx`. Rattrapé par `git checkout HEAD --` et cinq
   corrections réappliquées — mais **une sauvegarde se nomme par son CHEMIN,
   jamais par son nom de fichier** dans une arborescence Next, où chaque route
   porte le même nom. C'est le pendant de la règle du 5 septembre au matin
   (« `cp` avant, `cp` après — jamais git ») : encore faut-il que les copies ne
   se marchent pas dessus.

## Vérifications

- **Au navigateur, sur la page rendue** : le lead, le pied (« Mensuel sans
  engagement ; annuel dû jusqu'à son terme »), la ligne hors grille (« jusqu'à
  200 appareils. Au-delà, un magasin de plus prend sa propre licence »), la FAQ,
  et le bouton qui dit **« Nous écrire »** — donc `InscriptionLink` répond bien
  au verdict de vente. Aucun ancien texte ne subsiste.
- **Quatre sabotages, quatre échecs** : l'ancienne promesse, « résiliable à
  tout moment » sans « au mois », le « parlons-en » du devis, et un lien
  `/inscription` en dur.
- 1 266 tests du site, `tsc --noEmit`, `eslint .` à zéro erreur, `next build`
  avec la table de routes inchangée.

Tests de garde : `web/tests/textes-a-jour.test.ts`.
