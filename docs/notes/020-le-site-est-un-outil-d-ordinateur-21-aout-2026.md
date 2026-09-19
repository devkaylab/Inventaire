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
