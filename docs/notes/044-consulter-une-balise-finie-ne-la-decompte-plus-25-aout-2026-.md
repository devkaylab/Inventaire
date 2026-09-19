# Consulter une balise finie ne la décompte plus (25 août 2026, au soir)

Constat de Julien, sur l'inventaire « Fwee » : *« j'ai ouvert une balise que
j'avais déjà comptée, je n'ai rien scanné, j'ai juste fait retour, et
maintenant Quantinvo conclut qu'aucune balise n'a été comptée, ce qui est
faux. »*

C'était exact, et le mécanisme est court : ouvrir une balise appelle
`set_balise(p_open := true)`, qui écrit `count_status = 'open'` **et efface
`count_done_at`**, sans mémoire de l'état précédent ; et **rien ne refermait
la balise au retour** — les deux seuls appels de fermeture sont le bouton
« Clôturer » et le passage à une autre balise. Il suffisait donc de
**regarder** une balise finie pour que l'inventaire la déclare non comptée.
Les pièces, elles, n'avaient jamais bougé (`counts` est en ajout pur, voir la
section précédente) : c'est l'étiquette « comptée » qui était perdue. Sur
« Fwee », la 1000 étant la seule balise clôturée, la tuile Progression est
tombée à **0 %** avec 23 pièces bien en base.

Ce n'est pas un cas d'essai : sur le terrain, un compteur qui scanne la
mauvaise étiquette puis revient en arrière décompte un rayon fini sans s'en
apercevoir.

## La règle : ce qui n'ajoute rien ne doit rien retirer

Deux niveaux, et **c'est le premier qui porte la garantie** — le second ne
couvre qu'une sortie propre.

**1. Consulter n'écrit rien.** Une balise déjà terminée dans le mode courant
(`rangeeTerminee`) s'ouvre **en local seulement** : sa ligne ne bouge pas, elle
reste `done` avec sa date d'origine. Aucun accident ne peut donc lui faire
perdre son état, puisqu'il n'y a rien à perdre — application tuée, téléphone à
plat, réseau coupé au mauvais moment.

**2. L'ouverture devient réelle au premier geste qui compte.** Scan, « + »,
« − », suppression : tout passe par `enregistrer`, qui appelle
`materialiserOuverture` **avant** d'écrire. C'est un passage obligé, et c'est
ce qui garantit qu'aucune pièce n'atterrit dans une balise que le tableau de
bord croit finie. Un test compte les appels directs à `onArticleResolved` : il
ne doit en rester qu'un, celui d'`enregistrer`.

Points à ne pas défaire :

- **Clôturer ce qui n'a jamais été ouvert ne rappelle pas `set_balise`.**
  L'appel repositionnerait `count_done_at` à maintenant — exactement la date
  qu'on cherche à préserver. `closeBalise` sort avant, sur le drapeau.
- **`rangeeTerminee` n'exige pas que la balise porte des pièces**, contrairement
  à `baliseDejaFaite` qui gouverne l'avertissement : un rayon vide clôturé est
  terminé lui aussi, et le décompter pour l'avoir regardé serait le même
  défaut.
- **L'ouverture différée est un état ET un ref.** L'état sert au garde-fou du
  retour (qui doit se relire au rendu), le ref aux appels asynchrones. Un ref
  seul laisserait le garde-fou périmé après le premier scan.
- **Hors ligne, la dégradation est assumée** : sans tableau de bord des zones,
  `rangeeTerminee` rend `null` et l'ancien chemin reprend — la balise est
  rouverte pour de bon, et c'est alors le garde-fou du retour qui protège.

## Le garde-fou du retour, et le piège de la pile

⚠️ **LE RETOUR CLÔTURE LA BALISE — il ne propose pas de rester.** Demande de
Julien du 29 août 2026, en ces termes : « Retour doit clôturer au même titre
que les deux boutons clôturer ». Quitter le comptage avec une balise
**réellement** ouverte ouvre donc la confirmation de `closeBalise` elle-même —
« Clôturer la balise 1 ? — 2 pièces comptées. Vous pourrez y revenir si
besoin. », *Annuler* ou *Clôturer*. Une balise seulement consultée ne demande
**rien** : il n'y a rien à clôturer, donc rien à confirmer.

⚠️ **CETTE NOTE A DÉCRIT LE CONTRAIRE PENDANT DIX JOURS**, et elle a coûté :
le 7 septembre 2026, exerçant le retour sur le Pixel, j'ai lu la carte
« Clôturer la balise » comme un défaut et j'ai commencé à l'annoncer à Julien.
C'est le code qui a tranché — son commentaire cite la demande du 29 août. **Une
description de comportement qui vit dans un fichier daté se corrige quand le
comportement change**, exactement comme une liste de « reste à faire » se barre
quand elle est faite (le même piège avait produit deux fausses annonces sur
l'onboarding le 4 septembre).

Ce que la version d'avant proposait, et pourquoi elle est tombée : le 25 août,
le retour posait « Quitter le comptage ? » avec *Rester* en bouton plein.
Julien l'a fait retirer parce qu'une **balise laissée ouverte disparaît de
l'écran** — la liste « Revenir sur une balise » ne montre que les clôturées —
et ses pièces sont introuvables sans rescanner l'étiquette. Partir sans
clôturer n'était donc pas une sortie, c'était une impasse.

- **`closeBalise` porte sa propre confirmation**, et on la réutilise telle
  quelle plutôt que d'en écrire une seconde qui dériverait. Elle rend `false`
  si la personne annule ou si la clôture échoue — on reste alors sur l'écran,
  ce qui donne au geste la protection que « Rester » apportait.
- **Elle nomme le compte** : c'est le seul chiffre qui fasse remarquer qu'on
  n'est pas sur la bonne balise. Le paramètre `silencieux` a disparu avec la
  clôture automatique à la sortie.

Même règle pour « Rouvrir » depuis la liste, dont la question a été
**raccourcie sur capture de Julien** (la note « la simple consultation ne
change rien… » retirée — les cartes de question restent courtes, straight to
the point).

⚠️ **`beforeRemove` ne retient pas cette pile.** Premier essai : l'écran
partait quand même, la question s'affichait par-dessus l'écran d'arrivée, et
le runtime le disait — *« was removed natively but didn't get removed from JS
state […] Consider using a 'usePreventRemove' hook »*. C'est ce hook qui tient
le retour natif **et** le geste de balayage.

⚠️ **Il n'est pas exporté par expo-router**, qui embarque pourtant sa copie de
react-navigation : l'import passe par
`expo-router/build/react-navigation/core/usePreventRemove`. Un test vérifie que
ce fichier existe — sans lui, une mise à jour d'Expo ferait sauter la garde
**en silence**.

La sortie se libère au rendu suivant (`sortieAutorisee` en état, rejoué dans un
effet) : rejouer l'action dans la réponse la ferait reprendre au vol par la
garde encore armée.

⚠️ **`closeBalise(silencieux)` ne se branche jamais nu sur un `onPress`** :
React Native passe l'événement tactile en premier argument, qui vaut vrai — la
clôture au doigt perdrait sa célébration. Attrapé par le typage, gardé par un
test parce qu'un `onPress={closeBalise}` se réécrit vite.

Vérifié au simulateur le 25 août 2026 sur « Rayon textile », tous les chemins :
consulter la balise 1 puis revenir ne demande rien et laisse 25 % (ligne
contrôlée en base, date du 17:25 inchangée) ; compter une pièce rend
l'ouverture réelle et le retour pose alors sa question — *Rester* garde bien
sur l'écran, *Quitter* laisse la balise ouverte en connaissance de cause ; le
balayage est intercepté comme le bouton ; la clôture demande confirmation en
nommant les 13 pièces, *Annuler* restant sur l'écran ; et « Rouvrir la
balise 1 ? » précède l'ouverture depuis la liste, *Annuler* n'ouvrant rien.
Données d'essai remises en état (13 pièces, `done`).

**Et confirmé par Julien sur son iPhone le soir même**, build refait :
« le build est fait déjà et le test est bon » — le scénario qui avait tout
déclenché (ouvrir la balise 1000 de « Fwee », ne rien scanner, revenir) ne
décompte plus rien.

Tests de garde : `tests/comptage.test.ts`.
