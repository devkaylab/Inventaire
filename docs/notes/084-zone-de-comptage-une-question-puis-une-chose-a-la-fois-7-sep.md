# Zone de comptage : une question, puis UNE chose à la fois (7 septembre 2026)

*« Au lieu d'afficher le gros pavé de texte créer des balises directement,
proposer une question "Ai-je mes balises ?" Si oui → affecter une plage, si non
→ créer des balises puis affecter en second temps. Ne pas tout afficher en même
temps, plus clair pour l'user. »* Plus une seconde demande : *« installe toggle
Balise unique, ce qui efface l'obligation de renseigner deux fois la même
balise »*. Site **et** application. Maquette validée avant codage :
https://claude.ai/code/artifact/71d4ba82-021f-4174-b96b-a084c422e6c5

## Le constat

Le volet s'ouvrait sur « Créer des balises » — un paragraphe d'explication,
trois étapes numérotées, un choix de numérotation, deux champs, un bouton — et
l'affectation seulement en dessous. **Quelqu'un dont les balises sont déjà
collées traversait tout cela pour rien.** Et pour rattacher la balise 42 à un
emplacement, il fallait écrire 42 dans « début » **et** dans « fin ».

## ⚠️ LA QUESTION NE SE POSE QUE TANT QUE RIEN N'EST AFFECTÉ

C'est la règle qui empêche la bonne idée de devenir une gêne. Dès qu'un
emplacement existe, la réponse est connue : le formulaire s'ouvre directement,
et « Créer d'autres balises » reste joignable par un lien discret.

C'est **la leçon du bandeau de démarrage** (28 août 2026) : une aide qui se
rejoue des semaines plus tard, à quelqu'un qui connaît le produit, cesse d'en
être une.

- **⚠️ RIEN N'EST STOCKÉ**, et c'est délibéré : l'inventaire répond tout seul
  (`etape = choix ?? (dejaAffecte ? 'affecter' : 'question')`). Quelqu'un qui
  répond « Non », imprime sa planche et revient le lendemain retrouve la
  question — **et c'est juste, il peut maintenant répondre « Oui »**. Un jalon
  figerait cette réponse sur un fait qui change. Une garde refuse `poserJalon`,
  `localStorage` et leurs voisins dans les deux écrans.
- **La question ne s'accompagne d'AUCUN état vide.** « Aucun emplacement
  affecté — indiquez une première plage ci-dessus » désignerait deux boutons
  qui ne demandent aucune plage.
- **Un inventaire clôturé n'a ni question, ni formulaire, ni création** : il
  n'y a plus rien à y faire, seule la liste des emplacements reste.
- **La création dit ce qui vient après.** Imprimer n'est pas l'objectif, c'est
  l'avant-dernière étape : la carte finit sur « Une fois les balises collées ·
  Affecter mes balises ». Sans cette sortie on repart avec un PDF sans savoir
  qu'il reste à dire où les balises sont collées. La troisième étape du mode
  d'emploi dit désormais « **Revenez ici** », plus « juste en dessous ».
- **Sur « Mon compte » / le profil, aucune des deux sorties n'existe** : on y
  imprime des balises sans inventaire en vue.

## ⚠️ UNE BALISE SEULE EST UNE PLAGE DE UN — RIEN NE CHANGE EN BASE

`define_zone` ne connaît que les plages, et n'a pas à connaître autre chose :
la bascule est une affaire d'écran, `start` et `end` valent le même numéro. Une
garde refuse l'apparition d'une RPC `define_balise` ou `define_zone_unique`.

- **⚠️ TOUT LE TEXTE suit le champ qu'on a sous les yeux**, pas seulement le
  message d'erreur. « Indiquez la première et la dernière balise de la plage »
  devant un seul champ ferait chercher le second. D'où le quatrième paramètre
  de `validateRange` — il ne change **que** le message.
  · **⚠️ Et le titre et l'aide ont mis un jour à suivre.** Exercée sur le Pixel
    le 7 septembre 2026, la bascule marchait — deux champs devenaient un — mais
    **trois textes continuaient de parler de plage** au-dessus d'un champ
    unique : le titre (« Affecter une **plage** à un emplacement »), l'exemple
    (« Réserve = balises 1 à 10 ») et l'état vide (« Indiquez une première
    **plage** »). Le message de saisie, lui, suivait déjà : c'est ce décalage
    entre un texte juste et trois textes faux qui rend la lecture confuse
    plutôt qu'une simple maladresse. Corrigé des deux côtés, avec une garde
    par surface.
  · **La leçon vaut au-delà de ce champ** : quand une bascule change ce qu'on
    voit, ce qui la décrit change avec — l'inventaire des textes concernés se
    fait à l'écran, pas dans le diff.
- Sur l'application, la bascule est un `Switch` — le motif déjà employé par
  « Utiliser des zones / balises » à la création d'un inventaire.
- Les cartes de choix portent `Radius.bouton` : **elles se touchent**. La garde
  du 7 septembre le déduit du nom du style, et elle a raison de mordre là.

## ⚠️ UN DÉFAUT QUE SEULE LA MESURE A MONTRÉ, ET UNE GARDE QUI NE MORDAIT PAS

`.zone-form-unique` (trois colonnes) a d'abord été déclarée **en bas** de
`globals.css`, et citée dans les deux requêtes média avec sa base. Ça semblait
suffire ; ça ne suffisait pas. **Les deux sélecteurs ont la même spécificité :
la déclaration posée plus bas dans la feuille gagne à toutes les largeurs.**
Mesuré au navigateur : à 760 px la rangée gardait ses trois colonnes.

Elle vit désormais **à côté de sa base, avant la section responsive**. Mesures
après correction : 1280 → 3 colonnes, 850 → 2, 760 → 1, débordement nul.

⚠️ **Et la première garde a validé le défaut** : elle vérifiait la *présence*
de `.zone-form-unique` dans les requêtes média, ce qui était vrai. Elle vérifie
maintenant l'**ordre** — l'index de la déclaration doit précéder celui de
chaque requête. *Une garde sur une cascade CSS porte sur l'ordre, pas sur la
présence.*

## ⚠️ LE TUNNEL DE PRÉPARATION S’EMPILE — on revient sur ses pas

Constat du même jour : *« page zone & balises ne dispose pas d'un bouton
retour, ainsi qu'importer les données, pareil pour ajouter des compteurs »*.

Ce sont exactement les **trois étapes du tunnel** qui suit la création d'un
inventaire. Le retour y a été fermé volontairement le 23 août pour que le
tunnel reste linéaire — mais **rien n'a été mis à la place**, et on ne pouvait
plus en sortir avant la dernière étape. Ouverts normalement depuis la fiche
d'un inventaire, ces trois écrans ont bien leur flèche : c'est le tunnel, et
lui seul, qui enfermait.

⚠️ **UN PREMIER CORRECTIF A ÉTÉ ÉCARTÉ LE JOUR MÊME, ET C'EST LA LEÇON.** Il
posait une sortie « Plus tard » **À LA PLACE** du bouton retour : elle rendait
le droit de **partir**, pas celui de **revenir**. Julien, en le lisant : *« je
ne veux pas plus tard, je veux pouvoir revenir à l'étape précédente si jamais
j'ai envie de faire des changements »*. Une sortie n'est pas un retour — la
question posée était bien « où est la flèche », pas « comment je m'échappe ».
Le composant `SortieTunnel` a vécu une heure ; il a été supprimé.

⚠️ **CE N'EST PAS UN REFUS DE LA SORTIE ELLE-MÊME**, et cette note l'a laissé
croire pendant quelques heures. Le soir du même jour, Julien a demandé
l'inverse : *« sur les pages set up de l'app, ajoute un bouton plus tard en
bas, parce qu'on a l'impression qu'on est obligé de tout faire maintenant »*.
Ce qui avait été refusé, c'est le remplacement de la flèche ; **« Plus tard »
vient EN PLUS d'elle**, et répond à autre chose — voir la section suivante.
Une note qui dit « X a été refusé » doit dire **à la place de quoi**.

**La réponse est la pile de navigation, pas un composant.** Les trois étapes
s'**empilent** (`router.push`) au lieu de se remplacer, et la flèche native
reprend tout son travail — plus de `headerBackVisible: false`, plus de
`headerLeft`, plus de `gestureEnabled: false`. Un seul contrôle, celui de tout
le reste de l'application, et le balayage marche avec.

- **⚠️ C'EST `push` QUI MET L'ÉTAPE PRÉCÉDENTE DERRIÈRE LA FLÈCHE.** Avec
  `replace` il n'y a rien derrière : la flèche existerait, et ramènerait à la
  liste en sautant les étapes qu'on veut justement retrouver.
- **⚠️ LA CRÉATION, ELLE, REMPLACE TOUJOURS.** `new-session` → zones reste un
  `replace` : on ne revient pas sur le formulaire d'un inventaire déjà créé —
  empiler là laisserait en recréer un second. Un test le refuse.
- **⚠️ ET LA SORTIE VIDE LE TUNNEL** (`router.dismissAll()` puis
  `router.push`). La pile vaut `[liste, zones, fichiers, compteurs]` : un
  `replace` ne changerait que le dernier écran, et la flèche de la fiche de
  l'inventaire renverrait **dans** le tunnel qu'on vient de finir, étape par
  étape. `dismissAll` revient au premier écran de la pile (la liste), le `push`
  pose la fiche par-dessus — exactement l'état qu'on obtient en ouvrant
  l'inventaire depuis la liste. Ne pas « simplifier » en un `replace`.
- **La flèche de la première étape mène à la liste**, faute d'étape précédente.
  C'est littéralement l'écran d'où l'on vient, et l'inventaire y figure.

⚠️ **LE TEST EXISTANT CERTIFIAIT L'ENFERMEMENT.** Il vérifiait que les trois
étapes ferment le retour natif, et rien d'autre — donc il confirmait que tout
allait bien pendant qu'on ne pouvait pas sortir. Il **déduit** maintenant ses
écrans (ceux de `src/` qui lisent `from === 'new'`, et il exige qu'il y en ait
trois) et refuse les trois verrous ; deux autres gardes tiennent le `push` et
la sortie. La quatrième étape qu'on ajoutera demain est couverte sans qu'on y
pense.

## Vérifications

- **Au navigateur, sur le VRAI composant** (`ZonesSetup` exporté le temps d'une
  route jetable, retirée — `git status` contrôlé, plus `rm -rf web/.next`, le
  piège des types de route qui survivent), **clair et sombre**, à 1280, 850 et
  760 px : les trois états, les deux branches de la question, la bascule dans
  ses deux positions (`aria-checked`, 3 champs → 2, 4 colonnes → 3), le retour
  à la question, et un inventaire clôturé qui n'affiche que sa liste.
  **Débordement horizontal nul aux trois largeurs.** C'est ce contrôle qui a
  trouvé le défaut de cascade ci-dessus.
- **Huit sabotages, huit échecs** — dont celui de la cascade, qui a d'abord
  passé et a fait resserrer sa garde.
- 1 327 tests du site, 447 de l'application, `tsc --noEmit` des deux côtés,
  `eslint .` à **zéro erreur** (47 avertissements, la famille `react-hooks/*`
  déjà documentée), `next build` avec la table de routes **inchangée**.

**VU SUR LE PIXEL**, sur le compte réel de Julien, **sans rien écrire** (règle
du 25 août : consulter n'écrit rien) : le formulaire d'affectation qui s'ouvre
**directement** sur les deux inventaires qui ont déjà des emplacements — donc
la règle « la question ne se pose plus » tient sur de vraies données —, la
bascule dans ses deux positions (deux champs « Balise début / Balise fin » →
un seul champ « Balise »), « Créer d'autres balises » qui ouvre la carte
d'impression **sans** « Revenir à la question » (elle n'a pas lieu d'être là),
la troisième étape qui dit « Revenez ici », le pied « Une fois les balises
collées · Affecter mes balises », et le retour au formulaire.

⚠️ **DEUX CHOSES RESTENT NON VUES, ET IL FAUT SAVOIR POURQUOI.**

- **La question elle-même.** Elle ne s'affiche que sur un inventaire **sans
  aucun emplacement**, et les trois inventaires du compte en ont — c'est
  précisément ce que la règle prévoit. La voir demanderait d'en créer un, donc
  d'écrire sur des données de travail réelles : ce n'est pas à moi de le
  décider. Le rendu est tenu par le contrôle au navigateur, qui exerce
  exactement les mêmes conditions.
- **Le va-et-vient du tunnel**, pour la même raison : il faut créer un
  inventaire pour y entrer. C'est le seul point dont la mécanique (`push`,
  puis `dismissAll` + `push`) ne se prouve qu'à l'exécution — les gardes
  figent le code, pas le comportement de la pile.

Et `./scripts/simulateur.sh` échouait alors sur le même défaut que la veille
(`xcodebuild` s'arrêtant sur `IDEDerivedDataPathOverride` nil). ⚠️ **Ce n'est
plus vrai depuis le 8 septembre 2026** : le script remarche sans qu'on y ait
touché. La règle, elle, ne bouge pas — **pas de contournement par `xcodebuild`
à la main**.

Tests de garde : `web/tests/zone-de-comptage.test.ts` et
`tests/zone-de-comptage.test.ts` — les deux se lisent en parallèle, c'est le
même geste sur les deux surfaces. Le tunnel, lui, reste dans
`tests/compte.test.ts`, bloc « le tunnel de préparation ».


## « Plus tard » : une sortie à chaque étape (7 septembre 2026, au soir)

*« Sur les pages set up de l'app, ajoute un bouton plus tard en bas, parce
qu'on a l'impression qu'on est obligé de tout faire maintenant. »* Maquette
validée avant codage, trois décisions arbitrées :
https://claude.ai/code/artifact/8f05aa33-aa91-4f9a-90ae-3274b22d0c34

⚠️ **CE N'EST PAS LA SORTIE REFUSÉE LE MATIN MÊME** — voir juste au-dessus.
Celle-là remplaçait la flèche ; celle-ci vient en plus. La flèche rend le droit
de **revenir**, « Plus tard » rend celui de **s'arrêter**, et le tunnel a
besoin des deux : la flèche remonte étape par étape jusqu'à la liste, sans
jamais dire que ce qu'on laisse est déjà enregistré.

**Les trois décisions, telles que validées :**

1. **La sortie mène à la FICHE de l'inventaire**, pas à la liste. C'est
   l'endroit d'où la préparation se reprend — Zones, Fichiers et Compteurs y
   sont tous les trois. Rendu à la liste, on aurait à retrouver son inventaire
   avant de comprendre qu'on peut y revenir.
2. **Un lien « Plus tard », et une phrase sous lui.** ⚠️ **C'est la phrase qui
   fait le travail** : « Plus tard » seul se lit « annuler » — or l'inventaire
   est déjà créé, et c'est précisément ce qu'on ne sait pas. Sans elle, on
   n'ose pas plus qu'avant et le lien n'aurait rien réglé.
3. **Aux trois étapes, pas seulement à la dernière.** Le sentiment d'être
   coincé naît à la première.

**Ce qui porte le composant** (`components/ui/PlusTard.tsx`) :

- **⚠️ UN LIEN, JAMAIS UN SECOND BOUTON PLEIN.** Le bouton d'avance est le
  geste principal de l'écran ; deux aplats côte à côte se disputeraient le
  regard, et c'est celui qui fait avancer qui perdrait. Un test refuse un
  `backgroundColor: t.accent` dans ce fichier.
- **48 dp de cible** (`minHeight`), comme tout ce qui se touche depuis la passe
  du 31 août : un mot n'est pas un bouton tant qu'on ne lui a pas donné sa
  hauteur.
- **⚠️ IL NE S'AFFICHE QUE DANS LE TUNNEL** (`fromNew &&`). Ouverts depuis la
  fiche d'un inventaire, ces trois écrans n'ont aucun tunnel dont sortir — la
  flèche native y suffit, et un « Plus tard » y proposerait de quitter ce qu'on
  vient d'ouvrir.
- **La dernière étape a SA phrase** : son bouton d'avance **démarre le
  comptage**, donc le doute n'est pas le même. « Sans démarrer le comptage.
  Vous reprendrez depuis la fiche de l'inventaire. » — partir sans démarrer
  était précisément le cas qui n'avait aucun chemin.

**⚠️ ET LA SORTIE EST UNE SEULE DÉFINITION** — `lib/tunnel.ts`,
`quitterLeTunnel(sessionId)`, appelée par « Plus tard » comme par « Commencer
l'inventaire ». Elle porte le `dismissAll()` + `push` documenté ci-dessus.
Deux copies divergeraient au premier ajustement, et c'est justement l'endroit
où une divergence ne se voit pas : les deux mèneraient au bon écran, l'une
laisserait les trois étapes derrière la fiche.

## ⚠️ « Vous pouvez commencer sans personne » a été retirée

Commentaire de Julien sur la maquette, ancré à cette phrase : *« retire ce
texte du coup »*. Elle expliquait ce que l'écran montre déjà — le bouton est
actif sans personne dans la liste — et **deux phrases empilées sous deux
gestes font qu'on n'en lit plus aucune**. Ce qu'elle apprenait vraiment est
passé dans la note de « Plus tard » : on peut partir SANS démarrer, et c'était
le vrai doute.

La garde qui exigeait sa présence depuis le 23 août a donc été **retirée**, et
une garde inverse posée. ⚠️ Elle lit le **code seul** : le commentaire de
l'écran cite la phrase pour dire qu'on ne la remet pas — septième variante du
piège des commentaires sur ce dépôt.

## Vérifications

**Vu sur le Pixel, aux TROIS étapes, sans écrire une seule ligne** — et c'est
le point de méthode du jour : entrer dans le tunnel demande normalement de
créer un inventaire, donc d'écrire dans les données de travail de Julien.
**Un lien profond y entre sans rien créer** :

```bash
adb shell am start -a android.intent.action.VIEW \
  -d "quantinvo://<sessionId>/zones?from=new"
```

⚠️ **Le segment de groupe ne fait PAS partie de l'URL.** `quantinvo:///(supervisor)/<id>/zones`
n'ouvre rien ; `quantinvo://<id>/zones?from=new` ouvre l'écran en mode tunnel.
Et l'application doit être **arrêtée d'abord** (`am force-stop`) : sur une
instance déjà lancée, l'intent est avalé sans rien changer à l'écran.

Constaté : « Plus tard » en lien vert sous le bouton plein, sa phrase dessous,
aux trois étapes — la dernière portant bien la sienne (« Sans démarrer le
comptage… ») et **plus** « Vous pouvez commencer sans personne ». L'appui mène
à la fiche de l'inventaire, flèche de retour comprise. Et **hors tunnel**
(Zones ouvert depuis la fiche), aucun « Plus tard » ni « Suivant » : la garde
`fromNew &&` tient sur de vraies données.

⚠️ **Ce que le lien profond ne prouve pas** : la pile est alors vide, donc le
`dismissAll()` de la sortie n'a rien à vider. Que la flèche de la fiche ramène
à la **liste** et non dans le tunnel se voit seulement après un vrai parcours
— il a été exercé le 7 septembre au soir, sur un inventaire jetable.

Zéro écriture contrôlée en base après coup : 165 comptages, 142 articles,
135 lignes de stock, 7 membres — inchangés.

Tests de garde : `tests/compte.test.ts`, bloc « “Plus tard” : une sortie à
chaque étape ».
