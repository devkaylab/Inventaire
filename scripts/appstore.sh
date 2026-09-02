#!/bin/zsh
#
# Produire l'archive iOS signée à envoyer sur App Store Connect.
#
#   ./scripts/appstore.sh
#
# C'est le pendant de play.sh pour l'iPhone : simulateur.sh sert à essayer,
# celui-ci sert à publier. Il encode quatre pièges que ce dépôt a déjà payés,
# et c'est tout son intérêt — un `xcodebuild archive` lancé à la main les
# rencontre tous les quatre en silence.
#
# ⚠️ Prérequis : le compte Apple Developer doit être dans Xcode → Réglages →
# Comptes. Xcode crée alors le certificat de distribution et le profil tout
# seuls (option -allowProvisioningUpdates). Un certificat « Apple Development »
# ne suffit PAS : App Store Connect refuse un binaire signé avec.

set -e

RACINE="$(cd "$(dirname "$0")/.." && pwd)"
cd "$RACINE"

ARCHIVE="ios/build/Quantinvo.xcarchive"
EXPORT="ios/build/export"
WS="ios/Inventaire.xcworkspace"
SCHEME="Inventaire"

# ── 1. Un certificat de DISTRIBUTION, pas de développement ─────────────────
if ! security find-identity -v -p codesigning 2>/dev/null | grep -q "Apple Distribution"; then
  echo "✗ Aucun certificat « Apple Distribution » sur cette machine."
  echo
  echo "  Il n'y a qu'un certificat « Apple Development », qui sert à installer"
  echo "  sur un appareil de test. App Store Connect refuse un binaire signé"
  echo "  avec — et le refus arrive à l'envoi, après tout le build."
  echo
  echo "  Ouvrir Xcode → Réglages → Comptes, ajouter le compte Apple Developer,"
  echo "  puis relancer. Xcode crée le certificat et le profil tout seul."
  exit 1
fi

# ── 2. ⚠️ pod install échoue EN SILENCE sans locale UTF-8 ──────────────────
# CocoaPods normalise les chemins en Unicode. Un shell non interactif — celui
# d'un agent, d'un script, d'un hook — n'a pas de locale UTF-8, Ruby travaille
# en ASCII-8BIT, et l'installation s'arrête avant d'avoir rien fait. Enchaînée
# avec &&, elle ne se voit pas : le build suivant réussit, et l'application
# livrée est amputée d'un module natif sans le moindre avertissement.
echo "→ Dépendances natives…"
POD=$(cd ios && LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 pod install 2>&1)
if ! echo "$POD" | grep -q "Pod installation complete"; then
  echo "✗ pod install n'a pas abouti. Sortie :"
  echo "$POD" | tail -20
  exit 1
fi
echo "$POD" | grep "Pod installation complete"

# ── 3. Archiver ────────────────────────────────────────────────────────────
echo "→ Archive (Release)…"
rm -rf "$ARCHIVE" "$EXPORT"
xcodebuild archive \
  -workspace "$WS" \
  -scheme "$SCHEME" \
  -configuration Release \
  -destination "generic/platform=iOS" \
  -archivePath "$ARCHIVE" \
  -allowProvisioningUpdates \
  | tail -5

if [[ ! -d "$ARCHIVE" ]]; then
  echo "✗ L'archive n'a pas été produite."
  exit 1
fi

# ── 4. ⚠️ app.config doit être DANS le bundle, sinon l'app se ferme ────────
# En Release, l'application se ferme sans rien dire si `app.config` n'a pas été
# déposé dans EXConstants.bundle. C'est le piège que simulateur.sh règle à la
# main pour le Debug ; ici, l'étape Gradle/Xcode d'Expo devrait le faire, mais
# « devrait » ne suffit pas pour un binaire qui part chez Apple : une archive
# amputée passe la revue automatique, s'installe, et se ferme au lancement.
APP="$ARCHIVE/Products/Applications/Inventaire.app"
CONF="$APP/EXConstants.bundle/app.config"
if [[ ! -f "$CONF" ]]; then
  echo "✗ app.config absent de EXConstants.bundle."
  echo "  L'application se fermerait au lancement, sans message."
  echo "  Le déposer puis réarchiver :"
  echo "    node node_modules/expo-constants/scripts/getAppConfig.js \"\$PWD\" \\"
  echo "      \"$APP/EXConstants.bundle\""
  exit 1
fi
echo "→ app.config présent dans EXConstants.bundle ($(wc -c < "$CONF") octets)"

# ── 5. Exporter ────────────────────────────────────────────────────────────
echo "→ Export pour App Store Connect…"
xcodebuild -exportArchive \
  -archivePath "$ARCHIVE" \
  -exportPath "$EXPORT" \
  -exportOptionsPlist scripts/ExportOptions.plist \
  -allowProvisioningUpdates \
  | tail -5

IPA=$(ls "$EXPORT"/*.ipa 2>/dev/null | head -1)
if [[ -z "$IPA" ]]; then
  echo "✗ Aucun .ipa produit."
  exit 1
fi

# ── 6. ⚠️ Contrôler qui a signé, pas le code de sortie ─────────────────────
SIGNATURE=$(codesign -dvvv "$APP" 2>&1 | grep "Authority=" | head -1)
if ! echo "$SIGNATURE" | grep -q "Apple Distribution"; then
  echo "✗ L'archive n'est pas signée pour la distribution : $SIGNATURE"
  exit 1
fi

echo
echo "✓ Archive prête : $IPA"
echo "  $SIGNATURE"
ls -lh "$IPA" | awk '{print "  Taille : " $5}'
echo
echo "  Envoi : ouvrir Transporter (App Store, gratuit) et y déposer le .ipa,"
echo "  ou depuis Xcode → Window → Organizer → Distribute App."
echo "  ⚠️ Le buildNumber doit augmenter à chaque envoi : il est dans app.json."
