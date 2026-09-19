# Le bandeau de démarrage (23 août 2026)

*« Remplacer le bloc “Pour démarrer” par un bandeau d'une seule étape
(~76 px), qui ne vise plus un inventaire mais le démarrage du superviseur. »*

Le bloc « Pour démarrer » déroulait quatre étapes de **préparation d'un
inventaire** (créer, zones, fichiers, membres) en haut de l'accueil. Deux
choses ont changé, et la seconde est la plus importante.

**La forme** : `components/BandeauDemarrage.tsx`, une rangée de 76 px,
cliquable de bout en bout, avec un chevron et une croix. Elle annonce, elle
n'explique pas — l'explication vit dans l'écran où l'on atterrit.

**L'objet** : les trois étapes sont ce qu'il faut avoir fait **une fois** pour
être en état de travailler — `Générer mes balises` (→ boîte à outils),
`Constituer mon équipe` (→ Mon équipe), `Créer mon premier inventaire`. La
préparation d'une session se conduit depuis la session, où elle est déjà.

Points à ne pas défaire :

- **⚠️ Le bandeau ne se rejoue pas** (28 août 2026). Ses étapes se cochent sur
  des faits relus à chaque ouverture : supprimer ses inventaires remettait la
  troisième à faire et le bandeau revenait — des semaines après le démarrage,
  à quelqu'un qui connaît le produit. Constat de Julien : « il s'affiche à
  chaque fois qu'il n'y a plus d'inventaire en cours ». La fin du démarrage
  est donc **notée** dès qu'elle survient (les trois étapes cochées, ou plus
  d'un inventaire créé), avec **le repère que la croix marque déjà** —
  surtout pas un jalon : « Revoir les repères » doit pouvoir ramener le
  bandeau, or un jalon ne s'efface pas. Le marquage reprend les gardes de
  `montrerGuide` : on ne consomme pas un bandeau qu'on n'a jamais montré.
- **⚠️ L'étape des balises se coche sur un jalon local, et il n'y a pas
  d'autre moyen.** Une planche est dessinée sur le téléphone et **n'écrit rien
  en base** : aucun fait serveur ne dira jamais qu'elle a été produite. D'où
  `Jalon` dans `lib/reperes.ts` — à ne pas confondre avec un repère : un
  repère est une aide qui ne se montre qu'une fois, un jalon est un **fait**.
  Il se pose dans `BaliseCreator`, au `onSuccess` du dessin du PDF, et nulle
  part ailleurs. `useJalon` le relit à chaque retour sur l'écran
  (`useFocusEffect`) : on revient précisément de l'écran qui vient de le
  poser. Conséquence assumée : changer de téléphone remet l'étape à faire.
- **`oublierReperes` n'efface pas les jalons.** « Revoir les repères » rejoue
  les aides ; il ne défait pas ce qui a été fait.
- **Les deux autres étapes se lisent en base** : `my_team_by_store` (la même
  RPC que « Mon équipe ») et les inventaires créés par la personne. **Une
  invitation en attente compte** comme une équipe constituée — sinon l'étape
  resterait à faire juste après avoir invité quelqu'un.
- **Le bandeau ne remplace jamais la liste.** Le guide qui l'a précédé prenait
  l'écran entier et masquait l'inventaire qu'on venait de créer ; à 76 px la
  question ne se pose plus. `guidePleinEcran` a disparu.
- **⚠️ « + Nouvel inventaire » ne se masque JAMAIS.** Il l'a été deux fois,
  et deux fois cela a laissé quelqu'un sans rien à toucher : tant que le guide
  pleine page durait, puis — première version de ce bandeau — quand l'étape en
  cours était la création et que la liste était vide. Julien, le 23 août 2026,
  capture à l'appui : un bandeau, une salutation, « Aucun inventaire pour
  l'instant », et c'est tout. **Le chevron d'un bandeau ne se lit pas comme un
  bouton.** Ce n'est pas non plus le doublon d'autrefois : le guide pleine page
  portait un bouton violet au même libellé, une rangée de 76 px et un bouton
  d'action ne se confondent pas. La seule chose qui remplace encore ce bouton
  est la barre de sélection multiple.
- `getPreparation` et les invalidations `['preparation', …]` de Zones, Import
  et Inviter ont été **retirées** : plus personne ne les lit.

## Deux défauts trouvés en l'exerçant, et corrigés

Tout a été parcouru au simulateur, appui par appui. Deux choses cassaient, et
la seconde rendait la première étape inutilisable.

1. **Mon équipe et Boîte à outils s'ouvrent depuis deux endroits.** Le bandeau
   y mène directement depuis l'accueil superviseur, donc **en traversant deux
   groupes de routes** : ils sont alors le premier écran de la pile `(compte)`,
   la flèche native ne s'affiche pas, et on reste coincé dessus. C'est le piège
   déjà écrit plus bas (« ce qu'un écran ouvre doit être dans sa pile ») ; ici
   il est réglé par un `headerLeft: RetourVersApp` sur ces deux écrans, qui
   pointe vers le bon endroit dans les deux cas.

2. **⚠️ « Créer et imprimer des balises » ne marchait pas — et c'était vrai
   avant ce chantier.** L'overlay de chargement était une `Modal`, donc un
   `UIViewController` présenté : iOS **refuse** d'ouvrir la feuille de partage
   par-dessus (`Attempt to present UIActivityViewController … which is already
   presenting`), `shareAsync` ne se résolvait jamais, le bouton tournait
   indéfiniment et **aucun PDF ne sortait**. Retirer la modale juste avant le
   partage ne suffit pas non plus : la feuille s'ouvre « while a presentation
   is in progress », et à sa fermeture **l'application ne répond plus du tout**
   — plus un seul appui, il faut la relancer.

   Corrigé en deux gestes : `lib/balises.ts` sépare `buildBaliseSheetFile`
   (dessiner) de `shareBaliseSheet` (partager), et **`GeneratingOverlay` n'est
   plus une `Modal`** mais un voile posé sur la carte qui l'accueille. Plus
   rien n'est présenté, donc plus de conflit. Ne pas la remettre en `Modal`.

## Ce qui change le stockage prévient les écrans

Dans la foulée, « Revoir les repères » (Mon compte) : il effaçait bien les
clés, mais les écrans qui affichent les repères ne relisaient le stockage
qu'à leur montage. On appuyait, **rien ne se passait**, et les repères ne
revenaient qu'au prochain lancement — un bouton qui a l'air cassé.

`lib/reperes.ts` porte donc un **avertissement** : `marquerRepereVu`,
`oublierReperes` et `poserJalon` préviennent les hooks abonnés, **après
l'écriture, jamais avant** (les écrans vont relire le stockage, il doit déjà
être à jour — c'est aussi ce qui évite qu'un repère tout juste fermé
réapparaisse).

Pourquoi pas une relecture au retour sur l'écran (`useFocusEffect`), qui
était le premier réflexe : **la porte de bienvenue n'est pas un écran**, elle
est posée en surcouche du layout racine (`_layout.tsx`), hors de la pile de
navigation. Elle n'aurait donc rien relu — et c'est précisément ce que
l'alerte nomme en premier. L'avertissement, lui, ne dépend d'aucune
navigation, et sert les repères comme les jalons : **un seul mécanisme**.
`useJalon` n'utilise plus `useFocusEffect`.

Au passage, l'état des deux hooks **porte le compte qu'il décrit**
(`{ uid, lu, … }`). L'ancienne forme le remettait à zéro dans l'effet — le
`setState` synchrone que React déconseille, et l'état d'une personne
s'affichait un instant à la suivante.

Vérifié au simulateur le 23 août 2026, clair et sombre : le bandeau à
« 1 sur 3 », l'impression jusqu'au PDF (`balises_1-900`, 1,2 Mo, feuille de
partage avec Imprimer et Enregistrer), le jalon qui fait passer le bandeau à
« 2 sur 3 » au retour, les deux flèches de retour, la croix qui masque,
l'application qui répond après la fermeture du partage, et « Revoir les
repères » qui **ramène la bienvenue et le bandeau sans relancer l'app** — le
jalon des balises, lui, reste posé (« 2 sur 3 »), comme prévu.

Tests de garde : `tests/compte.test.ts`, bloc « le bandeau de démarrage » et
« Revoir les repères » se voit tout de suite ».
