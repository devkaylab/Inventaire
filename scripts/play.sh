#!/bin/zsh
#
# Produire l'AAB signé à déposer sur Google Play.
#
#   ./scripts/play.sh
#
# C'est le pendant de pixel.sh pour la PUBLICATION, et la différence tient en
# une phrase : pixel.sh produit un APK signé avec la clé de debug, bon pour un
# téléphone de test et refusé par la boutique ; celui-ci produit un AAB signé
# avec la clé de dépôt, et REFUSE de sortir quoi que ce soit si elle manque.
#
# ⚠️ Pourquoi un AAB et pas un APK : Google Play n'accepte plus que le format
# Android App Bundle pour une application nouvelle. C'est la boutique qui
# fabrique ensuite les APK adaptés à chaque appareil.
#
# ⚠️ La clé n'est PAS dans le dépôt, et ne doit jamais y entrer. Les quatre
# propriétés se posent une fois dans ~/.gradle/gradle.properties :
#
#     QUANTINVO_UPLOAD_STORE_FILE=/chemin/vers/quantinvo-upload.keystore
#     QUANTINVO_UPLOAD_STORE_PASSWORD=…
#     QUANTINVO_UPLOAD_KEY_ALIAS=upload
#     QUANTINVO_UPLOAD_KEY_PASSWORD=…
#
# Pour créer la clé (une seule fois, et la SAUVEGARDER) :
#
#     keytool -genkeypair -v -keystore ~/quantinvo-upload.keystore \
#       -alias upload -keyalg RSA -keysize 2048 -validity 10000
#
# ⚠️ Perdre cette clé n'est pas rattrapable seul : il faut demander à Google de
# réinitialiser la clé de dépôt. La sauvegarder hors de la machine.

set -e

export JAVA_HOME="/opt/homebrew/opt/openjdk@17"
export ANDROID_HOME="/opt/homebrew/share/android-commandlinetools"

RACINE="$(cd "$(dirname "$0")/.." && pwd)"
cd "$RACINE"

AAB="android/app/build/outputs/bundle/release/app-release.aab"

# ── 1. La clé doit être configurée, sinon on ne construit rien ──────────────
PROPS="$HOME/.gradle/gradle.properties"
if [[ ! -f "$PROPS" ]] || ! grep -q "^QUANTINVO_UPLOAD_STORE_FILE=" "$PROPS"; then
  echo "✗ La clé de dépôt n'est pas configurée."
  echo
  echo "  Sans elle, Gradle signerait le bundle avec la clé de DEBUG, et"
  echo "  Google Play le refuserait — ou pire, l'accepterait une fois et"
  echo "  rendrait toute mise à jour impossible."
  echo
  echo "  Poser les quatre propriétés dans $PROPS :"
  echo "    QUANTINVO_UPLOAD_STORE_FILE=…"
  echo "    QUANTINVO_UPLOAD_STORE_PASSWORD=…"
  echo "    QUANTINVO_UPLOAD_KEY_ALIAS=upload"
  echo "    QUANTINVO_UPLOAD_KEY_PASSWORD=…"
  echo
  echo "  Le détail est en tête de ce script."
  exit 1
fi

STORE=$(grep "^QUANTINVO_UPLOAD_STORE_FILE=" "$PROPS" | cut -d= -f2-)
if [[ ! -f "$STORE" ]]; then
  echo "✗ Le fichier de clé est introuvable : $STORE"
  exit 1
fi

# ── 2. android/ est un dossier généré ──────────────────────────────────────
if [[ ! -d android ]]; then
  echo "→ Dossier android/ absent : génération par expo prebuild…"
  npx expo prebuild --platform android --no-install
  echo "sdk.dir=$ANDROID_HOME" > android/local.properties
fi

# ── 3. Construire ──────────────────────────────────────────────────────────
echo "→ Construction du bundle de publication…"
rm -f "$AAB"
(cd android && ./gradlew bundleRelease)

if [[ ! -f "$AAB" ]]; then
  echo "✗ Le bundle n'a pas été produit."
  exit 1
fi

# ── 4. ⚠️ Vérifier la signature, et ne pas croire le code de sortie ────────
# Un build qui réussit ne prouve pas que la bonne clé a été employée : sans
# les propriétés, Gradle serait retombé sur la clé de debug SANS RIEN DIRE.
# C'est le motif du « succès silencieux » que ce projet a déjà payé plusieurs
# fois — on regarde donc qui a signé, pas si la commande a rendu zéro.
echo "→ Contrôle de la signature…"
# ⚠️ On interroge LE BUNDLE, pas le trousseau. Une première version de ce
# script retombait sur `keytool -list` quand apksigner ne savait pas lire
# l'AAB : elle affichait alors le propriétaire du fichier de clé — ce qui est
# vrai quoi qu'il arrive, et ne prouve rien sur ce qui vient d'être signé.
# C'était exactement le « succès silencieux » que ce contrôle existe pour
# empêcher, reproduit dans le contrôle lui-même. `jarsigner` lit l'AAB.
VERIF=$("$JAVA_HOME/bin/jarsigner" -verify -verbose:summary -certs "$AAB" 2>&1)
SIGNATAIRE=$(echo "$VERIF" | grep -m1 '^- Signed by' | sed 's/^- Signed by //')

if [[ -z "$SIGNATAIRE" ]]; then
  echo "✗ Le bundle ne porte aucune signature lisible. Ne pas le déposer."
  exit 1
fi
if echo "$SIGNATAIRE" | grep -qi "Android Debug"; then
  echo "✗ Le bundle est signé avec la clé de DEBUG. Ne pas le déposer."
  exit 1
fi

echo
echo "✓ Bundle prêt : $AAB"
echo "  Signataire : $SIGNATAIRE"
ls -lh "$AAB" | awk '{print "  Taille     : " $5}'
echo
echo "  À déposer dans la Play Console → Production → Créer une version."
echo "  ⚠️ Le versionCode doit augmenter à chaque dépôt : il est dans app.json."
