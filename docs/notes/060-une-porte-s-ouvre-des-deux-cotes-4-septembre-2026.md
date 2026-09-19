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
