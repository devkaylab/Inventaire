#!/bin/zsh
#
# Construire, installer et lancer l'application dans le simulateur, en une
# commande.
#
#   ./scripts/simulateur.sh              # simulateur déjà démarré
#   ./scripts/simulateur.sh <UDID>       # un simulateur précis
#
# ⚠️ **C'est le seul chemin à emprunter.** Un `xcodebuild` lancé à la main
# oublie deux étapes, et les deux se manifestent APRÈS l'installation, quand
# on croit avoir fini :
#
#   1. `app.config` n'est pas déposé dans `EXConstants.bundle`. En Debug,
#      l'application s'ouvre sur un écran rouge « expo-linking needs access to
#      the expo-constants manifest » ; en Release, elle se ferme sans rien
#      dire. Seul `expo run:ios` génère ce fichier — pas `xcodebuild`.
#   2. La barre d'état du simulateur n'est pas figée, et l'heure change d'une
#      capture à l'autre.
#
# Les deux sont réglées ici. Détail de l'historique dans la mémoire projet
# (« Build iOS : workflow & problèmes »).

set -e

RACINE="$(cd "$(dirname "$0")/.." && pwd)"
cd "$RACINE"

UDID="${1:-booted}"
APP="ios/build/dd/Build/Products/Debug-iphonesimulator/Inventaire.app"

# ⚠️ Les frameworks PRÉBUILTS (core React, ExpoModulesCore, ExpoCamera…) ont
# deux variantes — Debug et Release — et UN SEUL dossier chacun. Un script de
# build les échange selon la configuration, mais seulement s'il croit que la
# variante en place est l'autre : il lit un repère `.last_build_configuration`.
# Or `pod install` pose la variante que le cache CocoaPods lui donne (Release,
# depuis l'archive App Store du 8 septembre) ET écrit un repère qui dit
# « debug ». Résultat le 11 septembre 2026 : lien cassé (« Undefined symbols …
# Sealable »), puis, une fois le core forcé en Debug, ExpoModulesCore resté en
# Release et l'app qui plante au lancement (SIGSEGV dans Props::Props).
#
# Donc : après tout `pod install` (Manifest.lock plus récent que notre repère),
# on déclare TOUS les prébuilts en Release, ce qui force leur ré-extraction en
# Debug au build suivant. Une extraction, une fois par pod install.
JALON="ios/build/.prebuilts-verifies"
if [ ! -f "$JALON" ] || [ ios/Pods/Manifest.lock -nt "$JALON" ]; then
  echo "→ pod install récent : les frameworks prébuilts seront ré-extraits en Debug"
  [ -d ios/Pods/React-Core-prebuilt ] && printf 'Release' > ios/Pods/React-Core-prebuilt/.last_build_configuration
  for a in ios/Pods/*/artifacts; do
    [ -d "$a" ] && printf 'release' > "$a/.last_build_configuration"
  done
  mkdir -p ios/build && touch "$JALON"
fi

echo "→ Compilation (Debug)…"
xcodebuild \
  -workspace ios/Inventaire.xcworkspace \
  -scheme Inventaire \
  -configuration Debug \
  -destination "platform=iOS Simulator,id=$(xcrun simctl list devices booted -j | python3 -c 'import json,sys;d=json.load(sys.stdin)["devices"];print(next(x["udid"] for v in d.values() for x in v))' 2>/dev/null || echo "$UDID")" \
  -derivedDataPath ios/build/dd \
  build > /tmp/quantinvo-build.log 2>&1 \
  || { echo "✗ Compilation échouée. Fin du journal :"; tail -30 /tmp/quantinvo-build.log; exit 1; }

# ⚠️ Sans cette ligne, l'application démarre sur un écran rouge.
echo "→ Génération de app.config dans EXConstants.bundle…"
node node_modules/expo-constants/scripts/getAppConfig.js "$RACINE" "$APP/EXConstants.bundle" >/dev/null

echo "→ Installation et lancement…"
xcrun simctl install "$UDID" "$APP"
xcrun simctl terminate "$UDID" com.quantinvo.app 2>/dev/null || true
xcrun simctl launch "$UDID" com.quantinvo.app >/dev/null

# Barre d'état figée : sans elle, l'heure et la batterie changent d'une
# capture à l'autre et deux captures du même écran ne se comparent plus.
xcrun simctl status_bar "$UDID" override \
  --time 9:41 --batteryState charged --batteryLevel 100 \
  --wifiBars 3 --cellularMode active --cellularBars 4

echo "✓ Prêt. En Debug, le JS vient de Metro : une modification se recharge"
echo "  sans repasser par ici."
