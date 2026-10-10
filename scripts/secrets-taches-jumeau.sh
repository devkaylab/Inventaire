#!/bin/zsh
#
# Armer les tâches planifiées d'On-Demand sur le projet jumeau.
#
#   · le prélèvement du septième jour  (`prelever-les-locations`, minute 15)
#   · la relance d'une réservation sans carte (`relance-reservation`, minute 23)
#
# ⚠️⚠️ **CES TÂCHES TOURNENT DÉJÀ, ET NE FONT RIEN TANT QUE CE SCRIPT N'A PAS
# TOURNÉ.** C'est voulu : chacune cherche dans le coffre de la base une adresse
# et une clé, et renonce silencieusement si l'une manque. C'est ce qui rend une
# tâche planifiée inoffensive avant sa configuration.
#
# ⚠️⚠️ **IL NE TOUCHE PAS À CE QUI EST DÉJÀ ARMÉ.** Mesuré le 10 octobre 2026 :
# le prélèvement l'était déjà, et une version plus simple de ce script aurait
# refabriqué ses clés pour rien. Refaire une configuration qui marche est la
# façon la plus bête de la casser. Pour forcer : `--refaire`.
#
# ⚠️⚠️ **CE SCRIPT EXISTE POUR QUE LES VALEURS NE PASSENT PAR PERSONNE.** Les
# clés sont FABRIQUÉES ICI, par `openssl` : ni inventées par quelqu'un, ni
# recopiées d'ailleurs, ni affichées. Elles passent par un fichier temporaire
# en 0600, effacé quoi qu'il arrive.
#
# ⚠️ **CHAQUE CLÉ VA À DEUX ENDROITS, ET C'EST LA RAISON D'ÊTRE DU SCRIPT.** La
# base appelle la fonction edge en présentant la clé dans un en-tête ; la
# fonction compare à la sienne. Posée d'un seul côté, l'appel est refusé — et
# il est refusé EN SILENCE, dans les journaux d'une fonction que personne ne
# regarde. Les deux côtés partent donc du même geste.
#
# ⚠️ **LE PROJET VISÉ EST ÉCRIT EN DUR, et c'est voulu.** Un `--linked` seul
# ferait dépendre la cible de l'état du dépôt : le même script armerait la
# PRODUCTION si le lien avait changé entre-temps. Il a changé deux fois dans la
# seule journée du 10 octobre 2026.
#
# Usage :  ./scripts/secrets-taches-jumeau.sh [--refaire]
set -e

JUMEAU=lqgusznqcunjhrqslcug
BASE="https://$JUMEAU.supabase.co/functions/v1"
REFAIRE=0
[[ "$1" == "--refaire" ]] && REFAIRE=1

print ""
print "  Les tâches planifiées d'On-Demand — projet jumeau ($JUMEAU)"
print "  ──────────────────────────────────────────────────────────"
print ""
print "  Rien à taper : les clés sont fabriquées ici, et tu ne les verras pas."
print "  Elles n'ont pas besoin d'être connues — elles ne servent qu'à ce que"
print "  la base et la fonction edge se reconnaissent."
print ""

TMP=$(mktemp -d)
chmod 700 "$TMP"
trap 'rm -rf "$TMP"' EXIT INT TERM

# ── Ce qui est déjà en place ───────────────────────────────────────────────
#
# ⚠️ On ne lit que les NOMS. Une valeur relue est une valeur qui peut fuir dans
# un journal, et aucune décision ici n'a besoin de la connaître.
DEJA=$(supabase db query --linked --project-ref "$JUMEAU" --output json --file /dev/stdin <<'SQL' 2>/dev/null | tr -d ' \n'
select string_agg(name, ',' order by name) as noms
  from vault.decrypted_secrets
 where name in ('prelevement_url','prelevement_cle','relance_url','relance_cle')
   and length(decrypted_secret) > 0;
SQL
)

arme() {  # arme <prefixe> → 0 si les deux secrets de cette tâche sont là
  [[ "$DEJA" == *"$1_url"* && "$DEJA" == *"$1_cle"* ]]
}

# 32 octets en base64url : hors de portée d'une devinette, et sans caractère
# qui demanderait une mise entre guillemets.
fabriquer() { openssl rand -base64 32 | tr '+/' '-_' | tr -d '=\n'; }

ENVF="$TMP/taches.env"
SQLF="$TMP/coffre.sql"
: > "$ENVF"; chmod 600 "$ENVF"
: > "$SQLF"; chmod 600 "$SQLF"
A_FAIRE=0

poser() {  # poser <prefixe> <NOM_ENV> <fonction> <ce que ça fait>
  local prefixe=$1 env=$2 fonction=$3 quoi=$4
  if arme "$prefixe" && (( ! REFAIRE )); then
    print "  · $quoi : déjà armée, on n'y touche pas."
    return
  fi
  local cle; cle=$(fabriquer)
  print "$env=$cle" >> "$ENVF"
  # ⚠️ On RETIRE avant de créer : `vault.create_secret` refuse un nom déjà
  # pris, et un script qu'on n'ose pas rejouer est un script qu'on finit par
  # rejouer à la main.
  cat >> "$SQLF" <<SQL
delete from vault.secrets where name in ('${prefixe}_url', '${prefixe}_cle');
select vault.create_secret('$BASE/$fonction', '${prefixe}_url',
  'On-Demand : adresse de $fonction');
select vault.create_secret('$cle', '${prefixe}_cle',
  'On-Demand : meme valeur que $env');
SQL
  print "  · $quoi : à armer."
  A_FAIRE=1
}

poser prelevement PRELEVEMENT_CLE mission-prelever     "le prélèvement du septième jour"
poser relance     RELANCE_CLE     relance-reservation  "la relance d'une réservation sans carte"
print ""

if (( ! A_FAIRE )); then
  rm -f "$ENVF" "$SQLF"
  print "  Tout est déjà en place. Rien à faire."
  print "  Pour refabriquer les clés malgré tout : $0 --refaire"
  print ""
  exit 0
fi

print "  1/2 — les fonctions edge…"
supabase secrets set --project-ref "$JUMEAU" --env-file "$ENVF" > /dev/null
rm -f "$ENVF"
print "      posées."

print "  2/2 — le coffre de la base…"
supabase db query --file "$SQLF" --linked --project-ref "$JUMEAU" > /dev/null
rm -f "$SQLF"
print "      posés."
print ""

# ── Ce qu'on vérifie, et ce qu'on ne vérifie pas ───────────────────────────
#
# ⚠️ On ne relit AUCUNE valeur : ni le coffre, ni les secrets de fonction. On
# vérifie que les noms existent et ne sont pas vides, et c'est tout ce qui est
# vérifiable sans les afficher. Le reste se prouve en laissant tourner.
print "  Contrôle…"
supabase db query --linked --project-ref "$JUMEAU" --file /dev/stdin <<'SQL'
select name,
       case when length(decrypted_secret) > 0 then 'posé' else 'VIDE' end as etat
  from vault.decrypted_secrets
 where name in ('prelevement_url','prelevement_cle','relance_url','relance_cle')
 order by name;
SQL

print ""
print "  ⚠️ À PARTIR DE MAINTENANT, CES TÂCHES AGISSENT."
print ""
print "    · la relance écrit à un client dont la réservation n'a pas de carte,"
print "      à H+2, H+24 puis H+72 — jamais après la date de son inventaire ;"
print "    · le prélèvement facture au septième jour."
print ""
print "  Elles écrivent à de VRAIES adresses, le jumeau portant une clé Resend."
print "  Pour les désarmer :"
print ""
print "    select cron.unschedule('relance-reservation');"
print "    select cron.unschedule('prelever-les-locations');"
print ""
