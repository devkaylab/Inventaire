# Un build pour le téléphone de quelqu'un d'autre (15 septembre 2026)

Julien construit l'app en Release pour l'iPhone d'un collègue, depuis Xcode.
Écran blanc, puis `Thread 1: signal SIGABRT`. **Deux causes, l'une derrière
l'autre**, et la seconde n'est apparue qu'une fois la première réglée. Quatre
heures, pour des choses qui se mesurent chacune en une commande.

⚠️ **LA MÉTHODE D'ABORD, parce que c'est elle qui a fini par payer** : le
message de plantage nomme le coupable. Tant qu'on ne l'a pas, on cherche dans
le noir. Il vit dans la **console d'Xcode** (le panneau du bas), pas dans le
code machine qu'Xcode affiche au point d'arrêt. Deux fois de suite, la ligne
collée par Julien a donné la réponse en dix secondes là où la lecture du dépôt
tournait en rond.

## ⚠️ 1. Les morceaux natifs d'Expo étaient en Debug, le cœur React en Release

```
dyld: Symbol not found: __ZN8facebook5react8SealableC2Ev
  Referenced from: …/Inventaire.app/Frameworks/ExpoModulesCore.framework/ExpoModulesCore
  Expected in:     …/Inventaire.app/Frameworks/React.framework/React
```

C'est le piège du 11 septembre (voir « Après un `pod install`, les frameworks
prébuilts mentent sur leur variante »), **dans l'autre sens** : là c'était un
build Debug pour le simulateur, ici un build Release pour un appareil. Le
mécanisme est le même, et il se reproduira dans les deux sens.

**Mesuré, pas déduit** — et c'est le seul contrôle qui vaut :

```bash
# ce que le repère PRÉTEND
cat ios/Pods/ExpoModulesCore/artifacts/.last_build_configuration   # → release
# ce que le fichier EST
md5 -q ios/Pods/ExpoModulesCore/ExpoModulesCore.xcframework/ios-arm64/ExpoModulesCore.framework/ExpoModulesCore
# à comparer au binaire des deux archives voisines : -debug.tar.gz et -release.tar.gz
```

Les **sept** artefacts Expo (ExpoCamera, ExpoCameraBarcodeScanning,
ExpoFileSystem, ExpoFont, ExpoImage, ExpoModulesCore, ExpoModulesWorklets)
annonçaient `release` et **étaient** `debug`, empreinte à l'appui. Le cœur
React, lui, était bien Release — vérifié autrement : `nm -gU` sur sa tranche
`ios-arm64` ne rend **aucun** `Sealable`.

⚠️ **UN REPÈRE NE PROUVE RIEN.** `pod install` écrit le repère ET pose ce que
son cache lui donne, sans vérifier que les deux s'accordent. Quand un prébuilt
se comporte bizarrement, comparer l'empreinte du binaire en place aux deux
archives d'`artifacts/` — jamais lire le repère.

**Le remède** : rendre les repères faux dans l'autre sens, ce qui force la
ré-extraction au build suivant.

```bash
for f in ios/Pods/*/artifacts/.last_build_configuration; do echo -n "debug" > "$f"; done
rm -f ios/build/.prebuilts-verifies
```

⚠️ `scripts/simulateur.sh` fait déjà ça pour le sens Debug/simulateur. **Un
build lancé depuis Xcode ne passe pas par lui** : personne ne protège le sens
Release/appareil. C'est le chantier durable qui reste à faire — un
`post_install` dans `ios/Podfile` qui invalide les repères, comme celui qui
réécrit déjà `bash -l -c ` en `bash -l `.

## ⚠️ 2. `app.config` n'était pas dans l'app

Une fois le premier réglé, l'app démarre et lève :

```
Unhandled JS Exception: Error: expo-linking needs access to the expo-constants
manifest (app.json or app.config.js) to determine what URI scheme to use.
```

C'est le piège nommé en tête de `scripts/simulateur.sh` — « en Debug, écran
rouge ; en Release, elle se ferme sans rien dire ». **Le contrôle tient en une
ligne**, sur l'app construite :

```bash
ls ~/Library/Developer/Xcode/DerivedData/Inventaire-*/Build/Products/Release-iphoneos/Inventaire.app/EXConstants.bundle/
# app.config doit y être, à côté d'Info.plist
```

Il n'y avait que `Info.plist`. Généré à la main :

```bash
node node_modules/expo-constants/scripts/getAppConfig.js "$PWD" \
  "…/Build/Products/Release-iphoneos/EXConstants/EXConstants.bundle"
```

⚠️ **ET LA PHASE QUI DEVRAIT LE FAIRE EXISTE, EST BIEN CÂBLÉE, ET N'A RIEN
PRODUIT — SANS LE DIRE.** Vérifié : `[CP-User] Generate app.config for prebuilt
Constants.manifest` porte `alwaysOutOfDate = 1` (donc elle tourne à chaque
build) et le correctif du chemin avec espace (`bash -l "…"`, pas `bash -l -c`).
Elle a pourtant laissé `EXConstants.bundle` vide, et le build a réussi. **La
cause n'est pas trouvée** ; si le problème revient au prochain build propre,
c'est elle qu'il faut instrumenter.

## Ce qui N'ÉTAIT PAS le problème, et qu'il ne faut pas rechercher

- **Le build lui-même, une fois ces deux causes réglées.** Vérifié sur
  l'iPhone de Julien : il tourne du premier coup. Tout ce qui a suivi sur
  l'autre téléphone — écran blanc persistant, installation refusée
  (`CoreDeviceError 3002`), connexion qui tombe — venait de l'ancienne app
  restée en place et du lien Mac↔téléphone, pas du binaire. Constat de
  Julien : ça s'est réglé en vidant ça.
- **La signature et le profil** : `codesign --verify --deep --strict` valide,
  et l'UDID de l'appareil figure bien dans `embedded.mobileprovision`.
  Contrôlés avant de soupçonner l'app.
- **Le bundle JS et les polices** : `main.jsbundle` (7,4 Mo) et les neuf `.ttf`
  étaient dans l'app. Un écran blanc ne veut pas dire « il manque le code ».

## Outils, pour ne pas repasser par Xcode à chaque essai

Le téléphone branché, tout se fait en ligne de commande — c'est ce qui a permis
de lire l'état réel sans prendre l'écran de Julien :

```bash
xcrun devicectl list devices                     # « available (paired) » ou non
xcrun devicectl device info apps --device <id>   # ce qui est installé
xcrun devicectl device install app --device <id> <chemin>/Inventaire.app
```

⚠️ **`devicectl … process launch` ne donne presque jamais la sortie console**,
et son « The process identifier of the launched application could not be
determined » n'est **pas** la preuve d'un plantage — il ne sait souvent pas
s'attacher. Ne pas en conclure quoi que ce soit.

⚠️ **Le déclenchement d'un build appartient à Julien** (règle du 21 août 2026 :
« stop je run moi même »). Installer et lire depuis le terminal, oui ; cliquer
Run à sa place, non.
