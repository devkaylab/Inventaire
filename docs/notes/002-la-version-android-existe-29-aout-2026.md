# La version Android existe (29 août 2026)

Premier build Android réussi, sans toucher au projet iOS. Ce qu'il faut savoir
avant d'y retoucher :

- **`android/` est un dossier GÉNÉRÉ** (`npx expo prebuild --platform android`),
  et il est dans le `.gitignore` — contrairement à `ios/`, qui est versionné.
  Ne pas l'ajouter à git ; toute configuration durable passe par `app.json`
  (qui portait déjà le paquet `com.quantinvo.app`, l'icône adaptative et les
  permissions) ou par un plugin de configuration.
- **`./scripts/pixel.sh` est le seul chemin de build**, pendant de
  `simulateur.sh` : il pose `JAVA_HOME` / `ANDROID_HOME` (un shell non
  interactif ne les a pas), régénère `android/` et `local.properties` s'ils
  manquent, compile, installe et lance sur le téléphone branché en USB.
  Contrairement à l'iOS, **pas d'étape EXConstants à la main** : le plugin
  Gradle d'Expo dépose app.config pendant le build.
- **La chaîne installée le 29 août 2026** (Homebrew) : `openjdk@17` (formule,
  pas de sudo), `android-commandlinetools` (cask), puis par `sdkmanager` :
  plateforme android-36, build-tools 36.0.0, NDK 27.1.12297006, cmake 3.22.1 —
  les versions viennent de `node_modules/react-native/gradle/libs.versions.toml`,
  pas d'un choix. Licences acceptées. `JAVA_HOME`, `ANDROID_HOME` et le PATH
  (`adb`) sont posés dans `~/.zshrc`.
- **La signature de publication est en place depuis le 2 septembre 2026.**
  ⚠️ **CETTE NOTE A DIT LE CONTRAIRE PENDANT SIX JOURS**, et elle m'a fait
  annoncer à Julien un « bloquant Android » qui n'existait plus (revue du
  8 septembre). Une note qui décrit un manque se corrige quand le manque est
  comblé — c'est le même piège que la liste d'onboarding du 28 août et que le
  garde-fou du retour du 29.
  · Le gabarit Expo signe le release avec la **clé de debug** — commode pour
    installer sur un téléphone, refusé par Google Play. `plugins/withAndroidSigning.js`
    ajoute la vraie configuration ; **sans les propriétés de la machine, on
    retombe sur la clé de debug au lieu d'échouer**, délibérément, pour que
    `pixel.sh` continue de marcher sans rien demander.
  · **`./scripts/play.sh` est le chemin de publication** : il refuse de partir
    si la clé n'est pas configurée, construit l'AAB, puis **vérifie la
    signature du bundle produit** et s'arrête net s'il lit « Android Debug ».
  · ⚠️ **La clé ne vit QUE sur la machine de Julien**
    (`~/quantinvo-upload.keystore` + quatre propriétés dans
    `~/.gradle/gradle.properties`), jamais dans le dépôt. **Une clé de dépôt
    perdue rend toute mise à jour impossible** : elle se sauvegarde ailleurs.
  · **L'identité Play Console est validée** (confirmé par Julien le
    8 septembre 2026).
  · ⚠️ `versionCode` est dans `app.json` et **doit augmenter à chaque dépôt** ;
    il vaut 1 au 8 septembre 2026.
- L'espace dans le chemin (`App inventaire`) n'a posé aucun problème à Gradle,
  au NDK ni à CMake — 642 tâches, aucune reprise à la main.
