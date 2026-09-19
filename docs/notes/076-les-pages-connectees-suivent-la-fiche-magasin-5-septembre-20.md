# Les pages connectées suivent la fiche magasin (5 septembre 2026)

*« Les règles de la fiche magasin sur les autres pages connectées. Elles
bâtissent sur `.panel`, elles n'ont pas profité du changement. »* Maquette
validée avant codage :
https://claude.ai/code/artifact/a196315f-b540-455b-809e-4f2139d062cf

## ⚠️ CE QUE LA MESURE A TROUVÉ, À 1568 px

Le même mal que la fiche magasin, en pire — mesuré sur le rendu réel avant
d'écrire une ligne, par une route jetable qui rejouait le balisage des quatre
pages (elles demandent une session) :

| | avant | après |
|---|---|---|
| Tuile pour afficher « 2 » | **465 px** | une bande de résumé |
| Vide entre un nom et ses boutons (/equipe) | **918 px** | des colonnes |
| Vide dans une rangée d'invitation | **868 px** | **24 px** |
| Champ « Rechercher une personne » | **1 072 px** | **340 px** |
| Carte d'inventaire | 465 × 147 px | 4 par rangée, 333 px |
| Titre de section sur le texte courant | 20 / 15 = **1,33** | 19 sur un fond |
| Sous-section (« CLÔTURÉS ») | 12 px capitales, **plus petit que le texte** | la phrase de section |
| Sections avec un fond | **aucune** | toutes |

## ⚠️ /dashboard ET /entreprise SONT HORS DU LOT — décision de Julien

*« On ne touche pas au tableau de bord. »* Ils vivent dans **`.tb-plein`** —
plein écran, tout en `em`, calé sur l'échelle de la maquette du 30 août. Y
poser des sections en pixels ferait **se battre deux échelles sur le même
écran**, et ce ne sont de toute façon pas des pages qui empilent des blocs.

Un test fige cette exclusion : il exige qu'ils gardent `.tb-plein` et qu'ils ne
prennent PAS `.admin-section`. C'est une garde contre le zèle — qu'on ne
« complète » pas le lot un jour en croyant qu'il manque deux pages.

## Les règles portées, et les deux qui sont neuves

Les cinq de la fiche magasin s'appliquent telles quelles (une section est une
surface, chaque titre porte sa phrase, l'échelle s'écarte, le haut de page
répond avant qu'on cherche, une tuile ne s'étire pas). Deux s'y ajoutent, que
la fiche magasin n'avait pas eu à poser :

- **⚠️ UN CHAMP DE RECHERCHE A UNE LARGEUR DE LECTURE** (`.champ-borne`,
  340 px). On ne tape pas un nom sur un mètre quarante — et un champ qui
  traverse l'écran fait croire qu'il cherche dans toute la page, pas dans la
  section qui le porte. Ce n'est PAS un `max-width` sur `.app-main` (retiré le
  30 août, et c'est une décision) : **c'est le contrôle qui se borne, la page
  reste pleine.**
- **⚠️ UNE RANGÉE NE S'ÉTIRE PAS PLUS QU'UNE TUILE.** Deux formes selon ce
  qu'on en fait : les membres passent en **colonnes** (`.membres`), les autres
  rangées **collent leurs actions au contenu** (`.admin-section .req-row`,
  `justify-content: flex-start`, contenu borné à 760 px).

## ⚠️ /equipe en colonnes : ce n'est pas un changement de décor

Une équipe se **compare** — qui est superviseur, qui n'a jamais créé son mot de
passe, qui couvre quel magasin. En colonnes on balaie du regard ; en phrases il
faut lire chaque rangée pour en extraire la même chose. **C'est la lecture qui
change, la largeur n'en est que la conséquence.**

- **Les cinq cellules sont des FRÈRES de la grille** (`<Fragment key>`) : un
  conteneur par rangée casserait l'alignement des colonnes, et ça ne se voit
  pas sur une seule rangée.
- **⚠️ Les actions passent derrière un menu « ⋯ »** (`components/ui/MenuActions`).
  « Passer compteur » et « Supprimer le compte » étaient deux liens voisins de
  même dessin, l'un réversible d'un clic et l'autre définitif — famille du
  défaut corrigé le 28 août dans l'application (« Supprimer mon compte » collé
  à « Se déconnecter »). Ce qui protège, c'est la **distance** : un geste de
  plus pour ouvrir, et un filet avant le rouge.
- **⚠️ LA RECOPIE DU NOM NE BOUGE PAS.** Le menu déplace un bouton, pas un
  garde-fou. Un test le vérifie explicitement.
- **Le superviseur ordinaire garde son rangement magasin par magasin** (règle
  du 23 août) : une section par magasin, au lieu d'un sous-titre en capitales.
- **`is_active` veut dire « s'est déjà connecté », rien d'autre** — le
  contresens du 23 août. C'est le seul fait de la colonne « Activité » qui
  appelle un geste, donc le seul qui porte l'ambre.

## ⚠️ `--surface-2` NE SERT JAMAIS DE FOND — troisième fois

En thème clair `--surface-2` vaut **#ffffff**, exactement `--surface` : la
rangée d'en-tête du tableau aurait été blanche sur la surface blanche de sa
section, donc **invisible**. `--bg` est un cran en retrait dans les deux
thèmes ; c'est le seul jeton qui tienne les deux.

C'est le même piège que les champs de saisie posés sur un fond de leur propre
couleur (22 août, puis 4 septembre, puis 5 septembre au matin). **Le point
commun n'est pas l'élément, c'est ce qu'il y a DERRIÈRE lui** — mesurer les
deux couleurs, jamais l'une seule.

Et trois contrastes ont dû être relevés, mesurés dans les deux thèmes :
l'en-tête des colonnes (2,85 → **5,59**), « Mot de passe à créer »
(`--warning` 3,19 → `--warning-text` **5,02**) et l'adresse d'un membre
(3,05 → **5,98**). Même correctif que `.offre-refus` le matin même, au même
genre d'endroit : celui où l'on cherche qui n'est jamais entré.

## Deux textes qui mentaient, corrigés au passage

- **« Seul Quantinvo peut créer un magasin »** sur /magasins : faux depuis le
  4 septembre et le libre-service. Le commentaire en tête du fichier le disait
  déjà ; le texte de l'écran, lui, était resté dans l'ancien monde.
- **« Clôturé ce mois-ci » se mesure sur `closed_at`**, pas sur `created_at` :
  un inventaire ouvert en juin et clôturé aujourd'hui doit compter.

## ⚠️ LE DÉFAUT TROUVÉ EN RÉPONDANT À « ALL GOOD ? » — après le commit

`.membres` portait `overflow: hidden` pour arrondir les coins de son en-tête.
Il rognait du même coup **le panneau du menu « ⋯ »**, posé en absolu dans une
cellule : les trois actions d'un membre — changer le rôle, retirer les accès,
supprimer le compte — étaient **inatteignables** sur `/equipe`. Les coins
s'arrondissent désormais cellule par cellule.

⚠️ **ET UN `getBoundingClientRect` NE LE VOIT PAS.** Il rend la géométrie d'un
élément même quand un ancêtre le rogne : le panneau mesurait 92 × 210 px alors
que rien n'était cliquable. **Ce qui tranche, c'est `elementFromPoint`** — le
bas du panneau rendait `.app-main` avec `hidden`, et bien
`.menu-actions-item.destructif` sans. C'est pour ça que le contrôle du menu
« dans ses deux états », fait avant le commit, n'avait rien vu : il mesurait un
rectangle.

⚠️ **Et ma première preuve du défaut était FAUSSE, en sens inverse** : j'ai
d'abord mesuré « hauteur du panneau = 0 » et conclu trop vite. **Le `body`
entier mesurait 0 × 0** — le volet navigateur était masqué, le piège déjà payé
le 5 septembre au matin (« 204 px de débordement » qui n'existaient pas). Poser
une largeur explicite AVANT de mesurer, toujours ; un chiffre invraisemblable
est d'abord un défaut de mesure.

## ⚠️ DEUX DÉFAUTS QUE SEULE LA PAGE RÉELLE POUVAIT MONTRER

Julien : *« Tu ne peux pas vérifier sur Chrome ? »* — son navigateur porte sa
session. **C'est le premier contrôle de ce chantier sur les vraies pages, avec
ses vraies données**, et il a sorti deux défauts que ni le banc, ni la
maquette, ni les tests n'avaient pu voir.

1. **⚠️ LES FILETS DU TABLEAU FAISAIENT UN ESCALIER.** `align-items: center`
   sur la grille : chaque cellule prenait sa hauteur naturelle et son
   `border-bottom` se posait à une hauteur différente de ses voisines. **Les
   rangées d'essai avaient toutes la même hauteur — elles ne pouvaient pas le
   montrer.** Les cellules s'étirent désormais et centrent leur contenu.
2. **⚠️ SUR LA DERNIÈRE RANGÉE, LE MENU S'OUVRAIT HORS DE L'ÉCRAN**, dépassant
   le bas de la fenêtre de 86 px. Il existait, il devenait même atteignable en
   défilant — mais il fallait deviner qu'il était là. `MenuActions` mesure
   maintenant avant d'ouvrir et bascule vers le haut, **sauf s'il n'y a pas non
   plus la place au-dessus** : sinon on déplacerait le débordement au lieu de
   le fermer.

**Et un troisième, hors périmètre mais trouvé là** : le journal affichait
`compteur_retire_du_magasin` **en mot technique** depuis deux semaines. Elle est
écrite par `remove_counter_from_store`, **pas par une fonction `ca_*`** — et la
garde des libellés ne balayait que les `ca_*`. Elle lit désormais **toutes** les
migrations et retient chaque action réellement inscrite au journal d'entreprise :
la prochaine se signalera d'elle-même. Encore une garde qui nommait au lieu de
déduire.

**La leçon générale : un banc d'essai a des données trop régulières.** Des
rangées de même hauteur, une liste courte, une page qui ne touche pas le bas de
l'écran — c'est exactement ce qui cache ces deux défauts-là. **Quand une page
demande une session, le vrai Chrome de Julien est le seul contrôle qui vaille**
(outils `claude-in-chrome`), et il ne coûte que de le demander.

## ⚠️ LE DÉFAUT TROUVÉ EN RÉPONDANT À « ALL GOOD ? » — après le commit

1. **Le pire défaut ne se voit qu'en REGARDANT.** Les 868 px de vide des
   rangées d'invitation ont été trouvés sur une capture, après que le tableau
   des membres était en place : le tableau avait **déplacé** le défaut, pas
   fermé. Aucune maquette et aucun test ne l'aurait montré.
2. **« Au moins une section » ne garde RIEN.** Le premier sabotage n'a pas
   mordu : une page qui a deux sections passe en en perdant une. La garde exige
   donc aussi que les classes de l'ancien monde (`dash-store`, `dash-kpi`,
   `dash-sub`) aient disparu.
3. **Une garde qui vérifie une ABSENCE lit le code sans ses commentaires** —
   septième variante sur ce dépôt, et celle-ci y est tombée **en naissant** :
   le commentaire du bloc CITE `overflow: hidden` pour dire qu'on ne le remet
   pas, et la garde s'est lue elle-même.
4. **Une garde qui tient à une tournure casse au premier ajustement de texte.**
   Sept gardes existantes sont tombées — elles cherchaient
   `<div className="dash-sub">Compteurs · {s.name}</div>`,
   `Magasins{estAdmin && …}`, `{superviseur ? 'Passer compteur' : …}`. Toutes
   ont été **réorientées vers ce qu'elles défendent** (le découpage par magasin,
   le compte affiché, le geste offert), jamais affaiblies. C'est la même
   correction que `espace-admin-entreprise.test.ts` le matin.

## Vérifications

- **Mesuré au navigateur**, route jetable retirée (`git status` contrôlé), à
  **1568 px** (l'écran de Julien), 1024 et 760 px, **clair et sombre** : tous
  les chiffres du tableau ci-dessus, **débordement horizontal nul** — mesuré
  sur `body *`, jamais sur une seule branche (leçon du 5 septembre au matin).
- **Le menu « ⋯ » exercé dans ses DEUX états** : fermé au repos (le défaut du
  menu mobile de ce matin — *un composant qui bascule se regarde dans ses deux
  états*), ouvert au clic, Échap referme **et rend le focus**, un clic ailleurs
  referme, le panneau tient dans l'écran, et « Supprimer le compte » est le
  dernier, derrière son filet.
- **Quinze sabotages, quinze échecs** — après resserrement du premier, qui ne
  mordait pas.
- 1 244 tests du site, `tsc --noEmit`, `eslint .` à **zéro erreur** (47
  avertissements, tous de la famille `react-hooks/*` déjà documentée, aucun sur
  les fichiers touchés), `next build` avec la table de routes **inchangée**.

**VU EN PRODUCTION, sur le compte de Julien** (`/equipe`, 1710 px) : la bande
de résumé, le tableau à colonnes sur cinq personnes réelles, les filets, et le
menu d'une rangée ouvert pour de vrai. C'est ce contrôle qui a sorti les trois
défauts ci-dessus, puis confirmé leur correctif — filets alignés au pixel
(écart 0 sur les cinq rangées) et menu de la dernière rangée qui bascule vers le
haut, entièrement dans l'écran, ses deux extrémités cliquables.

Tests de garde : `web/tests/pages-connectees.test.ts`.
