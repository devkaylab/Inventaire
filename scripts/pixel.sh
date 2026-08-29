#!/bin/zsh
#
# Construire l'APK Android et l'installer sur le téléphone branché en USB,
# en une commande. C'est le pendant de simulateur.sh pour Android.
#
#   ./scripts/pixel.sh              # build + installation + lancement
#   ./scripts/pixel.sh --sans-build # réinstaller le dernier APK construit
#
# Prérequis sur le téléphone : mode développeur + débogage USB activés,
# et la demande d'autorisation acceptée au premier branchement.
#
# Deux choses que ce script règle et qu'un gradlew lancé à la main oublie :
#
#   1. JAVA_HOME et ANDROID_HOME — un shell non interactif (agent, hook) ne
#      les a pas, et Gradle échoue avant d'avoir rien fait. Même famille que
#      le piège de locale de pod install.
#   2. Le dossier android/ est GÉNÉRÉ (il est dans le .gitignore) : s'il
#      manque, on le refait par `expo prebuild` et on repose local.properties.
#
# L'APK est un release signé avec la clé de debug : parfait pour essayer sur
# un appareil, JAMAIS pour Google Play (la boutique passera par un AAB signé,
# le jour venu). Contrairement à l'iOS, pas d'étape EXConstants à la main :
# le plugin Gradle d'Expo dépose app.config tout seul pendant le build.

set -e

export JAVA_HOME="/opt/homebrew/opt/openjdk@17"
export ANDROID_HOME="/opt/homebrew/share/android-commandlinetools"
ADB="$ANDROID_HOME/platform-tools/adb"

RACINE="$(cd "$(dirname "$0")/.." && pwd)"
cd "$RACINE"

APK="android/app/build/outputs/apk/release/app-release.apk"

if [[ ! -d android ]]; then
  echo "→ Dossier android/ absent : génération par expo prebuild…"
  npx expo prebuild --platform android --no-install
  echo "sdk.dir=$ANDROID_HOME" > android/local.properties
fi

if [[ "$1" != "--sans-build" ]]; then
  echo "→ Compilation (Release)…"
  (cd android && ./gradlew :app:assembleRelease > /tmp/quantinvo-android-build.log 2>&1) \
    || { echo "✗ Compilation échouée. Fin du journal :"; tail -30 /tmp/quantinvo-android-build.log; exit 1; }
fi

[[ -f "$APK" ]] || { echo "✗ Aucun APK à installer ($APK)."; exit 1; }

echo "→ Téléphone branché ?"
"$ADB" devices | awk 'NR>1 && $2=="device" {trouve=1} END {exit !trouve}' \
  || { echo "✗ Aucun appareil autorisé. Brancher le téléphone, activer le"; \
       echo "  débogage USB et accepter la demande à l'écran, puis relancer."; exit 1; }

echo "→ Installation et lancement…"
"$ADB" install -r "$APK"
"$ADB" shell am force-stop com.quantinvo.app 2>/dev/null || true
"$ADB" shell am start -n com.quantinvo.app/.MainActivity > /dev/null

echo "✓ Quantinvo est lancée sur le téléphone. Le JS est embarqué dans"
echo "  l'APK : une modification du code demande de repasser par ici."
