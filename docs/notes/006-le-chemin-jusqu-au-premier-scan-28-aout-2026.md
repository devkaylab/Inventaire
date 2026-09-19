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
