# Les éléments des deux boutiques

Tout ce que l'App Store et Google Play demandent en plus du binaire : les
captures aux dimensions exigées, le bandeau et l'icône de Play.

| Fichier | Pour | Taille |
|---|---|---|
| `captures-ios-69/` | App Store, iPhone 6,9 pouces — et Google Play, téléphone | 1320 × 2868 |
| `captures-ipad-13/` | App Store, iPad 13 pouces | 2064 × 2752 |
| `bandeau-play-1024x500.png` | Google Play, image mise en avant | 1024 × 500 |
| `icone-512.png` | Google Play, icône de la fiche | 512 × 512 |

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

⚠️ **Le script refuse de sortir l'image si Sora n'a pas été résolue.** Une
police absente ne lève aucune erreur : le navigateur retombe en silence sur une
fonte système, et le bandeau part chez Google en Helvetica sans que rien ne le
signale. On mesure donc un mot témoin dans les deux fontes avant d'écrire.

## Le bandeau : ce qui a été décidé le 2 septembre 2026

Trois pistes présentées, chacune vue en grand **et à 336 px** — la taille où
Play l'affiche le plus souvent, et donc celle qui décide. Maquette :
https://claude.ai/code/artifact/73d58469-dc29-458e-9f23-177c372713d8

Retenue : **la phrase**. Le nom passe en petit, la promesse occupe la place.
La personne qui voit ce bandeau vient de chercher « inventaire » et ne sait pas
ce qu'est Quantinvo ; répéter le logo, déjà affiché à côté dans la fiche,
n'apprend rien.

**La baseline est « La fiabilité du stock au quotidien »** (Julien, 2 septembre
2026). ⚠️ Elle est **nouvelle** : elle n'existait nulle part ailleurs dans le
produit au moment de sa création — ni sur le site, ni dans les decks, ni dans
la fiche produit, qui portent encore « Outil d'inventaire ». Si elle devient la
baseline officielle, c'est un alignement à faire partout, pas seulement ici.

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
autres à l'échelle tout seul : d'où un seul jeu iPhone et un seul jeu iPad. Le
jeu iPhone sert aussi à Google Play.

⚠️ **Le viseur est noir sur la capture du comptage** : un simulateur n'a pas de
caméra. C'est honnête, mais ça ne vend pas — c'est le seul écran dans ce cas, et
la même capture prise sur un vrai téléphone devant un rayon vaudrait mieux.

La recette de prise de vue (aiguillage temporaire, bascule de compte, écrans à
état) est dans `../deck/LISEZMOI.md` : c'est la même.
