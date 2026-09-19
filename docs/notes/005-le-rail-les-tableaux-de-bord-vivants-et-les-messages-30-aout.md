# Le rail, les tableaux de bord vivants et les messages (30 août 2026)

Journée en cinq chantiers enchaînés, tous validés sur maquette avant code
(canevas : https://claude.ai/code/artifact/5105e587-7a15-4d59-a1c9-f67286ba951c).

## Le rail remplace la barre du haut, partout

Décision de Julien : « en finalité on ne gardera que le rail ». `AppShell`
porte un rail d'icônes fixe à gauche (76 px), tous rôles. Points tenus :

- **⚠️ La porte < 720 px ferme `.app-rail`**, plus `.appbar` — le test du gate
  a suivi. `--appbar-h` vaut 0 mais reste défini (`.dash-rail` s'y colle).
- **Le contenu prend la page, du rail au bord** : deux constats successifs de
  Julien ont tué la colonne 1120 puis le plafond 1400. `.app-main` n'a plus de
  max-width ; `margin-left: var(--rail-l)`, jamais un `margin auto` qui
  glisserait sous le rail.
- **`/dashboard` est l'atterrissage du superviseur, la liste vit sur
  `/inventaires`** — les sous-pages `/dashboard/<id>` allument l'onglet
  Inventaires, pas Tableau de bord.
- En bas du rail : message, cloche, avatar (menu à droite du rail).

## Les trois tableaux de bord parlent la même langue

`web/components/dashboard/TableauDeBord.tsx` : tuile (Kpi), diagramme de la
semaine (BarresSemaine), anneau (Anneau). Servis par `/dashboard`,
`/entreprise`, `/admin`.

- **⚠️ Tout est agrégé en base** (`tableau_de_bord_superviseur(p_semaine)`,
  `admin_revenu_par_entreprise`) — jamais de lignes de `counts` au navigateur.
- **⚠️ L'écart du tableau = l'écart du rapport**, même règle
  (`coalesce(final_qty, qty_pass2, qty_pass1)`, univers théorique ∪ compté),
  vérifié identique au centime ; seuls les inventaires AVEC stock théorique
  entrent dans l'anneau. `/entreprise` le groupe PAR MAGASIN (même fonction,
  clé `ecarts_magasins`) — l'admin est un superviseur au périmètre entier.
- **⚠️ L'anneau du revenu totalise l'ARR de la tuile** : même constante
  `370000` (panier moyen) qu'`admin_business_overview` — les deux bougent
  ensemble. Dates en Europe/Paris partout.
- **⚠️ Plein viewport à l'échelle de la maquette** : une maquette validée sur
  le canevas est vue ZOOMÉE ; `.tb-plein` reproduit ce zoom (base fluide
  min(largeur, hauteur) sur 1364×940, tout en em). Voir la mémoire
  « feedback-maquette-echelle ». `overflow-x: clip` sur la racine, jamais
  `hidden` (l'en-tête sticky décrocherait).
- **L'anneau** : 3 parts nommées max + « Autres » (palette validée pour 3
  teintes voisines, sombre #6366f1/#bd7f09/#1590c1, clair
  #4f46e5/#d97706/#0aa5d8) ; parts en écart ABSOLU ; centre dessiné DANS le
  SVG, taille selon la longueur du montant — il ne peut pas déborder.
- Le plafond du diagramme vaut 4 pas ronds (1, 2, 5 × 10ⁿ) : graduations
  entières, jamais « 0, 0, 1, 1, 1 » sur une semaine vide.
- Le trio Inventaires lancés / Articles comptés / Personnes actives vit sur
  `/admin/usage` (décision de Julien) — la garde du doublon le vérifie.

## Notifications (web)

Table `notifications` : **aucune policy d'écriture** — deux déclencheurs
(`session_members` INSERT ; `auth.users` UPDATE quand `last_sign_in_at`
passe de nul à non nul, la définition EXACTE d'is_active) et les RPC de
dépôt. Lecture `mes_notifications`, marquage `marquer_notifications_lues`
(ouvrir la cloche marque lu). Libellés FIGÉS à l'écriture. Purge à 90 jours
dans `purge_expired_data`. La cloche vit dans le RAIL : l'admin d'entreprise
reçoit les messages de ses superviseurs et n'atterrit pas sur /dashboard.

## Messages : des fils, et on répond

⚠️ **Deux jets le même jour, et le second annule une décision du premier.**
Le premier livrait un dépôt sans réponse et une liste de cartes en lecture
seule — constat de Julien : « je ne peux rien faire avec ». Une boîte de
réception est une CONVERSATION.

Trois tables (`message_fils`, `messages`, `message_participants`), aucune
policy d'écriture, tout par RPC : `ouvrir_fil`, `repondre_fil`, `mes_fils`,
`ouvrir_message_fil`. Écran `/messages` en deux panneaux (liste à gauche,
fil à droite, champ de réponse). Edge `message-admin` : ouverture SANS
`filId`, réponse AVEC.

- **⚠️ Puisqu'on répond, TOUT LE MONDE a une boîte** — superviseur compris.
  Le « il écrit sans recevoir » du premier jet était une erreur de
  conception : il écrit à son administrateur, il doit lire la réponse.
- **⚠️ La portée d'un fil NEUF se déduit du profil** (administrateur
  d'entreprise → Quantinvo, superviseur → son administrateur), jamais d'un
  paramètre. **La garde d'une RÉPONSE est l'appartenance au fil, rien
  d'autre** : ni rôle ni entreprise — on répond à qui vous a écrit.
- **⚠️ Vu d'un client, un fil vers nous dit « Quantinvo »** — et ce masque
  vaut aux QUATRE surfaces : la liste (`avec` ET `dernier_auteur`), le fil
  ouvert, la cloche, l'e-mail. Défaut vu sur un e-mail réel le soir même : la
  règle n'était tenue que par la liste, et « Admin a répondu » partait chez le
  client avec l'adresse Gmail personnelle en reply_to.
  · **Le masque se pose à la LECTURE, jamais à l'écriture** : entre nous, le
    vrai nom reste — on doit savoir quel collègue a répondu.
  · **Il tient par `messages.auteur_interne`, figé à l'écriture.** Une
    jointure sur `profiles` rendrait null après une suppression de compte et
    démasquerait précisément ce qu'on cache.
  · **Côté e-mail**, quand Quantinvo écrit à un client : expéditeur
    « Quantinvo », `reply_to` = `adresseDeContact()`, et l'entreprise du
    destinataire n'est pas répétée. Entre deux personnes du produit, on se
    répond directement — la règle « la réponse va à l'expéditeur » vaut
    partout ailleurs.
  · `fil_pour_email` sert ces décisions à l'edge : elle rend des identifiants
    de participants, donc **`service_role` seul**, jamais `authenticated`.
- **Toute réponse rappelle son sujet** (titre du mail et encadré) : sans lui
  on ne sait pas de quelle conversation il s'agit sans cliquer.
- **⚠️ L'état de lecture vit sur le fil, par personne** (`lu_le`) — une seule
  source. La cloche fait l'UNION notifications + fils non lus, et « tout
  marquer lu » ne touche QUE les notifications : lire sa cloche n'est pas
  lire son courrier. Ouvrir UN fil ne lit que lui.
- L'auteur est FIGÉ dans `auteur_label` : un fil survit à un compte supprimé.
  Purge à un an sur `dernier_le` — une conversation vivante ne perd pas son
  début.
- Les destinataires de l'e-mail SONT les participants du fil ; son bouton
  mène à `/messages?fil=<id>`. Bornes 120/2000 qui REFUSENT. Repli : edge
  injoignable → RPC directe, message sans e-mail.
- `deposer_message_admin` et `deposer_message_quantinvo` restent en base sans
  appelant (règle : on retire les appels d'abord). Ne plus rien y brancher.

## Recherche globale (tableau de bord superviseur)

`RechercheGlobale` : inventaires + équipe dans un champ, AUCUNE surface
serveur nouvelle — `getAccessibleSessions` + `my_team_by_store`, une fois au
premier focus, filtre sur place. Une RPC de recherche ne se justifiera qu'à
un volume qu'aucun compte n'a.

Tests de garde : `web/tests/notifications.test.ts`, et les blocs rail /
tableau de bord de `web/tests/navigation.test.ts`.

## Ce que Julien a vérifié lui-même le 30 août 2026

- **La messagerie, de bout en bout** : écriture, réponse, boîte à deux
  panneaux, et **les e-mails reçus dans une vraie boîte** — dont celui qui a
  révélé le défaut « une seule voix », puis sa correction (« Quantinvo a
  répondu », reply_to `contact@quantinvo.com`, sujet rappelé).
- **Les trois tableaux de bord**, en session réelle : « ont l'air d'être
  prêts, reste plus qu'à attendre une utilisation réelle au quotidien ».

Ce que seul l'usage dira, et qu'il ne sert à rien de fixer d'ici là : les
échelles et l'anneau sur un vrai mois d'activité (les données d'essai sont
maigres), et le rythme des notifications — prévient-elle au bon moment, ou
bavarde-t-elle. La RPC de recherche reste à écrire le jour où un compte aura
trop d'inventaires pour le filtrage sur place ; pas avant.
