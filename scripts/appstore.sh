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

# ── 4. ⚠️ Les clés doivent être DANS le bundle JS ──────────────────────────
# Le vrai risque silencieux est ici. L'adresse et la clé Supabase viennent de
# `process.env.EXPO_PUBLIC_*`, que Babel remplace par leur valeur AU MOMENT du
# bundling. Si `.env.local` manque à ce moment-là, le build réussit, l'archive
# se signe, Apple la valide, elle s'installe — et l'application ne peut se
# connecter à rien, pour tout le monde, sans un message d'erreur qui le dise.
# On regarde donc dans le bundle produit, pas dans le code source.
APP="$ARCHIVE/Products/Applications/Inventaire.app"
BUNDLE="$APP/main.jsbundle"
if [[ ! -f "$BUNDLE" ]]; then
  echo "✗ main.jsbundle absent de l'archive."
  exit 1
fi
if ! grep -aq "supabase.co" "$BUNDLE"; then
  echo "✗ L'adresse Supabase n'est pas dans le bundle JS."
  echo '  .env.local manquait au moment du bundling : l’application'
  echo '  s’installerait et ne se connecterait à rien.'
  exit 1
fi
echo "→ Clés présentes dans le bundle ($(grep -ao 'https://[a-z]*\.supabase\.co' "$BUNDLE" | head -1))"

# ── 4 bis. app.config — un avertissement, pas un refus ─────────────────────
# ⚠️ Note corrigée le 2 septembre 2026. `app.config` est bien absent de
# `EXConstants.bundle` sur une archive Xcode, et ce n'est PAS grave pour cette
# application : `expo-constants` n'a qu'un seul appelant (`lib/push.ts`, pour
# l'identifiant de projet EAS), et il porte une valeur de repli en dur. Les
# clés Supabase, elles, ne passent pas par là — elles sont inlinées ci-dessus.
#
# Le jour où un écran lira `Constants.expoConfig` sans repli, cet
# avertissement devra redevenir un refus.
if [[ ! -f "$APP/EXConstants.bundle/app.config" ]]; then
  echo "→ app.config absent d'EXConstants.bundle — sans effet ici :"
  echo "  le seul lecteur d'expo-constants (lib/push.ts) a un repli en dur."
fi

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

# ── 6. ⚠️ Contrôler la signature DU .IPA, pas celle de l'archive ──────────
# L'application contenue dans l'archive porte la signature du build — souvent
# « Apple Development ». C'est normal : l'export la RESIGNE pour la
# distribution. Contrôler l'archive reviendrait donc à contrôler la mauvaise
# copie, et à refuser un export parfaitement valable — le pendant exact du
# défaut trouvé le même jour dans play.sh, qui interrogeait le trousseau au
# lieu du bundle.
CTRL=$(mktemp -d)
unzip -q "$IPA" -d "$CTRL"
IPAAPP=$(ls -d "$CTRL"/Payload/*.app | head -1)
SIGNATURE=$(codesign -dvvv "$IPAAPP" 2>&1 | grep -m1 "Authority=" | sed 's/^Authority=//')
rm -rf "$CTRL"

if ! echo "$SIGNATURE" | grep -q "Apple Distribution"; then
  echo "✗ Le .ipa n'est pas signé pour la distribution : ${SIGNATURE:-aucune signature lue}"
  exit 1
fi

echo
echo "✓ Archive prête : $IPA"
echo "  Signé par : $SIGNATURE"
ls -lh "$IPA" | awk '{print "  Taille : " $5}'
echo
echo "  Envoi : ouvrir Transporter (App Store, gratuit) et y déposer le .ipa,"
echo "  ou depuis Xcode → Window → Organizer → Distribute App."
echo "  ⚠️ Le buildNumber doit augmenter à chaque envoi : il est dans app.json."
