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

---

# La cause, MESURÉE sur l'archive livrée (22 septembre 2026, au soir)

⚠️ **`app.config` ÉTAIT ABSENT DU BUILD 5.** Ouvert l'archive réellement
envoyée à Apple (`Inventaire 15-09-2026, 19.06.xcarchive`) :

```
Inventaire.app/EXConstants.bundle/
  Info.plist          ← lui seul
```

Plus d'hypothèse : le fichier n'y est pas. Et la chaîne se lit dans le code
installé, pas dans une intuition :

| | |
|---|---|
| `Constants.expoConfig` | nul, faute de manifeste |
| `expo-linking` `resolveScheme()` | **lève**, sans condition, en app autonome — `hasConstantsManifest()` rend faux |
| `expo-router` `getInitialURL()` | appelle `getRootURL()` → `Linking.createURL('/')` **au démarrage**, dès que l'app est ouverte depuis l'écran d'accueil |
| résultat | exception JS non rattrapée, ~116 ms, `RCTFatal` → `abort`, avant tout rendu |

⚠️ **CE N'ÉTAIT PAS UN DÉFAUT D'iPAD.** Le build 5 se fermait aussi sur
iPhone. Apple est simplement tombée dessus sur un iPad.

⚠️ **ET LE MOTIF QUI AVAIT CLASSÉ L'AVERTISSEMENT SANS SUITE ÉTAIT FAUX.**
`scripts/appstore.sh` §4 bis disait, depuis le 2 septembre : « `expo-constants`
n'a qu'un seul appelant (`lib/push.ts`), et il porte un repli ». Il en avait un
second, sans repli, **sur le chemin du démarrage**. Un raisonnement juste sur
un inventaire incomplet.

## Ce qui a été corrigé

| | |
|---|---|
| Phase Xcode | « Copy » devient **« Generate EXConstants app.config »** : elle appelle `getAppConfig.js` d'Expo et écrit directement dans l'app. Plus de copie depuis `${BUILT_PRODUCTS_DIR}/../../EXConstants/`, un chemin qui ne résout pas en archivage. |
| Silence | La phase **interrompt le build** si le fichier n'est pas là à l'arrivée. L'ancienne faisait `if [ -f "$SRC" ]; then cp …; fi` — rien, et vert. |
| `appstore.sh` §4 bis | repassé en **refus**, avec le motif corrigé. |
| Garde | `tests/app-config-embarque.test.ts`, cinq contrôles. Sabotée deux fois. |

⚠️ **LA GARDE ÉTAIT FAIBLE À SA PREMIÈRE ÉCRITURE**, et seul le sabotage l'a
montré : elle lisait 900 caractères à partir du test d'existence, débordait sur
le bloc « Aucun .ipa produit » qui porte son propre `exit 1`, et passait au vert
sabotée. Resserrée sur le bloc `if … fi`. *Une garde qu'on n'a pas sabotée
n'est pas une garde.*

# ⚠️ LA MISE À JOUR XCODE 27 A TOUT MASQUÉ — 22 septembre 2026, au soir

Julien a installé macOS 27 / Xcode 27 pendant la session, sans le dire (il l'a
dit après). Xcode 26.4 a disparu avec la mise à jour : **un seul Xcode sur la
machine**. Tout ce qui suit vient de là, et **rien de tout cela ne concerne le
refus d'Apple**.

## Le vrai verrou : UIScene

Une application compilée avec le **SDK iOS 27** et dépourvue du cycle de vie
par scènes **plante au lancement sur iOS 27**, avant la première ligne de code
de l'application. La pile le nomme :
`___UIApplicationEvaluateRuntimeIssueForNoSceneLifecycleAdoption`.
Sous iOS 26 ce n'était qu'un avertissement ; le SDK de la version majeure
suivante en fait une assertion.

**Mesuré dans les deux sens, sur le même iPad simulé :**

| Binaire | iOS 26.4 | iOS 27 |
|---|---|---|
| SDK 26.x | — | **démarre** |
| SDK 27 | démarre | plante |

Le verrou porte donc sur **le SDK de compilation**, pas sur l'OS de l'appareil.
Le contrôle se fait sur ce qui est gravé dans le binaire.

⚠️ **Apple ne recompile rien.** La revue installe le fichier déposé, tel quel,
sur de vrais appareils sous l'OS du moment. Un binaire SDK 26 passe la revue
même faite sur un iPad iOS 27.

**Expo 56 ne sait pas faire les scènes.** Le correctif n'existe qu'à partir
d'**Expo 57.0.23**, avec `expo-build-properties` et `ios.enableSceneSupport`
(expo/expo#46664). Changer de SDK Expo la veille d'un redépôt n'était pas une
option.

## La sortie : Xcode 26.6 à côté de Xcode 27

`/Applications/Xcode-26.6.app` (SDK iOS 26.5), installé **à côté** de Xcode 27,
pas à la place. Apple n'exige que Xcode 26 au minimum et **aucune date n'est
annoncée** pour Xcode 27.

- Le `.xip` allégé fait 2,2 Go et **n'embarque pas la plateforme iOS** :
  `xcodebuild -downloadPlatform iOS -architectureVariant arm64` (8,5 Go).
- **Pas de `xcode-select`** — donc pas de mot de passe, pas de réglage système
  modifié. On passe par la variable d'environnement, commande par commande :
  `DEVELOPER_DIR=/Applications/Xcode-26.6.app/Contents/Developer`.
  `xcodebuild` et `xcrun` l'honorent tous les deux, `scripts/simulateur.sh`
  n'a rien eu à changer.
- ⚠️ Xcode 26.6 **ne sait pas piloter un simulateur iOS 27** : on compile en
  visant un appareil iOS 26.x, puis on installe le résultat sur l'appareil
  iOS 27 avec le `simctl` du système.
- Pour l'archive, Julien ouvre **Xcode-26.6**, pas Xcode.

## Ce qui a été fait, et défait

**Gardé** — `ios/Podfile`, `post_install` aligne les cibles de déploiement des
pods sur celle de l'application (16.4). Sans effet quand tout est déjà correct,
utile le jour où on passera à Xcode 27.

**Défait** — la montée d'`expo-modules-core` de 56.0.16 à 56.0.26 (et
`expo-modules-jsi` 56.0.9 → 56.0.13). Elle ne servait qu'à contourner une
erreur Swift 6.4 propre à Xcode 27 : `JavaScriptRuntime.swift:219`, « a C
function pointer can only be formed from a reference to a 'func' or a literal
closure ». Sous Xcode 26.6 cette erreur n'existe pas. **On ne change pas de
code natif dans une application en cours de publication sans raison** : le
socle redevient exactement celui du build 5. `git checkout package.json
package-lock.json ios/Podfile.lock`, puis `npm install` et `pod install`.

**Gardé aussi** — `scripts/simulateur.sh` : `open -a Simulator` est devenu
facultatif. `Simulator.app` n'existe plus dans Xcode 27 et Launch Services
garde une fiche périmée ; sous `set -e` le script s'arrêtait **avant la
compilation**. L'appareil est déjà démarré à cette ligne, `install` et `launch`
n'en ont pas besoin.

⚠️ **`npx expo install --check` signale une dizaine d'autres paquets en
retard** (`expo-router`, `expo-linking`, `expo-notifications`…). Volontairement
**pas** mis à jour. À traiter à part, après la publication — en même temps que
la montée en Expo 57, qui réglera les scènes pour de bon.

# ⚠️ CE QUE LE `app.config` ABSENT PROUVE — ET CE QU'IL NE PROUVE PAS

En inspectant les archives conservées, une nuance importante :

| Archive | Build | SDK | `app.config` |
|---|---|---|---|
| 24 juin | 1 | iphoneos26.4 | présent |
| 2 sept. | 1 | iphoneos26.4 | **absent** |
| 3 sept. | 2 | iphoneos26.4 | **absent** |
| 8 sept. | 3 | iphoneos26.4 | **absent** |
| 8 sept. | 4 | iphoneos26.4 | **absent** |
| 15 sept. | 5 | iphoneos26.4 | **absent** |

Les builds 2, 3 et 4 en manquaient aussi. **On ne peut donc pas affirmer que
l'absence d'`app.config` explique à elle seule le plantage du build 5** — c'est
une cause possible, pas une cause démontrée. Le défaut est réel et la
correction reste bonne ; l'affirmation, elle, était trop forte.

## Vérifications faites, 22 septembre au soir

Compilation Release avec Xcode 26.6 (SDK iphonesimulator26.5), dépendances
d'origine, `app.config` présent (1887 octets) :

- **iPad Pro 13" sous iOS 27** — démarre, écran de connexion complet
- **iPhone 18 Pro sous iOS 27** — démarre, écran de connexion complet
- **iPad sous iOS 26.4** — démarre
- Aucun nouveau rapport de plantage (comptés avant/après à chaque lancement)
- 526 tests au vert

Android n'est pas concerné : la production est **en examen chez Google depuis
le 19 septembre** (versionCode 1) et aucun changement natif ne subsiste dans
la branche.

## Ce qui reste à faire

1. **Archiver et déposer** : **Xcode-26.6** → Organizer, par Julien.
   Contrôler avant envoi que l'archive porte `DTSDKName = iphoneos26.5`.
2. **Ouvrir le build depuis TestFlight**, sur un vrai appareil, AVANT de
   soumettre en revue. Une seule ouverture suffit.
3. Répondre à Apple sur le même fil de revue en décrivant la correction.

## La règle qui sort de ce refus

⚠️ **Le défaut n'existait QUE dans l'archive.** Simulateur, installation
directe depuis Xcode, tests : tout passait au vert. Ce qui manquait dans le
bundle livré ne manquait nulle part ailleurs.

TestFlight sert **l'artefact que l'examinateur lance**, avec les autorisations
de distribution — `get-task-allow` absent, APNs de production, certificat de
distribution. Une installation depuis Xcode n'a rien de tout ça, et un build de
développement ne charge même pas le même JavaScript (Metro au lieu du bundle
embarqué).

**Donc : aucun build ne part en revue sans avoir été ouvert une fois depuis
TestFlight sur un vrai appareil.** Pas un parcours complet — juste l'ouvrir.
Un quart d'heure, contre une semaine de refus.

### ⚠️ Et TestFlight ne distribue rien tant que « Détails des tests » est vide

Une heure perdue le 22 septembre à chercher du côté de l'Apple ID. Le testeur
interne restait en **« Aucun build disponible »**, aucune invitation n'arrivait,
et TestFlight sur l'iPhone n'affichait que l'écran « Redeem » — alors que le
groupe montrait bien le build « En cours de test ».

Deux gestes ont été faits coup sur coup : le testeur a été **retiré du groupe
puis remis**, et le champ **« Éléments à tester »** du build (TestFlight → le
build → Détails des tests) a été rempli. L'invitation est partie ensuite.

⚠️ **LEQUEL A AGI N'EST PAS ÉTABLI**, et la première rédaction de cette fiche
l'affirmait à tort. Le **build 7 a distribué son invitation avec « Éléments à
tester » VIDE** : le champ n'est donc pas le mécanisme. Le re-ajout du testeur
est l'explication la plus probable — il recrée la fiche testeur, que le groupe
affichait encore en « Aucun build disponible » alors qu'il montrait le build
« En cours de test ».

À faire quand un testeur ne voit pas un build : les deux, en commençant par le
re-ajout. Et ne pas chercher du côté de l'Apple ID — une heure y a été perdue.
