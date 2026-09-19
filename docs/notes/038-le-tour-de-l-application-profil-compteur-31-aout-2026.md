# Le tour de l'application — profil compteur (31 août 2026)

*« L'onboarding, et le tour de l'app, il est incomplet. »* Maquette validée
avant codage : https://claude.ai/code/artifact/ebdfe136-f726-4c5f-b55e-eb5e2e56a3f4

Les huit repères existants couvrent la **première ouverture**. Passé ce moment
l'application n'explique plus rien — et ce qu'elle tait est ce qui coûte cher.
Quatre pièces posées côté compteur ; l'état vide de l'accueil, cinquième point
de la maquette, **existait déjà** depuis le 28 août.

| pièce | quand | nature |
|---|---|---|
| Deux listes, et la différence compte | à la première mise en attente | repère `file-attente` |
| Aucune balise en attente | quand la file **se vide après** s'être remplie | **état**, rejoué, une ligne |
| Trois façons de scanner | entrée en phase article | repère `modes-de-scan` |
| Une erreur se corrige | deuxième scan du même article | repère `corriger-scan` |

## ⚠️ Sur l'écran de comptage, un repère RECOUVRE — il ne pousse pas

Premier jet : deux cartes glissées dans la colonne, comme sur la maquette.
**Compté avant de le construire, et ça ne tenait pas.** L'écran de comptage est
une colonne à **hauteur fixe** — bandeau de zone, bascule des modes, scan
automatique, caméra, déclencheur, liste, clôture. Sur un iPhone SE la somme
atteint déjà la hauteur utile : une carte de plus et le bas sort de l'écran,
même avec la caméra réduite à son minimum.

Ces deux repères passent donc par le **volet** déjà en place, qui gagne deux
genres (`modes`, `corriger`). Il recouvre au lieu de pousser : il ne peut rien
faire déborder, et c'est déjà le format des deux repères du premier scan.

**La carte en ligne (`components/Astuce.tsx`) ne sert que sur un écran qui
défile** — « Ma progression » est un `ScrollView`, là elle ne casse rien. Un
test fige les deux règles.

## Ce qui porte ces repères

- **⚠️ Jamais deux aides à la fois.** « Trois façons de scanner » attend que le
  volet de la balise soit refermé ; « une erreur se corrige » ne s'ouvre pas
  par-dessus un volet en cours (`voletRef`, lu depuis `setRecentScans` où
  l'état capturé au rendu ment déjà).
- **⚠️ Le moment fait la moitié du travail.** « Deux listes » n'apparaît que
  lorsqu'une balise est **réellement** en attente : une explication donnée
  avant que la question ne se pose n'est pas lue. Et « une erreur se corrige »
  attend le deuxième scan du même article.
- **« Aucune balise en attente » n'est pas un repère mais un ÉTAT**, sans
  marquage : il revient chaque fois que la file se vide. C'est lui qui rend
  « en attente » remarquable — sans le contraste, l'ambre ne se voit pas.
  · **⚠️ Il tient en UNE LIGNE, sans corps de texte** (demande de Julien, dans
    ces termes : « un message plus court, type *no pending stickers* »). Un
    état permanent se relit à chaque ouverture : un paragraphe y cesse d'être
    lu et vole la place de ce qu'il faut vraiment voir, l'encart ambre d'en
    face. D'où `children` facultatif sur `Astuce` — un **repère** explique donc
    il a un corps, un **état** se contente de son titre.
  · Le libellé est le **miroir exact** de l'encart ambre (« N balises en
    attente d'envoi ») : même mot, même grammaire, la comparaison se fait sans
    y penser.
  · **⚠️ Et il n'apparaît QU'APRÈS une attente**, jamais en permanence (second
    constat de Julien, le même soir). Affiché tout le temps, il annonce un
    non-événement à quelqu'un qui n'a jamais rien vu attendre — du vert en haut
    de l'écran, tous les jours, qu'on cesse de voir. Le verrou `attenteVue` se
    met quand la file se remplit et ne se relâche pas : **c'est la séquence qui
    informe** — l'encart ambre, sa disparition, puis la ligne verte — pas la
    ligne seule. Deux constats de dosage sur le même élément en une heure : un
    état permanent coûte plus cher qu'il n'en a l'air.
- **Les nouveaux volets se marquent à la FERMETURE**, pas à l'ouverture comme
  les deux anciens : ils expliquent au lieu d'annoncer, donc tant qu'on n'a pas
  fermé, on n'a rien lu.
- **L'astuce n'invente aucun style** : fond `surface`, filet `hairline`, rayon
  `lg` — la carte des autres écrans. Un repère qui se dessine autrement se lit
  comme une publicité.
- **⚠️ L'icône se cale sur la PREMIÈRE ligne du titre** (`flex-start` plus un
  décalage de −5, la moitié de l'écart entre l'icône de 30 et l'interligne de
  20). Avec `center` elle flottait au milieu d'un titre de trois lignes, loin
  du mot qu'elle annonce.

## Typographie : les espaces qui empêchent les coupures

Demande de Julien : *« je ne veux voir aucun débordement, mot coupé à la ligne
etc. »* En français, `:` `;` `?` `!` sont précédés d'une espace **insécable** —
avec une espace ordinaire, le signe peut commencer une ligne. Même chose entre
un nombre et son unité (`142 pièces`). Appliqué aux textes ajoutés **et** aux
deux dialogues de l'écran de progression.

## Vérifications

Le Pixel ayant été débranché, contrôle au **simulateur par une route jetable**
(retirée, `git status` contrôlé) rendant l'astuce dans quatre cas : nominal,
succès, **titre de trois lignes avec un nombre à sept chiffres et
« anticonstitutionnellement »**, et une seule ligne. **Clair et sombre.** Aucun
débordement, aucun signe double en tête de ligne, l'icône alignée sur la
première ligne dans les quatre cas.

**Les deux nouveaux volets sont validés** par Julien sur le Pixel le 31 août
2026 au soir — « j'ai vu les volets, c'est bon ». C'était le dernier point que
je n'avais pu que déduire : je ne les ai pas provoqués moi-même, le second
demandant de scanner deux fois le même article, donc d'écrire dans sa session.

⚠️ **Piège de méthode du jour** : `./scripts/pixel.sh | tail -5` rend le code de
sortie de `tail`, pas celui du script. Un build qui n'a **pas** pu installer
(téléphone débranché) est alors rapporté « exit code 0 ». Lire la dernière
ligne, pas le code.

Tests de garde : `tests/compte.test.ts`, bloc « le tour de l'application, côté
compteur ».
