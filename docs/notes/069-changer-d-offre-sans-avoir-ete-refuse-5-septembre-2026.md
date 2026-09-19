# Changer d'offre sans avoir été refusé (5 septembre 2026)

Deux constats de Julien, le lendemain du libre-service : *« le message est bien
mais le lien ramène au dashboard pas au magasin concerné »*, et surtout *« sur
le site je ne vois nulle part où je peux upgrade mon abonnement »*.

## ⚠️ LE PANNEAU DE PAIEMENT N'EXISTAIT QUE SOUS `etat === 'depasse'`

Le second constat était le vrai chantier, et ce n'était pas un défaut
d'affichage : sur la fiche d'un magasin, `PayerEnLigne` était rendu **dans la
branche du bandeau d'alerte**, celle qui ne s'ouvre qu'une fois un appareil
éconduit. Les refus ayant été nettoyés après le test du 4 septembre, il ne
restait rien à l'écran.

**Autrement dit : on n'avait construit que le chemin de la RÉACTION — être
bloqué, puis payer — et jamais celui de l'ANTICIPATION**, qui est pourtant le
cas normal : « mon inventaire de la semaine prochaine demande douze appareils,
je passe à Advanced aujourd'hui ». Un client qui doit d'abord se heurter au
verrou pour avoir le droit d'acheter, c'est le produit qui décide quand il a le
droit de dépenser.

`ChangerOffre` (`web/components/PayerEnLigne.tsx`) est donc rendu **dans les
trois états**, en pied de la section « Appareils ».

- **⚠️ IL N'AJOUTE AUCUN CHEMIN D'ACHAT.** Il compose ce qui existe :
  `proposer()` pour lire la grille — jamais un montant écrit sur place — et
  `PayerEnLigne` pour le paiement. Deux panneaux de paiement divergeraient au
  premier ajustement, et c'est le chemin de l'argent.
- **La seule exception est un changement DÉJÀ déposé** (`!offreEnCours`) :
  proposer d'acheter ce qu'on est en train d'acheter n'a pas de sens, et le
  serveur le refuserait (`deja_en_cours`). Le bandeau au-dessus porte alors les
  deux sorties — reprendre, ou annuler.
- **Le refus « déjà couvert » se dit AVANT le clic** : le serveur le prononce
  aussi, mais découvrir après avoir cliqué qu'il n'y avait rien à acheter fait
  douter du bouton. La borne haute, elle, reste au serveur — c'est une règle de
  grille, on n'en fait pas une copie de plus.
- **La phrase et le libellé changent avec l'état** : « Besoin de plus
  d'appareils pour un prochain inventaire ? · Changer d'offre » quand tout va
  bien, « Il vous en faut davantage ? · Choisir une autre offre » sous le
  bandeau d'alerte.

## ⚠️ « OFFRE », PLUS JAMAIS « FORFAIT »

Julien, sur la maquette : « change le mot forfait par autre chose ». Appliqué
partout, pas seulement au bouton — la tuile, le bandeau et le bouton disaient
la même chose sous deux noms, et deux mots pour la même chose dans la même
carte font douter qu'il s'agisse de la même chose. C'est aussi le mot de la
page Tarifs, et celui que le code emploie déjà pour ce geste (`kind = 'offre'`).

**⚠️ DEUX PHRASES QUE LE CLIENT LIT VIVENT EN BASE**, et elles auraient survécu
au renommage sans que rien ne le signale (migration `20260905120001`) :
`deposer_changement_offre` porte le refus qui s'affiche **sous le bouton**, et
`anomalies_a_signaler` la ligne « … l'offre en couvre M » qui part **dans
l'e-mail**. Chercher un mot d'interface, c'est aussi le chercher dans
`pg_get_functiondef`.

**⚠️ LES CLÉS NE BOUGENT PAS**, et c'est délibéré : `forfait_trop_juste` est
contraint par `notifications_type_check` ET filtré par la liste blanche de
`mes_notifications` ; `forfait_plein` est le code de refus que teste
`usePlaceAppareil` dans des builds **déjà installés** ; `'forfait'` est la
nature d'anomalie que trie l'edge. Renommer un identifiant pour une raison de
vocabulaire casse ce qui tourne. Une garde balaie les dix fichiers concernés et
n'accepte le mot que dans ces formes-là.

## Le lien de l'e-mail était bon — c'est l'ancre qui manquait

Reproduit en base : `anomalies_a_signaler` rendait bien le `store_id`, donc le
lien pointait sur `/magasins/<le magasin>`. **Mais il tombait en haut d'une
fiche** dont le geste proposé est à mi-page, sous les membres et les
inventaires. La section porte maintenant `id="appareils"`, et les deux canaux
la visent (`#appareils`) — l'e-mail comme la cloche.

## La tuile « En train de compter » a disparu

Elle vaut zéro dès que personne ne scanne, donc la plupart du temps quand on
ouvre la page ; et ce qu'elle mesurait vraiment — le magasin tient-il dans son
offre — est déjà dans les deux qui restent, **Refusés** et **Votre offre**.
Chacune mène à un geste.

## ⚠️ Un défaut d'écran trouvé en mesurant, pour la TROISIÈME fois

Le champ du panneau prend `.field input`, donc `--bg`. Dans un `.panel` (posé
sur `--surface`) il se détache ; ici `.admin-section` est **transparente**, donc
le champ se retrouvait exactement de la couleur de la page et ne tenait qu'à son
filet — invisible tant qu'il n'a pas le focus. Même défaut que `.magasin-top
input` le 22 août 2026 et que les deux champs de date du rapport magasin le
4 septembre. **Le point commun n'est pas le champ, c'est ce qu'il y a DERRIÈRE
lui** : mesurer les deux couleurs, jamais l'une seule.

## ⚠️ DEUX PIÈGES DE MÉTHODE, ET LE PREMIER A COÛTÉ DU TRAVAIL

1. **`git checkout -- <fichier>` ramène HEAD, pas l'état d'avant le sabotage.**
   En défaisant un sabotage de garde sur un fichier **non commité**, il a emporté
   tout le travail de la journée sur deux fichiers, qu'il a fallu refaire.
   Sabotage d'un fichier en cours de modification : `cp` avant, `cp` après —
   jamais git.
2. **`pg_get_functiondef` rend « CREATE OR REPLACE FUNCTION » en MAJUSCULES**,
   et `derniereDefinition` cherchait en minuscules. Repartir de la base est
   pourtant le moyen le plus sûr de ne réécrire QUE la phrase visée : le helper
   serait remonté à la définition **précédente**, exactement le défaut qu'il
   existe pour empêcher. Il est désormais insensible à la casse (`'gi'`), et la
   migration écrit quand même son en-tête en minuscules, comme tout le dépôt.

## Vérifications

- **Le parcours en base, ALLER ET RETOUR**, en transactions annulées, sur
  La Samaritaine. Aller : `peut_changer_offre` → dépôt 12 appareils (Advanced,
  plafond 20, 310 €/mois) → session attachée → webhook → le magasin passe à
  12 appareils **avec son abonnement enregistré** et 3 720 €/an, le rejeu du
  même événement répond `already`, **aucun magasin créé en trop**, journal
  `offre_changee`. Retour : annulation (il ne reste rien, on peut redéposer),
  changement d'échéance (3 300 €, **session jetée**, rejeu `already`), reprise
  (la demande relue porte ses 12 appareils).
- **Les gardes** : superviseur ordinaire et compteur refusés sur les trois
  fonctions ; les cinq refus du dépôt (déjà couvert, déjà en cours, hors grille,
  magasin d'un autre client, zéro appareil).
- **Zéro résidu contrôlé** : 0 demande, 2 magasins, La Samaritaine revenue à
  2 appareils sans abonnement.
- **Six sabotages, six échecs** : le panneau remis sous la condition « dépassé »,
  l'ancre retirée de l'e-mail, « forfait » remis dans un texte, la tuile
  instantanée remise, un montant écrit en dur, une vente sur l'écran de refus
  mobile.
- **Au navigateur**, par route jetable (retirée, `git status` contrôlé), clair
  et sombre, à 1 280 et 900 px : les trois états, le panneau ouvert (Advanced,
  310 € / 3 300 €, « Passer à Advanced »), le refus « déjà couvert » dit avant
  le clic, et la décomposition d'un dépassement (137 → « Enterprise couvre 140
  appareils — 100 appareils + 4 tranches de 10 », 1 146 € / 12 210 €).
  **Débordement horizontal nul.**
- 1 118 tests du site, 416 de l'application, `tsc --noEmit` des deux côtés,
  `eslint .` à zéro erreur, `next build` avec la table de routes inchangée.
- **Trois fonctions edge redéployées** — `alerte-anomalies` (v16),
  `stripe-webhook` (v27), `libre-service` (v8). `verify_jwt` **relevé sur la
  base avant** de déployer, recontrôlé après : faux, faux, vrai — inchangé. Les
  fichiers téléchargés depuis la production sont **identiques au dépôt**, et les
  trois répondent comme avant (405, 401 sans jeton, 403 sans clé).

⚠️ **CE QUI N'EST TOUJOURS PAS PROUVÉ, et c'est le même trou qu'hier : le chemin
d'API.** Un client qui a DÉJÀ un abonnement Stripe ne passe pas par Checkout —
on modifie son article. Aucune entreprise n'en a un aujourd'hui, donc ce chemin
n'a jamais tourné contre Stripe. Le nouveau panneau ne change rien à ça : il
appelle la même fonction edge, qui choisit le même chemin.

⚠️ **Et une note de ce fichier était FAUSSE** : elle disait que l'administrateur
de Groupe Bon Marché est « Compte Test Sup ». C'est **`jthiongkay@gmail.com`**,
relevé en base — le compte personnel de Julien. C'est pour ça qu'il reçoit les
e-mails d'alerte de ce magasin, et qu'il voit bien la section « Appareils ».

Tests de garde : `web/tests/decompte-appareils.test.ts`, blocs « changer d'offre
ne demande pas d'avoir été refusé », « le lien qu'on envoie tombe sur la
section », « on écrit "offre", jamais "forfait" », « la tuile instantanée a
disparu » et « les deux phrases qui vivent en base disent "offre" ».
