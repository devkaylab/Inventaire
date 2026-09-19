# Y voir clair : la fiche magasin, et les règles qui en sortent (5 septembre 2026)

*« Je ne ressens pas ça sur Quantinvo, i just feel lost most of the time, les
sections se ressemblent toutes… on aurait dit une page brouillon faite par un
débutant. Prends exemple sur ce qui se fait de mieux ailleurs, balade-toi sur
qonto.com. »* Maquette validée avant codage :
https://claude.ai/code/artifact/bd09e13c-79ef-4f53-a26d-7d8f2ea6a3a6

## ⚠️ CE QUE LA COMPARAISON A MESURÉ, PAS DEVINÉ

| | Qonto | Quantinvo avant |
|---|---|---|
| Fond d'une section | bande blanche / grise / noire, alternée | **aucun** |
| Respiration interne | 80 px de padding haut et bas | **0** — `margin-top: 44px` |
| Titre de section | 56 px sur un texte à 16 → rapport **3,5** | 20 sur 15 → rapport **1,3** |
| Sous le titre | une phrase qui dit ce qu'on trouve là | rien |
| Cartes | rayon 4, **ni ombre ni bordure** — le fond suffit | contours partout |

`.admin-section` **n'était qu'une marge**. Cinq blocs flottaient sur la même
couleur, avec des titres presque du poids du texte : il fallait LIRE pour savoir
où on était. C'est toute la cause du « brouillon ».

## ⚠️ ET LE PIRE N'ÉTAIT PAS DANS LA MAQUETTE — RIEN N'AVAIT DE MESURE

Trouvé en regardant la **vraie page**, sur l'écran de Julien (1568 px), après
que la maquette eut été validée : `.app-main` n'ayant plus de largeur maximale
depuis le 30 août, une rangée d'inventaire s'étalait sur **1 440 px** — le nom à
gauche, le bouton « Ouvrir » à l'autre bout, et un mètre virtuel de vide entre
les deux. Deux tuiles de **700 px** pour afficher « 0 » et « 2 ».

⚠️ **ON NE REMET PAS DE `max-width` SUR `.app-main`** : deux constats de Julien
l'ont fait retirer le 30 août (la colonne à 1120, puis le plafond à 1400), et
`max-width: none` en est la **trace**, pas un oubli. La largeur se **remplit**
au lieu de s'étirer — `.fiche-colonnes` met la page en deux colonnes au-delà de
1180 px : le travail à gauche, les références à droite (le code d'accès, qu'on
lit une fois ; la fermeture, qu'on ne veut pas sur le chemin). Un test refuse
le retour d'une largeur contraignante.

**Leçon de méthode** : la maquette a validé la hiérarchie, elle ne pouvait pas
montrer ce défaut-là — elle était dessinée à 1060 px. **Regarder la vraie page,
à la vraie largeur, avant de conclure qu'une maquette est complète.**

## Les cinq règles, qui valent pour toutes les pages

1. **Une section est une surface, pas une marge.** Fond `--surface`, filet,
   rayon, 22/24 de padding. C'est ce seul changement qui fait voir cinq blocs
   au lieu d'une colonne de texte.
2. **Chaque titre porte une phrase** (`.section-note`, bornée à 62ch). Un titre
   nu oblige à lire le contenu pour savoir si c'est le bon endroit.
3. **L'échelle s'écarte** : 34 / 19 / 11,5. Trois niveaux qu'on distingue sans
   les lire — le titre de page passe de 30 à 34, les sections de 20 à 19.
4. **Le haut de page répond avant qu'on cherche** (`.resume-bande`) : quatre
   chiffres déjà chargés, aucun appel de plus, et **l'ambre n'y désigne que ce
   qui appelle une décision**.
5. **Ce qui détruit sort des cartes** (`.zone-sensible`) : en bas, sans surface,
   derrière un filet. C'est la DISTANCE qui protège — même raisonnement que
   « Supprimer mon compte » éloigné de « Se déconnecter » le 28 août.

Et une sixième, propre à la fiche : **une tuile ne s'étire pas**
(`repeat(auto-fit, minmax(180px, 260px))` + `justify-content: start`), sinon
deux chiffres occupent 1 140 px.

## Ce que la fiche magasin gagne, et ce qu'elle perd

Le **code d'accès descend** — on le lit une fois par magasin, à la constitution
de l'équipe, jamais à chaque visite. « Membres » devient **« Équipe »**, le mot
de la page qui les gère, et le compte quitte le titre pour les sous-sections
(« Superviseurs · 3 »), où il sert à quelque chose. Le sous-titre de page dit
l'**identité** (entreprise, date de création) et plus les chiffres, qui ont
maintenant leur rangée.

## La barre publique : parcourir à gauche, agir à droite

*« Regarde aussi la barre menu de Qonto, adapte-la sur le site avant de créer un
compte, pas les pages d'après. »* Elle porte deux actions de rangs différents —
« Se connecter » en lien discret, puis « Ouvrir un compte » en bouton plein.

⚠️ **LA NÔTRE N'EN PORTAIT QU'UNE**, « Se connecter » en bouton fantôme :
**l'action commerciale principale était absente de la barre**, alors qu'elle est
la raison d'être des pages publiques. `HeaderActions` pose les deux rangs, et
n'en garde qu'un — « Mon espace » — une fois connecté : quelqu'un qui a déjà un
espace n'inscrit pas une seconde entreprise depuis la barre.

Au passage, les six liens étaient répartis d'un bord à l'autre en
`space-between`, le bouton au même poids qu'« Accueil ». La navigation est
désormais **collée au logo** (`gap: 32px`) et les actions poussées à droite
(`margin-left: auto`). **« Accueil » a disparu** : le logo y mène, c'est une
convention universelle, et le répéter coûtait la place d'un lien qui apprend
quelque chose.

## Vérifications

- **Au navigateur, sur le rendu réel** (route jetable rejouant la structure de
  la fiche, retirée — `git status` contrôlé), **à 1568 px**, la largeur de
  l'écran de Julien, **clair et sombre** : la bande de résumé, les deux
  colonnes, les cartes distinctes, les tuiles à leur mesure, la colonne latérale
  collante, la zone sensible détachée. **Débordement horizontal nul.** Et la
  barre publique en vrai sur `/`, dans les deux thèmes.
- **Quatre sabotages, quatre échecs** : la section redevenue une marge nue, le
  titre redescendu à 30, la barre reperdant son second rang d'action, « Accueil »
  revenu doubler le logo.
- **Une garde amendée, pas affaiblie** : `espace-admin-entreprise.test.ts`
  citait « Membres ( » et « Inventaires ( » — des libellés AVEC leur compte
  entre parenthèses. Elle vise désormais les **sections et leur source**
  (`<h2>Équipe</h2>`, `fiche.supervisors.map`, `ca_store_detail`) : une garde
  qui tient à une tournure casse au premier ajustement de texte sans rien avoir
  protégé.
- 1 126 tests du site, `tsc --noEmit`, `eslint .` à zéro erreur, `next build`
  avec la table de routes inchangée.

⚠️ **CE QUI RESTE À FAIRE, ET QUE JULIEN A DEMANDÉ** : les mêmes règles sur les
pages qui n'utilisent pas `.admin-section` — `/dashboard`, `/entreprise`,
`/equipe`, `/inventaires`, `/journal`, `/magasins`. Elles bâtissent sur `.panel`
et `.dash-*`, donc elles ne profitent pas du changement automatiquement. Les
reprendre **en les regardant**, page par page : la fiche magasin a montré que la
maquette seule ne voit pas le défaut de mesure.

Tests de garde : `web/tests/navigation.test.ts`, blocs « une section est une
surface, pas une marge » et « la barre publique : parcourir à gauche, agir à
droite ».
