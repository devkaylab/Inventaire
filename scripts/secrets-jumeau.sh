#!/bin/zsh
#
# Poser les secrets du projet Supabase JUMEAU (Quantinvo On-Demand).
#
# ⚠️⚠️ **CE SCRIPT EXISTE POUR QUE LES VALEURS NE PASSENT PAR PERSONNE.** Les
# clés sont saisies à l'aveugle (rien ne s'affiche, rien n'entre dans
# l'historique du shell), écrites dans un fichier temporaire en 0600, envoyées
# en un seul appel, puis le fichier est effacé. Aucune valeur n'apparaît dans
# la ligne de commande — donc rien dans `ps`, rien dans les journaux.
#
# ⚠️ **LE PROJET VISÉ EST ÉCRIT EN DUR, et c'est voulu.** Un `--linked` ferait
# dépendre la cible de l'état du dépôt : le même script poserait les secrets du
# jumeau sur la PRODUCTION si le lien avait changé entre-temps. Il a changé
# deux fois dans la seule journée du 10 octobre 2026.
#
# ⚠️ **STRIPE EST ENCORE EN MODE TEST** (`STRIPE_LIVE_PRET = false` dans
# `web/lib/legal.ts`). Les secrets Stripe de la PRODUCTION sont donc déjà des
# valeurs de test : on les recopie, il n'y a rien à créer dans Stripe —
# SAUF le secret du webhook, qui appartient à une adresse et pas à un compte.
#
# Usage :  ./scripts/secrets-jumeau.sh
set -e

JUMEAU=lqgusznqcunjhrqslcug
PROD=heabesqvlinzarqenymj

print ""
print "  Secrets du projet jumeau — Quantinvo On-Demand ($JUMEAU)"
print "  ────────────────────────────────────────────────────────"
print ""
print "  ⚠️ Supabase NE REDONNE JAMAIS la valeur d'un secret : sa page n'affiche"
print "  qu'une empreinte. Les valeurs se prennent À LA SOURCE :"
print ""
print "    Stripe (clé + tarifs) : https://dashboard.stripe.com/test/apikeys"
print "                            https://dashboard.stripe.com/test/products"
print "    Resend (clé d'API)    : https://resend.com/api-keys"
print ""
print "  Rien ne s'affiche quand tu colles, c'est normal. Entrée vide = on passe,"
print "  et une ligne passée se pose après — rien n'est cassé."
print ""

TMP=$(mktemp -d)
chmod 700 "$TMP"
ENVF="$TMP/jumeau.env"
: > "$ENVF"
chmod 600 "$ENVF"
# Le fichier part, quoi qu'il arrive — y compris si tu interromps par Ctrl-C.
trap 'rm -rf "$TMP"' EXIT INT TERM

# ⚠️ **L'AIDE NE DOIT PAS RESSEMBLER À UNE VALEUR DÉJÀ SAISIE.** Première
# version : l'explication de `CONTACT_EMAIL` commençait par
# « contact@quantinvo.com — l'adresse de réponse… ». Julien a lu la valeur à
# l'écran et attendu que le script continue : « c'est déjà écrit ». Une ligne
# d'aide se préfixe donc, et ce qu'il faut taper se donne après « tape : ».
poser() {  # poser NOM "explication" [a_taper]
  local nom=$1 aide=$2 aTaper=$3 val
  print "  $nom"
  print "    ↳ $aide"
  [[ -n "$aTaper" ]] && print "    ↳ tape : $aTaper"
  printf "    valeur (rien ne s'affiche, puis Entrée) : "
  read -rs val
  print ""
  if [[ -z "$val" ]]; then
    print "    (passé)"
  else
    print -r -- "$nom=$val" >> "$ENVF"
    print "    noté (${#val} caractères)"
  fi
  print ""
}

print "  ── 1. Recopiés de la production, à l'identique ──────────────────"
print ""
poser RESEND_API_KEY "La clé d'API Resend (commence par re_). Celle de la production convient, ou crée-en une." ""
poser CONTACT_EMAIL "L'adresse de réponse des e-mails." "contact@quantinvo.com"
poser INVITE_FROM_EMAIL "L'expéditeur des e-mails." "Quantinvo <invitations@quantinvo.com>"
poser STRIPE_SECRET_KEY "La CLÉ SECRÈTE (sk_test_), pas la clé publiable (pk_test_)." ""

print "  ── 2. Les huit Price Stripe, recopiés aussi (price_...) ─────────"
print ""
# ⚠️ **LE MONTANT EST RAPPELÉ À CHAQUE LIGNE, et ce n'est pas du confort.**
# Le 10 octobre 2026, `ESSENTIAL_YEARLY` a reçu l'identifiant du tarif MENSUEL.
# Une page de paiement se serait ouverte, parfaitement valide, à 89 € par AN au
# lieu de 950 €. C'est le piège de la fiche 061 : ce qui fait foi est le
# montant, pas le fait que la session s'ouvre. Le tarif se lit dans le
# catalogue Stripe, produit par produit.
for couple in "ESSENTIAL_MONTHLY:Essential, 89,00 € par mois" \
              "ESSENTIAL_YEARLY:Essential, 950,00 € par AN" \
              "ADVANCED_MONTHLY:Advanced, 310,00 € par mois" \
              "ADVANCED_YEARLY:Advanced, 3 300,00 € par AN" \
              "ENTERPRISE_MONTHLY:Enterprise, 890,00 € par mois" \
              "ENTERPRISE_YEARLY:Enterprise, 9 450,00 € par AN" \
              "APPAREILS_MONTHLY:Appareils supplémentaires, 64,00 € par mois" \
              "APPAREILS_YEARLY:Appareils supplémentaires, 690,00 € par AN"; do
  poser "STRIPE_PRICE_${couple%%:*}" "${couple#*:}" "l'identifiant price_... de CE tarif"
done

print "  ── 3. Celui qui doit être NEUF ──────────────────────────────────"
print ""
print "  Un secret de webhook appartient à UNE adresse, pas à un compte : celui"
print "  de la production ne signera jamais les appels reçus par le jumeau."
print ""
print "  Dans Stripe (mode test) → Développeurs → Webhooks → Ajouter :"
print "    adresse : https://$JUMEAU.supabase.co/functions/v1/stripe-webhook"
print "    évènements : checkout.session.completed, invoice.paid,"
print "                 invoice.payment_failed, customer.subscription.deleted"
print "  Puis révèle « Clé secrète de signature » (whsec_...) et colle-la ici."
print ""
poser STRIPE_WEBHOOK_SECRET "La signature (whsec_) du NOUVEAU point d'entrée, celui du jumeau." ""

print "  ── 4. Les nôtres : tirés au hasard, et DIFFÉRENTS de la prod ────"
print ""
print "  Ce sont nos propres mots de passe partagés, pas des clés d'un tiers."
print "  Les reprendre de la production ferait qu'une fuite d'un côté ouvre"
print "  l'autre. On en tire des neufs — personne n'a besoin de les lire."
print ""
PREL=$(openssl rand -hex 32)
for couple in "ALERTE_CLE:$(openssl rand -hex 32)" "METRICS_KEY:$(openssl rand -hex 32)" "PRELEVEMENT_CLE:$PREL"; do
  print -r -- "${couple%%:*}=${couple#*:}" >> "$ENVF"
  print "    ${couple%%:*} : tiré au hasard, 64 caractères"
done
print ""

if [[ ! -s "$ENVF" ]]; then
  print "  Rien à poser. Rien n'a été envoyé."
  exit 0
fi

print "  ── Envoi ────────────────────────────────────────────────────────"
print ""
supabase secrets set --project-ref "$JUMEAU" --env-file "$ENVF"
print ""

# ── Le coffre : la tâche horaire y lit l'adresse et la clé ────────────────
#
# ⚠️ Elles ne sont PAS dans les secrets de fonction : la tâche `cron` tourne
# dans la base, elle ne voit pas l'environnement des fonctions edge. Tant que
# le coffre est vide, `declencher_le_prelevement` ne fait rien — c'est son
# garde-fou, et c'est pour ça que le jumeau n'a encore appelé personne.
SQLF="$TMP/coffre.sql"
: > "$SQLF"; chmod 600 "$SQLF"
cat >> "$SQLF" <<EOSQL
delete from vault.secrets where name in ('prelevement_url', 'prelevement_cle');
select vault.create_secret(
  'https://$JUMEAU.supabase.co/functions/v1/mission-prelever',
  'prelevement_url', 'On-Demand : adresse de mission-prelever');
select vault.create_secret(
  '$PREL', 'prelevement_cle', 'On-Demand : meme valeur que PRELEVEMENT_CLE');
EOSQL

print "  ── Le coffre de la base (la tâche horaire y lit) ─────────────────"
print ""
# ⚠️ `--linked --project-ref` ENSEMBLE : `--project-ref` seul est refusé
# (« only applies when targeting the linked project »), et `--linked` seul
# viserait le projet lié du dépôt — la PRODUCTION la plupart du temps.
supabase db query --file "$SQLF" --linked --project-ref "$JUMEAU" >/dev/null \
  && print "  prelevement_url et prelevement_cle posés." \
  || print "  ⚠️ Le coffre n'a pas été écrit — relance, ou dis-le-moi."
print ""

print "  ── Contrôle (les noms seulement, jamais les valeurs) ────────────"
print ""
supabase secrets list --project-ref "$JUMEAU"
print ""
print "  Fini. Le fichier temporaire est effacé."
