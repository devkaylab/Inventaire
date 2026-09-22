#!/bin/zsh
#
# Construire, installer et lancer l'application dans le simulateur, en une
# commande.
#
#   ./scripts/simulateur.sh                        # simulateur déjà démarré
#   ./scripts/simulateur.sh <UDID>                 # un simulateur précis
#   ./scripts/simulateur.sh "iPad Air 11-inch (M3)"  # par son NOM
#   ./scripts/simulateur.sh ipad                   # le premier iPad disponible
#   CONFIG=Release ./scripts/simulateur.sh         # JS embarqué, sans Metro
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
#
# ⚠️ **L'ARGUMENT DÉCIDE AUSSI DE LA COMPILATION, et il ne le faisait pas.**
# La destination `xcodebuild` se lisait sur le simulateur DÉMARRÉ, quel que
# soit l'appareil demandé : passer un UDID d'iPad avec un iPhone ouvert
# compilait pour l'iPhone, puis installait sur l'iPad. Le binaire n'en meurt
# pas (même architecture), mais tout ce qui se décide à la compilation — la
# famille d'appareils, le SDK — venait du mauvais appareil. Depuis le
# 22 septembre 2026, la cible est résolue UNE fois et sert aux trois étapes.

set -e

RACINE="$(cd "$(dirname "$0")/.." && pwd)"
cd "$RACINE"

CIBLE="${1:-booted}"
CONFIG="${CONFIG:-Debug}"
APP="ios/build/dd/Build/Products/${CONFIG}-iphonesimulator/Inventaire.app"

# ── La cible : « booted », un UDID, ou un nom d'appareil ───────────────────
# Rendre un UDID et un seul. Un nom partiel suffit (« ipad », « iPhone 17 »),
# insensible à la casse : les noms exacts d'Apple changent à chaque Xcode, et
# personne ne les retient.
INFOS=$(CIBLE="$CIBLE" python3 - <<'PY'
import json, os, subprocess, sys

cible = os.environ["CIBLE"]
sortie = subprocess.run(["xcrun", "simctl", "list", "devices", "-j"],
                        capture_output=True, text=True).stdout
familles = json.loads(sortie)["devices"]
appareils = [x for v in familles.values() for x in v if x.get("isAvailable")]

if cible == "booted":
    trouves = [x for x in appareils if x["state"] == "Booted"]
else:
    trouves = ([x for x in appareils if x["udid"] == cible]
               or [x for x in appareils if x["name"].lower() == cible.lower()]
               or [x for x in appareils if cible.lower() in x["name"].lower()])

if not trouves:
    sys.exit(1)
# Un simulateur déjà démarré passe devant : c'est celui qu'on regarde.
trouves.sort(key=lambda x: x["state"] != "Booted")
print(trouves[0]["udid"], trouves[0]["state"], trouves[0]["name"], sep="\t")
PY
) || {
  if [ "$CIBLE" = "booted" ]; then
    echo "✗ Aucun simulateur démarré."
    echo "  Ouvrir Simulator, ou nommer l'appareil :"
    echo "    ./scripts/simulateur.sh \"iPhone 17 Pro\""
    echo "    ./scripts/simulateur.sh ipad"
  else
    echo "✗ Aucun simulateur disponible ne correspond à « $CIBLE »."
    echo "  Les appareils installés :"
    xcrun simctl list devices available | sed -n 's/^    /    /p' | head -30
  fi
  exit 1
}

UDID="${INFOS%%$'\t'*}"
RESTE="${INFOS#*$'\t'}"
ETAT="${RESTE%%$'\t'*}"
NOM="${RESTE#*$'\t'}"

echo "→ Cible : $NOM ($UDID)"

# ── Démarrer la cible si elle dort ─────────────────────────────────────────
# `install` et `launch` refusent un appareil éteint. `bootstatus -b` démarre
# et ATTEND la fin du démarrage : sans l'attente, l'installation arrive avant
# que SpringBoard soit là et échoue une fois sur deux.
if [ "$ETAT" != "Booted" ]; then
  echo "→ Démarrage du simulateur…"
  xcrun simctl bootstatus "$UDID" -b
  # ⚠️ **L'OUVERTURE DE LA FENÊTRE NE DOIT PAS FAIRE ÉCHOUER LE SCRIPT.**
  # Xcode 27 ne livre plus `Simulator.app` dans
  # `Contents/Developer/Applications/` ; Launch Services garde pourtant une
  # fiche périmée vers cet ancien chemin, et `open -a Simulator` rend
  # « Unable to find application named 'Simulator' ». Sous `set -e`, tout
  # s'arrêtait là — avant même la compilation, le 22 septembre 2026, le jour
  # où il fallait justement vérifier un refus d'Apple.
  #
  # L'appareil est DÉJÀ démarré à cette ligne (`bootstatus -b` a attendu) :
  # `install` et `launch` fonctionnent sans fenêtre. Celle-ci n'est qu'un
  # confort pour regarder — on le dit, et on continue.
  if ! open -a Simulator --args -CurrentDeviceUDID "$UDID" 2>/dev/null; then
    echo "  (fenêtre du simulateur indisponible — l'appareil tourne quand même)"
  fi
fi

# Les frameworks prébuilts (Debug / Release) : c'est le `post_install` d'`ios/Podfile`
# qui invalide leurs repères à chaque `pod install` (19/09/2026). Ce script le
# faisait avant, mais en les déclarant « release » — ce qui aurait cassé un build
# Release. Voir docs/notes/097.

echo "→ Compilation ($CONFIG)…"
xcodebuild \
  -workspace ios/Inventaire.xcworkspace \
  -scheme Inventaire \
  -configuration "$CONFIG" \
  -destination "platform=iOS Simulator,id=$UDID" \
  -derivedDataPath ios/build/dd \
  build > /tmp/quantinvo-build.log 2>&1 \
  || { echo "✗ Compilation échouée. Fin du journal :"; tail -30 /tmp/quantinvo-build.log; exit 1; }

# ⚠️ Sans cette ligne, l'application démarre sur un écran rouge.
echo "→ Génération de app.config dans EXConstants.bundle…"
node node_modules/expo-constants/scripts/getAppConfig.js "$RACINE" "$APP/EXConstants.bundle" >/dev/null

echo "→ Installation et lancement…"
xcrun simctl install "$UDID" "$APP"
xcrun simctl terminate "$UDID" com.quantinvo.app 2>/dev/null || true

# Barre d'état figée : sans elle, l'heure et la batterie changent d'une
# capture à l'autre et deux captures du même écran ne se comparent plus.
# Posée AVANT le lancement : en console, on ne repasserait plus par ici.
xcrun simctl status_bar "$UDID" override \
  --time 9:41 --batteryState charged --batteryLevel 100 \
  --wifiBars 3 --cellularMode active --cellularBars 4

# ⚠️ **UNE APPLICATION QUI SE FERME AU LANCEMENT NE DIT RIEN ICI.** `launch`
# rend la main dès que le processus est né ; s'il meurt une seconde plus tard,
# le script affiche « Prêt » et le terminal est muet. `CONSOLE=1` branche la
# sortie du processus sur ce terminal — c'est là qu'une exception JavaScript
# fatale ou un module natif absent écrit sa raison. Ce qui manquait le
# 22 septembre 2026, quand Apple a refusé le build 5 pour un plantage au
# lancement sur iPad.
#
#   CONSOLE=1 ./scripts/simulateur.sh ipad
#
# Et si l'application est déjà morte quand on y pense, le rapport est écrit sur
# le disque : ~/Library/Logs/DiagnosticReports/Inventaire-*.ips
if [ -n "$CONSOLE" ]; then
  echo "→ Console branchée (Ctrl-C pour rendre la main, l'app reste ouverte)."
  exec xcrun simctl launch --console-pty "$UDID" com.quantinvo.app
fi

xcrun simctl launch "$UDID" com.quantinvo.app >/dev/null

echo "✓ Prêt. En Debug, le JS vient de Metro : une modification se recharge"
echo "  sans repasser par ici."
echo "  Si l'application se referme aussitôt : CONSOLE=1 ./scripts/simulateur.sh $CIBLE"
