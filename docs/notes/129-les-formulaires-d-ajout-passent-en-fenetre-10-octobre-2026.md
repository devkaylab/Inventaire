# ⚠️ Les formulaires d'ajout passent en fenêtre — 10 octobre 2026

Julien, capture à l'appui :

> « Il y a un défaut d'affichage avec le formulaire d'ajout d'une personne. Et
> je pense que je préfère que ce soit un pop up qui s'affiche, avec une
> animation fade in et fade out quand on a terminé, un voile léger qui fait une
> séparation entre le pop up et la page derrière. Quand je dis pop up, ce n'est
> pas une nouvelle page, certains navigateurs bloquent les pop up. »

## ⚠️ Le défaut d'affichage était GÉNÉRAL, pas propre à cette page

`.panel` ne porte de marge **qu'au-dessus**. `.admin-section` **qu'en dessous**.
Entre les deux : zéro. Les deux fonds blancs se fondaient en un seul bloc avec
une simple couture.

La correction vise la **succession**, pas l'une des deux cartes — leur marge
propre reste juste quand elles sont seules :

```css
.panel + .admin-section,
.panel + .panel { margin-top: 16px; }
```

## La fenêtre existait déjà à moitié

`Modal` et `.modal-backdrop` sont là depuis longtemps, avec le voile et le
fondu d'**entrée**. Ce qui manquait, c'est la **sortie** : React démontait d'un
coup, le voile disparaissait net, la page revenait comme un claquement.

Donc **pas de second composant** — on complète celui qui existe, et les quatre
autres fenêtres du site en profitent.

### ⚠️ Le contenu doit pouvoir fermer par le même chemin

Un formulaire qui se referme après l'envoi appellerait `onClose` **en direct** :
la fenêtre sauterait au moment **exact** que Julien décrivait, « quand on a
terminé ». `Modal` accepte donc un contenu sous forme de fonction, qui reçoit
`fermer`. Les appelants qui n'en ont pas besoin passent du JSX comme avant.

Et **toutes** les sorties empruntent ce chemin — Échap, la croix, le clic sur le
voile, le bouton du pied. Sinon l'une d'elles claque pendant que les autres
fondent.

### ⚠️ La durée est écrite DEUX FOIS

Dans le CSS (`voile-sort`, `.16s`) et dans `DUREE_FERMETURE_MS`. Trop court côté
code : la fenêtre saute avant la fin du fondu. Trop long : un voile mort reste à
l'écran. **Une garde tient l'accord** — même piège que `DUREE_LIEN_HEURES`, où
l'e-mail promettait ce que le serveur ignorait (fiche 121).

### Deux ajouts au passage

- la fenêtre **ne grandit plus avec son contenu**, elle défile ;
- **« moins d'animation » l'éteint**, comme les vingt-cinq autres blocs
  `prefers-reduced-motion` de la feuille. ⚠️ La garde cherche dans **tous** les
  blocs : en lire un seul, c'est en lire un au hasard.

## Les DEUX formulaires, pas seulement celui de la capture

Laisser l'autre déplié dans la page aurait fait **deux gestes différents pour la
même chose, sur la même page**. Celui de l'administrateur est plus grand : il
part en `large`.

## Ce qui a été vérifié

| | |
|---|---|
| l'administrateur, sur la préversion | fenêtre centrée, voile flouté, formulaire entier |
| le superviseur, **en production** | idem, thème clair |
| la fermeture | nette, **aucun voile résiduel** |
| la page après fermeture | une seule carte, plus de blancs collés |

Garde : `web/tests/fenetre-modale.test.ts`. **Huit sabotages, huit morsures.**

## ⚠️ Ce qui n'est pas vérifié

**Le fondu lui-même n'a pas été mesuré** : 160 ms ne se photographient pas. Ce
qui est tenu à sa place : l'accord des deux durées, et le fait qu'aucun voile ne
survive à la fermeture — c'est ce dernier point qui aurait fait le dégât visible.
