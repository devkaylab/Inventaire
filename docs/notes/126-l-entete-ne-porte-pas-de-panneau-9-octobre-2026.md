# ⚠️ Un en-tête de page ne porte pas de panneau — 9 octobre 2026

Julien, capture à l'appui :

> « J'ai remarqué un défaut sur le site, dans Mon équipe > ajouter une
> personne, le formulaire est mal placé. »

Le formulaire d'ajout d'un compteur apparaissait **collé à droite du titre**,
avec un grand vide à gauche.

## La cause n'était pas dans le CSS

`.app-head` est une rangée `display:flex; justify-content:space-between`, faite
pour « titre à gauche, **action** à droite ». Elle faisait exactement son
travail.

Le défaut était dans ce qu'on lui donnait. La page a deux chemins :

- **administrateur** : un bouton dans l'en-tête, et `AjouterPersonne` rendu
  **sous** l'en-tête ;
- **superviseur** : `AddCounter` rendu **dans** l'en-tête.

Or `AddCounter` portait ses **deux états** : fermé il rendait un bouton, ouvert
il rendait une carte `.panel`. Fermé, il passait donc pour un bouton et tout
allait bien ; ouvert, la carte entière devenait l'élément de droite du
`space-between`.

## ⚠️ La leçon, qui dépasse cette page

**Un composant qui porte son propre bouton impose sa place à la page.** Quand il
s'ouvre, il occupe l'emplacement prévu pour le bouton — et cet emplacement a été
choisi pour un bouton.

`AddCounter` ne porte donc plus de bouton. La page tient l'ouverture (le **même**
`ajoutOuvert` que l'administrateur), met le bouton dans l'en-tête pour les deux
rôles, et rend le panneau en dessous. Les deux chemins ont désormais la même
forme, ce qui est aussi ce qui rendait le défaut invisible : personne ne compare
deux branches qui se ressemblent de loin.

Le panneau prend un titre, comme son jumeau `AjouterPersonne` — une carte seule
sous un en-tête, sans titre, ne dit pas ce qu'elle est.

## La garde

`web/tests/entete-ne-porte-pas-de-panneau.test.ts`. Elle **ne cite ni la page ni
les composants** : elle parcourt les pages de `web/app`, relève les composants
rendus dans chaque `.app-head`, **résout chacun jusqu'à sa source** (fonction
locale du fichier, ou fichier importé) et refuse qu'il contienne
`className="panel"`. Un troisième panneau posé dans un en-tête demain tombera
aussi.

⚠️ Avec un garde-fou : **« au moins trois pages à en-tête »**. Sans lui, renommer
`.app-head` rendrait la garde verte et aveugle — elle ne comparerait plus rien.

**Deux sabotages, deux morsures** : le formulaire remis dans l'en-tête, et la
classe `.app-head` renommée.

## ⚠️ Ce qui n'est pas vérifié

**L'écran lui-même n'a pas été regardé.** `/equipe` est une page connectée, et un
onglet neuf sur la préversion renvoie à la connexion — même constat qu'à la
fiche 123. Ce qui est tenu à sa place : les types, le lint, 1 756 gardes côté
site, et la garde ci-dessus. **Reste à poser l'œil dessus.**
