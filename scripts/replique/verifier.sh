#!/bin/zsh
#
# Rejouer une migration sur une RÉPLIQUE de la base, et voir ce qu'elle change.
#
# ⚠️ POURQUOI CE BANC D'ESSAI EXISTE. Sur ce projet une migration s'applique à
# la main sur la base réelle. `scripts/verifier-migrations.py` dit si elle
# COMPILE ; il ne dit rien de ce qu'elle FAIT. Le 20 septembre 2026, une
# migration qui compilait, dont chaque policy avait été relue ligne à ligne
# contre `pg_policies`, cassait quand même une chose : un inventoriste de
# mission passait toutes les règles de comptage mais se faisait refuser sa
# place d'appareil, donc l'écran de comptage ne s'ouvrait pas. Aucune relecture
# ne l'avait vu. Un rejeu l'a vu en trois minutes.
#
# ⚠️ CE N'EST PAS LA PRODUCTION, ET ÇA NE PRÉTEND PAS L'ÊTRE. C'est un SOUS-
# ENSEMBLE : les tables, fonctions et policies que touchent les chantiers en
# cours, extraites du catalogue de la base le 20 septembre 2026. Une migration
# qui touche autre chose demande d'étendre `01-tables.sql`, `02-fonctions.sql`
# et `03-policies.sql` — ils se régénèrent depuis la base réelle (voir le
# LISEZMOI à côté). Un banc vert ne remplace pas la prudence ; un banc rouge,
# lui, est toujours vrai.
#
# Installation (une fois) :
#     brew install postgresql@17
#
# Usage :
#     ./scripts/replique/verifier.sh                      # toutes les migrations du jour
#     ./scripts/replique/verifier.sh 20260920130001       # une seule
#
set -e
export PATH="/opt/homebrew/opt/postgresql@17/bin:$PATH"
# ⚠️ SANS `LC_ALL=C`, LE SERVEUR REFUSE DE DÉMARRER sur macOS 27 :
# « postmaster became multithreaded during startup ».
export LC_ALL=C LANG=C

RACINE="${0:a:h}"
DEPOT="${RACINE:h:h}"
SOCKET=/tmp/quantinvo-replique
DONNEES=/tmp/quantinvo-replique-data
PORT=55432
# Les migrations à rejouer. Par défaut, toutes celles d'On-Demand.
# `--sans-os` s'arrête avant celle qui touche Quantinvo OS.
MOTIF="2026092[0-9]"
SANS_OS=0
[[ "$1" == "--sans-os" ]] && { SANS_OS=1; shift; }
[[ -n "$1" ]] && MOTIF="$1"

command -v psql >/dev/null || { echo "psql manque : brew install postgresql@17"; exit 1; }

mkdir -p "$SOCKET"
if ! pg_ctl -D "$DONNEES" status >/dev/null 2>&1; then
  [[ -d "$DONNEES" ]] || pg_ctl -D "$DONNEES" init -o "--locale=C -E UTF8" >/dev/null
  pg_ctl -D "$DONNEES" -l "$SOCKET/log.txt" -o "-p $PORT -k $SOCKET" start >/dev/null
  sleep 1
fi

q() { psql -h "$SOCKET" -p "$PORT" -d "${1}" -v ON_ERROR_STOP=1 -q "${@:2}"; }

q postgres -c "drop database if exists replique with (force);" -c "create database replique;" >/dev/null
for f in "$RACINE"/0*.sql "$RACINE"/10-donnees.sql; do
  q replique -f "$f" 2>&1 | grep -vi notice || true
done

echo "── Quantinvo OS, AVANT ───────────────────────────────────────────────"
psql -h "$SOCKET" -p "$PORT" -d replique -q -f "$RACINE/20-parcours.sql" 2>&1 | grep -v '^$' > "$SOCKET/avant.txt"
cat "$SOCKET/avant.txt"

echo
echo "── Application des migrations ────────────────────────────────────────"
APPLIQUEES=()
for f in "$DEPOT"/supabase/migrations/${~MOTIF}*.sql; do
  # ⚠️ `--sans-os` : la migration du plafond d'appareils REMPLACE une fonction
  # de Quantinvo OS. C'est la seule, et on doit pouvoir mesurer le reste sans
  # elle — c'est ce qui prouve que le reste n'y touche pas.
  if (( SANS_OS )) && [[ "${f:t}" == *plafond_d_appareils* ]]; then
    echo "  · ${f:t} (écartée : elle touche Quantinvo OS)"; continue
  fi
  if psql -h "$SOCKET" -p "$PORT" -d replique -v ON_ERROR_STOP=1 -q -f "$f" >/dev/null 2>"$SOCKET/err.txt"; then
    echo "  ✓ ${f:t}"; APPLIQUEES+=("${f:t}")
  else
    echo "  ✗ ${f:t}"; grep -iE "(ERROR|ERREUR)" "$SOCKET/err.txt" | head -3; exit 1
  fi
done

echo
echo "── Quantinvo OS, APRÈS ───────────────────────────────────────────────"
psql -h "$SOCKET" -p "$PORT" -d replique -q -f "$RACINE/20-parcours.sql" 2>&1 | grep -v '^$' > "$SOCKET/apres.txt"
if diff -u "$SOCKET/avant.txt" "$SOCKET/apres.txt" > "$SOCKET/diff.txt"; then
  echo "  ✓ AUCUNE DIFFÉRENCE — les parcours de Quantinvo OS se comportent à l'identique"
else
  echo "  ⚠️ DES PARCOURS ONT CHANGÉ :"
  cat "$SOCKET/diff.txt"
fi

# ── Et si on retirait tout ? ────────────────────────────────────────────
#
# ⚠️ C'EST LA QUESTION QUI COMPTE LE JOUR OÙ ÇA VA MAL. On-Demand doit pouvoir
# se retirer sans laisser de trace dans Quantinvo OS. Si ce contrôle échoue,
# c'est que quelque chose du chantier s'est installé dans le produit qui
# tourne.
if [[ -f "$RACINE/90-retirer.sql" ]]; then
  echo
  echo "── Retrait complet d'On-Demand ───────────────────────────────────────"
  psql -h "$SOCKET" -p "$PORT" -d replique -v ON_ERROR_STOP=1 -q -f "$RACINE/90-retirer.sql" >/dev/null
  psql -h "$SOCKET" -p "$PORT" -d replique -q -f "$RACINE/20-parcours.sql" 2>&1 | grep -v '^$' > "$SOCKET/retire.txt"
  if diff -u "$SOCKET/avant.txt" "$SOCKET/retire.txt" > "$SOCKET/diff2.txt"; then
    echo "  ✓ Quantinvo OS revient EXACTEMENT à son état d'avant"
  else
    echo "  ⚠️ IL RESTE QUELQUE CHOSE :"; cat "$SOCKET/diff2.txt"
  fi
  # On réapplique pour la démonstration qui suit.
  for m in "${APPLIQUEES[@]}"; do
    psql -h "$SOCKET" -p "$PORT" -d replique -v ON_ERROR_STOP=1 -q -f "$DEPOT/supabase/migrations/$m" >/dev/null 2>&1
  done
fi

for scenario in "$RACINE"/4*.sql "$RACINE"/5*.sql "$RACINE"/6*.sql; do
  [[ -f "$scenario" ]] || continue
  echo
  echo "── ${scenario:t:r} ───────────────────────────────────────────────────"
  psql -h "$SOCKET" -p "$PORT" -d replique -q -f "$scenario" 2>&1 \
    | grep -v '^$' | grep -v '^0000' | grep -v '^SET$' | grep -v '^true$'
done

echo
echo "La réplique reste debout : psql -h $SOCKET -p $PORT -d replique"
echo "Pour l'arrêter : pg_ctl -D $DONNEES stop"
