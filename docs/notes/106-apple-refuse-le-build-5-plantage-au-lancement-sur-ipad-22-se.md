# Apple refuse le build 5 : plantage au lancement sur iPad (22 septembre 2026)

Soumis le 19 septembre à 01h59 (heure du Pacifique), revu le 22.
Submission ID `f0ade280-9b1f-43fb-97e0-da4331c6cd15`, version **1.0 (5)**.

> **Guideline 2.1(a) — Performance — App Completeness.** We were unable to
> review the app because it crashed on launch. […]
> Review Device: **iPad Air 11-inch (M3)**, **iPadOS 27.0**.

## ⚠️ « Pourquoi l'iPad ? On n'a pas soumis pour l'iPad »

La question de Julien, et c'est la bonne. La réponse est la chose à retenir de
cette fiche :

⚠️ **`supportsTablet: false` NE MET PAS L'APPLICATION HORS DE PORTÉE DES iPAD.**
Sur l'App Store, une application iPhone s'installe sur un iPad et y tourne dans
une fenêtre de téléphone (mode compatibilité). **Rien dans App Store Connect ne
permet de l'en empêcher** : la liste des appareils est déduite du binaire, elle
ne se déclare pas. Ce que le drapeau décide, c'est si l'application
**s'adapte** à l'iPad — pas si elle y **tourne**.

Apple teste donc sur l'appareil qu'elle veut, et son message le dit :

> apps that may be downloaded onto iPad devices should function as expected
> for iPad users

⚠️ **Et j'avais enchaîné trop vite.** Ma première réponse a présenté l'ouverture
iPad comme la suite logique du refus. C'est faux : Apple n'exige pas qu'on
ouvre l'iPad, elle exige que l'application ne se ferme pas au lancement dessus.
Deux choses différentes. La première est un choix produit (et un jeu de
captures 2048 × 2732 à produire) ; la seconde est le blocage réel.

## Ce qui a été décidé

**On reste iPhone-only.** `supportsTablet` reste faux, `TARGETED_DEVICE_FAMILY`
reste à `1`. C'est le chemin le plus court pour repasser la revue : pas de
captures iPad, pas de passe sur tous les écrans en large et en paysage.

La compatibilité a été rouverte puis refermée le même jour (commit
« iPad : la compatibilité est rouverte », puis sa marche arrière) : les deux
mouvements sont dans l'historique de la branche, et c'est bien ainsi — la
décision a changé quand la question de Julien a corrigé la prémisse.

La garde de `tests/ardoise-app.test.ts` exige toujours `false` et `1`, mais son
commentaire porte maintenant le motif corrigé : le drapeau épargne les
captures, il n'épargne pas la revue sur iPad.

## Ce qui reste vrai quel que soit le drapeau

**L'application doit démarrer sur un iPad avant chaque dépôt.** C'est une étape
de pré-dépôt, au même titre que le numéro de build. `scripts/simulateur.sh` a
été repris pour la rendre possible en une commande :

```
./scripts/simulateur.sh ipad                 # par nom partiel, insensible à la casse
./scripts/simulateur.sh "iPad Air 11-inch (M3)"
CONSOLE=1 CONFIG=Release ./scripts/simulateur.sh ipad
```

⚠️ **En `CONFIG=Release`, pas en Debug.** Chez Apple le JavaScript est embarqué
dans le binaire ; en Debug il vient de Metro. Un défaut de bundle ne se voit
pas en Debug.

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
fatale ou un module natif absent écrit sa raison à l'écran. L'option reste
**opt-in** — elle bloque le terminal, et ce script sert dix fois par jour à
autre chose. Et si l'application est déjà morte quand on y pense, le rapport
est sur le disque : `~/Library/Logs/DiagnosticReports/Inventaire-*.ips`.

## ⚠️ CE QUE JE NE SAIS PAS

**La cause du plantage n'est pas établie.** Apple joint un rapport de crash à
son message ; au moment d'écrire cette fiche il n'avait pas été récupéré. Rien
de ce qui précède ne le corrige.

Trois choses restent ouvertes :

1. **Le plantage est-il propre à l'iPad, ou universel ?** Rien ne le dit. Apple
   a revu sur iPad parce que c'est l'appareil qu'elle a pris, pas parce que le
   défaut y serait.
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

## Le numéro de build

⚠️ **Le 5 est consommé.** Il est parti chez Apple ; refusé ne veut pas dire
libre. Les trois endroits disent `5` aujourd'hui et sont cohérents — c'est
l'état d'un numéro consommé, pas d'un numéro disponible. La règle de la
fiche 094 ne change pas : monter à 6 **juste avant l'archive**, dans
`app.json`, `ios/Inventaire/Info.plist` et `project.pbxproj` (×2), puis
`npx vitest run` — la garde compare les trois.

## Ce qui reste à faire

1. **Lire le rapport de crash d'Apple**, symbolisé. Rien d'autre ne dit la cause.
2. **Reproduire** : `CONSOLE=1 CONFIG=Release ./scripts/simulateur.sh ipad`.
3. Corriger, monter le numéro à 6, archiver.
