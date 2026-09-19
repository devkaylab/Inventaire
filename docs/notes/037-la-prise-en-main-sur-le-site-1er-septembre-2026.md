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
