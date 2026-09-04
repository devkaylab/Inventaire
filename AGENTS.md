# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v56.0.0/ before writing any code.

# La version Android existe (29 août 2026)

Premier build Android réussi, sans toucher au projet iOS. Ce qu'il faut savoir
avant d'y retoucher :

- **`android/` est un dossier GÉNÉRÉ** (`npx expo prebuild --platform android`),
  et il est dans le `.gitignore` — contrairement à `ios/`, qui est versionné.
  Ne pas l'ajouter à git ; toute configuration durable passe par `app.json`
  (qui portait déjà le paquet `com.quantinvo.app`, l'icône adaptative et les
  permissions) ou par un plugin de configuration.
- **`./scripts/pixel.sh` est le seul chemin de build**, pendant de
  `simulateur.sh` : il pose `JAVA_HOME` / `ANDROID_HOME` (un shell non
  interactif ne les a pas), régénère `android/` et `local.properties` s'ils
  manquent, compile, installe et lance sur le téléphone branché en USB.
  Contrairement à l'iOS, **pas d'étape EXConstants à la main** : le plugin
  Gradle d'Expo dépose app.config pendant le build.
- **La chaîne installée le 29 août 2026** (Homebrew) : `openjdk@17` (formule,
  pas de sudo), `android-commandlinetools` (cask), puis par `sdkmanager` :
  plateforme android-36, build-tools 36.0.0, NDK 27.1.12297006, cmake 3.22.1 —
  les versions viennent de `node_modules/react-native/gradle/libs.versions.toml`,
  pas d'un choix. Licences acceptées. `JAVA_HOME`, `ANDROID_HOME` et le PATH
  (`adb`) sont posés dans `~/.zshrc`.
- **⚠️ L'APK release est signé avec la clé de DEBUG** (comportement du gabarit
  Expo) : parfait pour installer sur un appareil, **interdit pour Google
  Play**. La publication passera par un AAB et une vraie clé de signature —
  probablement la signature gérée par Play ou EAS. Rien de tout cela n'est
  fait ; le compte Play Console de Julien est en cours de validation
  d'identité.
- L'espace dans le chemin (`App inventaire`) n'a posé aucun problème à Gradle,
  au NDK ni à CMake — 642 tâches, aucune reprise à la main.

# Tutoriel / onboarding

Le tutoriel intégré a été **entièrement retiré** de l'app (composants `help/`,
`HelpModal`, bouton « ? » du header, drapeau `firstRun`, captures
`assets/help/`). Un vrai parcours d'onboarding sera conçu plus tard.

En attendant : **ne pas le réintroduire**, ne pas rajouter de bouton d'aide ni
de modale d'accueil, et ne pas recréer `src/lib/firstRun.ts`. Si l'onboarding
revient au programme, il sera repris à zéro — l'ancien tutoriel décrivait déjà
des écrans disparus (notamment les boutons de passe « Passer en Audit » /
« Revenir en … », supprimés avec `advance_pass` / `revert_pass`).

# Le bandeau de démarrage (23 août 2026)

*« Remplacer le bloc “Pour démarrer” par un bandeau d'une seule étape
(~76 px), qui ne vise plus un inventaire mais le démarrage du superviseur. »*

Le bloc « Pour démarrer » déroulait quatre étapes de **préparation d'un
inventaire** (créer, zones, fichiers, membres) en haut de l'accueil. Deux
choses ont changé, et la seconde est la plus importante.

**La forme** : `components/BandeauDemarrage.tsx`, une rangée de 76 px,
cliquable de bout en bout, avec un chevron et une croix. Elle annonce, elle
n'explique pas — l'explication vit dans l'écran où l'on atterrit.

**L'objet** : les trois étapes sont ce qu'il faut avoir fait **une fois** pour
être en état de travailler — `Générer mes balises` (→ boîte à outils),
`Constituer mon équipe` (→ Mon équipe), `Créer mon premier inventaire`. La
préparation d'une session se conduit depuis la session, où elle est déjà.

Points à ne pas défaire :

- **⚠️ Le bandeau ne se rejoue pas** (28 août 2026). Ses étapes se cochent sur
  des faits relus à chaque ouverture : supprimer ses inventaires remettait la
  troisième à faire et le bandeau revenait — des semaines après le démarrage,
  à quelqu'un qui connaît le produit. Constat de Julien : « il s'affiche à
  chaque fois qu'il n'y a plus d'inventaire en cours ». La fin du démarrage
  est donc **notée** dès qu'elle survient (les trois étapes cochées, ou plus
  d'un inventaire créé), avec **le repère que la croix marque déjà** —
  surtout pas un jalon : « Revoir les repères » doit pouvoir ramener le
  bandeau, or un jalon ne s'efface pas. Le marquage reprend les gardes de
  `montrerGuide` : on ne consomme pas un bandeau qu'on n'a jamais montré.
- **⚠️ L'étape des balises se coche sur un jalon local, et il n'y a pas
  d'autre moyen.** Une planche est dessinée sur le téléphone et **n'écrit rien
  en base** : aucun fait serveur ne dira jamais qu'elle a été produite. D'où
  `Jalon` dans `lib/reperes.ts` — à ne pas confondre avec un repère : un
  repère est une aide qui ne se montre qu'une fois, un jalon est un **fait**.
  Il se pose dans `BaliseCreator`, au `onSuccess` du dessin du PDF, et nulle
  part ailleurs. `useJalon` le relit à chaque retour sur l'écran
  (`useFocusEffect`) : on revient précisément de l'écran qui vient de le
  poser. Conséquence assumée : changer de téléphone remet l'étape à faire.
- **`oublierReperes` n'efface pas les jalons.** « Revoir les repères » rejoue
  les aides ; il ne défait pas ce qui a été fait.
- **Les deux autres étapes se lisent en base** : `my_team_by_store` (la même
  RPC que « Mon équipe ») et les inventaires créés par la personne. **Une
  invitation en attente compte** comme une équipe constituée — sinon l'étape
  resterait à faire juste après avoir invité quelqu'un.
- **Le bandeau ne remplace jamais la liste.** Le guide qui l'a précédé prenait
  l'écran entier et masquait l'inventaire qu'on venait de créer ; à 76 px la
  question ne se pose plus. `guidePleinEcran` a disparu.
- **⚠️ « + Nouvel inventaire » ne se masque JAMAIS.** Il l'a été deux fois,
  et deux fois cela a laissé quelqu'un sans rien à toucher : tant que le guide
  pleine page durait, puis — première version de ce bandeau — quand l'étape en
  cours était la création et que la liste était vide. Julien, le 23 août 2026,
  capture à l'appui : un bandeau, une salutation, « Aucun inventaire pour
  l'instant », et c'est tout. **Le chevron d'un bandeau ne se lit pas comme un
  bouton.** Ce n'est pas non plus le doublon d'autrefois : le guide pleine page
  portait un bouton violet au même libellé, une rangée de 76 px et un bouton
  d'action ne se confondent pas. La seule chose qui remplace encore ce bouton
  est la barre de sélection multiple.
- `getPreparation` et les invalidations `['preparation', …]` de Zones, Import
  et Inviter ont été **retirées** : plus personne ne les lit.

## Deux défauts trouvés en l'exerçant, et corrigés

Tout a été parcouru au simulateur, appui par appui. Deux choses cassaient, et
la seconde rendait la première étape inutilisable.

1. **Mon équipe et Boîte à outils s'ouvrent depuis deux endroits.** Le bandeau
   y mène directement depuis l'accueil superviseur, donc **en traversant deux
   groupes de routes** : ils sont alors le premier écran de la pile `(compte)`,
   la flèche native ne s'affiche pas, et on reste coincé dessus. C'est le piège
   déjà écrit plus bas (« ce qu'un écran ouvre doit être dans sa pile ») ; ici
   il est réglé par un `headerLeft: RetourVersApp` sur ces deux écrans, qui
   pointe vers le bon endroit dans les deux cas.

2. **⚠️ « Créer et imprimer des balises » ne marchait pas — et c'était vrai
   avant ce chantier.** L'overlay de chargement était une `Modal`, donc un
   `UIViewController` présenté : iOS **refuse** d'ouvrir la feuille de partage
   par-dessus (`Attempt to present UIActivityViewController … which is already
   presenting`), `shareAsync` ne se résolvait jamais, le bouton tournait
   indéfiniment et **aucun PDF ne sortait**. Retirer la modale juste avant le
   partage ne suffit pas non plus : la feuille s'ouvre « while a presentation
   is in progress », et à sa fermeture **l'application ne répond plus du tout**
   — plus un seul appui, il faut la relancer.

   Corrigé en deux gestes : `lib/balises.ts` sépare `buildBaliseSheetFile`
   (dessiner) de `shareBaliseSheet` (partager), et **`GeneratingOverlay` n'est
   plus une `Modal`** mais un voile posé sur la carte qui l'accueille. Plus
   rien n'est présenté, donc plus de conflit. Ne pas la remettre en `Modal`.

## Ce qui change le stockage prévient les écrans

Dans la foulée, « Revoir les repères » (Mon compte) : il effaçait bien les
clés, mais les écrans qui affichent les repères ne relisaient le stockage
qu'à leur montage. On appuyait, **rien ne se passait**, et les repères ne
revenaient qu'au prochain lancement — un bouton qui a l'air cassé.

`lib/reperes.ts` porte donc un **avertissement** : `marquerRepereVu`,
`oublierReperes` et `poserJalon` préviennent les hooks abonnés, **après
l'écriture, jamais avant** (les écrans vont relire le stockage, il doit déjà
être à jour — c'est aussi ce qui évite qu'un repère tout juste fermé
réapparaisse).

Pourquoi pas une relecture au retour sur l'écran (`useFocusEffect`), qui
était le premier réflexe : **la porte de bienvenue n'est pas un écran**, elle
est posée en surcouche du layout racine (`_layout.tsx`), hors de la pile de
navigation. Elle n'aurait donc rien relu — et c'est précisément ce que
l'alerte nomme en premier. L'avertissement, lui, ne dépend d'aucune
navigation, et sert les repères comme les jalons : **un seul mécanisme**.
`useJalon` n'utilise plus `useFocusEffect`.

Au passage, l'état des deux hooks **porte le compte qu'il décrit**
(`{ uid, lu, … }`). L'ancienne forme le remettait à zéro dans l'effet — le
`setState` synchrone que React déconseille, et l'état d'une personne
s'affichait un instant à la suivante.

Vérifié au simulateur le 23 août 2026, clair et sombre : le bandeau à
« 1 sur 3 », l'impression jusqu'au PDF (`balises_1-900`, 1,2 Mo, feuille de
partage avec Imprimer et Enregistrer), le jalon qui fait passer le bandeau à
« 2 sur 3 » au retour, les deux flèches de retour, la croix qui masque,
l'application qui répond après la fermeture du partage, et « Revoir les
repères » qui **ramène la bienvenue et le bandeau sans relancer l'app** — le
jalon des balises, lui, reste posé (« 2 sur 3 »), comme prévu.

Tests de garde : `tests/compte.test.ts`, bloc « le bandeau de démarrage » et
« Revoir les repères » se voit tout de suite ».

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

# Le chemin jusqu'au premier scan (28 août 2026)

Julien, après la correction du bandeau : *« j'ai l'impression qu'il manque
d'autres points que tu m'avais présenté »*. C'était vrai — la maquette
d'onboarding du 23 août avait dix points non repris. Trois ont été faits, ceux
qui coûtent le moins et se voient le plus. Maquette validée avant codage :
https://claude.ai/code/artifact/11abbe82-225d-4ea2-ad0e-e7c99d00d34a

Ils se lisent dans l'ordre où on les rencontre : l'e-mail, la fin de
`/bienvenue`, puis l'application.

## 1. L'invitation nomme qui invite, et où l'on arrive

`invite-teammate` disait « Vous avez été ajouté à une équipe d'inventaire par
Paul Martin », objet « Finalisez votre compte Quantinvo ». Ni le magasin, ni
l'entreprise, et **rien sur l'application qu'il faudra installer** — or c'est
là qu'on compte.

L'objet porte désormais le nom de qui invite et celui du lieu, le corps annonce
les deux gestes qui restent, et l'encadré de faits (celui de l'invitation à un
inventaire, rien de neuf à dessiner) porte magasin, entreprise et **identifiant**.

- **⚠️ Le magasin n'est nommé que s'il y en a un seul.** Une invitation peut en
  porter plusieurs, ou aucun — « aucun » voulant dire tous ceux du superviseur,
  résolus à l'inscription par `handle_new_user`. Dans ces deux cas l'entreprise
  prend sa place : **une liste de magasins ne se lit pas dans un objet
  d'e-mail**.
- **⚠️ Les deux lectures (nom du magasin, nom de l'entreprise) viennent APRÈS
  tous les contrôles.** Elles servent à écrire le message, jamais à décider de
  l'invitation. La liste des magasins du superviseur, elle, était déjà lue plus
  haut — c'est un contrôle : elle a seulement été sortie du `if`.
- **Sans nom complet au profil, la phrase tient quand même** (« Votre
  responsable vous a ajouté… ») : on ne laisse jamais un blanc à la place de
  qui invite.
- **⚠️ Aucun lien de boutique dans l'e-mail.** Deux gestes concurrents dans un
  message qui n'en veut qu'un, et un lien mort tant que l'application n'est pas
  publiée. Le chemin vers la boutique est à l'étape suivante, après le mot de
  passe — là où il est vrai.
- **Les trois autres invitations ne bougent pas** : superviseur et
  administrateur travaillent sur le site, et l'invitation à un inventaire nomme
  déjà l'inventaire, le magasin et le rôle dans son encadré.

⚠️ **La fonction edge doit être redéployée** — le dépôt ne déploie rien. Elle
exige un jeton : la déployer **sans** `--no-verify-jwt`, contrairement aux six
fonctions publiques.

## 2. La fin de `/bienvenue` mène à la boutique

La page disait « ouvrez l'application » sans dire où la prendre. Les badges
vivaient sur `/open`, donc à un clic de plus, **derrière un lien qui ne mène
quelque part que si l'application est déjà installée**. Or cette page s'ouvre
depuis une messagerie, au téléphone, juste après le choix du mot de passe :
c'est le seul moment du parcours où montrer la boutique ne coûte rien.

- **« Ouvrir l'application » reste l'action première.** Tant que `PUBLIEE` vaut
  faux dans `web/lib/appStores.ts`, un badge mène à une **recherche qui ne
  trouve rien** : il ne peut pas être le bouton principal.
- **Rien de neuf n'est dessiné** : c'est `StoreBadges`, qui suit `appStores.ts`.
  Le jour de la publication, une seule ligne change là-bas et cette page dit
  vrai toute seule, phrase d'attente comprise.
- **L'adresse est rappelée en toutes lettres** : c'est l'identifiant, et la
  personne va devoir le retaper dans l'application deux minutes plus tard.
- **⚠️ Rien ne renvoie vers le web** (constat de Julien sur la maquette :
  *« pourquoi continuer sur le web ? »*). Un compteur y atterrirait sur « Mon
  compte », que l'espace connecté referme sous 720 px — il lirait « cet espace
  se pilote depuis un ordinateur » sur l'appareil qu'il tient. `/open` garde ce
  lien, lui : un superviseur y passe aussi.
- Le superviseur ne voit rien de tout cela : son bouton reste « Accéder à mon
  espace ».

## 3. Le geste caché, montré une fois

Le balayage d'un inventaire découvre « Clôturer » et « Supprimer » depuis le
22 août, et **rien ne le disait**. Le repère `balayage` était même déclaré dans
`lib/reperes.ts` depuis le 23 août et branché sur aucun écran — la seule pièce
de l'onboarding qui existait sans interface.

Sur l'accueil superviseur, la première carte s'entrouvre d'elle-même une
seconde puis se referme, et une bulle nomme le geste.

- **⚠️ Les volets sont inertes pendant le coup d'œil**
  (`pointerEvents={coupDoeil ? 'none' : 'auto'}`). Ils s'ouvrent sans que
  personne ne les ait demandés : un doigt déjà posé sur l'écran ne doit pas
  tomber sur « Supprimer ». Ils redeviennent touchables une fois la carte
  refermée.
- **Il attend le deuxième inventaire.** Avec un seul, le bandeau de démarrage
  occupe encore le haut de l'écran, et **on ne sert pas deux aides à la fois**
  (`!montrerGuide` est dans la condition). C'est aussi le moment où la liste
  commence à se gérer.
- **Il ne se joue que sur le premier rang qui porte réellement un volet** : un
  inventaire invité n'en a aucun, et une démonstration sur une carte qui ne
  bouge pas apprendrait le contraire de ce qu'on veut. Jamais pendant une
  sélection.
- **« Compris » marque le repère, et lui seul.** Quitter l'écran sans répondre
  le laisse à voir : une aide qu'on n'a pas lue n'a pas été donnée.
- Les minuteries sont nettoyées au démontage — un rang qui disparaît n'ouvre
  rien plus tard.

## Ce qui restait de la maquette du 23 août

⚠️ **CETTE LISTE EST PÉRIMÉE DEPUIS L'APRÈS-MIDI DU 28 AOÛT**, et elle a
induit en erreur le 4 septembre : je l'ai relue telle quelle et annoncé à
Julien deux chantiers déjà réglés. Les six points ci-dessous ont été faits le
jour même (section « Le reste de la maquette d'onboarding »), et le solde est
clos le 4 septembre (section « L'onboarding est clos »). **Une liste de
« reste à faire » qui vit dans un fichier daté doit être barrée quand elle est
faite, pas laissée à côté de la section qui la contredit.**

Ce qui était non fait le matin du 28 août : le viseur qui enseigne (consignes
temporisées, trace « Dernier scan »), la carte de pré-demande des
notifications, « Je n'ai pas reçu mon invitation » sur la connexion, l'état des
invitations dans l'équipe d'un inventaire (relance, QR), le repère « Tout est
dans le menu » de l'écran de suivi, la checklist de l'administrateur
d'entreprise — et la question restée ouverte : un seul inventaire ouvert,
l'ouvre-t-on directement ?

## Vérifications (28 août 2026)

- **`/bienvenue`** vu au navigateur, clair et sombre, sur 375 px, en forçant
  temporairement la branche « Compte activé » d'un compteur (forçage retiré,
  `git status` contrôlé) : l'adresse en gras, le bouton, les deux badges, et la
  phrase « L'application arrive bientôt sur les deux boutiques ».
- **L'indice de balayage** exercé au simulateur sur un compte réel, appui par
  appui : la carte s'entrouvre sur « Clôturer » et « Supprimer » (capturée
  pendant le coup d'œil), **un appui sur « Supprimer » pendant ce temps ne fait
  rien** — c'est la garde à ne pas défaire —, « Compris » retire la bulle, et
  le balayage volontaire ouvre bien la confirmation nommée. Données d'essai
  supprimées, zéro résidu contrôlé en base.
  ⚠️ **Piège du jour** : l'application installée dans le simulateur tournait
  sur un **bundle figé** — les modifications ne se voyaient pas, alors que
  Metro servait bien le code à jour (vérifié en téléchargeant le bundle).
  Passer par `./scripts/simulateur.sh` avant de conclure quoi que ce soit.
- **La fonction edge** redéployée par le CLI (version 26, `verify_jwt` toujours
  vrai, 401 sans jeton), et les fichiers téléchargés depuis la production sont
  **identiques à l'octet près** à ceux du dépôt.
- **Non vérifié** : l'e-mail reçu dans une vraie boîte. Il demande une
  invitation réelle, donc un compte de plus.

Tests de garde : `tests/compte.test.ts` (bloc « le geste caché, montré une
fois »), `web/tests/email-template.test.ts` (bloc « l'invitation d'un compteur
nomme qui invite »), `web/tests/navigation.test.ts` (« figurent aussi à la fin
de /bienvenue »).

# Reconstruire pour le simulateur : trois pièges (28 août 2026)

Le bundle figé signalé plus haut a une suite. En voulant vérifier que le
simulateur tournait bien sur le dernier build, trois choses ont fait perdre du
temps — deux sont des pièges réels, la troisième est une erreur de méthode qu'il
vaut mieux ne pas refaire.

## ⚠️ 1. `pod install` échoue en silence dans un shell sans locale

```
Unicode Normalization not appropriate for ASCII-8BIT (Encoding::CompatibilityError)
```

CocoaPods normalise les chemins en Unicode. Un shell **non interactif** — celui
d'un agent, d'un script, d'un hook — n'a pas de locale UTF-8, Ruby travaille en
`ASCII-8BIT`, et l'installation s'arrête avant d'avoir rien fait. La commande
qui marche :

```bash
cd ios && LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 pod install
```

**Ce qui rend le piège coûteux, c'est le silence** : enchaînée avec `&&` ou son
code de sortie ignoré, l'installation ratée ne se voit pas, le build suivant
réussit, et l'application livrée est amputée de son module natif sans le moindre
avertissement. La règle de la mémoire projet — « toute dépendance native se
termine par un `pod install` avant de faire reconstruire » — se complète donc
ainsi : **il ne suffit pas de le lancer, il faut lire ce qu'il répond**
(« Pod installation complete! N dependencies, N total pods installed »).

## ⚠️ 2. Le bon probe est `ExpoModulesProvider.swift`, pas `strings`

Pour savoir si un module natif Expo est réellement lié à l'application
installée, **un seul artefact fait foi** :

```bash
grep -i <module> ios/Pods/Target\ Support\ Files/Pods-Inventaire/ExpoModulesProvider.swift
```

C'est le fichier que CocoaPods génère à chaque `pod install`, et il liste
exactement les modules enregistrés au démarrage (43 aujourd'hui).

**Trois probes tentants et tous faux**, essayés dans cet ordre avant de trouver
le bon :

- `strings <app>/Inventaire | grep <module>` — rend 0 même quand le module est
  là : compilé en bibliothèque statique, il n'apparaît pas en chaîne lisible ;
- `ls <app>/Frameworks/` — ne montre que les pods construits en frameworks
  dynamiques. `ExpoSecureStore` n'y est pas, `ExpoCamera` oui : l'absence ne
  prouve rien ;
- `ls ios/Pods/<Module>` — un pod local (`:path => ../node_modules/…`) n'est pas
  toujours recopié dans `Pods/`. Là encore, l'absence ne prouve rien.

**Et la preuve qui vaut mieux que toutes les autres reste l'exécution** : si
`expo-secure-store` manquait, la session ne se restaurerait pas — le jeton y est
rangé. Une capture montrant quelqu'un de connecté suffit à trancher.

## ⚠️ 3. Vérifier la date du binaire, pas celle d'`Info.plist`

`Info.plist` garde une date recopiée depuis les produits de compilation : il
peut afficher une date ancienne sur une application fraîchement construite. Et
**le conteneur change à chaque réinstallation** — un chemin relevé une fois ne
vaut plus rien ensuite.

```bash
APP=$(xcrun simctl get_app_container <UDID> com.quantinvo.app)
stat -f "%Sm" -t "%d/%m %H:%M" "$APP/Inventaire"   # le binaire, pas l'Info.plist
```

## Ce que donne une vérification complète

Le 28 août 2026, après reconstruction : binaire à 21 h 39, `SecureStoreModule`
présent dans `ExpoModulesProvider.swift`, application ouverte sur une session
restaurée, et aucune erreur `SecureStore` ni « native module not available »
dans `xcrun simctl spawn <UDID> log show`. Les quatre ensemble, pas un seul.

# Le reste de la maquette d'onboarding (28 août 2026)

Les six points qui restaient de la maquette du 23 août
(https://claude.ai/code/artifact/e54ce742-3f4c-4788-839e-d118f82c2e02), faits
dans la foulée des trois premiers.

## Le viseur enseigne, une consigne à la fois

Quand rien n'est lu, l'écran ne montrait qu'un cadre : rien ne disait si l'on
est trop loin, trop près, ou dans le noir. Deux phrases se succèdent
maintenant sous le cadre — « Rapprochez-vous, le code doit remplir le cadre »
à 3,5 s, puis « Trop sombre ? Allumez la lampe » à 8 s (ou « Reculez un peu »
si la lampe est déjà allumée).

- **⚠️ Ils s'arrêtent à la première lecture et ne reviennent pas.** Défaut vu
  au simulateur en l'exerçant : sans ce garde-fou, « Rapprochez-vous » repart
  trois secondes après **chaque** scan — donc pendant qu'on marche vers
  l'article suivant, à quelqu'un qui vient précisément de réussir. Ces
  conseils apprennent à viser, ils ne commentent pas un comptage. Remis à zéro
  au changement de phase : viser un QR de balise et viser un code-barres ne se
  règlent pas pareil.
- **⚠️ Leurs hooks sont AVANT les deux retours anticipés** de `scanner.tsx`
  (permission inconnue, écran d'amorce). Posés plus bas, avec le texte qu'ils
  servent, ils seraient sautés d'un rendu à l'autre — « rendered fewer hooks
  than expected », et l'écran de comptage tombe. Un test compare les deux
  positions dans le fichier.
- **La forme du cadre annonce ce qu'on attend** : carré pour le QR d'une
  balise, rectangle large pour un code-barres. Le carré est mesuré en points
  (la caméra a une hauteur fixe de 200) — un carré demande la même valeur dans
  les deux sens.
- **La trace du dernier scan** (« Dernier scan · Robe midi bleu nuit ») occupe
  la barre quand il n'y a ni conseil ni détection en cours : elle lève le
  doute « est-ce que ça a pris ? » sans quitter la caméra des yeux. L'ordre de
  la barre est fixe : ce qui se passe maintenant, puis ce qu'il faut essayer,
  puis ce qui vient d'être enregistré.

## Les notifications s'annoncent avant de se demander

La boîte iOS partait seule à l'ouverture d'un inventaire, sans un mot sur ce
qu'on recevrait — or **un refus est définitif**, il ne se défait qu'en passant
par les Réglages. Une carte sur la liste du compteur l'amorce désormais :
« Être prévenu des prochains inventaires · Activer · Plus tard ».

- `etatNotifications()` (`lib/push.ts`) lit l'état **sans jamais ouvrir la
  boîte** : c'est ce qui permet de ne proposer « Activer » que si le système
  accepte encore la question.
- **⚠️ Déjà accordées : rien à l'écran, mais le jeton se réenregistre en
  silence.** Un jeton Expo peut tourner ; sans ce rafraîchissement, les
  personnes déjà installées cesseraient d'être prévenues sans que rien ne le
  dise.
- **Le compteur n'a plus de demande automatique** — `useNotificationsSurInventaire`
  a quitté son écran d'inventaire. **Le superviseur la garde** : c'est lui qui
  invite, être sollicité là ne le surprend pas.
- **⚠️ Invisible au simulateur** : `Device.isDevice` y est faux, la carte ne
  s'y montre jamais. Ce chemin ne se vérifie qu'appareil en main.

## Deux sorties qui manquaient

- **« Je n'ai pas reçu mon invitation »** sur l'écran de connexion. Elle
  explique que l'invitation vient du **responsable**, à qui la redemander —
  jamais « contactez le support » : il sait qui doit être dans quelle équipe,
  nous non. ⚠️ Le commentaire du fichier cite la formule interdite pour dire
  qu'on ne l'écrit pas : la garde doit lire le code **sans ses commentaires**.
- **Le repère « où se lisent le rapport et les écarts »**, une fois, sur
  l'écran d'un inventaire. ⚠️ **Adapté** : la maquette parlait d'« un menu en
  haut à droite », qui n'existe pas dans l'app — les actions sont listées sur
  l'écran. Le repère dit donc ce qui ne se voit pas : l'export Excel vit
  *dans* le rapport, et le site montre les mêmes tableaux en plus large. Il
  attend qu'il y ait quelque chose à lire (`countedPieces > 0`).
- **Un membre qui n'est jamais entré se voit** : badge « Mot de passe à
  créer » sous son nom, le libellé du site. ⚠️ `is_active` veut dire « s'est
  déjà connecté », rien d'autre — même piège de lecture que sur « Mon équipe »
  en août.

## L'administrateur d'entreprise a ses propres étapes

Il voyait le bandeau d'un superviseur — « Générer mes balises », qui n'est pas
son travail. `etapesAdmin` (`components/BandeauDemarrage.tsx`) lui en donne
trois : ses magasins créés, **un superviseur par magasin**, un premier
inventaire lancé. Un seul bandeau à l'écran, le sien.

- **⚠️ « Un superviseur par magasin » ne le compte pas lui-même.** Il a tous
  les magasins par construction (déclencheurs du 22 août) : se compter
  cocherait l'étape d'office. `ca_company_overview` exclut déjà les
  administrateurs de `supervisors` — c'est cette exclusion qui rend l'étape
  utile.
- **L'étape « un premier inventaire » se lit sur `last_session_at`**, le
  dernier inventaire *créé* : elle ne se décoche pas quand on clôture. Même
  règle que le bandeau du superviseur, corrigé le matin même.
- **`debutant` ne vaut pas pour lui** : il ne crée pas d'inventaires, ce sont
  ceux de ses superviseurs. Son bandeau s'efface quand ses trois étapes sont
  faites, et `demarrageFini` le note alors comme pour tout le monde.
- **Ses magasins disent qui les tient** (écran Magasins) : deux noms puis
  « et N autres », ou la pastille « Aucun superviseur · à pourvoir ». L'écran
  dit aussi où cela se règle — **la page Mon équipe du site** : l'application
  n'a pas d'écran d'administration, et ce n'est pas ce chantier qui allait lui
  en donner un.
- `src/types/database.types.ts` a été **régénéré** pour `ca_company_overview`
  (ils dataient du 21 août) ; il porte donc aussi le schéma du soir même.

## Ce qui n'a pas été fait, et pourquoi

**L'équipe d'un inventaire ne montre ni « Renvoyer l'invitation » ni QR.** La
maquette les demandait — mais **il n'y a plus d'invitation en attente à un
inventaire** : `invite-to-session` refuse les adresses sans compte et ajoute
directement à `session_members`. La table `session_invitations` est vide en
production, et son bloc dans l'app ne sert plus qu'à d'éventuelles lignes
anciennes. Renvoyer quoi, à qui ? Le vrai risque que la maquette visait — « la
veille de l'inventaire, la moitié de l'équipe n'est jamais entrée » — est
couvert par le badge « Mot de passe à créer » ci-dessus. Le QR, lui,
supposerait un lien profond que l'app ne sait pas ouvrir, pour faire circuler
un code semi-confidentiel : à rouvrir seulement si le besoin se présente en
vrai.

**⚠️ La question ouverte est tranchée : NON** (Julien, 28 août 2026). Un seul
inventaire ouvert dans le magasin **ne s'ouvre pas directement** — la liste
reste, même à une ligne. Elle porte le nom de l'inventaire et son magasin,
c'est-à-dire la preuve qu'on est au bon endroit ; et surtout le comportement
ne change pas le jour où un deuxième s'ouvre, ce qui arrive précisément un
matin d'inventaire, à quelqu'un qui a pris l'habitude de l'autre. Le seul gain
aurait été un appui. **Ne pas réintroduire de redirection automatique** depuis
l'accueil du compteur : un test la refuse.

## Vérifications

Au simulateur, sur les données réelles : le repère du menu au-dessus
d'« Actions », le **cadre carré** en phase balise et le **cadre large** en
phase article (les deux photographiés), et le conseil « Trop sombre ? Allumez
la lampe » — l'écran de comptage d'un simulateur n'ayant pas de caméra, c'est
même exact. La balise ouverte pour l'occasion était déjà terminée : contrôlé
en base après coup, `count_status` et `count_done_at` n'ont pas bougé (règle
du 25 août — consulter n'écrit rien).

**Non vérifié à l'écran** : l'écran de connexion (il faudrait se déconnecter,
et je ne peux pas me reconnecter), la carte des notifications (invisible au
simulateur), et les étapes de l'administrateur (elles demandent une session
d'administrateur d'entreprise).

Tests de garde : `tests/compte.test.ts`, blocs « le viseur enseigne », « les
notifications s'annoncent avant de se demander », « les sorties qui
manquaient » et « l'administrateur d'entreprise a ses propres étapes ».

# ⚠️ L'offre Solo — décidée, PAS ENCORE CONSTRUITE (27 août 2026)

Question de Julien : le modèle à trois profils sert les grandes structures,
comment le simplifier pour la boutique de quartier tenue par une seule
personne ? L'exploration a d'abord établi que **le modèle en base marche déjà
par construction** : un compte est à la fois admin d'entreprise + superviseur
(drapeau `is_company_admin`, `role = 'supervisor'`), affecté à son magasin par
le trigger `sync_company_admin_stores`, et il compte lui-même
(`counts_insert_supervisor`, boutons « Compter / Auditer des articles » sur la
fiche). `create_session` n'exige aucun membre. **Aucun 4e rôle n'est donc
prévu, jamais** — ce qui manque est commercial et d'interface.

Décision de Julien : une **offre Solo** — abonnement mensuel ou annuel, achat
en libre-service — construite pour qu'une grande structure n'ait aucun intérêt
à la prendre : *« acheter un coca à l'unité revient plus cher que d'acheter un
pack »*. Rien de tout cela n'existe dans le code ni en base à ce jour ; le
plan détaillé a été validé sur son principe le 27 août 2026, la mise en œuvre
est **explicitement reportée**. Ne rien construire sans que Julien relance le
sujet.

Ce qui est arrêté, à reprendre tel quel le jour venu :

- **Prix** : 49 €/mois ou 490 €/an HT, plafond 2 000 unités — chiffres à
  **revalider par Julien** avant construction. La règle « coca » impose que le
  prix par unité de stock reste ≥ à la tranche Boutique (0,245 et 0,294 €/u/an
  contre 0,21) ; un test de garde devra encoder cette inégalité.
- **Trois verrous cumulés**, le prix seul ne suffisant pas : le prix à
  l'unité ; les verrous structurels (**1 magasin** — `ca_request_store`
  refuse —, **1 utilisateur** — la policy INSERT de `team_invitations` refuse
  pour une entreprise solo, point unique qui couvre les deux edges et l'app,
  avec un `code: 'solo_plan'` sur le modèle d'`other_company`) ; et le
  plafond ci-dessous.
- **⚠️ Le plafond se mesure sur les pièces comptées, agrégées sur 30 jours
  glissants — jamais à l'import ni par inventaire.** Constat de Julien sur la
  première proposition : un client découperait son stock en plusieurs petits
  inventaires pour rester sous un plafond par fichier. Découper 10 000 pièces
  en cinq sessions de 2 000 ne réduit pas le total compté. Seuil prévu : 2 ×
  le plafond de stock sur 30 j ; au-delà, **seule la création d'un nouvel
  inventaire est refusée** — on ne bloque jamais un comptage en cours ni la
  lecture des rapports. Dépassement signalé au client (bandeau d'upgrade) et
  remonté dans `admin_pipeline` : c'est du revenu qui attend.
- **Le plan est commercial, porté par l'entreprise** : `companies.plan`
  (`standard` par défaut / `solo`) + `license_status`, écrits par le seul
  `service_role`. L'interface s'allège sur ce fait, pas sur une heuristique
  « équipe vide » : bandeau à 2 étapes, tunnel sans `invite?from=new`, écrans
  d'équipe retirés (app et site) pour un plan solo.
- **Stripe en mode abonnement** : deux Prices récurrents posés en secrets
  (jamais créés à la volée), `checkout.session.completed` →
  `fulfil_solo_subscription` (miroir de `fulfil_paid_request`, `service_role`
  seul), `invoice.payment_failed` / `invoice.paid` /
  `customer.subscription.deleted` pour le cycle de vie. Mêmes règles que le
  webhook actuel : signature seule porte, rejeu `already`, 200 sur l'ignoré.
- **Achat par une page publique `/solo`** hors `AppShell` (elle s'ouvre au
  téléphone), edge `subscribe-solo` sans JWT avec `rate_limit_ok`, demande
  enregistrée dans `company_requests` (marqueur de plan) pour réutiliser
  pipeline et purge. Premier prix affiché sur le site public — assumé pour
  Solo seulement, la grille standard reste sur devis.
- **La bascule Solo → grille standard** est le parcours devis existant,
  résiliation de l'abonnement à l'encaissement. Pas de prorata au premier
  jet. Les CGV devront porter la clause de dépassement.

**Un défaut réel à corriger indépendamment de l'offre**, trouvé par la même
exploration : le bandeau de démarrage se fige à jamais sur « Constituer mon
équipe · 2 sur 3 » pour tout admin qui démarre sans compteur —
`my_team_by_store` ne compte que les `role = 'employee'`, donc
`equipeConstituee` reste faux et l'étape 3 n'est jamais atteinte. Correctif
retenu : l'étape équipe se coche **aussi** sur le premier inventaire créé
(`faite: equipeConstituee || inventaireCree` dans `etapesDemarrage`) — créer
son inventaire répond à la question de l'équipe, et le bandeau s'efface alors
de lui-même. Mettre à jour le test du bandeau dans le même commit.

# Parcours d'inscription

Plus d'auto-inscription. `handle_new_user` refuse tout e-mail qui n'est ni une
demande superviseur validée, ni une invitation d'équipe, ni une invitation à un
inventaire (seule exception : base sans aucun profil, pour amorcer le premier
administrateur).

- **Entreprise** : demande sur `/inscription` → devis → acceptation →
  encaissement → `admin_fulfil_company_request` crée l'entreprise, ses magasins
  et leurs codes. C'est le **seul** chemin de création d'entreprise.
- **Superviseur** : invité par l'**administrateur de son entreprise** depuis
  /equipe (edge `ca-invite-supervisor`), ou par l'administrateur Quantinvo.
  Le formulaire public `/superviseur` est **éteint depuis le 21 août 2026** —
  voir la section « Extinction du parcours public superviseur » plus bas.
- **Compteur** : ajouté par son superviseur (app ou dashboard web), prénom + nom
  + e-mail, rattaché aux magasins choisis (`team_invitations.store_ids`, vide =
  tous ceux du superviseur).
- **Administrateur d'entreprise** (20 août 2026) : nommé par l'administrateur
  Quantinvo depuis /admin (edge `invite-company-admin` — promotion immédiate si
  le compte existe dans l'entreprise, invitation sinon). C'est **un drapeau**
  `profiles.is_company_admin`, pas une valeur de `role` : l'admin garde
  `role = 'supervisor'` pour hériter des policies RLS existantes, et le cumul
  admin + superviseur des petites structures marche par construction. Il gère
  ses superviseurs depuis /equipe (RPC `ca_*`, gardées par
  `is_company_admin()` — miroir d'`is_admin()`, aal2 conditionnel compris —
  et journalisées dans `company_audit_log`, purgé à 1 an). Invitation de
  superviseur par l'edge `ca-invite-supervisor`. **La policy de
  `team_invitations` est restreinte à `role = 'employee'`** pour les
  superviseurs : sans cela, un superviseur s'écrirait une invitation
  `company_admin` que `handle_new_user` honorerait (élévation). Ne jamais la
  rouvrir. Le verrou `profiles_pin_privileged` fige aussi ce drapeau. Seul
  Quantinvo nomme/révoque les admins (`admin_invite_company_admin` /
  `admin_revoke_company_admin`, journalisées) et crée entreprises et magasins
  (la licence est par magasin). Migrations `20260820190001..4`, tests de
  garde : `web/tests/admin-entreprise.test.ts`. Le formulaire public
  /superviseur a été éteint le 21 août 2026 (voir ci-dessous).

**Personne ne s'inscrit** : les deux parcours créent l'utilisateur auth par
invitation (`generateLink` type `invite`, envoi Resend, repli SMTP Supabase) et
envoient un lien vers `/bienvenue`, où la personne **vérifie son prénom et son
nom pré-remplis** puis choisit son mot de passe. L'écran d'inscription de l'app
n'est plus qu'une explication.

Conséquence à connaître : `handle_new_user` se déclenche sur l'INSERT dans
`auth.users`, donc **le profil existe dès l'invitation**, avant le mot de passe.
La personne ne peut simplement pas encore se connecter.

`profiles` est modifiable par son porteur (prénom, nom), mais le trigger
`profiles_pin_privileged` fige `role`, `company_id` et `is_admin` pour les rôles
`authenticated`/`anon` — sans lui, un compteur se promouvait superviseur d'un
simple UPDATE. Ce trigger doit rester en SECURITY INVOKER : en DEFINER,
`current_user` vaudrait le propriétaire et le garde-fou ne s'appliquerait jamais.

`create_company`, `join_company` et `join_store` ne sont plus exécutables par
`authenticated` (migration `20260813000005`) : elles court-circuitaient ce
parcours. Ne pas rendre les GRANT sans réintroduire la validation admin.

Le code magasin reste confidentiel : `join_code` est révoqué en SELECT pour
`anon`/`authenticated` sur `stores` et `companies`. Un compteur ne doit jamais
le voir.

Un inventaire ne se peuple que de profils existants — `invite-to-session`
refuse les e-mails sans compte.

## Extinction du parcours public superviseur (21 août 2026)

Le formulaire public de demande d'accès superviseur n'existe plus. Les accès
sont ouverts par l'administrateur de l'entreprise (/equipe), ou par Quantinvo
pour une entreprise qui n'a pas encore d'administrateur.

Déroulé, dans l'ordre imposé par la règle du projet — **code déployé d'abord,
objets supprimés ensuite** (leçon `get_session_activity`) :

1. Commit `50bbf6e` : `/superviseur` devient une explication, la section
   « Demandes d'accès » quitte /admin avec son composant, les liens de
   l'accueil et de la connexion disparaissent, les tests changent d'objet.
2. Migration `20260821140001`, une fois ce code en ligne : suppression de
   `submit_supervisor_request` (**la surface publique, exécutable par
   `anon`**), `submit_supervisor_request_detailed`,
   `admin_list_supervisor_requests` et `admin_review_supervisor_request`.
3. Edge functions `submit-supervisor-request` et `invite-supervisor`
   redéployées en **410 Gone**, sans client Supabase ni envoi d'e-mail. La
   console MCP ne sait pas supprimer une edge function : les retirer depuis
   le tableau de bord Supabase quand plus aucun appel résiduel n'arrive.

**La page `/superviseur` doit rester** : l'application mobile installée sur
les téléphones partage encore cette adresse avec le code magasin (voir
`src/constants/links.ts` et `src/app/(supervisor)/profile.tsx`). La supprimer
enverrait ces personnes sur une erreur. Elle n'est plus qu'une explication —
même motif que l'écran d'inscription de l'app. Le texte de partage du code
magasin a été corrigé le 21 août 2026 (il renvoie vers l'administrateur de
l'entreprise) ; il entre en vigueur au prochain build mobile.

**La table `supervisor_requests` reste aussi**, vide, RLS active sans aucune
policy (donc refus par défaut). La supprimer obligerait à réécrire
`handle_new_user` — la fonction qui conditionne toute création de compte —
pour un gain nul : ses branches, comme celles de `purge_expired_data`,
`export_my_data`, `anonymize_on_user_delete` et `ca_invite_supervisor`, lisent
une table qui restera vide. Ce sont des non-opérations.

Bénéfice de sécurité : l'oracle d'énumération d'e-mails que défendait tout le
travail du constat M3 (réponse uniforme, limitation de débit) n'a plus d'objet
— la surface publique elle-même a disparu.

## Le devis part tout seul, et s'accepte en ligne (22 août 2026)

*« Fais les trois, il ne restera plus qu'à brancher Stripe. »* Jusque-là :
l'administrateur saisissait référence et montant dans deux `prompt()`,
fabriquait le PDF à la main depuis `docs/entreprise/modeles/devis.html`, et
l'envoyait de sa messagerie. Le statut passait à `quoted` sans que rien ne
parte, et l'acceptation se déclarait à la main.

Migration `20260822220001`, maquette validée avant codage :
https://claude.ai/code/artifact/fa94384a-84d5-4eea-a0ab-0cc0192b357b

**Le parcours** : la console établit le devis (référence proposée, montant
calculé depuis la grille et les volumes déclarés, lignes affichées) →
`admin-send-quote` enregistre, **fabrique le PDF** et l'envoie en pièce jointe
avec un lien → le client ouvre `/devis/<jeton>`, télécharge le PDF, accepte →
`accept-quote` pose le statut et écrit deux messages (accusé au client, avis à
Quantinvo si `QUOTE_NOTIFY_EMAIL` est posée).

Points à ne pas défaire :

- **Le PDF est généré, jamais déposé.** `_shared/devis.ts` calcule les lignes
  *et* décrit la mise en page (des éléments à des millimètres) ;
  `_shared/devisPdf.ts` est le seul à connaître pdf-lib. Cette séparation rend
  la mise en page **testable** par vitest, qui ne sait pas résoudre les imports
  esm.sh — et elle évite deux dessins du même document. Le PDF joint à l'e-mail
  et le PDF téléchargé sortent du même module : c'est pourquoi `quote_by_token`
  rend le nom complet et le SIREN, qui figurent de toute façon sur le document
  que ce même jeton télécharge.
- **Le montant part tel qu'il est saisi**, jamais recalculé à l'envoi : la
  grille propose, l'administrateur dispose — un devis se négocie. `web/lib/devis.ts`
  est la **copie volontaire** du calcul de `_shared/devis.ts` (npm d'un côté,
  esm.sh de l'autre), et `web/tests/devis.test.ts` compare les deux grilles
  tranche par tranche.
- **Le prospect n'a pas de compte** — c'est tout l'objet du parcours. `/devis/<jeton>`
  est donc publique et **hors de la coquille `AppShell`** (elle s'ouvre depuis
  une messagerie, souvent au téléphone), `quote_by_token` et
  `accept_quote_by_token` sont ouvertes à `anon`, et **le jeton tient lieu de
  clé** : uuid aléatoire, aucune adresse e-mail rendue par la lecture, et la
  limitation de débit de `rate_limit_ok`. `quote-pdf` et `accept-quote` sont
  déployées en `verify_jwt: false` — deux fonctions publiques de plus, avec
  `submit-supervisor-request`.
- **Un nouvel envoi change le jeton** : renvoyer un devis invalide l'ancien
  lien, qui porterait un montant périmé. Un devis expiré (30 jours) ne
  s'accepte plus.
- **L'acceptation ne crée rien.** Elle pose une date et un statut ; la création
  de l'entreprise reste derrière `paid`. C'est ce point qui rendra la bascule
  Stripe indolore — le webhook n'aura qu'à jouer `accepted → paid`, comme la
  section suivante le prévoit. Un second clic répond `already: true` plutôt
  qu'une erreur, exactement ce qu'il faudra à Stripe qui rejoue ses webhooks.

**Vérifié pour de vrai** le 22 août 2026, sur une demande d'essai créée puis
supprimée (aucun résidu, contrôlé en base) : le PDF servi par `quote-pdf`
(2,8 ko, rendu à l'écran et relu), l'acceptation par l'edge publique
(`success/already/lien invalide` selon le cas), et la page `/devis/<jeton>` au
navigateur — clair, sombre, et 375 px, où la mise en page des lignes a dû être
reprise (le prix se retrouvait au milieu du rang).

### Un magasin ne se crée plus sans devis (même jour, une heure plus tard)

Julien : *« pourquoi j'ai pu créer deux magasins à l'instant sans qu'un devis
ne soit envoyé ? »* Le journal le confirmait : `admin_fulfil_store_request`
menait une demande de `pending` à `created` d'un seul geste. Le devis
automatique ne couvrait que l'inscription.

Migration `20260822230001` : **une demande d'ajout suit le parcours d'une
inscription** — `pending → quoted → accepted → paid → created` — et la
création **exige `paid`**, exactement comme `admin_fulfil_company_request`.
Les trois RPC nouvelles (`admin_quote_store_request`,
`admin_set_store_request_status`, et la garde sur `admin_fulfil_store_request`)
sont le miroir de celles des entreprises.

Points à connaître :

- **Une demande de suppression (`kind = 'remove'`) n'a pas de devis** et reste
  `pending → removed`. Les trois fonctions la refusent nommément — sans cela
  on facturerait un client pour lui retirer un magasin.
- **Un jeton, une page.** `quote_by_token` et `accept_quote_by_token` cherchent
  dans les deux tables et rendent `kind` : `/devis/<jeton>` et `quote-pdf`
  servent les deux parcours. `admin-send-quote` aussi, par `target`. Deux
  pages auraient voulu dire deux mises en page à tenir d'accord. Le devis d'un
  magasin porte un **objet** (« Ajout du magasin Lyon Part-Dieu ») au-dessus
  du tableau, parce que sa ligne unique ne dit pas à elle seule de quoi il
  s'agit.
- **Le devis en attente reste sous les yeux du client** sur /magasins, avec
  son lien « voir et accepter » : c'est justement ce sur quoi il peut agir. La
  règle « une demande aboutie quitte l'écran » ne vaut que pour `created` et
  `removed`.
- Le bouton « Ajouter un magasin » de la fiche entreprise reste direct : c'est
  nous, en interne, et le journal le trace.

Vérifié en base, session simulée, **en transaction annulée** : créer sans
devis refusé, créer après devis refusé, sauter l'accord refusé, accord puis
encaissement puis création acceptés, devis d'une suppression refusé. Puis sur
une demande d'essai réelle, supprimée ensuite sans résidu : le PDF téléchargé
(objet compris, relu à l'écran) et l'acceptation par l'edge publique.

### Les ventes en cours, d'un bout à l'autre (même soir)

Julien, une fois le devis envoyé : *« où passent les infos sur mon compte
admin ? Je vois rien »* — puis *« je veux vraiment que tu penses au flow de A
à Z »*. Le parcours déroulé étape par étape avait trois trous :

1. **/admin ne voyait que `pending`** : une demande devisée, acceptée ou
   encaissée disparaissait alors qu'elle attend un geste — et les inscriptions
   d'entreprise n'y figuraient pas du tout ;
2. **`admin_list_store_requests` perdait l'en-cours** : elle rendait `pending`
   ou « traité depuis 90 jours », or `quoted` / `accepted` / `paid` n'ont pas
   de `handled_at`. Une demande devisée n'apparaissait plus **nulle part**,
   fiche entreprise comprise ;
3. **l'acceptation ne remontait pas** : l'avis dépendait d'une variable
   d'environnement jamais posée.

Migration `20260822240001`. Règle à garder : **« en cours » veut dire « pas
terminé », jamais « pending »**.

- **`admin_pipeline`** rend tout ce qui n'est pas terminé dans les deux
  tables, sous une forme unique (`kind` : `company` / `store` /
  `store_removal`). Elle rend des faits ; le jugement — à qui le tour, depuis
  combien de temps, quel geste — vit dans **`web/lib/pipeline.ts`**, testable
  sans base (`SEUILS_VENTE` : deux jours pour deviser, sept avant de
  relancer). Même partage que `lib/entreprise.ts`.
- **Bloc « Ventes en cours »** sur /admin, avant « À traiter » : ce qui nous
  attend (alerte, bouton plein) puis ce qui attend le client (neutre), le plus
  ancien d'abord, avec le revenu en attente dans le titre. Chaque ligne mène
  là où le geste se fait — la console pour une inscription, la fiche pour un
  magasin.
- **L'avis d'acceptation part aux administrateurs Quantinvo lus en base**
  (`admin_notify_emails`, réservée à `service_role` parce qu'elle liste des
  adresses). `QUOTE_NOTIFY_EMAIL` n'est plus nécessaire ; elle s'ajoute si
  elle existe.

Vérifié en base (transaction annulée, session admin) : une demande en
`quoted` remonte dans `admin_pipeline` **et** dans `admin_list_store_requests`.
Au navigateur par route jetable (retirée, `git status` propre) : les deux
groupes, les boutons, le montant en attente.

**Le stock déclaré qui surprend remonte sur la ligne** (migration
`20260822260001`). Julien : *« un grand magasin mettrait un stock théorique à
1 000 pièces pour une surface de 10 000 m² = fraudeur »*. Le recoupement
stock / surface existait sur la fiche ; `admin_pipeline` rend maintenant les
magasins déclarés et le code APE, `alerteDensite` (`lib/pipeline.ts`) en tire
une phrase — « Stock déclaré à vérifier — Grand Magasin : 0 pièces/m², très
faible pour … » — affichée sous l'état de la vente, et la demande passe **en
tête** tant que le devis n'est pas parti. Le jugement reste celui de
`lib/secteurs.ts` ; la phrase dit « à vérifier », jamais « fraude » : deux
déclarations de la même personne ne se contrôlent pas l'une l'autre. Le devis
reste manuel — c'est le point de contrôle.

**Une demande d'inscription prévient tout le monde** (`submit-company-request`,
déployée sans JWT comme tout formulaire public). Julien : *« il faut que je
puisse recevoir un mail de demande d'inscription »* — ce n'était pas prévu,
/inscription écrivait en base et personne ne le savait. L'edge appelle la RPC
publique (validation et limitation de débit inchangées), envoie l'accusé au
prospect et l'avis aux administrateurs lus en base, magasins déclarés compris.
La page retombe sur la RPC directe si l'edge est injoignable.

**Même avis pour une demande de magasin** : `ca-request-store` envoie aussi
« Nouvelle demande de magasin » aux administrateurs, avec l'entreprise, le
demandeur et les volumes déclarés (pièces, m², pièces/m²). Le `service_role`
n'y sert qu'**après** la RPC, pour lire les adresses — jamais pour écrire la
demande ; le test de garde vérifie l'ordre.

Stripe est branché : voir « Paiement : Stripe, en place ».

Tests de garde : `web/tests/devis.test.ts`.

## Paiement : Stripe, en place (22 août 2026)

Julien : *« on ne fournit pas de RIB, le paiement doit passer par Stripe »*,
puis *« crée automatiquement une fois payé »*. Migration `20260822250001`,
fonctions edge `accept-quote` (modifiée) et `stripe-webhook` (nouvelle).

**Le parcours** : devis accepté → `accept-quote` ouvre une session Stripe
Checkout et y envoie le client → paiement par carte ou prélèvement SEPA,
**facture produite et envoyée par Stripe** (`invoice_creation`) →
`checkout.session.completed` → `stripe-webhook` → `fulfil_paid_request` :
`paid`, création de l'entreprise et de ses magasins (ou du magasin), journal
signé « Stripe », et invitation du contact comme **administrateur de son
entreprise** (même lien `/bienvenue` que les autres invitations).

Les règles fixées quand Stripe n'était qu'un projet sont tenues : un seul
point d'accroche (`accepted → paid`), la création derrière le paiement et
jamais déclenchée par le client, la ré-émission traitée comme un cas normal.

Points à ne pas défaire :

- **La signature est la seule porte.** Le webhook est déployé en
  `verify_jwt: false` (Stripe n'envoie pas de JWT) ; `verifierWebhook`
  (`_shared/stripe.ts`) vérifie l'HMAC sur le **corps brut**, avec cinq
  minutes de tolérance et une comparaison en temps constant, **avant toute
  lecture**. Un test la passe avec un vrai HMAC, et refuse un corps trafiqué.
- **Le webhook n'a pas de session** : `auth.uid()` est nul, donc ni
  `is_admin()` ni `log_admin_action`. D'où `fulfil_paid_request`,
  `attach_checkout_session`, `log_system_action` et
  `invite_company_admin_after_payment`, exécutables par le **seul
  `service_role`**. Elles ne doivent jamais être ouvertes à `authenticated`.
- **Rejeu** : Stripe renvoie un événement tant qu'il n'a pas reçu 200.
  `fulfil_paid_request` répond `already: true` sur une session déjà traitée,
  et la fonction répond **200**. ⚠️ **Corrigé le 28 août 2026** : cette note
  attribuait la protection à l'index unique sur
  `stripe_checkout_session_id`, ce qui était faux — il porte sur la table des
  demandes, le doublon naissait dans `companies` et `stores`. C'est le
  `for update` de `20260828210001` qui protège, voir « Modélisation de
  menaces du parcours de l'argent ». Une session inconnue répond 500 — c'est un vrai problème, Stripe
  doit réessayer. Ce qui n'est pas `checkout.session.completed` avec
  `payment_status = paid` répond 200 sans rien faire.
- **Une session Checkout par demande** : clé d'idempotence
  `checkout-<kind>-<id>`. Un devis accepté deux fois — ou « Régler la
  licence » cliqué deux fois — rouvre la même session, jamais une seconde.
  `accept_quote_by_token` rend désormais `request_id` et `status` pour ça.
- **Pas de SDK Stripe** : deux appels HTTP et une signature, dans
  `_shared/stripe.ts`, lisibles en entier. Le SDK pèse lourd en edge et
  n'apporterait rien ici.
- **Sans clé Stripe**, l'acceptation fonctionne comme avant : accord
  enregistré, « votre facture arrive ». C'est ce qui permet de déployer le
  code avant de poser les clés.

Côté écrans : `/devis/<jeton>` suit `paymentUrl` dès l'accord, propose
« Régler la licence » sur un devis accepté non payé, et lit `?paiement=ok` au
retour de Stripe. Dans `lib/pipeline.ts`, `accepted` attend le **client** (il
paie), relancé passé sept jours ; `paid` sans `created` est une anomalie
(webhook non passé) et nous revient. Les boutons manuels « Marquer accepté »
et « Réglé hors Stripe » restent en secours, en liens discrets, pour un
paiement reçu par un autre canal — la création reste alors à faire à la main.

**Vérifié de bout en bout le 22 août 2026, clés de test posées par Julien**
(clé restreinte : Checkout Sessions, Customers, Invoices, Products, Prices en
écriture, rien d'autre) : devis accepté → Checkout → carte `4242` →
webhook → `created`, entreprise avec son code, deux magasins aux noms du
devis, facture Stripe liée, contact devenu administrateur d'entreprise
affecté aux deux magasins, journal signé « Stripe ». Données d'essai
supprimées ensuite ; le journal est conservé.

Un défaut trouvé ainsi : `expires_at` calculé à l'appel changeait à chaque
seconde, et Stripe refuse une clé d'idempotence rejouée avec d'autres
paramètres — le second clic n'avait plus d'URL. **Une session encore ouverte
se relit** (`lireSessionCheckout`) au lieu de se recréer ; une session expirée
se recrée avec un suffixe de tentative. `accept_quote_by_token` rend
`checkout_session_id` pour ça.

**La facture est dans notre e-mail.** Stripe la produit, mais ne l'envoie
qu'à certaines conditions — en mode test, aux seuls membres du compte, et en
live selon un réglage du tableau de bord qu'on ne peut pas vérifier depuis le
code (constat de Julien : « le client pas de facture »). Le webhook relit
donc la facture (`lireFacture`, page hébergée + numéro) et la pose en **lien
secondaire** du message « Bienvenue » ou « Votre magasin est créé ». Le
gabarit `email.ts` a gagné `lienSecondaire` pour ça : un lien sous le bouton,
jamais un second bouton — un seul geste par message. Sans droit de lecture
sur les factures, le message part sans le lien.

### Le client peut décliner (22 août 2026, au soir)

Julien : *« dans le parcours où le devis est décliné, il n'y a pas le
bouton, il n'y a que j'accepte ou télécharger »*. Un client qui ne voulait
pas du devis n'avait rien à cliquer : il fermait l'onglet, et la vente
restait « en attente du client » sept jours avant une relance pour rien.

Migration `20260822280001`, statut **`declined`** sur les deux tables, edge
publique `decline-quote` (même surface que `accept-quote` : jeton, limitation
de débit partagée). Sur la page, un lien en retrait — « Je ne souhaite pas
donner suite » — ouvre un motif **facultatif** ; on ne force pas la raison,
mais si elle est donnée, elle arrive dans l'avis à Quantinvo et se lit en
console. Le client reçoit un accusé qui promet l'absence de relance.

Trois règles :
- **seul un devis `quoted` se décline** — accepté, il se paie ou expire ; la
  renonciation après accord est une conversation ;
- **décliner n'est pas définitif** : `admin_quote_*` accepte `declined` comme
  point de départ (« Nouveau devis » en console), et efface la trace du refus
  au renvoi ;
- la vente **sort de « Ventes en cours »** (`admin_pipeline` ne rend pas
  `declined`) mais reste dans les listes, motif compris, 30 jours côté client.

Vérifié par l'edge publique (refus avec motif, second clic → `already`,
acceptation après refus → refusée), en console (hors pipeline, motif lisible,
nouveau devis → `quoted` avec nouveau jeton) et au navigateur (lien, panneau,
état « Vous avez décliné »). Données d'essai supprimées.

### Test complet des deux parcours (22 août 2026, au soir)

Julien : *« fais un test complet du parcours, création entreprise et ajout
de nouveau magasin, vois s'il y a des trous »*. Déroulé en vrai, étape par
étape — demande par l'edge publique, devis (RPC avec session admin simulée
en base, l'edge exigeant un vrai jeton), PDF et acceptation par les edges
publiques, paiement par la carte de test, webhook, puis la même entreprise
demandant un magasin, devisé, accepté, payé. Deux trous, fermés :

1. **Le prix payé n'était pas reporté sur le magasin** — `annual_price_cents`
   nul sur tout ce que le webhook créait, donc un revenu annuel estimé au
   panier moyen dès le premier client. Migration `20260822270001` : la ligne
   du devis donne le prix de chaque magasin (à défaut, le total réparti) ;
   rattrapage de l'existant compris.
2. **Pas de lien de paiement sur /magasins** pour une demande `accepted` : le
   texte annonçait « votre facture arrive », d'avant Stripe. Un client qui
   avait fermé Checkout n'avait plus d'issue depuis son espace. Le lien
   « Régler en ligne » rouvre la page du devis, donc la même session.

Contrôlés sans défaut : l'admin invité est bien affecté à tous les magasins,
y compris celui ajouté ensuite (déclencheur `stores`) ; un devis expiré se
refuse et la page le dit ; un devis renvoyé tue l'ancien lien ; l'annulation
ne vaut que sur `pending`, comme le bouton. Données d'essai supprimées,
zéro résidu contrôlé.

**À savoir pour rejouer ce test** : simuler une session en base cache les
lignes à un `select` direct (RLS, aucune policy sur `company_requests`) — il
faut lire l'`id` avant de basculer le rôle. Ce n'est pas un trou : la console
passe par `admin_list_company_requests`, en SECURITY DEFINER.

### Les clés (posées en mode test le 22 août 2026)

Dans le tableau de bord Stripe (compte Devkaylab) — à refaire en `live` le
jour venu, mêmes variables, nouvelles valeurs :

1. **Developers → API keys** : copier la clé secrète (`sk_test_…`).
2. **Developers → Webhooks → Add endpoint** :
   `https://heabesqvlinzarqenymj.supabase.co/functions/v1/stripe-webhook`,
   événement `checkout.session.completed` (et
   `checkout.session.async_payment_succeeded` pour le SEPA — à brancher dans
   le webhook le jour où un client paie ainsi). Copier le secret de signature
   (`whsec_…`).
3. Dans Supabase → Edge Functions → Secrets, poser `STRIPE_SECRET_KEY` et
   `STRIPE_WEBHOOK_SECRET`. **Les clés ne se collent jamais dans une
   conversation ni dans le dépôt.**
4. Essayer avec la carte de test `4242 4242 4242 4242`, puis passer les deux
   clés en `live` le jour venu — mêmes variables, nouvelles valeurs.

Tests de garde : `web/tests/stripe.test.ts`.

## Modélisation de menaces du parcours de l'argent (28 août 2026)

Passage STRIDE sur le seul chemin où une faille coûte de l'argent : demande
d'inscription → devis → acceptation → Checkout → webhook → création
d'entreprise et invitation de l'administrateur, variante « demande de magasin »
comprise. Quatre constats, tous corrigés le jour même.

**⚠️ La méthode compte autant que les constats : l'analyse a porté sur la base
réelle (`pg_get_functiondef`), pas sur `supabase/migrations/`.** Le dossier
diverge de la production — c'est écrit plus bas — et huit des neuf constats du
matin venaient déjà de cet écart. Une lecture des fichiers aurait modélisé une
base qui n'existe pas. Refaire ce travail depuis le dépôt, c'est le refaire pour
rien.

Chiffres relevés au passage, utiles pour situer : **127 fonctions dans `public`,
dont 121 en `SECURITY DEFINER`** (donc 121 frontières de privilège qui se
défendent seules), 100 ouvertes à `authenticated`, 4 à `anon`, 23 tables toutes
sous RLS, 38 policies, 12 déclencheurs, 17 fonctions edge.

### VR-001 · Un même paiement créait deux entreprises (`20260828210001`)

Le plus grave, et **il ne demandait aucun attaquant**. `fulfil_paid_request`
contrôlait le statut par une **lecture**, puis faisait son `UPDATE` sans
condition. Deux livraisons concurrentes du même événement Stripe lisaient toutes
deux `accepted`, passaient toutes deux, et créaient chacune une entreprise
complète avec ses magasins et ses codes.

- **⚠️ L'index unique `company_requests_stripe_session_idx` ne protégeait pas de
  ça**, contrairement à ce que cette note affirmait plus haut : il porte sur la
  table des *demandes*, alors que le doublon naît dans `companies` et `stores`,
  que rien ne contraint. Deux protections avaient été confondues.
- **Stripe est le déclencheur** : il redélivre tant qu'il n'a pas reçu de `200`,
  et le webhook ne mémorise aucun identifiant d'événement.
- **Le risque se nourrissait lui-même** : `gen_store_code()` fait une requête
  par tentative, une fois par magasin. Plus la commande est grosse, plus c'est
  lent ; plus c'est lent, plus Stripe expire et réessaie pendant que la première
  exécution tourne encore.

Correctif : **`for update` sur les deux `select` initiaux**. Le verrou de ligne
sérialise les webhooks concurrents ; le second attend, relit la ligne
(`READ COMMITTED` réévalue après le verrou), y trouve `paid`, et sort par la
branche `already` qui existait déjà. Plus `and status = 'accepted'` sur les deux
`UPDATE` de transition — **le motif exact d'`accept_quote_by_token`, qui l'avait
et que celle-ci n'avait pas**.

**⚠️ Le `if not found` répond `already: true`, jamais une erreur.** Stripe rejoue
tant qu'il n'a pas son 200 : une erreur ici relancerait la boucle qu'on ferme.

### VR-003 · Le paiement détruisait l'invitation en attente d'un tiers (`20260828220001`)

`invite_company_admin_after_payment` faisait
`delete from team_invitations where lower(email) = v_email` **sans borne
d'entreprise**. Toute invitation en attente portant cette adresse était effacée,
quelle que soit l'entreprise qui l'avait émise.

**⚠️ C'est la reprise d'invitation que le constat n°3 du même jour a fermée, et
elle passait par la seule porte que `team_invitations_figees` ne garde pas** :
ce déclencheur se réveille sur `UPDATE`, ce chemin fait `DELETE` + `INSERT`.
L'invariant était respecté à la lettre et contourné dans son intention. À
retenir pour tout futur invariant posé sur un déclencheur : vérifier ce que le
couple suppression-recréation lui fait.

Le cas involontaire est le plus probable — un client légitime dont l'adresse de
contact traîne une invitation ailleurs la détruit en payant.

Deux décisions à ne pas défaire :

- **⚠️ On refuse (`other_company`), on n'efface pas.** Garder les deux
  invitations n'était pas une option : l'unicité de `team_invitations.email` sur
  toute la base est porteuse, `handle_new_user` retrouve l'invitation **par
  l'adresse** pour décider du rôle et de l'entreprise. Deux lignes pour une
  adresse la rendraient ambiguë — « laquelle choisir » sur une décision de
  privilège est exactement le genre de trou qu'on ferme ailleurs. C'est donc le
  `DELETE` qui cède, pas la contrainte.
- **⚠️ Un refus, pas une exception.** Le paiement est encaissé et l'entreprise
  déjà créée quand cette fonction s'exécute ; une exception ferait échouer le
  webhook, donc rejouer Stripe indéfiniment. Le webhook sait déjà traiter un
  refus sans 500 (`notes.push(…)`), et l'anomalie remonte d'elle-même sur /admin
  par `companies_without_admin`. Rien de nouveau à journaliser.

### VR-002 · On crée ce qui a été devisé (`20260828240001`)

La boucle suivait `store_count`, **saisi par le prospect** dans le formulaire
public (borné de 1 à 500 par contrainte), et non les lignes du devis payé.

**Le document que le client signe comptait déjà les lignes** : dans
`admin-send-quote`, le PDF fait `lignes.length || q.store_count`. Devis et
création n'utilisaient pas la même source, et ne pouvaient diverger que dans un
sens — plus de magasins livrés que facturés.

Deux gestes, et il faut les deux : la création suit le devis, et
`admin_quote_company_request` refuse un devis dont les lignes ne correspondent
pas aux magasins déclarés. Le premier protège quoi qu'il arrive en amont, le
second évite qu'un devis faux parte chez un client.

**⚠️ Le repli sur `store_count` reste, et le `nullif` est ce qui le tient.**
`jsonb_array_length('[]')` vaut **0**, pas `null` : un `coalesce` naïf ferait
boucler `1..0`, donc créerait **zéro magasin** pour un devis sans lignes. Le
prix de repli se divise désormais par le nombre réellement créé, plus par
`store_count`.

### VR-004 · Les codes d'accès sortent d'un CSPRNG (`20260828230001`)

`gen_store_code()` et `gen_company_code()` tiraient leurs caractères avec
`random()`, non cryptographique (CWE-338), pour une valeur que le produit traite
comme un secret : `join_code` ouvre l'entrée dans un magasin, et la colonne est
révoquée en `SELECT` pour `anon`/`authenticated`. Les jetons de devis, eux,
utilisaient déjà `gen_random_uuid()`.

- **⚠️ La révocation est la moitié la plus utile du correctif.** Les deux
  fonctions étaient exécutables par `authenticated` : n'importe quel compte
  connecté pouvait les appeler à volonté et **observer les sorties du
  générateur**, ce qui est précisément l'oracle qui rend une faiblesse de PRNG
  exploitable. Vérifié avant de révoquer : les cinq appelants sont tous en
  `SECURITY DEFINER`, ils ne dépendent pas de ce droit.
- **⚠️ `extensions.gen_random_bytes`, qualifié par son schéma.** Supabase
  installe `pgcrypto` dans `extensions`, et ces fonctions figent `search_path` à
  `'public'` : l'appel nu **échoue à l'exécution, pas à la création**. La
  première version de la migration s'est appliquée sans broncher et a cassé la
  génération de code le temps du premier essai. `gen_random_uuid` ne pose pas ce
  problème — depuis PG13 elle est dans `pg_catalog`.
- **⚠️ `% 32` ne biaise pas** parce que l'alphabet fait exactement 32 caractères
  et que 256 en est un multiple. Cela cesserait d'être vrai si on touchait à
  l'alphabet.
- **Les codes existants ne changent pas** : les regénérer invaliderait ce qui a
  déjà été communiqué aux équipes.

### Le cinquième défaut : un garde-fou périmé

Trouvé en voulant protéger les quatre correctifs. **`web/tests/stripe.test.ts`
lisait `20260822250001_stripe_paiement.sql` nommé en dur.** Or
`fulfil_paid_request` avait été réécrite le 22 août par la migration du prix par
magasin : le test passait depuis six jours **en validant une définition qui ne
tournait plus**.

C'est mot pour mot le défaut qui avait fait perdre sa limitation de débit à
`submit_company_request`, et dont cette note disait « à reprendre pour les autres
fonctions sensibles si le sujet revient ». Il est revenu.

**`derniereDefinition()` vit désormais dans `web/tests/migrations.ts`**, partagée
par `formulaires-publics.test.ts` et `stripe.test.ts`, avec `fichierDe()` pour
lire les `GRANT` (qui sont hors du corps de la fonction). **⚠️ Toute nouvelle
garde sur une fonction sensible passe par là — jamais par un nom de fichier en
dur.**

Deux effets de bord instructifs :

- une assertion a dû être **recentrée sur l'intention** (`v_ligne := …` puis
  `v_ligne ->> 'libelle'`) plutôt que sur une écriture depuis refactorée ;
- compter `for update` a d'abord rendu 3 au lieu de 2 : **le commentaire de la
  fonction contient les mots**. On compte `for update;`, l'instruction. Même
  piège que le `sansCommentaires()` de `formulaires-publics.test.ts`.

### Ce qui a été contrôlé et qui tient

Dit explicitement, parce qu'une absence de constat ne vaut que si on sait ce qui
a été regardé : signature du webhook vérifiée sur le corps brut avant toute
lecture ; les quatre fonctions `anon` sont exactement les quatre voulues (le
retrait du 28 août tient) ; réponse uniforme de `submit_company_request` ;
limitation de débit posée avant la recherche par adresse ; RLS active sur 23
tables sur 23 ; bornes de longueur au niveau de la table ; un devis de
suppression ne peut pas se faire payer ; l'expiration à 30 jours est contrôlée à
l'acceptation comme au déclin.

**Une piste ouverte puis fermée**, à ne pas rouvrir : `store_team` porte la RLS
sans aucune policy et ce n'est documenté nulle part. Vérifié — aucun accès
direct à cette table depuis l'app, le site ou les fonctions edge, tout passe par
des RPC `SECURITY DEFINER`. C'est la configuration la plus sûre, pas un oubli.

### Vérifications

Tout en transactions annulées, sur les fonctions réellement appliquées, données
d'essai contrôlées à zéro après coup : le rejeu répond `already` sans rien
recréer et une session inconnue reste en erreur (pour que Stripe réessaie) ; la
reprise d'invitation est refusée et **l'invitation de l'autre entreprise reste
intacte** ; 500 magasins déclarés avec un devis à une ligne créent **un**
magasin au prix devisé, et un devis sans lignes crée toujours les magasins
déclarés ; 200 codes tirés, tous distincts, bien formés, les 32 caractères
représentés.

**⚠️ Ce qui n'a pas été prouvé : la concurrence réelle de VR-001.** Une seule
session ne peut pas se faire la course à elle-même. Le verrou est le mécanisme
correct de Postgres pour ce cas, mais la démonstration demanderait deux webhooks
signés joués en parallèle sur un environnement de test.

### La vraie idempotence : `stripe_events_traites` (`20260828250001`)

Écrite dans la foulée. La table porte l'invariant au niveau de l'**événement**,
en plus du `for update` qui tient la course au niveau de la demande, et laisse
une trace de ce qui a été reçu et quand. Elle prépare
`checkout.session.async_payment_succeeded`, que le prélèvement SEPA ajoutera :
deux types d'événement pour un même paiement.

- **⚠️ Le marquage est DANS `fulfil_paid_request`, pas dans la fonction edge.**
  Marquer depuis le webhook, avant d'appeler la création, rendrait tout échec
  **définitif** : le client paie, la création échoue, Stripe réessaie, et le
  rejeu est écarté comme « déjà vu ». Il faudrait démarquer sur chaque chemin
  d'erreur — une compensation qu'on finirait par oublier sur un chemin ajouté
  plus tard. Dans la même transaction, il n'y a rien à compenser : si la
  fonction lève, la marque disparaît avec le travail.
- **Le marquage vient en premier**, avant même la lecture de la demande : un
  `insert … on conflict do nothing` qui ne pose aucune ligne dit que
  l'événement est déjà passé, et on sort par `already` sans rien relire.
- **⚠️ `p_event_id` est facultatif, et doit le rester.** C'est ce qui a permis
  d'appliquer la migration avant que le webhook ne soit redéployé : un appel à
  quatre arguments se comporte exactement comme avant. Vérifié.
- **⚠️ L'ancienne signature à quatre arguments est supprimée** dans la même
  migration : `p_event_id` ayant un défaut, Postgres garderait les deux et un
  appel à quatre deviendrait ambigu — même piège que `ca_request_store`.
- Purge à **30 jours** dans `purge_expired_data` : Stripe ne rejoue pas au-delà.
- RLS active, aucune policy, comme `submission_attempts` et `alertes_envoyees`.

**La fonction edge `stripe-webhook` a été redéployée** (version 13, 28 août
2026) — le dépôt ne déploie rien. Vérifié après coup : les trois fichiers
téléchargés depuis la production sont **identiques à l'octet près** à ceux du
dépôt (`supabase functions download` puis `diff`), `p_event_id` est bien dans ce
qui tourne, et la fonction répond 405 sur GET, 400 « signature absente » sur un
POST nu. ⚠️ **Ce 400 est aussi le contrôle de `verify_jwt`** : une fonction
protégée par JWT aurait répondu 401 avant d'atteindre le code.

Effet de bord bienvenu : le repli `SITE_PAR_DEFAUT` d'`_shared/email.ts`, qui
pointait encore vers `quantinvo.vercel.app` dans la version déployée, est passé
à `www.quantinvo.com` — les fonctions edge lisent `APP_PUBLIC_URL` à
l'exécution, mais le repli ne se met à jour qu'au redéploiement.

La commande :

```bash
supabase functions deploy stripe-webhook --project-ref heabesqvlinzarqenymj --no-verify-jwt
```

⚠️ **`--no-verify-jwt` n'est pas facultatif.** Le dépôt n'a pas de
`supabase/config.toml`, donc le CLI déploie avec la vérification de JWT
**activée** par défaut. Stripe n'envoie aucun JWT : le webhook répondrait 401 à
tous les paiements. La règle vaut pour les quatre autres fonctions publiques —
`stripe-webhook`, `accept-quote`, `decline-quote`, `quote-pdf`,
`submit-company-request`, `alerte-anomalies`. Vérifier `verify_jwt` après
chaque déploiement.

⚠️ **Passer par le CLI, jamais par la console MCP, pour cette fonction.** La
console exige de retranscrire les trois fichiers (`index.ts` et les deux
`_shared/`, 33 Ko) dans l'appel, dont la vérification de signature HMAC : une
faute de copie invisible sur le chemin du paiement ne vaut pas le gain. Le CLI
copie les fichiers du disque, et `supabase functions download` permet de le
vérifier ensuite par un `diff`. Il s'installe par
`brew install supabase/tap/supabase`, et `supabase login` ouvre le navigateur —
aucun mot de passe Supabase à retrouver. ⚠️ La fenêtre du **trousseau macOS**
qui apparaît alors demande le mot de passe de la session Mac, pas celui de
Supabase ; « Toujours autoriser » évite qu'elle revienne à chaque commande.
Docker n'est pas nécessaire (le CLI prévient, et empaquette côté serveur).

Tests de garde : `web/tests/stripe.test.ts`, blocs « deux livraisons du même
événement », « une invitation en attente ailleurs », « crée ce qui a été
devisé » et « les codes d'accès ».

# Modélisation de menaces du backend (28 août 2026)

Balayage des 127 fonctions de `public` (121 en `SECURITY DEFINER`), des 38
policies RLS, des déclencheurs et des 17 fonctions edge. Cinq constats, tous
corrigés le jour même. Rapport hors dépôt :
`Risk_Assessment_Report/QUANTINVO-BACKEND-RAPPORT.md`.

**⚠️ La méthode compte autant que les constats : par MOTIF de défaut, pas par
lecture linéaire.** Lire 180 Ko de définitions à la file trouve mal et coûte
cher. Les sept motifs balayés sont ceux qui ont réellement produit des constats
sur ce projet : garde d'autorisation absente, garde portant sur un paramètre
plutôt que sur la ligne visée, droits trop larges, écriture sans borne
d'appartenance, lecture-puis-écriture, invariant de déclencheur contournable par
un autre verbe, policy court-circuitant la couche RPC. Chacun se pose en une
requête sur les catalogues. **Refaire ce travail depuis le dépôt plutôt que
depuis la base, c'est le refaire pour rien** — les migrations divergent.

## VR-006 · Un refus écrasait une acceptation (`20260828260001`)

Le plus grave. `accept_quote_by_token` gardait sa transition
(`and status = 'quoted'`), **`decline_quote_by_token` ne la gardait pas** — et
les deux gestes sont sur la même page, sous le même jeton.

Accord et refus concurrents : les deux lisent `quoted`, l'acceptation passe et
pose `accepted`, le refus attend la levée du verrou puis **écrase en
`declined`**. Or `accept-quote` a déjà rendu son adresse Stripe. Le client
paie → `fulfil_paid_request` trouve `declined` → « Transition impossible » →
500 → Stripe réessaie indéfiniment. **Le client a payé et n'obtiendra jamais
rien**, sans réparation automatique.

⚠️ **L'asymétrie entre fonctions sœurs est le signe habituel de l'oubli.** Elle
s'est répétée trois fois dans ce projet : `accept` / `decline`,
`admin_quote_company_request` / `admin_quote_store_request`,
`ca_set_supervisor_stores` / `ca_set_counter_stores`. Quand deux fonctions font
le même geste sur deux tables, les comparer ligne à ligne vaut mieux que les
lire séparément.

## VR-005 · Le double-clic de la console créait en double (même migration)

`admin_fulfil_company_request`, `admin_fulfil_store_request`,
`admin_fulfil_store_removal` et `admin_quote_store_request` : même défaut que
le webhook, sur le chemin manuel. L'acteur est de confiance (`is_admin()`),
donc **ce n'est pas une attaque, c'est un accident** — deux clics sur « Créer
le magasin » pendant que la réponse tarde, et l'entreprise ou le magasin est
créé deux fois, avec deux codes d'accès et une licence facturée en trop.

⚠️ **Ici `for update` SUFFIT, sans garde ajoutée sur l'UPDATE.** Ces cinq
fonctions portent déjà, après la lecture, un contrôle qui rejette l'état
d'arrivée (`status <> 'paid'`, `<> 'pending'`, `<> 'quoted'`) : le second appel
attend, relit la ligne transformée, et son propre contrôle le refuse. C'est ce
qui les distingue de `fulfil_paid_request`, dont le contrôle laissait passer et
où il a fallu garder l'UPDATE en plus. Vérifier ce point avant de recopier le
correctif ailleurs.

## VR-007 · Un superviseur invité pouvait effacer les comptages d'autrui (`20260828270001`)

La policy `counts_delete_supervisor` autorisait
`get_my_role() = 'supervisor' AND is_session_participant(session_id)`, **sans
restriction sur `counted_by`** : tout superviseur participant pouvait supprimer
n'importe quelle ligne de la session, celles de toute l'équipe comprises, en
une requête. Et `counts` n'est pas journalisée — la destruction ne laissait
aucune trace.

⚠️ **C'était la moitié restée ouverte du trou fermé le 21 août.** Ce jour-là,
`delete_session` a été réservée au créateur et à l'administrateur d'entreprise,
et la policy DELETE d'`inventory_sessions` supprimée. L'inventaire était
protégé ; **son contenu se vidait encore ligne à ligne.** Quand on ferme un
droit de suppression, vérifier aussi les tables que l'objet contient.

⚠️ **CE QUE LE RETRAIT NE TOUCHE PAS, ET C'EST LE POINT.** Règle rappelée par
Julien : un superviseur invité sur un inventaire y est parce qu'il supervise
aussi. Il ne peut ni clôturer ni supprimer, **mais il doit pouvoir superviser
et arbitrer**. Rien de cela ne passait par cette policy :

- `resolve_audit` — l'arbitrage, qui pose `final_qty` — est `SECURITY DEFINER`
  gardée par `can_access_session` : hors RLS, inchangée ;
- **`delete_audit_line` est le geste légitime de retrait d'une ligne**, elle
  aussi `SECURITY DEFINER` et gardée par `can_access_session`. Elle supprime
  bien dans `counts`, mais **bornée à un SKU dans une zone**, et elle est
  appelée par l'app (`src/lib/queries.ts`) comme par le site
  (`web/lib/inventory.ts`) ;
- la lecture des comptages (`counts_select_supervisor`) ne bouge pas ;
- `counts` reste en **ajout pur** : aucune policy UPDATE, une correction est une
  ligne négative.

Ce qui disparaît est donc la seule chose qu'aucun écran n'offrait : la
suppression brute, en masse, sur un critère choisi par le client.

## VR-008 · L'invariant de `profiles` se contournait par l'INSERT (même migration)

`profiles_pin_privileged` fige `role`, `company_id` et `is_admin` — mais c'est
un déclencheur **BEFORE UPDATE**, et la policy `profiles_insert` laissait un
client insérer sa propre ligne sans contrainte sur ces colonnes.

⚠️ **Forme exacte de VR-003** : un invariant posé sur un verbe, contourné par un
autre. Non atteignable — `handle_new_user` crée le profil dans la transaction de
l'insertion `auth.users`, `id` est clé primaire, et il n'existe aucune policy
DELETE sur `profiles` — mais **la sûreté tenait à un enchaînement, pas à une
règle**. `profiles_update` reste : chacun modifie son prénom et son nom.

## VR-009 · `join_code` restait modifiable (même migration)

Le code d'accès était bien **illisible** (`authenticated` ne lit que
`company_id, created_at, id, name` sur `stores`), mais la révocation d'origine
n'avait porté que sur `SELECT` : `INSERT`, `UPDATE` et `REFERENCES` restaient.
Inexploitable — ces tables n'ont aucune policy d'écriture — mais le jour où
quelqu'un ajouterait une policy UPDATE sur `stores`, le code deviendrait
modifiable par un superviseur.

⚠️ **Trois de ces cinq correctifs sont des RETRAITS, pas des resserrements.**
Règle apprise avec `get_company_directory` : une permission que personne
n'appelle et qui ouvre plus que nécessaire n'a pas besoin d'un contrôle, elle a
besoin d'être injoignable. Chaque retrait a été précédé d'une vérification de
l'absence d'appelant dans l'app, le site **et** les fonctions edge.

## Ce qui a été balayé et qui tient

- **Aucune fonction `SECURITY DEFINER` appelable par un client n'est dépourvue
  de contrôle.** Les seules sans garde sont les quatre du parcours de devis (le
  jeton tient lieu de clé) et quatre fonctions pures en `invoker`.
- **Les paramètres en tableau sont vérifiés élément par élément** :
  `ca_invite_supervisor` et `ca_set_supervisor_stores` comptent les magasins de
  l'entreprise et refusent si le compte diffère. Aucune affectation croisée
  possible.

## Deux fonctions sœurs traitent la même erreur pareil (`20260828280001`)

Relevé comme observation pendant le balayage, corrigé ensuite à la demande de
Julien. `ca_set_supervisor_stores` **refusait** une liste contenant un magasin
d'une autre entreprise ; `ca_set_counter_stores` le **filtrait** silencieusement
et rendait `success: true`.

Aucune fuite dans les deux cas — c'est pourquoi ce n'était pas un constat. Mais
les deux servent **le même geste à l'écran** (`changerMagasins` route selon le
rôle) : l'administrateur voyait son action échouer franchement sur un
superviseur et réussir à moitié sur un compteur, avec moins de magasins
affectés qu'il n'en avait cochés et rien pour le lui dire. Le journal
enregistrait le compte filtré, ce qui rendait l'écart invisible après coup.

⚠️ **Ce qui reste différent, et doit le rester : la liste vide.** Un compteur
sans magasin est un état normal — c'est même ce qui a justifié d'écrire cette
fonction le 23 août, un compteur retiré de son dernier magasin devenant
invisible partout et donc irrécupérable. Un superviseur, lui, garde toujours au
moins un magasin : pour le détacher, on lui retire le rôle. Ne pas « aligner »
cette différence-là.

Vérifié en transaction annulée, session d'administrateur simulée, sur les
données réelles : magasin étranger refusé avec le message exact de la jumelle,
liste vide acceptée, magasin de l'entreprise accepté.
- **Les 17 policies de lecture sont toutes cloisonnées** par entreprise, session
  ou personne.
- **Le formulaire public superviseur est bien éteint** : `submit-supervisor-request`
  répond **410 Gone**, vérifié en direct.
- **`admin-metrics`** existe et n'était documentée nulle part : fonction edge
  correctement gardée (`is_admin()` avec le jeton de l'appelant, 403 sinon, clé
  de métriques qui ne quitte pas le serveur). Rien à corriger.

## Limites

Aucune exploitation exécutée, aucune donnée de production modifiée. **VR-006 et
VR-005 n'ont pas été reproduits en concurrence réelle** — une session ne peut
pas se faire la course à elle-même ; ce qui est vérifié, c'est qu'un refus après
acceptation est désormais rejeté. Et **le balayage est par motif, donc
incomplet par construction** : il garantit qu'aucune des sept formes connues ne
se cache ailleurs, pas qu'il n'en existe pas d'autres. Le contenu métier des
fonctions n'a pas été relu — un défaut de calcul sortirait de ce périmètre.

Tests de garde : `web/tests/backend-durcissement.test.ts`.

# E-mails transactionnels : un seul gabarit

Tout ce que le produit envoie par Resend passe par
`supabase/functions/_shared/email.ts` (`emailQuantinvo`). Les fonctions edge ne
décrivent plus que le contenu — titre, salutation, paragraphes, encadré de
faits, bouton, note, raison de l'envoi — et reçoivent en retour le **HTML et la
version texte**, envoyés tous les deux à Resend (les messageries sans HTML, et
les filtres anti-spam, lisent la seconde).

Le gabarit suit la charte « Papier », en trois zones (arrêté avec Julien le
21 août 2026, après plusieurs passes sur le rendu réel dans Gmail) :

- **bandeau encre** en tête — le cube seul (sans la tuile de l'icône
  d'application, qui faisait vignette rapportée) à 56 px, « Quantinvo » en
  blanc à 28 px, le filet de scan cyan faisant la frontière avec le corps ;
- **corps blanc** — titre noir à 20 px, texte à 15 px, bouton indigo mesuré
  (14 px demi-gras) : il vient après la marque, il ne doit pas peser plus
  qu'elle ;
- **pied gris clair** — l'identité et les liens, rien d'autre.

Sous le bouton : l'adresse de secours, puis « Ce lien est personnel… » s'il y
a lieu, puis **« Vous recevez ce message parce que… »**. Cette phrase a
remplacé « vous pouvez ignorer cet e-mail » et ne se répète pas en pied.

Vérifié sur 375 px de large : l'en-tête tient sur une ligne. Au-delà de cette
échelle de marque, il mangerait l'écran d'un petit téléphone avant que le
message ne commence.

Quatre points à ne pas défaire :

- **Tout ce qui vient de la base est échappé** par le gabarit, et un lien qui
  n'est pas en `http(s)` est refusé. Avant, un nom de magasin ou un prénom
  était interpolé tel quel dans le HTML.
- **Une seule image, aucune police distante** : le logo, en PNG servi par le
  site (`web/public/email/logo-quantinvo.png`, adresse dérivée de
  `APP_PUBLIC_URL`). Gmail retire les SVG et bloque les `data:` en source
  d'image — d'où le PNG hébergé. Le mot-symbole reste **du texte à côté** de la
  tuile, avec un `alt` vide : la moitié des messageries coupent les images par
  défaut, la marque doit se lire quand même, et sans afficher « Quantinvo »
  deux fois. **Le site doit être déployé avant les fonctions edge**, sinon les
  e-mails pointent vers une image absente.
- **Tableaux et styles en ligne**, pas de flexbox : Outlook. La dégradation
  (coins droits, mêmes couleurs) est prévue — ne pas « moderniser » ce
  balisage.
- Le module reste **sans API Deno** : c'est ce qui permet aux tests du site de
  l'exécuter tel quel (`web/tests/email-template.test.ts`, qui vérifie aussi
  qu'aucune fonction edge ne réécrit son HTML à la main).

Aperçu des quatre messages (compteur, superviseur, administrateur, invitation à
un inventaire) : https://claude.ai/code/artifact/c5dc05ae-7500-4455-8c9f-3ae600b2ecf4

**Les fonctions edge modifiées doivent être redéployées** pour que le nouveau
gabarit parte réellement : le dépôt ne déploie rien tout seul.

## On peut répondre aux messages (22 août 2026)

Julien : *« tu dis “dites-le nous en répondant à ce message”, sauf qu'on ne
peut pas y répondre »*. Les messages partent d'une adresse d'envoi
(`INVITE_FROM_EMAIL`) qui ne lit rien, et quatre textes promettaient une
réponse. Deux règles, gardées par `web/tests/email-template.test.ts` qui
balaie toutes les fonctions :

- **tout envoi pose un `reply_to`** — `CONTACT_EMAIL` d'abord, sinon un repli
  que l'appelant a sous la main (l'adresse de l'administrateur qui envoie le
  devis ou refuse, celle du client sur un avis interne — on répond alors au
  prospect directement depuis sa boîte). `_shared/email.ts` porte
  `adresseDeContact()` et `envoyerEmail()` ; les fonctions les plus récentes
  passent par ce dernier, les autres injectent `reply_to` dans leur appel ;
- **un texte qui invite à écrire donne l'adresse, ou se tait**. Jamais
  « répondez à ce message ». Côté site, `lib/contact.ts` lit
  `NEXT_PUBLIC_CONTACT_EMAIL` et `/devis` s'en sert de la même façon.

**Posé le 22 août 2026** : `CONTACT_EMAIL` (secret edge) et
`NEXT_PUBLIC_CONTACT_EMAIL` (Vercel, environnement Production) valent
`contact@quantinvo.com`. Vérifié sur la page publique du devis. Sans ces
variables, les fonctions sans repli n'auraient pas de `reply_to` et les
textes ne promettraient rien : c'est le comportement de secours.

**La boîte `contact@quantinvo.com`** : redirection ImprovMX (gratuit) vers
`devkaylab@gmail.com` — MX `mx1/mx2.improvmx.com`, SPF
`include:spf.improvmx.com` et DMARC `p=none` (rapports sur contact@) posés
sur la racine, dans Vercel → Domains. Gmail « envoie en tant que » contact@
par `smtp.gmail.com` avec un mot de passe d'application (le SMTP d'ImprovMX
est payant) : un client qui reçoit une réponse voit Quantinvo, pas Gmail.
Resend reste sur `send.quantinvo.com`, aucun conflit. Un mail envoyé à
soi-même via l'alias peut tomber en spam — c'est propre à ce cas, ImprovMX
l'explique ; tester depuis une autre adresse.

**Les templates hébergés par Resend ont été examinés puis écartés**
(21 août 2026, décision de Julien). Ils existent bien — `template: { id,
variables }` à l'envoi, éditeur et historique côté tableau de bord — et ils
permettraient de changer un mot sans redéployer. Trois raisons de rester au
code : la syntaxe de variables est `{{{NOM}}}`, dont la documentation ne dit
pas si elle échappe (c'est précisément le trou fermé ici) ; il n'y a ni
condition ni répétition, alors que nos messages en ont (salutation nommée ou
non, encadré de faits pour le seul inventaire, note et raison facultatives) ;
et le gabarit sortirait de git et de ses tests.

À savoir si la question revient : **la clé Resend en production est limitée à
l'envoi**. Vérifié en direct — `POST /emails` répond 200, mais `POST
/templates`, `GET /templates` et `GET /emails/{id}` répondent tous 401
« This API key is restricted to only send emails ». C'est du moindre privilège
voulu : une fuite de cette clé permettrait d'envoyer, pas de lire ce qui est
parti. Passer aux templates Resend obligerait donc à créer une clé plus
puissante quelque part — c'est une décision de sécurité, pas un simple
déplacement de fichiers.

# Application mobile : « Mon profil » rangé comme le site (21 août 2026)

L'écran profil de l'app était le carrefour que le site avait démonté quelques
jours plus tôt : identité, entreprise, magasins et leurs codes, balises,
inventaires, équipe, déconnexion et suppression, empilés sur deux hauteurs
d'écran. Il suit désormais la même logique — **la personne, puis des lignes
vers le travail** — mais sans barre d'onglets : sur mobile, le bouton profil du
bandeau ouvre un **seul écran, `account.tsx` (« Mon compte »)**, qui mène aux
autres.

Ce qui a bougé :

- `(supervisor)/profile.tsx` **supprimé**, remplacé par `(compte)/account.tsx` ;
- écrans nés de son démembrement, dans `(supervisor)` car ils sont le travail
  du superviseur : `stores.tsx` (Magasins), `team.tsx` (Mon équipe),
  `tools.tsx` (Boîte à outils) — mêmes noms que les onglets du site ;
- **groupe `(compte)`** : `account.tsx`, `password.tsx`, `mfa.tsx`,
  `my-data.tsx`, `name.tsx`, communs à tous les rôles (voir plus bas) ;
- **« Mes inventaires » retiré** : l'écran Sessions les liste déjà. C'est le
  doublon que le site avait lui aussi sorti de `/account`.
- `MenuList.tsx` (`MenuCard`, `MenuRow`, `SectionLabel`, `ChevronIcon`) : le
  motif de menu existait déjà, redessiné à la main dans l'écran d'un
  inventaire. Une seule définition maintenant.
- Requêtes devenues sans objet et retirées : `getMySessions`,
  `getTeamMembers`, `getTeamInvitations`, le type `Invitation`.

**`my_team_by_store` est la même RPC que la page « Mon équipe » du site**, et
c'est voulu : deux écrans qui montrent la même chose doivent la demander de la
même façon. Piège vérifié à la source — elle **ne renvoie pas `full_name`**
pour les invitations, seulement `first_name` et `last_name` (type `TeamInvite`,
volontairement plus étroit que la ligne de table). S'appuyer sur le type de la
table afficherait un nom vide en toutes circonstances. L'annulation passe par
`cancel_my_invitation`, comme le site, et non plus par un DELETE nu sur
`team_invitations`.

Les types `src/types/database.types.ts` ont été **régénérés** au passage : ils
dataient d'avant `first_name`/`last_name`/`is_company_admin` sur `profiles` et
d'avant `export_my_data` et `my_team_by_store`.

## Mot de passe, double authentification, export : l'app ne renvoie plus au site

Les trois fonctions n'existaient que sur le site. Elles sont dans l'app.

- **`src/lib/password.ts` est la copie exacte de `web/lib/password.ts`**, comme
  `baliseSeries` et `presence` : l'app et le site ne compilent pas ensemble.
  Les deux fichiers bougent ensemble — `web/tests/password.test.ts` échoue
  s'ils divergent, et la console Supabase reste la seule à faire foi.
- **`src/lib/mfa.ts` n'est pas une copie** : il rend en plus l'adresse
  `otpauth://`. Sur un téléphone, l'application d'authentification est
  installée sur l'appareil qui affiche le QR code — **on ne peut pas le
  scanner**. Le chemin principal est donc l'ouverture directe de l'application,
  ou la clé recopiée ; le QR ne sert qu'à s'enrôler depuis un autre appareil.
  Le QR est redessiné avec `qrcode` + `react-native-svg` (`QrCode.tsx`) : celui
  de Supabase est une image SVG en `data:`, que `<Image>` ne sait pas afficher.
  Et **pas de `canOpenURL`** avant l'ouverture : sur iOS il répond faux pour
  tout schéma absent de `LSApplicationQueriesSchemes`, même quand une
  application sait l'ouvrir.
- **Conséquence obligatoire, à ne jamais défaire : la connexion de l'app
  demande le code.** `AuthProvider` expose `mfaRequired` (contrat aal1/aal2
  identique au site), `index.tsx` renvoie vers `/login` tant qu'il est vrai, et
  `login.tsx` affiche la deuxième étape. Sans cela, activer la double
  authentification depuis le téléphone ne protégerait que le site : le
  téléphone continuerait à laisser entrer au mot de passe seul. Tests de garde :
  `tests/compte.test.ts`.
- **Il n'y a toujours pas de codes de secours.** Un téléphone perdu se dépanne
  en base (`delete from auth.mfa_factors where user_id = …`, en `service_role`).
  Ouvrir l'activation à tous les superviseurs rend ce dépannage plus fréquent :
  l'écran le dit avant l'activation, dans un encadré, plutôt qu'après la perte.

## Le compte est le même pour tous les rôles — groupe `(compte)`

Les écrans de compte ont d'abord été écrits sous `(supervisor)`, ce qui les
rendait **inatteignables pour un compteur** : la garde de ce groupe renvoie
vers la connexion tout ce qui n'est pas superviseur. Or changer son mot de
passe, activer sa double authentification ou récupérer ses données ne dépend
pas du rôle. Ils vivent donc dans `(compte)`, dont la seule condition d'entrée
est d'avoir un profil — et une session complète (`mfaRequired` y est refusé,
sinon on pourrait retirer son second facteur à moitié authentifié).

`(compte)/account.tsx` est **un seul écran pour tout le monde**, comme
`/account` sur le site : seul le bloc « Mon travail » (Magasins, Mon équipe,
Boîte à outils) est conditionné au rôle superviseur. Les deux layouts,
`(supervisor)` et `(employee)`, ouvrent le même écran par le bouton profil du
bandeau.

**Le groupe porte aussi les écrans de travail — et c'est la flèche de retour
qui l'a imposé.** Magasins, Mon équipe, Boîte à outils et Ajouter un membre
sont restés d'abord dans `(supervisor)` : les ouvrir depuis « Mon compte »
traversait deux groupes de routes, la pile repartait de zéro et **le bouton
retour disparaissait**. Règle à retenir : *ce qu'un écran ouvre doit être dans
sa pile*. La garde de rôle que portait le groupe `(supervisor)` est donc posée
dans chacun de ces quatre écrans (`profile?.role !== 'supervisor'` → retour à
« Mon compte ») ; les RPC refusent déjà un compteur côté serveur, cette garde
lui évite un écran en erreur.

**L'administrateur d'entreprise est un superviseur comme les autres pour ces
écrans**, et c'est un piège de rédaction : lui écrire « l'administrateur de
votre entreprise vous affectera un magasin » le renvoie à lui-même. Les états
vides de Magasins et Mon équipe branchent donc sur `profile?.is_company_admin`.
⚠️ **Leur texte a changé le 22 août 2026** : il ne s'affecte plus rien, il est
affecté à *tous* les magasins de son entreprise (section « L'administrateur
d'entreprise supervise tous les magasins » plus bas). S'il n'en voit aucun,
c'est que l'entreprise n'en a aucun.

**Un échec de chargement n'est pas une liste vide.** Ces deux écrans
distinguent `isError` du cas « aucune ligne » : sans cela, une coupure de
réseau annonce « Aucun magasin » à quelqu'un qui en a, et l'envoie réclamer un
accès pour rien. Vu en simulateur, requête refusée et message « Aucun
magasin » à l'écran.

« Mon compte », lui, est le **premier** écran de sa pile : la flèche native ne
s'affiche pas alors qu'on arrive bien de Sessions ou de l'accueil. D'où le
`headerLeft` « Retour » du layout, conditionné à `router.canGoBack()`.

Conséquence côté compteur : « Déconnexion » posé en haut de son accueil et le
lien souligné « Supprimer mon compte » en pied ont disparu — les deux sont
dans « Mon compte », comme pour le superviseur. `DeleteAccountButton` (le
lien) n'avait plus d'appelant : le fichier est devenu
`components/AccountDeletion.tsx`, qui n'expose plus que `useAccountDeletion`
et `DeletionPendingNote`.

Maquette de référence :
https://claude.ai/code/artifact/032d3ee8-ee0f-4b32-9b21-c6a5d278356c

# Le rapport recense l'attendu, pas seulement le compté (22 août 2026)

Deux écrans du même inventaire se contredisaient : sur « Test », l'onglet
Set up annonçait **1 015 pièces attendues** quand le Rapport en affichait
**395**, sur 11 lignes alors que le fichier théorique en compte 21.

`get_session_results` partait de `article_audit`, qui ne contient une ligne
que pour un SKU **déjà scanné**. Un article attendu et jamais trouvé n'avait
donc aucune ligne : son théorique n'était pas additionné, et son manque
n'entrait pas dans l'écart — les quatre tuiles du haut étant calculées en
additionnant les lignes affichées. **L'inventaire ne montrait pas la démarque
qu'il est censé révéler.**

Règle donnée par Julien : **le fichier qui fait foi est le stock théorique,
pas le référentiel**. Sans stock théorique, seuls les SKU comptés
apparaissent ; avec, tout l'attendu apparaît.

D'où l'**union** de `theoretical_stock` et des SKU comptés (migration
`20260822090001`), qui couvre les deux règles sans condition : quand aucun
fichier théorique n'est importé, l'union se réduit d'elle-même aux SKU
comptés. Ne pas la remplacer par un `from theoretical_stock` sec, ni par une
jointure interne — le rapport des inventaires sans fichier attendu se
viderait.

**Les règles d'audit ne bougent pas**, et c'est délibéré : la quantité qui
fait foi reste `final_qty → qty_pass2 → qty_pass1` (une quantité arbitrée
l'emporte sur l'audit, qui l'emporte sur le comptage), et la priorité des
statuts reste `failed > pending > resolved > validated`. Le seul ajout est
`uncounted` (« Non compté »), qui ne peut jamais écraser un statut d'audit :
il ne s'applique qu'aux SKU **sans aucune ligne d'audit**, donc jamais
comptés. Il n'entre pas dans le décompte « articles présentant encore un
écart ».

Un article compté mais **absent** du fichier théorique garde sa ligne, en
écart positif : c'est un surplus, le cacher serait l'erreur inverse.

Ordre de mise en ligne, à respecter si le sujet est repris : **les libellés
d'abord, la base ensuite** — sans `uncounted: 'Non compté'` dans
`web/lib/inventory.ts` et `src/lib/report.ts`, ces lignes s'affichent avec le
mot technique brut. Les builds mobiles antérieurs le montreront dans leur
export jusqu'au prochain build : c'est la contrepartie assumée.

Vérifié après application sur « LA Bruket » : 101 lignes au lieu de 5, dont 96
« Non compté », stock théorique 719 (contre 328) et écart −650 (contre −259).

Tests de garde : `web/tests/charge.test.ts`, bloc « le rapport d'inventaire ».

## Les totaux de l'app, vérifiés le 22 août 2026

Deux écrans additionnaient des lignes **téléchargées sur le téléphone**, et
les deux sont passés au serveur.

- **Écran d'un inventaire (superviseur)** : `getSessionCounts` rapatriait
  *toutes* les lignes de `counts` de l'inventaire, toutes colonnes, à chaque
  ouverture et à chaque rafraîchissement — pour en tirer deux nombres. C'est
  le motif que le site avait retiré pour la tenue en charge, resté en place
  côté mobile. Il appelle maintenant `get_session_count_totals`. La fonction
  `getSessionCounts` n'existe plus : **ne pas la réintroduire**.
- **Écran d'un compteur** : `getMyCounts` ne filtre pas sur l'utilisateur —
  c'est la policy `counts_select_own` qui limite un compteur à ses lignes.
  Un **superviseur** relève de `counts_select_supervisor` et aurait vu *toute
  l'équipe*, affichée comme son travail à lui. Le groupe `(employee)` ne
  vérifie que la présence d'un profil, pas le rôle, donc rien ne l'en
  empêchait ; c'est le routage par rôle qui l'évitait en pratique. Nouvelle
  fonction `get_my_count_totals` (migration `20260822110001`), qui ne compte
  que `auth.uid()` quel que soit le rôle. `getMyCounts` reste utilisé par
  `CountedBalisesList`, qui a besoin des lignes et non d'un total.

Le risque commun aux deux : au-delà d'un certain nombre de lignes, l'API peut
en rendre moins que demandé, et le total baisse **sans rien signaler**. Aucun
inventaire actuel n'est assez gros pour l'observer — c'est précisément
pourquoi il fallait le corriger avant.

Vérifié depuis le site avec une session réelle : `get_session_count_totals`
rend 70 / 11 / 5 / 1 sur « LA Bruket », `get_my_count_totals` rend 1 / 11 pour
le compte connecté — conforme à la base. Et depuis le simulateur non connecté,
les deux répondent `42501` : `anon` est bien refusé.

## Les autres totaux, vérifiés le 22 août 2026

Recalculés en SQL indépendamment et comparés aux fonctions, sur les données
réelles. **Rien d'autre n'est faux** — voici ce qui a été contrôlé et les deux
limites trouvées, qui ne sont pas des défauts mais des choix.

Contrôles passés :

- **aucun comptage orphelin** : sur le seul inventaire en mode balises, les
  32 pièces sont toutes rattachées à une zone existante (0 `zone is null`,
  0 code inconnu). Le risque reste ouvert structurellement — rien n'interdit
  un comptage sans zone —, il ne s'est simplement jamais produit ;
- **la somme des totaux par zone égale le total global**, passe par passe ;
- **la progression** est bien un pourcentage de **balises** (6 comptées sur
  10 = 60 %, 2 auditées = 20 %), pas de pièces. En mode classique, elle
  rapporte les pièces scannées au stock théorique attendu, et le dit quand
  celui-ci vaut zéro ;
- **l'onglet Écarts** : 4 écarts affichés sur « Test », 5 lignes arbitrées
  exclues — conforme au calcul refait à la main.

Deux limites à connaître :

1. **En mode classique, un article compté mais jamais retrouvé à l'audit
   n'apparaît pas dans les écarts.** Sa quantité d'audit est nulle, et rien ne
   distingue « l'auditeur ne l'a pas trouvé » de « l'auditeur n'est pas encore
   passé ». C'est un choix délibéré de `computeDiscrepancies` — pas de faux
   positifs, au prix de ce silence. En mode balises le problème n'existe pas :
   clôturer une balise dit « j'ai fini ici ». Sur « LA Bruket », 4 lignes sont
   dans ce cas.
2. **`counted_skus` n'était affiché nulle part** — il traversait la RPC, le
   hook et les types sans jamais être rendu. Il l'est depuis le 22 août 2026 :
   tuile « Références comptées », à droite de « Pièces comptées », avec les
   références auditées en sous-titre. Les pièces disent le volume, les
   références disent l'étendue — 300 pièces sur 4 références n'est pas le même
   inventaire que 300 pièces sur 250.

   **Le décompte ne retient que les références dont il reste quelque chose**
   (décision de Julien, migration `20260822100001`). `counts` est append-only :
   une correction est une ligne négative, donc un article scanné puis
   entièrement corrigé avait des lignes mais un net nul, et gonflait le
   chiffre — « 25 références comptées » là où il n'en restait que 23 avec du
   stock. Le décompte porte sur le **net par SKU, strictement positif** ; un
   net négatif est exclu par la même condition. Même règle pour les références
   auditées, les deux se lisant côte à côte.

   **Les totaux de pièces ne bougent pas** : sommer par SKU puis additionner
   donne le même résultat que sommer directement — vérifié après application
   sur les cinq inventaires.

   La rangée passe à cinq tuiles : `.dash-stats-5` remplace la grille de
   quatre colonnes fixes par `auto-fit` à 116 px minimum, faute de quoi la
   cinquième se retrouvait seule sur une deuxième ligne entre 900 et 1100 px
   de large. Sous 900 px, la règle générale à deux colonnes reprend la main —
   elle est plus bas dans la feuille, donc elle gagne.

# Supprimer et retirer depuis l'app (22 août 2026)

*« Dans la même logique que le site, rends possible la suppression
d'inventaire ou de membres d'équipe sur l'app. »* L'app savait déjà supprimer
un inventaire **depuis l'inventaire lui-même** et annuler une invitation ; il
manquait la suppression **depuis la liste** et le retrait d'un compteur.

Les règles du site sont reprises telles quelles, parce qu'elles portent la
sûreté du geste :

- **La corbeille n'apparaît que sur ce qu'on peut supprimer** — créateur, ou
  administrateur de l'entreprise pour tous les siens, comme `delete_session`.
  Les cartes d'« Inventaires invités » n'en ont pas. Afficher partout ferait
  découvrir le refus après coup.
- **La confirmation nomme l'inventaire** et signale s'il n'est pas clôturé.
  Sur un téléphone une corbeille se touche vite, et la suppression emporte
  comptages, stock théorique, audits, membres et référentiel.
- **Retirer un compteur vise UN magasin**, jamais tous
  (`remove_counter_from_store`, mêmes arguments que le site). Une même
  personne peut compter dans plusieurs magasins supervisés par des personnes
  différentes ; la confirmation nomme donc la personne **et** le magasin.

**La sélection multiple existe aussi sur l'app** (ajoutée le même jour, à la
demande de Julien). Elle reprend les trois précautions du site — « Tout
sélectionner » ne porte que sur ce qui est sélectionnable, la confirmation
**nomme** les inventaires (huit au plus, puis « et N autres ») et signale ceux
encore en cours, et la suppression appelle `delete_session` **une fois par
inventaire** en rapportant les échecs (« Suppression partielle : 7 sur 10 »).

Deux adaptations au doigt :

- on y entre par **appui long** sur une carte *ou* par le bouton
  « Sélectionner » de l'en-tête — l'appui long ne s'invente pas, il ne peut
  pas être le seul chemin. ⚠️ **L'appui long doit se garder du relâchement** :
  il coche la carte *et* fait passer l'écran en mode sélection, si bien que le
  `onPress` du relâchement décochait aussitôt (relevé par Julien le 22 août
  2026 : « elle est sélectionnée puis elle se désélectionne »). Un drapeau
  `appuiLong`, remis à faux à chaque `onPressIn`, avale ce `onPress` — et ne
  reste pas armé si la plateforme ne l'envoie pas ;
- la barre d'action est sur **deux rangées**. À quatre éléments sur la largeur
  d'un téléphone, « 1 sélectionné » se cassait sur trois lignes (constaté au
  simulateur). Elle remplace le bouton « + Nouvel inventaire » le temps de la
  sélection.

Ce qui n'est pas sélectionnable (les inventaires invités) reste lisible mais
s'efface, et sa case n'apparaît pas.

**Le balayage vers la gauche** découvre deux volets — « Clôturer » (ambre) et
« Supprimer » (rouge) — en plus de la corbeille (demande de Julien :
« naturel pour l'user »). Quatre points :

- **les deux droits ne sont pas les mêmes**, et l'écran le respecte :
  supprimer est réservé au créateur (ou à l'administrateur d'entreprise),
  **clôturer est ouvert à tout superviseur participant** — c'est un geste de
  terrain que le créateur peut défaire. Un inventaire déjà clôturé n'a plus
  de volet « Clôturer » ;
- **l'ordre compte** : Clôturer d'abord, Supprimer ensuite. Le geste
  destructeur est le plus loin du doigt, il faut aller le chercher ;
- ils **n'agissent pas tout seuls** : chaque volet ouvre la même confirmation
  nommée que son équivalent au clavier. Un inventaire emporte comptages,
  stock théorique, audits, membres et référentiel ; un geste de travers ne
  doit pas suffire ;
- ils n'existent **ni quand il n'y a rien à y faire, ni pendant une
  sélection** — le geste entrerait en concurrence avec le défilement d'une
  liste qu'on est en train de cocher ;
- **un volet ouvert se referme au premier contact ailleurs** (demande de
  Julien) : sinon il reste ouvert dans le dos de la personne et son prochain
  appui tombe sur un bouton rouge qu'elle ne regardait plus. Trois précautions
  dans ce mécanisme :
  · `onStartShouldSetResponderCapture` renvoie **`false`** — on referme sans
    prendre le geste, donc l'élément touché reçoit quand même son appui ;
  · la position du rang est **mesurée à l'ouverture** (`measureInWindow`) et
    le point touché comparé à ce rectangle : sans cela on refermerait sous le
    doigt de quelqu'un qui vise justement « Supprimer » ;
  · un volet qui se ferme n'oublie l'enregistrement **que s'il est bien celui
    qu'on avait noté**. Ouvrir un rang referme le précédent, dont la fermeture
    effacerait sinon l'enregistrement du nouveau — qui resterait ouvert sans
    que personne ne le sache. Faire défiler la liste referme également ;
- il a fallu poser un **`GestureHandlerRootView` à la racine** de
  l'application (`src/app/_layout.tsx`), qui manquait : sans lui aucun geste
  n'est reçu. Ne pas le retirer en refactorant le layout.

Aucune dépendance native ajoutée — `react-native-gesture-handler` était déjà
installé, donc **pas de `pod install`**, donc pas de correctif du chemin avec
espace à réappliquer.

Au passage, la croix d'annulation d'une invitation était le caractère « ✕» :
c'est un tracé désormais, comme le reste des icônes.

Tests de garde : `tests/compte.test.ts`, bloc « supprimer et retirer depuis
l'app ».

# Inviter un compteur, et le voir (23 août 2026)

Constat de Julien, en test réel : *« n'ayant personne dans mon équipe, j'ai
envoyé une invitation au compteur, puis retour auto sur page mon équipe mais
elle est vide, ce qui peut perturber le superviseur qui retentera »*. Il a
effectivement recommencé — deux comptes créés à cinq minutes d'intervalle.

Deux causes, indépendantes.

**1. Rien n'était rechargé.** `new-member.tsx` invalidait
`['team-invitations']` — la clé d'une requête **supprimée le 21 août 2026**
avec l'ancien écran de profil. Plus personne ne l'écoutait. « Mon équipe »
reste montée sous l'écran d'ajout, et le cache tient 30 s : le retour
affichait donc l'ancienne réponse, vide. La bonne clé est `['my-team']`.
⚠️ **Une clé de cache qui ne correspond à rien ne fait échouer aucun test et
ne lève aucune erreur.** Vérifier la clé, pas seulement la présence d'un
`invalidateQueries`.

**2. La personne apparaît comme compteur, pas comme invitation.**
`generateLink` crée l'utilisateur `auth` immédiatement, donc `handle_new_user`
se déclenche, crée le profil, l'affecte au magasin **et consomme la ligne
`team_invitations`**. Le bloc « Invitations en attente » ne montre donc rien
dans le cas nominal (il reste un filet pour le cas où la création auth
échoue). C'est la ligne de compteur qu'il faut savoir lire.

**⚠️ `is_active` veut dire « s'est déjà connecté », rien d'autre.** Le badge
mobile affichait « Accès retiré » — un contresens, et sur le cas le plus
courant : quelqu'un qu'on vient d'inviter. Une personne réellement retirée
n'a plus de ligne du tout, `remove_counter_from_store` efface son
`store_team`. Le libellé est désormais celui du site (`BadgeEnAttente`,
/equipe) : **« Mot de passe à créer »**.

Deux choix de mise en page, vérifiés au simulateur :

- **la pastille se pose sous le nom**, pas à côté. Sur la largeur d'un
  téléphone, la rangée nom + pastille + « Retirer » cassait le nom sur deux
  lignes et tronquait l'adresse (« jthiongkay+… ») — or c'est précisément
  l'adresse qu'on veut relire ;
- **la ligne porte l'adresse tant que la personne n'a pas ouvert
  l'application**, et son activité ensuite. C'est là qu'est parti le lien :
  c'est ce qu'on veut vérifier quand on doute d'une faute de frappe.

Vérifié au simulateur le 23 août 2026, clair et sombre, sur les données
réelles du compte d'essai — et l'état « en attente » photographié en forçant
temporairement la branche d'affichage, puis rétabli (`git diff` contrôlé).

Tests de garde : `tests/compte.test.ts`, bloc « une personne invitée apparaît
tout de suite ».

# Une invitation ne se reprend pas (28 août 2026)

Constat n°3 de la revue de sécurité. **`team_invitations.email` est unique pour
toute la base, pas par entreprise** — et `invite-teammate` écrivait sa ligne en
`upsert` sur cette colonne, **avec la clé de service, donc hors RLS**, sans
regarder à qui elle appartenait.

Le chemin, en trois temps. S'il existe une invitation en attente pour
`bob@exemple.fr` avec `role = 'company_admin'`, un superviseur de **n'importe
quelle autre entreprise** ajoute cette adresse à son équipe :

1. l'`upsert` bascule `company_id` sur la sienne ;
2. **`role` n'était pas dans la charge**, donc PostgREST ne le met pas à jour —
   la valeur privilégiée survit à l'écrasement ;
3. `handle_new_user` honore la ligne à l'inscription. La personne devient
   administrateur de l'entreprise de l'attaquant.

La fenêtre est étroite : il faut une invitation privilégiée dont le compte
`auth` n'a pas encore été créé, ce qui n'arrive que si l'envoi a échoué en
cours de route. Le geste correct existait pourtant déjà à côté —
`ca_invite_supervisor` refuse dès qu'une invitation existe pour l'adresse.

## Deux invariants, en base

Migration `20260828150001`, déclencheur `team_invitations_figees` :

- une invitation **ne change pas d'entreprise** ;
- une invitation **ne change pas de rôle**.

Les deux se défont de la même façon : on **annule et on réinvite**. Un geste
délibéré et tracé, plutôt qu'un effet de bord d'`upsert`.

**⚠️ Ce déclencheur vaut pour TOUS LES RÔLES, `service_role` compris.** C'est
ce qui le distingue de `profiles_pin_privileged`, qui ne mord que sur
`authenticated` et `anon` : ici le trou est précisément dans un chemin en clé
de service, le borner aux rôles clients ne fermerait rien. **Ne jamais y
ajouter de condition sur `current_user`** — un test le vérifie.

Ce que ça ne casse pas, vérifié fonction par fonction avant d'écrire :
**aucune fonction du produit ne fait d'UPDATE sur `team_invitations`**. Les
trois fonctions d'invitation (`admin_invite_company_admin`,
`ca_invite_supervisor`, `invite_company_admin_after_payment`) font des INSERT ;
`handle_new_user`, les annulations et les purges font des DELETE. Le seul
UPDATE du produit était cet `upsert` — celui qu'on ferme.

## Et un refus lisible, dans la fonction edge

Le déclencheur suffit à fermer le trou, mais il répondrait par une exception.
`invite-teammate` lit donc l'invitation existante **avant** d'écrire, et
refuse en deux cas :

- **une autre entreprise** → `code: 'other_company'`, le même que pour un
  compte existant ailleurs, avec le même soin : on ne nomme jamais l'autre
  entreprise ;
- **la même entreprise, mais un autre poste** (`role <> 'employee'`) →
  `code: 'already_invited'`. Un superviseur ne reprend pas l'invitation d'un
  superviseur ou d'un administrateur, fût-elle de chez lui.

**⚠️ Et `role: 'employee'` est désormais posé explicitement dans la charge de
l'`upsert`.** Sans cette ligne, le rôle de la ligne existante survit — c'est la
moitié du défaut, et elle ne se voit pas à la lecture : l'absence d'une colonne
dans un `upsert` ne veut pas dire « remets-la à sa valeur par défaut », elle
veut dire « n'y touche pas ».

⚠️ **La fonction edge a été redéployée** (version 24, `verify_jwt: true`
inchangé) — le dépôt ne déploie rien tout seul. Vérifié après coup : elle
démarre et atteint son code (`{"success":false,"error":"Session expirée."}` sur
un appel sans session valable).

Vérifié en base, en transaction annulée, sur deux entreprises réelles : une
invitation `company_admin` posée pour A, sa reprise par B **refusée**, son
changement de rôle **refusé**, une correction de prénom acceptée, et
l'annulation-puis-réinvitation acceptée.

⚠️ **`session_invitations` n'a pas ce défaut** : sa contrainte d'unicité porte
sur `(session_id, email)`, donc elle est déjà bornée à un inventaire. Vérifié —
il n'y avait rien à y faire.

Tests de garde : `web/tests/admin-entreprise.test.ts`, bloc « une invitation ne
se reprend pas ».

# Une personne d'une autre entreprise (22 août 2026)

Ajouter à son équipe quelqu'un dont le compte appartient à une autre
entreprise affichait « **Erreur** — Cette adresse est déjà utilisée dans une
autre entreprise », sans dire quoi faire. Constat de Julien, capture à
l'appui : *« plutôt qu'un message d'erreur, signale que cette personne fait
partie d'une entreprise extérieure à celle-ci, inviter à passer par l'admin de
l'entreprise »*.

Les deux fonctions edge concernées (`invite-teammate` pour l'équipe,
`invite-to-session` pour un inventaire) renvoient désormais
`code: 'other_company'` avec un texte qui donne la marche à suivre :
s'adresser à l'administrateur de son entreprise, ou utiliser une autre
adresse. **Le code compte autant que le texte** : sans lui, un écran ne peut
que titrer « Erreur » et recopier la phrase.

Trois points à ne pas défaire :

- **Ce n'est pas une faute de saisie.** Rien à corriger dans le formulaire :
  l'app titre « Cette personne n'est pas de votre entreprise », le site
  affiche l'explication **sous le formulaire** et non dans une notification
  qui s'efface avant qu'on l'ait lue.
- **Ne jamais nommer l'autre entreprise.** Le superviseur apprendrait quelque
  chose sur un client qui n'est pas le sien. Un test le vérifie.
- Compromis assumé : le message **confirme** que l'adresse a un compte
  ailleurs. C'est ce que Julien a demandé, et c'est déjà ce que faisait
  l'ancien texte — mais cela reste une information sur l'existence d'un
  compte, à garder en tête si le sujet de l'énumération d'adresses revient
  (voir constat M3).

`src/lib/queries.ts` fait voyager le code sur l'erreur levée
(`err.code = res.code`) : sans cela il se perdait entre la fonction edge et
l'écran.

**Les deux fonctions edge doivent être redéployées** pour que le message
change réellement — le dépôt ne déploie rien tout seul.

Tests de garde : `web/tests/admin-entreprise.test.ts`, bloc « une personne
d'une autre entreprise ».

# Lint du site : `eslint .`, et pourquoi la règle a changé (28 août 2026)

**Le site se vérifie avec `npm run lint` depuis `web/`**, qui appelle
`eslint .` et lit `web/eslint.config.mjs`.

⚠️ **Cette règle est l'inverse de celle qui tenait jusqu'au 28 août 2026**, et
le renversement mérite d'être compris avant d'y toucher.

**L'ancienne règle** — « `npx next lint`, jamais `eslint` à la main » — avait
une bonne raison : `npx eslint` lancé depuis `web/` **remontait
l'arborescence** et chargeait `eslint.config.js` à la **racine du dépôt**,
celle de l'application Expo. On croyait alors voir une trentaine d'erreurs
(« setState dans un useEffect » sur chaque page qui charge ses données au
montage) là où `next lint` n'en signalait aucune. Une fausse erreur a été
annoncée à Julien le 22 août, puis une désactivation de règle inutile écrite
et retirée.

**Ce qui a changé** : Next 16 a **supprimé la commande `next lint`**. Elle prend
désormais son argument pour un dossier — `npx next lint` répond « Invalid
project directory provided, no such directory: …/web/lint ».

**Et pourquoi le piège ne se rouvre pas** : ESLint 9 s'arrête à la **première**
configuration plate trouvée en partant du dossier courant. `web/eslint.config.mjs`
est trouvée avant celle de la racine, qui n'est donc plus jamais atteinte
depuis `web/`. **Vérifié, pas déduit** : en déplaçant temporairement le fichier,
`eslint --print-config` rend la configuration Expo (`import/ignore` sur
`@react-native`, extensions `.android.js`) ; en le remettant, non.

Deux détails à connaître :

- **`eslint-config-next` 16 exporte directement une configuration plate.** Pas
  de `FlatCompat` : il casse dessus (« Converting circular structure to JSON »,
  il tente de valider à l'ancienne une configuration qui ne l'est plus).
- **Trois règles de pureté React sont en avertissement**, pas en erreur :
  `react-hooks/set-state-in-effect`, `react-hooks/refs`, `react-hooks/purity`.
  Elles relèvent 35 points, dont 30 du même motif — une page qui charge ses
  données dans un effet. ⚠️ **Ce sont de vraies remarques**, à la différence de
  celles d'avant : elles décrivent une dette de style réelle. Elles restent
  visibles plutôt que désactivées, et ne bloquent pas — les traiter est une
  refonte des hooks, pas un sujet de sécurité, et cela ne se mène pas au milieu
  d'une montée de version. Les repasser en `error` le jour où on s'y attelle.

Ce qui ne change pas : **ne rien désactiver sur la foi d'un lint mal
configuré** — vérifier d'abord d'où viennent les règles.

## « À traiter » sur /admin : des gestes, pas des constats (22 août 2026)

Julien : *« pas besoin d'avoir ce genre de message, qui ne sont pas en
réalité des alertes »* — à propos de « n'a jamais lancé d'inventaire » et
« n'a pas compté depuis 64 jours ». Un magasin qui ne compte pas suit son
rythme, ce n'est pas une anomalie à corriger. Le bloc ne liste plus que ce
qui appelle un geste de Quantinvo : entreprise sans magasin (donc sans
licence facturée), entreprises sans administrateur, demandes de suppression
de compte. `admin_business_overview` rend toujours `idle_stores` ; la page
l'ignore. Ne pas réafficher ces lignes.

# Le site est un outil d'ordinateur (21 août 2026)

Sous **720 px de large**, l'espace connecté ne s'ouvre pas : il affiche « Cet
espace se pilote depuis un ordinateur », avec deux sorties — retour au site
public, se déconnecter — et le rappel que compter se fait dans l'application.

Décision de Julien, à la vue du rendu réel : *« il y a une app, investir du
temps dans la version mobile du site n'a pas de sens »*. Le site est l'outil
du superviseur — tableaux d'articles, imports de fichiers, rapports — et le
terrain a déjà son application. Une mise en page tactile crédible pour ces
écrans coûterait cher et servirait un usage qui n'existe pas.

Ce qu'il faut savoir avant d'y toucher :

- **La porte est en CSS, pas en JavaScript** (`@media (max-width: 719px)`
  masque `.appbar`, `.app-main` et `.dash`, et démasque `.ordinateur-requis`).
  Une mesure d'écran au montage donnerait une bascule visible au chargement et
  casserait le rendu statique. Ne pas « améliorer » en `useEffect`.
- **Elle ne ferme que la coquille `AppShell`.** Les pages publiques doivent
  rester utilisables au téléphone, et ce n'est pas un détail : les liens
  d'invitation partent par e-mail, donc s'ouvrent sur un téléphone. `/login`,
  `/bienvenue`, `/reinitialisation`, `/inventaire` et `/open` n'entrent pas
  dans la coquille — un test le vérifie, précisément pour empêcher qu'on les y
  « range » un jour.
- **720 px, pas 780** : le seuil laisse passer une tablette en portrait (768),
  où le tableau de bord bascule déjà en une colonne avec son menu burger. Le
  burger `MobileNav` sert donc encore, dans la bande 720–780.
- Un téléphone **en paysage** (844 px et plus) passe la porte. C'est assumé :
  bloquer à cette largeur bloquerait aussi une fenêtre de bureau réduite.

Corrigé au passage, sur le même constat : les onglets de la barre ne passaient
**jamais** à la ligne sous 900 px — `flex: 1` (base 0) l'emportait sur le
`width: 100%` de la règle mobile, donc ils s'écrasaient à droite de l'avatar
et il n'en restait qu'un, coupé dans un défilement horizontal. Le `flex: none`
est le correctif. Et `plural(n, 'balise en cours')` affichait « 5 balise en
courss » : cet assistant ajoute un `s` à la **fin de la chaîne**, il faut lui
donner le pluriel en toutes lettres dès que le mot n'est pas seul.

## ⚠️ À FAIRE : publier l'application et brancher les vraies fiches

L'écran « ordinateur requis » porte **deux boutons de téléchargement**, App
Store et Google Play. **L'application n'est publiée sur aucune des deux
boutiques.** Tant que ce n'est pas fait, `web/lib/appStores.ts` garde
`PUBLIEE = false` : les boutons ouvrent la **recherche** de chaque plateforme
— des adresses qui fonctionnent aujourd'hui et qui montreront la fiche le jour
venu — et l'écran affiche « L'application arrive bientôt sur les deux
boutiques ».

**Le jour de la publication, tout se règle dans ce seul fichier** : passer
`PUBLIEE` à `true` et remplacer les deux adresses par les fiches réelles —
`https://apps.apple.com/fr/app/quantinvo/id<IDENTIFIANT>` (l'identifiant
numérique vient d'App Store Connect) et
`https://play.google.com/store/apps/details?id=<PACKAGE>`. Un test échoue si
le composant se met à écrire une adresse en dur.

Deux choix à connaître, pris le 21 août 2026 :

- **Les badges sont dessinés**, pas repris d'Apple et de Google : leurs images
  de marque sont soumises à leurs chartes, et un bouton maison reste cohérent
  avec le site. Les logos sont des tracés SVG (`components/StoreBadges.tsx`).
- **Jamais de lien vers une fiche inexistante.** Une adresse de fiche inventée
  tomberait sur une erreur ; la recherche, elle, répond toujours.

Rappel : il n'y a pas encore de build Android, donc la fiche Google Play
suppose d'abord un APK. Voir la section « Build iOS » de la mémoire projet.

## L'onglet Set up tient en deux volets (21 août 2026)

Demande de Julien : *« deux sections qui collapsent, une Zone de comptage pour
la partie balise et une Données d'inventaire pour la partie fichiers. L'idée
est d'épurer cette page trop chargée. »* La page déroulait tout en permanence
— planche de balises, affectation des plages, liste des emplacements, deux
imports et leurs colonnes attendues — et se lisait comme un mur.

Composant : `components/ui/Volet.tsx`, un `<details>` (le clavier, le lecteur
d'écran et la recherche dans la page marchent sans qu'on ait à les
rebrancher).

Deux règles portent l'idée, à ne pas défaire :

- **Tout part replié.** Décision explicite de Julien : *« Pas d'ouverture
  auto, reste collapsés. Même en mode sans balise. »* Une première version
  ouvrait la section restant à faire ; c'est écarté. Pas de `open`
  conditionnel — un test le vérifie.
- **L'en-tête dit ce qu'il y a dedans.** C'est ce qui sépare « replié » de
  « caché » : un résumé (« 3 emplacements · 40 balises affectées »,
  « 135 références · aucun stock théorique ») et une pastille « À faire » /
  « Prêt ». Sans eux, il faudrait ouvrir chaque volet pour savoir où on en
  est, et la page n'aurait rien désencombré.

**« Commencer l'inventaire » ne se retrouve jamais dans un volet** : c'est une
action, pas un réglage, elle ne doit pas se cacher derrière une section fermée.
Même chose pour l'avertissement d'inventaire clôturé. ⚠️ Elle était **au-dessus**
des volets jusqu'au 25 août 2026 ; elle est passée **en dessous** — voir « Le
démarrage conclut la préparation » plus bas.

Au passage, le chevron des `<details>` déjà en place (`.collapsible`, employé
par « Conseils de format » et l'onglet Écarts) n'est plus le caractère « ▸ » :
deux bordures et une rotation, pour la même raison que le chevron du menu de
compte — à cette taille, un caractère ne se lit plus.

Maquette de référence :
https://claude.ai/code/artifact/3f89b33f-7a72-4bc1-bc00-78429c8443db

## Une seule largeur, un seul en-tête (passe de finition)

Reproche de Julien : *« la barre n'a pas la même longueur entre dashboard et
les autres pages, tu dois consistant ! »* J'avais élargi cette page seule. La
règle : **une largeur pour tout l'espace connecté** — `.appbar-inner` et
`.app-main` à 1120 px, sans modificateur par page. Un test le garde.

Dans la foulée, quatre points de système qui appartiennent au même geste :

- **`.app-head` + `.page-title` partout.** Le tableau de bord d'un inventaire
  gardait `.dash-detail-head` et `.admin-title`, hérités du temps où il vivait
  hors de la coquille. Les trois classes mortes ont été supprimées, et
  `.page-sub` (le magasin et le numéro sous le titre) remplace un style en
  ligne.
- **`--appbar-h`** porte la hauteur de la barre en un seul point (64 px, et
  125 px sous 900 px où elle passe sur deux rangs — valeur mesurée au
  navigateur). `.dash-rail` s'y colle en `calc(var(--appbar-h) + 24px)` :
  avec son ancien `top: 24px`, la colonne de gauche glissait **sous** la barre
  collante au défilement.
- **`.dash-rail > .panel { margin-top: 0 }`.** `.panel` porte un
  `margin-top: 16px` utile ailleurs ; dans le rail, l'espacement vient du
  `gap`. Sans cette remise à zéro, la première carte descendait de 16 px sous
  la barre d'onglets d'en face et l'écart entre cartes valait 36 px au lieu
  de 20.
- **Le logo passe à 38 px** dans les en-têtes qui portent le mot
  « Quantinvo » (barre de l'espace connecté, en-tête du site public, page des
  mentions légales, écran « ordinateur »). À 30 px, le cube ne faisait que
  13 px : dans la tuile, il n'occupe que 43 % de la hauteur, le reste est du
  fond. Le pied de page reste à 24 px, volontairement plus discret.
- **`Logo` accepte un `gradientId`.** Un identifiant SVG est unique dans la
  page : la barre et l'écran « ordinateur requis » en posent deux, et avec le
  même identifiant le second perd son fond dès que le premier disparaît.
- **`.btn { line-height: 1.5 }`.** Le navigateur impose `line-height: normal`
  aux `<button>` et ne leur fait pas hériter celui du corps : un
  `<button class="btn">` faisait 42 px là où un `<a class="btn">` faisait
  48 px. Côte à côte, ça se voyait — et 42 passe sous la cible tactile de
  44 px. Les deux tombent maintenant à 47.

Tests de garde : `web/tests/navigation.test.ts`, blocs « l'espace connecté ne
s'ouvre pas sur un petit écran » et « a la même largeur sur toutes les pages ».

# Le démarrage conclut la préparation, il ne l'ouvre pas (25 août 2026)

Julien, test réel sur l'inventaire « Fwee », fichier importé et balises
renseignées : *« Placer bouton commencer l'inventaire en bas. Le mettre en haut
est perturbant et on ne sait pas quoi faire après. »* Le bandeau ouvrait
l'onglet Set up, **avant** les deux volets — donc avant le travail qu'on vient
faire. Il se lisait comme une consigne posée sur le chemin de la préparation,
et une fois pressé il disparaissait sans dire où aller.

`Demarrage` (`SetupTab.tsx`) est donc **la dernière chose de la page**, sous
les volets. Ce qui ne change pas de la règle du 21 août : **il n'entre pas dans
un volet** — une action ne doit pas se cacher derrière une section fermée. Être
en dessous n'est pas être caché.

Points à ne pas défaire :

- **Il est là dans les trois états**, et c'est la seconde moitié du constat
  (« on ne sait pas quoi faire après ») : ce qui manque encore (« Il reste une
  chose à faire » — le référentiel, nommé, bouton désactivé), le démarrage
  (« Tout est prêt », la carte se teinte, seul moment où elle appelle), puis
  **la suite** (« L'inventaire est en cours », et « Suivre l'avancement » qui
  mène à l'onglet Suivi). Un bouton qui disparaît une fois pressé laisse la
  question sans réponse.
- **Le clic emmène sur Suivi.** *« Cliquer sur commencer l'inventaire doit
  ramener sur la page suivi »* — la préparation est finie, on n'a plus rien à
  faire sur Set up. Le troisième état n'est donc pas ce qu'on voit juste après
  avoir cliqué : il est là pour qui **revient** préparer un inventaire déjà
  lancé. La bascule se fait **après `onChanged`**, sinon Suivi s'ouvrirait sur
  l'état d'avant.
- **`onOpenSuivi` vient de la page** (`selectTab('suivi')`), comme
  `ProgressRail` : l'onglet vit dans l'URL, la section ne se déplace pas
  toute seule.
- Un inventaire clôturé n'affiche rien de tout cela — le bloc est sous
  `!readOnly`, et son avertissement reste, lui, en tête de page.
- `.demarrage .btn { flex: none }` : dans une colonne flex, un bouton s'étire
  sur toute la largeur — déjà vu sur « Ouvrir le magasin ».

Vu au navigateur, clair et sombre, par une route jetable rendant les quatre
états (retirée, `git status` contrôlé). Tests de garde :
`web/tests/navigation.test.ts`, bloc « “Commencer l'inventaire” conclut la
page ».

# Fiche d'un inventaire dans l'app : harmonisation (21 août 2026)

Capture à l'appui, Julien : *« peux-tu faire le même travail d'harmonisation
sur cette page ? […] harmoniser la taille des différents textes, et bouger
set up au-dessus de membres »*. La feuille d'informations d'un inventaire
(`(supervisor)/[sessionId]/index.tsx`, le panneau qui s'ouvre sur le bouton
« i ») portait quatre défauts de la même famille.

- **« Créateur » et « Retirer » étaient dessinés pareil** — deux pastilles
  colorées de même taille, alors que l'une dit un état et l'autre supprime
  quelqu'un. C'était le plus grave. L'étiquette est passée en gris neutre,
  l'action en texte rouge sans fond : ça se touche, ça ne se lit pas. Ne pas
  redonner un fond coloré à `memberTag`, ni une pastille à `removeBtn`.
- **Une seule échelle de texte**, `Texte` en tête du fichier : 20 titre ·
  18 valeurs (numéro, code) · 15 courant · 13 second plan · 11 étiquettes. La
  feuille en employait sept — 10, 11, 13, 14, 15, 17, 18 — et son titre (17)
  était plus petit que le code qu'elle affiche (18). **Aucune taille en clair
  dans les styles** : un test échoue si un `fontSize:` numérique réapparaît
  (56, le grand nombre de la progression, est le seul toléré — c'est un
  chiffre d'affichage).
- **Une seule hauteur de bouton pleine largeur**, `BTN_H = 48`, partagée par
  « Compter », « Auditer », « Partager les identifiants » et « Inviter une
  personne ». Il y avait quatre géométries pour le même genre de travail.
  « Copier » passe en contour : deux boutons pleins violets étaient les objets
  les plus saturés de l'écran alors que l'information est **le code lui-même**.
- **Le motif de menu vient de `components/ui/MenuList`** et n'est plus
  redessiné ici. C'est la duplication que la refonte de « Mon compte » avait
  prétendu régler : `ActionRow`, `ChevronIcon`, `menuCard`, `menuRow`,
  `menuLabel` et `sectionLabel` vivaient encore en double dans cet écran.

**Configuration passe au-dessus de Membres** : on prépare un inventaire avant
d'y mettre des gens, et c'est l'ordre du site où Set up précède Équipe.

Les cartes de la feuille (identifiants, membres) sont passées de `background`
à `surface` : elles étaient de la couleur du fond, donc de simples contours
posés dessus.

Vérifié dans le simulateur, en clair et en sombre. **Comment atteindre cette
feuille sans pouvoir taper** (l'intégration simulateur qui ferait les appuis
refuse toujours de démarrer) : exporter temporairement `InfoPanel` et
`makeStyles`, poser une route jetable qui les rend avec des données factices,
faire pointer `src/app/index.tsx` dessus — un `openurl` ne suffit pas, iOS
demande une confirmation qu'on ne peut pas toucher — puis tout retirer et
vérifier au `git diff`.

Maquette validée avant codage :
https://claude.ai/code/artifact/a6b06896-74e0-479c-828b-93f9a3ad1159

Tests de garde : `tests/compte.test.ts`, bloc « fiche d'un inventaire ».

# Supprimer un inventaire : créateur ou administrateur d'entreprise (21 août 2026)

`delete_session` ne vérifiait que `can_access_session`, c'est-à-dire **n'importe
quel superviseur participant**. Le bouton était caché aux autres côté
navigateur ; la fonction ne l'était pas. Un co-superviseur pouvait effacer
comptages, stock théorique, audits, membres et référentiel d'un inventaire
qu'il n'avait pas créé — même famille que le trou d'`advance_pass`.

Règle arrêtée par Julien : **le créateur** pour ses propres inventaires,
**l'administrateur d'entreprise** pour tous ceux de son entreprise, y compris
ceux auxquels il ne participe pas — c'est justement son rôle. Migration
`20260821250001`. Le créateur rétrogradé en compteur perd le droit avec le
rôle, et `is_company_admin()` porte l'exigence aal2 conditionnelle.

L'écran applique la même règle : sur la liste des inventaires, la case à cocher
et la corbeille n'apparaissent que sur ce qu'on peut supprimer, plutôt que de
laisser découvrir le refus après coup.

**Sélection multiple** sur `/dashboard`, trois précautions à ne pas relâcher :

- « Tout sélectionner » ne porte que sur `filtered`, la liste **après
  recherche**. Sur `sessions`, un « tout » déborderait de ce que la personne
  voit.
- La confirmation **nomme** les inventaires (huit au plus, puis « et N
  autres ») et signale ceux encore en cours.
- Il n'existe pas de RPC de suppression groupée : on appelle `delete_session`
  une fois par inventaire et **on rapporte les échecs** au lieu d'annoncer un
  succès global. Sur dix inventaires, un refus ne doit pas passer inaperçu.

**Un inventaire clôturé ne se rouvre que par son créateur** (ou l'administrateur
d'entreprise). Migration `20260821250002`, qui referme deux trous de la même
famille :

- la policy UPDATE de `inventory_sessions` acceptait n'importe quel superviseur
  participant : un invité pouvait rouvrir un inventaire clôturé, et un rapport
  déjà exporté se remettait à bouger. La garde tient sur la **ligne existante**
  (`status <> 'closed' or created_by = auth.uid() or is_company_admin(...)`) —
  clôturer et préparer restent ouverts aux participants, ce sont des gestes de
  terrain que le créateur peut défaire ;
- la policy DELETE acceptait elle aussi tout participant, ce qui permettait de
  **court-circuiter `delete_session`** en supprimant la ligne en direct, et de
  laisser comptages, articles et audits orphelins. Elle est supprimée : la
  suppression passe par la fonction, SECURITY DEFINER donc hors RLS.

**La liste sépare les siens des invités.** `/dashboard` groupe par magasin les
inventaires qu'on a créés, puis affiche « Inventaires invités » à part, avec la
raison écrite : on peut y compter et lire le rapport, la clôture définitive et
la réouverture appartiennent au créateur. Dire la règle par la mise en page
évite de la découvrir au moment du refus.

**Ajouter quelqu'un à un inventaire : on cherche, on ne saisit pas.** L'onglet
Équipe d'un inventaire proposait, sur le site, un formulaire prénom / nom /
e-mail qui appelait `invite-teammate` — la fonction qui **crée un compte pour
l'entreprise**. Deux choses clochaient : ce n'est pas le geste attendu là
(créer un compteur se fait depuis « Mon équipe »), et surtout **personne
n'était ajouté à l'inventaire**. On remplissait le formulaire, l'équipe de
l'inventaire ne bougeait pas.

`AddSessionMember` cherche désormais dans l'équipe du magasin
(`get_store_directory`), suggestions à la frappe, et appelle
`invite-to-session` — la même edge function que l'app mobile, qui refuse les
adresses sans compte. Les personnes déjà dans l'inventaire ne sont pas
proposées. **`AddCounter` reste en place sur /equipe** : c'est là que créer un
compte a un sens, ne pas confondre les deux.

**L'app suit le même découpage** : l'écran d'accueil du superviseur
(`(supervisor)/index.tsx`) sépare « Mes inventaires » et « Inventaires
invités », avec la même explication. Le bloc « En cours » qui coiffait la liste
a disparu : il répétait les inventaires en cours, dont le statut figure déjà
sur chaque tuile.

Tests de garde : `web/tests/suppression-inventaire.test.ts` et
`tests/compte.test.ts` (bloc « accueil superviseur »).

(Les deux droits qui manquaient ici — suppression des comptes par
l'administrateur d'entreprise, demande d'ajout de magasin — ont été tranchés
et construits le 22 août 2026 : voir les deux sections suivantes.)

# L'administrateur d'entreprise supprime les comptes de son entreprise (22 août 2026)

Décision de Julien, à ma question restée ouverte depuis la veille. Jusqu'ici il
ne pouvait que **retirer les accès** (`ca_remove_supervisor`) : le compte
survivait, sans magasin ni équipe, et sa suppression réelle supposait de nous
écrire — `admin_delete_user` est réservé à Quantinvo. Pour une entreprise qui
voit passer des saisonniers, c'était une file d'attente chez nous pour un geste
qui la regarde.

`ca_delete_user` (migration `20260822120001`), gardée par `is_company_admin()`
— donc l'exigence aal2 conditionnelle voyage avec. Trois bornes, arrêtées le
même jour et à ne pas relâcher :

- **Compteurs et superviseurs seulement.** Jamais soi-même, jamais un autre
  administrateur d'entreprise, jamais un compte hors de l'entreprise : ces cas
  restent chez Quantinvo, comme c'est déjà la règle du retrait des accès. Sans
  cette borne, deux administrateurs fâchés s'effacent l'un l'autre.
- **La suppression réussit même si la personne a compté**, et c'est le point
  qu'il faut savoir avant de la déclencher : les comptages sont conservés mais
  **détachés** (`on delete set null`, migration `20260818000001`), donc un
  inventaire clôturé garde ses chiffres justes mais **son rapport ne dira plus
  qui a compté ces lignes**. La confirmation le dit en toutes lettres.
  L'alternative — refuser la suppression aux personnes ayant compté — a été
  écartée : la plupart des comptes ont compté, le droit aurait été décoratif.
- **Immédiate.** Pas de délai de grâce. Le motif d'origine — `pg_cron` n'était
  pas installé, une suppression différée ne se serait jamais exécutée — a
  disparu le 28 août 2026 avec la planification de la purge. **La décision, en
  revanche, tient toujours** : le geste délibéré est demandé à l'écran, pas au
  calendrier. Un compte qu'on supprime doit disparaître quand on le dit.

Chaque suppression est journalisée dans `company_audit_log`
(`action = 'compte_supprime'`), **l'identité figée avant le `delete`** — après,
ni le profil ni l'adresse n'existent et le journal n'aurait qu'un identifiant à
montrer dans un an.

Côté écran (`/equipe`, le site seulement — l'app mobile ne montre pas les
superviseurs, y porter ce droit supposerait d'abord d'y porter l'écran
d'administration) :

- **La confirmation exige la recopie du nom** (`requireText` de
  `ConfirmDialog`). « Supprimer le compte » est à deux centimètres de
  « Retirer les accès » et n'a rien de commun avec lui ; un clic de travers ne
  doit pas suffire. Au passage, les quatre `window.confirm()` de la page sont
  passés à la même modale : deux boutons voisins dont l'un ouvre une boîte de
  dialogue du navigateur et l'autre une modale du produit, cela se voit.
- **Un bloc « Compteurs · autres magasins »** liste les compteurs de
  l'entreprise que la liste par magasin ne montre pas. Sans lui le droit serait
  décoratif : un administrateur de siège ne supervise aucun magasin, donc ne
  voyait aucun compteur. Le **retrait** d'un magasin, lui, reste le geste de
  leur superviseur — d'où la seule action de suppression sur ces lignes.
- Le bouton n'apparaît jamais sur sa propre ligne ni sur celle d'un autre
  administrateur : ils vivent dans la branche `!m.is_company_admin`, celle qui
  porte déjà le retrait des accès.

Vérifié en base le 22 août 2026, session simulée par `request.jwt.claims` : les
quatre refus répondent juste (soi-même, autre entreprise, administrateur
Quantinvo, cible nulle), un superviseur ordinaire est refusé, et le chemin
nominal — essayé **en transaction annulée** sur le compte de test
`jthiongkay+supc` — supprime bien compte, profil, affectations et
participations aux inventaires, en laissant au journal le nom figé, l'auteur et
l'adresse. Le compte était intact après l'annulation.

**Non vu à l'écran** : `/equipe` demande une session connectée, que je n'ai
pas. Seuls les tests, le typage, le lint et `next build` valident le rendu, en
plus de la maquette validée avant codage :
https://claude.ai/code/artifact/ee37b309-0266-4c3d-b890-c38979989132

Tests de garde : `web/tests/admin-entreprise.test.ts`, bloc « supprimer un
compte de son entreprise ». Le test de `navigation.test.ts` qui vérifiait que
« Retirer » n'est réservé à personne a été **amendé, pas affaibli** : la garde
porte désormais sur ce qui précède la suppression, le retrait d'un magasin
restant ouvert à tout superviseur.

# Renommer un magasin, renommer une entreprise (23 août 2026)

*« Les comptes admin doivent pouvoir renommer un magasin et entreprise. »*
Rien ne le permettait : un nom saisi de travers au moment du devis, ou une
enseigne qui change, obligeait à **supprimer et recréer** — c'est-à-dire à
perdre les inventaires du magasin.

Migration `20260823140001`, quatre fonctions, **deux par autorité** : les deux
ont de bonnes raisons de renommer. Quantinvo corrige ce qu'il a saisi
(`admin_rename_company`, `admin_rename_store`, journal `admin_audit_log`),
l'entreprise cliente porte son propre nom (`ca_rename_company`,
`ca_rename_store`, journal `company_audit_log`).

- **⚠️ Renommer ne touche à rien d'autre.** Code d'accès, licence, inventaires
  et comptages sont attachés à l'identifiant, jamais au nom. Les documents déjà
  émis — devis, factures Stripe — gardent le nom qu'ils portaient : ce sont des
  pièces datées, elles ne se réécrivent pas.
- **`nom_propre(text)`** détoure, refuse le vide et borne à 80 caractères. Une
  seule définition pour les quatre fonctions.
- **⚠️ La garde du client porte sur l'entreprise DU MAGASIN**, jamais sur un
  paramètre de l'appelant — sinon on renomme le magasin d'un autre client.
  Même règle que `ca_store_detail`.
- **Deux magasins d'une même entreprise ne portent pas le même nom** (comparé
  en minuscules) : ils ne se distingueraient plus, ni dans une liste ni dans un
  devis. Même règle qu'à l'ajout.
- **Le même nom deux fois répond `already: true`**, pas une erreur.
- **Le journal garde le nom d'avant** (`details.avant`) : « renommé en X » sans
  le nom précédent ne dit pas ce qu'on a perdu.

Côté écran, `components/ui/Renommer.tsx`, le même geste aux quatre endroits :
un lien « Renommer » à côté du nom, qui devient un champ sur place, avec
Entrée pour valider et Échap pour annuler. **Pas de modale** — on renomme ce
qu'on a sous les yeux, et c'est réversible d'un second renommage. Un refus du
serveur (doublon, nom vide) **reste sous le champ** le temps qu'on corrige,
plutôt que dans une notification qui s'efface.

Les quatre points d'entrée : la fiche entreprise de la console (titre + chaque
magasin), la fiche d'un magasin côté client, et le tableau de bord de
l'entreprise pour son nom.

⚠️ **Le garde-fou du journal balayait la mauvaise migration.** Il ne lisait
que `20260818000003_journal_actions_admin.sql` : une fonction `admin_*` écrite
plus tard vivait dans son propre fichier et passait sans trace. Il balaie
maintenant **toutes** les migrations.

Vérifié en base, en transactions annulées : nom vide refusé, nom trop long
borné, magasin d'une autre entreprise refusé, administrateur Quantinvo refusé
sur les fonctions client, et les deux renommages réels avec le journal portant
le nom d'avant. À l'écran (route jetable, retirée) en clair et en sombre : le
lien, le champ présélectionné, le refus sous le champ.

Tests de garde : `web/tests/admin-entreprise.test.ts` et
`web/tests/journal-admin.test.ts`.

# Refonte de « Mon équipe », côté administrateur d'entreprise (23 août 2026)

*« La page équipe de l'admin entreprise n'est pas logiquement bien
sectionnée. »* Elle s'était construite par couches. Maquette validée avant
codage : https://claude.ai/code/artifact/33d0abae-d861-425c-baa4-4517abc7a914

Six défauts, dont un qui n'était pas qu'une question de rangement :

1. **deux portes pour ajouter des gens** — un bouton « Ajouter un compteur »
   dans l'en-tête, un formulaire « Inviter un superviseur » déplié en
   permanence au milieu de la page ;
2. **ce formulaire coupait les deux listes**, qui ne se lisaient jamais l'une
   après l'autre ;
3. **la recherche et le filtre magasin ne couvraient que les compteurs** ;
4. **deux dessins pour la même chose** — cartes `store-block` pour les
   superviseurs, `req-row` pour les compteurs, reste du rangement par magasin ;
5. **les invitations reléguées tout en bas**, après tout le reste ;
6. **⚠️ `AddCounter` envoyait `storeIds: []`**, et une liste vide veut dire
   *tous les magasins du superviseur* — donc, pour un administrateur
   d'entreprise, **l'entreprise entière** à chaque compteur ajouté d'ici.

Le découpage retenu : **invitations en attente en tête**, puis une seule
section **Membres** avec recherche, filtre magasin et filtre type de profil.

- **Les invitations passent devant parce qu'elles attendent** — même règle que
  « Ventes en cours » sur /admin. La section disparaît quand il n'y en a
  aucune ; le bloc du bas ne sert plus qu'au superviseur ordinaire.
- **Le rôle est une pastille (`.pill-role`), pas une section.** Dans une liste
  unique il devient ce qui distingue les gens : il doit se repérer d'un coup
  d'œil. Pastille neutre, pour ne voler la vedette ni à « Admin » (accent) ni
  à « Mot de passe à créer » (ambre). L'ordre reste celui du serveur.
- **⚠️ Le filtre par magasin ne cache pas les administrateurs** : ils les ont
  tous par construction, les retirer d'une liste filtrée laisserait croire
  qu'ils n'y travaillent pas.
- **Une seule porte d'ajout** (`AjouterPersonne`, qui remplace `InviteForm` et
  `AddCounter` pour l'administrateur), le rôle sur deux cartes plutôt qu'un
  menu — ce n'est pas un réglage parmi d'autres, c'est ce qui décide de la
  fonction appelée et de l'obligation d'un magasin. **Les magasins sont
  demandés dans les deux cas** : c'est ce qui ferme le défaut 6.
- **Sa propre ligne et celle d'un autre administrateur ne portent aucune
  action** (`intouchable`) : ces comptes restent chez Quantinvo, et l'écran le
  dit — « Géré par Quantinvo » — plutôt qu'un bouton qui refuserait.
- **Le superviseur ordinaire garde son rangement magasin par magasin** : c'est
  ainsi qu'il travaille, un saisonnier part d'un magasin et pas de tous.

## Un compteur compte pour quelqu'un — le superviseur d'abord

*« Ajout membre par admin entreprise, compteur : l'admin doit préciser qui est
le superviseur, puis sélectionner le magasin, liste magasin = liste magasin
superviseur. »* Maquette :
https://claude.ai/code/artifact/3c19c9ed-11f9-4d68-887a-ca5f8b41eb03

Le panneau d'ajout enchaîne désormais **rôle → identité → superviseur →
magasins**, et les deux champs qui dépendent l'un de l'autre sont voisins.
Avant, l'administrateur cochait n'importe quel magasin de l'entreprise — y
compris un magasin que **personne ne supervise**. Le compteur existait alors
sans apparaître dans le « Mon équipe » de qui que ce soit.

⚠️ **Le superviseur choisi ne s'enregistre nulle part** (option A, tranchée
par Julien). *« Le superviseur d'un compteur » n'existe pas en base* : un
compteur appartient à des magasins, un superviseur aussi, et c'est le magasin
qui les relie. Ce menu ne fait que **restreindre la liste en dessous**. Si le
superviseur quitte le magasin, le compteur y reste et passe sous la
responsabilité de celui qui le reprend — on encadre un magasin, pas des
personnes. Ne pas ajouter de colonne « superviseur » à `profiles` ou à
`team_invitations` en croyant compléter ce travail : c'est l'option B, elle a
été écartée.

- **Un superviseur qui n'a qu'un magasin le voit coché d'office** — la
  question a déjà sa réponse. Même règle que la création d'inventaire dans
  l'application.
- **L'administrateur figure dans la liste**, avec « tous les magasins » : dans
  une petite structure c'est lui qui encadre, l'écran ne doit pas l'obliger à
  nommer quelqu'un d'autre.
- **Le rôle Superviseur n'affiche pas ce menu** : un superviseur ne compte
  pour personne. Sa liste reste celle de tous les magasins de l'entreprise.
- **Un magasin absent de la liste se dit** — « … ne les supervise pas » —
  sinon on cherche un défaut là où il y a une règle.
- **Une entreprise sans aucun superviseur ne peut pas recevoir de compteur**,
  et le panneau le dit avec le geste qui débloque (« Inviter un superviseur »,
  qui bascule le rôle).
- **⚠️ Un magasin est désormais exigé pour les deux rôles.** La liste vide
  voulait dire « tous les magasins du superviseur » : depuis l'écran d'un
  administrateur, cela donnait l'entreprise entière à chaque compteur ajouté.

Vu à l'écran (route jetable rendant le vrai panneau, retirée — `git status`
contrôlé), clair et sombre : les quatre états (superviseur non choisi, deux
magasins, un seul coché d'office, entreprise sans superviseur).

## Affecter un magasin à un compteur (`ca_set_counter_stores`)

Migration `20260823130001`. Il n'existait que `remove_counter_from_store` : on
pouvait retirer un compteur d'un magasin, jamais lui en donner un. Un compteur
retiré de son dernier magasin devenait donc **invisible partout** — les listes
se lisent magasin par magasin — donc irrécupérable, et impossible à promouvoir
puisqu'un superviseur a toujours au moins un magasin. Vu en vrai le même jour.

Miroir de `ca_set_supervisor_stores`, à une différence volontaire : **un
compteur sans magasin est un état normal**, la liste vide n'est pas refusée.
⚠️ Deux tables (`store_supervisors` / `store_team`), donc deux fonctions —
mais **un seul geste à l'écran** : `changerMagasins` route selon le rôle.

## Deux corrections de feuille de style

- **`.toolbar select { width: auto }`** — la règle groupée mettait `width:
  100%` sur les champs *et* les menus. Avec deux filtres dans la même barre,
  les trois contrôles s'empilaient. Un filtre se dimensionne sur son contenu.
- **`.dash-sub-compte` / `.dash-sub-n`** — un titre de section qui porte un
  compte, et « x sur y » avec « Effacer les filtres » dès qu'un filtre est
  actif. `.dash-sub` reste un simple libellé partout ailleurs.

Vu à l'écran (route jetable rejouant le vrai rendu, retirée — `git status`
contrôlé), clair et sombre : les trois sections, les filtres sur une ligne, le
panneau dans les deux rôles, et « Membres · 2 sur 5 » sur un filtre actif.

Tests de garde : `web/tests/admin-entreprise.test.ts`, bloc « refonte de
“Mon équipe” ».

# Changer le rôle d'un membre : superviseur ⇄ compteur (23 août 2026)

Demande de Julien. Il n'existait **aucun chemin** : `profiles.role` est figé
par le déclencheur `profiles_pin_privileged` pour `authenticated`, et les
seules fonctions qui l'écrivaient étaient `handle_new_user` (à l'inscription)
et la console Quantinvo. Une personne embauchée compteur puis promue chef de
rayon devait donc être supprimée et réinvitée — en perdant au passage
l'attribution de ses comptages.

`ca_set_user_role(p_user, p_role, p_store_ids default null)`, migration
`20260823120001`, gardée par `is_company_admin()`. Les deux gestes sont sur
/equipe, un lien par ligne : « Passer compteur » chez les superviseurs,
« Passer superviseur » chez les compteurs.

⚠️ **Le rôle ne se change pas seul : les affectations suivent.** Un
superviseur est rattaché par `store_supervisors`, un compteur par
`store_team`. Écrire `profiles.role` sans déplacer les lignes donnerait
quelqu'un qui a un rôle et **ne voit rien** — l'impasse exacte que la règle
« un superviseur a au moins un magasin » avait fermée le matin même. La
personne garde donc ses magasins dans les deux sens, seule la table change.

Trois refus, tous nécessaires :

- **soi-même** — un administrateur qui se rétrograde enferme son entreprise ;
- **un autre administrateur d'entreprise** — son rôle et son drapeau se
  tiennent, et ils se gèrent chez Quantinvo (même règle que
  `ca_remove_supervisor` et `ca_delete_user`) ;
- **une promotion sans magasin** — la règle du matin. Le message dit quoi
  faire : affecter un magasin d'abord.

Ce qui ne bouge pas, et n'a pas à bouger : les comptages (`counts.counted_by`),
les inventaires créés (`inventory_sessions.created_by`) et les participations
(`session_members`). `delete_session` prévoyait déjà le créateur rétrogradé —
« une rétrogradation en compteur retire le droit avec le rôle ».

**Pas de recopie du nom** dans la confirmation, contrairement à la
suppression : c'est réversible d'un clic. Elle dit en revanche les deux
conséquences qui se remarquent — les magasins qui suivent, et ce que la
personne pourra ou ne pourra plus faire.

**Deux actions au journal plutôt qu'une** (`promu_superviseur`,
`retrograde_compteur`) : « rôle modifié » obligerait à ouvrir le détail.
⚠️ Le garde-fou des libellés balaie les migrations à la regex et **ne voit pas
un `case … end`** : les deux libellés sont donc nommés explicitement dans
`web/tests/admin-entreprise.test.ts`.

Vérifié en base, en transactions annulées : les quatre refus (soi-même, autre
entreprise, rôle inconnu, superviseur ordinaire), le second clic
(`already: true`), et les deux sens sur les données réelles — un compteur à
1 magasin devient superviseur de ce magasin, un superviseur à 1 magasin
devient compteur de ce magasin, journal écrit dans les deux cas. Et à l'écran
par route jetable (retirée, `git status` contrôlé), clair et sombre.

Tests de garde : `web/tests/admin-entreprise.test.ts`.

# Quantinvo peut enfin supprimer un compte (23 août 2026)

Constat de Julien : *« Quantinvo sur le site ne peut supprimer personne. »*
Vérifié, et c'était exact. `admin_delete_user` existe depuis le 18 août
2026 — gardée par `is_admin()`, journalisée, identité figée avant le
`delete` — mais **le seul bouton qui l'appelait** était sur une *demande* de
suppression déposée par la personne elle-même (/admin/console). La section
« Personnes » de la fiche entreprise était une liste de lecture, sans aucune
action. Autrement dit : la console pouvait effacer une **entreprise entière**,
pas un compte.

Le geste est posé là où on regarde les gens : `/admin/entreprise/<id>`,
section « Personnes », un lien rouge par ligne. Aucune RPC nouvelle, aucune
migration — seulement le bouton qui manquait.

- **La recopie du nom est exigée** (`requireText`), comme sur /equipe. Ce
  bouton est à quelques centimètres d'une simple liste, et la suppression est
  irréversible. C'est aussi pourquoi il ouvre la **modale du produit** et non
  un `confirm()` du navigateur comme le reste de cette page : `window.confirm`
  ne sait pas exiger un geste délibéré. ⚠️ Les six autres confirmations de
  cette page sont restées natives — incohérence connue, à reprendre.
- **La confirmation dit ce qui reste** : les comptages sont conservés mais
  détachés, donc le nom disparaît des rapports déjà faits ; inventaires et
  invitations sont détachés eux aussi.
- **Supprimer un administrateur d'entreprise ajoute une ligne** : sans lui,
  l'entreprise n'a plus personne pour gérer ses superviseurs — et elle remonte
  dans « À traiter » sur /admin. Autant le dire avant.

⚠️ **`admin_delete_user` ne se refuse à personne**, contrairement à
`ca_delete_user` (qui refuse soi-même et les autres administrateurs). Ce n'est
pas atteignable depuis ce bouton — un administrateur Quantinvo n'a pas de
`company_id`, il ne figure donc dans aucune fiche entreprise. À garder en tête
si un jour la console liste les personnes autrement que par entreprise.

Vu à l'écran (route jetable `/tmp-polish`, retirée — `git status` contrôlé),
clair et sombre : la ligne, la modale, la recopie du nom, et la cinquième
puce sur un administrateur d'entreprise.

Tests de garde : `web/tests/console-admin.test.ts`.

# L'espace de l'administrateur d'entreprise (22 août 2026)

Julien : *« il voit tout et tout le monde dans son entreprise, il sait qui fait
quoi (console comme admin Quantinvo), il gère les membres quel que soit le
niveau, il gère les magasins, il peut consulter les inventaires et les gérer
aussi. C'est le maître ; au-dessus de lui il y a l'admin Quantinvo. Exemple :
le chemin “mon espace” ne mène pas vers inventaire pour lui, ce n'est pas sa
priorité. »*

**La définition qui a servi de règle** : son autorité vient de son rôle, pas
d'une affectation, et il administre — il ne fait pas le travail. Les
inventaires sont ceux de ses superviseurs.

Trois manques constatés avant d'écrire, et c'est le diagnostic qui compte :

1. **Il ne voyait pas les inventaires de son entreprise** auxquels il n'avait
   pas été invité. Ses droits de clôture, réouverture et suppression existaient
   déjà (migrations `20260821250001/2`) — c'était la *lecture* qui manquait.
2. **`company_audit_log` n'était affiché nulle part.** Il se remplit à chaque
   action depuis le 20 août ; « il sait qui fait quoi » n'avait aucun écran.
3. **Aucune vue d'ensemble** : son entreprise ne se lisait qu'en ouvrant les
   inventaires un par un.

Migration `20260822160001`, maquette validée avant codage :
https://claude.ai/code/artifact/ad0f725e-f87d-4c37-856a-4bae82d0a6c9

## Sa barre, et son atterrissage

`Tableau de bord · Magasins · Équipe · Inventaires · Journal`, et
`homePathForRole` le pose sur `/entreprise`. C'est la charpente de la console
Quantinvo à son échelle : l'état, le patrimoine, les personnes, le travail, la
trace.

**« Boîte à outils » a quitté sa barre** pour le menu de son avatar : imprimer
des balises est un geste de terrain, occasionnel pour lui. Elle reste un onglet
pour un superviseur ordinaire. Cinq onglets est la limite avant que la barre ne
passe sur deux rangs (elle le fait sous 900 px).

## Une ligne ouvre tous les inventaires

`is_session_participant` gagne `or public.is_company_admin(s.company_id)`.
**C'est le point de passage unique** : cette fonction garde la policy de lecture
d'`inventory_sessions` *et* `can_access_session`, dont dépendent comptages,
zones, audits, rapports et membres. Une ligne ouvre tout, de façon cohérente ;
la même règle dispersée dans quinze policies aurait garanti un oubli. Même
levier que `store_supervisors` pour les magasins, le matin même.

Conséquence à l'écran : `/dashboard` ne coupe plus sa liste en
« Mes inventaires / Inventaires invités » — ce sont ceux de son entreprise.

## Le tableau de bord, rangé par magasin

Demande de Julien : *« ranger les 3 blocs par magasin, comme pour la page
entreprise de l'admin Quantinvo »*. Les chiffres en tête, puis un bloc par
magasin portant ce qui est à lui : ses alertes, ses inventaires, son équipe.

- **Les alertes se calculent dans `web/lib/entreprise.ts`, pas en SQL.** Ce sont
  des règles de jugement (« neuf jours, c'est long ») : elles changeront plus
  souvent que la requête, et elles se testent sans base ni navigateur. Les
  seuils sont réunis dans `SEUILS` — ils se discutent, ils ne se devinent pas.
- **Un magasin qui tourne ne produit aucune alerte** et n'affiche donc aucun
  bandeau : c'est ce silence qui donne du poids aux autres.
- **`ca_company_overview` ne calcule pas l'avancement** : ce serait reparcourir
  zones et balises de chaque inventaire ouvert à chaque ouverture de page — le
  motif retiré pour la tenue en charge le 21 août. Elle rend les pièces
  comptées et le stock théorique attendu ; l'écran en tire une proportion
  **quand un fichier attendu existe**, et n'affiche rien sinon. Un pourcentage
  inventé serait pire que pas de pourcentage.
- **L'administrateur n'apparaît pas comme superviseur de chaque magasin** dans
  ces blocs : il les supervise tous depuis le matin, le répéter partout ne
  dirait rien de qui tient réellement le magasin.

⚠️ **Le journal reste global, et c'est un constat, pas un choix de mise en
page** : rien de ce que `company_audit_log` enregistre ne porte de magasin —
inviter un superviseur, retirer un accès, supprimer un compte, demander un
magasin. Le ranger par magasin supposerait d'abord de l'écrire autrement.

## Le journal

`ca_list_audit_log` (bornée à 500 lignes quoi qu'on demande) et l'écran
`/journal`. **Les libellés de `web/lib/journal.ts` sont des participes sans
auxiliaire** — « invité Marc », pas « a invité Marc » : c'est ce qui permet
d'écrire « Julien a invité » et « Vous avez invité » sans deux tables, et ce
qui a corrigé le « Vous a invité » du premier jet. Une action sans libellé
s'affiche en clair plutôt que de disparaître, **et un test échoue** si une
fonction `ca_*` journalise une action qu'aucun libellé ne couvre.

## L'équipe se lit personne par personne

Pour lui seulement : la liste part des personnes, avec leur rôle, leurs
magasins (retirables), leur dernier comptage et le nombre d'inventaires
comptés, plus une recherche et un filtre par magasin. Le bloc « Compteurs ·
autres magasins » ajouté le matin n'a plus d'objet — cette liste couvre toute
l'entreprise. Un superviseur ordinaire garde son rangement par magasin : c'est
ainsi qu'il travaille, un saisonnier part d'un magasin et pas de tous.

## Vérifications

En base, en transaction annulée : `ca_company_overview` rendue sur les données
réelles d'Entreprise C (4 magasins, 2 inventaires ouverts, superviseurs,
compteurs), refus opposé à un superviseur ordinaire, `anon` refusé partout.

Au navigateur, par **route jetable** (`/tmp-polish`, retirée ensuite — vérifier
au `git status`) : les blocs magasin en clair et en sombre. Un défaut trouvé
ainsi et corrigé : `.mag .signal` est plus spécifique que `.signal-alerte`,
l'ambre des alertes était donc écrasé et elles se lisaient comme des lignes
ordinaires — d'où le `:not(.signal-alerte)`.

**Non vu à l'écran** : les pages complètes `/entreprise`, `/journal` et
`/equipe` demandent une session d'administrateur d'entreprise.

## Second passage, le même jour

Retour de Julien sur le premier jet : *« réduire la taille des tuiles pour que
ça tienne sur une ligne, liste magasins collapsable nom magasin en en-tête et
placer cette section dans page Magasins, bouton ouvrir le magasin mène à page
du magasin en question — son profil — où on trouve son code, ses membres, ses
inventaires, place activités récentes sous tableau de bord. La page magasins de
l'admin entreprise doit s'inspirer de la page entreprises de l'admin
Quantinvo. »*

- **Le tableau de bord ne porte plus que deux blocs** : les cinq indicateurs
  (`.dash-kpis-5`, qui rétrécit les tuiles au lieu de les casser sur deux
  rangs — repasse à trois colonnes sous 1040 px) et l'activité récente.
- **Les magasins ont déménagé sur `/magasins`**, chacun dans un `Volet` —
  replié, nom en en-tête, résumé et pastille (« 2 à surveiller » / « À jour »).
  Les règles du composant s'appliquent : rien ne s'ouvre tout seul, et
  l'en-tête doit dire ce qu'il y a dedans, sinon on n'a fait que déplacer le
  mur.
- **La page reprend la figure de `/admin/entreprises`** : compte dans le titre,
  recherche par fragments (« lyon part » trouve « Magasin Lyon Part-Dieu »),
  une fiche derrière chaque ligne. ⚠️ **Elle garde deux lectures** : un
  superviseur ordinaire y vient relever un code d'accès, il ne doit pas
  hériter de la console.
- **`/magasins/[storeId]`, la fiche d'un magasin** : son code, ses membres,
  ses inventaires. `ca_store_detail` (migration `20260822170001`) rend
  l'historique complet — la liste, elle, n'affiche que les inventaires ouverts
  et le dernier clôturé. **L'activité d'un compteur y est celle de ce
  magasin** : quelqu'un qui compte beaucoup ailleurs n'y est pas actif pour
  autant. La garde porte sur l'entreprise **du magasin visé**, jamais sur un
  paramètre de l'appelant.
- `CorpsMagasin` est partagé par la liste et la fiche : deux écrans qui
  montrent la même chose doivent la montrer de la même façon.

Deux doublons évités au passage, et c'est le genre que Julien repère :
`depuis()` refaisait `relativeTime()` de `lib/format` (avec un « il y a 3
jours » là où le site dit « il y a 3 j »), et `nb()` était recopié dans quatre
pages — il a rejoint `lib/format`.

Vérifié au navigateur (route jetable, clair et sombre) : les cinq tuiles sur
une ligne, les volets repliés, un volet ouvert. Un défaut corrigé ainsi —
« Ouvrir le magasin » s'étirait sur toute la largeur, un bouton dans une
colonne flex prenant toute la place.

Tests de garde : `web/tests/espace-admin-entreprise.test.ts`.

# L'administrateur d'entreprise supervise tous les magasins (22 août 2026)

Précision de Julien, capture à l'appui : son compte d'administrateur affichait
« Vous n'êtes affecté à aucun magasin », et l'écran l'invitait à s'en affecter
un depuis /equipe. C'était la lecture inverse de la règle — **il les a tous, par
construction**. Rien à s'affecter.

**Le levier est l'affectation, pas l'affichage.** Tout ce que voit un
superviseur — ses magasins, son équipe, ses inventaires, sur le site comme dans
l'application — se lit dans `store_supervisors` (`get_my_stores`,
`my_team_by_store`, les tableaux de bord). Rendre l'affectation vraie corrige
tous les écrans d'un seul geste ; ajouter partout une condition « ou bien il est
administrateur » aurait multiplié les endroits où l'oublier. Migration
`20260822150001`.

Deux déclencheurs tiennent l'invariant dans le temps, et couvrent aussi les
chemins qu'on écrira demain :

- `stores` **après insertion** → tous les administrateurs de l'entreprise
  prennent le nouveau magasin (console Quantinvo comme demande de magasin) ;
- `profiles` **après insertion ou changement** de `is_company_admin` /
  `company_id`, avec un `when` — le déclencheur ne se réveille pas sur une
  modification de prénom — → le nouvel administrateur prend tous les magasins
  (promotion par `invite-company-admin` comme profil créé par
  `handle_new_user` sur invitation).

Plus le rattrapage de l'existant dans la même migration, sans quoi l'invariant
ne vaudrait que pour les magasins créés après.

**Deux refus le protègent, et ils sont nécessaires** : les déclencheurs ne
réparent pas un retrait — ils ne se réveillent qu'à la création ou à la
nomination. Sans eux, une croix sur /equipe rendrait l'invariant faux en
silence.

- `ca_set_supervisor_stores` refuse un profil `is_company_admin` ;
- `admin_unassign_supervisor` (console Quantinvo) aussi, en disant la marche à
  suivre : retirer d'abord le rôle d'administrateur.

Côté écrans : /equipe montre « Affecté à tous les magasins de l'entreprise (3) »
à la place des pastilles et du sélecteur — une croix qui ne marche pas est pire
que pas de croix ; l'état vide de Magasins (site et application) et celui de Mon
équipe (application) disent « Votre entreprise n'a encore aucun magasin » et
renvoient vers la demande d'ajout.

**Ce qui n'a pas changé** : révoquer le rôle d'administrateur ne retire pas ses
affectations. Il redevient un superviseur ordinaire de tous les magasins, et
c'est alors qu'on peut l'en retirer un par un — l'inverse effacerait au passage
des affectations légitimes d'avant sa nomination.

Vérifié en base le 22 août 2026, en transaction annulée : un magasin créé
affecte l'administrateur (4/4), un superviseur promu prend les quatre, et les
deux retraits sont refusés — celui d'un superviseur ordinaire passant toujours.
Rattrapage contrôlé sur les données réelles : l'administrateur d'Entreprise C
est passé de 0 à 3 magasins, le superviseur ordinaire est resté à 2 sur 3.

Tests de garde : `web/tests/admin-entreprise.test.ts`, bloc « l'administrateur
d'entreprise a tous les magasins ».

# Demander l'ajout d'un magasin (22 août 2026)

Un client ouvre un magasin. Il n'avait **aucun moyen de le dire depuis le
produit** : seul Quantinvo crée un magasin (`admin_add_store`, gardée par
`is_admin()`), parce que **la licence se facture par magasin**. Il fallait
téléphoner. Demande de Julien : un bouton.

**La règle qui porte tout le reste : une demande ne crée pas de magasin.**
`ca_request_store` n'insère que dans `store_requests` ; un test échoue si elle
touche un jour à `stores`. La création reste chez Quantinvo, et le devis reste
une conversation — comme pour une nouvelle entreprise.

Migration `20260822130001`, table `store_requests` (RLS lecture pour
l'administrateur Quantinvo et celui de l'entreprise, **aucune policy
d'écriture**), et six fonctions :

- côté client, gardées par `is_company_admin()` : `ca_request_store`,
  `ca_list_store_requests`, `ca_cancel_store_request` ;
- côté Quantinvo, gardées par `is_admin()` : `admin_list_store_requests`,
  `admin_fulfil_store_request`, `admin_reject_store_request`.

Points à ne pas défaire :

- **`admin_fulfil_store_request` appelle `admin_add_store`**, il ne recopie pas
  la génération du code d'accès. Deux chemins de création divergeraient un
  jour, et le magasin né d'une demande ne serait plus tout à fait un magasin.
  Effet visible et voulu : deux lignes au journal Quantinvo
  (`magasin_ajoute` puis `demande_magasin_creee`).
- **Les deux doublons sont refusés à la saisie** — un magasin qui porte déjà ce
  nom, une demande déjà en cours pour ce nom (comparaison en minuscules, nom
  détouré). Sans cela la même demande arrive trois fois et c'est Quantinvo qui
  fait le tri.
- **Une demande traitée ne se rejoue ni ne s'annule** : `admin_fulfil` refuse
  ce qui n'est plus `pending`, `ca_cancel` ne supprime que du `pending`. Une
  demande traitée est une trace, pas un brouillon.
- **Le motif de refus est repris tel quel sur l'écran du client.** « Refusée »
  tout court laisse l'administrateur d'entreprise sans rien à faire de
  l'information.
- **Purge à un an**, dans `purge_expired_data` comme le reste — mais seulement
  ce qui est traité (`handled_at is not null`) : une demande en attente attend.

Côté écrans :

- **`/magasins`** porte le bouton, pour le seul administrateur d'entreprise, et
  la liste de ses demandes (sans cela la même demande part trois fois). ⚠️ Son
  **état vide a été récrit** : « contactez l'administrateur de votre
  entreprise » s'adressait à l'administrateur de l'entreprise — le piège déjà
  rencontré côté mobile. Il renvoie maintenant vers /equipe, où il peut
  s'affecter un magasin lui-même.
- **`/admin`** fait remonter les demandes en tête de « À traiter » : c'est du
  revenu qui attend, ça passe avant les alertes d'usage. Deux appels au
  chargement plutôt qu'un — `admin_business_overview` est une vue d'affaires,
  pas une boîte de réception.
- **La fiche entreprise** porte « Créer le magasin » et « Refuser », juste
  au-dessus des magasins : une demande précède la création.

## Le formulaire de demande est celui de l'inscription

Correction du même jour, capture de /inscription à l'appui : *« c'est ça qu'il
faut comme formulaire de demande »*. Le premier jet ne demandait qu'un nom — or
**la licence se tarife au volume de stock**. Une demande sans stock est une
demande que Quantinvo ne peut pas deviser, donc un aller-retour de plus.

La carte de saisie (nom, stock théorique, surface, **tranche tarifaire affichée
à la frappe**) est sortie de `/inscription` dans
`web/components/MagasinSaisie.tsx` et sert aux deux écrans. Une seule
définition : les libellés, les unités et la tranche affichée ne doivent pas
diverger entre le parcours d'inscription et la demande. Migration
`20260822140001` (colonnes `units` / `sqm`).

Trois points :

- **Le stock est exigé, la surface non** : le premier donne le prix, la seconde
  ne sert qu'au recoupement.
- **Le recoupement stock / surface ne sort pas de la console.** Comme sur la
  fiche d'une demande d'entreprise : affiché au client, il lui indiquerait quel
  chiffre ajuster pour changer de tranche. La fiche entreprise montre donc
  pièces, m², pièces/m², tranche et prix ; l'écran du client ne montre que la
  tranche de ce qu'il vient de saisir.
- **L'ancienne signature `ca_request_store(text, text)` est supprimée**, pas
  laissée à côté de la nouvelle : Postgres garderait les deux et un appel à deux
  arguments deviendrait ambigu.

Vérifié en base le 22 août 2026, sessions simulées par `request.jwt.claims`,
**tout en transactions annulées** : demande créée, les trois refus de saisie
(doublon de demande, doublon de magasin, nom vide), refus opposé au superviseur
ordinaire comme aux deux fonctions Quantinvo, création réelle du magasin avec
son code, statut `created` relié au magasin, journaux des deux côtés, rejeu
refusé, et le motif de refus bien visible côté client. Aucune ligne résiduelle,
`anon` refusé sur les six fonctions. Le volume voyage bien (180 000 pièces,
1 200 m²), le stock manquant, nul ou absurde est refusé, et il ne reste qu'une
seule signature de `ca_request_store`.

**La carte de saisie, elle, a été vue au navigateur** : /inscription est
publique, donc la sortie du composant a pu être vérifiée pour de vrai — mise en
page identique, et la tranche s'affiche toujours à la frappe (180 000 →
« Grande surface — 50 001 à 200 000 · 6 600 € / an », total mis à jour).

### Passe de finition, sur capture de Julien (« barre de saisie à revoir »)

Le formulaire vu en production a montré quatre défauts, dont deux qui ne
tenaient pas à cet écran :

- **Le champ « nom du magasin » n'avait jamais eu d'habillage.** `.magasin-top
  input` ne portait qu'un `flex: 1` : dans la carte de 520 px de /inscription
  cela passait presque, dans l'espace connecté (1120 px) il devenait une barre
  d'un autre monde que les deux champs juste dessous. Il reprend exactement
  `.field input`.
- **Les champs étaient de la couleur de leur carte** (`--bg` sur `--bg`) : ils
  ne se lisaient que par leur filet. Ils passent à `--surface`, dans les deux
  thèmes.
- **Le formulaire prenait les 1120 px de l'espace connecté** — 150 caractères
  par ligne pour l'introduction, 1700 px pour un nom de vingtaine de signes.
  `.demande-magasin` le ramène à 560 px, la largeur utile de la carte
  d'inscription dont il est repris, **centré dans la page** (demande de Julien).
  La liste des demandes en cours, elle, reste alignée à gauche sur toute la
  largeur : c'est une liste d'enregistrements, comme celle des magasins
  au-dessus.
- **La pastille de rang a disparu quand il n'y a qu'un magasin** (`numero`
  devient facultatif) : numéroter un élément unique n'apprend rien.

Deux corrections systémiques au passage, valables pour tous les formulaires du
site : un **anneau de focus** (`box-shadow`) là où seul le changement de
bordure signalait le focus malgré `outline: none`, et la ligne de tranche
passée de `--text-3` à `--text-2` — 2,9:1 sur le fond de la carte, sous le
seuil AA, à l'endroit précis où l'on lit le prix. Les zones de texte ne se
redimensionnent plus qu'en hauteur.

Vérifié au navigateur, clair et sombre, par une **route jetable** rendant le
formulaire hors session (`/tmp-polish`, retirée ensuite — vérifier au
`git status` qu'elle n'est pas restée).

**Non vu à l'écran** : `/magasins` et la console demandent une session
connectée. Maquette validée avant codage :
https://claude.ai/code/artifact/1b6dfbe0-6866-4af9-a5ab-c6e6b1188231

### Une demande aboutie quitte l'écran du client, et se dit par e-mail

Constat de Julien, capture à l'appui : « Alltricks — Magasin créé » restait
affiché sous « Demandes de magasin », alors que le magasin avait été créé puis
supprimé (c'était un essai). La liste montrait une trace sans objet, sous un
titre qui annonce des demandes en cours.

Règle posée (migration `20260822200001`) : **la liste du client ne garde que ce
sur quoi il peut encore agir** — les demandes en attente, qu'il annule, et les
refusées récentes, dont il doit lire le motif. Les demandes abouties
(`created`, `removed`) sortent de l'écran : le magasin apparu — ou disparu —
dans la liste juste au-dessus est la confirmation. **La trace ne bouge pas** :
la ligne reste en base, visible 90 jours dans la console Quantinvo, purgée à un
an comme les journaux. On cesse d'afficher, on n'efface pas.

Deux e-mails accompagnent le parcours, par deux fonctions edge :

- `ca-request-store` — accusé de réception, à l'envoi de la demande ;
- `admin-fulfil-store-request` — « votre magasin est créé », quand Quantinvo
  crée.

Quatre points à ne pas défaire :

- **Elles n'ajoutent aucun droit.** Chacune appelle sa RPC **avec le jeton de
  l'appelant** (`is_company_admin()` / `is_admin()`, exigence aal2 comprise).
  Une création jouée en `service_role` contournerait toute la garde.
- **Le code d'accès du magasin ne part jamais par e-mail** : il ouvre l'entrée
  dans le magasin. Le message renvoie vers la fiche, où il se lit derrière une
  session. `admin_fulfil_store_request` ne le met pas non plus dans son objet
  `notify`.
- **Un e-mail qui ne part pas n'annule rien.** La ligne est déjà écrite quand
  on envoie : l'échec se dit (`emailed: false`), il ne fait pas croire que
  rien n'a été fait.
- **Les deux écrans retombent sur la RPC directe** si l'edge est injoignable —
  une demande qui passe sans accusé vaut mieux qu'une demande qui ne passe pas.

**Le refus part aussi par e-mail**, motif compris (ajouté dans la foulée, à la
demande de Julien) : `admin-reject-store-request`, et l'objet `notify` sur
`admin_reject_store_request` (migration `20260822210001`). Deux points : le
motif **voyage tel quel** — c'est déjà la règle de l'écran, « Refusée » tout
court ne dit pas quoi faire — et `kind` voyage avec lui, parce qu'un refus
d'ajout et un refus de suppression ne se disent pas de la même façon. La
demande refusée reste par ailleurs trente jours sur l'écran du client.

Tests de garde : `web/tests/demande-magasin.test.ts`, bloc « une demande
aboutie quitte l'écran ». Les deux fonctions edge **sont déployées** (22 août
2026) ; toute modification demande un redéploiement, le dépôt ne déploie rien.

## Demander la suppression d'un magasin (même jour)

*« Sur page magasin ajouter bouton de demande de suppression. »* Symétrique de
l'ajout, et pour la même raison : la licence se facture par magasin, donc
Quantinvo reste seul à supprimer comme il est seul à créer. Le bouton vit en
bas de la fiche d'un magasin, la demande s'annule tant qu'elle est en attente.

**Même table**, distinguée par `kind` (`add` / `remove`) : une seule boîte de
réception, une seule purge, un seul écran côté console. Le statut gagne
`removed` — « créé » ne se dit pas d'une suppression. Migration
`20260822180001`.

⚠️ **Un piège trouvé en l'écrivant, et qui existait avant :
`admin_delete_store` échouait.** Elle ne faisait qu'un `delete from stores`, or
`inventory_sessions.store_id` référence `stores` en **NO ACTION** — la
suppression partait donc en violation de clé étrangère dès que le magasin avait
connu un inventaire. **Le bouton « Supprimer » de la fiche entreprise était
cassé pour tout magasin ayant servi**, et une demande de suppression impossible
à honorer aurait été pire. Vérifié à la source : la suppression nue répond
`violates foreign key constraint "inventory_sessions_store_id_fkey"`.

La fonction supprime maintenant les inventaires du magasin d'abord — comme
`admin_delete_company` le fait pour une entreprise — et **les deux écrans le
disent avant** : « Ses inventaires et tous leurs comptages seront effacés. »
Ne pas retirer cette phrase : c'est elle qui rend le geste honnête.

Vérifié en base, en transactions annulées : demande créée, doublon refusé,
suppression honorée sur un magasin **portant un inventaire et des comptages**
(magasin parti, inventaires partis, demande en `removed` et détachée du magasin
disparu, journaux des deux côtés).

Tests de garde : `web/tests/demande-magasin.test.ts`.

# Conformité RGPD / sécurité

Audit complet du 13 août 2026 : 15 manquements relevés (2 critiques, 7 élevés,
6 moyens). Rapport détaillé :
https://claude.ai/code/artifact/0db58594-ff3e-4ad5-91a8-29b85cbb3621

## Traité

- **C1 — présence temps réel** : les canaux sont désormais `private: true` des
  deux côtés, et `realtime.messages` porte deux policies adossées à
  `can_join_session_topic()` (migration `20260813000009`). **Un canal public ne
  consulte aucune autorisation** — c'est le piège : ne jamais recréer un canal
  sans `private: true`, la RLS ne rattraperait rien.
- **M2** — `check_invitation` révoquée à `anon`/`authenticated` (oracle
  d'énumération d'e-mails), `compose_full_name` reçoit un `search_path` figé
  (migration `20260813000010`).
- **E7, partie code** — mot de passe porté à 12 caractères sur `/bienvenue`.
- **M3, renvoi par e-mail** — fonction edge `submit-supervisor-request` :
  elle appelle `submit_supervisor_request_detailed` en `service_role` et écrit à
  l'adresse saisie « vous avez déjà un compte » ou « votre demande est déjà en
  cours ». **« Code inconnu » et « demande créée » partagent le même message**,
  sans nom de magasin : deux textes distincts rouvriraient l'oracle, puisque
  qui essaie des codes utilise sa propre adresse. Déployée en
  `verify_jwt: false` — un formulaire public n'a pas de session — avec la
  limitation de débit comme contrepartie, appliquée avant tout travail. Le
  formulaire retombe sur la fonction publique de la base si l'edge est
  indisponible : la demande passe, sans l'e-mail. C'est la deuxième fonction du
  projet sans vérification de jeton, avec le futur webhook Stripe.
- **M4 — journal des actions d'administration** : table `admin_audit_log`
  (numéro croissant, RLS lecture admin seulement, aucune écriture côté client),
  alimentée par les onze fonctions `admin_*` d'écriture via `log_admin_action`.
  **La trace s'écrit dans la même transaction que l'action** : une action qui
  ne peut pas se journaliser échoue — ne jamais entourer `log_admin_action`
  d'un bloc qui avale les erreurs, et journaliser toute nouvelle fonction
  `admin_*` (test de garde : `web/tests/journal-admin.test.ts`). Les libellés
  (auteur, cible) sont figés au moment de l'action pour survivre aux
  suppressions. Lecture par `admin_list_audit_log`, affichage dans /admin
  (section « Journal des actions »). Conservation 1 an, purgée par
  `purge_expired_data()`. Migration `20260818000003`. Registre : T8.
- **M6 — droits outillés, procédure écrite.** `export_my_data()` (migration
  `20260818000004`) rend à la personne authentifiée un JSON complet de ce qui
  est rattaché à son compte — bouton « Télécharger mes données » sur la page
  Mon compte, annoncé dans la politique. **Aucun code d'accès n'y figure**
  (entreprise, magasin, sécurité) et le détail ligne à ligne des inventaires
  n'y est que résumé : l'employeur en est responsable de traitement, l'export
  le dit et renvoie vers lui. Procédure de violation :
  `docs/conformite/procedure-violation-donnees.md` (72 h, et surtout la
  distinction responsable / sous-traitant — pour les données d'inventaire,
  Devkaylab prévient l'entreprise cliente sans délai, c'est elle qui notifie) ;
  registre des violations à tenir dans `registre-des-violations.md`.
  Tests de garde : `web/tests/mes-donnees.test.ts`.
- **M3, partie sécurité** — `submit_supervisor_request` répond désormais
  **exactement la même chose** pour un code magasin inconnu, un compte déjà
  existant, une demande en cours ou une création réussie
  (`{success: true, received: true}`), et ne renvoie plus le nom du magasin.
  Le détail existe toujours dans `submit_supervisor_request_detailed`,
  exécutable par le **seul `service_role`**. Les erreurs de saisie restent
  explicites : elles ne parlent que de ce que la personne vient de taper.
  `rate_limit_ok` limite les deux formulaires à 5 envois par heure et par
  adresse e-mail, 20 par point de connexion (`submission_attempts`, purgée à
  24 h). Migration `20260818000002`, appliquée en live après essai en
  transaction annulée. **Ne pas réintroduire de message distinct** : c'est
  l'oracle que ce correctif ferme, et deux tests le gardent
  (`web/tests/formulaires-publics.test.ts`). ⚠️ Ce verrou a été **perdu puis
  rétabli** sur le formulaire d'inscription : voir « Un `create or replace` ne
  dit pas ce qu'il fait disparaître », plus bas.
- **M1** — six en-têtes de sécurité posés dans `web/next.config.mjs` (et non
  dans `vercel.json`, pour qu'une règle trop stricte se voie dès le
  développement). La CSP ferme `frame-ancestors`, `object-src`, `base-uri` et
  `form-action`, et n'ouvre `connect-src` que vers Supabase, WebSocket compris.
  **`script-src` garde `unsafe-inline`** : le routeur d'application de Next
  injecte ses scripts d'hydratation en ligne, et `layout.tsx` pose celui du
  thème. S'en passer demande un nonce par requête, donc un middleware, au prix
  du rendu statique — arbitrage ouvert. Vérifié au navigateur : aucune
  violation sur les cinq pages publiques, et une destination externe est bien
  refusée nommément par la CSP. Tests : `web/tests/entetes-securite.test.ts`.
- **E1 / E2, partie effacement** — la suppression de compte **échouait** :
  cinq clés étrangères pointaient `profiles` en NO ACTION, donc supprimer un
  compte ayant compté levait une violation de contrainte. Migration
  `20260818000001` appliquée en live : les comptages se détachent au lieu de
  bloquer, un déclencheur BEFORE DELETE sur `auth.users` efface l'identité
  résiduelle (demandes anonymisées, invitations supprimées), et
  `purge_expired_data()` porte les durées — 3 mois, 1 an, 3 ans — en un seul
  point. ⚠️ **Corrigé le 28 août 2026** : `pg_cron` est installé et la purge
  tourne tous les jours à 03 h 15 UTC — voir « La purge s'exécute enfin toute
  seule » plus bas. Pendant sept semaines, elle n'a jamais été exécutée.
- **E5 / E6, hébergement de la politique** — découvert le 18 août 2026 :
  l'adresse `devkaylab.github.io/Inventaire/privacy.html`, vers laquelle
  pointent l'app et le site, renvoyait **404** — GitHub Pages n'était pas
  activé sur le dépôt. Réactivé (branche `main`, dossier `/docs`). Aucun test
  automatique ne surveille cette adresse : après tout changement de
  configuration du dépôt GitHub, vérifier au moins une fois qu'elle répond.
- **E5 / E6** — `docs/privacy.html` réécrite : les quatre sous-traitants
  (Supabase, Vercel, Resend, **Expo** — les jetons de notification partent vers
  `exp.host`), les transferts hors UE, les finalités et bases légales, les
  durées, le **droit de réclamation auprès de la CNIL**, et la répartition
  responsable / sous-traitant vis-à-vis des entreprises clientes. La mention
  d'information s'affiche **sous chaque formulaire** de collecte
  (`MentionCollecte`), pas seulement en pied de page — volontairement sans case
  à cocher, la base légale n'étant pas le consentement. Des tests gardent le
  tout (`web/tests/confidentialite.test.ts`) : ajouter un prestataire sans le
  déclarer, ou un formulaire sans la mention, fait échouer la suite.
  La politique déclare aussi le suivi nominatif de l'activité (constat E3) —
  restent l'information des salariés, la consultation du CSE et l'AIPD. Elle
  disait franchement que les demandes et invitations n'étaient pas encore
  purgées (E1 / E2). ⚠️ **Récrit le 28 août 2026**, le jour où la purge a été
  planifiée : la section 7 énumère désormais les six durées et dit qu'elles
  s'appliquent automatiquement. Une politique qui annonce un manque déjà comblé
  est aussi fausse qu'une politique qui cache un manque — **la relire à chaque
  fois que les durées bougent**.
- **E4, page en place** — `/mentions-legales` sur le site, alimentée par
  `web/lib/legal.ts`. **L'activité éditrice n'est pas encore immatriculée** :
  tant qu'une mention requise manque, `mentionsCompletes()` est faux, la page
  passe en `noindex` et le pied de page ne l'annonce pas — une identification à
  trous ne vaut pas mieux que pas de page. Remplir les valeurs dans ce seul
  module suffit à tout activer. L'adresse et le téléphone de Vercel sont à
  recopier depuis leurs informations légales : `vercel.com` est bloqué depuis
  l'environnement de l'agent, et ces coordonnées ne se citent pas de mémoire.
- **C2 — `xlsx`** : SheetJS ayant quitté npm, l'archive officielle 0.20.3 est
  versionnée dans `vendor/` et installée en `file:` des deux côtés. Les deux
  failles de la partie lecture (CVE-2023-30533, CVE-2024-22363) sont corrigées,
  et `xlsx` a disparu des deux `npm audit`. **Ne jamais faire
  `npm install xlsx`** : cela ramènerait 0.18.5 en écrasant le `file:` sans
  rien signaler — deux tests montent la garde (`tests/xlsx.test.ts` de chaque
  côté). Procédure de mise à jour : `vendor/LISEZMOI.md`, outillage :
  `scripts/installer-sheetjs.mjs`.

## ⚠️ Un `create or replace` ne dit pas ce qu'il fait disparaître (28 août 2026)

Revue de sécurité du 28 août 2026, dix-huit points passés en revue. Le seul
vrai trou trouvé : **`submit_company_request` avait perdu sa limitation de
débit**, et c'est la fonction publique du formulaire d'inscription — appelable
sans compte, depuis n'importe où.

Le mécanisme mérite d'être retenu, parce qu'il se reproduira. Le durcissement
du 18 août avait posé les deux verrous. Les migrations `20260821210001` (SIREN
et magasins déclarés) puis `20260821230001` (code APE) ont **réécrit la
fonction en entier** pour ajouter des colonnes, sans recopier le bloc. Rien ne
l'a signalé : `create or replace` ne compare pas, il remplace. Relevé en
interrogeant `pg_get_functiondef` sur la définition **en vigueur**, pas sur les
fichiers du dépôt.

Deux conséquences pendant la semaine où le verrou manquait : l'inondation
possible du formulaire (et des accusés de réception qu'il déclenche), et
surtout la réouverture de l'énumération d'adresses — la fonction répond « Une
demande est déjà en cours pour cette adresse » quand elle connaît l'adresse.

Rétabli par `20260828120001`. Trois points à ne pas défaire :

- **Le verrou est placé après la validation de saisie et AVANT la recherche
  par adresse.** Une faute de frappe ne doit pas consommer le quota de
  quelqu'un ; et un script ne doit pas pouvoir interroger la base autant qu'il
  veut avant d'être freiné. L'ordre est ce qui fait le contrôle.
- **La réponse reste différenciée**, contrairement à la version du 18 août qui
  répondait `{success: true, received: true}` dans les deux cas. C'est une
  décision de produit — un client qui a déjà déposé une demande mérite qu'on le
  lui dise — que la limitation rend tenable : cinq essais par heure ne font pas
  un annuaire. Le sujet reste ouvert si l'énumération redevient un souci.
- **Les droits se reposent dans la même migration.** `create or replace` rend
  EXECUTE à PUBLIC — la leçon de `20260819172706`, et le second piège de la
  même famille.

**Le garde-fou a changé de nature, et c'est le plus important.** Les tests du
dépôt lisent une migration **nommée en dur** ; aucun ne lisait celles de
21 août, donc aucun n'a rien vu. `derniereDefinition()`
(`web/tests/formulaires-publics.test.ts`) prend désormais la **dernière**
migration qui définit la fonction — celle qui décrit ce qui tourne. Vérifié
dans les deux sens : sans le correctif, deux tests échouent. À reprendre pour
les autres fonctions sensibles si le sujet revient.

Vérifié en base le 28 août 2026, en transactions annulées : cinq envois
passent, le sixième est refusé ; dix saisies invalides ne consomment pas le
quota et l'envoi valable qui suit passe ; aucune ligne résiduelle ni dans
`company_requests` ni dans `submission_attempts` ; une seule signature de la
fonction ; droits limités à `anon`, `authenticated` et `service_role`.

### Et le texte est borné (`20260828130001`)

Second volet du même constat. Le stock, la surface et le nombre de magasins
étaient bornés depuis le premier jour ; le **texte** ne l'était pas. Un
anonyme pouvait écrire ce qu'il voulait, de la longueur qu'il voulait, dans
`company_name`, `message`, `contact_phone`, le prénom et le nom.

**⚠️ Refus, pas troncature — et c'est le point.** Le nom de l'entreprise
devient `companies.name` à la création, puis figure sur le devis et sur la
facture Stripe : des pièces datées, qui ne se réécrivent pas. Une troncature
silencieuse y produirait un document faux, et le message du client serait
amputé sans qu'il le sache. La règle du projet s'applique telle quelle : les
erreurs de saisie restent explicites, elles ne parlent que de ce que la
personne vient de taper.

**Les chiffres, et d'où ils viennent** — 80 pour le nom d'entreprise, le
prénom et le nom : c'est la borne de `nom_propre()`, qui gouverne déjà tous
les renommages. Sans cet alignement, une entreprise créée depuis une demande
pouvait porter un nom qu'aucun renommage n'aurait pu lui redonner. Puis 254
pour l'e-mail (RFC 5321), 30 pour le téléphone, 2 000 pour le message. **Le
nom de magasin passe de 120 à 80** pour la même raison ; lui reste tronqué et
non refusé, comportement d'origine, et l'écran le borne déjà à 80.

**La mesure passe avant le comptage du quota** : une saisie trop longue ne
consomme pas le quota de quelqu'un, au même titre qu'une faute de frappe.

**Trois épaisseurs, et elles ne font pas double emploi** : l'écran empêche
(`maxLength` sur les six champs de `/inscription` — sans quoi on n'apprend
qu'après avoir cliqué qu'un texte collé est trop long), la fonction refuse
avec un message lisible, et la contrainte `company_requests_longueurs` est la
ceinture — elle vaudra aussi pour la fonction qu'on écrira demain. La table
était vide au moment de la poser, vérifié avant.

À savoir : **`decline_quote_by_token` était déjà bornée** (`left(…, 500)` sur
le motif de refus, l'autre écriture ouverte à `anon`). Rien à y faire.

Vérifié en base, en transactions annulées : chaque borne refuse à +1 et
accepte à la limite exacte ; un `insert` direct qui contourne la fonction est
refusé par la contrainte ; le nom de magasin de 200 caractères ressort à 80 ;
aucun résidu. Et au navigateur sur `/inscription` : les six `maxLength` sont
bien dans le DOM, la page rend sans erreur de console.

### Et il répond la même chose (`20260828140001`)

Troisième volet, et fermeture du constat. La fonction publique répondait deux
choses différentes — `{success: true, request_id}` pour une adresse inconnue,
`{success: false, error: 'Une demande est déjà en cours…'}` sinon. On pouvait
donc lui poser une question qu'on ne lui avait pas posée : *cette adresse
a-t-elle déjà parlé à Quantinvo ?*

**⚠️ La limitation de débit ne suffisait pas, et il faut savoir pourquoi.** La
limite à 5 est posée **sur l'adresse testée** : quelqu'un qui essaie mille
adresses différentes a droit à un essai sur chacune, elle ne le gêne pas. Seule
la limite par point de connexion (20 par heure) le freinait. **Une limitation
de débit ne remplace pas une réponse uniforme**, elle la rend seulement plus
lente à contourner — à retenir la prochaine fois que le raisonnement se
présente.

Le motif est celui de `submit_supervisor_request` / `…_detailed`, repris tel
quel :

- **`submit_company_request_detailed`** fait tout le travail et rend le détail
  (`outcome` : `created` ou `request_pending`). Exécutable par le **seul rôle
  serveur** — `revoke … from public, anon, authenticated`, et **aucun `grant`**.
- **`submit_company_request`** est un **mince enrobage** public qui n'en laisse
  sortir que `{success: true, received: true}`.

Points à ne pas défaire :

- **⚠️ L'enrobage APPELLE, il ne recopie pas.** La duplication est exactement
  ce qui a fait perdre la limitation de débit le 21 août. Une seule
  implémentation, donc rien à resynchroniser — un test le vérifie (`not
  toContain('insert into public.company_requests')`).
- **⚠️ `request_id` a disparu de la réponse publique.** Le rendre à la création
  et pas autrement aurait laissé l'oracle intact : un identifiant présent ou
  absent est une réponse aussi bavarde qu'une phrase. Personne ne le lisait.
- **Les erreurs de saisie restent explicites** — champ vide, e-mail malformé,
  SIREN faux, texte trop long, excès de tentatives. Elles ne parlent que de ce
  que la personne vient de taper. C'est la règle depuis M3.
- **C'est la fonction edge qui dit la vérité au vrai client**, par e-mail :
  « votre demande est déjà en cours ». Le canal n'atteint que le propriétaire
  de l'adresse — c'est tout l'intérêt. Elle ne rend **jamais** `outcome` à son
  appelant : ce serait rouvrir l'oracle un cran plus haut.
- **Le texte de ce message ne reprend pas le nom d'entreprise saisi**, et se
  termine par « si vous n'êtes pas à l'origine de cet envoi, vous pouvez
  ignorer ce message » : n'importe qui peut poster ce formulaire avec une
  adresse qui n'est pas la sienne. C'est la contrepartie connue du motif — il
  permet de déclencher un e-mail vers une adresse arbitraire, bornée par les
  cinq envois par heure.
- **Pas d'avis interne dans cette branche** : il n'y a pas de nouvelle affaire
  à traiter.

**Limite assumée** : une demande créée déclenche deux e-mails, une demande déjà
en cours un seul — le temps de réponse diffère donc un peu. Canal auxiliaire
étroit, bruité par le réseau, et déjà présent sur le formulaire superviseur. On
ne le ferme pas.

⚠️ **La fonction edge a été redéployée** (version 7, `verify_jwt: false`
inchangé) — sans quoi la base et le code auraient divergé : `outcome` étant
devenu invisible à la surface publique, l'ancienne edge aurait envoyé un accusé
de réception et un avis interne pour une demande qui n'a rien créé.

Vérifié en base (réponses **identiques au caractère près** dans les deux cas,
erreurs de saisie intactes, `anon` refusé sur `…_detailed`) puis **en vrai sur
la fonction déployée** : deux envois de la même adresse → deux réponses
identiques `{"success":true,"received":true,"emailed":true}`, une seule ligne
créée. Données d'essai supprimées, zéro résidu contrôlé.

Le reste de la revue — rapport complet, neuf constats classés — est là :
https://claude.ai/code/artifact/e0b727e9-5d2d-4110-bc0c-01d97c663595

## Quatre durcissements de la revue (28 août 2026)

Suite du même passage. Ce qui ne méritait pas un chantier, mais ne devait pas
rester en l'état.

## Une formule ne s'exécute plus depuis un export CSV

Constat n°4. `toCsv` échappait correctement guillemets et points-virgules, mais
**ne neutralisait pas les cellules qu'un tableur évalue** — celles qui
commencent par `=`, `+`, `-` ou `@`. Or les libellés, marques et SKU du rapport
viennent du **fichier fournisseur importé**, que Quantinvo ne contrôle pas : un
libellé forgé devenait une commande exécutée sur le poste de la personne qui
ouvre le rapport.

`neutraliserFormule` (`web/lib/report.ts`) préfixe une apostrophe, la parade de
l'OWASP. Elle se voit dans la cellule — c'est le prix, et il ne se paie que sur
les valeurs qui commençaient par l'un de ces caractères.

**⚠️ Les nombres ne passent jamais par là, et c'est le piège de ce correctif.**
Un écart de −650 commence par un tiret. Le préfixer en ferait du texte, donc
une colonne que le tableur ne sait plus additionner — sur la colonne même que
le rapport existe pour montrer. D'où le tri sur `typeof v === 'number'` :
`buildVarianceRows` et `buildDetailRows` produisent de vrais nombres pour
toutes les quantités, et des chaînes pour tout le reste. Un test le fige.

**L'export XLSX n'était pas concerné**, vérifié à la source plutôt que supposé :
SheetJS écrit ces valeurs en cellules de type `s` (chaîne), jamais `f`
(formule). Essayé — `json_to_sheet([{A:'=1+1'}])` rend `{"t":"s","v":"=1+1"}`.
C'est aussi pourquoi l'application mobile n'avait rien à corriger : elle
n'exporte qu'en XLSX.

Tests de garde : `web/tests/report.test.ts`, bloc « les formules ne s'exécutent
pas ».

## Deux fonctions retirées à `anon` (`20260828160001`)

Constat n°6. Six fonctions étaient exécutables par `anon` ; quatre à dessein
(parcours de devis public, formulaire d'inscription). Les deux autres étaient
des oublis : `admin_list_audit_log`, qui rend le journal des actions
d'administration, et `team_invitations_figer_invariants`, la fonction de
déclencheur posée le matin même.

**Ni l'une ni l'autre ne fuyait** — essayé pour de vrai : la première répond
`forbidden`, la seconde refuse d'être appelée hors déclencheur. C'était un
droit accordé sans raison.

⚠️ **La cause est toujours la même** : `create or replace function` rend EXECUTE
à PUBLIC. Le projet l'a appris avec `get_session_activity` (`20260819172706`),
et l'a refait le matin même sur une fonction de déclencheur. Toute migration
qui définit une fonction repose ses droits dans le même fichier — **fonctions
de déclencheur comprises**, elles n'ont aucune raison d'être appelables.

## L'annuaire de toute l'entreprise n'est plus joignable (`20260828170001`)

Constat n°7. `get_company_directory` rend le nom et l'adresse e-mail de chaque
personne de l'entreprise. Correctement cloisonnée par `get_my_company()`, mais
**sans contrôle de rôle** : un compteur y lisait l'annuaire complet,
superviseurs compris. Sa voisine `get_store_directory` exige, elle,
`is_assigned_store`.

⚠️ **Le correctif est un retrait, pas un garde**, et c'est ce qui compte :
vérifié avant d'écrire, **plus aucun écran ne l'appelait**. Les deux
applications passent par `get_store_directory` depuis le 7 août 2026 (commit
`8ba7e30`), et le téléphone a été reconstruit plusieurs fois depuis. Une
fonction que personne n'appelle et qui rend les adresses de toute une
entreprise n'a pas besoin d'un contrôle de rôle : elle a besoin d'être
injoignable. L'enveloppe morte `getCompanyDirectory` a quitté
`src/lib/queries.ts` — c'est elle qui donnait l'illusion d'un appelant.

La fonction **reste en base**, droit retiré : on retire l'accès d'abord, on
supprime l'objet plus tard. Règle du projet.

## La purge s'exécute enfin toute seule (`20260828180001`)

Constat n°5, et c'est le plus embarrassant. `purge_expired_data()` portait les
durées de conservation en un seul point depuis le 18 août — et **rien ne
l'appelait**. `pg_cron` n'était pas installé, son corps n'avait jamais tourné.
Les durées annoncées dans la politique de confidentialité n'étaient donc pas
tenues : tout était conservé indéfiniment. Autant un sujet RGPD qu'un sujet de
sécurité — plus on garde, plus une fuite coûte cher.

⚠️ **Essayée à blanc avant d'être planifiée**, en transaction annulée : elle
s'exécute sans erreur et **ne supprimerait rien aujourd'hui**, les dix
compteurs de son rapport sont à zéro. La base est trop jeune pour qu'une durée
soit atteinte — c'est le meilleur moment pour la brancher, elle ne peut
surprendre personne. Ne pas planifier une fonction destructrice sans l'avoir
d'abord jouée à blanc.

Passage quotidien à **03 h 15 UTC**, hors des heures d'inventaire et décalé de
l'heure ronde. La trace vit dans `cron.job_run_details` (statut, durée,
horodatage), lisible depuis le tableau de bord Supabase :

```sql
select * from cron.job_run_details order by start_time desc limit 20;
select cron.unschedule('purge-donnees-expirees');   -- pour l'arrêter
```

Pas de ligne dans `admin_audit_log` : ce journal enregistre des gestes faits
sur des personnes et des entreprises, et 365 lignes par an disant « rien à
purger » le noieraient.

**⚠️ `pg_cron` est désormais installé** — ce n'est plus vrai que « la purge
n'est pas planifiée ». Si un autre travail périodique se présente, c'est là
qu'il ira. Test de garde : `web/tests/journal-admin.test.ts`, « et cette purge
est réellement planifiée ».

## Montée en Next 16 — fusionnée (28 août 2026)

Constat n°2 de la revue de sécurité. `npm audit` listait seize avis pour
Next.js 14.2.35, dont sept de gravité haute, et **aucun correctif n'existe pour
la branche 14** : le premier palier corrigé est 16.3.3.

Le travail a d'abord vécu sur la branche `montee-next16`, le temps qu'un essai
en session réelle confirme l'espace connecté — `git push` sur `main` déploie le
site, et un build qui passe n'est pas un site qui marche. **C'est fait : la
branche est fusionnée dans `main`**, qui est en Next 16.3.3.

⚠️ **La branche `montee-next16` ne sert donc plus à rien, et elle nuit.** Elle
n'a aucun commit que `main` n'ait pas, elle ne rattrape jamais, et Vercel lui
sert quand même une **préversion** — un instantané figé, de plus en plus vieux,
qu'on prend pour le site en regardant la mauvaise adresse. Constat de Julien le
29 août 2026, capture à l'appui : le bouton « Supprimer » des écarts, retiré le
matin même, y figurait encore. **Une branche fusionnée se supprime** : en
garder une, c'est garder une préversion qui ment.

Ce que la montée emporte : `next` 14.2.35 → **16.3.3**, `react` et `react-dom`
18.3.1 → **19.2.8**, `eslint` 8 → **9**, `eslint-config-next` → 16,
`@types/react` → 19, `vitest` → 3. Résultat : **`npm audit` rend zéro
vulnérabilité** sur le site, contre onze avant (dont une critique).

**Pourquoi c'était plus petit qu'il n'y paraît**, et c'est le point à retenir
si la question se repose : les quatre pages à paramètre (`[token]`,
`[sessionId]`, `[companyId]`, `[storeId]`) lisent leur paramètre avec
`useParams()`, un hook **client**. Le changement de rupture de Next 15 — les
`params` d'une page serveur devenus asynchrones — ne les concerne donc pas. Les
cinq pages sans `'use client'` sont des pages vitrines sans paramètre. Il n'y a
ni middleware, ni *server action*, ni route API, ni i18n : c'est ce qui rendait
l'exposition faible **et** la migration courte.

Ce qui a demandé du travail, en revanche : `next lint` n'existe plus, d'où le
passage à la configuration plate d'ESLint — voir « Lint du site » plus haut, la
règle du projet s'est inversée.

**Vérifié** : typage (`tsc --noEmit`, rien), 624 tests, `next build` avec la
**même table de routes** qu'avant (mêmes pages statiques, mêmes pages
dynamiques), lint à zéro erreur. Puis au navigateur, sur le serveur de
développement : `/`, `/inscription`, `/login`, `/devis/<jeton>` et
`/mentions-legales` répondent 200, aucune erreur de console, la police et le
thème s'appliquent, et **les six en-têtes de sécurité sont toujours servis** —
ce que le test de garde ne prouve pas, puisqu'il lit `next.config.mjs` sans
vérifier que Next l'honore.

**Vérifié depuis, en session réelle**, ce que je ne pouvais pas voir : le
tableau de bord d'un inventaire, l'import d'un fichier, le rapport, /equipe et
la console.

## Un paiement resté sans suite se dit tout seul (28 août 2026)

Dernier manque de la revue. Les journaux existaient — `admin_audit_log`,
`company_audit_log`, écrits dans la même transaction que l'action — mais
**personne n'était prévenu de rien**. Le cas qui coûte de l'argent est toujours
le même : un client paie par carte, le webhook Stripe ne passe pas,
l'entreprise n'est jamais créée. Le client a payé, il n'a rien, et on
l'apprend quand il écrit.

**⚠️ La détection existait déjà**, et c'est ce qui a rendu le travail court :
`web/lib/pipeline.ts` sait lire un `paid` sans création (« Payé — création en
attente », passé en alerte au bout d'un jour) et /admin l'affiche. Ce qui
manquait n'était pas l'intelligence, c'était le **facteur** — il fallait aller
chercher l'information.

**On surveille le résultat, pas la machine.** Pas les erreurs techniques des
fonctions : elles sont bruyantes, la plupart se règlent seules, et une alerte
qu'on cesse de lire ne protège plus rien. Une seule question, posée toutes les
heures à la minute 7 : *y a-t-il un paiement encaissé dont rien n'a été créé ?*

### Les quatre choses à ne pas défaire

- **⚠️ Quinze minutes de grâce.** Stripe réessaie quand une réponse tarde.
  Alerter à la seconde ferait sonner pour des paiements qui se règlent seuls
  deux minutes plus tard.
- **⚠️ La mémoire des alertes** (`alertes_envoyees`). Sans elle, un paiement
  bloqué produirait vingt-quatre e-mails par jour. Une anomalie qui dure est
  rappelée **une fois par jour**, pas davantage ; une anomalie réglée disparaît
  de la mémoire au bout de trente jours, de sorte qu'une récidive redonne lieu
  à une alerte plutôt qu'à un silence.
- **⚠️ On marque APRÈS l'envoi.** Un e-mail qui ne part pas laisse l'anomalie
  ouverte, et l'heure suivante réessaie. L'ordre inverse la ferait taire pour
  de bon sur un incident réseau d'une seconde.
- **Le silence est le cas normal**, et c'est lui qui rend l'alerte crédible.
  Rien à signaler, rien n'est envoyé — et `declencher_alerte` s'arrête même
  avant de réveiller la fonction edge.

### La clé, et pourquoi ce n'est pas la clé de service

`alerte-anomalies` est déployée en `verify_jwt: false` — une tâche `pg_cron`
n'a pas de session. La porte est une **clé partagée**, vérifiée en temps
constant, sur le modèle du webhook Stripe.

**⚠️ Cette clé n'autorise qu'une chose : demander le tour de garde.** Ce n'est
pas la clé de service ; si la base fuyait, ce jeton ne permettrait de lire
aucune donnée. Il vit dans le **coffre** (`vault.decrypted_secrets`, secret
`alerte_cle`), jamais en clair dans une définition de fonction —
`pg_get_functiondef` est lisible par qui peut lire le catalogue.

**Tant que le secret d'edge n'est pas posé, rien ne part** : la fonction répond
500 et la tâche planifiée ne l'appelle même pas. La planification est donc
inoffensive avant sa configuration.

**Il faut poser `ALERTE_CLE` dans les secrets d'edge functions**, avec la valeur
du coffre. Pour la relire :

```sql
select decrypted_secret from vault.decrypted_secrets where name = 'alerte_cle';
```

### Vérifié

En base, en transaction annulée, les cinq comportements : base saine →
silence ; paiement sans création depuis deux heures → détecté, avec le montant
et le nom ; juste après l'alerte → silence ; vingt-cinq heures plus tard,
toujours ouvert → rappelé ; paiement d'il y a cinq minutes → silence.

Sur la fonction déployée : elle démarre, refuse un GET (405) et refuse tout
sans clé. Et `declencher_alerte()` joué à la main sur la base réelle ne
provoque **aucun appel sortant** (`net._http_response` reste vide) : il n'y a
rien à signaler.

### L'écran dit la même chose que la boîte de réception

Julien, l'e-mail reçu : *« il serait intéressant de le voir sur le dashboard
admin également, non ? »* Il y était déjà — `lireVente` rendait `tour: 'nous'`
sur un `paid`, donc /admin l'affichait en alerte ambre dans « Ventes en
cours ». **Mal réglé, en revanche** : l'e-mail partait au bout de quinze
minutes, l'écran ne parlait de retard qu'au bout d'un jour, et son libellé
(« création en attente ») ne disait pas que quelque chose clochait.

⚠️ **`GRACE_PAIEMENT_MIN` (`web/lib/pipeline.ts`) doit rester égal à la grâce
de `anomalies_a_signaler`.** Un test compare la constante au texte de la
migration : deux seuils qui divergent, ce sont deux versions du même incident,
et c'est comme ça qu'on cesse de croire l'un ou l'autre. Passé la grâce,
l'écran écrit « rien n'a été créé, le client attend » — le mot dit
l'anomalie ; avant, il écrit « création en cours » et n'affole personne.

### Et la purge se surveille elle-même (`20260828200001`)

Julien, à qui je venais de demander de lancer une requête chaque matin pour
vérifier que la purge avait tourné : *« elle ne peut pas se run seule la
commande ? »*. Elle peut — et surtout **elle ne devrait pas exister** : une
vérification dont un humain est responsable s'arrête au bout de trois jours.

Le tour de garde pose donc une seconde question : *le ménage quotidien a-t-il
eu lieu ?* Même principe que la première — on regarde le **résultat**
(`cron.job_run_details`), pas une erreur de tâche.

- **⚠️ 48 heures, pas 24.** La purge passe une fois par jour : alerter à 24 h
  ferait sonner pour un passage décalé de quelques minutes ou une base
  momentanément indisponible. Deux nuits manquées, ce n'est plus un hasard.
- **⚠️ Le piège du démarrage.** Au moment de la pose, la purge n'avait **jamais
  tourné** : une condition naïve (« aucun passage réussi depuis 48 h ») était
  vraie tout de suite, et l'alerte serait partie avant que le ménage ait eu sa
  chance. D'où le `greatest(...)` avec une date d'installation en dur — et si
  la tâche ne démarrait jamais du tout, l'alerte finirait par partir quand
  même, ce qui est exactement ce qu'on veut.
- **⚠️ Le message se compose par nature.** Un seul texte, écrit pour les
  paiements, ferait dire « un paiement sans suite » à propos du ménage. Une
  alerte qui décrit mal ce qu'elle a vu ne se lit plus. `alerte-anomalies`
  sépare donc `paiement` et `purge` — titre, paragraphes et ligne de détail
  (celle d'une purge ne parle pas d'euros). Redéployée en version 3.

Vérifié en base : silencieuse aujourd'hui (le repli tient), et **la branche
purge se déclenche bien** — essayé en transaction annulée en reculant le repli
à huit jours, la fonction rend alors la ligne `purge:silencieuse`. La fonction
réelle est intacte après annulation, contrôlée sur `pg_get_functiondef`.

Tests de garde : `web/tests/alerte.test.ts`.

## Le jeton de session vit dans le trousseau (28 août 2026)

Constat n°8, dernier de la revue. `supabase-js` rangeait la session dans
`AsyncStorage` — un fichier en clair dans le bac à sable de l'application. Ce
bac à sable la protège des autres applications, **pas** d'un téléphone
déverrouillé, d'une sauvegarde non chiffrée ni d'un appareil débridé. Et une
session vaut trente jours d'inactivité.

Elle vit désormais dans `expo-secure-store` — Keychain sur iOS, Keystore sur
Android : chiffrée par le système et liée à l'appareil. Le branchement tient en
une ligne de `src/lib/supabase.ts` (`storage: sessionStore`) ; tout le reste est
dans `src/lib/sessionStore.ts`, et **les trois pièges y sont**.

- **⚠️ Le trousseau ne prend pas de grandes valeurs.** Expo annonce 2 048 octets
  par entrée et prévient qu'au-delà l'écriture pourra échouer. Une session
  Supabase — deux JWT et l'objet utilisateur — dépasse couramment ce seuil. Elle
  est donc **découpée** en morceaux de 1 800 octets (`<clé>__0`, `<clé>__1`…),
  leur nombre rangé sous `<clé>`. Ne pas « simplifier » en un `setItemAsync`
  direct : ça marche sur une session courte et casse sur une longue — donc plus
  tard, et sur le téléphone de quelqu'un d'autre.
- **⚠️ Personne n'est déconnecté par le changement.** À la première lecture, si
  le trousseau est vide, on regarde dans `AsyncStorage` : la session de l'ancien
  monde y est déménagée, puis l'ancienne copie effacée. Sans ce passage, tous
  les compteurs déjà installés se retrouveraient devant l'écran de connexion —
  un matin d'inventaire, ça se paie cher.
- **Une session plus courte ne laisse pas d'orphelins** : les morceaux au-delà
  du nouveau compte sont effacés, faute de quoi une lecture ultérieure
  recollerait la queue de l'ancienne session à la nouvelle.
- Un morceau manquant rend `null`, jamais un JSON tronqué : supabase-js
  redemande une connexion, ce qui vaut mieux qu'une valeur qu'il ne sait pas
  analyser.
- Sur le **web** (`react-native-web` est dans les dépendances), le trousseau
  n'existe pas : on retombe sur `AsyncStorage`. Le web n'est pas la cible, mais
  il ne doit pas planter.

**Le reste du cache hors ligne ne bouge pas** — catalogue d'articles, file de
comptages — et c'est délibéré : il est volumineux, et `oublierCachesLocaux`
l'efface déjà à la déconnexion. Le trousseau est pour le secret, pas pour le
volume.

⚠️ **`expo-secure-store` est une dépendance NATIVE.** Elle impose un
`pod install` et une **reconstruction de l'application** : tant que le nouveau
build n'est pas installé, rien ne change sur les téléphones. C'est aussi la
seule partie que les tests ne prouvent pas — ils couvrent le découpage, le
déménagement et le ménage des orphelins, avec les deux modules natifs simulés,
mais le trousseau réel ne se vérifie qu'appareil en main.

Tests de garde : `tests/session-store.test.ts`.

## « Supprimer mon compte » quitte le voisinage de « Se déconnecter » (28 août 2026)

Constat de Julien, en voulant se déconnecter : *« le bouton supprimer mon
compte est celui qu'on a envie de cliquer, car il ressemble fortement à un
bouton de déconnexion »*.

Il avait raison, et le défaut est de mise en page pure : les deux lignes se
suivaient **dans la même carte**, et la suppression était la **seule ligne
colorée de l'écran**. Autrement dit, le geste le plus grave était le plus
visible, à un centimètre de celui qu'on cherchait. Deux gestes sans rapport,
que rien ne séparait.

**Écran `(compte)/profile.tsx`**, qui rassemble ce qu'on vient modifier **sur
soi** : le prénom et le nom, le mot de passe, la double authentification —
puis, tout en bas, sous son propre titre « Zone sensible » et seule dans sa
carte, la suppression. C'est la **distance** qui protège ; la confirmation, elle,
n'a pas bougé.

Maquette validée avant codage :
https://claude.ai/code/artifact/fc883be2-b91f-4fab-b096-7d90c6bb504c

Points à ne pas défaire :

- **⚠️ « Se déconnecter » est passée en rouge, et ce n'était possible qu'après
  ce déménagement.** Elle est désormais la seule ligne colorée de « Mon
  compte » : le rouge y désigne une chose et une seule, la sortie. Tant que la
  suppression était juste en dessous, deux rouges voisins n'auraient rien
  distingué — ils auraient aggravé le problème.
- **Elle n'a pas de chevron** (`sansChevron`) : elle agit sur place, elle
  n'ouvre pas d'écran. Un chevron promettrait une page.
- **Le mot de passe a quitté « Ma sécurité »**, qui ne gardait plus qu'une
  ligne. La double authentification l'a suivi : elle appartient au même sujet.
- **Ce qui reste sur « Mon compte » est sans conséquence** — le travail du
  superviseur, l'export de données, les repères, la déconnexion. On peut y
  toucher n'importe quoi sans rien perdre.
- Le bandeau « demande de suppression en cours » reste affiché **sur les deux
  écrans** : c'est un état, pas une action, et il doit se voir sans avoir à
  chercher.

## Les icônes de menu (`components/ui/MenuIcons.tsx`)

Demandées dans la foulée, capture à l'appui. `MenuRow` accepte une icône, et
tous les rangs des deux écrans en portent une — un test le vérifie, parce
qu'une ligne sans icône dépareille immédiatement dans une colonne alignée.

- **⚠️ Au trait, jamais en aplat.** À 21 px une icône pleine devient une tache :
  on voit une forme colorée, pas un objet.
- **Elle prend la couleur du rang** (`danger ? theme.danger : theme.textMuted`),
  donc elle rougit avec « Se déconnecter » sans qu'on dessine une seconde
  version. Et c'est le gris des libellés secondaires, pas celui du texte : à
  cette taille, un trait à pleine valeur pèse plus que le mot qu'il accompagne.
- **Même grille de 24 et même épaisseur (1,7) pour toutes.** Ce qui fait tenir
  une colonne, c'est l'alignement des traits, pas le dessin de chacune — une
  icône hors grille se remarque aussitôt.
- Vocabulaire, si on en ajoute une : un contour fermé pour un lieu ou un objet
  (magasin, carte d'identité, bouclier), un trait ouvert pour un mouvement
  (téléchargement, sortie).

Tests de garde : `tests/compte.test.ts`, bloc « “Supprimer mon compte” n'est
plus voisine de “Se déconnecter” ». ⚠️ Ils lisent le **code seul** : les
commentaires de ces écrans racontent le défaut corrigé, donc citent
« Supprimer mon compte » et le mot `danger`, et feraient échouer une garde qui
porte sur ce que l'écran affiche.

# Le domaine : `www.quantinvo.com` (branché le 22 août 2026)

Le site vit sur **`https://www.quantinvo.com`** — c'est l'adresse canonique,
choisie par Vercel à l'ajout du domaine : `quantinvo.com` redirige en 308
vers `www`, et `quantinvo.vercel.app` reste servi en alias (les liens déjà
envoyés par e-mail continuent de marcher). Le DNS est chez Vercel
(`ns1/ns2.vercel-dns.com`) ; l'e-mail (ImprovMX pour `contact@`, Resend sur
`send.quantinvo.com`) n'en dépend pas.

Ce qui a bougé dans le dépôt (commit `80d5e2b`) : tous les replis
`https://quantinvo.vercel.app` — `src/constants/links.ts` (`SITE_URL`, app
mobile, effectif au prochain build), `_shared/email.ts` (`SITE_PAR_DEFAUT`,
donc l'adresse du logo PNG des e-mails), les quatorze fonctions edge, le pied
du PDF de devis, l'écran « ordinateur requis », `docs/privacy.html`, les
modèles de documents et le deck.

**Les fonctions edge n'ont pas été redéployées pour ça** : elles lisent
`APP_PUBLIC_URL` à l'exécution, la valeur écrite en dur n'est qu'un repli.
Poser le secret suffit ; le repli ne sert qu'au prochain redéploiement de
chaque fonction, quelle qu'en soit la raison.

**Posé le 22 août 2026 par Julien**, et vérifié pour l'edge par un envoi réel
(l'accusé d'une demande d'essai chargeait déjà son logo depuis le nouveau
domaine, fonction non redéployée) : le secret `APP_PUBLIC_URL`, qui n'avait
**jamais existé** avant ce jour — toutes les fonctions tournaient sur leur
repli —, et la console Supabase (Authentication → URL Configuration) :
**Site URL** `https://www.quantinvo.com`, et les **Redirect URLs**
`https://www.quantinvo.com/reinitialisation` et `/bienvenue` — en gardant les
anciennes (`https://quantinvo.vercel.app/…` et
`https://quantinvo-*-devkaylab.vercel.app/reinitialisation`) tant qu'un e-mail
déjà parti peut encore être cliqué. Secret edge `APP_PUBLIC_URL` =
`https://www.quantinvo.com`.

## Double authentification (TOTP)

Le parcours vit dans l'app web depuis le 19 août 2026 — la console Supabase
n'avait rien à activer, le TOTP y est permis d'office ; ce qui manquait,
c'était l'interface. Activation depuis **Mon compte** (`MfaPanel` : QR code,
puis code de vérification), saisie du code à chaque connexion (`/login`,
deuxième étape), logique dans `web/lib/mfa.ts`. `useAuthGuard` renvoie vers
`/login` toute session restée au mot de passe seul (`aal1`) alors que le
compte a un facteur — sans cette garde, fermer l'onglet entre le mot de passe
et le code laisserait entrer à moitié authentifié.

Le compte administrateur est enrôlé (19 août 2026), et **le serveur l'exige
désormais** : migration `20260819123621_mfa_admin_aal2`. La garde tient en un
seul point — les dix-huit fonctions `admin_*` passent toutes par `is_admin()`,
qui répond faux à une session restée au mot de passe seul. Avant cette
migration, un jeton `aal1` gardait tous les droits côté serveur : la garde
client ne protégeait que l'interface, pas l'API.

**L'exigence est conditionnelle, ne pas la « simplifier »** en un `aal2`
obligatoire : elle ne vise que les comptes ayant un facteur vérifié. C'est ce
qui rend le dépannage possible — un téléphone perdu se règle en `service_role`
(`delete from auth.mfa_factors where user_id = …`), l'administrateur retrouve
ses droits au mot de passe seul le temps de se réenrôler, sans qu'il faille
défaire la migration. Il n'y a pas de codes de secours. Tests de garde :
`web/tests/mfa.test.ts`.

Non concernés : les comptes sans second facteur, les superviseurs ordinaires,
`service_role` (pas de `auth.uid()`), et l'app mobile — elle n'appelle aucune
fonction `admin_*`. **Si un écran mobile devait un jour en appeler une**, il
faudrait d'abord y porter le parcours TOTP : sans lui, une session mobile est
en `aal1` et serait refusée.

## Changer son mot de passe exige l'ancien (21 août 2026)

`updateUser({ password })` ne demande rien d'autre que d'être connecté. Un
téléphone laissé déverrouillé, ou un poste resté ouvert, suffisait donc à
changer le mot de passe et à s'approprier le compte — au moment même où l'on
ajoutait un second facteur contre ce risque. **Le trou existait des deux
côtés** : l'app l'a recopié du site en portant le formulaire. Relevé par Julien
en test.

Les deux formulaires (`web/app/account/page.tsx`, `src/app/(compte)/password.tsx`)
demandent maintenant le mot de passe actuel, et offrent la sortie « mot de passe
oublié » pour qui ne s'en souvient plus — c'est le parcours par e-mail qui
vérifie alors l'identité, et c'est la bonne porte.

**La vérification passe par un client Supabase jetable** (`lib/reauth.ts` des
deux côtés) : `signInWithPassword` remplace la session du client qui l'appelle.
Sur le client principal, vérifier ferait retomber la session en `aal1` et
redemanderait le code de double authentification au milieu du formulaire.

Deux conséquences à connaître :

- la vérification laisse une **session serveur orpheline**, jamais rafraîchie.
  Elle meurt par l'expiration pour inactivité posée plus haut ;
- ⚠️ elle **dépend de « Single session per user » resté fermé**. Cette option ne
  garde que la dernière connexion : vérifier son mot de passe déconnecterait de
  l'app ou de l'onglet en cours. Le conseil de ne pas l'activer devient donc
  porteur.

Tests de garde : `web/tests/password.test.ts`, bloc « changement de mot de
passe — l'ancien est exigé ».

## Expiration des sessions (posée en console le 21 août 2026)

Constat de départ : `auth.sessions.not_after` est vide partout, et une session
de compteur ouverte le 18 juin vivait encore le 13 août. **Rien n'expire.** Un
téléphone perdu reste connecté indéfiniment, sur un outil qui porte des données
de stock et des noms de salariés.

À savoir d'abord, parce que la question revient : **le code de double
authentification n'est pas demandé périodiquement.** Le niveau `aal2` est
stocké sur la ligne de session, pas seulement dans le jeton ; le
rafraîchissement horaire le reconduit. On ne le ressaisit qu'à une nouvelle
connexion. Un « se souvenir de cet appareil » maison est à écarter : on ne peut
pas accorder `aal2` côté client, donc sauter l'écran laisserait la session en
`aal1` — les fonctions `admin_*` refuseraient, et pour un superviseur ce serait
une protection de façade.

**Réglage en place**, Authentication → Sessions (offert à partir du plan Pro —
l'organisation y est). **Les deux champs sont en heures**, pas en jours :

- *Inactivity timeout* — la session meurt faute d'usage → **720 h (30 jours)** ;
- *Time-box user sessions* — plafond absolu depuis la connexion →
  **4320 h (180 jours)**.

⚠️ **Ce réglage ne se relit pas depuis la base.** Le plafond n'est pas
matérialisé dans `auth.sessions` (`not_after` reste vide) : GoTrue compare
`created_at + plafond` et `refreshed_at + inactivité` au moment du
rafraîchissement. Seule l'API de gestion, ou le panneau de la console, dit ce
qui est configuré. En cas de doute, aller le lire — ne pas conclure de
`not_after` vide que rien n'est posé.

Qui compte régulièrement n'est jamais dérangé ; qui n'a pas ouvert l'app depuis
un mois ressaisit son mot de passe une fois.

Trois précisions de la documentation Supabase, qui évitent des surprises :

- **La durée réelle est le réglage plus l'expiration du jeton** (une heure ici).
  Le contrôle n'a lieu qu'au rafraîchissement suivant.
- **Changer le réglage ne tue pas les sessions en cours** : elles tombent au fur
  et à mesure de leurs rafraîchissements. Les sessions expirées sont effacées de
  la base 24 h plus tard.
- **Ne pas activer *Single session per user*.** Cette option ne garde que la
  dernière connexion : se connecter sur le téléphone déconnecterait du site, et
  inversement. Or un superviseur travaille précisément avec les deux.

**Ce qu'il fallait corriger avant d'activer, et qui l'est.** Une session
expirée n'annule pas les comptages en attente :

- `syncNow` ne tente rien sans session valide. Sinon la requête part en
  anonyme, PostgREST répond « permission denied », et `flush()` rangeait des
  comptages **valides** dans les échecs définitifs — le compteur perdait son
  travail.
- `isAuthExpired` (jeton périmé, 401, session absente) est traité comme une
  coupure réseau : l'opération reste en file. **`42501` n'en fait pas partie** —
  refus de droits avec session valide (retiré de l'inventaire, inventaire
  clôturé), ça doit rester un échec visible.
- Tests de garde : `tests/offline.test.ts`, blocs « une session expirée
  conserve la file » et « un refus de droits reste un échec définitif ».

**Le risque résiduel, à connaître avant de choisir des durées courtes** : si
une session expire pendant un comptage hors ligne, la personne est renvoyée
vers la connexion et ne peut pas se reconnecter sans réseau. Ses comptages sont
conservés, mais elle ne peut plus compter. C'est ce qui plaide pour un plafond
large plutôt que serré.

## Politique de mot de passe (console + code, 19 août 2026)

La console applique désormais : **12 caractères minimum**, une minuscule, une
majuscule, un chiffre, un symbole, et le refus des mots de passe présents dans
les fuites connues (**Leaked password protection**, HaveIBeenPwned). L'advisor
`auth_leaked_password_protection` a disparu — il ne reste que les avertissements
`*_security_definer_function_executable`, connus et voulus (les RPC portent
leurs propres contrôles).

`web/lib/password.ts` **rejoue ces règles côté client** pour les énoncer en
français avant l'envoi, et traduit les refus que seul le serveur peut prononcer
(mot de passe issu d'une fuite, réutilisation de l'ancien) — sans quoi la
personne reçoit un message technique en anglais. Les deux formulaires
(`/bienvenue`, `/reinitialisation`) affichent les exigences cochées à la frappe
(`PasswordRules`).

**Console et code doivent bouger ensemble** : assouplir la console sans
toucher au module afficherait une exigence qui n'existe plus ; la durcir sans
lui laisserait passer une saisie que le serveur refusera. Tests de garde :
`web/tests/password.test.ts` (dont le seuil de 12, figé explicitement).

## Suivi d'activité : agrégé, plus nominatif (E3, 19 août 2026)

Le suivi nominatif en direct a été **retiré**. Le superviseur voit des
compteurs — appareils connectés, en comptage, en audit — et pilote par
l'avancement par zone, qui décrit le travail et non les personnes.

**Contrat de présence v2** (`web/lib/presence.ts` et `src/lib/presence.ts`,
dupliqués volontairement, à garder synchronisés) : il ne reste que `mode` et
`beat`. Ont disparu le nom, l'écran, la balise en cours, le début d'activité et
**l'application au premier plan**. La clé de présence est un identifiant
d'appareil tiré au hasard, plus l'`user_id` — il voyageait dans le protocole
même absent de la charge. Le site **écoute sans publier**.

Le bump de version est ce qui protège la transition : une application mobile
restée en v1 continue d'émettre l'ancienne charge, mais le site l'écarte et la
compte dans `unknownVersions`, affiché à l'écran. **Ne jamais réutiliser le
numéro de version** en changeant le contrat.

Retirés aussi : l'appel à `get_session_activity` (nominative) et `counted_by`
dans la requête du fil des scans — ce qui n'est pas affiché n'a pas à descendre
au navigateur.

La RPC elle-même a été supprimée (`20260819174148`), **et le chemin pour y
arriver vaut d'être retenu** : une première suppression (`20260819171741`) a dû
être annulée dans la minute (`20260819172557`) parce que le site en production
l'appelait encore — le tableau de bord affichait alors « Cet inventaire n'est
pas accessible » à l'ouverture d'un inventaire, `refreshLive` la joignant dans
un `Promise.all` dont l'échec remonte jusqu'à l'écran. **Déployer le code
d'abord, supprimer l'objet ensuite.** Et à la restauration d'une fonction,
reposer les GRANT dans la même migration : `create or replace` rend EXECUTE à
PUBLIC (corrigé par `20260819172706`).

**Ce qui reste nominatif et doit le rester** : `counts.counted_by`, écrit à
chaque scan et restitué dans le rapport. Arbitrer un écart suppose de savoir
qui a compté ; finalité distincte, usage différé. Le supprimer retirerait au
produit sa capacité d'audit.

Conséquence sur les obligations : le critère « surveillance systématique »
tombe, il ne reste que « personnes vulnérables » — l'AIPD n'est donc en
principe plus requise, mais **cela se motive par écrit**. Analyse à jour :
`docs/conformite/suivi-activite-analyse.md`. Tests de garde :
`web/tests/presence-summary.test.ts` et le bloc « Suivi — activité agrégée »
de `web/tests-e2e/dashboard.spec.ts`.

## Reste à traiter, par ordre de priorité

1. **M5 — documents écrits, à faire relire.**
   `docs/conformite/registre-des-traitements.md` (7 traitements, établis en
   relisant le code) et `sous-traitance-article-28.md` (clauses à intégrer aux
   conditions de service). Ni l'un ni l'autre n'a été relu par un juriste.

## Dérive entre le dépôt et la base

`account_deletion_requests` et `request_account_deletion` existent en base live
mais **n'ont aucune migration** dans le dépôt : créés directement via l'outil
MCP. Repartir d'un `supabase db pull` avant toute refonte de ces objets, sous
peine d'écrire une migration qui contredit l'existant.

## Points conformes à préserver

Aucun traceur ni mesure d'audience — **aucun bandeau cookies n'est requis**, ne
pas en ajouter par réflexe. Polices Google auto-hébergées par `next/font` (pas
d'appel à Google au chargement). Données en `eu-west-1`. Aucun secret versionné.
La suppression de compte anonymise les comptages au lieu de les détruire.

# Tenue en charge (21 août 2026)

Question posée : « Quantinvo résiste-t-il à 200 magasins faisant un inventaire
avec 100 compteurs chacun, au même moment ? » L'étude a montré que **le mur
n'est pas le nombre de magasins, mais le nombre de compteurs d'un même
magasin**, et qu'il ne tenait pas à la puissance louée mais à deux endroits du
code. Les deux sont corrigés ; le reste est un curseur et une facture.

## Ce qui a été corrigé

**Les totaux se calculent sur le serveur.** `getCountTotals` téléchargeait
toutes les lignes de `counts` de l'inventaire pour additionner quatre nombres
dans le navigateur — rejoué toutes les huit secondes par tableau de bord
ouvert, soit des centaines de milliers de lignes par sondage sur un gros
inventaire. Remplacé par la RPC `get_session_count_totals` (migration
`20260821240001`). **Ne jamais y remettre un `select` sur `counts`.**

**Les téléphones ne rejoignent plus le canal temps réel** — contrat de présence
**v3**. En v2, chaque téléphone publiait sa présence sur le canal de
l'inventaire, et le service recopiait chaque battement vers *tous* les membres,
donc vers les 99 autres téléphones qui n'en font rien : un coût en n² pour un
service en n. Mesuré à cent compteurs : ~336 messages/s pour la seule présence,
plus ~1 000 pour le `sync` émis à chaque scan, contre un plafond d'abonnement
de 500/s tous magasins confondus — et une connexion ouverte par téléphone, pour
un plafond de 10 000.

En v3, le téléphone envoie son battement par **broadcast HTTP**
(`channel.httpSend`), sans jamais s'abonner, et seul le tableau de bord écoute.
Deux bornes de cadence, aussi importantes que le reste : au plus un message
toutes les 5 s (une rafale de scans est regroupée — c'est ce qui remplace le
`sync` par scan), au moins un toutes les 30 s (sinon le site croit l'appareil
parti à 90 s). L'identifiant d'appareil, que la présence portait comme clé de
canal, voyage désormais dans la charge (`k`).

**Le tableau de bord ne recalcule qu'une fois par minute.** Un
rafraîchissement fait reparcourir tous les comptages de l'inventaire (zones et
totaux) : le coût est le même que le déclencheur soit le sondage régulier ou un
scan qui vient d'arriver. La limite `AUTO_MIN_GAP_MS` de `useSessionLive` vaut
donc **pour tous les déclencheurs à la fois** — la poser sur le seul sondage ne
changerait rien un jour de gros inventaire, où les scans arrivent en continu.
À 200 magasins, cela ramène la charge de ~50 calculs par seconde à moins de 7.

Ce qui rend une minute acceptable, et qu'il ne faut pas retirer : la limite est
à **seuil franchi**, donc sur un inventaire calme le premier scan venu
rafraîchit tout de suite ; le bouton « Mis à jour… » de l'en-tête et le retour
sur l'onglet passent outre (`refresh(true)`) ; et les compteurs d'appareils
connectés ne passent pas par là, ils suivent les battements en direct.

Le sondage bat **plus vite** que la limite (15 s contre 60) : sinon un
rafraîchissement déclenché à la dixième seconde ferait sauter le sondage
suivant et l'écran pourrait rester deux minutes sans bouger.

La temporisation de 750 ms qui précédait a été retirée, et le motif vaut d'être
retenu : elle reportait l'appel à chaque message reçu, donc sur un inventaire
animé — où les messages arrivent plus vite que ça — elle ne parvenait jamais à
son terme. Ce déclencheur ne servait plus à rien, sans que cela se voie.

**Chaque section ne recharge que ce qu'elle affiche.** `LIVE_SCOPES` (page du
tableau de bord) donne la portée de `refreshLive` : `suivi` (avancement, totaux
et fil des scans), `zones` (Set up, Écarts — sans le fil), `aucun` (Rapport,
Équipe). Le Rapport reste vivant : il recharge le sien à chaque battement, et
c'est bien ce qui est à l'écran — mais il ne fait plus recalculer l'avancement
par zone dont sa page ne montre rien.

Deux pièges déjà rencontrés, à ne pas réintroduire :

- **Le premier chargement ignore la portée** (`chargerLive('suivi')` dans
  `refreshAll`). Le bandeau de progression est visible sur toutes les sections :
  s'en remettre à la portée afficherait un bandeau à zéro sur un lien direct
  vers le Rapport.
- **Changer de section recharge tout de suite**, sans passer par la limite. Les
  rafraîchissements joués pendant un détour par le Rapport n'ont rien rechargé :
  sans ce geste, revenir sur Suivi montrerait un avancement figé. Et extraire
  `refresh` de l'objet `live` avant de le mettre en dépendance d'effet — la
  présence change à chaque battement, dépendre de l'objet entier rechargerait
  l'inventaire à chaque appareil qui se signale.

**Le tableau de bord se repose quand rien n'est signalé.** Sur un inventaire
ouvert où personne ne scanne, le sondage se contente d'une passe toutes les cinq
minutes (`IDLE_MAX_MS`) au lieu d'une par minute. Le mobile signale ses scans
(battements `dirty`, et **la file hors ligne qui remonte** — `syncNow` appelle
`pingSession`, sans quoi un retour de réserve verserait des centaines de
comptages sans prévenir).

**La garde qui rend ce repos acceptable est `!channelReadyRef.current`** : le
repos ne s'applique que si le canal est ouvert. Un tableau de bord dont le temps
réel est tombé ne reçoit plus aucun signal — s'y endormir afficherait des
chiffres figés cinq minutes sans que rien ne l'explique. Ne jamais retirer cette
condition.

## Ce qu'il faut savoir avant d'y toucher

- **La double écoute du site est temporaire et nécessaire.** `useSessionLive`
  lit à la fois la présence v2 et les battements v3, et fusionne. Les
  téléphones déjà installés émettent encore en v2 : retirer `flattenPresence`
  avant que le nouveau build soit partout ferait disparaître de l'écran des
  équipes bel et bien au travail. Même règle que pour `get_session_activity` —
  code déployé d'abord, ancien chemin retiré ensuite.
- **`PRESENCE_V` n'existe plus** : deux constantes distinctes, `BEAT_V = 3`
  (contrat v3) et `LEGACY_PRESENCE_V = 2` (lecture de transition, côté site
  seulement). Ne jamais réutiliser un numéro de version en changeant le
  contrat.
- **Sécurité inchangée, et vérifiée à la source de Realtime** : le canal reste
  privé, les policies de `realtime.messages` s'appliquent à l'envoi HTTP comme
  à l'envoi par socket, et les messages publics circulent sur une file
  distincte de la file privée — une injection anonyme n'atteindrait pas le
  tableau de bord.
- **Piège** : le point d'entrée HTTP de Realtime répond **202 quoi qu'il
  arrive**. Un message refusé faute de droits est écarté en silence. `httpSend`
  qui réussit ne prouve donc pas que le message est arrivé : si le tableau de
  bord n'affiche aucun appareil alors que les téléphones comptent, chercher du
  côté des droits sur l'inventaire, pas du réseau.
- **Un téléphone, une clé, un émetteur** (corrigé le 22 août 2026). La clé
  d'appareil était tirée dans `useSessionPresence`, donc **à chaque montage**.
  Or deux écrans montent ce hook en même temps : l'écran de l'inventaire reste
  monté dans la pile sous l'écran de comptage. Un seul téléphone comptait pour
  deux appareils dès qu'on ouvrait le comptage — constat de Julien, capture à
  l'appui. La clé est maintenant un `const` de module (`DEVICE_KEY`), tiré une
  fois par lancement de l'application ; **ne jamais la redescendre dans le
  composant**.

  Corollaire : les écrans s'inscrivent dans une **pile** (`holders`), calquée
  sur la navigation — le dernier monté donne le mode — et il n'y a plus qu'un
  émetteur (`engine`). Le même défaut cassait `pingSession` en silence : le
  second montage écrasait la référence de l'émetteur, et son démontage la
  remettait à `null` alors que le premier écran vivait toujours, si bien que
  les scans ne réveillaient plus le tableau de bord. Changer d'écran dans le
  même inventaire **ne redémarre pas** l'émetteur (sinon l'appareil clignote),
  mais déclenche un `markDirty` — sans lui, fermer le comptage laisserait
  l'appareil affiché « en comptage » pendant trente secondes.
- Les deux modules `presence.ts` (site et mobile) restent **dupliqués
  volontairement** et doivent bouger ensemble. Tests de garde :
  `web/tests/charge.test.ts` et `web/tests/presence-summary.test.ts`.

## Ce qui reste ouvert

- **Index manquant** sur `counts (session_id, zone, pass_number)` :
  `get_zone_dashboard` agrège tous les comptages de l'inventaire à chaque
  rafraîchissement. Sans intérêt aux volumes actuels (quelques centaines de
  lignes) ; à reprendre avec des chiffres sous les yeux, pas au jugé.
- **Compute Micro** (`max_connections` = 60) : à monter le jour où le volume
  arrive. 20 000 compteurs à six scans/minute font ~2 000 écritures/s, une
  Micro en encaisse 200 à 400. C'est un curseur, pas un chantier.
- **Abonnement Realtime** : le plafond de dépense limite à 500 connexions
  simultanées. À retirer avant d'ouvrir beaucoup de magasins.
- **Sortie réseau** : `primeOfflineCache` télécharge le référentiel articles
  **par appareil**. Cent téléphones sur un catalogue de 10 Mo font 1 Go pour un
  seul magasin ; le forfait en inclut 250.

# Mode douchette : les chiffres, et l'écran qui reste allumé (25 août 2026)

Deux constats de Julien, en test réel avec une douchette Bluetooth.

## « Seulement des symboles s'affichent — &é"' au lieu de 1234 »

**Une douchette ne transmet pas des caractères, elle transmet des touches** —
les mêmes codes HID qu'un clavier physique. C'est iOS qui décide ensuite du
caractère, en suivant Réglages › Général › Clavier › **Clavier physique**.
Presque toutes les douchettes sortent d'usine en QWERTY ; un iPhone français
est en AZERTY. Les deux ne partagent pas la rangée du haut : la touche « 1 »
du QWERTY est la touche « & » de l'AZERTY. Les lettres sont touchées aussi
(A↔Q, Z↔W, M↔virgule) et le tiret d'une référence arrive en « ) ».

`src/lib/douchette.ts` repasse la saisie par la disposition inverse, à partir
des quatre rangées écrites touche par touche. Trois points à ne pas défaire :

- **⚠️ Les chiffres ne sont jamais retouchés.** Sur AZERTY ils s'obtiennent
  avec Majuscule : les exclure de la table fait qu'une saisie déjà correcte
  (pavé numérique, douchette bien réglée) traverse sans bouger. Sans cette
  exclusion, on casserait ce qui marche.
- **⚠️ Sinon, on ne convertit que si le décalage est prouvé** (« sinon »
  depuis que la clé de contrôle passe devant — section suivante). Deux
  preuves, et deux seulement : un **accent** (é è ç à ù ² ° § µ £ ¨,
  majuscules comprises), que la douchette ne peut pas produire et qu'aucun
  code-barres ne contient ; ou un code **entièrement fait de la rangée du
  haut**, qui est alors un nombre déformé — la balise 1 arrive en « & », et
  sans ce second volet elle ne serait jamais redressée. **Un « & » au milieu
  d'une référence alphanumérique ne prouve rien** : M&S existe, et redresser
  sa référence la détruirait. Quant à « - » et « _ », ils s'écrivent dans de
  vraies références : ils ne sont **dans aucune table ni dans les preuves**
  (le 25 août au soir les a sortis de la table — sur iOS ils ne portent aucun
  chiffre).
- **Le décalage constaté est retenu** (`clavierDecaleRef`) pour le reste du
  comptage : il ne se corrigera pas tout seul, et c'est ce qui rattrape les
  codes sans preuve — une référence sans chiffre, ou un nombre fait des seuls
  3, 4 et 5. ⚠️ Il ne peut plus abîmer un code-barres dont la clé est juste :
  celui-là est rendu tel quel (section suivante).

**Le champ de la balise reçoit le même traitement** : la douchette y écrit
comme dans l'autre, et son `keyboardType="number-pad"` ne contraint que le
clavier tactile — un clavier HID envoie ce qu'il veut.

Le vrai réglage reste côté matériel (passer la douchette en AZERTY par son
code-barres de configuration, ou changer la disposition du clavier physique
dans iOS) ; le correctif rend l'app juste dans les deux cas.

## ⚠️ La disposition d'iOS est celle du Mac, pas celle de Windows (25 août 2026)

Second test de Julien, douchette **Inateck Nano 160D** en Bluetooth :
*« ça ne fonctionne toujours pas correctement »*. L'EAN 8809652585598 du
produit photographié s'affichait `//09?52559/`.

Rejoué caractère par caractère, le constat est sans ambiguïté — **la table de
la première correction était celle d'un clavier français Windows**. Or les
deux dispositions françaises diffèrent sur deux touches, et ce sont justement
des chiffres :

| touche | Windows | **Mac, donc iOS** |
| --- | --- | --- |
| 6 | `-` | **`§`** |
| 8 | `_` | **`!`** |

Le scan arrivait donc en `!!ÀÇ§(É(!((Ç!`, et le module prenait le `!` et le
`§` pour la touche « / » du bas de clavier : onze chiffres redressés sur
treize, **les deux autres abîmés**. Les tables de `lib/douchette.ts` sont
maintenant celles d'iOS (`IOS_FR`), écrites à partir des touches d'une
douchette QWERTY (`US`).

**Et surtout, la clé de contrôle tranche avant toute heuristique.**
`gtinValide` (EAN-8, UPC-A, EAN-13, ITF-14) rend le redressement
**indépendant de la disposition exacte du téléphone** — c'est ce qui manquait,
et c'est ce qui évitera le prochain aller-retour :

- un code **déjà valide n'est jamais converti**, même après un scan décalé
  (le drapeau `force` ne peut plus abîmer ce qui est juste) ;
- un code dont la conversion **tombe juste** est converti, sans avoir besoin
  d'accent ni de rangée du haut. La table Windows est gardée pour ce seul
  arbitrage : son résultat n'est retenu que s'il porte une clé valide, donc
  elle ne peut rien corrompre ;
- les heuristiques (accents, rangée du haut) restent **pour ce qui n'a pas de
  clé** : un numéro de balise, un SKU.

⚠️ **`-` et `_` ne sont dans aucune table de redressement** (`AMBIGUS`) :
« REF-12 » et « SKU_01 » existent, les redresser les détruirait. Sur iOS ils
ne portent plus aucun chiffre de toute façon.

## ⚠️ iOS remplace les apostrophes — donc les touches 3 et 4 (31 août 2026)

Constat de Julien, douchette sur son iPhone : le code **045496428280** arrivait
dans le champ en `À’(’Ç§’é!é!À` et ressortait en **`0’5’96’28280`** — dix
chiffres sur douze redressés, les trois « 4 » perdus, fiche « Article inconnu ».

**Ce n'était pas la table, c'était le champ de saisie.** iOS applique sa
**ponctuation intelligente** au texte tapé : `'` devient `’`, `"` devient `«` ou
`»`. Or sur la disposition française ces deux touches sont **les chiffres 4 et
3**. Le caractère qui arrivait n'était donc dans aucune table, il traversait le
redressement sans bouger, et le code sortait mutilé.

- **⚠️ `autoCorrect={false}` ne la désactive pas**, et React Native n'expose pas
  le réglage iOS (`UITextSmartQuotesType`) qui le ferait. La correction ne peut
  vivre que dans le module — ce qui la rend testable, et vraie sur les deux
  champs (douchette et ouverture de balise).
- **⚠️ Ce n'est pas une régression : le défaut était là depuis le premier jour.**
  Le scan qui avait servi de preuve le 25 août — 8809652585598 — ne porte **ni 3
  ni 4**. Il ne pouvait pas le montrer. À retenir : un code d'essai ne vaut que
  s'il contient les dix chiffres, ou au moins ceux dont la touche est
  substituable.
- **⚠️ La normalisation passe AVANT tout le reste**, clé de contrôle comprise :
  un code ainsi maquillé n'est ni valide ni convertible, donc les trois règles
  suivantes ne peuvent rien pour lui. `normaliserPonctuation` est appelée à
  l'entrée de `redresserSaisie` **et** de `clavierDecale`.
- Le signe indiqué par l'ancienne note du simulateur (« la touche 3 peut arriver
  en `»` ») décrivait déjà ce défaut ; il avait été classé comme une bizarrerie
  du simulateur, alors que c'est le comportement d'iOS.

Tests de garde : `tests/douchette.test.ts`, blocs « défait la ponctuation
typographique d'iOS » et « normalise les quatre substitutions ».

### ⚠️ Et iOS pose une ESPACE avec ses guillemets (31 août 2026, au soir)

Seconde moitié du même défaut, trouvée par Julien après validation d'Android :
*« le mode douchette n'est pas capable de lire tous les codes-barres, problème
uniquement sous iOS »*. Le code **5056635611789** (Blu-ray PM Studios) arrivait
en `50566 35611789`.

**Les treize chiffres étaient justes.** Rien n'était perdu, rien n'était faux :
une **espace** s'était insérée entre le cinquième et le sixième. Ce n'est pas un
défaut de lecture, c'est un caractère de trop — et l'article restait inconnu.

iOS ne se contente pas de remplacer `"` par `«` ou `»` : en français, la
typographie veut une **espace insécable à l'intérieur des guillemets**, et le
champ l'insère. La touche `"` étant celle du **chiffre 3**, tout code-barres
contenant un 3 arrivait avec une espace parasite.

- **⚠️ C'est le sens du guillemet qui place l'espace**, et c'est ce qui a permis
  de trancher : elle était **avant** le 3, donc iOS avait choisi un guillemet
  **fermant** (`»`), qui prend son espace devant. Un ouvrant (`«`) l'aurait
  posée derrière. `normaliserPonctuation` traite les deux sens.
- **⚠️ Les insécables partent sans condition** (U+00A0, U+202F, U+2009, U+2007,
  U+2060) : une douchette transmet de l'ASCII, elle ne peut pas en produire.
- **⚠️ Une espace ORDINAIRE ne part que collée à un guillemet qu'on convertit.**
  Elle s'écrit dans de vraies désignations — même arbitrage que « - » et « _ ».
  Un test le fige (`normaliserPonctuation('REF 001')` inchangé).
- **⚠️ Le correctif du matin ne pouvait pas le voir** : il rendait bien `"` à
  partir de `»`, et s'arrêtait là. Et le code d'essai du matin — 045496428280 —
  **ne porte pas de 3**. Troisième fois que le code d'essai décide de ce qu'on
  trouve : 8809652585598 n'avait ni 3 ni 4, 045496428280 n'a pas de 3. **Un
  code d'essai ne vaut que s'il porte les dix chiffres.**

Tests de garde : `tests/douchette.test.ts`, blocs « retire l'espace qu'iOS pose
avec les guillemets » et « mais une espace ordinaire reste dans une
désignation ».

### Et sur Android (même jour)

**La ponctuation intelligente est propre à iOS** : Android ne substitue rien à
la frappe d'un clavier physique. La normalisation y est une non-opération, elle
ne casse rien.

**Mais Android a sa propre disposition, et c'est celle du PC** — l'AZERTY
d'AOSP, où les touches **6 et 8** donnent « - » et « _ », là où iOS donne « § »
et « ! ». Conséquences, dans l'ordre où elles comptent :

- **Tout code-barres réel passe déjà** : la clé de contrôle arbitre, et la table
  Windows est essayée pour ça depuis le 25 août (test « rattrape aussi un
  clavier français Windows »). Rien à faire de ce côté.
- **⚠️ Restait le numéro de balise**, qui n'a pas de clé : « 168 » arrivait en
  `&-_` et ne se redressait pas, parce que « - » et « _ » ne sont dans aucune
  table — ils s'écrivent dans de vraies références (SKU_01, REF-12) et les
  convertir à l'aveugle les détruirait.
  · `redresserNumero` lève l'ambiguïté **par l'attente du champ** : il n'accepte
    qu'un nombre, donc une table qui en rend un a raison. C'est le seul endroit
    du module où ces deux signes se convertissent, et ça ne doit pas s'étendre
    à `redresserSaisie`.
  · **L'ordre des tables compte** : iOS d'abord, pour qu'un iPhone n'emprunte
    jamais celle du PC.
- **Un SKU contenant un 6 ou un 8 scanné sur Android reste ambigu**, et le
  reste volontairement — même arbitrage que « - » et « _ » sur iOS.

⚠️ **Rien de tout cela n'a été vérifié avec une douchette sur un Android** : la
table du PC est celle d'AOSP, déduite, pas observée. Le jour où une douchette
tourne sur le Pixel, c'est le premier point à contrôler — et un code d'essai
doit porter un **6 et un 8**.

## « Est-ce qu'elle lit TOUS les EAN ? » — le balayage (31 août 2026)

Question de Julien après le troisième correctif. Elle méritait mieux qu'un
exemple : les trois défauts avaient été trouvés un par un, chaque fois avec le
code-barres qu'il avait sous la main, et **chaque code d'essai révélait le
défaut que le précédent ne pouvait pas montrer** (8809652585598 n'a ni 3 ni 4 ;
045496428280 n'a pas de 3). On ne répond donc plus par un exemple.

`tests/douchette.test.ts` passe **les dix chiffres à tous les rangs** d'un
EAN-13 (220 codes : chaque chiffre × chaque position, plus les cent couples),
sur les deux dispositions, sous **six modèles de ponctuation** (guillemet
ouvrant et fermant, insécable étroite, insécable, espace ordinaire), plus les
quatre longueurs normalisées (EAN-8, UPC-A, EAN-13, ITF-14).

**Réponse : oui pour tout ce qui est un EAN.** Et deux gains au passage.

### Règle 2 bis : la rangée du haut, tirets compris

Le balayage a montré un vrai trou, hors EAN : un nombre **sans clé de
contrôle** contenant un 6 ou un 8 restait faux sur Android — `20000-_` au lieu
de `2000068`. Cela vise les codes internes, les compléments EAN-5 des livres,
et les étiquettes maison dont la clé est fausse.

- **⚠️ Ce qui autorise la conversion, c'est que rien d'autre qu'un nombre ne
  s'écrit avec ces seuls signes.** Une vraie référence porte des lettres
  (REF-12, SKU_01, M&S-001) : elle sort de l'ensemble, on n'y touche pas.
- **Deux gardes, et il faut les deux** : au moins un caractère de la rangée
  STRICTE (un « - » seul ne prouve rien), et la conversion n'est retenue que si
  elle rend **des chiffres et rien d'autre**.

### ⚠️ La limite qui reste, et pourquoi on la garde

Sur Android, un nombre **sans clé** composé des **seuls chiffres 6 et 8**
arrive en « -_ » et n'est pas redressé : ces deux signes s'écrivent dans de
vraies références, et aucun autre chiffre n'est là pour prouver le décalage.
Aucune longueur normalisée n'est concernée — la clé les arbitre toutes — et le
champ d'une balise tranche par `redresserNumero`. Sur iOS la question ne se
pose pas : « § » et « ! » n'ont aucun autre sens. Un test fige cette limite
plutôt que de la taire.

### ⚠️ Ce que le balayage ne prouve pas

Il vérifie la conformité à **notre modèle** du clavier et de la ponctuation
d'iOS, pas au comportement réel d'iOS. Ce modèle a été corrigé trois fois en une
journée par des scans réels. Un quatrième écart reste possible ; ce qui a changé,
c'est qu'il ne pourra plus venir d'un chiffre ou d'une position non essayés.

## ⚠️ Le champ de la douchette ne se vidait pas (31 août 2026)

Constat de Julien sur le **Pixel** : *« android : mode douchette non
fonctionnel »*, capture à l'appui — le code s'inscrivait dans le champ
(`à'('ç-'é_é_à`) **et y restait**.

### Le faux diagnostic, et ce qu'il a coûté

J'ai lu ce texte resté à l'écran comme la preuve que le scan n'avait pas été
soumis, et j'ai écrit une validation de secours « fin de rafale » (une
temporisation après la dernière frappe). **C'était faux, et la base le
disait** : les comptages correspondants étaient bien enregistrés — ABC1236 à
12:36:06 et 12:36:11 quand le champ montrait 045496428280, ABC1235 à 13:00:13
quand il montrait 045496425425.

⚠️ **La temporisation a donc été retirée le jour même**, et il ne faut pas la
réintroduire : elle **couperait un code en deux** dès qu'une douchette marque
un temps au milieu de sa transmission, et fabriquerait un article inconnu à
partir d'un code valide. Le suffixe « Entrée » arrive, sur les deux systèmes.
Vérifié au passage sur l'appareil, touches injectées par `adb` :
`KEYCODE_ENTER` **et** `KEYCODE_NUMPAD_ENTER` déclenchent `onSubmitEditing`.

Ce qui reste de cet épisode : un suffixe reçu **comme caractère** (CR dans le
texte plutôt qu'en touche, ce que font certaines douchettes) vaut validation.

### Le vrai défaut

Julien, une fois les deux systèmes en marche : *« le code-barres affiché est en
symbole, pas en chiffre, ce qui laisse penser que le scan n'est pas passé […]
un code inconnu reste dans la barre et impossible à supprimer, donc se cumule
avec le scan suivant, créant un inconnu »*.

`hwInputRef.current?.clear()` **ne tient pas** : la re-render qui suit
`resolveAndRecord` le défait. Deux conséquences, et ce sont exactement les deux
qu'il décrit :

1. on croit que le scan a échoué, et on rescanne ;
2. **le scan suivant se colle au précédent** et fabrique un article inconnu à
   partir de deux codes valides.

Et **aucun moyen de l'effacer à la main** : `showSoftInputOnFocus={false}`, et
un clavier physique appairé empêche de toute façon le clavier tactile
d'apparaître. Pas de retour arrière, pas de croix.

Trois gestes :

- **⚠️ Le champ se vide par REMONTAGE** (`key={\`hw-${hwSeq}\`}`), pas par
  `clear()`. Une vue neuve part de `defaultValue=""` : c'est la seule remise à
  zéro qui ne dépende pas de la synchronisation JS ↔ natif. `clear()` reste, il
  ne coûte rien et suffit le plus souvent. **Ne pas « simplifier » en le
  retirant.**
- **Une ligne de confirmation sous le champ** — « Dernier scan · 045496425425 ·
  <libellé> ». Le champ montre la frappe brute et continuera de le faire ; c'est
  cette ligne, pas lui, qui répond à « est-ce que ça a pris ? ». Le mode
  douchette n'avait **aucun** retour, contrairement au viseur.
- **« Effacer le champ »**, visible seulement quand il y a quelque chose à
  effacer. `hwPlein` est un booléen — il bascule une fois par scan, pas à chaque
  frappe : ce n'est pas le `value` que la note du 25 août interdit.

⚠️ **Et le focus ne revient pas derrière « Article inconnu »** : reprendre la
main sous la feuille y renverrait le scan suivant, qui se collerait au code déjà
saisi. C'est la seconde moitié du même défaut. `illisibleRef` sert à ça — l'état
capturé au rendu ne dit plus la vérité après l'`await`.

### Vérifié

**Par Julien, sur le Pixel puis sur son iPhone, le 31 août 2026** : « le test
est bon, ça marche sur Android », puis, après le correctif de l'espace des
guillemets et un build iOS, « le scan passe, c'est bon des deux côtés » — le
Blu-ray 5056635611789, celui qui porte un 3, servant de preuve. C'est la seule
preuve qui vaille pour ces défauts : un simulateur n'a pas de douchette, et la
capture du champ ne dit rien (voir juste après).

De mon côté, sur l'appareil : APK à jour (source 13:37, APK 13:40, installé à
13:40:09), aucun crash, et **zéro résidu** de mes essais en base — les touches
injectées et le « Ignorer » n'ont écrit ni comptage ni article.

### Piège de méthode : le champ affiche le brut, toujours

Le champ de capture est **non contrôlé** depuis le 25 août : ce qu'on y lit est
la frappe telle qu'elle arrive, jamais le résultat du redressement. Une capture
du champ ne dit donc **rien** sur le redressement — et, on l'a vu ici, rien non
plus sur la validation. **La base tranche en une requête ; l'écran, non.**
Interroger `counts` AVANT de conclure aurait évité tout le détour ci-dessus.

Le redressement de clavier, lui, n'était en cause à aucun moment : la chaîne
reçue sur Android se redresse correctement en `045496428280` (vérifié en
rejouant le module dessus), et elle confirmait même l'analyse de la veille —
apostrophes **droites** (pas de ponctuation intelligente hors iOS), `-` et `_`
pour les touches 6 et 8 (AZERTY de PC).

## ⚠️ Un champ de capture ne se pilote pas par un état React (25 août 2026)

Deux caractères sur treize **manquaient** dans le même scan (`//09?52559/`
contre les treize attendus) : ce n'est pas la table, c'est la capture.

Une douchette écrit treize touches en moins d'un dixième de seconde. Avec
`value={état}` sur le `TextInput`, chaque frappe renvoie au natif un texte
**déjà périmé** — et des caractères disparaissent au milieu du code, sans que
rien ne le signale. Le champ douchette **et** le champ d'ouverture d'une
balise sont donc passés en non contrôlés : `defaultValue=""`, un tampon
`useRef` mis à jour à chaque frappe, lu au moment de valider, et `.clear()`
pour vider. Ne pas y remettre de `value`.

Deux effets remettent les tampons à zéro au changement de mode et de phase :
le champ est démonté, un scan resté en cours ne doit pas ressortir plus tard.

Vérifié par `tests/douchette.test.ts` (16 cas), qui rejoue **le scan réel du
25 août** — `!!àç§(é(!((ç!` → `8809652585598`, majuscules accentuées
comprises — et le même code déformé par un clavier Windows.

**Confirmé par Julien sur son iPhone, douchette Inateck, le 25 août 2026 :
« ça marche, les 13 chiffres passent ».** C'est la seule preuve qui valait
pour la capture — un simulateur n'envoie pas treize touches en un dixième de
seconde.

## « Le téléphone doit rester sur la page et ne pas se verrouiller »

`useKeepAwake('comptage')` dans `Scanner`, donc **un seul point pour les deux
écrans de comptage**. Compter, c'est poser le téléphone sur une étagère : au
verrouillage la page se perd — et une douchette, qui écrit dans un champ, perd
son champ. Le verrou est repris au démontage, en quittant l'écran de comptage,
ce qui évite de vider la batterie une fois le travail fini.

`expo-keep-awake` était déjà installé (dépendance du paquet `expo`, pod
présent) : il n'est déclaré dans `package.json` que pour l'honnêteté, **aucun
`pod install` n'a été nécessaire**.

## Vérifications, et la limite du simulateur

Au simulateur, sur les données réelles : « & » saisi dans le champ balise
ouvre **la balise 1**, et une sonde temporaire a rendu `dispo=true
activation=OK` pour le keep-awake (sonde retirée, `git diff` contrôlé). Rien
n'a été laissé en base — la balise rouverte a été reclôturée, aucun comptage
ni article créé.

**Et sur le téléphone de Julien, le 25 août 2026, les deux points confirmés
en vrai** : « ça marche, les 13 chiffres passent », puis « l'écran ne se
verrouille plus non plus ». Un simulateur ne verrouille jamais son écran : le
keep-awake ne pouvait pas se prouver autrement qu'avec l'appareil en main.

**Le simulateur rejoue le défaut fidèlement, et c'est le meilleur banc
d'essai qu'on ait sans douchette** — corrigé le 25 août 2026, une première
version de cette note disait l'inverse. Son injection de texte passe par la
disposition du **Mac**, celle-là même que suit iOS : taper `8809652585598`
dans le champ douchette fait arriver `!!àç§(é(!((Ç!`, **exactement la chaîne
que la douchette de Julien a produite sur son iPhone**. C'est ce qui a permis
de vérifier la table iOS à l'écran avant qu'il ne reconstruise.

Deux précautions d'emploi, et une seule vraie limite :

- **taper le code voulu, pas le code déformé** : c'est le simulateur qui
  déforme. Les caractères non ASCII envoyés sont de toute façon écartés ;
- la touche 3 peut arriver en `»` plutôt qu'en `"` — ce sont les guillemets
  typographiques de macOS, une substitution du champ de saisie et non une
  différence de disposition ;
- **la rafale, elle, ne se prouve qu'avec la douchette** : l'injection du
  simulateur est trop lente pour reproduire treize touches en un dixième de
  seconde. C'est le défaut de capture, et il a fallu l'iPhone de Julien.

Au passage, confirmé à l'écran : `autoCapitalize="characters"` **fait bien
remonter `À` plutôt que `à`** — d'où les majuscules accentuées ajoutées à la
table et aux preuves. Sans elles, un scan sur deux serait resté faux.

# Les écrans du compteur, mesurés (31 août 2026)

*« Je pense qu'on a beaucoup travaillé sur le compte superviseur mais pas
compteur, sers-toi des skills de design pour vérifier les bugs d'affichage. »*
Deux défauts signalés, plus un audit.

## 1. « Clôturer la balise » chevauchait son voisin — CORRIGÉ

*« Le bouton clôturer en bas de page chevauche les autres boutons au-dessus,
voir les articles ou en attente de code, ça dépend du moment. »*

Mesuré sur le Pixel : **écart de 0 px**, le rouge dessiné PAR-DESSUS le coin
inférieur de la carte. Trois causes qui se cumulent, et il faut les trois :

- **`closeFooterBtn` n'avait pas de `marginTop`** — son voisin `voirScansBtn`
  n'a pas de `marginBottom`, donc rien ne les séparait ;
- **il porte une élévation** (`shadowButton`) : sur Android, un élément élevé se
  dessine **au-dessus** de ses frères. D'où « chevauche » et non « colle » ;
- **la colonne débordait**, et c'est ce qui explique « ça dépend du moment » :
  l'apparition de la rangée « Voir les N articles » change la hauteur totale.

⚠️ **La caméra est le seul élément qui cède la place** (`flexShrink: 1`,
`minHeight: 200`), les deux boutons sont en `flexShrink: 0`. Ne pas inverser :
le cadre suit, `rectCadre` travaille sur la hauteur **mesurée** (`onLayout`),
jamais sur la constante de 340 pt.

Vérifié sur l'appareil, au pixel : les deux écarts valent maintenant **8 dp**
(1841→1862 et 2000→2021), contre 0 avant.

## 2. Le bandeau blanc : Android repeignait l'app — CORRIGÉ

*« La page balises comptées change de couleur dark puis clair »*, puis, la
capture à l'appui : *« quand je passe en dark mode, l'app garde son bandeau
blanc au lieu de suivre le mode système ».*

⚠️ **Une première version de cette note concluait « ce n'est pas le force dark ».
C'était faux**, et l'erreur vaut d'être racontée : j'avais posé
`forceDarkAllowed=false`, vérifié qu'il était bien dans l'APK (`aapt2 dump`,
`0x0101058c=false`), constaté que le défaut persistait, et conclu trop vite. Ce
que je n'avais pas : **l'option développeur « Forcer le mode sombre » était
active sur le Pixel**, et elle est faite pour **ignorer l'opt-out des
applications** — c'est tout son objet.

**La preuve, en deux mesures.** Système en sombre, application relancée :

| | force-dark actif | `setprop debug.hwui.force_dark false` |
|---|---|---|
| bandeau | `#EFF3FF` (blanc) | `#0B0F19` — la vraie valeur |
| corps | `#08090C` | `#F7F8FA` — la vraie valeur |
| bouton « Rejoindre » | `#7361C9` délavé | l'indigo de la charte |

⚠️ **Le bouton est le témoin qui ne trompe pas** : `#7361C9` n'existe dans
aucune des deux palettes. C'est une **inversion de luminance à teinte
conservée** — la signature de l'algorithme d'Android, que le thème sombre de
l'app ne produit jamais (son accent est `#6366F1`, saturé). Quand une couleur
observée n'est dans aucune palette, ce n'est pas le code qui peint.

⚠️ **Et le bandeau sombre n'est PAS un défaut** : `headerBg` vaut `#0B0F19` en
clair et `#060910` en sombre — le « bandeau encre » de la charte, sombre dans
les deux thèmes, comme sur le site. C'est justement parce qu'il est
volontairement sombre que l'inversion d'Android le rendait **blanc**. Ne pas
« corriger » ça : un test fige les deux valeurs.

**Deux réglages, et ils ne valent que l'un par l'autre :**

- **`plugins/withAndroidForceDark.js`** pose `android:forceDarkAllowed=false`.
  Il protège tout le monde — sauf qui a activé l'option développeur, et là il
  n'y a rien à faire depuis le code. Cela ne peut pas passer par `app.json`
  (`userInterfaceStyle` n'écrit qu'une chaîne lue par expo-system-ui) et
  `android/` est généré : d'où le plugin.
- **`userInterfaceStyle` passe de `light` à `automatic`** — et c'est un **second
  défaut, réel**, trouvé en démontant le premier. Avec `light`, expo-system-ui
  posait `MODE_NIGHT_NO` sur l'activité, **`useColorScheme()` rendait toujours
  'light'**, et la préférence « Système » du sélecteur de thème ne pouvait
  **jamais** donner le sombre. Sur les deux plateformes, depuis toujours.

⚠️ **Et côté iOS, la même clé vit dans un fichier VERSIONNÉ.**
`ios/Inventaire/Info.plist` portait `UIUserInterfaceStyle = Light`, qui fige
`useColorScheme()` sur 'light' exactement comme MODE_NIGHT_NO le fait sur
Android. Contrairement à `android/`, `ios/` ne se régénère pas au build :
changer `app.json` ne suffisait pas, il a fallu **retirer la clé à la main** —
c'est ce que « automatic » veut dire. Un test le fige. Le piège se reposera à
chaque réglage de `app.json` qui touche l'iOS : vérifier ce que le plist
versionné en dit.

⚠️ **Les deux ensemble, jamais l'un sans l'autre** : `automatic` sans le plugin
laisserait Android repeindre l'app dès que le système passe en sombre. Un test
de `tests/compte.test.ts` refuse qu'on défasse l'un des deux.

**Ce qui a été écarté en chemin** : les cinq fichiers du gabarit Expo
(`themed-text`, `themed-view`, `hint-row`, `app-tabs.web` et leur
`@/constants/theme`) forment un **second système de thème** — la famille exacte
du bandeau blanc du 29 août — mais **aucun n'a d'appelant réel**, ils ne se
citent qu'entre eux. Code mort à supprimer un jour ; ce n'était pas la cause.

⚠️ **Sur le Pixel de Julien, l'option développeur reste à couper à la main** :
Options pour les développeurs → « Forcer le mode sombre ». J'ai posé
`debug.hwui.force_dark false` par adb pour la démonstration — ça ne survit pas
à un redémarrage.

## 3. L'audit déterministe, et ce qu'il a trouvé

⚠️ **Le script du skill `deterministic-design` exige un DOM : inapplicable.**
C'est la **méthode** qui se porte — mesurer plutôt que se fier à l'œil — et
l'équivalent Android existe : `uiautomator dump` donne les bounds exacts de
chaque nœud, la capture donne les couleurs. Outil dans le bac à sable
(`audit.mjs`) : collisions, alignements, rythme vertical, cibles tactiles.

Constat systématique sur les cinq écrans du compteur : **les cibles tactiles
sont sous le minimum Android de 48 dp**, et les pires sont partagées avec le
superviseur.

| cible | mesure | où |
|---|---|---|
| bouton thème et bouton profil | **32 × 32 dp** | `HeaderActions`, tous les écrans |
| « Clôturer » du bandeau de zone | **77 × 34 dp** | écran de scan |
| onglets Caméra / Manuel / Douchette | 39 dp de haut | écran de scan |
| « Quitter l'inventaire » | 45 dp | Ma progression |
| « Ouvrir » et le champ balise | 46 et 47 dp | écran de scan |
| lampe torche, et un bouton d'accueil | 40 × 40 dp, **sans libellé** | scan, accueil |

Rien de tout cela n'est corrigé — c'est une passe à part, et elle touche les
deux rôles.

## 4. La passe sur les cibles tactiles (31 août 2026)

Le minimum est **48 dp sur Android**, 44 pt sur iOS. Relevé écran par écran sur
le Pixel, puis corrigé.

⚠️ **Une cible se mesure zone tactile comprise, pas au rectangle de la vue.**
`hitSlop` n'apparaît PAS dans l'arbre d'accessibilité : la mesure brute
sur-signale, et la première lecture allait faire « corriger » la torche
(40 + 2×8 = 56, très bien) et les boutons d'en-tête (32 + 2×8 = 48, corrects).
**Le nombre pointe, le code tranche** — vérifier le `hitSlop` avant de toucher.

⚠️ **Et deux `hitSlop` voisins ne doivent pas se chevaucher.** Les deux boutons
d'en-tête font 32 dp avec un slop de 8, séparés de 8 : leurs zones mordaient
l'une sur l'autre de 8 dp, et dans cette bande c'est **le dernier rendu** qui
prend l'appui. **L'écart passe à 16** — les deux zones de 48 se touchent
exactement au milieu.

⚠️ **La pastille, elle, NE GRANDIT PAS, et c'est une leçon payée.** Premier
jet : 32 → 40 dp avec un slop de 4. Aucun gain — elle était **déjà** à 48 de
cible — et sur **iOS 26** les ronds remplissaient alors la **capsule que le
système dessine lui-même** autour des boutons de barre (Liquid Glass), d'où un
double habillage. Constat de Julien, capture à l'appui : « problème avec les
boutons sous iOS uniquement ». Reverti le jour même.
· `react-native-screens` expose bien `hidesSharedBackground` / `sharesBackground`
  pour cette capsule, mais **react-navigation ne les remonte pas** : on ne peut
  pas la désactiver depuis le code de l'app.
· La règle qui reste : **c'est le `hitSlop` qui fait la cible, pas le dessin.**
  Mesurer avant d'agrandir, et n'agrandir que ce qui est réellement sous 48
  zone tactile comprise.

| cible | avant | après |
|---|---|---|
| bouton thème, bouton profil | zones qui se chevauchent | **écart porté à 16 dp** |
| onglets Caméra / Manuel / Douchette | 39 dp | `minHeight: 48` |
| champ balise et bouton « Ouvrir » | 47 et 46 dp | `minHeight: 48` |
| « Quitter l'inventaire » | 45 dp | `minHeight: 48` |
| « Clôturer » du bandeau de zone | 34 dp | 34 + slop 7 = **48** |

⚠️ **« Clôturer » garde sa pastille compacte** et gagne du `hitSlop` plutôt que
de la hauteur : le bandeau de zone doit rester une rangée, pas un bloc. Le
risque d'appui accidentel est couvert — la clôture demande confirmation depuis
le 25 août.

**Deux boutons en icône seule étaient muets** pour un lecteur d'écran : la
lampe torche et le bouton de compte. Ils portent un `accessibilityLabel`, et
celui de la lampe dit son **effet** (« Allumer » / « Éteindre »), pas son nom.

⚠️ **Ce qui n'a PAS été touché** : les cartes de la liste (104 dp), les champs
de saisie (51 dp) et les boutons pleins (56 dp) étaient déjà au-dessus. Une
passe de ce genre se juge sur ce qu'elle laisse tranquille.

Tests de garde : `tests/compte.test.ts`, bloc « les cibles tactiles atteignent
48 dp ».

# La prise en main sur le site (1er septembre 2026)

*« Il faut pouvoir consulter la prise en main sur le site, dans la boîte à
outils. »* Maquette validée avant codage :
https://claude.ai/code/artifact/c9c8d51d-0d78-4521-b8b4-61e52740e9c3

L'application donne ses repères **au moment du geste, une fois**, puis se tait —
c'est ce qui les rend lisibles. Restent deux besoins qu'un repère ne couvre
pas : les **revoir** quand on ne s'en souvient plus, et les **montrer** à
quelqu'un qui n'a pas encore le téléphone en main. C'est tout ce que fait cette
page.

## Ce qui existait déjà, et ce qui a été ajouté

Le créneau était en place : un panneau « Prise en main de l'application » sur
`/outils`, bouton désactivé, badge « Bientôt ». Il n'y avait rien à ajouter à
cette page — le bouton s'active et mène au guide.

- `web/lib/priseEnMain.ts` — **la source unique** : deux parcours, treize
  étapes, la date des captures et le drapeau de péremption.
- `web/app/outils/prise-en-main/page.tsx` — la page.
- `web/public/prise-en-main/` — treize captures, 900 Ko, reprises du deck.

## Ce qui porte cette page

- **⚠️ Chaque étape CITE le repère que l'application affiche à ce moment-là.**
  C'est ce qui relie le guide à l'app au lieu d'en faire un document
  parallèle : un superviseur qui forme une recrue dit exactement ce qu'elle
  lira ensuite sur son téléphone. Un test refuse une étape sans repère.
- **Une page à part, pas un dépliant dans le panneau.** Treize étapes y
  feraient trois écrans de haut et enterreraient les balises et les modèles. Et
  une page a une adresse : elle se met en favori, s'envoie à une recrue,
  s'ouvre sur un second écran pendant qu'on montre le téléphone.
- **⚠️ Elle s'imprime, et les DEUX parcours partent sur le papier** — l'onglet
  masqué à l'écran ne l'est plus (`.pem-cache { display: block }` sous
  `@media print`), le rail et les commandes sortent, et une étape ne se coupe
  pas en deux (`break-inside: avoid`). Une feuille affichée en réserve vaut
  mieux qu'un lien.
- **Aucune migration, aucune RPC, aucun droit nouveau.** La page est statique
  (`○` dans la table des routes) et derrière la garde superviseur existante.
- **`<img>` et non `next/image`** : ces PNG sont servis en demi-résolution et
  jamais redimensionnés côté serveur, et une balise simple s'imprime — ce que
  le composant optimisé ne garantit pas.

## ⚠️ Les captures vieillissent, et la page l'avoue

**Elles datent du 24 août.** Depuis, l'écran de comptage a changé trois fois
(cadre du viseur, liste des scans derrière un bouton, trace « Dernier scan »),
et les quatre repères du compteur datent du 31 août.

**C'est exactement ce qui a tué le tutoriel intégré** : il décrivait des écrans
disparus, et la note du dépôt en interdit le retour pour cette raison. D'où
deux garde-fous plutôt qu'un silence :

- `CAPTURES_LE` s'affiche **en clair** sous le titre ;
- `CAPTURES_A_REFAIRE` fait apparaître un bandeau qui dit que les gestes sont à
  jour mais que certains écrans ne le sont plus. **Le passer à faux se fait
  dans le même commit que les captures refaites, jamais avant.**

⚠️ **La passe de captures demande une session dans le simulateur, donc une
connexion — que je ne peux pas faire.** Le reste est outillé :
`docs/entreprise/deck/preparer-captures.js` prend les captures brutes
(1206 × 2622, iPhone 17), les réduit à 603 px et **masque les adresses du
compte d'essai** — ce passage n'est pas cosmétique, le guide les afficherait
sinon.

## Vérifications

Le harnais e2e ne couvre pas `/outils` (la garde n'y devient jamais `ready`
sous le faux Supabase) : contrôle par **route jetable publique**
(`web/app/tmp-pem/`, retirée, `git status` contrôlé), servie par le serveur de
développement et regardée dans le volet navigateur. **Clair et sombre**, à
1280 px et à 760 px : quatre colonnes puis deux, et
`scrollWidth - clientWidth = 0` aux deux largeurs — **aucun débordement
horizontal**. 763 tests du site, `next build` avec `/outils/prise-en-main` en
route statique.

Tests de garde : `web/tests/prise-en-main.test.ts` — dont celui qui vérifie que
**chaque capture citée existe réellement** : une image manquante ne casse pas
le build, elle laisse un cadre vide dans un guide qu'on remet à une recrue.

# Le tour de l'application — profil compteur (31 août 2026)

*« L'onboarding, et le tour de l'app, il est incomplet. »* Maquette validée
avant codage : https://claude.ai/code/artifact/ebdfe136-f726-4c5f-b55e-eb5e2e56a3f4

Les huit repères existants couvrent la **première ouverture**. Passé ce moment
l'application n'explique plus rien — et ce qu'elle tait est ce qui coûte cher.
Quatre pièces posées côté compteur ; l'état vide de l'accueil, cinquième point
de la maquette, **existait déjà** depuis le 28 août.

| pièce | quand | nature |
|---|---|---|
| Deux listes, et la différence compte | à la première mise en attente | repère `file-attente` |
| Aucune balise en attente | quand la file **se vide après** s'être remplie | **état**, rejoué, une ligne |
| Trois façons de scanner | entrée en phase article | repère `modes-de-scan` |
| Une erreur se corrige | deuxième scan du même article | repère `corriger-scan` |

## ⚠️ Sur l'écran de comptage, un repère RECOUVRE — il ne pousse pas

Premier jet : deux cartes glissées dans la colonne, comme sur la maquette.
**Compté avant de le construire, et ça ne tenait pas.** L'écran de comptage est
une colonne à **hauteur fixe** — bandeau de zone, bascule des modes, scan
automatique, caméra, déclencheur, liste, clôture. Sur un iPhone SE la somme
atteint déjà la hauteur utile : une carte de plus et le bas sort de l'écran,
même avec la caméra réduite à son minimum.

Ces deux repères passent donc par le **volet** déjà en place, qui gagne deux
genres (`modes`, `corriger`). Il recouvre au lieu de pousser : il ne peut rien
faire déborder, et c'est déjà le format des deux repères du premier scan.

**La carte en ligne (`components/Astuce.tsx`) ne sert que sur un écran qui
défile** — « Ma progression » est un `ScrollView`, là elle ne casse rien. Un
test fige les deux règles.

## Ce qui porte ces repères

- **⚠️ Jamais deux aides à la fois.** « Trois façons de scanner » attend que le
  volet de la balise soit refermé ; « une erreur se corrige » ne s'ouvre pas
  par-dessus un volet en cours (`voletRef`, lu depuis `setRecentScans` où
  l'état capturé au rendu ment déjà).
- **⚠️ Le moment fait la moitié du travail.** « Deux listes » n'apparaît que
  lorsqu'une balise est **réellement** en attente : une explication donnée
  avant que la question ne se pose n'est pas lue. Et « une erreur se corrige »
  attend le deuxième scan du même article.
- **« Aucune balise en attente » n'est pas un repère mais un ÉTAT**, sans
  marquage : il revient chaque fois que la file se vide. C'est lui qui rend
  « en attente » remarquable — sans le contraste, l'ambre ne se voit pas.
  · **⚠️ Il tient en UNE LIGNE, sans corps de texte** (demande de Julien, dans
    ces termes : « un message plus court, type *no pending stickers* »). Un
    état permanent se relit à chaque ouverture : un paragraphe y cesse d'être
    lu et vole la place de ce qu'il faut vraiment voir, l'encart ambre d'en
    face. D'où `children` facultatif sur `Astuce` — un **repère** explique donc
    il a un corps, un **état** se contente de son titre.
  · Le libellé est le **miroir exact** de l'encart ambre (« N balises en
    attente d'envoi ») : même mot, même grammaire, la comparaison se fait sans
    y penser.
  · **⚠️ Et il n'apparaît QU'APRÈS une attente**, jamais en permanence (second
    constat de Julien, le même soir). Affiché tout le temps, il annonce un
    non-événement à quelqu'un qui n'a jamais rien vu attendre — du vert en haut
    de l'écran, tous les jours, qu'on cesse de voir. Le verrou `attenteVue` se
    met quand la file se remplit et ne se relâche pas : **c'est la séquence qui
    informe** — l'encart ambre, sa disparition, puis la ligne verte — pas la
    ligne seule. Deux constats de dosage sur le même élément en une heure : un
    état permanent coûte plus cher qu'il n'en a l'air.
- **Les nouveaux volets se marquent à la FERMETURE**, pas à l'ouverture comme
  les deux anciens : ils expliquent au lieu d'annoncer, donc tant qu'on n'a pas
  fermé, on n'a rien lu.
- **L'astuce n'invente aucun style** : fond `surface`, filet `hairline`, rayon
  `lg` — la carte des autres écrans. Un repère qui se dessine autrement se lit
  comme une publicité.
- **⚠️ L'icône se cale sur la PREMIÈRE ligne du titre** (`flex-start` plus un
  décalage de −5, la moitié de l'écart entre l'icône de 30 et l'interligne de
  20). Avec `center` elle flottait au milieu d'un titre de trois lignes, loin
  du mot qu'elle annonce.

## Typographie : les espaces qui empêchent les coupures

Demande de Julien : *« je ne veux voir aucun débordement, mot coupé à la ligne
etc. »* En français, `:` `;` `?` `!` sont précédés d'une espace **insécable** —
avec une espace ordinaire, le signe peut commencer une ligne. Même chose entre
un nombre et son unité (`142 pièces`). Appliqué aux textes ajoutés **et** aux
deux dialogues de l'écran de progression.

## Vérifications

Le Pixel ayant été débranché, contrôle au **simulateur par une route jetable**
(retirée, `git status` contrôlé) rendant l'astuce dans quatre cas : nominal,
succès, **titre de trois lignes avec un nombre à sept chiffres et
« anticonstitutionnellement »**, et une seule ligne. **Clair et sombre.** Aucun
débordement, aucun signe double en tête de ligne, l'icône alignée sur la
première ligne dans les quatre cas.

**Les deux nouveaux volets sont validés** par Julien sur le Pixel le 31 août
2026 au soir — « j'ai vu les volets, c'est bon ». C'était le dernier point que
je n'avais pu que déduire : je ne les ai pas provoqués moi-même, le second
demandant de scanner deux fois le même article, donc d'écrire dans sa session.

⚠️ **Piège de méthode du jour** : `./scripts/pixel.sh | tail -5` rend le code de
sortie de `tail`, pas celui du script. Un build qui n'a **pas** pu installer
(téléphone débranché) est alors rapporté « exit code 0 ». Lire la dernière
ligne, pas le code.

Tests de garde : `tests/compte.test.ts`, bloc « le tour de l'application, côté
compteur ».

# Le tour de l'application — profil superviseur (31 août 2026)

Même maquette, même règle posée par Julien : *« tu ne changes rien, tu adaptes
uniquement le contenu ».* Deux repères ajoutés, deux textes adaptés — et une
pièce de la maquette **abandonnée**.

| pièce | où | nature |
|---|---|---|
| Balise, emplacement, plage | Zones | repère `balises-vocabulaire` |
| Deux fichiers, deux rôles | Fichiers | repère `fichiers-roles` |
| Le choix du mode est définitif | Nouvel inventaire | **texte**, forme inchangée |
| La clôture compte ce qui reste | Fiche d'inventaire | **texte**, forme inchangée |

## ⚠️ « La progression compte des balises » n'a PAS été ajouté

La maquette le proposait. **L'écran le dit déjà**, mot pour mot : « % des
balises comptées », « % des balises auditées ». Un repère qui explique ce qui
est écrit à l'écran n'est pas un repère, c'est du bruit — et il aurait
consommé le crédit d'attention des trois autres. En mode classique la question
ne se pose pas non plus : l'écran affiche un **nombre de pièces**, pas un
pourcentage. Un test fige cette absence, pour qu'on ne « complète » pas un jour
en croyant qu'il manque.

## Ce qui porte ces quatre pièces

- **⚠️ Deux ne sont pas des repères mais des adaptations de texte**, et la forme
  ne bouge pas : le choix du mode reste un `Switch` — pas les deux cartes de la
  maquette — et la clôture reste le même `demander`. Un test vérifie les deux.
- **Le texte du mode ne décrit plus le mécanisme, il dit ce que le choix
  CHANGE** — compter à plusieurs sans se gêner, l'avancement rayon par rayon —
  puis, seul en gras, **ce qu'on ne peut pas deviner : « Ce choix ne se change
  plus après la création. »** Le mécanisme, on le découvre à l'écran suivant ;
  l'irréversibilité, jamais.
- **La confirmation de clôture COMPTE CE QUI RESTE** : « 3 balises sur 10
  n'ont pas été comptées. Elles compteront pour zéro dans le rapport. » C'est
  le seul chiffre qui puisse faire changer d'avis, donc il passe **avant** le
  reste du texte. Aucune requête nouvelle — `zoneMissing` est déjà sur l'écran.
- **Les deux repères sont posés sur des écrans qui DÉFILENT** (`zones.tsx` et
  `import.tsx` sont des `ScrollView`). Même règle que côté compteur : une carte
  ne s'insère que là où elle ne peut rien faire déborder.

## Vérifications

Au simulateur, par une route jetable (retirée, `git status` contrôlé), **clair
et sombre** : les deux astuces et le texte du mode. Aucun débordement, aucun
signe double en tête de ligne, l'icône alignée sur la première ligne.
Espaces insécables renforcées là où une largeur plus étroite couperait mal
(« étiquette à scanner : », « 1000 à 1049 »).

⚠️ **Non vu dans l'application elle-même** : ces écrans demandent une session de
superviseur, et le téléphone de test est connecté en compteur. Ce qui est
vérifié, c'est le rendu des composants avec leur texte réel — pas leur place
dans l'écran complet.

Tests de garde : `tests/compte.test.ts`, bloc « le tour de l'application, côté
superviseur ».

# L'écran de scan : le cadre, le retour, l'objectif (29 août 2026)

Trois défauts trouvés en exerçant le comptage sur un vrai téléphone.

## ⚠️ `getAvailableLensesAsync` rend le NOM LOCALISÉ, pas l'identifiant

Le plus coûteux, et invisible : côté natif, expo-camera fait
`availableLenses.map { $0.localizedName }`, et compare `selectedLens` **au même
nom**. Une liste écrite en identifiants — `builtInTripleCamera`,
`builtInDualWideCamera` — ne correspond donc **jamais**.

Conséquence : aucun objectif sélectionné, donc `defaultBackCamera`, qui rend
**`builtInWideAngleCamera`** — l'objectif simple, qui ne fait pas le point sous
une dizaine de centimètres. **La mise au point rapprochée était hors d'atteinte
depuis le 13 août**, et rien ne le signalait : la caméra marchait, elle ne
faisait simplement plus le point de près.

L'objectif se cherche donc par ce que son nom **dit**, dans la langue du
téléphone : « triple », « double », « dual », accents et casse ignorés. Un
périphérique virtuel embarque l'ultra grand-angle et laisse iOS basculer en
macro. ⚠️ **Toujours pas l'ultra grand-angle seul** : son champ à 0,5× rendrait
les codes minuscules à distance normale.

⚠️ **Un bouton macro ne sert à rien** — essayé, retiré. Le code natif dit
pourquoi : `videoZoomFactor = 1.0 * pow(max, zoom)`, et `zoom = 0` est **déjà**
le défaut. Le bouton mettait le zoom là où il était.

⚠️ **`autofocus` est bien réglé et ne se touche pas** : `off` (le défaut) vaut
`.continuousAutoFocus`, `on` vaudrait « faire le point une fois puis
**verrouiller** ». Le commentaire du fichier disait vrai — c'est l'objectif qui
était en cause, pas le mode de mise au point.

## Le cadre fait loi

`onBarcodeScanned` travaille sur **toute l'image**, pas sur le cadre dessiné :
un code posé sur la table ou imprimé sur le carton d'à côté était compté comme
s'il avait été visé. Le filtre teste **le centre** du code contre le cadre —
pas son débordement, un code-barres qui dépasse un peu ayant bel et bien été
visé.

⚠️ **Il laisse passer quand la position est inconnue.** expo-camera prévient
que `bounds` « peut représenter un rectangle vide » : refuser dans ce cas
rendrait des codes illisibles sans que rien ne l'explique.

⚠️ **Le viseur est passé à 340 pt, et c'est ce filtre qui le permet.** Agrandir
sans lui aurait aggravé le problème — plus de surface visible, plus de codes
ramassés au passage. Les deux ne tiennent qu'ensemble.

⚠️ **Une seule définition de la géométrie** (`rectCadre`), lue par le dessin
*et* par le filtre. Deux définitions dériveraient au premier ajustement, et le
cadre cesserait de dire la vérité — le défaut même qu'on ferme.

La liste des scans est passée derrière « Voir les N articles scannés » (absent
tant que rien n'est scanné), dans un **voile posé sur l'écran, pas une
`Modal`** : la fiche « article inconnu » en est une, et iOS refuse d'en
présenter deux. Ce qui rend le geste sûr, c'est que « Dernier scan » — qui
affiche désormais **le code-barres, pas le libellé** — répond déjà à « est-ce
que ça a pris ? ».

## Deux cartes de confirmation, une seule forme

⚠️ **La question du retour se pose TOUJOURS**, plus seulement sur une balise
ouverte. Elle ne protège pas une donnée, elle rattrape un doigt qui glisse — et
ça arrive autant sur une balise consultée. Ne pas la reconditionner.

⚠️ **Et elle a la même forme que la clôture** : « Annuler » à gauche, l'action
à droite en bouton plein. Le 25 août, « Rester » en bouton plein était cohérent
isolément et **faux à côté de la clôture** : une carte où le bouton plein
annule et l'autre agit inverse le geste d'un écran à l'autre, et on finit par
appuyer à droite sans lire. La clôture, elle, porte le rouge du bouton qui
l'ouvre — mais garde le surtitre « Confirmation », le défaut du ton `danger`
étant « Action définitive », ce que clôturer n'est pas.

## Le bandeau de démarrage ne tient plus à un jalon d'appareil

L'étape « Générer mes balises » se coche sur un **jalon local** : changer de
téléphone la remet à faire, et le bandeau revenait à quelqu'un qui a une équipe
et des inventaires depuis des semaines. `demarrageAcquis` clôt donc le
démarrage sur les deux faits qui vivent **en base** — équipe constituée et
inventaire créé —, qui suivent la personne d'un appareil à l'autre.

Tests de garde : `tests/comptage.test.ts` et `tests/compte.test.ts`.

# L'écran des écarts d'audit, revu (29 août 2026)

*« Revois l'interface de la page écarts d'audit, la section écarts arbitrés ne
convient pas. »* Capture à l'appui : en mode sombre, la section s'affichait dans
un **bandeau blanc**. Maquette validée avant codage, variante retenue par
Julien : https://claude.ai/code/artifact/ffce86dc-d20c-4eee-aef0-0a8cfb4d1e53

## ⚠️ Le bandeau blanc venait du gabarit Expo

`components/ui/collapsible.tsx` était un **reste du gabarit de départ** :
`ThemedView`, `@/constants/theme`, `@/hooks/use-theme`, `expo-symbols` — un
autre système de thème que celui de l'app (`@/constants/ink`, `@/lib/theme`).
Il ne pouvait donc pas suivre le mode sombre, et il n'avait **aucun autre
appelant**. Supprimé, pas adapté : une pièce qu'un seul écran utilise et qui
vient d'ailleurs se retire.

À retenir : quand un composant ne respecte pas le thème, regarder **d'où il
importe ses couleurs** avant de le corriger.

## Ce que la section est devenue

Une **liste**, pas une pile de cartes — ce sont des affaires réglées, elles
doivent peser moins qu'un écart ouvert. Un titre `baliseTitle` et une pastille
de compte, comme les groupes de balises juste au-dessus ; une seule carte, des
lignes séparées par un filet ; les trois chiffres nommés (Compteur, Auditeur,
Retenu en accent) et « Annuler l'arbitrage » en gris à droite.

- **Le badge « Arbitré » a disparu** : il répétait le titre de la section.
- **La ligne porte sa date** (« hier »), comme sur le site, et **le SKU ne se
  répète pas quand il EST déjà le titre** — un article sans libellé s'affiche
  sous sa référence.
- Au-delà de cinq, la liste se replie derrière « Voir les N autres ».

## ⚠️ Annuler un arbitrage se confirme

Le site demandait confirmation, l'app annulait **au premier appui** — sur une
liste qu'on fait défiler, et pour défaire une décision. `confirmAnnuler` pose
la question ; **le bouton de refus dit « Garder »**, parce que deux « Annuler »
dans la même carte ne se distinguent pas l'un de l'autre.

**⚠️ Et la cible fait 44 pt** (`hitSlop={{ top: 14, bottom: 14, … }}`). Le
libellé ne fait que 18 pt de haut : au simulateur, un appui posé dessus ratait
la cible **sans que rien ne le signale**. Un mot n'est pas un bouton tant qu'on
ne lui a pas donné sa hauteur.

## Le reste de la page

- **« Corrigés » devient « Arbitrés »** : c'était le même nombre que la section,
  sous deux noms.
- **⚠️ Un zéro ne porte aucune couleur, des deux côtés.** En rouge, « aucun
  écart » se lisait comme un problème ; en vert, un « 0 arbitré » annonçait une
  réussite qui n'a pas eu lieu.
- **La consigne ne s'affiche que s'il y a quelque chose à corriger** — sinon
  elle explique un geste que personne n'a à faire — et une carte verte
  « Aucun écart à traiter » prend sa place, au lieu d'une phrase grise reléguée
  **sous** la section arbitrés.
- **Les quatre chiffres d'un écart tiennent sur une ligne** (demande de Julien
  sur la maquette) : `minWidth: 72` poussait « Écart valeur » au rang suivant
  alors que la largeur de la carte suffit quand chacun se dimensionne sur son
  contenu. `flexWrap` retiré, `gap` à 12, `space-between`.
- `Chiffre` faisait doublon avec `Fig` : une seule définition.

## Deux trouvailles au passage

- **`depuis()` vit dans `src/lib/temps.ts`**, une seule définition pour les deux
  écrans qui datent un événement. `PendingBalisesView` avait sa copie.
  ⚠️ **La précision aux minutes reste là où elle sert** (`{ minutes: true }`) :
  une balise hors ligne surveille un retard qui dure (« il y a 3 h 05 »), un
  arbitrage se date en jours (« hier »).
- **⚠️ `audits.tsx` contenait trois octets nuls**, séparateurs de clé invisibles
  hérités d'une session précédente. Git traitait donc le fichier comme
  **binaire** et n'en montrait plus aucun diff. Remplacés par une espace ; un
  test l'interdit désormais.

## ⚠️ Un écart d'audit s'arbitre, il ne se supprime pas

*« On ne doit pas avoir de bouton supprimer sur la page écarts d'audit, ni sur
l'app, ni sur le site. »* (Julien, 29 août 2026, après avoir demandé à quoi il
servait.) La corbeille effaçait **tous les comptages** de l'article dans la
balise — ceux du compteur comme ceux de l'auditeur — pour couvrir le scan
d'un mauvais article. Ce cas se traite désormais comme les autres : on retient
**0**, et la ligne garde sa trace au lieu de disparaître.

Retiré des deux écrans (`audits.tsx`, `EcartsTab.tsx`) et des deux enveloppes
clientes. **La RPC `delete_audit_line` reste en base** : on retire les appels
d'abord, on supprime l'objet plus tard — règle du projet. Le garde-fou de
VR-007 qui la citait comme « le geste légitime de retrait d'une ligne » a été
récrit : c'est `resolve_audit` qui porte désormais l'arbitrage d'un superviseur
invité, et un test vérifie qu'aucun écran ne rejoint plus `delete_audit_line`.

## Deux boutons tranchent en un appui

*« Sur l'app ajoute les deux boutons Compteur Auditeur pour valider le bon
compte. »* **Le site les avait déjà** ; l'app obligeait à retaper la quantité
à la main. Deux boutons en contour, à largeur égale, portant chacun sa valeur.

- **⚠️ Ils reprennent les couleurs des deux passes.** Premier jet en contour,
  avec une étiquette en capitales et un gros nombre : *« je n'ai pas
  l'impression que ce soient des boutons, intuitivement j'irais saisir la
  quantité dans autre quantité »* (Julien). Ils empruntaient le dessin des
  **cellules de chiffres** — donc ils se lisaient comme de l'affichage, et le
  seul objet qui ressemblait à un bouton était « Retenir », juste à côté du
  champ. Ce sont maintenant deux aplats, dans les couleurs que l'app emploie
  déjà pour les deux passes : **accent pour compter, or (`AUDIT_COLOR`) pour
  auditer** — la paire exacte des boutons « Compter des articles » / « Auditer
  des articles » de l'écran d'inventaire. On réutilise une association déjà
  apprise plutôt que d'en inventer une.
- **⚠️ EMPILÉS, PAS CÔTE À CÔTE.** Le libellé porte les unités
  (« Compteur 3 unités » — un nombre seul ne dit pas ce qu'il compte), et
  « Auditeur 100000 unités » demande ~171 pt. Côte à côte il ne reste que
  **136 pt de texte par bouton** : il faudrait descendre à 11 pt. Sur toute la
  largeur il en reste 300, et la ligne tient quel que soit le nombre — vérifié
  à l'écran en forçant 100000 et 123456, à taille pleine et sans
  rétrécissement. `numberOfLines={1} adjustsFontSizeToFit` reste le filet pour
  les valeurs absurdes.
- **« Retenir » cède le premier plan** et passe en contour : saisir une autre
  quantité est le cas rare, il n'a pas à être le bouton le plus lourd de la
  carte.
- **Le singulier est géré** (`unites()`) : « 1 unité », « 0 unité »,
  « 3 unités ».
- **⚠️ Le site porte les mêmes deux couleurs** (`.btn-compteur` / `.btn-auditeur`
  dans `globals.css`), et « Retenir » y est passé en `btn-ghost` pour la même
  raison qu'ici. **L'or n'est pas un jeton de palette mais une couleur de
  mode** : la même valeur dans les deux thèmes et des deux côtés du produit —
  c'est pourquoi il est écrit en dur (`#FFC349` / `#1A1A1A`) plutôt que dérivé
  d'une variable. Un test compare la valeur du CSS à `AUDIT_COLOR` de
  `src/constants/colors.ts` : les deux bougent ensemble. Le bouton Compteur,
  lui, suit `var(--accent)`, qui vaut déjà l'accent de l'app dans chaque thème
  (vérifié au navigateur : `#6366F1` en sombre, `#4F46E5` en clair).
- **⚠️ Chaque nombre ne s'affiche qu'une fois.** Premier jet vu au simulateur :
  la rangée de chiffres affichait « Compteur 3 · Auditeur 2 » et les boutons
  juste dessous répétaient les mêmes deux nombres à quarante points d'écart.
  La rangée ne garde donc que ce qui se lit **sans se choisir** — Écart et
  Écart valeur.
- **⚠️ « Retenir » ne retient plus l'auditeur en douce.** Un champ vide valait
  la quantité de l'auditeur ; avec un bouton « Auditeur » à côté, cela ferait
  deux contrôles pour le même geste, dont un invisible. Le champ vide demande
  maintenant une saisie.
- La **virgule** du clavier français est acceptée, comme sur le site.

Six styles sans aucun appelant (`passes`, `passChip*`, `badge*`) ont été
retirés au passage.

## Vérifications

Au simulateur, sur les données réelles de « Rayon textile », clair et sombre :
la section sans bandeau blanc, l'état « Aucun écart à traiter » avec deux lignes
arbitrées, la confirmation (« Garder » ne change rien, « Annuler l'arbitrage »
remet la ligne en écart), et **un appui sur « Compteur » qui retient bien 3 là
où le champ retenait 2**. Tous les arbitrages d'essai ont été annulés :
`article_audit` est revenue à l'identique (TF-1003 et TF-1005 en `failed`,
`final_qty` nul, zéro ligne `resolved`).

**Confirmé par Julien sur son iPhone le 29 août 2026**, build refait : « ça a
l'air tout bon ». C'est la seule preuve qui vaille pour les deux boutons de
passe — un simulateur ne dit rien de ce qu'on touche au doigt.

⚠️ **Piège de méthode du jour** : le bouton d'annulation a semblé inerte pendant
plusieurs essais. Ce n'était pas le code — **la cible de 18 pt était trop petite
pour l'appui du simulateur**. Une sonde (fond magenta + `signaler.info`) a
tranché en un essai là où la relecture du code tournait en rond. Quand un appui
ne produit rien, rendre la cible visible avant de suspecter la logique.

Tests de garde : `tests/compte.test.ts`, blocs « les écarts arbitrés se lisent
comme une liste » et « “il y a 3 h” a une seule définition ».

# Les fichiers d'import : « Code Ean », doublons de SKU, modèles (25 août 2026)

Trois demandes de Julien après l'inventaire d'essai « Fwee », et les trois se
tiennent : sa colonne s'appelait **« Code Ean »**, inconnue des deux
`lib/import.ts` — donc tous les EAN sortaient nuls, **donc** les lignes au
même SKU s'écrasaient (« dernière valeur conservée ») au lieu d'être gardées
chacune sous son EAN.

- **`codeean` et `codeean13` sont dans `EAN_KEYS`**, des deux côtés. ⚠️ Les
  deux `lib/import.ts` sont dupliqués (l'app et le site ne compilent pas
  ensemble) : un test de `web/tests/import.test.ts` lit le fichier mobile et
  échoue si les listes divergent.
- **Les doublons de SKU voulus marchaient déjà** — un SKU peut porter
  plusieurs EAN (une taille par code-barres), chaque ligne supplémentaire est
  importée sous son EAN (contrainte UNIQUE (session_id, sku) oblige). Rien à
  « rendre possible » : c'est la colonne EAN non reconnue qui neutralisait ce
  mécanisme. Ne pas « corriger » l'écrasement des vrais doublons (même SKU
  sans EAN distinct) : lui est voulu.
- **Deux modèles à télécharger dans la boîte à outils du site**
  (`web/lib/modeles.ts`, `components/ModelesPanel.tsx`) : Référencement et
  Stock théorique, en `.xlsx` dessinés sur place par la bibliothèque déjà
  vendorisée. **Toutes les cellules sont des chaînes** — c'est ce qui type les
  colonnes en Texte dans Excel et préserve les zéros de tête, le piège que
  l'écran d'import documente. Le modèle Référencement montre le cas des
  doublons : ART-001 sur deux lignes, deux EAN. **Chaque modèle traverse son
  propre import dans un test** — un gabarit dont une colonne ne serait pas
  relue serait pire que pas de gabarit. Pas de fichiers statiques dans
  `public/` : ils divergeraient du code d'import sans qu'aucun test le voie.
  (La boîte à outils de l'app n'a pas ces modèles : un tableur s'ouvre sur un
  ordinateur, et l'import de fichiers est le travail du site.)

Vérifié au navigateur (route jetable, retirée) : le panneau en clair et en
sombre, et les deux téléchargements réels — classeurs relus, cellules en
texte. Tests de garde : `web/tests/import.test.ts`, blocs « Code Ean » et
« les modèles de la boîte à outils ».

# Recompter une balise déjà comptée (25 août 2026)

Question de Julien : *« si un compteur recompte accidentellement une balise
déjà comptée par quelqu'un d'autre, ça efface le précédent compte ou ça
additionne ? »*

**Ça additionne, et rien ne s'efface jamais.** `counts` est en ajout pur :
chaque scan écrit une ligne, la table n'a **aucune policy UPDATE**, et
`set_balise` ne fait que basculer `count_status` / `audit_status` — elle ne
touche pas aux comptages. C'est le même principe qui permet les corrections :
un « − » écrit une ligne négative. Recompter une balise **double donc les
quantités**.

## Ce que voit un compteur, et ce qu'il ne voit pas

Le partage est plus fin qu'il n'y paraît, et il faut le connaître avant de
toucher à cet écran :

- **le détail des lignes est cloisonné.** `getMyScanEntries` demande bien
  toutes les lignes de la balise, tous compteurs confondus (« pour permettre
  la correction »), mais c'est la RLS qui tranche :
  `counts_select_supervisor` rend l'équipe entière, `counts_select_own`
  (`counted_by = auth.uid()`) ne rend que ses propres lignes. **La liste
  s'affiche donc vide à un compteur sur une balise faite par un collègue** —
  vérifié en base, transaction annulée : 0 ligne là où il y en a 29 ;
- **le total, lui, est partagé.** `get_zone_dashboard` est SECURITY DEFINER et
  somme tous les compteurs : le même compteur y lit « balise 1000 · done ·
  23 u. ». C'est la seule donnée que les deux rôles partagent.

## L'avertissement

Il n'y a donc **rien à ouvrir côté serveur** — les droits sur les lignes
restent ce qu'ils sont, et la donnée nécessaire est déjà sur le téléphone. Ce
qui manquait, c'était de la montrer **au bon moment** : à l'ouverture d'une
balise déjà terminée, une question nomme le total (« 13 pièces sur
3 références y sont déjà enregistrées. Vos scans viendront s'ajouter à ce
total : rien ne sera remplacé. »).

Quatre points à ne pas défaire :

- **⚠️ La question se pose AVANT `set_balise`.** Après, la balise serait déjà
  rouverte, et un refus obligerait à la reclôturer — ce qui déplacerait sa
  date de clôture pour rien. Un test de garde vérifie l'ordre des deux appels
  dans le fichier.
- **⚠️ Elle ne se pose PAS depuis « Revenir sur une balise ».** Ce rang affiche
  déjà le total et son bouton dit « Rouvrir » : la personne vient exprès. Une
  question de plus y apprendrait à cliquer sans lire, et la question ne
  servirait plus là où elle compte — le scan d'une étiquette qu'on croit
  neuve. D'où le paramètre `sansAvertir`.
  **⚠️ Amendé le soir même, à la demande de Julien** (« ajoute un pop up
  demande si l'user est sûr de vouloir rouvrir la balise, ça évite les manip
  accidentelles ») : ce rang pose désormais **sa propre** question, courte
  (`rouvrirDepuisListe`). Ce n'est pas l'avertissement ci-dessus qu'on y
  répète — celui-ci apprend un fait, celui-là demande une intention — et le
  motif a changé avec l'ouverture différée : rouvrir n'écrit plus rien, le
  risque n'est plus de perdre l'état de la balise mais de **compter dans un
  rayon fini** après un rang touché du pouce en faisant défiler, sur un écran
  dont la caméra est vive et le scan automatique actif. `sansAvertir` garde
  son sens : ne pas rejouer l'avertissement long.
- **Elle ne nomme personne.** Le total est partagé entre membres, le détail
  non : dire « comptée par Nadia » rouvrirait par l'interface ce que la RLS
  ferme. Un test le vérifie.
- **Elle lit le statut du mode en cours.** Une balise comptée mais pas encore
  auditée ne doit pas déclencher l'avertissement quand on vient l'auditer.
- Le code est normalisé comme en base (`norm_balise` : sans espaces, en
  capitales), sinon le numéro scanné ne retrouverait pas sa ligne.

Hors ligne, le tableau de bord est celui du cache : sans donnée, pas
d'avertissement. C'est la dégradation assumée — on ne devine pas.

## Un défaut du composant de dialogue, trouvé en l'exerçant

Les deux boutons d'une carte de question sont à `flex: 1`, donc à largeur
égale quelle que soit la longueur des libellés. Ils étaient aussi à `height`
**figée** à 44 px : sur la largeur d'un téléphone, « Compter quand même »
passe à la ligne et **le texte débordait de la pastille**. `minHeight`
remplace `height`, avec rembourrage et centrage — le bouton grandit, et le
`stretch` de la rangée donne la même hauteur à son voisin. Ne pas y remettre
une hauteur fixe : le défaut vaut pour toutes les cartes de l'application, pas
seulement celle-ci.

Vérifié au simulateur le 25 août 2026 sur les données réelles : la question à
l'ouverture de la balise 1 (13 pièces / 3 références), « Ne pas ouvrir » qui
**ne touche pas au serveur** (date de clôture inchangée, contrôlée en base),
et « Rouvrir » qui ouvre sans rien demander. Données remises comme trouvées —
50 comptages, 12 articles, balise reclôturée.

Tests de garde : `tests/compte.test.ts`, bloc « rouvrir une balise déjà
comptée ».

# Consulter une balise finie ne la décompte plus (25 août 2026, au soir)

Constat de Julien, sur l'inventaire « Fwee » : *« j'ai ouvert une balise que
j'avais déjà comptée, je n'ai rien scanné, j'ai juste fait retour, et
maintenant Quantinvo conclut qu'aucune balise n'a été comptée, ce qui est
faux. »*

C'était exact, et le mécanisme est court : ouvrir une balise appelle
`set_balise(p_open := true)`, qui écrit `count_status = 'open'` **et efface
`count_done_at`**, sans mémoire de l'état précédent ; et **rien ne refermait
la balise au retour** — les deux seuls appels de fermeture sont le bouton
« Clôturer » et le passage à une autre balise. Il suffisait donc de
**regarder** une balise finie pour que l'inventaire la déclare non comptée.
Les pièces, elles, n'avaient jamais bougé (`counts` est en ajout pur, voir la
section précédente) : c'est l'étiquette « comptée » qui était perdue. Sur
« Fwee », la 1000 étant la seule balise clôturée, la tuile Progression est
tombée à **0 %** avec 23 pièces bien en base.

Ce n'est pas un cas d'essai : sur le terrain, un compteur qui scanne la
mauvaise étiquette puis revient en arrière décompte un rayon fini sans s'en
apercevoir.

## La règle : ce qui n'ajoute rien ne doit rien retirer

Deux niveaux, et **c'est le premier qui porte la garantie** — le second ne
couvre qu'une sortie propre.

**1. Consulter n'écrit rien.** Une balise déjà terminée dans le mode courant
(`rangeeTerminee`) s'ouvre **en local seulement** : sa ligne ne bouge pas, elle
reste `done` avec sa date d'origine. Aucun accident ne peut donc lui faire
perdre son état, puisqu'il n'y a rien à perdre — application tuée, téléphone à
plat, réseau coupé au mauvais moment.

**2. L'ouverture devient réelle au premier geste qui compte.** Scan, « + »,
« − », suppression : tout passe par `enregistrer`, qui appelle
`materialiserOuverture` **avant** d'écrire. C'est un passage obligé, et c'est
ce qui garantit qu'aucune pièce n'atterrit dans une balise que le tableau de
bord croit finie. Un test compte les appels directs à `onArticleResolved` : il
ne doit en rester qu'un, celui d'`enregistrer`.

Points à ne pas défaire :

- **Clôturer ce qui n'a jamais été ouvert ne rappelle pas `set_balise`.**
  L'appel repositionnerait `count_done_at` à maintenant — exactement la date
  qu'on cherche à préserver. `closeBalise` sort avant, sur le drapeau.
- **`rangeeTerminee` n'exige pas que la balise porte des pièces**, contrairement
  à `baliseDejaFaite` qui gouverne l'avertissement : un rayon vide clôturé est
  terminé lui aussi, et le décompter pour l'avoir regardé serait le même
  défaut.
- **L'ouverture différée est un état ET un ref.** L'état sert au garde-fou du
  retour (qui doit se relire au rendu), le ref aux appels asynchrones. Un ref
  seul laisserait le garde-fou périmé après le premier scan.
- **Hors ligne, la dégradation est assumée** : sans tableau de bord des zones,
  `rangeeTerminee` rend `null` et l'ancien chemin reprend — la balise est
  rouverte pour de bon, et c'est alors le garde-fou du retour qui protège.

## Le garde-fou du retour, et le piège de la pile

Quitter le comptage avec une balise **réellement** ouverte pose la question —
« Quitter le comptage ? », *Rester* (bouton plein) ou *Quitter*. Une balise
seulement consultée ne demande **rien** : il n'y a rien à décider.

⚠️ **Cette question ne décide pas d'une clôture, et c'est un amendement du
soir même** (Julien : « il faut prevent from closing/returning by accident »).
La première version proposait *Clôturer* / *Laisser ouverte* : aucune des deux
réponses ne permettait de **rester** — un retour accidentel faisait quitter
l'écran quoi qu'on réponde. Les deux gestes sont désormais séparés :

- **le retour protège la navigation** — la réponse voulue est *Rester*, donc
  c'est elle le bouton plein ;
- **la clôture a sa propre confirmation** (`closeBalise` la pose lui-même) :
  « Clôturer la balise 1 ? — 13 pièces comptées. Vous pourrez y revenir si
  besoin. » Les boutons de clôture sont à portée du pouce pendant qu'on
  scanne, et une clôture de travers annonce un rayon fini qui ne l'est pas.
  **La question nomme le compte** : c'est le seul chiffre qui fasse remarquer
  qu'on n'est pas sur la bonne balise. Le paramètre `silencieux` a disparu
  avec la clôture automatique à la sortie.

Même règle pour « Rouvrir » depuis la liste, dont la question a été
**raccourcie sur capture de Julien** (la note « la simple consultation ne
change rien… » retirée — les cartes de question restent courtes, straight to
the point).

⚠️ **`beforeRemove` ne retient pas cette pile.** Premier essai : l'écran
partait quand même, la question s'affichait par-dessus l'écran d'arrivée, et
le runtime le disait — *« was removed natively but didn't get removed from JS
state […] Consider using a 'usePreventRemove' hook »*. C'est ce hook qui tient
le retour natif **et** le geste de balayage.

⚠️ **Il n'est pas exporté par expo-router**, qui embarque pourtant sa copie de
react-navigation : l'import passe par
`expo-router/build/react-navigation/core/usePreventRemove`. Un test vérifie que
ce fichier existe — sans lui, une mise à jour d'Expo ferait sauter la garde
**en silence**.

La sortie se libère au rendu suivant (`sortieAutorisee` en état, rejoué dans un
effet) : rejouer l'action dans la réponse la ferait reprendre au vol par la
garde encore armée.

⚠️ **`closeBalise(silencieux)` ne se branche jamais nu sur un `onPress`** :
React Native passe l'événement tactile en premier argument, qui vaut vrai — la
clôture au doigt perdrait sa célébration. Attrapé par le typage, gardé par un
test parce qu'un `onPress={closeBalise}` se réécrit vite.

Vérifié au simulateur le 25 août 2026 sur « Rayon textile », tous les chemins :
consulter la balise 1 puis revenir ne demande rien et laisse 25 % (ligne
contrôlée en base, date du 17:25 inchangée) ; compter une pièce rend
l'ouverture réelle et le retour pose alors sa question — *Rester* garde bien
sur l'écran, *Quitter* laisse la balise ouverte en connaissance de cause ; le
balayage est intercepté comme le bouton ; la clôture demande confirmation en
nommant les 13 pièces, *Annuler* restant sur l'écran ; et « Rouvrir la
balise 1 ? » précède l'ouverture depuis la liste, *Annuler* n'ouvrant rien.
Données d'essai remises en état (13 pièces, `done`).

**Et confirmé par Julien sur son iPhone le soir même**, build refait :
« le build est fait déjà et le test est bon » — le scénario qui avait tout
déclenché (ouvrir la balise 1000 de « Fwee », ne rien scanner, revenir) ne
décompte plus rien.

Tests de garde : `tests/comptage.test.ts`.

# Balises : séries imprimées, pas de stock (21 août 2026)

La création de balises ne passe plus par le serveur. Le superviseur choisit
une numérotation (simples `1, 2, 3…`, 4 chiffres `1000…9999`, 5 chiffres
`10000…99999`), un premier numéro et un nombre, et la planche PDF est produite
sur place. **Elle se crée partout où on en a besoin**, avec le mode d'emploi en
trois étapes (imprimer, coller, indiquer) écrit pour des personnes peu à l'aise :

- app : profil et écran Zones d'un inventaire (`BaliseCreator`, formulaire
  `BaliseSheetModal`, dessin `src/lib/balises.ts`) ;
- site : Mon compte et onglet Set up (`BaliseSheetPanel`, dessin
  `web/lib/balisePdf.ts`, téléchargement du PDF dans le navigateur).

La logique des séries est dupliquée volontairement (`src/lib/baliseSeries.ts`
et `web/lib/baliseSeries.ts`, un test garde l'identité : `web/tests/balises.test.ts`).
**Les deux dessins de planche doivent rester identiques** (gabarit Avery L7160,
QR `SCB1:<numéro>`) : une balise imprimée depuis le site doit se scanner comme
une balise imprimée depuis l'app. **Aucun compteur de balises n'est affiché**,
ni dans l'app ni sur le site : personne n'en a l'usage, les zones s'affectent
par plage libre (`define_zone`).

**Une balise hors plage se propose à l'ajout** (21 août 2026). Scanner une
balise qu'aucune plage ne couvre affichait « Balise non définie » avec un seul
bouton : le compteur restait devant une étiquette bien réelle sans moyen
d'avancer. L'alerte propose maintenant « Ajouter », qui rappelle `set_balise`
avec `p_allow_create := true` — la zone est créée sans emplacement, et le
superviseur la nomme ensuite depuis l'écran Zones. La création n'est **jamais**
tentée au premier passage : sans cette précaution, un numéro mal saisi créerait
une zone en silence.

Limite connue : **hors ligne, l'ajout n'est pas proposé**. La file accepte
l'ouverture sans interroger la base, et l'échec ne se découvre qu'à la
synchronisation, où l'opération part dans les échecs (`failedOps`). À reprendre
si le cas se présente en vrai.

La RPC `generate_company_balises` et la colonne `companies.balise_count`
**restent en base** tant que des builds mobiles antérieurs peuvent encore les
appeler — même règle que pour `get_session_activity` : code déployé d'abord,
objets supprimés ensuite. À supprimer dans une migration ultérieure, une fois
le nouveau build installé sur les téléphones ; ne plus rien y lire d'ici là.

# Passes de comptage

`advance_pass` / `revert_pass` ne sont plus exécutables par le rôle
`authenticated` (migration `20260813000002`) : SECURITY DEFINER, elles forçaient
`status = 'counting'` et permettaient à un simple compteur de rouvrir un
inventaire clôturé. `current_pass` n'est plus lu nulle part — la passe se déduit
du mode choisi par chaque participant (Comptage→1, Audit→2). Si les passes
globales reviennent, il faudra rendre le GRANT **et** ajouter la garde
`status <> 'closed'` dans les deux fonctions.

# ⚠️ La grille a été revalorisée le 31 août 2026 — Stripe ne le sait pas encore

*« Monte le prix entreprise à 890 € par mois, base-toi sur ce % d'augmentation
de prix pour les autres offres. Je sais que ça fera trop cher pour Essential
mais on y reviendra plus tard, pour l'instant je veux maximiser la marge sur
Advanced. »*

Enterprise passe de 650 à **890 €/mois**, soit **+36,9 %**, appliqué aux deux
autres offres. Les mensuels sont l'arrondi de ce calcul, les annuels gardent le
rapport d'environ 10,6 mensualités de la grille du 30 août :

| Offre | Avant | Après |
|---|---|---|
| Essential | 65 € / 690 € | **89 € / 950 €** |
| Advanced | 225 € / 2 400 € | **310 € / 3 300 €** |
| Enterprise | 650 € / 6 900 € | **890 € / 9 450 €** |
| Supplément par 10 appareils | 47 € / 500 € | **64 € / 690 €** |

**⚠️⚠️ RIEN N'EST ENCAISSÉ AU NOUVEAU PRIX TANT QUE LES SIX PRICE STRIPE N'ONT
PAS ÉTÉ RECRÉÉS.** C'est le point qui coûte de l'argent, et il ne se voit
nulle part dans le code : le montant prélevé vient du Price désigné par le
secret `STRIPE_PRICE_<OFFRE>_<RYTHME>`, jamais de la grille du dépôt. En
l'état, le site affiche 310 € et Stripe encaisse 225 €. Un Price Stripe **ne se
modifie pas** : il faut en créer six nouveaux dans le tableau de bord, puis
remplacer les six secrets d'edge functions. Aucun redéploiement de fonction
n'est nécessaire pour ça — les secrets se lisent à l'exécution — mais
`subscribe-online` doit tout de même être redéployée pour que sa grille
(affichage et `annual_price_cents`) suive.

⚠️ **REDÉPLOYÉE LE 4 SEPTEMBRE 2026** (version 4, `--no-verify-jwt`, contrôlé
inchangé), le jour où Julien a créé les nouveaux Price. La version en ligne
datait du 30 août et portait encore **l'ancienne grille** : avec les nouveaux
Price posés en secrets, Stripe aurait prélevé 310 € pendant que
`deposer_souscription` inscrivait 225 € dans les lignes de devis et dans
`stores.annual_price_cents`. Le client aurait payé le bon montant et nos
chiffres auraient dit le mauvais — un écart qui ne se voit qu'à la
réconciliation. **Toute revalorisation de la grille se termine par ce
redéploiement.** Vérifié après coup : `supabase functions download` puis
`diff` — les deux fichiers sont identiques au dépôt, et la fonction répond
« Offre inconnue » sur un plan invalide (donc son code est atteint sans JWT).

⚠️ **Un Price archivé ne peut plus ouvrir de paiement.** Stripe ne permet pas
de supprimer un Price, seulement de l'archiver — et un Price archivé continue
d'honorer les abonnements en cours mais **refuse toute nouvelle session
Checkout**. Les six secrets doivent donc porter les identifiants des NOUVEAUX
Price ; sinon l'offre répond 502 et personne ne peut souscrire. L'échec est
visible et sans dégât (la demande reste en `accepted` et remonte dans « Ventes
en cours »), mais il est total.

**⚠️ Les abonnements déjà souscrits gardent leur ancien Price.** Stripe ne
rétro-facture pas : c'est le comportement voulu, mais il faut le savoir avant
de croire qu'un client paie le tarif affiché.

Points à ne pas défaire :

- **La hausse est proportionnelle, donc tous les rapports de la grille sont
  préservés** : le prix par appareil décroît toujours (475 → 165 → 94,5 → 69 €),
  l'empilement reste perdant (10 Essential = 9 500 € contre 3 300 €), et le pas
  de la frontière Essential → Advanced vaut toujours 3,47.
- **⚠️ La marge sous l'ancre de marché a été dépensée.** Enterprise était 31 %
  sous Zebra SmartCount (≈ 10 000 €/magasin/an, confidentielle) ; à 9 450 € il
  est à ~5 %. Et un magasin à 150 appareils paie désormais 12 900 €, donc
  au-dessus de l'ancre — au-delà de cent appareils on sort de toute façon sur
  devis, c'est là que la question se traite.
- **Essential est assumé trop cher** (950 €/an pour deux appareils n'est plus un
  prix d'appel). Julien l'a dit en demandant la hausse : c'est un report, pas un
  oubli. Ne pas « corriger » Essential seul sans qu'il rouvre le sujet.
- **La grille vit dans `web/lib/offres.ts` et sa copie en centimes dans
  `subscribe-online`** ; les CGV (annexe 2) et
  `docs/entreprise/hypotheses-tarifaires.md` ont suivi, et un test compare les
  trois. Les pages publiques qui écrivent « à partir de … » ont suivi aussi.

Ce qui suit décrit le parcours lui-même, écrit le 30 août 2026 avec l'ancienne
grille — les montants qui y sont cités sont ceux de ce jour-là.

# Le parcours de demande passe aux appareils (2 septembre 2026)

*« Changement qui n'a pas été fait quand on a changé notre méthode de
facturation. Tu n'as pas adapté le formulaire d'inscription et le formulaire
d'ajout de magasin. »* Constat de Julien, et il était exact : la grille est
passée aux trois offres le 30 août, le site public affichait les prix — et les
deux formulaires réclamaient toujours un **stock théorique** et une **surface**,
pendant que le devis se calculait sur des tranches de volume. `lib/offres.ts`
le disait lui-même en commentaire : « les deux modules coexistent le temps que
le parcours d'inscription soit repris ». C'est fait.

Quatre migrations : `20260902120001` (l'assiette), `20260902120002` (le chemin
manuel), `20260902120003` (les listes rendent les appareils) et
`20260902120004` (le revenu en attente s'annualise).

## Ce que les formulaires demandent, et ce qu'ils montrent

**Un seul chiffre par magasin : le nombre d'appareils qui comptent EN MÊME
TEMPS.** Le stock et la surface ont quitté `MagasinSaisie`, donc `/inscription`
et la demande d'ajout de magasin.

- **⚠️ Contrepartie assumée, et il faut la connaître** : `alerteDensite` (le
  repérage d'un stock déclaré invraisemblable, qui fait remonter une demande en
  tête de « Ventes en cours ») et l'écran `/admin/usage` n'ont **plus de source
  sur les demandes nouvelles**. Ils ne servent plus qu'aux magasins déclarés
  avant ce jour. `lib/tarifs.ts` ne tarife donc plus rien du tout — il ne
  survit que pour eux. **Ne rien y rebrancher.**
- **Les colonnes `units` et `sqm` restent en base**, comme `stores.units`.
  Règle du projet : on retire les appels d'abord, les objets plus tard.
- **⚠️ L'offre et son prix s'affichent à la frappe, ce qui RENVERSE la décision
  du 22 août 2026.** Elle interdisait d'afficher un tarif en face du champ qui
  le détermine, et elle avait raison tant que ce champ était le stock : déclaré,
  invérifiable, il indiquait au prospect quel chiffre baisser. Le nombre
  d'appareils est d'une autre nature — il se mesure, c'est même la raison pour
  laquelle cette assiette a été retenue — et les trois prix sont publics sur
  /tarifs depuis le 30 août. Les cacher ne protégerait plus rien.
- **Ce qui NE change pas** : le recoupement stock / surface ne sort toujours pas
  de la console, et aucun montant n'est écrit en dur — tout passe par
  `lib/offres`, sinon la grille se met à exister en deux endroits.
- **⚠️ Les DEUX rythmes s'affichent** — « Advanced — 310 € / mois ou 3 300 € /
  an HT par magasin ». Un prospect qui ne lit qu'un montant annuel n'a aucun
  moyen de savoir que le mensuel existe, alors que le devis se règle dans les
  deux. Même paire que la page publique des tarifs.
- `/inscription` totalise en pied de formulaire, **dans les deux rythmes**, et
  **seulement si tous les magasins portent un chiffre** : un total partiel se
  lirait comme un total.
- **⚠️ Un prix ne se coupe pas** (`.prix { white-space: nowrap }`) : `euros()`
  groupe les milliers par une espace ORDINAIRE, et sans cette règle
  « 3 300 € / an » se casse entre le 3 et les 300 sur un téléphone.

## Le devis se règle à l'année OU au mois

Décision de Julien. La console porte une bascule ; le rythme voyage jusqu'au
PDF, jusqu'à la page publique du devis, et jusqu'à Stripe.

- **⚠️ Le rythme décide du MODE Stripe.** Annuel → `mode: payment`, carte ou
  SEPA, facture unique : le chemin vérifié de bout en bout le 22 août, inchangé.
  Mensuel → `creerAbonnementSurMesure`, abonnement carte seule. Un mois ne se
  facture pas en une fois, il se reconduit.
- **⚠️ C'est le seul endroit du produit où un prix Stripe est créé par du
  code**, et l'exception se justifie : la règle « les Prices ne sont jamais
  créés à la volée » protège les trois offres publiques, dont les montants sont
  fixes et posés en secrets. Un devis est l'inverse — son montant est négocié,
  saisi et relu par un administrateur. Aucun Price posé d'avance ne peut le
  porter. Ce que la règle interdit vraiment, c'est un prix que personne n'a relu.
- **Deux clés d'idempotence distinctes** (`checkout-…` et `devis-mensuel-…`) :
  les deux sessions ne portent pas les mêmes paramètres, et Stripe refuse une
  clé rejouée avec d'autres.
- **Changer de rythme recalcule le montant proposé**, sauf si l'administrateur
  l'a lui-même touché. Laisser un montant annuel sous un devis mensuel serait
  la faute la plus coûteuse de cet écran.

## ⚠️ LA RÈGLE DES LIGNES DE DEVIS, à connaître avant d'y toucher

Dans `quote_lines`, **`prixCents` est ce qui est facturé à l'échéance**, et
**`annuelCents` — quand il est présent — ce que le magasin vaut à l'année**.
`fulfil_paid_request` écrit donc `annual_price_cents = coalesce(annuelCents,
prixCents)`.

**Ne jamais annualiser en multipliant par douze selon le rythme.** Une ligne
sans `annuelCents` est annuelle par construction : c'est le cas de toutes celles
écrites avant cette bascule, **et de celles de la souscription en ligne**, dont
`deposer_souscription` écrit un montant DÉJÀ annuel sur une demande
`billing_period = 'monthly'`. La multiplier facturerait douze fois trop cher un
parcours vérifié en vrai le 30 août. Le seul endroit où le rythme décide est le
repli sans aucune ligne chiffrée — parce qu'il n'y a alors rien pour le dire.

## Trois choses trouvées en passant les fonctions en revue

Julien : *« passe en revue les fonctions pour être sûr qu'elles sont adaptées
aux nouvelles offres »*. Trois défauts réels, tous antérieurs à ce chantier.

1. **⚠️ `admin_fulfil_company_request` portait la grille au volume EN DUR** —
   un `case when v_units <= 10000 then 210000 …` dans le corps de la fonction.
   C'est le défaut VR-002 du 28 août (« on crée ce qui a été devisé »), corrigé
   dans le chemin payé et **jamais dans le chemin manuel**. Elle facturait donc
   au volume un client devisé aux appareils. Elle suit maintenant les lignes du
   devis, comme `fulfil_paid_request`.
2. **`admin_add_store` ne portait ni les appareils ni le prix** : un magasin
   créé par ce chemin arrivait sans assiette et sans licence, donc compté au
   panier moyen dans le revenu annuel — le défaut corrigé le 22 août pour le
   webhook, resté ici. Elle prend `p_devices` et `p_annual_price_cents`, et
   `admin_fulfil_store_request` les lui passe.
3. **Trois fonctions de LECTURE ne rendaient pas ce qu'on venait d'écrire.**
   `ca_list_store_requests`, `admin_list_store_requests` et `admin_pipeline`
   rendaient toujours `units` et `sqm` seuls : les écrans auraient affiché
   « appareils non déclarés » sur une demande qui en porte un. Le piège est
   banal et se reproduira : **une colonne ajoutée ne se voit pas tant que la
   fonction qui la lit ne la nomme pas.**
4. **⚠️ « Revenu en attente » divisait par douze sur un devis mensuel.**
   `enAttenteCents` sommait `quote_amount_cents`, c'est-à-dire l'échéance :
   1 200 € affichés pour une affaire qui en vaut 14 400 par an. Le calcul vit
   désormais en base (`annuel_du_devis`), **par la règle des lignes ci-dessus et
   pas par le rythme** — au navigateur, à partir du seul rythme, on aurait
   multiplié par douze le montant déjà annuel de la souscription en ligne.
5. **⚠️ La TVA manquait sur le parcours de devis.** `creerSessionCheckout`
   n'appliquait aucun taux : Stripe encaissait 9 450 € là où 11 340 € sont dus,
   et la différence sortait de la poche de l'éditeur. Seule la souscription en
   ligne avait `STRIPE_TAX_RATE` (posé le 30 août). Le devis l'applique
   désormais aussi — le document dit d'ailleurs « TVA non applicable sur ce
   document », c'est-à-dire que c'est la facture qui l'ajoute.

## Deux pièges de droits, relevés sur la base réelle

- **⚠️ `create` accorde EXECUTE à `anon`**, par les droits par défaut de
  Supabase — un `revoke … from public` ne le retire pas. Vérifié après
  application : `ca_request_store` et les deux `admin_quote_*` étaient
  exécutables par `anon`. C'est le constat n°6 du 28 août, qui se reproduit à
  chaque fonction nouvelle. **Le `revoke` vise `public` ET `anon`.**
- **L'ancienne signature de `ca_request_store` n'est PAS supprimée**, et c'est
  délibéré : le site en ligne et la fonction edge appellent encore avec un stock
  et une surface. Elle devient un **refus lisible** (« rechargez la page »), à
  supprimer dans une migration ultérieure une fois le déploiement fait. Ses
  quatre paramètres n'ont plus de défaut — c'est ce qui interdit l'ambiguïté
  avec la nouvelle sur un appel à deux arguments.

## ⚠️ La fonction edge de la demande de magasin avait été OUBLIÉE

Trouvé au moment de déployer, et c'est le défaut le plus instructif de ce
chantier. La page `/magasins` envoyait `devices` et la RPC avait sa nouvelle
signature — mais **`ca-request-store/index.ts` n'avait jamais été touchée** :
elle appelait encore `p_units` / `p_sqm`, donc l'ancienne signature, devenue un
refus lisible. **Toute demande de magasin passant par le chemin normal aurait
répondu « rechargez la page »** ; seul le repli RPC direct du navigateur
fonctionnait.

- **⚠️ Rien ne l'avait vu, et c'est la vraie leçon.** Le test
  « la demande transporte les appareils » ne regardait que la page. Une fonction
  edge est le chemin **nominal** — la RPC directe n'est qu'un repli —, donc une
  garde qui s'arrête au navigateur ne garde que la moitié du parcours. Le test
  lit désormais aussi `ca-request-store/index.ts` (`p_devices` présent,
  `p_units` et `p_sqm` absents).
- **Le balayage qui a suivi est le geste à refaire** : pour chaque RPC dont la
  signature bouge, chercher **tous** ses appelants dans `supabase/functions`,
  pas seulement dans `web/`. Les autres — `stripe-webhook`, `subscribe-online`,
  `admin-fulfil-store-request`, `decline-quote` — ont été vérifiés un par un et
  restent compatibles (signatures inchangées).
- L'accusé et l'avis interne disent maintenant les appareils et l'offre
  (`nomOffre` du module partagé, jamais un nom d'offre réinventé sur place) ; la
  phrase sur le « recoupement stock / surface » a disparu, elle n'a plus d'objet.

## Les quatre fonctions edge sont déployées (2 septembre 2026)

`quote-pdf` (v16), `ca-request-store` (v14), `admin-send-quote` (v14),
`accept-quote` (v16). `verify_jwt` contrôlé après coup et **inchangé** : faux
pour les deux publiques, vrai pour les deux autres.

⚠️ **Déployées par la console MCP, pas par le CLI** — contrairement à la règle
posée pour `stripe-webhook`. Le CLI n'était pas joignable depuis l'agent (pas de
`SUPABASE_ACCESS_TOKEN`, et les binaires GitHub bloqués par le proxy), et
l'accès réseau sortant vers `*.supabase.co` l'était aussi. **La règle reste
valable et `stripe-webhook` n'a pas été touchée** : elle porte la vérification
de signature, et son bundle garde sa propre copie de `_shared/stripe.ts` — la
version déployée avant ce jour, dont `verifierWebhook` n'a pas changé.

**Ce qui a été vérifié, et par quel moyen** — l'accès sortant étant fermé, tout
est passé par `pg_net` depuis Postgres :

- `quote-pdf` : 404 « Devis introuvable » sur un jeton inconnu ;
- `accept-quote` : 405 sur GET, et sur POST **elle atteint la base** (le
  « Lien invalide. » vient de `accept_quote_by_token`) — donc `email.ts`,
  `devis.ts` **et** `stripe.ts` se chargent ;
- **le PDF se dessine vraiment** : devis d'essai posé en base, `quote-pdf` rend
  200 · `application/pdf` · `%PDF-1.7`, en **mensuel puis en annuel**, avec une
  ligne sans appareils déclarés. C'est la preuve qui compte : un libellé
  nouveau qu'Helvetica n'encoderait pas ferait lever `drawText` et la fonction
  répondrait 500. Données d'essai supprimées, **zéro résidu contrôlé**.

⚠️ **Ce qui n'est PAS prouvé : l'identité à l'octet près avec le dépôt.** La
console MCP fait retranscrire les fichiers, et le `supabase functions download`
puis `diff` du projet demande le CLI. À refaire depuis le Mac au prochain
passage — c'est le seul contrôle qui ferme le sujet.

## Ce qui reste à faire, et que je ne peux pas faire

- **Les six Price Stripe restent à recréer** aux montants du 31 août : c'est le
  point qui coûte de l'argent, et il ne se voit nulle part dans le code.
- **⚠️ Un magasin ajouté en abonnement mensuel crée un SECOND abonnement
  Stripe**, alors que `companies.stripe_subscription_id` n'en porte qu'un.
  `sync_subscription_status` répondra `unknown` (donc 200, sans erreur) sur son
  cycle de vie. C'est une limite connue, pas un défaut à rattraper à l'aveugle :
  elle se traitera le jour où un client aura deux magasins mensuels.

## Vérifications

**En base, tout en transactions annulées, sur les fonctions réellement
appliquées** — données d'essai contrôlées à zéro après coup : la demande sans
appareils refusée et le message exact, la borne à 1 000, la demande nominale qui
écrit `devices`, l'ancien appel à quatre arguments qui répond le refus lisible,
le devis mensuel qui pose son rythme et le rejoue jusqu'à `quote_by_token` et
`accept_quote_by_token`, la création qui reporte les appareils **et le prix
annuel** (330 000 pour une ligne mensuelle à 31 000), le rejeu du même événement
Stripe qui répond `already`, les deux créations manuelles (entreprise et
magasin), et **la non-régression de la souscription en ligne** : 372 000 et non
douze fois plus.

**Au navigateur**, clair et sombre, sans erreur de console et sans débordement
horizontal : `/inscription` avec deux magasins (Advanced 3 300 €, Enterprise
9 450 €, estimation 12 750 €), et le panneau de devis par **route jetable**
(retirée, `git status` contrôlé) — bascule annuelle/mensuelle, lignes qui
suivent, libellé du champ qui suit.

**Non vérifié** : un paiement réel en mensuel, qui demande les Price Stripe et
une carte ; et l'e-mail de devis reçu dans une vraie boîte.

Tests de garde : `web/tests/devis.test.ts` (bloc « l'assiette est le nombre
d'appareils ») et `web/tests/demande-magasin.test.ts`.

⚠️ **Deux garde-fous périmés trouvés en chemin, et le motif est toujours le
même** : `demande-magasin.test.ts` listait quatre fichiers de migration à la
main pour trouver « la définition qui fait foi ». Elle en manquait deux, si bien
que trois assertions validaient depuis des semaines des définitions qui ne
tournaient plus (`admin_fulfil_store_request` exige `paid` et non `pending`
depuis le 22 août). Il passe par `derniereDefinition` comme les autres. **Toute
garde sur une fonction sensible passe par là — jamais par un nom de fichier.**

# La souscription en ligne (30 août 2026)

*« Branche Stripe pour la souscription en ligne. »* Les trois offres se
souscrivent par carte, sans devis : le prix est public et le client l'a choisi
sur `/tarifs`. Grille et raisonnement : `docs/entreprise/hypotheses-tarifaires.md`,
hypothèse 4.

## Le parcours réutilise celui du devis — c'est le point porteur

Une souscription **est** une `company_requests`, née directement en
**`accepted`** : il n'y a rien à négocier. Le webhook existant la mène à
`created` par `fulfil_paid_request`, sans que sa garde de transition change —
elle exige `accepted`, elle le trouve.

**Ne pas écrire un second chemin de création d'entreprise.** C'est ce qui a
évité, jusqu'ici, que deux façons de créer divergent — la même raison qui fait
qu'`admin_fulfil_store_request` appelle `admin_add_store` au lieu de recopier
la génération du code.

Migrations `20260830130001` (colonnes + `fulfil_paid_request`) et
`20260830130002` (`deposer_souscription`, `sync_subscription_status`).

## Ce qu'il reste à faire pour que ça encaisse vraiment

⚠️ **Rien n'est encaissable tant que les six Prices ne sont pas posés.** Ils se
créent dans le tableau de bord Stripe (Produits → Prix récurrents), puis
s'ajoutent en **secrets d'edge functions**, un par couple offre × rythme :

```
STRIPE_PRICE_ESSENTIAL_MONTHLY    STRIPE_PRICE_ESSENTIAL_YEARLY
STRIPE_PRICE_ADVANCED_MONTHLY     STRIPE_PRICE_ADVANCED_YEARLY
STRIPE_PRICE_ENTERPRISE_MONTHLY   STRIPE_PRICE_ENTERPRISE_YEARLY
```

⚠️ **Les Prices ne sont JAMAIS créés par le code.** Un prix créé à la volée est
un prix que personne n'a relu, et il serait facturé à un vrai client. Un test
refuse `price_data` dans le mode abonnement.

Tant qu'un secret manque, l'offre répond **503 `indisponible`** — vérifié en
direct sur la fonction déployée — et **aucune demande n'est écrite** : le Price
est lu AVANT le dépôt, sinon on laisserait une ligne morte et un client
persuadé d'avoir souscrit. Un test compare les deux positions dans le fichier.

Il faut aussi **ajouter trois événements au point de terminaison Stripe** :
`invoice.payment_failed`, `invoice.paid`, `customer.subscription.deleted`.

## Points à ne pas défaire

- **⚠️ Carte seule, pas de SEPA.** Le prélèvement convient à une facture
  annuelle d'enseigne ; son délai de règlement ferait attendre l'ouverture des
  accès plusieurs jours, après que la personne a cliqué « Souscrire ». Le
  parcours devis, lui, garde le SEPA.
- **⚠️ Un impayé ne coupe RIEN.** `sync_subscription_status` passe la licence
  en `past_due`, jamais en suspension d'accès. Couper un magasin sur un
  incident de carte, c'est bloquer un inventaire un soir de comptage — même
  règle que le plafond souple. La relance est commerciale, pas technique. Un
  test refuse les mots `suspend`, `revoke`, `delete from` et `disable` dans le
  webhook.
- **⚠️ Un abonnement inconnu répond 200**, pas une erreur : les événements de
  Stripe peuvent se croiser, et `invoice.paid` arriver avant que
  `checkout.session.completed` n'ait créé l'entreprise. Lever ferait rejouer
  Stripe sans fin sur un événement sans objet.
- **⚠️ L'ancienne signature à cinq arguments de `fulfil_paid_request` est
  SUPPRIMÉE.** `p_subscription_id` ayant un défaut, Postgres garderait les deux
  et un appel à cinq deviendrait ambigu. Même piège que `p_event_id` le 28 août
  et `ca_request_store` le 22.
- **`annual_price_cents` du magasin vaut douze mensualités** quand le rythme est
  mensuel : c'est ce que `admin_business_overview` somme pour le revenu annuel.
- **La page `/souscrire` n'a AUCUN repli sur une RPC directe**, contrairement à
  `/inscription`. Sans la fonction edge il n'y a pas de session Stripe, donc
  rien à payer : déposer la demande quand même laisserait croire à une
  souscription faite.
- **Aucune donnée bancaire ne transite par le site.** La carte se saisit chez
  Stripe. Un test refuse les attributs `cc-number`, `cvc` et voisins sur la page.
- **La grille est dupliquée** dans `subscribe-online` (centimes) et
  `web/lib/offres.ts` (euros) — le site et les edge ne compilent pas ensemble,
  comme `web/lib/devis.ts` et `_shared/devis.ts`. `web/tests/souscription.test.ts`
  compare les deux montant par montant.

## ⚠️ On refuse AVANT d'encaisser — et c'est le premier test qui l'a montré

La limite était écrite comme « à reprendre si le cas se présente ». **Elle
s'est présentée au premier essai réel** : Julien a payé avec son adresse, qui
appartenait déjà à une autre entreprise ; l'entreprise a été créée, encaissée,
et `invite_company_admin_after_payment` a refusé l'invitation (garde VR-003 du
28 août). Résultat : **0 administrateur, 0 compte, 0 invitation** — il avait
payé sans rien obtenir. Le garde-fou avait bien joué, mais après le paiement.

`deposer_souscription` contrôle donc l'adresse **avant toute écriture et avant
toute session Stripe** (migration `20260830180002`), en trois cas :

| Code | Quand | Ce qu'on dit |
|---|---|---|
| `compte_existant` | l'adresse a un profil rattaché à une entreprise | demandez vos accès à son administrateur |
| `invitation_en_cours` | une invitation attend ailleurs | ouvrez-la pour créer votre mot de passe |
| `deja_souscrit` | une souscription payée existe | vérifiez votre boîte de réception |

- **⚠️ L'ordre fait le contrôle** : validation de saisie → limitation de débit →
  recherche par adresse. Une faute de frappe ne consomme pas le quota, et un
  script ne peut pas interroger la base à volonté avant d'être freiné (leçon du
  28 août sur `submit_company_request`).
- **⚠️ On ne nomme jamais l'entreprise concernée** : le souscripteur apprendrait
  quelque chose sur un client qui n'est pas le sien. Même règle
  qu'`other_company` depuis le 22 août. Un test le vérifie.
- **Compromis assumé** : le message CONFIRME qu'un compte existe. C'est
  l'oracle d'énumération, déjà accepté le 22 août pour l'invitation d'équipe ;
  ce sont les cinq essais par heure et par adresse qui le rendent inutilisable
  pour constituer un annuaire.
- **À l'écran, un refus n'est pas une panne** : il s'affiche en ambre et non en
  rouge (`.souscrire-erreur.douce`), parce qu'il arrive avant tout encaissement
  et qu'il dit quoi faire. Faire réessayer quelqu'un que rien ne débloquera est
  la pire des réponses.

Le filet en aval **reste** : une entreprise sans administrateur remonte dans
`companies_without_admin` sur `/admin`. Il ne sert plus qu'aux cas que ce
contrôle ne peut pas voir — une adresse rattachée entre le dépôt et le
paiement.

## ⚠️ La TVA : un taux fixe, et un garde-fou contre l'oubli

Les prix sont **hors taxes** (c'est l'usage en B2B, et ce que dit la page).
Sans taux de TVA, Stripe encaisserait 225 € là où 270 € sont dus, et la
différence sortirait de la poche de l'éditeur **à chaque échéance** — une
erreur qui ne se voit qu'à la déclaration.

Un septième secret porte donc le taux : **`STRIPE_TAX_RATE`**, un `txr_…` créé
dans Stripe (Paramètres → Taxes → *Taux de taxe*), en mode **EXCLUSIF**.

- ⚠️ **Exclusif, jamais inclusif.** Un taux inclusif ne s'ajoute pas au prix, il
  le découpe : 225 € deviendraient 187,50 € HT + 37,50 € de TVA. Le client
  paierait le bon montant affiché, et l'éditeur encaisserait moins.
- ⚠️ **Il est facultatif en TEST, exigé en LIVE**, et c'est la clé Stripe qui le
  dit : `sk_live_` sans taux → refus (`tva_absente`, 503). C'est le seul endroit
  du produit où un oubli de configuration coûte de l'argent en silence, donc le
  seul qui mérite un refus plutôt qu'un repli.
- **Le taux de `web/lib/offres.ts` (`TVA = 0.2`) n'AFFICHE que.** C'est le taux
  Stripe qui fait foi sur la facture. Les deux doivent bouger ensemble ; un test
  vérifie que le module rappelle où vit l'autre.
- **Le TTC s'affiche sur `/souscrire` et nulle part ailleurs** : c'est le
  montant qui sera prélevé, et le bouton l'annonce (« Payer 270 € TTC »).
  Partout ailleurs le prix reste hors taxes. Annoncer le HT jusqu'au bout ferait
  découvrir l'écart sur le relevé bancaire.

Stripe Tax (calcul automatique selon le pays, autoliquidation
intracommunautaire) reste la suite naturelle le jour où un client hors de
France souscrit : il remplace le taux fixe sans rien changer d'autre.

## Vérifications (30 août 2026)

**Sur les fonctions déployées** : `subscribe-online` répond 405 sur GET (donc
le code est atteint sans JWT), 400 sur un corps illisible, « Offre inconnue »
sur un plan invalide, et **503 `indisponible` sur une offre valide** — les
Prices n'étant pas encore posés. `stripe-webhook` répond toujours 400
« signature absente ».

**En base, en transaction annulée** : dépôt → `accepted` avec plan, rythme et
ligne de devis ; `fulfil_paid_request` crée l'entreprise **avec son plan, son
rythme, son abonnement et son client Stripe**, et le magasin avec
`annual_price_cents = 270000` pour un mensuel à 225 € ; le rejeu du même
événement répond `already` sans créer de seconde entreprise ; le cycle de vie
enchaîne `past_due → active → canceled`, son rejeu répond `already`, et un
abonnement inconnu répond `unknown` sans erreur. **Zéro résidu contrôlé après
coup**, quota de limitation compris.

**Vérifié en vrai le 30 août 2026** — les six Prices posés en mode test, puis
un paiement complet par Julien avec la carte `4242` :

- **les six tarifs contrôlés un par un sur les pages Stripe elles-mêmes**
  (65 €/mois, 690 €/an, 225 €/mois, 2 400 €/an, 650 €/mois, 6 900 €/an) — c'est
  le contrôle qui comptait, une inversion mensuel/annuel aurait facturé 690 €
  par mois ;
- le parcours complet : demande → `created`, entreprise avec `plan=advanced`,
  `billing_period=monthly`, abonnement et client Stripe liés, licence `active`,
  magasin à `annual_price_cents = 270000`, journal signé « Stripe » ;
- **et le défaut ci-dessus**, qui n'aurait pas été trouvé autrement.

Données d'essai supprimées, zéro résidu contrôlé. **Le journal du test est
conservé** (règle du projet) ; seules les six sondes de vérification des tarifs
ont été retirées.

⚠️ **L'abonnement Stripe de test reste actif** côté Stripe : il se représentera
dans un mois. Sans conséquence en mode test, mais à annuler dans le tableau de
bord.

Tests de garde : `web/tests/souscription.test.ts`.

# Le hors ligne : trois trous sur l'écran de comptage (2 septembre 2026)

Constat de Julien, captures à l'appui sur **les deux plateformes** : scanner un
article inconnu en mode avion répondait « Erreur — fetch failed »
(`java.net.UnknownHostException` sur Android, « The Internet connection appears
to be offline » sur iOS). La revue du hors ligne demandée dans la foulée en a
sorti deux autres, dont un qui corrompt des données.

## 1. « Article inconnu » n'était pas dans la couche hors ligne

`scanner.tsx` importait `insertArticle` de `@/lib/queries` — **la seule écriture
du comptage restée en dehors de `@/lib/offlineSync`**. Toutes les autres
(comptage, ouverture et clôture de balise) y étaient depuis le premier jour.

Il vient donc de `offlineSync`, avec le motif habituel : serveur si possible,
file d'attente sinon, et **le cache local mis à jour dans les deux cas**.

- **⚠️ Un genre d'opération de plus dans la file** (`kind: 'article'`), rangé
  dans la tranche de **sa balise**, avant le comptage qui le suit. `counts` ne
  référence pas `articles` — rien ne l'exige — mais le rapport lit le libellé
  dans `articles` : un comptage arrivé seul s'afficherait sous une référence
  nue.
- **⚠️ `ean_norm` ne part JAMAIS dans la charge.** C'est une colonne générée
  STORED (`NULLIF(ltrim(ean,'0'),'')`) : Postgres refuse toute écriture dessus.
  Un article mis en file avec cette clé serait rejeté à la synchronisation —
  donc perdu — sans que rien à l'écran ne le laisse deviner. `enqueueArticle`
  la retire ; `eanNorm()` la recalcule pour la **copie en cache**, qui est ce
  qui permet de retrouver un EAN dont Excel a mangé les zéros de tête.
- **⚠️ `primeOfflineCache` réécrit le référentiel en entier** à chaque entrée
  sur l'écran de scan. Sans relecture de la file, un article saisi en réserve
  disparaissait du cache à la première barre de réseau, et le code redevenait
  inconnu pendant que son comptage attendait toujours. Les articles en attente
  sont donc rajoutés — **en une seule écriture**, pas une par article : le
  cache se réécrit à chaque appel, boucler dessus coûterait le carré.
- **⚠️ Et le cache sert de repli MÊME EN LIGNE**, quand le serveur ne connaît
  pas le code. C'est la fenêtre entre la création en réserve et la remontée :
  sans ce repli, retrouver du réseau rouvrait « Article inconnu » sur un code
  qu'on venait de saisir, et une seconde saisie fabriquait un doublon dans la
  file. **Trouvé par le test, pas à l'écran** (`tests/offlineSync.test.ts`) —
  c'est ce qui justifiait d'écrire un test sur le vrai module de bascule.
- L'identifiant est tiré côté client : la copie en cache et la ligne qui
  arrivera en base portent le même `id`, et un renvoi retombe sur la clé.

## 2. Le serveur refusait cet article à un compteur — même en ligne

`articles` n'avait que deux policies : lecture pour les membres de
l'inventaire, écriture (`FOR ALL`) pour les seuls **superviseurs**. Un compteur
qui remplissait « Article inconnu » recevait `42501`. Vérifié en base, session
simulée, transaction annulée.

Autrement dit, **la fonctionnalité était inatteignable pour le rôle à qui elle
est destinée**, et rien à l'écran ne l'expliquait. Le hors ligne n'a fait que
déplacer l'échec : la file l'aurait envoyée au retour du réseau, et le serveur
l'aurait refusée.

Migration `20260902100001`, policy `articles_insert_member`, **trois bornes** :

- **INSERT seulement.** Un compteur ajoute ce qui manque ; il ne récrit ni
  n'efface le fichier importé par le superviseur. `articles_supervisor` reste la
  seule policy `ALL`, et l'unicité `(session_id, sku)` empêche de remplacer un
  article existant par une insertion.
- **Inventaire ouvert**, comme `counts_insert_member`.
- **⚠️ Prix d'achat à zéro.** Un compteur constate une **présence**, pas une
  valeur : la valorisation vient du fichier du superviseur. Sans cette borne,
  n'importe quel membre poserait un prix arbitraire sur une référence qu'il
  invente et gonflerait l'« écart valeur » du rapport. C'est exactement ce que
  la modale envoie — elle n'a pas de champ prix. Un champ prix ajouté un jour
  serait donc refusé en 42501 : le changer suppose de changer la policy.

Vérifié en base, transactions annulées, sept cas : sa session à prix nul passe ;
prix non nul, inventaire d'un autre et inventaire clôturé sont refusés ; UPDATE
et DELETE touchent zéro ligne ; le rejeu du même SKU rend 23505, que la file
traite comme « déjà passé ». Zéro résidu contrôlé.

## 3. ⚠️ La liste d'une balise gardait celle de la balise précédente

Le plus grave des trois, et il écrit de fausses données. L'effet qui réamorce la
liste appelait `getMyScanEntries` en direct, avec
`.catch(() => { /* liste vide si erreur */ })` — **qui ne vidait rien**. Sans
réseau, passer de la balise A à la balise B laissait donc les scans de A
affichés sous B. Or ce sont ces lignes que les boutons « + / − » corrigent : un
« − » posé là écrivait une correction négative **dans B** pour un article compté
en A.

`getScanEntries` (offlineSync) remplace l'appel : réponse du serveur **plus** ce
qui attend en file, et l'échec vide pour de bon.

- **La file est ajoutée dans les deux cas, pas seulement hors ligne.** Au retour
  du réseau une partie des scans est déjà partie et l'autre attend encore ;
  n'afficher que le serveur ferait clignoter la liste entre les deux.
- Le libellé d'une ligne en attente vient du **cache local** — c'est là que
  vivent aussi les articles créés en réserve, qui n'existent encore nulle part
  ailleurs.
- Une référence entièrement corrigée (net nul ou négatif) quitte la liste, comme
  côté serveur.

**Au passage** : `(supervisor)/[sessionId]/scan.tsx` lisait encore `getSession`
depuis `@/lib/queries`, là où l'écran du compteur passait par le cache. Hors
ligne, `if (!session) return null` laissait donc **l'écran blanc** à un
superviseur qui compte lui aussi en réserve. Les deux écrans sont désormais
alignés — un test les compare.

## Vérifications

- **En base**, sur les fonctions et policies réellement appliquées : les sept
  cas de la policy, en transactions annulées, zéro résidu.
- **En Node, sur les vrais modules** : `tests/offlineSync.test.ts` fait tourner
  `offlineSync.ts` avec un faux serveur qu'on met en panne — coupure constatée
  au premier code, article mis en file, rescan qui le retrouve, retour du réseau,
  article puis comptage envoyés dans cet ordre, `ean_norm` absent de la charge,
  seconde synchro à vide. C'est ce test qui a trouvé le défaut du repli en ligne.
- **Au simulateur** : l'application se construit, s'ouvre et restaure sa session
  (les nouveaux imports se résolvent).
- **⚠️ NON VÉRIFIÉ appareil en main** : le mode avion. Un simulateur partage le
  réseau du Mac, et les données du compte de démonstration servaient à une autre
  session — je n'ai pas voulu y écrire un article d'essai. C'est le scénario que
  Julien a lui-même joué pour trouver le défaut : c'est à lui qu'il revient,
  après reconstruction des deux applications.

Tests de garde : `tests/offlineSync.test.ts`, `tests/offline.test.ts` (bloc « un
article créé hors ligne ») et `tests/comptage.test.ts` (blocs « “Article
inconnu” passe par la couche hors ligne », « un compteur peut créer l'article
qu'il scanne » et « la liste des scans se reconstruit hors ligne »).

# Le détail d'une balise, et de quoi la reprendre (2 septembre 2026)

*« Je m'aperçois qu'il n'y a pas de détail de ce qui a été scanné par balise sur
le site. Je veux pouvoir cliquer sur le numéro de balise et voir ce qui a été
compté dessus. »* Maquette validée avant codage :
https://claude.ai/code/artifact/6d6c86cd-cffe-4b4e-82c9-8a3862375c4b

La fenêtre existait déjà — cliquer sur une balise l'ouvrait pour clôturer un
cycle resté ouvert. Elle ne disait pas ce qu'il y avait dedans : « 2
référence(s) comptée(s) », et rien d'autre. Pour savoir ce qu'un rayon avait
donné, il fallait ouvrir le rapport de l'inventaire entier et y chercher sa
balise.

## Ce que la fenêtre montre

Une ligne par référence : article, comptage, audit, écart. Plus deux marqueurs
qui disent ce qui ne se lit pas dans les chiffres — « créé au scan » pour un
article né d'« Article inconnu », « arbitré · N » pour une ligne dont un
superviseur a tranché la quantité.

- **⚠️ L'écart ne s'affiche qu'une fois l'audit de la BALISE clôturé.** Tant
  qu'il tourne, une quantité auditée à zéro ne distingue pas « l'auditeur n'a
  rien trouvé » de « l'auditeur n'est pas encore passé ». C'est déjà la règle de
  `computeDiscrepancies` ; l'afficher quand même accuserait quelqu'un à tort.
  Le serveur ne calcule donc **pas** l'écart : il rend les deux quantités et le
  statut de l'audit, `ecartLigne` (`web/lib/zones.ts`) décide. Une ligne
  **arbitrée** se tait aussi — la quantité retenue remplace la comparaison.
- **⚠️ Bornée à une balise.** `get_session_detail` produisait déjà ce tableau,
  mais pour l'inventaire entier : le rapatrier au navigateur pour n'en montrer
  qu'un rayon est exactement le motif retiré en août 2026 pour la tenue en
  charge. D'où `get_balise_detail(p_session_id, p_code)`, qui ne descend jamais
  que la balise regardée. Ne pas « simplifier » en filtrant côté client.
- **Une référence ramenée à zéro n'apparaît pas.** `counts` est en ajout pur :
  un article scanné puis entièrement corrigé a des lignes et zéro pièce. Même
  filtre que `get_session_detail` — la balise 1000 de La Samaritaine porte six
  références en base, la fenêtre en montre deux.
- La fenêtre passe à **640 px** (`.modal-large`) : quatre colonnes ne tiennent
  pas dans les 460 px des modales du site. La liste défile à l'intérieur — un
  rayon peut porter deux cents références, la fenêtre ne grandit pas avec lui.
- **Pas de nom de compteur** (décision de Julien). La donnée existe et vit dans
  le rapport, où elle sert à arbitrer ; l'onglet Suivi a été dépersonnalisé le
  19 août 2026 et décrit le travail, pas les personnes.

## ⚠️ « Rouvrir » a quitté le site

Décision de Julien : rouvrir une balise est un geste de **terrain**, qui n'a de
sens que sur le téléphone de la personne qui va la recompter. Rouverte depuis un
ordinateur, elle restait ouverte sur aucun appareil, et la seule chose qui avait
changé était le tableau de bord. Le site affiche donc, à la place du bouton,
« Pour rouvrir, passez par l'application ».

Ce qui reste : **clôturer**, avec un libellé qui dit ce qu'il fait — « Marquer
comptée » / « Marquer auditée » plutôt qu'un « Marquer terminé » commun aux
deux. Un test refuse la réapparition d'un `setBalise(..., true)` dans cet écran.

## ⚠️ Vider une balise — et pourquoi ce n'est pas VR-007

`vider_balise(p_session_id, p_code)` efface les comptages **et** les audits
d'une balise, puis remet ses deux cycles à « pas commencé » : elle redevient à
faire. Pour une balise comptée dans le mauvais rayon, ou un comptage à reprendre
de zéro — sans ce geste il fallait corriger article par article.

C'est la demande explicite de Julien, et elle ressemble à ce que la revue de
sécurité du 28 août avait retiré. **La différence est ce qui rend ce geste
acceptable, et il faut la garder en tête avant d'y toucher :**

- ce qui a été fermé par VR-007, c'est la policy `counts_delete_supervisor` —
  un DELETE **sur un critère choisi par le client**, qui permettait d'effacer en
  masse les lignes de toute l'équipe. Ici le périmètre est **fixé par le
  serveur** : une balise, entière, nommée. Exactement comme `delete_audit_line`
  est bornée à un SKU dans une zone. **Ne jamais l'élargir à une liste de
  balises ni à un filtre libre** — un test refuse un paramètre tableau ;
- **elle laisse une trace.** L'aggravation relevée par VR-007 était que `counts`
  n'est journalisée nulle part : la destruction ne se voyait pas après coup. La
  ligne écrite dans `company_audit_log` (`balise_videe`) porte l'inventaire, la
  balise, l'emplacement, le nombre de lignes et de pièces. L'administrateur de
  l'entreprise la lit depuis /journal — d'où le libellé dans
  `web/lib/journal.ts`, sans quoi le mot technique s'afficherait brut ;
- **elle refuse un inventaire clôturé.** Son rapport est sorti, souvent exporté :
  en effacer les comptages ferait bouger un document déjà remis.
  `delete_audit_line`, écrite avant cette règle, ne fait pas ce contrôle ;
- **un compteur est refusé** : la garde est `can_access_session`, qui exige le
  rôle superviseur. Vérifié — un compteur membre de l'inventaire ne peut ni
  vider ni même lire le détail.

Côté écran, deux précautions : le bouton vit **sous un filet, à distance** des
deux clôtures (`.balise-zone-sensible`), et la confirmation **exige la recopie
du numéro de balise** (`requireText`) — il est à quelques centimètres de
« Marquer comptée » et efface le travail de toute l'équipe sur ce rayon. Même
motif que la suppression d'un compte.

## Vérifications

- **En base, en transactions annulées, sur les données réelles de La
  Samaritaine** : le détail rend bien deux lignes sur les six références de la
  balise 1000 (les quatre autres à zéro sont écartées) ; un compteur est refusé
  sur les deux fonctions ; balise inexistante, code vide, inventaire clôturé et
  compte étranger sont refusés nommément ; le vidage réel efface 50 lignes et
  6 audits, remet la balise en `pending/pending` avec `count_done_at` à nul,
  **laisse la balise 1001 intacte**, et écrit la ligne de journal attendue.
  Zéro résidu contrôlé après annulation (63 comptages, 10 audits, journal à 4).
- **Au navigateur**, par route jetable (retirée, `git status` contrôlé), clair
  et sombre : les trois états, l'écart affiché ou tu selon le statut de l'audit,
  les deux marqueurs, un libellé long et une quantité à six chiffres — aucun
  débordement horizontal, ni du document ni du tableau.

## ⚠️ « Marquer auditée » reprend le comptage quand personne n'a audité

Constat de Julien le jour même : *« marquer auditée alors qu'il n'y a pas de
quantité auditée doit prendre le compte d'origine, c'est-à-dire celui du
compteur »*. Il avait raison, et le défaut était **antérieur à ce chantier** :
ce bouton ne faisait que basculer `zones.audit_status`, et la conséquence se
lisait ailleurs. L'audit déclaré terminé, l'écart devient calculable — et toutes
les références de la balise sortaient à **moins la totalité du comptage**, comme
si l'auditeur était passé et n'avait rien trouvé. Ranger un audit que personne
n'a fait fabriquait une démarque intégrale sur ce rayon.

`cloturer_audit_balise` remplace `set_balise` **pour ce seul bouton**.

- **⚠️ La reprise n'a lieu que si la balise n'a AUCUNE ligne de passe 2, jamais
  référence par référence.** C'est la garde qui protège le produit : quand
  personne n'est passé, il n'existe aucun jugement d'auditeur à contredire ; mais
  un auditeur qui est passé et n'a **pas retrouvé** un article compté, c'est
  précisément la démarque que l'inventaire existe pour révéler — la reprendre
  l'effacerait en silence. Une balise auditée à moitié garde donc ses écarts.
  Vérifié : sur une balise partiellement auditée, `reprises` vaut 0 et rien ne
  bouge. **Arbitré par Julien le 2 septembre 2026**, la question lui ayant été
  posée explicitement : *« cela ne concerne que les balises avec aucun audit,
  donc on reste comme ça »*. Ne pas « compléter » cette fonction en la passant
  par SKU — c'est une décision, pas un raccourci.
- **⚠️ Elle écrit de vraies lignes de comptage en passe 2**, et c'est
  obligatoire : `article_audit` est **dérivée** de `counts` par
  `recompute_session_audit`. Poser `final_qty` à la main serait défait au premier
  recalcul, que l'onglet Écarts déclenche à la demande. La fonction recalcule
  elle-même dans la foulée, sans quoi l'onglet afficherait l'état d'avant.
- **`counted_by` est le superviseur qui déclenche**, pas le compteur d'origine :
  c'est lui qui prend la responsabilité de la reprise, et le rapport doit
  pouvoir le nommer.
- **Une référence ramenée à zéro n'est pas reprise** (`having sum(c.qty) > 0`) :
  il n'y a rien à confirmer.
- **⚠️ L'application mobile garde `set_balise`.** Un auditeur physiquement
  devant le rayon qui n'a rien scanné n'a **rien trouvé** — lui reprendre le
  comptage effacerait son constat. La reprise est un geste de bureau.
- L'écran prévient avant : ce n'est plus un changement d'état, des lignes sont
  écrites. La confirmation annonce combien de références seront reprises et dit
  que la balise sortira sans écart.

Tests de garde : `web/tests/zones.test.ts`.

# Deux superviseurs sur la même balise (2 septembre 2026)

Test de Julien sur l'inventaire « Seouliste 020926 » : deux superviseurs ont
compté la même balise, et **leurs relevés se sont additionnés sans que rien ne
les prévienne**. Il attendait que le second remplace le premier. Maquette
validée avant codage :
https://claude.ai/code/artifact/7b9d1fb4-ab13-4a9f-bfac-a47d6e9218b8

## Le défaut n'était pas l'addition, c'était le silence

L'addition est le modèle, et elle ne change pas : `counts` est un journal en
**ajout pur** — aucune policy UPDATE, une correction est une ligne négative.
C'est ce qui permet à deux personnes de finir le même rayon ensemble, et c'est
ce qui a été défendu deux fois pour raison de sécurité (VR-007, et le retrait du
bouton « Supprimer » des écarts le 29 août).

Le garde-fou existait — « 13 pièces y sont déjà enregistrées, vos scans
viendront s'ajouter » — mais **il ne se déclenchait que sur une balise
CLÔTURÉE** (`status !== 'done' → return null`). Un collègue qui laisse la sienne
ouverte n'était donc signalé nulle part. Rien côté serveur non plus :
`set_balise` n'a aucune notion de propriétaire, deux personnes ouvrent la même
balise sans le savoir.

## ⚠️ « Par quelqu'un d'autre », et pas une colonne « propriétaire »

Le premier réflexe — ajouter à `zones` qui a ouvert la balise — **a été écarté,
et il faut savoir pourquoi** : deux personnes qui se relaient sur un rayon
rendraient cette colonne fausse immédiatement. Ce que l'écran veut savoir, c'est
« est-ce que quelqu'un d'autre a compté ici ? » — donc une **somme**, pas un
propriétaire.

`get_zone_dashboard` (migration `20260902180001`) rend donc quatre colonnes de
plus : `count_units_autres`, `count_lines_autres` et leurs jumelles d'audit,
filtrées sur `counted_by is distinct from auth.uid()`.

- **⚠️ `is distinct from`, jamais `<>`.** Une ligne dont l'auteur a été supprimé
  porte `null` (détachée par `on delete set null`) : elle vient bien de
  quelqu'un d'autre, et un `<>` la laisserait passer pour la nôtre.
- **Aucune migration de schéma**, et le cas qui compte le plus vient gratuitement :
  **rouvrir SA PROPRE balise ne demande rien.** Une carte qui s'affiche à chaque
  retour devient une carte qu'on ferme sans lire.
- **⚠️ Les colonnes s'ajoutent À LA FIN** : les applications déjà installées
  lisent les neuf premières et ignorent le reste. Elles continuent de
  fonctionner sans être reconstruites.
- **⚠️ DROP puis CREATE** — on ne change pas un type de retour par un
  `create or replace`. Les droits sont reposés dans la même migration, `anon`
  nommément : `create` rend EXECUTE à PUBLIC, et un `revoke … from public` ne
  suffit pas. Constat n°6 du 28 août, qui se reproduit à chaque recréation.

## La carte à trois choix

`Question` gagne `alternative` (libellé d'un troisième bouton, destructeur), et
`demanderChoix` rend `'action' | 'alternative' | 'annuler'`.

- **⚠️ `demander` rend toujours un booléen** (`demanderChoix(...).then(r => r === 'action')`) :
  **aucun appel existant ne change**. Le troisième choix n'existe que pour les
  cartes qui portent une `alternative`.
- **⚠️ Trois choix s'EMPILENT, deux restent côte à côte.** Trois pastilles sur la
  largeur d'un téléphone cassent leurs libellés sur trois lignes — constaté sur
  la barre de sélection multiple en août. Empilés, ils gardent leur texte et
  leur cible de 48 dp.
- **⚠️ `flexDirection: 'row-reverse'` sur la rangée, et ce n'est pas une
  coquetterie.** Le balisage écrit le bouton plein EN PREMIER, parce que c'est
  l'ordre d'une colonne ; en rangée il doit rester à DROITE comme partout
  ailleurs. L'inversion évite d'écrire deux fois les mêmes boutons. Vérifié à
  l'écran : une carte à deux boutons est inchangée.
- **L'ordre du triptyque** : le geste qui ne détruit rien d'abord (plein), le
  destructeur qu'on va chercher ensuite (contour rouge), la sortie en dernier.
  Même règle que les volets de la liste d'inventaires.
- **La carte ne nomme personne** — « Quelqu'un compte sur la balise 1000 ». Dire
  le nom rouvrirait par l'interface ce que la base ferme (`counts_select_own`),
  et le suivi a été dépersonnalisé le 19 août. Un test le vérifie.
- Deux textes, parce que ce ne sont pas les mêmes faits : **« déjà comptée »**
  (clôturée) et **« quelqu'un compte sur »** (en cours, surtitre « Attention »).

## « Reprendre à zéro »

Le remplacement devient un **choix explicite**, jamais le défaut. Il appelle
`vider_balise` — la fonction écrite le matin même pour le site — et repasse par
sa propre confirmation, en ton `danger`, qui **nomme ce qu'on perd** : « 13
pièces sur 3 références comptées par l'équipe seront effacées, audits compris. »

- **⚠️ Pas de recopie du numéro sur le téléphone**, contrairement au site — et
  c'est un écart assumé. L'exiger ici serait **plus strict sur une balise que
  sur l'inventaire entier**, que l'application supprime avec une seule
  confirmation nommée ; et ça ferait monter le clavier par-dessus la carte sur
  l'écran même où il pose déjà problème. Ce qui protège, c'est la distance (deux
  cartes) et le décompte.
- **⚠️ Rien ne part en file d'attente.** `viderBalise` vient de `@/lib/queries`,
  pas d'`offlineSync` : la file sert à ne rien perdre, y mettre un effacement
  ferait l'inverse — on ne saurait pas, au moment de l'envoi, ce qu'il détruit.
  Sans réseau on refuse et on n'ouvre pas. Un test vérifie l'absence du nom dans
  `offlineSync.ts`.

## Vérifications

- **En base**, sur les données réelles de « Rayon textile » (deux auteurs de
  comptages) : la même balise rend `autres = 15 u / 3 réf` à Camille et
  `autres = 0` à Nadia, qui les a comptées. C'est exactement le comportement
  voulu — l'une est prévenue, l'autre non.
- **Au simulateur**, par route jetable (retirée, `git status` contrôlé) :
  la carte à trois boutons en **clair et en sombre**, dans les deux cas
  (ouverte / clôturée), et **la non-régression d'une carte à deux boutons** —
  « Annuler » à gauche, l'action pleine à droite.
- **⚠️ Non vérifié appareil en main** : le parcours complet à deux comptes
  simultanés, qui demande deux téléphones. Ce qui est prouvé, c'est que la
  donnée dit vrai et que la carte s'affiche juste.

Tests de garde : `tests/compte.test.ts`, bloc « quelqu'un d'autre a compté sur
cette balise ».

⚠️ **Un garde-fou trouvé faux en chemin** : `web/tests/backend-durcissement.test.ts`
vérifiait qu'aucun écran ne cite `delete_audit_line` — en lisant le texte brut.
Le commentaire de `viderBalise`, qui EXPLIQUE la différence avec cette
fonction, le faisait échouer. La garde retire désormais les commentaires avant
d'assertir, comme `formulaires-publics.test.ts`. Troisième fois que ce piège se
présente sur ce projet.

# La politique de confidentialité est servie par le site (2 septembre 2026)

*« Je préfère utiliser le lien de notre site pour les communications
commerciales, pas github ou autre. »* Elle vivait sur GitHub Pages
(`devkaylab.github.io/Inventaire/privacy.html`), et cette adresse figurait dans
la fiche produit, le dossier de déploiement MDM, la note aux salariés, les
e-mails et les deux applications.

Nouvelle adresse : **`https://www.quantinvo.com/confidentialite`**.

## ⚠️ UN SEUL DOCUMENT, DEUX ADRESSES

La page **ne recopie pas** la politique : `web/app/confidentialite/page.tsx` lit
`docs/privacy.html` **à la construction** et injecte son `<body>` tel quel.
Recopier une politique de confidentialité, c'est garantir que les deux versions
divergeront — et c'est le document où ça se paie le plus cher. Le fichier reste
l'original, avec sa garde (`web/tests/confidentialite.test.ts`, qui refuse un
sous-traitant non déclaré) et son hébergement GitHub Pages.

- **Lue à la construction, jamais à la requête** : la page est statique (`○`
  dans la table des routes), et le fichier n'a pas à exister sur le serveur qui
  la sert. `process.cwd()` vaut `web/` pendant `next build`, d'où
  `path.join(process.cwd(), '..', 'docs', 'privacy.html')`.
- **Une lecture ratée fait ÉCHOUER la construction** (`throw`) : mieux vaut un
  build rouge qu'une page de confidentialité vide en ligne. Un test le fige.
- **Page publique, donc hors d'`AppShell`** : elle s'ouvre depuis un e-mail,
  souvent au téléphone, et l'espace connecté se ferme sous 720 px.
- Le corps injecté porte ses propres classes (`.meta`, `.note`, `.wrap`) et des
  tableaux sans classe : `globals.css` les habille **sous `.legal`**, sans
  toucher au document. Le tableau des sous-traitants défile **dans son cadre**
  à 375 px — vérifié, débordement de page nul.

## ⚠️ GITHUB PAGES RESTE EN LIGNE, ET DOIT LE RESTER

On ajoute une adresse, on n'en retire pas. Deux populations pointent encore vers
l'ancienne, et aucune ne peut être mise à jour à distance :

- **les applications installées** — `src/constants/links.ts` ne prend effet
  qu'au prochain build ;
- **les e-mails déjà partis**, et ceux qui partiront jusqu'au redéploiement des
  fonctions edge : `POLITIQUE_URL` d'`_shared/email.ts` est une **constante**,
  pas une variable d'environnement lue à l'exécution.

Rien ne casse entre-temps, précisément parce que l'ancienne page répond
toujours. ⚠️ Ne pas désactiver GitHub Pages sur le dépôt.

## Ce qui a basculé, et quand ça prend effet

| Où | Effet |
|---|---|
| `web/lib/links.ts` | au déploiement du site (immédiat) |
| `docs/entreprise/fiche-produit/` | fiche régénérée, Word et PDF |
| `docs/entreprise/deploiement-mdm.md`, `docs/conformite/information-salaries.md` | documents remis |
| `src/constants/links.ts` | **au prochain build mobile** |
| `supabase/functions/_shared/email.ts` | **fait** — quatorze fonctions redéployées le 2 septembre 2026 |

## Les quatorze fonctions qui envoient un e-mail, redéployées

`POLITIQUE_URL` vit dans le gabarit partagé : **toute fonction qui envoie un
message la porte dans son pied**. Elles sont donc toutes concernées —
`accept-quote`, `admin-fulfil-store-request`, `admin-reject-store-request`,
`admin-send-quote`, `alerte-anomalies`, `ca-invite-supervisor`,
`ca-request-store`, `decline-quote`, `invite-company-admin`, `invite-teammate`,
`invite-to-session`, `message-admin`, `stripe-webhook`, `submit-company-request`.

- **Par le CLI**, `stripe-webhook` comprise — c'est le chemin que la règle du
  projet impose pour elle, et il était de nouveau joignable ce jour-là (le CLI
  est authentifié ; seul l'accès HTTP sortant vers `*.supabase.co` reste bloqué
  depuis l'agent).
- **⚠️ `--no-verify-jwt` sur les cinq publiques uniquement** : `accept-quote`,
  `decline-quote`, `submit-company-request`, `alerte-anomalies`,
  `stripe-webhook`. Les neuf autres se déploient sans le drapeau. **L'état a été
  relevé sur la base AVANT de déployer**, pas déduit de cette note — et
  recontrôlé après : `verify_jwt` n'a bougé sur aucune.
- **⚠️ Vérifier ce qu'on emporte avant de redéployer.** Un redéploiement pousse
  le dépôt entier de la fonction, pas seulement le changement voulu. Les
  commits postérieurs au dernier déploiement ont été listés dossier par
  dossier : tous étaient le commit du déploiement lui-même (le projet déploie,
  vérifie, puis commite), donc rien d'autre n'est parti.

**Contrôle de clôture, celui qui manquait le matin même** :
`supabase functions download stripe-webhook` puis `diff` — les trois fichiers
(`index.ts` et les deux `_shared/`) sont **identiques au dépôt**, et le bundle
déployé porte bien la nouvelle adresse.

**Et vérifié en fonctionnement, par `pg_net` depuis Postgres** (le proxy bloque
`*.supabase.co` depuis l'agent) : `stripe-webhook` répond 405 sur GET et
**400 « signature absente »** sur un POST nu — ce 400 est aussi le contrôle de
`verify_jwt`, une fonction protégée aurait répondu 401 avant d'atteindre le
code ; `accept-quote` répond 400 « Lien invalide. », donc elle atteint la base
et ses trois modules partagés se chargent.

Tests de garde : `web/tests/confidentialite.test.ts`, bloc « la politique est
servie par le site ».

# Le clavier ne cache plus les champs (2 septembre 2026)

*« Saisir quelque chose comme le mot de passe ou le code inventaire, le clavier
sur des plus petits écrans cache les champs de saisie. »* Constat de Julien.

## ⚠️ La cause, LUE dans la source de React Native

`KeyboardAvoidingView` mélange deux repères, et il faut l'avoir lu pour ne pas
tourner en rond (`Libraries/Components/Keyboard/KeyboardAvoidingView.js`) :

- il mémorise sa géométrie avec `this._frame = event.nativeEvent.layout`,
  c'est-à-dire **relative à son parent** ;
- il calcule
  `Math.max(frame.y + frame.height - (keyboardFrame.screenY - offset), 0)`,
  où `screenY` est en coordonnées **écran**.

Les deux ne coïncident que si le parent commence en haut de l'écran. Sous un
en-tête de navigation, le rembourrage est donc **court de toute la hauteur de
l'en-tête** — environ 91 points sur un téléphone à encoche. Sur un grand écran
la marge restante absorbe l'erreur ; sur un petit, le dernier champ passe sous
le clavier. Aucun `keyboardVerticalOffset` n'existait dans le projet.

## ⚠️ IL EN FAUT DEUX, ET C'EST MESURÉ

Les trois configurations ont été photographiées au simulateur, clavier logiciel
ouvert, sur le dernier champ de « Mot de passe ». C'est le cœur de ce chantier,
et aucune des deux moitiés ne suffit :

| configuration | résultat |
|---|---|
| garde-clavier avec le bon décalage, seul | **champ couvert** — il rétrécit la zone visible, il ne déplace rien |
| `automaticallyAdjustKeyboardInsets`, seul | **champ couvert** — UIKit pose l'encart mais ne fait pas défiler |
| **les deux ensemble** | **champ ET bouton dégagés** |

Le rétrécissement du cadre déclenche la passe d'UIKit qui amène le premier
répondant à l'écran. La règle est donc : `ClavierEvite` **autour**, et le
`ScrollView` **à l'intérieur** portant `automaticallyAdjustKeyboardInsets` et
`keyboardShouldPersistTaps="handled"`. Retirer l'un des deux ramène le défaut —
un test le vérifie sur les neuf écrans à champs.

## `ClavierEvite`, une seule définition de la règle

- **La hauteur se lit dans `HeaderHeightContext`, pas par `useHeaderHeight()`** :
  ce hook LÈVE une exception hors d'un écran à en-tête, et deux écrans n'en ont
  pas (la connexion, la planche de balises). Le contexte rend `undefined`, donc
  aucun décalage — exactement la réponse voulue.
- **Chemin interne d'expo-router**, comme `usePreventRemove` : un test vérifie
  que le fichier existe, sans quoi une mise à jour d'Expo ferait retomber le
  décalage à zéro **en silence**.
- **⚠️ ANDROID SUIT LA MÊME RÈGLE, et c'est un renversement de ce que le projet
  croyait.** Le motif laissait `behavior` indéfini là-bas, en s'appuyant sur
  `android:windowSoftInputMode="adjustResize"` — bien présent dans le manifeste
  généré. Mais le thème est **bord à bord** (`statusBarColor` et
  `navigationBarColor` transparents) et la cible est l'API 36 : depuis
  Android 15, le système n'y redimensionne plus la fenêtre, c'est à
  l'application de consommer l'encart du clavier. **Le garde-clavier ne faisait
  donc RIEN DU TOUT sur le Pixel**, quelle que soit la taille de l'écran —
  constaté appareil en main, champ et bouton sous le clavier. `padding` est sûr
  dans les deux mondes : si une version d'Android redimensionne encore, la
  hauteur mesurée exclut déjà le clavier et le calcul rend zéro.
- Plus aucun `KeyboardAvoidingView` nu dans l'application — treize écrans
  convertis, un test refuse la réapparition.

## L'écran de connexion ne défilait pas du tout

Il n'avait **aucun `ScrollView`** : avec le clavier ouvert sur un petit écran,
le bouton « Se connecter » devenait non pas masqué mais **inatteignable**.
⚠️ Son `container` passe de `flex: 1` à **`flexGrow: 1`** : c'est ce qui lui
permet de rester centré quand il y a la place ET de défiler sinon. Avec
`flex: 1`, le contenu est contraint à la zone visible et rien ne défile.

## ⚠️ Deux pièges de méthode, à ne pas refaire

1. **`autoFocus` ne reproduit pas un appui.** Il place le curseur AVANT que le
   clavier existe, donc rien ne peut faire défiler — la première mesure a
   accusé à tort `automaticallyAdjustKeyboardInsets`. Un focus différé de 1,5 s,
   clavier déjà ouvert, est la sonde fidèle.
2. **Le simulateur est en clavier MATÉRIEL par défaut**, donc le clavier
   logiciel ne s'affiche jamais et tout semble tenir à l'écran :
   `defaults write com.apple.iphonesimulator ConnectHardwareKeyboard -bool false`,
   puis relancer Simulator. **Le remettre après** (`defaults delete`) : c'est
   une préférence de la machine, pas du projet.

## ⚠️ Et une règle de garde, tirée de quatre échecs le même jour

**Une garde qui vérifie une ABSENCE doit lire le code sans ses commentaires.**
Quatre tests ont échoué aujourd'hui sur leur propre documentation — le fichier
explique pourquoi il n'utilise pas telle fonction, donc il la cite. Le motif
était déjà écrit pour `formulaires-publics.test.ts` et pour le comptage des
`for update` ; il vaut désormais pour toute assertion en `not.toContain`.

## Ce qui est prouvé, et ce qui ne l'est pas

- **iOS : réglé et vérifié.** Champ ET bouton dégagés, clavier ouvert, sur le
  dernier champ de « Mot de passe ».
- **Android : réglé pour l'usage.** Avant, rien ne bougeait du tout. Maintenant
  le contenu défile et **le champ visé est visible**, ce qui était la plainte.
  Le bouton de validation demande encore de faire défiler ou de refermer le
  clavier, et ⚠️ **sur Android un glissement REFERME le clavier** — mesuré,
  `mInputShown` passe à faux au premier `swipe`.
  · **⚠️ ARBITRÉ PAR JULIEN le 2 septembre 2026, appareil en main : « c'est bon
    j'ai testé, aucune gêne ».** Ne pas y revenir sans qu'il le redemande. Trois
    hypothèses ont déjà été démenties par la mesure dans cette seule journée, et
    ce qui reste ne coûte rien à l'usage : le poursuivre reviendrait à risquer
    une régression sur un défaut que personne ne ressent.
- **✅ Confirmé par Julien, appareil en main, le 2 septembre 2026** : « testé et
  c'est fonctionnel », sur les deux plateformes et sur l'écran où il avait vu le
  défaut. C'est la seule preuve qui valait pour ce chantier — de mon côté, le
  plus petit appareil disponible faisait 6,1 pouces (ni iPhone SE au
  simulateur, ni écran plus petit sous la main), donc la correction n'était
  mesurée que sur la mécanique : le champ passe au-dessus du clavier.

Tests de garde : `tests/compte.test.ts`, bloc « le clavier ne cache plus les
champs ».

# Un référentiel de 30 000 articles (3 septembre 2026)

Constat de Julien, capture à l'appui : l'onglet Set up de l'inventaire « HV »
(29 382 articles) affichait un encadré rouge portant **`{"message":""}`**.

Ce n'était pas un défaut d'affichage. C'était un **délai serveur dépassé**, et
le JSON n'en était que la trace.

## ⚠️ Le mécanisme, parce qu'il se reproduira

La policy `articles_supervisor` est
`get_my_role() = 'supervisor' and is_session_participant(session_id)`.

**Le second appel porte la colonne de la LIGNE.** Postgres ne peut donc pas le
remonter en InitPlan comme il le fait de `get_my_role()` : il l'évalue **une
fois par ligne**. Et `is_session_participant` n'est pas inlinable — elle porte
un `set search_path` —, donc chaque appel est une invocation complète qui en
déclenche trois autres (`is_admin`, `get_my_company`, `is_company_admin`).

Mesuré sur la base réelle, session simulée : **compter 29 382 lignes demande
11,7 s**. Le délai de `authenticated` est plus court, d'où l'enchaînement :

```
57014 « canceling statement due to statement timeout »
  → 500 à CORPS VIDE
    → postgrest-js fabrique { message: <corps> }, donc { message: '' }
      → errorMessage n'y trouve rien de lisible et sérialise en JSON
        → {"message":""} à l'écran
```

**⚠️ Et le défaut ne tenait pas à l'import.** Cinq des six timeouts de la
matinée venaient de `getImportState`, jouée à **chaque ouverture du tableau de
bord** : au-delà d'une vingtaine de milliers d'articles, l'onglet tombait en
erreur avant qu'on ait touché à quoi que ce soit. Le sixième était le `DELETE`
qui précède un remplacement.

**⚠️ Ce n'est PAS un défaut d'index, et il ne faut pas partir par là.** Les
index existent (`articles_session_sku_key` porte `session_id` en tête) et le
plan les utilise — `Index Only Scan`, `Heap Fetches: 0`. Le temps ne part pas
dans la lecture, il part dans la policy. Un index de plus n'aurait rien donné.

## Le correctif est le motif déjà en place

`etat_import` et `vider_import` (migration `20260903120001`) contrôlent le
droit **une fois**, puis travaillent hors RLS — exactement ce que
`get_session_count_totals` a fait pour `counts` le 22 août 2026, et pour la
même raison.

| | avant | après |
|---|---|---|
| compter (3 chiffres) | 11 726 ms, un timeout | **24 ms**, un seul appel |
| vider 29 382 lignes | timeout | **57 ms** |

- **⚠️ La garde ne s'élargit pas d'un pouce.** `can_access_session` **est**, à
  la lettre, la qual des policies contournées :
  `select get_my_role() = 'supervisor' and is_session_participant(p_session_id)`.
  Vérifié sur `pg_get_functiondef` avant d'écrire, pas supposé.
- **⚠️ `p_cible` n'est pas un nom de table**, c'est un choix entre deux
  branches écrites en clair ; toute autre valeur est refusée. Aucun SQL n'est
  fabriqué à partir du paramètre, et un test refuse `execute` et `format(`.
- **⚠️ Ce n'est pas le DELETE fermé par VR-007.** Ce qui a été retiré le
  28 août, c'est une suppression **sur un critère choisi par le client**. Ici
  le périmètre est fixé par le serveur : un inventaire, une des deux tables de
  fichiers, entière. Ne jamais l'élargir à une liste — un test refuse un
  paramètre tableau.
- **Pas de journal**, contrairement à `vider_balise` : on n'efface ici aucun
  comptage (`counts` ne référence pas `articles`, et **aucune contrainte ne
  pointe vers ces deux tables** — vérifié sur `pg_constraint`, la suppression
  ne cascade nulle part). Remplacer son fichier de préparation est un geste
  ordinaire et répété ; l'inscrire au journal de l'entreprise le noierait.
- **⚠️ Elle n'ajoute AUCUNE restriction que la policy n'avait pas** — un
  inventaire clôturé n'est pas refusé, `articles_supervisor` ne le refuse pas
  davantage. Ce chantier corrige un délai, il ne change pas qui a le droit de
  faire quoi. Le jour où on voudra fermer ce cas, il se ferme **des deux côtés
  à la fois**, sans quoi le refus dépendrait du chemin emprunté.

## ⚠️ L'insertion, elle, n'avait pas besoin d'être touchée — mesuré

Tentant de tout basculer d'un coup. Mesuré plutôt que supposé : un lot de
1 000 lignes prend **488 ms** sous la même RLS par ligne (linéaire : 4,4 s pour
10 000). Avec `BATCH_SIZE = 1000` la marge tient quelle que soit la taille du
fichier — c'est pourquoi les insertions passaient ce matin-là alors que le
comptage et le vidage expiraient. **Ne pas augmenter `BATCH_SIZE`** : c'est lui
qui garde cette marge.

## Ce qui n'a pas de texte ne se sérialise pas en JSON

Second défaut, indépendant, et il vaut pour les deux plateformes :
`errorMessage` finissait par `JSON.stringify(e)`. Or PostgREST fabrique
`{ message: <corps> }` **chaque fois que le serveur répond en erreur avec un
corps vide** — délai dépassé, passerelle qui coupe. Le cas est donc exactement
celui où la personne a le plus besoin d'une phrase, et c'est celui où elle
recevait du JSON.

- **Le code technique survit quand il existe** (`Erreur inconnue [57014]`) :
  c'est ce qui retrouve l'incident dans les journaux. L'objet brut, lui, est
  déjà tracé par le `console.error` de l'appelant — il n'a rien à faire à
  l'écran.
- **Le délai dépassé se dit, et ne se confond pas avec une coupure réseau** :
  l'opération est partie et a été interrompue en route, ce n'est ni un refus ni
  une panne de connexion. La branche `57014` passe **avant** la branche réseau,
  qui capterait « statement timeout » sur son `/timeout/`.
- Les deux `lib/errors.ts` divergent par conception (noms et textes
  différents) ; ils portaient le **même** défaut, corrigé des deux côtés.
- Les deux `lib/import.ts` sont dupliqués volontairement et **bougent
  ensemble** : l'application portait le même DELETE, donc le même mur.

## Vérifications

- **En base, en transactions annulées, sur les fonctions réellement
  appliquées** : les deux temps ci-dessus ; le compteur refusé sur les deux
  fonctions, le superviseur non participant refusé, un inventaire d'un autre
  superviseur refusé, une cible inconnue refusée ; le vidage réel de 29 382
  lignes **laissant l'autre inventaire intact** (29 389) ; `anon` sans droit
  d'exécution sur les deux. Zéro résidu contrôlé après coup — 0 ligne à la
  forme des données d'essai, total inchangé à 58 935.
- **Les gardes mordent** : les cinq assertions de code ont été rejouées contre
  la version d'avant et **échouent toutes les cinq**. Un test qui passe sans
  rien vérifier ne protège rien.
- 849 tests du site, 380 de l'application, `tsc --noEmit` des deux côtés,
  `eslint .` à **zéro erreur** (les 39 avertissements sont la famille
  `react-hooks/*` déjà documentée, aucun sur les fichiers touchés), et
  `next build` avec la même table de routes.
- **⚠️ La migration est purement ADDITIVE** : deux fonctions nouvelles, aucune
  policy ni fonction existante modifiée. Le site en ligne, qui tourne encore
  sur l'ancien code, n'en souffre pas — il reste simplement à corriger jusqu'à
  son déploiement.

**Non vérifié à l'écran** : l'onglet Set up demande une session de superviseur,
que je n'ai pas. Ce qui est prouvé, c'est que les deux chemins serveur
répondent juste et vite, et que les messages d'erreur ne peuvent plus être du
JSON. Le contrôle qui reste à Julien tient en un geste : **rouvrir « HV » et
réimporter le fichier**.

Tests de garde : `web/tests/import-gros-referentiel.test.ts`.

## Un constat ne s'affiche pas comme une erreur (3 septembre 2026)

Suite du chantier ci-dessus. L'import réussi de 29 389 articles affichait, juste
sous le vert, un encadré **rouge** : « 7318 SKU en double dans le fichier —
dernière valeur conservée ». Question de Julien : *« pourquoi j'ai cette alerte
si on peut utiliser les doublons sans problème ? »*

**Il avait raison, et le mécanisme qu'il avait en tête n'était pas en cause.**
Un SKU répété avec un EAN **différent** est bien conservé à part (règle du
25 août). Ce qui déclenchait le rouge, c'était l'autre cas : le SKU répété avec
le **même** EAN — donc la même référence listée plusieurs fois, ce qui est
l'ordinaire d'un référentiel (une ligne par emplacement). Vérifié en base sur
« HV W&J » : 29 382 EAN sur 29 389 articles, et **zéro** ligne insérée sous son
EAN, donc `keptByEan = 0`. Rien n'était perdu ; l'écran criait sur un import
parfaitement réussi.

## ⚠️ `errors` et `notes` : ce qui manque, et ce qui a été regroupé

`ImportResult` porte désormais **deux listes**, des deux côtés du produit :

- **`errors`** — ce qui n'a PAS été importé, donc ce qui appelle un geste
  (« Ligne 412 : ni SKU ni EAN — ignorée »), plus l'échec fatal côté mobile ;
- **`notes`** — ce que l'import a regroupé ou dédoublé. Aucune référence perdue.

Les trois constats qui sortaient en rouge sont passés en notes : les doublons
stricts, les lignes gardées sous leur EAN, et l'agrégation multi-emplacements du
stock.

- **⚠️ Le texte dit ce qui s'est passé, et le mot « doublon » seul a disparu**
  — il laissait croire à un défaut du fichier. Désormais : « N ligne(s)
  répètent une référence déjà vue — une seule fiche par référence, **la
  dernière ligne fait foi** ». Cette fin n'est pas décorative : c'est la seule
  conséquence réelle, si les lignes répétées portaient un libellé, une marque
  ou un prix différents.
- **⚠️ La boîte neutre ne prend JAMAIS les jetons `danger`** — un test lit le
  bloc CSS et refuse le mot. Côté mobile, même règle : `noteBox` est sur
  `t.surface` + `t.hairline`, jamais `t.dangerSoft`.
- **`--bg`, pas `--surface-2`, pour le fond de `.import-notes`** : en clair
  `--surface-2` vaut `#ffffff`, donc la boîte n'avait aucun fond sur un panneau
  blanc et ne tenait qu'à son filet. **Trouvé à l'écran, pas dans le code** —
  c'est exactement ce que la capture apporte de plus que les tests.
- Les titres disent ce qu'ils contiennent : « Lignes non importées » (rouge) et
  « À savoir » (neutre). « Lignes signalées » ne distinguait rien.
- **⚠️ Côté mobile, `errors` porte AUSSI l'échec fatal** (`errors:
  [errorMessage(e)]` dans le `catch`) : on ne pouvait donc pas simplement
  recolorer la boîte existante. Le `catch` vide désormais `notes`, sans quoi les
  constats d'un import précédent survivraient à un échec.

## ⚠️ La garde « aucun emoji » ne voyait pas les commentaires JSX

Cinquième variante du même piège sur ce dépôt, et elle méritait mieux qu'un
contournement. `codeSeul` (`tests/compte.test.ts`) filtrait **ligne à ligne** les
débuts `//`, `*` et `/*` — donc un commentaire JSX lui échappait : `{/* … */}` ne
commence par aucun des trois, et ses lignes du milieu ne commencent par rien de
reconnaissable. Un `⚠️` posé dans un commentaire d'écran faisait échouer un test
qui vérifie ce que l'écran **affiche**.

Elle retire maintenant les blocs `/* … */` et `{/* … */}` **d'un coup**, avant
de filtrer les `//`. Vérifié dans les deux sens : un emoji remis dans du vrai
JSX la fait toujours échouer.

## Vérifications

- 853 tests du site (dont 5 nouveaux), 380 de l'application, `tsc --noEmit` des
  deux côtés, `eslint .` à zéro erreur, `next build` avec la même table de
  routes.
- **Au navigateur, clair ET sombre**, par route jetable (retirée, `git status`
  contrôlé) : les trois boîtes ensemble, puis le cas de Julien seul — vert +
  neutre, aucun rouge. Débordement horizontal nul, aucune erreur de console.
- ⚠️ **Piège de méthode** : une route jetable survit dans `.next/dev/types`
  après un `next dev`, et le `next build` suivant échoue sur un module
  introuvable. Ce n'est pas une régression — `rm -rf .next` avant de conclure.
- **Non vérifié à l'écran** : l'écran mobile d'import, qui demande une session
  de superviseur sur le téléphone. Le rendu est tenu par le test qui compare
  `noteBox` à `t.surface`.

Tests de garde : `web/tests/import.test.ts`, bloc « un constat ne s'affiche pas
comme une erreur ».

# Un inventaire de n'importe quelle taille (3 septembre 2026)

*« Nous étions en inventaire ce matin et n'avons pas pu utiliser l'outil. »*
Constat de Julien, après le correctif de la veille. Les journaux le confirment :
**sept erreurs entre 06:39 et 06:47 UTC**, toutes sur `/rest/v1/articles`, cinq
depuis son PC et **une depuis l'iPhone**.

Le correctif de la veille (`etat_import` / `vider_import`) était bon, mais il ne
fermait qu'une partie du chemin. Le balayage complet a trouvé **deux causes
distinctes**, de familles différentes, et il fallait les deux.

## ⚠️ Cause 1 : la policy RLS s'évalue UNE FOIS PAR LIGNE

`is_session_participant(session_id)` prend la colonne de la **ligne** : le
planificateur ne peut pas la remonter en InitPlan, et la fonction porte un
`set search_path`, donc elle n'est jamais inlinée.

**Mesuré sur la base réelle : 0,44 ms par appel.** Le délai d'`authenticated`
valant **8 s** (relevé sur `pg_roles`, pas supposé), on a un plafond dur :

> **~18 000 lignes** d'un même inventaire pour toute lecture directe.

- **⚠️ Un COMPTEUR ne paie pas.** Le plan montre que sa branche part en
  `hashed SubPlan`, évaluée une seule fois. C'est le **superviseur** qui paie,
  parce que sa branche est la première du `OR`. Ne pas chercher le défaut du
  côté des compteurs.
- **⚠️ Ce n'est PAS un défaut d'index**, et c'est la première fausse piste à
  écarter : le plan fait bien `Index Only Scan`, `Heap Fetches: 0`. Le temps ne
  part pas dans la lecture, il part dans la policy. Un index de plus n'aurait
  rien donné.

## ⚠️ Cause 2 : deux fonctions dépendaient de la fraîcheur des STATISTIQUES

Et celle-là ne se voit dans aucun code. `recompute_session_audit` finissait par
un `not exists` **corrélé**. Même requête, mêmes données, 29 389 lignes d'audit
contre 58 778 comptages :

| statistiques | plan | temps |
|---|---|---|
| à jour | `Hash Right Anti Join` | **53 ms** |
| périmées | boucle imbriquée | **> 45 s** (délai dépassé) |

Un rapport de mille. Et elles sont périmées **exactement au moment qui compte** :
juste après l'import de 30 000 lignes, avant qu'autovacuum ne soit passé.

`get_session_detail` — le tableau du Rapport — avait la même maladie sous une
autre forme : **une CTE jointe à elle-même** (`cnt` et `aud`, deux découpes de
`c`, réunies puis re-jointes). Une CTE n'a **aucune statistique** : le
planificateur devine, et s'il devine petit il choisit une boucle imbriquée, soit
29 389 × 29 389 parcours.

**La leçon, plus large que ce chantier** : `SECURITY DEFINER` met à l'abri de la
RLS, pas du planificateur. Une fonction qui joint une CTE à elle-même, ou qui
corrèle une sous-requête sur une colonne, est une bombe à retardement qui
n'explose que sur un gros volume ET des statistiques fraîches d'un import.

## Ce qui a été fait

Trois migrations (`20260903140001..3`). Tout est mesuré **avec des statistiques
volontairement périmées**, sur les 29 389 articles réels de « HV W&J » :

| chemin | avant | après |
|---|---|---|
| `recompute_session_audit` (onglet Écarts, écran audits) | **> 45 s** | **1 025 ms** |
| `get_session_detail` (Rapport, export) | **> 45 s** | **445 ms** |
| écarts + libellés (`getAudits` + 150 requêtes) | ~13 s + 150 A/R | **190 ms** |
| cache hors ligne complet, 30 pages | ~170 s, échec dès la page 20 | **391 ms** |
| dernière page du référentiel | 10 832 ms | **2 ms** |
| « ce que j'ai compté » | balayait tout | **273 ms** |
| liste des scans d'une balise | somme au téléphone + 10 A/R | **246 ms** |

- **⚠️ Le ménage de l'audit passe par un MARQUEUR, plus par une jointure.**
  L'upsert touche exactement les couples (zone, sku) qui portent des comptages
  et leur pose `v_marque` ; ce qui reste avec une autre valeur n'a plus aucun
  comptage. C'est la définition même de ce que le `not exists` cherchait, **sans
  jointure, donc sans plan à rater**. Ne pas « simplifier » en revenant à un
  `not exists`.
- **⚠️ LA PAGINATION DU RÉFÉRENTIEL EST PAR CLÉ, PLUS PAR `OFFSET`.** Avec
  `range()`, la page N repayait le contrôle sur les N × 1 000 lignes
  précédentes — un coût qui croît avec le carré du catalogue. Le cache hors
  ligne d'un superviseur ne se remplissait **plus du tout** au-delà de ~20 000
  articles, **en silence** (`primeOfflineCache` rend `false`, l'écran dit
  seulement « hors ligne dégradé »).
- **⚠️ `mes_balises_comptees` corrige aussi un CONTRESENS, antérieur au sujet de
  la charge.** `getMyCounts` ne filtrait sur personne : c'est
  `counts_select_own` qui bornait un **compteur** à ses lignes. Un
  **superviseur** relève de `counts_select_supervisor` — il voyait donc **toute
  l'équipe** sous un écran intitulé « ce que ce compteur a déjà compté ». Le
  filtre `auth.uid()` est maintenant dans la fonction : il ne dépend plus du
  rôle de qui appelle. Même défaut, même correctif que `get_my_count_totals` le
  22 août 2026.
- **⚠️ Le périmètre reste fixé par le SERVEUR.** Un inventaire, une balise, une
  tranche bornée à 5 000. Jamais une liste choisie par le client — c'est ce que
  VR-007 a fermé le 28 août, et un test refuse un paramètre tableau.
- **`membre_ou_superviseur` n'est PAS une surface cliente** : révoquée à `anon`
  **et** à `authenticated`. Les fonctions qui l'appellent sont `SECURITY
  DEFINER`, elles s'exécutent avec les droits du propriétaire. Elle existe parce
  que quatre fonctions portaient le même garde, et que le projet a déjà payé le
  prix de deux fonctions sœurs qui divergent.
- **`getTheoreticalStock` a été retirée** : aucun appelant depuis longtemps.

## ⚠️ Le garde-fou des gardes-fous, corrigé au passage

`derniereDefinition` ne reconnaissait que `create or replace function`. Or
changer la liste des colonnes de retour impose un `drop` préalable, et le
`create` qui suit n'a pas besoin du `or replace` — c'est ce qu'a fait
`mes_balises_comptees`. Le helper serait donc remonté à la définition
**précédente**, celle qui ne tourne plus : **exactement le défaut qu'il existe
pour empêcher**. Il accepte maintenant les deux formes.

## Vérifications

- **En base, tout en transactions annulées**, sur les fonctions réellement
  appliquées, statistiques volontairement périmées : les sept temps du tableau ;
  le ménage qui supprime bien ses 500 lignes orphelines **et préserve un
  arbitrage** ; et la matrice d'accès complète — un **compteur** lit le
  référentiel, ses balises et ses scans mais est **refusé** sur les écarts et le
  rapport ; un **étranger** est refusé sur les cinq ; un **superviseur** obtient
  **0 ligne** de `mes_balises_comptees`, puisqu'il n'a rien compté lui-même
  (c'est le contresens corrigé, visible en une mesure).
- **Zéro résidu contrôlé** après coup : 165 comptages, 156 lignes de stock,
  62 audits, 29 553 articles, 5 inventaires — identiques à avant.
- **Les gardes mordent** : les huit assertions d'absence rejouées contre la
  version d'avant échouent toutes les huit.
- 876 tests du site, 380 de l'application, `tsc --noEmit` des deux côtés,
  `eslint .` à **zéro erreur** (39 avertissements, la famille `react-hooks/*`
  déjà documentée), `next build` avec la même table de routes.

**Non vérifié à l'écran** : l'onglet Écarts, le Rapport et les écrans mobiles
demandent une session de superviseur, que je n'ai pas. Ce qui est prouvé, c'est
que les sept chemins serveur répondent juste, vite, et aux bonnes personnes.

⚠️ **L'application doit être reconstruite** : le correctif de l'import du
2 septembre **et** celui-ci vivent dans le dépôt, pas sur le téléphone. C'est
l'iPhone qui a produit la sixième erreur de la matinée.

**Piste laissée ouverte, et pourquoi** : `get_balise_detail` (2 septembre) porte
la même forme de CTE jointe à elle-même. Elle est bornée à **une balise** —
quelques centaines de références —, donc même une boucle imbriquée y reste
indolore. À reprendre le jour où une balise porterait des milliers de
références, pas avant.

Tests de garde : `web/tests/inventaire-de-toute-taille.test.ts`.

## 400 000 références — le plafond, mesuré (3 septembre 2026)

*« Jusqu'à combien peux-tu monter le plafond ? Un vrai inventaire peut aller
jusqu'à 400 000 références, on doit voir large. »*

Mesuré d'abord, sur un inventaire synthétique de **382 057 références et
764 114 comptages**, en transactions annulées, **statistiques volontairement
périmées**. Tout passait, sauf une chose :

| chemin | à 382 057 références |
|---|---|
| cache hors ligne complet (383 pages) | 709 ms |
| liste des écarts | 2 058 ms |
| rapport | ~2 500 ms |
| **recalcul des écarts** | **16 503 ms** |

### ⚠️ Il n'existe pas de version rapide du recalcul COMPLET

Trois optimisations essayées, mesurées, et le plancher n'a pas bougé :

- index d'expression sur l'agrégat → l'agrégat tombe à **541 ms** ;
- `where` sur le `do update` → n'écrit plus que ce qui change ;
- `enable_nestloop` fermé → l'anti-jointure passe en hachage.

Et pourtant un recalcul « rien n'a changé » coûtait encore **6,6 s**. La raison
est structurelle : **`insert … on conflict` doit insérer puis détecter le
conflit sur CHACUNE des 382 057 lignes**, même quand la clause `where` l'empêche
d'écrire au bout. Sonder 400 000 lignes prend cinq secondes, un point c'est
tout.

**La seule issue est de ne plus tout recalculer à chaque ouverture.**

### L'empreinte

`counts` est en **ajout pur** : hors suppression explicite, le nombre de lignes
ne peut que croître. Le nombre de comptages est donc une empreinte **exacte** —
inchangé ⟹ rien n'est arrivé ⟹ l'audit est déjà juste.

| | avant | après |
|---|---|---|
| 1er recalcul (382 057 lignes à créer) | 16 503 ms | **15 003 ms** |
| recalcul, rien n'a bougé | 16 503 ms | **423 ms** |
| recalcul, 500 scans de plus | 16 503 ms | **7 194 ms** |

- **⚠️ L'exactitude tient à une règle, pas à une heuristique : TOUTE
  suppression de comptages efface l'empreinte.** Sans cela, une suppression
  suivie d'un ajout redonnerait le même compte et l'audit resterait faux **en
  silence**. `vider_balise` et `delete_audit_line` appellent donc
  `oublier_empreinte_audit`. Un test de garde balaie **toutes** les migrations,
  retrouve la dernière définition de chaque fonction contenant
  `delete from public.counts`, et exige l'appel — avec deux exemptions nommées :
  `delete_session` (la ligne part en cascade) et `revert_pass` (révoquée à
  `authenticated` depuis le 13 août 2026, donc injoignable ; la redéfinir
  rendrait EXECUTE à PUBLIC et rouvrirait ce trou pour un gain nul).
- **⚠️ L'empreinte ne peut PAS vivre sur `inventory_sessions`** : un superviseur
  a le droit d'y écrire (`sessions_supervisor_update`), il pourrait donc figer
  une empreinte fausse depuis le navigateur et **geler ses propres chiffres
  d'audit**. Table à part, RLS active, aucune policy, révoquée à
  `authenticated` — le motif de `stripe_events_traites`.
- **⚠️ `p_force` n'est pas une commodité.** L'annulation d'un arbitrage écrit
  **directement** dans `article_audit` sans toucher aux comptages : l'empreinte
  ne bouge pas, le raccourci s'activerait, et la ligne resterait « à traiter »
  au lieu de retrouver son vrai statut. C'est le **seul** appelant qui force,
  des deux côtés. L'ancienne signature à un argument est **supprimée** (piège de
  `p_event_id` et de `ca_request_store`) ; un appel nommé à un argument continue
  de fonctionner.
- **`set statement_timeout to '60s'` sur la fonction** : le tout premier
  recalcul d'un inventaire entièrement compté crée autant de lignes qu'il y a de
  références — ~15 s à 400 000, incompressible, et une seule fois. Les 8 s par
  défaut le tuaient.

### ⚠️ Le marqueur du matin n'a pas survécu à l'après-midi

Le premier correctif du jour remplaçait l'anti-jointure par un **marqueur**
(`v_marque` posé par l'upsert, relu par le delete) — plan-proof, 87 ms sur
29 889 lignes. Il exige de **réécrire toutes les lignes à chaque recalcul** :
dix secondes d'écriture pour rien à 400 000. La protection est donc passée du
côté du **plan** : `set enable_nestloop to off` rend le mauvais choix impossible
quelles que soient les statistiques (mesuré : boucle imbriquée > 45 s, hachage
53 ms), et l'upsert n'écrit plus que ce qui change. Le bloc de garde a été
**récrit, pas affaibli** — il vérifie désormais que la boucle est fermée et que
le marqueur a disparu.

### Vérifications

- **Sept contrôles de justesse sur les données réelles**, en transaction
  annulée : l'audit reproduit exactement l'agrégat des comptages, les statuts
  suivent la même règle qu'avant, une ligne orpheline est retirée, un arbitrage
  survit, un scan arrivé après l'empreinte est bien pris, le raccourci ne
  s'active que si rien n'a bougé, et vider une balise efface l'empreinte.
- **Zéro résidu contrôlé** : 29 553 articles, 165 comptages, 62 audits,
  156 lignes de stock — identiques à avant.
- **La garde du §empreinte mord** : en retirant l'appel dans `vider_balise`,
  elle échoue **en nommant la fonction fautive**.
- 884 tests du site, 380 de l'application, `eslint .` à zéro erreur,
  `next build` avec la même table de routes.

⚠️ **Piège de méthode du jour** : un premier contrôle a annoncé 8 lignes
divergentes. C'était le TEST, pas la fonction — dans un `full join`, une
condition sur la table de droite posée dans le `ON` laisse remonter **toutes les
lignes des autres inventaires** comme si elles divergeaient (62 audits au total
− 54 pour cet inventaire = les 8). Filtrer la table AVANT la jointure. Ne pas
conclure à une régression sur un `full join` mal écrit.

### Ce qui reste, et à quel prix

Sur un inventaire de 400 000 références en cours d'audit, **une ouverture de
l'onglet Écarts après de nouveaux scans coûte ~7 s** — le plancher du sondage
décrit plus haut. Le rendre instantané demanderait de ne recalculer que les
couples (balise, référence) réellement touchés, donc une colonne d'**ordre
d'arrivée posée par le serveur** sur `counts`. ⚠️ **`created_at` ne peut pas
servir** : la file hors ligne envoie l'heure réelle du scan
(`src/lib/offline.ts`), donc un téléphone qui se synchronise après coup insère
des lignes **antidatées** — un repère fondé sur `created_at` les manquerait, et
l'audit serait faux sans que rien ne le dise. Chantier à ouvrir seulement si un
client atteint réellement cette taille.

# Un inventaire de 400 000 références tient (3–4 septembre 2026)

Julien, après une matinée d'inventaire ratée chez un client : *« un inventaire
peut se faire avec la participation d'une centaine de participants, sur un
magasin avec plus de 500 000 unités, pour plus de 400 000 références […]
N'invente pas et vérifie réellement et sois honnête sur les limites de
l'app. »*

Deux journées de mesures et de corrections. Le compte rendu chiffré vit dans
`docs/exploitation/mode-demploi.md` §1 ; ce qui suit est ce qu'il ne faut pas
défaire.

## ⚠️ LE PLAFOND EST 8 SECONDES, ET IL DÉCIDE DE TOUT

Le rôle `authenticated` porte un `statement_timeout` de **8 s** (relevé sur
`pg_roles`, pas supposé). Toute requête plus longue est tuée et l'écran affiche
une erreur. C'est **le** chiffre à avoir en tête avant d'écrire une fonction
qui balaie un inventaire.

**Peut-on le relever ? Oui, et on le fait déjà — sélectivement.**
`recompute_session_audit` s'accorde 60 s, parce que son premier calcul est long
par nature et n'arrive qu'une fois par inventaire. **Jamais globalement** :

- c'est un **fusible**, pas un mur. Une requête lente occupe une des 90
  connexions pendant tout ce temps ; relever le plafond transforme « un écran
  tombe en erreur » en « le site rame pour tout le monde » ;
- 8 s dépasse déjà ce qu'un humain attend — on échangerait une erreur franche
  contre une attente inutile ;
- c'est le réflexe « monter le serveur » sous un autre nom. **Le plafond n'a
  jamais été la cause : il révèle du travail inutile.**

La bonne forme, pour une opération longue par nature : un `set
statement_timeout` **sur cette fonction-là**.

## ⚠️ LA RÈGLE QUI GOUVERNE TOUT CE CHANTIER

> **Le travail du serveur doit dépendre de ce qu'on AFFICHE, pas de la taille
> de l'inventaire.**

Un écran de 50 lignes doit coûter le prix de 50 lignes, que l'inventaire en
compte 500 ou 500 000.

Les facteurs mesurés, sur le même écran, disent lequel des deux leviers
compte :

| | Facteur gagné |
|---|---|
| Monter la machine (Micro → Small) | **×1,3** |
| Ne charger que 50 lignes au lieu de 400 000 | **×30** |
| Ne pas refaire un calcul déjà fait (l'empreinte) | **×80** |

**Ne pas répondre « il faut monter le serveur » à un écran lent.** La machine
achète de la marge, elle ne change pas d'ordre de grandeur. Elle compte, en
revanche, pour la **concurrence** — 90 connexions au lieu de 60, deux fois le
cache — et c'est le seul argument qui tienne pour le Small.

## Le tableau des balises (`get_zone_dashboard`, `20260903170001`)

Il est tombé **en 500 en production** pendant la mesure. C'est l'appel le plus
fréquent du produit : le tableau de bord **et** l'écran de comptage de chaque
téléphone, rejoué à chaque ouverture et à chaque clôture de balise.

- **⚠️ `auth.uid()` était appelée PAR LIGNE**, dans quatre `filter (...)`. Elle
  est lue **une fois** dans une variable (`v_moi`). Piège Supabase classique :
  le planificateur ne remonte pas un appel de fonction placé dans un agrégat.
- **⚠️ Les quatre `count(distinct sku)` forçaient un tri global** qui débordait
  sur disque. Remplacés par une agrégation par `(zone, sku, passe)` puis un
  simple `count(*)`. **6 225 → 1 916 ms**, sortie identique (501 balises
  d'essai, 70 réelles).
- Index `counts_session_zone_sku_pass_idx (session_id, zone, sku, pass_number)`.
- Le plafond de 8 s passe d'environ **1,1 à 3,7 millions de comptages**.

## La pagination (`20260903190001`, `…200001`, `…210001`)

Le Rapport et les Écarts rendaient 400 000 lignes d'un coup. Ils en lisent
**50 à la fois**, recherche, tri et totaux calculés en base.

- **⚠️ L'EXPORT CONTIENT TOUJOURS TOUT.** C'est ce que le client reçoit : le
  navigateur parcourt les pages par tranches de 5 000 et assemble le fichier.
  Ne jamais « simplifier » l'export en le limitant à la page affichée.
- **⚠️ Les totaux portent sur l'inventaire ENTIER**, jamais sur la page. Des
  tuiles qui changeraient en tournant les pages ne voudraient rien dire.
- **⚠️ L'ORDRE DOIT ÊTRE TOTAL** — le SKU départage toujours. Sans lui, deux
  lignes de même valeur changent de place entre deux pages : on en voit une
  deux fois et une autre jamais. C'est le piège classique de la pagination, et
  il ne se voit qu'en production.
- **⚠️ Deux ordres différents, et c'est voulu** : le site range par balise (on
  relève méthodiquement), **le téléphone met en premier ce qui reste à
  trancher** (`p_ordre = 'a_traiter'`) — quelqu'un debout dans un rayon veut le
  travail qui reste. Tant que tout tenait dans une réponse, chacun triait chez
  lui ; avec la pagination l'ordre décide du CONTENU de la page, donc il vient
  du serveur.
- **⚠️ Le périmètre reste fixé par le serveur** : une page ne dépasse pas
  5 000 lignes quoi que demande l'appelant. Sans ça on redemande les 400 000
  par la porte de derrière.
- **La règle qui décide ce qui est un écart est passée EN BASE**, clause par
  clause : elle avait besoin de toutes les lignes pour trancher, donc elle ne
  pouvait pas paginer depuis le navigateur.

## ⚠️ Les gros écrans n'assemblent plus l'univers des articles (`20260904120001`)

Constat de Julien avec deux inventaires de 400 000 références en base : le
tableau de bord d'atterrissage **ne se rafraîchit plus**. Reproduit :
`tableau_de_bord_superviseur` mettait **8 459 ms**. Dont **5 767** à fabriquer
l'univers des SKU — une union de 800 000 lignes, triée et dédoublonnée **sur
disque** — pour rendre un anneau à cinq parts.

- **⚠️ L'ÉCART D'UN INVENTAIRE SE DÉCOMPOSE.**
  `Σ (compté − théo) × prix = Σ compté×prix − Σ théo×prix`. Chaque terme est
  **une** jointure et **une** somme : plus d'univers, plus de tri. C'est une
  identité arithmétique, pas une approximation — vérifiée **identique au
  centime** sur les quatre inventaires réels et deux jeux de 400 000
  références. → **8 459 → 3 438 ms**.
- **⚠️ L'univers du Rapport est une JOINTURE EXTERNE COMPLÈTE, pas une union.**
  Lui a besoin d'une ligne par SKU, donc pas de décomposition possible — mais
  `théorique ∪ compté` puis trois jointures gauches, c'est ce que fait un
  `full join` entre deux ensembles déjà uniques par SKU, en une passe.
  → `rapport_page` **3 358 → 2 336 ms**, `rapport_resume` **3 051 → 1 969 ms**.
- **⚠️ LE FILTRE D'INVENTAIRE SE POSE AVANT LA JOINTURE, JAMAIS DANS LE `ON`.**
  Dans un `full join`, une condition du `on` ne filtre pas : elle décide de
  l'appariement, et les lignes des **autres** inventaires ressortent du côté
  externe. Essayé : 800 156 lignes au lieu de 400 000. D'où la CTE `theo`, qui
  filtre d'abord. Le même piège avait déjà fait croire à une régression la
  veille, dans un test.
- **⚠️ LE TRI FINAL N'ÉTAIT PAS LE COUPABLE** — c'est un « top-N heapsort » de
  31 ko. Tout le coût était dans l'assemblage. **Mesurer avant de conclure
  qu'il faut un index de tri** : la première hypothèse, annoncée à Julien,
  était fausse.
- **Un défaut trouvé en PROUVANT l'équivalence** : deux inventaires à égalité
  à 0,00 € sortaient dans un ordre différent d'une exécution à l'autre — donc
  la cinquième part de l'anneau changeait d'inventaire. Antérieur à la
  réécriture ; corrigé par un départage (`, f.id`). Même règle que la
  pagination : **un ordre doit être total.**
- **Écarté, et pourquoi** : monter `work_mem` sur ces fonctions gagne encore
  ~200 ms, pour 100 à 300 Mo de mémoire par requête sur une machine qui en a
  2 Go, avec 90 connexions possibles. **Le gain ne vaut pas le risque** ; la
  réécriture, elle, ne coûte rien.

## On est prévenu avant le client (`20260903180001`, `…180002`)

Quantinvo est en **libre-service** : le client lance ses inventaires quand il
veut, sans nous prévenir. Rien ne s'anticipe. Le tour de garde pose donc une
**troisième** question toutes les heures : *un inventaire s'approche-t-il de ce
que le produit tient ?* E-mail **et** cloche, à deux repères — **150 000
références** (à l'import, souvent des jours avant) et **400 000 comptages**
(pendant le comptage).

- **Il ne se répète pas** : un gros inventaire le reste jusqu'à sa clôture, et
  le redire chaque matin ferait qu'on cesse de le lire.
- **⚠️ Le message se compose par NATURE** (`paiement`, `purge`, `volume`) :
  un texte unique ferait dire « un paiement sans suite » à propos du ménage.
- **⚠️ Défaut trouvé en le testant pour de vrai : la cloche restait muette
  pendant que l'e-mail partait.** DEUX filtres refusaient le type
  `inventaire_volumineux` — la contrainte `notifications_type_check` **et** la
  liste blanche de `mes_notifications`. Ajouter un type de notification
  demande de toucher les deux.
- Les seuils vivent dans la migration, et nulle part ailleurs.

## Lire un long tableau sans se tromper (4 septembre 2026)

Trois constats de Julien sur l'inventaire de démonstration.

- **⚠️ SANS RÉSUMÉ, LES TUILES ÉCRIVENT « — », JAMAIS « 0 ».** Quand le calcul
  dépassait le délai, elles retombaient à zéro : *« c'est juste écrit 0 écart,
  si le client n'attend pas, il pourrait crier victoire alors qu'en réalité ça
  load »*. Un zéro se lit comme un résultat. Un échec de calcul s'affiche
  désormais avec de quoi réessayer.
- **L'attente se DIT** (`.chargement-note`, une ligne + une roue) : une
  ossature grise muette ressemble à une page vide.
- **⚠️ LES BOUTONS DE PAGE SONT EN HAUT AUTANT QU'EN BAS.** Sur un écran de
  14 pouces — la taille de travail habituelle — cinquante lignes passent sous
  le pli et ceux du bas restent hors de vue. Composant unique
  (`components/ui/Pagination.tsx`), rendu deux fois.
- **Changer de page ramène le haut du tableau sous les yeux**
  (`useRetourEnHaut`), **jamais au premier rendu** : on ferait sauter la page
  de quelqu'un qui vient d'arriver sur l'onglet.

## Les nombres se lisent (4 septembre 2026)

- **⚠️ SÉPARATEUR DE MILLIERS PARTOUT.** *« 1000 > 1 000, plus facile à
  lire. »* Ce n'est pas un ornement : la colonne des quantités porte des
  nombres à cinq ou six chiffres, et « 128400 » ressemble à « 12840 » au coup
  d'œil — à l'endroit précis où l'on cherche un écart. Site : `fmtQty`,
  `plural`, `nb`. Application : **`src/lib/nombres.ts`**, qui remplace les deux
  copies de `fmt` qui vivaient chacune dans son écran.
- **⚠️ AFFICHAGE SEULEMENT.** Ni l'import, ni l'export, ni une valeur envoyée
  en base : `toLocaleString` insère une espace **insécable étroite** (U+202F)
  qu'aucun tableur ne relit comme un chiffre. Un test balaie `src/` pour l'un
  et l'autre point.
- **⚠️ La locale est TOUJOURS nommée.** `toLocaleString()` nu suit la langue du
  téléphone — « 1,000 » sur un appareil anglais, au milieu d'une interface en
  français. Un test l'interdit dans tout `src/`.
- **Les montants du tableau de bord s'abrègent en k€** à partir de 1 000
  (`moneyCourt`), **avec le chiffre exact au survol** — un montant arrondi
  qu'on ne peut pas déplier est un montant faux. **Jamais les pièces**, qui se
  comptent.
- ⚠️ Piège de test : comparer à une chaîne tapée au clavier échoue, avec un
  message où les deux valeurs **paraissent identiques**. Normaliser
  les deux espaces invisibles — `U+202F` (insécable étroite, celle que pose
  `fr-FR`) et `U+00A0` — avant d'assertir.

## La concurrence, enfin mesurée (4 septembre 2026)

C'était le trou de ce chantier : toutes les mesures étaient faites **une
requête à la fois**, et « cent compteurs en même temps » restait de
l'arithmétique. Julien : *« Et tu ne peux pas faire ce test ? »*

**⚠️ LE BANC PASSE PAR `pg_cron`, ET C'EST LE POINT DE MÉTHODE À RETENIR.**
`cron.use_background_workers` vaut `off` sur ce projet : chaque tâche ouvre
**une vraie connexion**, donc N tâches programmées à la même minute donnent N
requêtes réellement simultanées. `cron.max_running_jobs = 32` fixe le plafond
du banc. Rien à installer.

- **⚠️ NE PAS INSTALLER `dblink` POUR ÇA.** Il est disponible et il ferait le
  travail — mais c'est une porte de connexions sortantes ouverte en
  production, la famille de `pg_net`. Le gain ne vaut pas la surface.
- **Chaque tâche se désinscrit elle-même** (`cron.unschedule` en second
  ordre), **et** un nettoyage explicite balaie `charge-%` derrière. Une tâche
  de test oubliée tourne toutes les heures, indéfiniment.
- Table de résultats et fonctions de banc **révoquées** à `anon` et
  `authenticated` le temps de leur existence, puis supprimées.
- Rester **loin du plafond de connexions** : 19 étaient déjà prises sur 60,
  donc 32 au maximum. Saturer `max_connections` sur la base de production
  rendrait le site indisponible.

### Ce que ça donne, sur `get_zone_dashboard` (l'appel le plus fréquent)

**Inventaire de 400 000 références** — le pire cas :

| Simultanés | Réponse | Débit |
|---|---|---|
| 1 | 1 649 ms | 0,6 /s |
| 5 | 3 154 ms | 1,57 /s |
| 10 | 5 840 ms | 1,67 /s |
| 20 | **11 881 ms** | 1,65 /s |

**Inventaire de taille réelle** (30 000 références, 400 balises) :

| Simultanés | Réponse | Débit |
|---|---|---|
| 1 | 174 ms | 5,7 /s |
| 20 | 651 ms | 25,2 /s |
| 32 | 1 063 ms | 23,0 /s |

**⚠️ LE DÉBIT EST PLAT, ET C'EST TOUTE LA LEÇON.** 1,65 appel/s sur le gros
inventaire, 24/s sur un inventaire normal — quel que soit le nombre de gens.
La machine a deux cœurs ; au-delà, chaque personne de plus ne fait
qu'**attendre son tour**, et le temps de réponse monte en ligne droite.

Conséquences, en clair :

- **Sur un inventaire normal, 100 compteurs passent** : ≈ 4,2 s si tous
  appuyaient à la même seconde, et en réalité une centaine de compteurs
  produit ~2 appels/s, soit **8 % de la capacité**.
- **⚠️ Sur un inventaire de 400 000 références, le 13e appel simultané dépasse
  déjà les 8 s** et l'écran tombe en erreur. Mesuré : 11,9 s à vingt. **Le mur
  n'est pas le nombre de compteurs, c'est la taille de l'inventaire.**

### L'écriture n'est pas le problème, et c'est maintenant prouvé

32 compteurs simultanés, 10 scans chacun, **RLS active** (le chemin réel d'un
téléphone) : **320 écritures en 774 ms, soit 413 scans/seconde, zéro erreur.**

Cent compteurs à six scans par minute font 10 écritures/s — **2,4 % de cette
capacité**. Le chiffre de 3 ms par scan, mesuré en solo depuis le 3 septembre,
tient sous contention. Ne pas chercher le problème de ce côté.

## Le catalogue hors ligne ne part plus en entier (4 septembre 2026)

Julien, après la mesure de charge : *« ne télécharger que ce dont chaque
compteur a besoin »*. C'était le seul point que la mesure désignait comme un
vrai risque, et le seul hors de notre contrôle : le wifi du magasin.

**Mesuré avant d'agir** : chaque téléphone téléchargeait **304 octets par
référence**, à chaque ouverture de l'écran de comptage — 8,9 Mo pour 30 000
références, **116 Mo pour 400 000**. Cent compteurs, 11,6 Go.

Deux leviers, une seule fonction nouvelle (`20260904160001`) :
**304 → 110 octets, soit −64 %**, et **zéro octet quand rien n'a changé**.

- **⚠️ Le serveur n'envoie plus que ce que le scanner LIT** — `sku`, `ean`,
  `label`, `brand`, `prix`. Vérifié champ par champ dans `src/` avant de
  retirer quoi que ce soit : l'identifiant interne, celui de l'inventaire et
  la date de modification ne sont jamais lus d'un article téléchargé, et le
  code-barres partait **en double** (brut et normalisé).
  · **Le NOM des colonnes compte** : `unit_purchase_price` pèse 21 octets
    **par ligne** dans le JSON, `prix` en pèse 6. Sur 400 000 lignes, 6 Mo.
  · `ean_norm` se recalcule sur le téléphone. **⚠️ Les deux copies clientes
    doivent reproduire la colonne générée mot pour mot** (`NULLIF(ltrim(ean,
    '0'), '')`) — sinon un code scanné ne retrouve plus son article. Un test
    les compare.
  · **⚠️ Un article téléchargé n'a pas d'identité locale** (`id: ''`). Seuls
    ceux créés en réserve en ont besoin, pour partir dans la file.
- **⚠️ Le repère se prend AVANT la pagination.** Ce qui change pendant qu'on
  tourne les pages porte une date postérieure : ce sera pour le passage
  suivant, et rien n'est perdu. L'ordre inverse ouvrirait un trou.
- **⚠️ `p_depuis` compare en STRICTEMENT SUPÉRIEUR.** Un import écrit toutes
  ses lignes dans une seule transaction, donc avec le même `updated_at` : un
  `>=` les redemanderait **toutes** à chaque passage et le levier ne servirait
  plus à rien.
- **⚠️ ET LE DÉCOMPTE RATTRAPE LES SUPPRESSIONS.** C'est la moitié qu'on
  oublie : une date de modification ne dit **rien** d'une ligne effacée — et
  remplacer un fichier d'import en efface. Le téléphone compare ce qu'il croit
  connaître au total du serveur ; au moindre écart il retélécharge tout. Sans
  ça, le cache garderait des fantômes et un code scanné se résoudrait sur un
  article que le référentiel ne contient plus. C'est aussi ce qui ferme le
  trou théorique du `>` (deux transactions à la microseconde près).
- **⚠️ Les articles saisis en réserve sont écartés du décompte** : ils sont
  dans le cache et pas encore en base. Les compter ferait diverger le total à
  chaque saisie manuelle, donc retélécharger pour rien.
- **⚠️ `lister_articles` N'EST PAS TOUCHÉE**, et l'ancienne enveloppe
  `getSessionArticles` non plus : les téléphones déjà sur le terrain les
  appellent. Règle du projet — le code se déploie d'abord, l'objet se retire
  ensuite. À supprimer quand le build de septembre sera partout.

**Ce qui a été écarté, et pourquoi** : découper le catalogue par rayon. Un
compteur peut être envoyé sur n'importe quelle balise — s'il n'a que son rayon
en poche, le premier article scanné ailleurs devient « inconnu ». C'est la
fonction même du cache qui tombe.

Tests de garde : `tests/offlineSync.test.ts` (le delta, la suppression, la
saisie en réserve, sur le VRAI module) et `tests/compte.test.ts`.

## Dix inventaires de cette taille (4 septembre 2026)

Question de Julien : *« si demain on en a dix de cette ampleur, tout plante
non ? »* Réponse mesurée : **non, ce n'est pas la vitesse qui casse — c'est la
place.** Trois constats, dans l'ordre où ils comptent.

### 1. Les écrans NE ralentissent PAS, et c'est contre-intuitif

Chaque écran travaille sur **un seul inventaire**, et les quatre grosses
tables ont toutes un index qui commence par `session_id`. Aujourd'hui le
moteur balaie parfois la table entière — uniquement parce qu'un inventaire de
démonstration en représentait **la moitié**. À dix inventaires, il n'en
représente plus qu'un dixième et le planificateur bascule sur l'index.

Vérifié en le forçant (`set enable_seqscan = off`) :

| Écran, sur 400 000 réf. | Balayage | Par index |
|---|---|---|
| Rapport — les totaux | 2 767 ms | **2 593 ms** |
| Rapport — une page | 2 966 ms | **2 707 ms** |
| Tableau des balises | 1 649 ms | **1 442 ms** |

**Aussi rapide, voire un peu plus.** Le travail dépend de l'inventaire qu'on
regarde, pas de ce qu'il y a à côté — la règle du chantier tient ici aussi.
**Ne pas répondre « il faut monter le serveur » à cette question-là.**

### 2. ⚠️ LE MUR EST LA PLACE, ET RIEN N'EFFACE JAMAIS UN INVENTAIRE

Un inventaire de 400 000 références pèse **~680 Mo** (comptages, articles,
stock théorique, audit, et leurs index). Dix font **~6,8 Go**, pour un disque
de l'ordre de 8 Go. Et quand un disque Postgres se remplit, ce n'est pas un
ralentissement : **la base refuse d'écrire**, l'inventaire s'arrête.

**⚠️ `purge_expired_data` ne touche AUCUNE table d'inventaire** — vérifié, elle
ne nettoie que les demandes, invitations, journaux, notifications et
événements Stripe. Les 635 000 lignes de scan d'un inventaire clôturé il y a
deux ans sont toujours là, entières.

Ce n'est pas un défaut : c'est **une décision jamais prise**. Combien de temps
garde-t-on le détail brut d'un inventaire clôturé ? Le rapport et les écarts
font foi et doivent rester ; les scans qui les ont produits, un an après, sont
une autre question — et elle a un versant RGPD, ces lignes portant qui a
compté quoi.

### 3. ⚠️ SUPPRIMER NE REND PAS LA PLACE — le constat qui change le plan

Les deux inventaires de démonstration supprimés, la base **ne bougeait pas
d'un octet** : 1 382 Mo avant, 1 382 Mo après. Postgres marque les pages
réutilisables, il ne les rend pas.

| Étape | Base |
|---|---|
| Avant suppression | 1 382 Mo |
| Après le `DELETE` | **1 382 Mo** |
| Après `VACUUM ANALYZE` | 976 Mo |
| Après `VACUUM FULL` | **25 Mo** |

Le plus parlant : après le ménage ordinaire, `counts` occupait encore
**470 Mo pour 165 lignes** — ce sont les index qu'un `VACUUM` simple ne
compacte pas.

- **⚠️ `VACUUM ANALYZE` n'est PAS optionnel après une grosse suppression.** Le
  planificateur croyait encore à 1,27 million de lignes dans `counts` : il
  aurait choisi des plans faits pour un volume disparu.
- **⚠️ `VACUUM FULL` prend un verrou exclusif** : la table est inutilisable
  pendant la réécriture, et il lui faut autant d'espace libre que la table
  qu'il refait. Sur des tables devenues minuscules c'est instantané ; sur un
  vrai gros inventaire en production, **c'est une opération à programmer, pas à
  lancer un matin d'inventaire**.
- **La conséquence pour la facturation** : le coût de stockage suit le
  **point haut**, pas l'usage courant. Un client qui fait un énorme inventaire
  une fois relève le plancher pour de bon, à moins d'un `VACUUM FULL`
  programmé.

### ⚠️ Ce que ça ouvre côté commercial — DIRECTION, PAS DÉCISION

Julien, à la lecture de ce qui précède : *« on va certainement prendre ces
deux cas pour mettre des critères de subscription. Faire payer les plus gros
consommateurs, un peu comme avec l'IA et le token, crédit. »*

**« Certainement » : c'est une direction.** Rien n'est arrêté, rien n'est à
construire. Ce qui suit sert le jour où le sujet est relancé — et surtout,
quatre pièges déjà payés par le projet.

- **⚠️ LA BASE DE FACTURATION NE CHANGE PAS.** Le 30 août 2026 a tranché : on
  facture **les appareils qui comptent**, et le volume de stock a été
  explicitement écarté comme assiette. Ce qui se discute ici est un
  **plafond**, un dépassement — pas un retour au volume comme base. Confondre
  les deux, c'est défaire une décision documentée.
- **⚠️ LE PLAFOND DOIT ÊTRE SOUPLE.** Règle déjà posée pour l'offre Solo : un
  dépassement ne bloque **jamais** un comptage en cours ni la lecture d'un
  rapport. Au pire, il refuse la **création d'un nouvel inventaire**, et il
  prévient. On ne coupe pas un magasin un soir de comptage.
- **⚠️ LA MESURE NE DOIT PAS SE DÉCOUPER.** Constat de Julien du 27 août : un
  client contournerait un plafond par fichier en scindant son stock en cinq
  petits inventaires. D'où la mesure retenue à l'époque — **les pièces
  comptées, agrégées sur 30 jours glissants**. La même prudence vaut pour
  toute nouvelle mesure.
- **⚠️ LA PLACE EST LA SEULE MESURE QUI COÛTE VRAIMENT, ET ELLE NE REDESCEND
  PAS TOUTE SEULE.** C'est l'apport du jour : ~680 Mo par inventaire de
  400 000 références, jamais purgés, et un disque qui ne se rétracte qu'à la
  main. Si un critère de stockage entre dans la grille, il doit venir **avec**
  une politique d'archivage — sinon on facture une place qu'on ne sait pas
  reprendre.

Les deux faits chiffrés à reprendre le jour venu : **680 Mo par inventaire de
400 000 références**, et **le plafond de 8 s atteint à 13 personnes
simultanées sur un inventaire de cette taille** (contre une centaine sur un
inventaire normal). Ce sont eux qui décrivent « un gros consommateur ».

## Ce qui n'est TOUJOURS pas prouvé

Dit explicitement, parce qu'une absence de constat ne vaut que si on sait ce
qui n'a pas été regardé.

- **⚠️ Le banc mesure la BASE, pas la chaîne complète.** PostgREST et son pool
  de connexions, le réseau, le canal temps réel : rien de tout cela n'est dans
  ces chiffres. La base est le terme dominant, ce n'est pas le seul.
- **L'import d'un fichier de 400 000 lignes** depuis le navigateur.
- **Le trafic sortant** : chaque téléphone télécharge le catalogue entier.
- Le jeu d'essai portait **8 compteurs distincts**, pas 100 — la concurrence
  est prouvée, la diversité des comptes ne l'est pas.

## Les inventaires de démonstration (supprimés le 4 septembre 2026)

« DEMO 400 000 references » et son jumeau sur La Samaritaine ont servi à tout
ce qui précède, puis ont été supprimés à la demande de Julien. Deux choses à
retenir d'eux.

⚠️ **Un jeu d'essai se pose sur le compte de qui va le regarder.** Le premier
avait été créé sur le compte de démonstration : invisible depuis le compte de
Julien, qui a cherché son inventaire dans une liste qui ne pouvait pas le
contenir.

⚠️ **ET SUPPRIMER NE REND PAS LA PLACE** — voir la section suivante, c'est le
constat le plus utile de la journée.

# Le rapport consolidé d'un magasin (4 septembre 2026)

*« Commence d'abord par le rapport par magasin, qui sera également consultable
par l'admin entreprise en plus de admin Quantinvo. »* Un grand magasin ouvre un
inventaire par étage, par réserve, par corner : jusqu'ici personne ne pouvait
dire ce que le magasin, **entier**, avait donné. Maquette validée avant codage :
https://claude.ai/code/artifact/271da757-20b0-4728-b83f-610a265ae127

Migration `20260904180001` (plus `…180002`, qui donne à la liste l'identité du
magasin), écran `/magasins/<id>/rapport`, atteint depuis la fiche du magasin et
depuis la fiche entreprise de la console.

## Les quatre décisions, et elles ne se devinent pas dans le code

- **⚠️ QUI Y A ACCÈS : l'administrateur d'entreprise et l'administrateur
  Quantinvo, personne d'autre.** Julien : « le superviseur d'un secteur n'a pas
  besoin de voir le rapport de son collègue d'un autre secteur du magasin ». Il
  garde le rapport de SES inventaires, par l'onglet Rapport de chacun. La garde
  vit en un seul point — `peut_lire_rapport_magasin`, révoquée à `anon` **et à
  `authenticated`** : les quatre fonctions qui l'appellent sont SECURITY
  DEFINER, elles n'ont pas besoin de ce droit. Une garde recopiée quatre fois,
  c'est VR-006 qui recommence.
- **⚠️ SEULS LES INVENTAIRES CLÔTURÉS S'ADDITIONNENT, et c'est le SERVEUR qui
  le décide**, pas la case cochée. Un inventaire en cours ferait bouger le
  rapport d'heure en heure. Il est **listé** — le cacher ferait croire à un
  magasin qui ne compte plus — mais pas cochable, et un identifiant d'inventaire
  ouvert passé quand même est simplement absent du résultat.
- **⚠️ LES QUANTITÉS S'ADDITIONNENT, et le rapport le SIGNALE.** Arbitré par
  Julien. D'où `doublons` dans le résumé, un bandeau qui le dit, la colonne
  « Inventaires » du tableau, et un filtre « Ne voir que celles-ci ». Une
  référence vue deux fois n'est pas une anomalie dans un magasin qui compte
  étage par étage ; on ne laisse pas le lecteur le découvrir.
- **⚠️ LE PÉRIMÈTRE EST UNE LISTE D'INVENTAIRES, jamais une plage de dates
  posée en base.** Les deux dates (90 jours par défaut) ne font que *proposer*
  une sélection ; ce qui part au serveur est ce qui est coché. Sans cela, deux
  écrans ouverts sur la même période ne montreraient pas la même chose dès
  qu'un inventaire est clôturé entre-temps.

## Ce qui porte le calcul

- **⚠️ LA VALEUR SE CALCULE INVENTAIRE PAR INVENTAIRE, PUIS S'ADDITIONNE.**
  `articles.unit_purchase_price` est porté **par inventaire** : le même SKU peut
  valoir 41 € en septembre et 38 € en août. Un prix moyen serait une invention —
  d'où l'absence de colonne « Prix achat unitaire » dans l'export, et l'absence
  de colonne « Statut » (un statut d'audit appartient à un inventaire, pas à un
  magasin). La valeur, elle, reste juste, et c'est exactement ce que le client
  retrouve en additionnant ses rapports.
- **Les quatre tuiles se décomposent** (Σ compté×prix − Σ théo×prix, par
  inventaire) : pas d'univers de SKU à fabriquer. Seuls le nombre de références
  et le nombre de doublons demandent de rassembler l'univers — une passe, une
  agrégation.
- **⚠️ Le filtre d'inventaire se pose AVANT le `full join`**, jamais dans le
  `on` : c'est le piège du matin même (800 156 lignes au lieu de 400 000). Les
  deux côtés sont filtrés par leur jointure sur `sess`.
- **Le périmètre reste fixé par le serveur** : `store_id = p_store_id`, liste
  bornée à **200** inventaires, page bornée à **5 000** lignes, ordre **total**
  (le SKU départage). La fiche d'un article (libellé, marque, code-barres) n'est
  cherchée que pour les 50 lignes affichées, et c'est la plus récente : un
  référentiel réimporté a pu changer le libellé entre deux inventaires.
- **⚠️ `p_sessions` est une liste choisie par le client** — le motif que VR-007
  a fermé — mais en lecture, et chaque identifiant est confronté au magasin
  visé, lui-même confronté à l'entreprise de l'appelant. Ne jamais l'élargir à
  un filtre libre.

## L'export

Deux feuilles, comme le rapport d'un inventaire : **« Consolidé »** (une ligne
par référence, tous inventaires additionnés, plus le nombre d'inventaires) et
**« Par inventaire »** (la même chose ligne par ligne, avec l'inventaire
d'origine). La seconde est la contrepartie de l'addition : sans elle, un écart
de 12 pièces sur une référence vue dans trois inventaires ne se rattache à aucun
rayon. Le fichier contient **tout** le périmètre, demandé par tranches de 5 000.

**⚠️ La feuille « Par inventaire » porte la DATE DE CLÔTURE** (Julien, le jour
même : « par inventaire dans le rapport il faut ajouter la date »). Quand une
référence revient dans trois lignes, c'est elle qui dit laquelle est la plus
récente — le numéro (`INV-AAAAMMJJ-XXXX`) ne le dit qu'à qui connaît la
nomenclature. Elle est **formatée en base, en Europe/Paris** : un horodatage
brut arriverait en UTC dans le tableur et daterait du 12 août un inventaire
clôturé le 13 à une heure du matin. Migration `20260904190001`, en `drop` puis
`create` — on ne change pas une liste de colonnes de retour par un
`create or replace`.

`forceTextColumns` est sortie de `downloadXlsx` (`forcerEnTexte`) : les deux
exports ont les mêmes colonnes de codes, et deux copies de cette boucle
divergeraient au premier ajout de colonne.

## Vérifications

- **En base, en transactions annulées, sur les fonctions réellement
  appliquées** : le résumé d'un magasin à un inventaire est **identique au
  centime** à `rapport_resume` de ce même inventaire ; sur trois inventaires,
  les six chiffres correspondent à un recalcul indépendant ; une référence
  injectée dans deux inventaires ressort à **9 unités théoriques** (4 + 5) et
  **−75 €** (−4×10 puis −5×7 — la preuve que le prix reste celui de chaque
  inventaire), `doublons` passe à 1 et le filtre « multi » ne rend qu'elle.
- **La matrice d'accès** : admin d'entreprise et admin Quantinvo passent ;
  superviseur, compteur, admin d'une autre entreprise et `anon` sont refusés ;
  la garde interne est injoignable même pour `authenticated`. Un inventaire en
  cours et un inventaire d'un autre magasin passés dans la liste sont **ignorés**
  (1 retenu au lieu de 2).
- **Zéro résidu contrôlé** : 29 553 articles, 165 comptages, 62 audits,
  156 lignes de stock, 1 inventaire clôturé — identiques à avant.
- **Les gardes mordent** : cinq sabotages (statut clôturé retiré, borne des 200
  retirée, garde de l'écran ouverte à tous, garde interne accordée à
  `authenticated`, une des deux paginations supprimée) font échouer exactement
  les cinq tests correspondants.
- **Au navigateur**, par route jetable (retirée, `git status` contrôlé), **clair
  et sombre**, à 1280 px et à 820 px : le périmètre, la liste cochable, les
  quatre tuiles, le bandeau et son filtre, le tableau. **Débordement horizontal
  nul** aux deux largeurs. Un défaut trouvé ainsi : les deux champs de date
  étaient sur `--surface-2`, qui vaut `#fff` en clair — donc sans fond sur un
  panneau blanc. Même défaut que `.magasin-top input` le 22 août 2026.
- 961 tests du site, `tsc --noEmit`, `eslint .` à **zéro erreur**, `next build`
  avec la table de routes inchangée plus `/magasins/[storeId]/rapport`.

**Non vu à l'écran** : la page complète demande une session d'administrateur
d'entreprise ou de Quantinvo, que je n'ai pas. Ce qui est prouvé, c'est que les
quatre chemins serveur répondent juste et aux bonnes personnes, et que le rendu
tient dans les deux thèmes.

**Ce qui n'est pas mesuré** : le rapport d'un magasin portant plusieurs
inventaires de 400 000 références. La consolidation demande l'univers des SKU —
elle ne se décompose pas — et le plafond reste 8 s. Les jeux de démonstration
ayant été supprimés, ce chiffre-là attend un vrai gros client ; l'écran dit
alors « le serveur a mis trop de temps » et invite à réduire le périmètre,
plutôt que d'afficher un zéro.

Tests de garde : `web/tests/rapport-magasin.test.ts`.

# L'onboarding est clos (4 septembre 2026)

*« Fais-moi le reste de l'onboarding, je veux que l'on clôture ce sujet
aujourd'hui. »* La maquette du 23 août
(https://claude.ai/code/artifact/e54ce742-3f4c-4788-839e-d118f82c2e02) décrit
vingt écrans, sur trois profils. Audit écran par écran, code en main : **tout
est construit**, sauf deux points écartés avec leurs raisons — et deux qui
manquaient réellement, faits ce jour.

## ⚠️ D'ABORD, UNE ERREUR DE MA PART, ET ELLE PORTE UNE RÈGLE

J'ai annoncé à Julien qu'il restait « l'état des invitations dans l'équipe d'un
inventaire » et « la checklist de l'administrateur d'entreprise ». **Les deux
étaient réglés depuis le 28 août** : le premier écarté (il n'existe plus
d'invitation en attente à un inventaire), le second construit (`etapesAdmin`
dans `BandeauDemarrage`). J'avais relu la liste « Ce qui reste de la maquette
du 23 août », écrite le MATIN du 28, sans voir que la section de l'APRÈS-MIDI
la vidait.

**Une liste de « reste à faire » qui vit dans un fichier daté doit être barrée
quand elle est faite.** Celle-là porte désormais son avertissement.

## Les deux pièces qui manquaient vraiment

- **La progression du superviseur ne portait que des pourcentages.** La
  maquette dit : l'avancement se compte en **balises** — c'est ce qui dit où en
  est le magasin — « et le nombre de pièces l'accompagne sans le remplacer ».
  Il manquait : « 60 % » ne dit pas si les rayons faits portaient dix articles
  ou trois mille, et c'est la première question qu'on se pose en le lisant. Une
  ligne de plus (« 243 pièces comptées · 81 auditées »), avec des nombres
  **déjà chargés** pour l'autre mode d'affichage.
- **L'écran d'import ne disait pas que le site fait la même chose.** Un
  référentiel sort d'un ERP : il est sur un poste, pas sur le téléphone. Sans
  cette ligne, on transfère un fichier vers le téléphone pour rien.
  · **⚠️ ELLE N'EST PAS CLIQUABLE, ET C'EST VOULU.** La maquette dessinait une
    pastille-lien ; l'espace connecté du site **se ferme sous 720 px**. Ouvert
    depuis ce téléphone, le lien tomberait sur « Cet espace se pilote depuis un
    ordinateur » — un cul-de-sac. L'adresse est écrite pour être **retapée sur
    le poste**, pas touchée ici. Un test refuse `Linking` dans cet écran.

## Les deux écartés, et pourquoi

- **L'état des invitations d'un inventaire (relance, QR).** Il n'y a plus
  d'invitation en attente à un inventaire depuis que `invite-to-session` refuse
  les adresses sans compte : la table est vide en production. Le vrai risque
  que la maquette visait — « la veille, la moitié de l'équipe n'est jamais
  entrée » — est couvert par le badge « Mot de passe à créer ». Déjà documenté
  le 28 août ; rien n'a changé.
- **Les appareils connectés sur l'écran du superviseur** (« 3 connectés · 2 en
  comptage · 1 en audit »). Le contrat de présence **v3** du 21 août a retiré
  aux téléphones l'abonnement au canal temps réel : ils émettent un battement
  HTTP, **seul le tableau de bord écoute**. L'afficher dans l'app rouvrirait
  une connexion par téléphone de superviseur, pour une information que le site
  donne déjà et que la progression rend visible autrement. La phrase de la
  maquette est d'ailleurs d'abord une **interdiction** — « des appareils,
  jamais des noms » —, et elle tient : le suivi nominatif a été retiré en août
  (constat E3).

## La garde qui ferme le sujet

⚠️ **Chaque repère déclaré dans `lib/reperes.ts` doit être branché sur un
écran.** C'est arrivé de ne pas l'être : `balayage` a vécu huit jours déclaré
et affiché nulle part. Le test balaie `src/` et exige un `useRepere('<nom>'`
pour chacun des treize — un repère qui n'existe qu'en déclaration est une aide
qui n'existe pas.

## Vérifications

Au simulateur, sur les données réelles du compte de démonstration (Maison
Oberlin, inventaire « Rayon textile »), **clair et sombre** : la progression
affiche « 26 % des balises comptées · 9 % des balises auditées · 243 pièces
comptées · 81 auditées », et l'écran d'import porte sa ligne vers le site.
Aucune écriture — consulter n'écrit rien, contrôlé par la règle du 25 août.
410 tests, `tsc --noEmit`. Les quatre gardes nouvelles ont été mises en défaut
une à une (repère débranché, ligne des pièces retirée, `Linking` ajouté, rôle
de bienvenue renommé) : les quatre échouent.


# Une porte s'ouvre des deux côtés (4 septembre 2026)

Constat de Julien, **depuis un compte d'administrateur d'entreprise** :
« onboarding, voir mes magasins > page magasin, pas de bouton retour ; crée-toi
un automatisme pour vérifier ce genre de détail ».

C'est le piège déjà nommé ici le 23 août — *ce qu'un écran ouvre doit être dans
sa pile*. Un écran du groupe `(compte)` ouvert depuis un autre groupe de routes
devient le **premier** de sa pile : la flèche native ne s'affiche pas, et on
reste coincé dessus. `RetourVersApp` existe pour ça depuis ce jour-là.

**Sauf que Magasins avait été oublié.** Le commentaire du layout ne nommait que
« Mon équipe et Boîte à outils », les deux écrans du jour ; personne n'a repris
la liste quand le bandeau de l'administrateur d'entreprise s'est mis à mener
vers Magasins (`(supervisor)/index.tsx`, étapes `magasins` et `superviseurs`)
et quand sa porte de bienvenue a gagné « Voir mes magasins »
(`PorteBienvenue.tsx`).

## ⚠️ L'AUTOMATISME : LA GARDE DÉDUIT LA LISTE, ELLE NE LA CITE PAS

C'est tout l'objet de la demande, et c'est la leçon générale. Une garde qui
**nomme** les écrans à protéger ne protège que ceux qu'on connaissait le jour
où on l'a écrite — elle passe à côté du suivant, en silence. Celle-ci balaie
`src/`, retient tout `(compte)/<écran>` cité **hors du groupe**, et exige un
`headerLeft` pour chacun dans `(compte)/_layout.tsx`. La prochaine porte se
signalera d'elle-même, le jour où quelqu'un l'ouvrira.

Deux détails d'écriture qui comptent :

- elle **découpe le layout sur `<Stack.Screen`** au lieu de chercher une
  expression qui court jusqu'au premier `/>` : les options tiennent parfois sur
  plusieurs lignes et contiennent elles-mêmes des balises auto-fermantes
  (`<RetourVersApp />`). Un découpage ne peut pas se tromper de fin ;
- elle échoue si **aucune** porte n'est trouvée : une détection cassée rendrait
  la garde silencieuse, ce qui est pire que pas de garde.

⚠️ **`RetourVersApp` ne se rend que si `router.canGoBack()` est faux.** C'est ce
qui permet de la poser sans discernement sur toutes les portes : arrivé par le
chemin normal (Mon compte → Magasins), la flèche native existe et le bouton
s'efface — pas de double retour. Un test fige cette condition.

Vérifié au simulateur : Mon compte → Magasins ne porte qu'**un seul** « Retour ».
Le cul-de-sac, lui, se reproduit depuis un compte d'administrateur d'entreprise
— que je n'ai pas ; c'est Julien qui l'a vu, et la garde le tient désormais.

Tests de garde : `tests/compte.test.ts`, bloc « une porte s'ouvre des deux
côtés ».

# Les six Price Stripe, contrôlés un par un (4 septembre 2026)

Julien a recréé les six Price aux tarifs du 31 août et posé les six secrets.
Contrôle de bout en bout : six sessions Checkout ouvertes par la fonction
déployée (une par couple offre × rythme), et **le montant lu sur chaque page
de paiement** —

| | mensuel | annuel |
|---|---|---|
| Essential | 89,00 € | 950,00 € |
| Advanced | 310,00 € | 3 300,00 € |
| Enterprise | 890,00 € | 9 450,00 € |

⚠️ **C'est le montant affiché qui fait foi, pas le fait que la session s'ouvre.**
Une inversion mensuel/annuel ouvre une page tout aussi valide et facturerait
9 450 € par mois. C'est le contrôle du 30 août, refait à l'identique.

Deux constats au passage :

- **le compte est toujours en mode TEST** (`cs_test_…`, « Environnement de test
  Devkaylab ») : rien n'est encaissé pour de vrai tant que les clés `live` ne
  sont pas posées ;
- **aucune ligne de TVA sur les pages**, donc `STRIPE_TAX_RATE` n'est pas posé.
  Toléré en test, **refusé en live** par la fonction elle-même (`tva_absente`,
  503) — voir « La TVA : un taux fixe, et un garde-fou contre l'oubli ».

Données d'essai supprimées, **zéro résidu contrôlé** : 0 demande, 2 entreprises,
2 magasins — inchangés.

# La franchise en base de TVA (4 septembre 2026)

*« Je suis en exonération de TVA, ça change quelque chose ? »* Oui, trois
choses — et la première aurait bloqué la vente le jour du passage en live.

## ⚠️ UN SEUL INTERRUPTEUR, `TVA_APPLICABLE`

Il vit dans `web/lib/offres.ts`, avec son jumeau dans `subscribe-online`
(doublon volontaire, comme la grille : le site et les fonctions edge ne
compilent pas ensemble, un test compare les deux). Il commande **tout** :

1. **Le refus de vendre en live sans `STRIPE_TAX_RATE`.** Ce garde-fou avait
   été écrit en supposant que la TVA s'applique toujours ; en franchise, il
   aurait exigé un taux qui n'a pas lieu d'exister et répondu « indisponible »
   à chaque souscription. Il est conditionné, et le taux est **ignoré même s'il
   traîne dans les secrets** — un taux posé par erreur facturerait une taxe que
   l'éditeur ne collecte pas.
2. **Ce que les écrans affichent.** En franchise il n'y a ni HT ni TTC : le
   prix affiché EST le prix payé. Annoncer « 310 € HT » puis « 372 € TTC »,
   c'est le symétrique exact du défaut que la TVA corrigeait le 30 août — un
   montant affiché qui n'est pas celui du relevé bancaire.
3. **La mention portée par les devis et les factures.** L'article 293 B du CGI
   impose ces mots-là. ⚠️ L'ancienne phrase — « TVA non applicable sur ce
   document, le montant hors taxes fait foi » — n'était pas la mention légale
   et **annonçait même l'inverse** : que la facture, elle, l'ajouterait.

Le jour où le seuil de la franchise est dépassé, on passe la constante à `true`
et rien d'autre ne bouge. ⚠️ **La formulation de la mention et le seuil ne sont
pas au code d'en décider** : c'est le comptable, et le commentaire le dit.

## ⚠️ LA GARDE BALAIE, ELLE NE CITE PAS — et c'est ce qui a payé

J'avais corrigé trois fichiers à la main. Le test qui balaie `web/app` et
`web/components` en a trouvé **six autres** : la grille de la page publique,
la page de devis que le client lit, l'estimation de `/inscription`, les deux
panneaux de devis de la console, et le balisage schema.org — qui annonçait
`valueAddedTaxIncluded: false` à des machines.

C'est la même leçon que le bouton retour, le même jour : **une garde qui nomme
les écrans à protéger ne protège que ceux qu'on connaissait en l'écrivant.**
Elle lit le code sans ses commentaires (ils citent forcément les mots qu'ils
décrivent) et regarde la ligne **et ses deux voisines** — la condition vit
souvent au-dessus, sur la première branche d'un ternaire.

## Ce qui a suivi

- **CGV** (article 6.1, annexe 2, identité de l'éditeur) et **modèle de devis à
  la main** alignés sur la même mention ; la ligne « TVA 20 % » du modèle est
  retirée, avec le commentaire qui dit quand la remettre.
- **Six fonctions edge redéployées** — celles qui embarquent `_shared/devis.ts`
  (`quote-pdf`, `accept-quote`, `decline-quote`, `admin-send-quote`,
  `ca-request-store`) plus `subscribe-online`. ⚠️ `verify_jwt` **relevé sur la
  base avant de déployer**, pas déduit de cette note : faux pour les quatre
  publiques, vrai pour les deux autres. Recontrôlé après : rien n'a bougé.
- **Trois tests amendés, aucun affaibli** : deux portaient sur une ligne
  d'import mot pour mot (elles ont gagné `TVA_APPLICABLE`) — elles vérifient
  désormais ce qui est importé ; le troisième exigeait le mot « TTC » sur le
  bouton de paiement. Ce qu'il défend n'a pas changé — *le bouton porte le
  montant réellement prélevé* — et c'est justement pour ça qu'il ne peut plus
  exiger « TTC ».

## Vérifications

- **Au navigateur** : `/tarifs` (« Prix par magasin. TVA non applicable,
  article 293 B du CGI. »), `/souscrire` (« 310 € · par mois, pour un
  magasin », la mention, et le bouton « Payer 310 € et créer mon espace ») et
  `/devis/<jeton>` (« Total mensuel 310,00 € », la mention sous le total).
- **Le PDF est réellement dessiné avec la mention** : `elementsDevis` est
  testable sans PDF (c'est pour ça que le module est séparé), et un test
  vérifie que le texte figure parmi les éléments — pas seulement qu'il est
  déclaré. Plus un appel réel à `quote-pdf` déployée : 200,
  `application/pdf`, `%PDF-1.7`.
- **Les gardes mordent** : interrupteurs divergents, mention redevenue
  descriptive, « HT » remis en dur dans la grille publique, « TTC » remis sur
  le bouton — quatre sabotages, quatre échecs.
- 969 tests du site, 416 de l'application, `tsc --noEmit` des deux côtés,
  `eslint .` à zéro erreur, `next build` avec la table de routes inchangée.
- Données d'essai supprimées, **zéro résidu contrôlé** : 0 demande,
  2 entreprises, 2 magasins.

**Non vérifié** : un encaissement réel en franchise, qui demande les clés
`live` — elles attendent l'immatriculation de la société.

# Le décompte d'appareils, et le verrou (4 septembre 2026)

*« Fais le décompte d'appareils. »* La page de tarifs promet « deux appareils à
la fois » depuis le 30 août, l'assiette de la licence est ce nombre-là depuis le
2 septembre — et **rien ne le mesurait ni ne l'appliquait**. Une entreprise
Essential pouvait faire compter cinquante téléphones sans que personne ne le
sache, ni elle, ni nous. Maquette validée avant codage :
https://claude.ai/code/artifact/f3b2baf3-564a-4da0-bf5f-d4cb879ca53d

Migration `20260904210001`, module `src/lib/appareil.ts`, module de jugement
`web/lib/appareils.ts`, section « Appareils » sur la fiche d'un magasin.

## ⚠️ LA RÈGLE : RIEN DE PLUS SANS PAIEMENT

Arbitrée par Julien le 4 septembre 2026, en ces termes : **« on n'accepte ni
magasin, ni appareil supplémentaires sans paiement »**. Le plafond n'est donc
pas indicatif — le troisième appareil d'un forfait Essential **ne peut pas
ouvrir son écran de comptage**.

**Cette note remplace le « plafond souple » posé le 27 août pour l'offre Solo.**
Elle ne vaut que pour les appareils et les magasins : un plafond de *volume
compté*, s'il revient un jour, reste une autre question.

## ⚠️ LES TROIS BORNES DU VERROU

Ce ne sont pas des adoucissements, ce sont les conditions pour qu'il ne casse
pas un inventaire. Ne pas les défaire sans que Julien rouvre le sujet.

1. **Un appareil qui compte n'est JAMAIS éjecté.** Le verrou refuse une entrée,
   il n'interrompt pas un travail. En base, le chemin « il est déjà là » passe
   **avant** tout comptage : un plafond abaissé entre-temps ne renvoie personne
   de son rayon.
2. **Hors ligne, on laisse compter.** Un téléphone sans réseau ne peut ni
   réserver ni se voir refuser. La borne vit côté application, sous une forme
   plus large : **on n'échoue jamais du côté fermé** — réseau coupé, serveur
   muet, code inconnu, tout accorde. Le seul refus qui ferme la porte est un
   `forfait_plein` explicitement prononcé par le serveur.
3. **Sans plafond connu, aucun refus.** Les magasins créés avant le 2 septembre
   n'ont pas d'assiette (`stores.devices` nul) — **les deux magasins
   d'aujourd'hui sont dans ce cas**, donc rien ne mord encore. Un plafond
   inventé fermerait la porte à tort.

## ⚠️ LE SIGNAL COMMERCIAL N'EST PAS LE PIC, C'EST LE REFUS

Conséquence directe du verrou, et elle renverse ce qu'on aurait écrit
spontanément : **le pic ne peut plus dépasser le plafond, par construction**.
« Sept appareils ont compté sur un forfait de deux » n'arrivera plus jamais.

Ce qui dit qu'une offre plus large est devenue nécessaire, c'est donc le nombre
d'appareils **éconduits**, et `besoin` (`pic + refus` du jour le plus chargé),
qui estime ce qu'il aurait fallu.

- **⚠️ Le refus se compte UNE FOIS PAR APPAREIL, jamais par tentative.** Un
  téléphone éconduit redemande sa place toutes les trente secondes ; sans la
  colonne `appareils_actifs.refuse`, « douze refus » voudrait dire « une
  personne a patienté six minutes ». Ce chiffre décide d'une montée d'offre : il
  doit compter des appareils.
- **⚠️ `besoin` MAJORE, et l'écran ne l'affirme pas.** Deux appareils refusés à
  deux heures d'écart s'y additionnent alors qu'ils n'étaient pas simultanés.
  D'où « il vous en aurait fallu **au moins** N » — un test garde la formule.
- Un appareil refusé **ne tient aucune place** : les deux comptages du plafond
  excluent `refuse`.

## ⚠️ LE VOCABULAIRE DE L'ÉCRAN — deux mots interdits

Constat de Julien le 4 septembre 2026, sur le premier jet : *« tu n'utilises
pas des mots adaptés au contexte, "sans assiette" n'est pas clair […] pareil
pour "votre pic de", un pic signifie que ça va redescendre après, donc pas
d'intérêt de passer à la tranche supérieure ».*

- **« Assiette » ne s'écrit jamais à l'écran.** C'est notre mot de
  facturation, il vient du droit fiscal ; le client lit **« forfait »**. Le
  terme reste dans le code et dans ces notes, jamais dans une phrase qu'il voit.
- **« Pic » non plus, et l'argument dépasse le vocabulaire.** Un pic redescend :
  affiché à un client, il l'invite à conclure qu'il n'a rien à changer. Ce qui
  appelle une décision, c'est qu'un appareil ait été **refusé**. La fiche du
  magasin n'affiche donc pas le pic — il reste dans ce que rend la base, pour
  notre propre usage.
- **⚠️ Et c'est « JUSQU'À », jamais « AU MOINS ».** `besoin` majore : le vrai
  besoin est **au plus** ce chiffre. Le premier jet écrivait « il en aurait
  fallu au moins 7 », c'est-à-dire l'inverse de la vérité. Un test fige la
  formule et interdit l'autre.

Les trois tuiles mènent chacune à un geste : *En train de compter*,
*Refusés · 30 derniers jours*, *Votre forfait*.

## ⚠️ LE PLAFOND EST LE HAUT DU PALIER, PAS LE NOMBRE DEVISÉ

La grille vend des paliers : Advanced, c'est « 3 à 20 appareils » pour 310 €. Un
client devisé sur 7 appareils paie Advanced et a donc droit à **20** — lui en
refuser un huitième lui vendrait moins que ce que la page publique lui promet.
`plafond_appareils` arrondit donc au haut du palier, et prolonge Enterprise par
tranches de dix **entamées**, exactement comme `prixCents` les facture.

Trois sources, dans cet ordre : `stores.devices` (l'assiette devisée), puis le
palier de `companies.plan` — **une souscription en ligne n'écrit PAS `devices`**,
vérifié le 4 septembre, sans ce repli un client Advanced n'aurait aucun plafond
—, puis rien.

⚠️ Les trois nombres (2, 20, 100) et la tranche de dix sont **la copie** de
`OFFRES[].max` et `SUPPLEMENT.par` de `web/lib/offres.ts` : le site et la base
ne compilent pas ensemble. Même duplication assumée que la grille de
`_shared/devis.ts`, même remède — un test compare les deux.

## ⚠️ L'OFFRE PROPOSÉE COUVRE LE BESOIN, ELLE NE MONTE PAS D'UN CRAN

Arbitré par Julien : un magasin Essential dont le besoin monte à 40 se voit
proposer **Enterprise**, pas Advanced. Lui proposer le rang suivant le
laisserait au-dessus de son forfait dès le lendemain, et il faudrait le
rappeler une semaine plus tard. `proposer()` (`web/lib/appareils.ts`) le fait ;
le prix vient de `prixCents`, jamais d'une addition faite sur place.

**⚠️ Et le bouton dit l'ACTION, jamais le montant** (Julien, le même jour).
« Passer à Advanced », « Passer à 120 appareils » quand le palier ne change pas
de nom, « Créer le magasin » pour un magasin de plus. Jamais « Ajouter 20
appareils » — un bouton qui change de verbe selon le palier laisse croire qu'il
fait autre chose — et jamais « Payer 124 € et créer le magasin » : le prix et le
prorata sont écrits juste au-dessus, les répéter alourdit et fait douter de ce
que le bouton déclenche. Un test vérifie le préfixe « Passer à » sur cinq cas.

## L'identifiant, sur le téléphone

- **⚠️ Il vit dans le trousseau, et il DOIT y vivre.** `oublierCachesLocaux`
  balaie `AsyncStorage` à chaque `signOut` : rangé là, l'identifiant changerait
  à chaque relève d'équipe, et un téléphone partagé entre le matin et
  l'après-midi compterait pour **deux** appareils. Or c'est exactement
  l'argument de vente — « comptes illimités, deux appareils à la fois ».
- **⚠️ Il n'est relié à AUCUN compte**, et `appareils_actifs` n'a délibérément
  pas de colonne d'utilisateur. On compte des appareils, jamais des personnes
  (constat E3, 19 août 2026). Ce qui reste nominatif, et doit le rester, c'est
  `counts.counted_by`.
- **⚠️ La promesse est mise en cache, pas seulement la valeur.** Deux appels
  concurrents tireraient sinon deux identifiants, et un seul téléphone
  consommerait deux places.
- Conséquence assumée : réinstaller l'application peut changer l'identifiant
  (le Keystore d'Android est effacé à la désinstallation, le trousseau d'iOS
  non). L'ancienne place se libère seule en quatre-vingt-dix secondes.

## La cadence, et pourquoi c'est celle de la présence

**30 secondes entre deux signalements, 90 secondes de fenêtre côté serveur** —
c'est-à-dire `BEAT_MS` et `STALE_MS` de `lib/presence.ts`, à l'identique. Ce
n'est pas une coïncidence : si le verrou retenait une place plus longtemps que
le tableau de bord ne montre l'appareil, l'écran du superviseur dirait « un
appareil » pendant que le verrou en compterait deux. **Un seul silence, une
seule conclusion.**

La place est en outre **rendue au démontage** (`rendre_place_appareil`), sans
attendre l'expiration : sur un forfait plein, un collègue qui prend le relais
attendrait sinon une minute et demie pour rien.

- **⚠️ `usePlaceAppareil` ne se monte QUE sur l'écran qui compte** (`scanner.tsx`).
  L'assiette est « les appareils qui comptent en même temps » : un téléphone
  posé sur l'écran d'un inventaire ne compte pas, et lui faire prendre une place
  priverait un collègue de la sienne. Un test refuse le hook ailleurs.
- Le verrou sérialise les demandes concurrentes par un `for update` sur la ligne
  du magasin — sans lui, deux téléphones obtiennent la même dernière place. Le
  motif exact de VR-001, sur un autre objet.

## L'écran de refus ne cite aucun prix

Il s'ouvre devant un compteur, souvent un saisonnier, debout dans un rayon : une
proposition commerciale n'a rien à y faire, et il n'a de toute façon pas la
main. Il dit la seule chose vraie et utile — attendre suffit — et renvoie au
responsable, qui décide sur le site. Un test refuse « € », « Essential »,
« Advanced », « Enterprise » et « offre » dans ce bloc.

Symétriquement, **la section « Appareils » du site est réservée à
l'administrateur d'entreprise et à Quantinvo** : elle passe par
`peut_lire_rapport_magasin`, la même porte que le rapport consolidé. Ce n'est
pas une donnée d'inventaire, c'est l'état d'une licence.

## Vérifications

- **En base, en transactions annulées, sur les fonctions réellement
  appliquées** : le troisième appareil refusé sur un forfait de deux, l'appareil
  déjà présent qui garde sa place, la clé invalide, l'étranger à l'inventaire
  refusé, la place rendue puis reprise par le refusé, la lecture accordée à
  l'administrateur d'entreprise et **refusée à un compteur (42501)**, la RLS qui
  ferme les deux tables même à `authenticated`, et **sans plafond aucun refus**.
- **La dé-duplication des refus est prouvée** : un appareil refusé cinq fois et
  un second refusé une fois donnent `refus = 2`, pas 6.
- **Le dépôt et la base sont identiques** : les quatre corps de fonction, une
  fois commentaires et blancs normalisés, ont la **même empreinte MD5**.
- **Les gardes mordent** : cinq sabotages (borne 1 retirée, refus compté à
  chaque tentative, plafond ouvert à `authenticated`, un prix dans l'écran de
  refus, la place prise sur l'écran d'un inventaire) font échouer exactement les
  cinq tests correspondants.
- **Au navigateur**, par route jetable (retirée, `git status` contrôlé), clair
  et sombre, à 1280 px et 900 px : les quatre états, **débordement horizontal
  nul**.
- 1 001 tests du site, 416 de l'application, `tsc --noEmit` des deux côtés,
  `eslint .` à zéro erreur, `next build` avec la table de routes inchangée.
- **Zéro résidu contrôlé** : 0 ligne dans les deux tables, 165 comptages,
  2 magasins sans assiette — comme avant.

⚠️ **NON VÉRIFIÉ, ET IL FAUT LE SAVOIR : rien ne mesure encore.** L'identifiant
et la demande de place vivent sur le téléphone — **il faut un build**. D'ici là
les écrans afficheront zéro appareil et le verrou ne mordra pas, ce qui est
exact : aucun téléphone ne sait encore demander sa place. Et aucun magasin n'a
d'assiette, donc le verrou resterait muet même avec le build.

## ⚠️ CE QUI RESTE, ET QUI EST LE PLUS GROS : LE LIBRE-SERVICE

Julien, le même jour : *« nous avons une offre claire aujourd'hui, plus besoin
de passer par un devis pour quoi que ce soit. Donc il faut créer les produits
pour les magasins supplémentaires, appareils supplémentaires. »*

Le bouton « Passer à Advanced » de la fiche magasin mène aujourd'hui à
**`/tarifs`**, faute de mieux : il n'existe aucun changement d'offre en
libre-service, la souscription en ligne crée une entreprise et ne fait pas
monter un client existant. Ce qu'il faudra :

- **Deux Prices Stripe de plus**, aux montants du 31 août : appareils
  supplémentaires par tranche de dix, **64 € / mois** et **690 € / an**. Ils
  portent une **quantité**, pas un montant figé. ⚠️ Comme les six autres, ils se
  créent dans le tableau de bord et se posent en secrets — **jamais par le
  code**.
- **Un abonnement par entreprise, un article par magasin**, au lieu d'un
  abonnement par magasin. Ajouter un magasin ajoute un article, changer d'offre
  échange le Price de son article, ajouter des appareils change une quantité —
  et Stripe calcule le prorata à chaque fois. Une seule facture pour le client.
  · **Effet de bord bienvenu** : la limite notée le matin même — « un magasin
    ajouté en mensuel crée un second abonnement que rien ne suit » — **disparaît**.
    Elle n'avait de sens que dans le modèle à un abonnement par magasin.
  · **⚠️ Un abonnement Stripe a UN SEUL RYTHME.** Une entreprise est donc
    mensuelle ou annuelle, pas les deux. C'est déjà ce que le produit suppose
    (`companies.billing_period`).
- **Le devis ne disparaît pas** : il reste la porte d'entrée d'une nouvelle
  entreprise par `/inscription`, et le seul endroit où un montant se négocie.
  Ce que le libre-service lui retire, ce sont les magasins supplémentaires et
  les changements d'offre d'un client déjà là — tout ce qui se tarife à la
  grille.

Tests de garde : `web/tests/decompte-appareils.test.ts`.
