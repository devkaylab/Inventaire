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
