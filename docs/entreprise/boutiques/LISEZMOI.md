# Les éléments des deux boutiques

Tout ce que l'App Store et Google Play demandent en plus du binaire : les
captures aux dimensions exigées, le bandeau et l'icône de Play.

| Fichier | Pour | Taille |
|---|---|---|
| `captures-app-store/` | App Store, iPhone 6,9 pouces | 1320 × 2868 |
| `captures-google-play/` | Google Play, téléphone | 1080 × 2160 |
| `bandeau-play-1024x500.png` | Google Play, image mise en avant | 1024 × 500 |
| `icone-512.png` | Google Play, icône de la fiche | 512 × 512 |
| `../../../web/public/og.png` | l'image de partage du **site** | 1200 × 630 |

⚠️ **`og.png` est le seul fichier que `produire.mjs` écrit hors de ce dossier**,
et c'est **le plus vu des quatre** : il part à chaque fois qu'un lien du site
est collé dans LinkedIn, Slack ou un message. Les autres attendent une
publication ; celui-là est en ligne aujourd'hui. Il vit dans `web/public/`
parce que c'est le site qui le sert, et une copie dans deux dossiers finirait
par diverger.

## ⚠️ Identité : Ardoise depuis le 13 septembre 2026

Le bandeau, l'image de partage et l'icône portaient encore l'identité d'AVANT —
dégradé violet, cube isométrique, filet de scan cyan, Sora — **dix jours après
que tout le reste du produit en soit sorti** (le site et l'application le
6 septembre, les e-mails le 7). Personne ne l'avait vu, pour une raison
simple : ces fichiers vivent dans `docs/`, donc hors de ce que les gardes du
site et de l'application balaient.

C'est fermé dans les deux sens : les trois visuels sont régénérés, et
`web/tests/visuels-boutiques.test.ts` refuse désormais toute valeur de
l'ancienne palette dans les gabarits, le retour du cube, un second usage de
l'accent, et un contrôle de police qui ne surveillerait plus celles que les
gabarits demandent réellement.

⚠️ **CE PARAGRAPHE A ANNONCÉ DES CAPTURES PÉRIMÉES, ET C'ÉTAIT FAUX.** Il
disait, le 13 septembre 2026, que les captures de la fiche montraient encore
l'ancienne interface et qu'elles étaient « à refaire avant de déposer ». Elles
avaient été refaites **le 8 septembre**, déposées sur App Store Connect et sur
la Play Console, et elles portent bien Ardoise et Registre. Constat de Julien
le jour même : « on a déjà des nouvelles captures ».

**Ce qui a trompé, et il faut le savoir** : les captures déposées vivaient
**hors du dépôt** (`~/Desktop/quantinvo-captures-boutiques/`), pendant que le
dépôt gardait celles du 2 septembre. Le dossier disait donc l'inverse de la
réalité. C'est réparé dans les deux sens — les visuels déposés sont ici, les
anciens sont partis. **Un livrable qui vit hors du dépôt finit toujours par
faire mentir le dépôt** : ce qui est remis à une boutique, à un client ou à un
tiers se range ici le jour où il est remis.

L'icône de l'App Store n'est pas ici : elle vit **dans le binaire**
(`ios/Inventaire/Images.xcassets/AppIcon.appiconset`), Apple la lit depuis
l'archive. Elle est opaque, comme Apple l'exige — une couche alpha fait
refuser l'envoi.

## Régénérer

```bash
CHROMIUM_PATH="$HOME/Library/Caches/ms-playwright/chromium-1234/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing" \
  node produire.mjs
```

⚠️ **Les images sont générées, jamais retouchées à la main** — même règle que
les decks. Le bandeau se modifie dans `bandeau-play.html`, qui *est* le
bandeau à sa taille exacte ; une retouche du PNG serait écrasée à la
génération suivante.

⚠️ **Ce dossier n'installe rien.** `produire.mjs` va chercher Playwright dans
`web/node_modules` et sharp dans `../deck/node_modules` — les deux sont déjà
là. Un `npm install` ici créerait un troisième arbre de dépendances à tenir, et
lancé sans manifeste il a déjà élagué celui du deck une fois.

⚠️ **Le script refuse de sortir l'image si une police n'a pas été résolue.**
Une police absente ne lève aucune erreur : le navigateur retombe en silence sur
une fonte système, et le visuel part chez Google en Helvetica sans que rien ne
le signale. Les deux polices d'Ardoise sont contrôlées — Archivo et Public
Sans —, en comparant le même texte rendu avec deux familles de secours
différentes : si la police demandée est résolue, elle gagne dans les deux cas
et les largeurs sont identiques.

⚠️ **Archivo et Public Sans sont INSTALLÉES sur le Mac de Julien**
(`~/Library/Fonts`). Couper le lien Google Fonts n'y prouve donc rien : le
navigateur les résout depuis le système, et la garde a raison de se taire.
Pour l'éprouver, saboter le nom que le script cherche, pas l'URL du gabarit.

## Le bandeau : ce qui a été décidé le 2 septembre 2026

Trois pistes présentées, chacune vue en grand **et à 336 px** — la taille où
Play l'affiche le plus souvent, et donc celle qui décide. Maquette :
https://claude.ai/code/artifact/73d58469-dc29-458e-9f23-177c372713d8

Retenue par Julien : **la phrase**. La baseline occupe la place, la marque
passe en petit au-dessus. Elle a été retenue parce que **ce n'est plus la
marque qui parle, c'est ce que fait le produit** : la personne qui voit ce
bandeau vient de chercher « inventaire » et ne sait pas ce qu'est Quantinvo ;
le logo, lui, est déjà affiché juste à côté par Play.

⚠️ **CE PARAGRAPHE A DÉCRIT « LE GESTE » PENDANT ONZE JOURS**, c'est-à-dire la
piste qui n'a PAS été retenue — cube débordant, ligne de scan en travers, nom à
droite. La première version du bandeau l'avait produite par erreur, elle a été
corrigée le 2 septembre dans le gabarit, et personne n'est revenu ici. Une note
qui décrit une décision doit être corrigée le jour où la décision change, sinon
elle la contredit en silence.

⚠️ **Rien d'important ne touche les bords** — Play recadre le bandeau selon les
surfaces, et le texte tient dans une marge de 84 px. C'est aussi ce qui a fait
préférer cette piste : elle ne perd rien au recadrage.

⚠️ **PAS DE DÉCOR À DROITE, et c'est une décision du 13 septembre 2026.** Le
plan de magasin agrandi y a été essayé, puis retiré le jour même : coupé par le
bord, il perd son cadre, et il ne reste que des bandes verticales qui se lisent
comme un défaut de rendu. Le vide de droite n'est pas un manque — c'est la
zone que Play recadre.

**La baseline est « La fiabilité du stock au quotidien »** (Julien, 2 septembre
2026), et elle vaut **pour ce qui vient**.

⚠️ **L'existant n'est PAS repris, et c'est une décision.** Le site, les six
decks et la fiche produit portent encore « Outil d'inventaire » : Julien a
écarté la reprise (« j'ai travaillé sur des decks différents donc pas besoin
d'aligner, mais pour les prochains oui »). Ne pas « harmoniser » ces documents
en croyant rattraper un oubli. Tout **nouveau** livrable, lui, porte la
baseline.

Ce que Google impose, et qui est tenu :

- **Fond plein, sans transparence.**
- **Aucune mention promotionnelle** — pas de « gratuit », pas de note en
  étoiles, pas de faux badge « choix de la rédaction ». C'est un motif de refus
  de fiche, pas une recommandation.
- **Rien d'important sur les bords** : Play recadre le bandeau selon les
  surfaces. Le bloc de texte commence à 104 px, soit un peu plus de 10 % de la
  largeur — c'est la seule raison pour laquelle la marge n'est pas à 72.
- **Pas de capture d'écran dedans.** Elles arrivent juste en dessous ; les
  répéter ici gâche les deux.

## Les captures

⚠️ **Ce ne sont pas celles du guide.** Celles-là vivent dans `../deck/captures/`
en demi-résolution et servent les documents. Une capture de boutique se prend
sur l'appareil que la boutique exige, à sa résolution native — la
redimensionner la ferait refuser.

Apple ne demande plus que le plus grand appareil de chaque famille et met les
autres à l'échelle tout seul : d'où un seul jeu iPhone.

⚠️ **IL N'Y A PLUS DE JEU iPad, et ce n'est pas un oubli.** `supportsTablet`
est passé à **faux** le 8 septembre 2026 : l'application est en portrait et
pensée pour un téléphone, Apple ne réclame donc plus de captures iPad. Le
dossier `captures-ipad-13/` a été retiré le 13 septembre. Le remettre suppose
d'abord de rouvrir la compatibilité iPad dans `app.json`. Décision reconduite
le 22 septembre 2026.

⚠️ **MAIS CE DRAPEAU NE DISPENSE PAS DE L'iPAD À LA REVUE**, et ça a coûté une
soumission. Une application iPhone s'installe quand même sur un iPad et y
tourne dans une fenêtre de téléphone ; rien dans App Store Connect ne permet de
l'en empêcher. Apple a refusé la version 1.0 (build 5) le 22 septembre —
`Guideline 2.1(a)`, revue faite sur un **iPad Air 11" (M3)** sous iPadOS 27.0,
plantage au lancement. Pas de captures iPad à produire, donc, mais
**l'application doit démarrer sur un iPad avant chaque dépôt** :
`./scripts/simulateur.sh ipad`.

⚠️ **Ce ne sont pas des captures brutes, mais des VISUELS DE FICHE** : une
accroche en deux lignes, un fond plein, et l'écran posé dans un téléphone en
perspective. Les cinq racontent le parcours dans l'ordre où on le vit —
ouvrir un rayon, suivre l'avancement, arbitrer un écart, sortir le rapport,
compter à la douchette. Une capture brute est honnête mais muette : sur une
fiche, la personne défile vite et c'est l'accroche qui dit ce que fait l'app.

⚠️ **Les deux jeux ne diffèrent QUE par la taille** (1320 × 2868 pour Apple,
1080 × 2160 pour Google) — même composition, mêmes accroches. Les refaire, c'est
les refaire tous les deux, sinon les deux fiches cessent de se ressembler.

⚠️ **Le viseur est noir sur la capture du comptage** : un simulateur n'a pas de
caméra. C'est honnête, mais ça ne vend pas — c'est le seul écran dans ce cas, et
la même capture prise sur un vrai téléphone devant un rayon vaudrait mieux.

⚠️ **Aucun script ne les compose** — c'est leur faiblesse, et elle est connue :
elles ont été faites à la main le 8 septembre, donc une reprise d'identité ne
les rattrapera pas toute seule, exactement comme le bandeau et l'og l'ont
montré. L'écran, lui, se reprend au simulateur ; la recette (aiguillage
temporaire, bascule de compte, écrans à état) est dans `../deck/LISEZMOI.md`,
c'est la même.
