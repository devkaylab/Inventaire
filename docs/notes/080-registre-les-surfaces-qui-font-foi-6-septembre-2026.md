# Registre — les surfaces qui font foi (6 septembre 2026)

Seconde moitié de la décision du 6 septembre. Ardoise habille l'outil ;
**Registre habille ce qui fait foi**. Périmètre tranché par Julien : le rapport
à l'écran **et** les documents produits. Maquette validée point par point avant
codage, trois décisions arbitrées :
https://claude.ai/code/artifact/f968d044-db4a-4a86-8459-fb16cf635e29

| Surface | Registre |
|---|---|
| Rapport d'un inventaire, écarts d'audit, rapport consolidé d'un magasin | oui |
| Devis PDF | oui |
| Exports Excel et CSV | ce que la bibliothèque libre accepte — voir plus bas |
| Tableau de bord, Suivi, Set up, Équipe, Magasins… | **non** |

⚠️ **REGISTRE S'ARRÊTE LÀ OÙ L'ON CESSE DE LIRE POUR FAIRE.** C'est cette
frontière qui empêche « deux identités » de devenir « deux produits », et une
garde la tient : elle balaie `app/` et `components/`, retient tout fichier qui
pose `className="registre"`, et compare à la liste décidée. Un quatrième écran
qui s'y mettrait se signale tout seul.

## ⚠️ DÉCISION 1 — LA GRAMMAIRE, PAS LE PAPIER

La palette de Registre est crème. Posée telle quelle dans la coquille sombre,
elle donnerait **un rectangle blanc de 1 400 px** au milieu de l'écran qu'on
regarde le plus longtemps de la journée. Et un rapport n'est pas qu'une
lecture : on y cherche, on y trie, on y tourne les pages — une feuille de
papier ne fait pas ça.

Ce qui dit « document », ce ne sont pas les couleurs : ce sont **les filets, les
nombres alignés et l'absence de boîtes**. Les couleurs suivent donc le thème.
En clair seulement, le fond glisse vers le papier (#FAF9F6 contre #F2F3F1) —
assez peu pour qu'aucune couture ne se voie, assez pour qu'on sente le grain.
En sombre, on ne touche à rien.

## ⚠️ DÉCISION 2 — AUCUN ACCENT À L'ÉCRAN

Le marine **#1D3E63** de Registre rend **1,6:1** sur le fond sombre — très loin
du seuil AA. L'éclaircir reviendrait à inventer un second marine qui ne serait
plus celui du devis. À l'écran il n'y a donc **que de l'encre**, plus l'ocre
d'Ardoise (`--warning-text`) sur la seule chose qui appelle une décision : un
écart non arbitré. C'est la règle d'Ardoise — « l'accent ne sert qu'à ce qui
engage » — appliquée à une surface où l'on ne clique pas.

Le marine reprend tout son sens là où il n'y a pas de thème : **le devis**.

## ⚠️ DÉCISION 3 — DEUX POLICES, ET LEUR POIDS EST MESURÉ

**Newsreader** (serif de lecture) pour les titres, **IBM Plex Mono** pour tous
les nombres. Le second n'est pas esthétique : en chasse fixe les colonnes
s'alignent au chiffre près, et l'écart le plus gros se repère sans lire.

| | Polices téléchargées |
|---|---|
| Vitrine (`/tarifs`, `/login`) | 2 fichiers, **60,1 ko** |
| Espace connecté | 5 fichiers, **136,6 ko** |

⚠️ **ELLES NE SONT PAS DÉCLARÉES DANS `app/layout.tsx`, ET C'EST MESURÉ.** Elles
y étaient d'abord : la vitrine téléchargeait alors 136,6 ko — **+76,5 ko pour
deux caractères qu'une page vitrine n'affiche jamais**. `next/font` n'émet sa
feuille `@font-face` que dans les morceaux qui importent le module :
`lib/policesRegistre.ts` est importé par la seule coquille `AppShell`, qui pose
les deux variables sur `.app-main`. Mesuré au navigateur dans les deux sens.
Elles restent **auto-hébergées**, comme les deux autres.

## Ce que Registre change à l'écran

- **Les nombres en chasse fixe** — `.num`, les tuiles de résumé, les codes
  (`.dash-art-code`, une classe ajoutée pour ça : le SKU et le code-barres se
  lisent comme des nombres).
- **La bande de résumé devient un intervalle réglé** : un filet d'encre en
  haut, un en bas, des cases séparées par un trait, et **le libellé passe
  au-dessus du chiffre** — l'ordre d'un relevé.
- **Le tableau perd son cadre** : deux traits d'encre l'ouvrent et le ferment,
  des filets fins entre les lignes. Le conteneur garde son défilement, qui
  tient l'en-tête collant sur cinquante lignes.
- **Le statut n'est plus une pastille** : en petites capitales, l'ocre ne se
  voit que là où il reste quelque chose à faire ; ce qui est réglé passe en gris.
- **Le « € » quitte la colonne** pour l'en-tête (« Valeur (€) ») : répété
  cinquante fois, il cassait l'alignement qu'on venait de gagner.
- **Un en-tête de document** remplace la ligne de fraîcheur : la page nomme
  l'inventaire, le document nomme la pièce et l'heure à laquelle elle est
  arrêtée. Un élément ajouté, un retiré.

⚠️ **ET LES DEUX BOUTONS DE PASSE GARDENT LEURS COULEURS** — le vert du
comptage et l'or de l'audit, ceux de l'application depuis le 29 août. Registre
habille ce qu'on lit, il n'éteint pas ce qui engage. Une garde refuse qu'on les
reteigne sous `.registre`.

⚠️ **LE RAYON SE POSE ÉLÉMENT PAR ÉLÉMENT, JAMAIS PAR `--r`.** Redéfinir le
jeton carrerait aussi ce qui n'appartient pas au document : la modale du format
de téléchargement, l'anneau de focus.

## ⚠️ PAS DE TROISIÈME GRIS DANS UN DOCUMENT

Mesuré sur le papier : `--text-3` y donne **3,06:1**, sous AA — et il portait
les en-têtes de colonnes, les codes-barres, les libellés de tuiles et l'heure
d'arrêté, c'est-à-dire ce qu'on **lit**. Tout est passé à `--text-2` (6,2:1 en
clair, 7,0:1 en sombre). Même règle sur le devis, où le gris d'avant (#8B877C)
donnait 3,2:1 sur du papier blanc **en portant la date de validité et le
SIREN**. Dans un document, la hiérarchie vient de la taille et des capitales,
jamais de la pâleur.

## Le devis : le dernier indigo du produit

Le PDF portait encore, à l'octet près, l'identité d'avant : bandeau `#0B0F19`,
filet cyan `#38C9FF`, titre `#4636B0`, bouton `#6366F1` — le même indigo que le
halo du logo, retiré le matin même. C'est le document que le client signe.

- **L'en-tête est un filet, plus un bandeau.** Un aplat d'encre de 26 mm en
  haut d'une A4 est une bannière de site posée sur un document — **et il
  s'imprime**.
- **⚠️ IL N'Y A PAS DE FOND CRÈME.** Registre a un papier ; on ne le peint pas
  sur la page. Un aplat sur 210 × 297 mm coûte de l'encre au client pour un
  fond que son papier porte déjà.
- **⚠️ LA SERIF EST TIMES, PAS NEWSREADER.** Un PDF n'a droit sans embarquement
  qu'aux quatorze polices que tout lecteur possède. Embarquer la serif du site
  voudrait dire glisser un fichier de police dans le paquet de la fonction
  edge, pour un document que personne ne comparera côte à côte avec un écran.
- **L'ocre ne porte qu'une phrase** : la mention réglementaire de TVA. Une
  garde compte les usages — un seul.
- Le total se pose sous un trait d'encre, sans aplat : la ligne d'arrêté d'un
  relevé, pas un encadré à remarquer.

## Les exports : ce que le tableur accepte, et ce qu'il refuse

Mesuré le 6 septembre en écrivant un fichier et en le relisant, sur la version
**0.20.3** du dépôt (SheetJS libre, vendorisée en août pour deux failles) :

| | |
|---|---|
| Formats de nombre (`z`) | **oui** |
| Largeur des colonnes (`!cols`) | **oui** (déjà en place) |
| Filtre automatique (`!autofilter`) | **oui** |
| En-tête figé (`!freeze`) | non — version payante |
| Gras, couleurs, bordures (`cell.s`) | non — version payante |

Registre sur un export se réduit donc à trois choses, et c'est beaucoup à
l'usage : aujourd'hui un comptable qui ouvre le fichier voit « −2850 » dans une
colonne trop étroite.

- **⚠️ LES FORMATS SE POSENT PAR NOM DE COLONNE, JAMAIS PAR INDICE.** Une
  colonne insérée un jour décalerait tout **en silence** : le fichier resterait
  juste, il s'afficherait faux.
- **⚠️ LE FILTRE S'ARRÊTE AVANT LA LIGNE TOTAL.** Sinon le tableur la traite
  comme une ligne de données : elle se retrouve triée au milieu du tableau, ou
  masquée — sur la seule ligne qu'on cherche toujours.
- **⚠️ Un format n'est PAS du texte** : la cellule reste un nombre, le tableur
  la somme toujours. C'est l'inverse de `forcerEnTexte`, qui fige les codes —
  et c'est pourquoi les deux ne visent jamais la même colonne.
- **⚠️ `src/lib/report.ts` a reçu le même traitement**, et ce n'est pas
  facultatif : un rapport partagé depuis le téléphone doit être **le même
  fichier** que celui téléchargé sur le site. Un test compare les deux tables.

## ⚠️ « REGISTRE » EST SURCHARGÉ TROIS FOIS DANS CE DÉPÔT

Le mot m'a coûté deux incidents dans la même heure, et le second était
destructeur :

1. **`.registre` existait déjà en CSS** — la réponse du registre public sous le
   champ SIREN. Bloc **mort** (aucun écran ne l'a jamais rendu), mais il posait
   un fond `--success-soft` : le rapport s'est affiché **sur un fond vert
   d'eau** le temps de le trouver. Retiré ; le nom appartient à la piste.
2. **`web/tests/registre.test.ts` existait aussi** — il garde `lib/registre.ts`,
   la recherche par SIREN. **Je l'ai écrasé.** Restauré depuis `HEAD` ; mes
   gardes vivent dans `piste-registre.test.ts`.

**Avant de nommer quoi que ce soit « registre » : regarder ce qui porte déjà ce
nom.** Et plus généralement : un `cat >` sur un fichier de test qu'on croit
neuf mérite un `ls` d'abord.

## Deux gardes amendées, aucune affaiblie

- `navigation.test.ts` exigeait `className="app-main"` **mot pour mot** ;
  `app-main` a gagné les deux variables de police et la garde est tombée alors
  que la largeur n'avait pas bougé. Elle vise désormais la **classe**, et ce
  qu'elle défend reste : pas de modificateur de largeur.
- La garde du filtre **comptait mal** : elle cherchait qu'un appel `…, 1)`
  existe quelque part. Retirer le `1` de la feuille « Écarts » la laissait
  passer, parce que « Consolidé » gardait le sien. Elle compte maintenant les
  feuilles qui finissent par un TOTAL et exige autant d'appels.
  **Une garde qui cherche UNE occurrence ne garde que la première.**

⚠️ **Et le dépouilleur de commentaires tranchait au milieu du commentaire
d'en-tête** : sans son `/*` ouvrant, tout le reste du commentaire restait en
clair — et ce commentaire cite justement les couleurs retirées, pour dire
qu'on ne les remet pas. La garde se lisait elle-même. **Neuvième fois.**

## Vérifications

- **Au navigateur**, par route jetable (retirée, `git status` contrôlé),
  **clair et sombre** : le rapport et les écarts, contrastes mesurés dans les
  deux thèmes (six rôles de petit texte, tous ≥ 6,2:1), débordement horizontal
  nul, et le titre de page en Newsreader 500 à 34 px sur le rapport de magasin.
- **Le PDF a été RÉELLEMENT DESSINÉ** et relu à l'écran, par une sonde qui
  rejoue `elementsDevis` avec le pdf-lib du site. C'est la seule preuve qui
  vaille : un libellé qu'Helvetica n'encoderait pas ferait lever `drawText`.
- **Le poids des polices, mesuré dans les deux sens** (avec et sans), sur une
  page vitrine et sur une coquille simulée.
- **Quatorze sabotages, quatorze échecs** — dont deux qui ont d'abord **passé**
  et ont fait resserrer leur garde.
- 1 315 tests du site, 416 de l'application, `tsc --noEmit` des deux côtés,
  `eslint .` à **zéro erreur** (47 avertissements, la famille `react-hooks/*`
  déjà documentée), `next build` avec la table de routes **inchangée**.

## ⚠️ CE QUI N'EST PAS DÉPLOYÉ, ET NE DOIT PAS L'ÊTRE SANS SON ACCORD

- **Le devis PDF vit dans le dépôt, pas en production.** Une fonction edge n'a
  pas de préversion : la déployer changerait le document **tout de suite**,
  pour tout le monde. Julien a demandé « toujours sur le preview ». Le jour
  venu : `quote-pdf` et `admin-send-quote` (elles embarquent `_shared/devis.ts`
  et `_shared/devisPdf.ts`), plus les trois autres qui embarquent `devis.ts` —
  `accept-quote`, `decline-quote`, `ca-request-store`. **`verify_jwt` se relève
  sur la base AVANT de déployer**, jamais depuis cette note.
- **L'export de l'application demande une reconstruction** : `src/lib/report.ts`
  ne prend effet qu'au prochain build.
- **Non vu à l'écran** : le rapport et les écarts demandent une session de
  superviseur. Ce qui est prouvé, c'est le rendu des composants avec leurs
  vraies classes. C'est le contrôle sur le compte de Julien qui a trouvé les
  trois vrais défauts du tableau d'équipe le 5 septembre — celui-là vaut la
  peine d'être refait ici.

## Ce qui n'entre pas dans le périmètre, et pourquoi

**Les e-mails transactionnels** portent le même bandeau encre et le même filet
cyan que le devis d'avant (`_shared/email.ts`, `indigoProfond` compris). Ils
n'ont pas été touchés : ce gabarit a été arrêté avec Julien le 21 août après
plusieurs passes sur le rendu réel dans Gmail, y toucher demande de redéployer
**quatorze** fonctions edge et de vérifier dans une vraie boîte. C'est un
chantier à lui seul, pas une retouche.

Tests de garde : `web/tests/piste-registre.test.ts`.
