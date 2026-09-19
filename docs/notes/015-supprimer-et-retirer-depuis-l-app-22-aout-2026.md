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
