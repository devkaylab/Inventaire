# La vente est fermée jusqu'à l'immatriculation (5 septembre 2026)

*« On ferme en attendant l'immatriculation. »* Le site était en ligne, avec
« Inscrire mon entreprise » en bouton plein dans la barre publique — et un
visiteur pouvait dérouler tout le parcours d'inscription jusqu'à une page de
paiement **en mode TEST**, sur une société qui n'est pas encore immatriculée.

## ⚠️ UN SEUL INTERRUPTEUR, ET C'EST L'IMMATRICULATION

`venteOuverte()` (`web/lib/legal.ts`) rend **`mentionsCompletes()`**. Ce n'est
pas une astuce d'écriture : la LCEN interdit de vendre en ligne sans
identification complète de l'éditeur, donc les deux ouvrent **ensemble par
nature**. Un second drapeau serait un endroit de plus où se tromper — et
surtout un endroit qu'on oublierait de rouvrir le jour venu.

Le jour de l'immatriculation, **remplir les sept valeurs de `legal.ts` rouvre
la boutique tout seul** : la page des mentions légales sort de `noindex`, le
pied de page l'annonce, et les boutons redeviennent « Inscrire mon
entreprise ». Même mécanique que `PUBLIEE` dans `web/lib/appStores.ts`.

⚠️ **Les gardes portent sur le MÉCANISME, jamais sur la valeur.** Aucun test ne
fige « c'est fermé » — sinon la suite virerait au rouge le jour de la
réouverture, et ce serait un obstacle au lieu d'une protection.

## ⚠️ ET AU SERVEUR AUTANT QU'À L'ÉCRAN

Une porte fermée seulement sur l'écran s'ouvre avec une adresse. Les deux
fonctions edge d'acquisition — `inscription` et `subscribe-online` — portent
un `const VENTE_OUVERTE = false` jumeau et répondent **503 `vente_fermee`**.
Un test compare les deux drapeaux au verdict du site : ils ne peuvent pas
diverger.

- **⚠️ LE REFUS VIENT AVANT TOUTE ÉCRITURE.** Ouvrir un compte de prospect qui
  ne pourra pas payer ne laisserait que des comptes orphelins ; déposer une
  demande, une ligne morte. Un test compare la position de la garde à celle de
  `demander_code_email`, `auth.admin.createUser`, `finaliser_inscription` et
  `deposer_souscription` dans le fichier — c'est le motif du Price vérifié
  avant le dépôt (30 août).
- **Rien n'est touché en base** : ni migration, ni RPC. Les fonctions existent
  et fonctionnent ; elles ne sont simplement plus appelées. Le jour de la
  réouverture, un `false` devient `true` dans deux fichiers et les deux
  fonctions sont redéployées.

## ⚠️ CE QUE ÇA NE FERME PAS

- **Les PRIX restent visibles.** Ils sont publics et vrais depuis le 30 août :
  les cacher ne protégerait rien et priverait un prospect de ce qu'il est venu
  chercher. C'est le **bouton** qui change, pas la grille — un test refuse
  qu'on conditionne la boucle des offres au verdict.
- **Le libre-service ne bouge pas** (changer d'offre, ajouter un magasin) : il
  vit derrière une session d'administrateur d'entreprise, et il n'existe aucun
  client réel. Le fermer ne protégerait personne.
- **Les écrans ne disparaissent pas** : `/inscription` et `/souscrire`
  affichent « L'inscription en ligne ouvre bientôt » avec l'adresse de contact
  et un lien vers les offres. Une page qui n'existe plus est une erreur ; une
  page qui explique est une réponse.

## ⚠️ LA GARDE DÉDUIT LA LISTE, ELLE NE LA CITE PAS

C'est ce qui a payé. J'avais corrigé quatre écrans à la main ; un test qui
balaie **tous** les `.tsx` de `web/app` et `web/components`, retient ceux qui
écrivent « Inscrire mon entreprise » sans passer par `InscriptionLink` ni lire
`venteOuverte()`, en a trouvé **sept**. Même doctrine que les portes de
`(compte)` et que la mention de TVA, tous deux le 4 septembre.

`InscriptionLink` porte désormais un `ferme` facultatif : le libellé de
remplacement, « Nous écrire » par défaut. Un écran qui passe par lui est juste
sans rien savoir.

## Vérifications

- **Les deux fonctions edge déployées, éprouvées en direct par `pg_net`** (le
  proxy bloque `*.supabase.co` depuis l'agent) : les deux répondent
  `{"success":false,"code":"vente_fermee",…}`. **Zéro résidu contrôlé** — 0
  code d'e-mail, 0 brouillon d'inscription, 0 demande, 0 ligne de quota.
  `verify_jwt` relevé avant de déployer, recontrôlé après : faux pour les deux,
  inchangé.
- **Au navigateur** : `/tarifs` garde ses six montants (89, 950, 310, 3 300,
  890, 9 450 €) et tous ses boutons disent « Nous écrire » vers
  `/inscription` ; `/souscrire` affiche le panneau d'attente. `scrollX` à zéro.
- **Cinq sabotages, cinq échecs** : le drapeau serveur remis à `true` seul, la
  garde edge déplacée après une écriture, `venteOuverte()` transformée en
  drapeau indépendant, les prix conditionnés au verdict, un écran promettant
  l'inscription sans lire le verdict.
- 1 211 tests du site, `tsc --noEmit`, `eslint .` à zéro erreur, `next build`
  avec la table de routes inchangée.

Tests de garde : `web/tests/inscription.test.ts`, bloc « la vente est fermée
jusqu'à l'immatriculation ».
