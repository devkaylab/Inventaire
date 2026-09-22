# Apple refuse le build 5 : plantage au lancement sur iPad (22 septembre 2026)

Soumis le 19 septembre à 01h59 (heure du Pacifique), revu le 22.
Submission ID `f0ade280-9b1f-43fb-97e0-da4331c6cd15`, version **1.0 (5)**.

> **Guideline 2.1(a) — Performance — App Completeness.** We were unable to
> review the app because it crashed on launch. […]
> Review Device: **iPad Air 11-inch (M3)**, **iPadOS 27.0**.

Et la phrase qui suit, qui n'est pas de la boilerplate perdue :

> apps that may be downloaded onto iPad devices should function as expected
> for iPad users.

## ⚠️ CE QUE JE NE SAIS PAS, ET IL FAUT LE LIRE EN PREMIER

**La cause du plantage n'est pas établie.** Apple joint un rapport de crash à
son message ; au moment d'écrire cette fiche il n'avait pas encore été
récupéré. Tout ce qui suit est une réponse à ce qui est *décidé* et à ce qui
est *vérifiable dans le dépôt* — pas un diagnostic.

Trois choses restent donc ouvertes :

1. **Le plantage est-il propre à l'iPad, ou universel ?** Rien ne le dit. Apple
   a revu sur iPad parce que c'est l'appareil qu'elle a pris, pas parce que le
   défaut y serait. Un défaut de lancement commun aux deux familles
   ressemblerait exactement à ça.
2. **Où casse-t-il ?** Natif (un module lié qui meurt à l'init) ou JavaScript
   (une exception fatale avant le premier rendu) se distinguent d'un coup d'œil
   sur le rapport symbolisé, et de nulle part ailleurs.
3. **Le build 5 a-t-il jamais été lancé sur un appareil ?** La fiche 099 dit
   déjà la règle : ce qui tranche est la date du binaire installé, jamais celle
   d'`Info.plist`.

⚠️ **Ne pas écrire de cause dans cette fiche tant que le rapport n'a pas été
lu.** La tentation est forte — `react-native-volume-manager`, `@expo/ui` et
`expo-glass-effect` sont liés dans le binaire sans être employés par une seule
ligne de `src/`, et ça fait trois coupables plausibles. Plausible n'est pas
mesuré.

## Ce qui a été décidé : l'iPad s'ouvre pour de bon

Décision de Julien, le 22 septembre. Le raisonnement tient en une ligne :

⚠️ **`supportsTablet: false` NE MET PAS L'iPAD HORS DE PORTÉE.** Il y fait
tourner l'application dans une fenêtre de téléphone — et Apple la teste quand
même, sur l'appareil de son choix. Le drapeau nous épargnait des captures, pas
la revue. On subissait l'iPad ; on le prend.

Ce qui a changé, et les deux endroits sont obligatoires (même piège que
`UIUserInterfaceStyle` le 6 septembre : `ios/` est versionné et ne se régénère
jamais) :

- `app.json` → `ios.supportsTablet: true`
- `ios/Inventaire.xcodeproj/project.pbxproj` → `TARGETED_DEVICE_FAMILY = "1,2"`,
  **deux occurrences** (Debug et Release)

`ios/Inventaire/Info.plist` portait déjà les quatre orientations sous
`UISupportedInterfaceOrientations~ipad` : rien à y faire, et une garde le
vérifie désormais pour que personne ne les retire en croyant bien faire
(`orientation: "portrait"` dans `app.json` ne vaut que pour le téléphone).

La garde de `tests/ardoise-app.test.ts` a été retournée : elle exigeait `false`
et `1`, elle exige maintenant `true` et `1,2`, plus les quatre orientations.
Sabotée dans les deux sens pour vérifier qu'elle mord.

`src/constants/layout.ts` (`COLONNE_MAX = 720`) attendait ce jour depuis le
8 septembre : le contenu se centre au lieu de s'étirer, et aucun écran de
téléphone ne bouge.

## Ce que ça coûte, et qui doit le faire

⚠️ **Le jeu de captures iPad redevient obligatoire** — App Store Connect ne
laissera pas déposer sans lui. Le plus grand iPad suffit : **2048 × 2732**
(iPad Pro 13", portrait), cinq visuels, mêmes accroches que le jeu iPhone.
`docs/entreprise/boutiques/LISEZMOI.md` est à jour là-dessus ; le dossier
`captures-ipad-13/`, retiré le 13 septembre, est à refaire.

⚠️ **Et le numéro de build est à monter à 6 avant l'archive, pas avant.** Le 5
est **consommé** : il est parti chez Apple, refusé ne veut pas dire libre. Les
trois endroits disent `5` aujourd'hui et sont cohérents — c'est l'état d'un
numéro consommé. La règle de la fiche 094 ne change pas : monter juste avant
l'archive, dans `app.json`, `Info.plist` et `project.pbxproj` (×2), puis
`npx vitest run`.

## Le simulateur sait enfin viser un iPad, et dire pourquoi l'app meurt

`scripts/simulateur.sh` a été repris pour ça :

```
./scripts/simulateur.sh ipad                 # par nom partiel, insensible à la casse
./scripts/simulateur.sh "iPad Air 11-inch (M3)"
CONSOLE=1 ./scripts/simulateur.sh ipad       # la sortie du processus sur ce terminal
```

Deux défauts corrigés au passage, et le premier était silencieux :

⚠️ **LA DESTINATION DE COMPILATION SE LISAIT SUR LE SIMULATEUR DÉMARRÉ**, pas
sur l'appareil demandé. Passer un UDID d'iPad avec un iPhone ouvert compilait
pour l'iPhone puis installait sur l'iPad. Même architecture, donc ça marchait —
mais tout ce qui se décide à la compilation venait du mauvais appareil. La
cible est maintenant résolue une fois et sert aux trois étapes (compiler,
installer, lancer). Elle démarre aussi le simulateur s'il dort
(`bootstatus -b`, qui ATTEND : sans l'attente l'installation arrive avant
SpringBoard et échoue une fois sur deux).

⚠️ **UNE APPLICATION QUI SE FERME AU LANCEMENT NE DISAIT RIEN.** `simctl launch`
rend la main dès que le processus est né ; s'il meurt une seconde plus tard, le
script affichait « Prêt » et le terminal restait muet. C'est exactement le cas
qu'Apple décrit. `CONSOLE=1` branche `--console-pty` : une exception JavaScript
fatale ou un module natif absent écrit sa raison à l'écran. Et si l'application
est déjà morte quand on y pense, le rapport est sur le disque —
`~/Library/Logs/DiagnosticReports/Inventaire-*.ips`.

L'option reste **opt-in** : elle bloque le terminal, et ce script sert dix fois
par jour à autre chose.

## Ce qui reste à faire

1. **Lire le rapport de crash d'Apple**, symbolisé. Rien d'autre ne dit la cause.
2. **Reproduire sur un simulateur iPad** (`CONSOLE=1 ./scripts/simulateur.sh ipad`,
   en `CONFIG=Release` — le JS embarqué, comme chez Apple : un défaut de bundle
   ne se voit pas en Debug, où le JS vient de Metro).
3. Corriger, refaire le jeu de captures iPad, monter le numéro à 6, archiver.
