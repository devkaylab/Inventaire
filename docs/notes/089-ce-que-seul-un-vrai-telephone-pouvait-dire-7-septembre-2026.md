# Ce que seul un vrai téléphone pouvait dire (7 septembre 2026)

Trois choses restaient non vérifiées depuis des jours, et elles demandaient
toutes **d'écrire dans les données réelles de Julien** : le mode avion, le
va-et-vient du tunnel de préparation (il faut créer un inventaire), et l'export
Excel. Feu vert donné le 7 septembre au soir ; parcours mené sur le Pixel, sur
son compte, dans un inventaire jetable supprimé ensuite.

| Ce qui n'avait jamais tourné | Constaté |
|---|---|
| L'export Excel | feuille de partage, `inventaire_INV-…_2026-09-07.xlsx`, **et l'app répond après sa fermeture** |
| Le tunnel : la flèche native | ramène à **l'étape précédente**, son état conservé (bascule, emplacement) |
| Le tunnel : la sortie | `dismissAll` tient — la flèche de la fiche ramène à la **liste**, pas dans le tunnel |
| La question « Avez-vous vos balises ? » | s'affiche sur un inventaire vierge, et **disparaît** dès le premier emplacement |
| Mode avion : article inconnu | la fiche s'ouvre, **plus de « fetch failed »** (défaut du 2 septembre) |
| Mode avion : la file | « 1 balise en attente · Envoi automatique dès le retour du réseau » |
| Mode avion : le rescan | le code est **retrouvé dans le cache local**, pas de seconde fiche |
| Retour du réseau | file vidée, et en base : **1 article, 2 lignes, 2 pièces, 1 zone** |

Deux repères se sont joués au passage, que je n'avais jamais vus se déclencher :
« Balise 1 ouverte » et **« Une erreur se corrige »** (deuxième scan du même
article), tous deux du 31 août.

## ⚠️ L'EXPORT EXCEL EST LA PLUS ANCIENNE DES TROIS, ET LA PLUS SILENCIEUSE

Le défaut historique n'était pas le fichier, c'était **l'application qui ne
répondait plus après la fermeture de la feuille de partage** (la `Modal` de
`GeneratingOverlay`, corrigée le 23 août). Un export qui produit son fichier ne
prouve donc rien tout seul : **il faut refermer la feuille et toucher l'écran
derrière**. C'est ce contrôle-là qui manquait.

## ⚠️ UNE NOTE DE CE FICHIER M'A FAIT ANNONCER UN FAUX DÉFAUT

En exerçant le retour depuis le comptage, la carte qui s'est ouverte disait
« Clôturer la balise 1 ? ». La section « Le garde-fou du retour » d'AGENTS.md
promettait « Quitter le comptage ? · *Rester* / *Quitter* » — j'ai commencé à
l'annoncer à Julien comme un défaut. **C'est le code qui a tranché** : son
commentaire cite une demande de Julien du 29 août 2026, « Retour doit clôturer
au même titre que les deux boutons clôturer ». Le comportement observé était le
bon depuis dix jours ; c'est la note qui était périmée. Elle est corrigée.

Une garde existait pourtant côté code (`tests/comptage.test.ts` refuse le
retour de « Quitter le comptage ? ») : **le code était protégé, la
documentation ne l'était pas**. Troisième fois que ce fichier induit en erreur —
après la liste d'onboarding du 28 août (deux fausses annonces le 4 septembre) et
les neuf orphelins de migrations « à rattraper » déjà rattrapés. La règle vaut
donc pour les **descriptions de comportement** autant que pour les listes de
reste-à-faire : *elles se corrigent quand le comportement change.*

## Revenir du comptage montre ce qu'on vient de compter — CORRIGÉ

**La fiche affichait « 0 pièce comptée »** au retour, jusqu'à ce qu'on touche
le bouton de rafraîchissement — les 2 pièces étaient pourtant en base. Les
requêtes de progression sont chargées au montage, et la fiche reste **montée
sous** l'écran de scan (`router.push`) : rien ne les relisait. On vient de
compter, et lire zéro à cet instant précis fait douter d'un travail qui a bel
et bien été enregistré.

`src/hooks/useRetourSurEcran.ts`, branché sur les **deux** fiches.

- **⚠️ LE PREMIER PASSAGE EST SAUTÉ, et ce n'est pas un raffinement.**
  `useFocusEffect` se déclenche aussi au montage : sans ce garde-fou, chaque
  ouverture d'écran ferait deux allers-retours au serveur pour la même
  réponse — sur un téléphone au fond d'une réserve, un chargement de plus à
  attendre pour rien.
- **⚠️ Ce n'est PAS `refetchOnWindowFocus` de react-query** : celui-là suit
  l'état de l'APPLICATION (premier plan / arrière-plan), pas la navigation.
  Revenir du comptage ne le déclenche jamais — l'application n'a pas quitté le
  premier plan.
- **La fiche du superviseur rejoue `manualRefresh`**, la fonction que porte
  déjà sa flèche de rafraîchissement : deux énumérations du même trio de
  requêtes divergeraient au premier onglet ajouté.
- **⚠️ L'écran du COMPTEUR avait le même défaut, et il y coûte plus cher** :
  c'est celui qu'on consulte **avant de partir**, et la question qu'on s'y pose
  est « ai-je tout remonté ? ». Il invalide `my-count-totals` **et** `session`
  — un superviseur peut clôturer l'inventaire pendant qu'on compte, et les deux
  boutons de passe doivent alors disparaître.

### ⚠️ LA GARDE DÉDUIT SES ÉCRANS, ET UNE DE SES ASSERTIONS NE MORDAIT PAS

Elle retient les écrans qui **ouvrent** le scan — ce sont exactement ceux qui
restent montés dessous, donc ceux qui peuvent afficher un total périmé. Un
troisième écran qui mènerait au comptage demain se signalera de lui-même.

Et le sabotage « le hook ne saute plus le premier passage » **est passé** au
premier essai : la garde comparait `indexOf(saut) < indexOf(appel)`, or
`indexOf` rend **-1** sur ce qui a disparu — et -1 est inférieur à tout. *Une
garde qui compare deux positions doit d'abord vérifier que les deux existent.*
Elle dépouille aussi les commentaires du hook, qui expliquent le garde-fou donc
le citent (onzième variante de ce piège sur ce dépôt).

### Vérifié sur le Pixel, en lecture seule

Le comportement de la pile ne se prouve qu'à l'exécution — les gardes figent le
code, pas la navigation. `RefreshGlyph` passe **de gris à l'accent** pendant le
fetch : c'est mesurable sur une capture, contrairement à une rotation. Réseau
coupé juste avant le retour pour que le signal dure.

| | Roue, pixel le plus coloré |
|---|---|
| Fiche au repos | `rgb(108, 118, 113)` — gris, saturation 10 |
| **À l'instant du retour** | **`rgb(86, 153, 126)`** — l'accent sombre, saturation 67 |

Quatre sabotages, quatre échecs (après resserrement du deuxième). 451 tests de
l'application, `tsc --noEmit`. **Zéro écriture contrôlée en base** : les six
compteurs (4 inventaires, 165 comptages, 142 articles, 72 zones, 62 audits,
135 lignes de stock) sont à leur valeur d'avant.

⚠️ **Piège de build du jour** : `packageRelease` a échoué une fois
(`IncrementalSplitterRunnable`), sans rapport avec le code — ni la compilation
ni les tests. `rm -rf android/app/build/outputs android/app/build/intermediates/apk`
puis relance : deuxième build sorti propre. Ne pas chercher le défaut dans le
code sur cette erreur-là.

## Méthode

- **Piloter par `adb` demande de recapturer avant CHAQUE appui.** Un appui posé
  à des coordonnées relevées sur une capture antérieure atterrit ailleurs dès
  que la page a défilé — c'est ce qui a ouvert des cartes que je ne visais pas
  (une clôture de balise, une saisie dans le mauvais champ). Le piège était
  déjà écrit pour le 4 septembre ; il s'est reproduit trois fois ce soir.
- Le mode avion se pose sans root : `adb shell cmd connectivity airplane-mode
  enable` / `disable`, et `settings get global airplane_mode_on` le confirme.
- **Zéro résidu contrôlé** après suppression : 0 inventaire `ZZTEST%`, 0 article
  d'essai, et les six compteurs de la base (4 inventaires, 165 comptages,
  142 articles, 72 zones, 62 audits, 135 lignes de stock) à leur valeur d'avant.
