# Une seule boîte : lire et écrire au même endroit (7 septembre 2026)

*« Je te demanderai juste de fusionner boîte de réception et boîte d'envoi sur
la même page et un seul logo dans la barre des menus, celle près de la
cloche. »* Puis, en commentaire sur la maquette : *« il faut placer l'icône
messages proche de la cloche »*. Maquette validée avant codage :
https://claude.ai/code/artifact/356fc1cd-7162-4c24-8583-39b1d349fcf5

## ⚠️ LE DOUBLON ÉTAIT EXACT, ET RIEN NE LE SIGNALAIT

L'onglet « Messages » du rail et le bouton « écrire à mon administrateur »
dessinaient **le même `<path d="M21 11.5a8.38…">`, au caractère près**. Deux
bulles identiques dans la même colonne, à quelques centimètres l'une de
l'autre : l'une ouvrait une page, l'autre une fenêtre. Rien ne disait laquelle
faisait quoi.

Ce n'est pas un défaut de dessin, c'est un défaut de **rangement** : écrire et
lire étaient à deux endroits, donc il fallait deux portes.

## Ce qui change

- **`MessageAdmin` n'existe plus.** Sa modale et son bouton de rail sont
  supprimés ; son corps d'envoi vit désormais dans `app/messages/page.tsx`.
- **« Messages » quitte les onglets du milieu**, pour les trois rôles. Ces
  onglets nomment des **lieux de travail** — un tableau de bord, des
  inventaires, une équipe. Le courrier est ce qui **arrive**, comme les
  notifications : il se lit en bas du rail. Effet de bord bienvenu : l'espace
  connecté passe de cinq onglets à quatre, et cinq était la limite avant que la
  barre ne passe sur deux rangs.
- **Un rang « Messages » dans `rail-fin`, AVANT la cloche.** Ce qui arrive se
  lit dans l'ordre : le courrier, les notifications, puis soi.
- **« Nouveau message » en tête de la liste des fils**, comme dans toute
  messagerie — et dans l'état vide, seul endroit où la liste n'existe pas.

## ⚠️ ÉCRIRE PREND LA PLACE DU FIL, PAS UNE FENÊTRE PAR-DESSUS

C'est ce qui rend la fusion vraie. Une modale flotte **au-dessus** de la page :
on serait toujours à deux endroits, avec un décor de plus. En occupant le
panneau de droite, le formulaire fait de l'écriture et de la lecture le même
endroit — et **la liste des conversations reste visible**, de quoi remarquer
qu'un fil sur le même sujet existe déjà. Le panneau n'a qu'un occupant :
ouvrir un fil ferme la rédaction.

## Ce qui ne bouge pas, et qu'il ne faut pas croire déplacé

- **La règle « chacun écrit un cran au-dessus »** : le superviseur à
  l'administrateur de son entreprise, l'administrateur d'entreprise à
  Quantinvo, et **l'administrateur Quantinvo n'ouvre aucun fil** — il répond.
  Elle a déménagé du rail vers la page, à la lettre.
- **Le destinataire se déduit du PROFIL par la fonction edge**, jamais d'un
  paramètre de l'écran. Un client qui pourrait nommer son destinataire
  écrirait à qui il veut.
- **Rien côté serveur** : même `message-admin`, même repli sur `ouvrir_fil`
  quand elle est injoignable (le message passe alors sans e-mail, plutôt que de
  ne pas passer du tout), mêmes bornes 120 / 2000 qui refusent. Aucune
  migration, aucune RPC nouvelle.
- **La cloche** : elle fait toujours l'union des notifications et des fils non
  lus, et « tout marquer lu » ne touche que les notifications — lire sa cloche
  n'est pas lire son courrier.

## Deux détails qui se sont corrigés en regardant

- **Le bouton d'en-tête dit toujours la même chose.** Une première version le
  faisait basculer en « Annuler » pendant la rédaction — alors que le
  formulaire en portait déjà un, à trente centimètres de là. Deux « Annuler »
  pour un seul geste, et un bouton d'en-tête qui change de sens selon l'état.
  L'annulation appartient à la rangée d'actions, là où on regarde en finissant
  d'écrire.
- **L'état vide ne renvoie plus vers le rail.** Il y disait « le bouton
  d'écriture est dans la barre de gauche » — devenu faux.

## ⚠️ TROIS PIÈGES DÉJÀ CONNUS, REPRIS EN PLEINE FIGURE

1. **`npx vitest run | grep -E "×|Tests "` a caché un fichier de test qui ne se
   chargeait plus.** `notifications.test.ts` lisait `MessageAdmin.tsx`,
   supprimé : le fichier échouait à l'import, et mon filtre n'affichait pas la
   ligne `FAIL`. Le compte annonçait « 1 300 passed » au lieu de 1 327, sans
   une erreur à l'écran. **Ne jamais filtrer la sortie d'un contrôle** — la
   règle du 4 septembre, prise en défaut sur un autre outil.
2. **Une garde d'absence se lit elle-même** — dixième fois. Le commentaire de
   l'état vide CITE « dans la barre de gauche » pour dire qu'on ne l'écrit
   plus. `notifications.test.ts` a désormais son dépouilleur `code()`.
3. **Un commentaire JSX ne peut pas être le premier enfant d'un `cond && (…)`**
   qui rend un seul élément — quatrième fois. Et le commentaire qui l'explique
   ne doit pas contenir la séquence qui ferme un commentaire, sans quoi il se
   referme au milieu de lui-même.

## ⚠️ LE BOUTON DE L'ÉTAT VIDE NE FAISAIT RIEN — et c'est une leçon de méthode

Constat de Julien le jour même : *« quand je n'ai aucun message et que je clique
sur nouveau message, ça ne fait rien »* — sur `julien.thiong-kay@samaritaine.com`,
un compte sans aucun fil, **alors que le même geste marchait** sur
`jthiongkay@gmail.com`, qui en a.

La page a deux branches : `fils.length === 0 ? état vide : la boîte`.
`ouvrirRedaction()` posait bien `redaction = true` — mais **la branche de l'état
vide ne lit pas cet état**, et le formulaire vit dans l'autre. Le bouton ne
menait donc nulle part, et précisément pour qui n'a **encore jamais écrit** :
tout compte neuf.

Le correctif tient en trois mots (`&& !redaction` dans la condition), plus une
ligne « Aucune conversation pour l'instant » dans la colonne de gauche — on n'y
arrive qu'en écrivant son premier message, et une colonne muette ferait croire à
un chargement.

**⚠️ Ce que ma vérification avait raté.** J'avais rejoué le balisage de la
BOÎTE, donc la branche qui porte des fils, et jamais l'état vide. C'est la règle
déjà écrite pour le menu mobile le 5 septembre — *un composant qui bascule se
regarde dans ses deux états, et celui qu'on oublie est celui qu'on vient de
quitter* — élargie ici : **une page à deux branches se regarde dans les deux**,
et la branche « rien à afficher » est celle que le premier client verra.

Le second contrôle a donc porté sur elle : route jetable rejouant la mécanique
avec `fils = []`, clic RÉEL sur le bouton, formulaire ouvert (978 px de large,
deux colonnes 320/980), dans les deux thèmes, débordement nul. ⚠️ Piège au
passage : le volet masqué rend `innerWidth === 0`, donc **toutes** les requêtes
média `max-width` matchent et la boîte s'affichait en une colonne. Poser une
largeur par `resize_window` avant de conclure — cinquième variante de ce piège.

Tests de garde : `web/tests/notifications.test.ts`, bloc « et le bouton de
l'état vide MÈNE quelque part ».

## Vérifications

Au navigateur, par **route jetable** rejouant le balisage de la boîte (retirée,
`git status` contrôlé, plus `rm -rf web/.next`), **clair et sombre**, à 1 280 et
780 px : le bouton en tête de liste à 44 px de haut, la rédaction qui prend le
panneau de droite avec ses deux actions en pied, la liste qui reste visible
pendant qu'on écrit, et la bascule en une colonne sous 780 px. **Débordement
horizontal nul aux deux largeurs.**

**Quatre sabotages, quatre échecs** : « Messages » remis dans les onglets, le
courrier passé après la cloche, la rédaction redevenue une modale, le bouton
d'en-tête rebasculé en « Annuler ».

1 331 tests du site, `tsc --noEmit`, `eslint .` à **zéro erreur** (47
avertissements, la famille `react-hooks/*` déjà documentée), `next build` avec
`/messages` toujours en route statique.

⚠️ **Non vu connecté** : la page complète demande une session, et le Chrome de
Julien n'en avait pas d'active. Ce qui est prouvé, c'est le rendu du balisage
réel dans les deux thèmes, et les gardes sur le composant.

Tests de garde : `web/tests/notifications.test.ts`, bloc « le message à
l'administrateur ».
