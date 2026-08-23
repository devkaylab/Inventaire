# Les présentations Quantinvo

Trois présentations PowerPoint, générées par trois scripts qui partagent une
même charte (`charte.js`). Fond blanc, règle « Papier » de la charte v1.1 :
encre en texte, indigo profond pour les titres, indigo en accent, et le cyan
réservé à la ligne de scan sous l'en-tête.

| Script | Fichier produit | Pour qui | Pages |
|---|---|---|---|
| `build.js` | `Quantinvo-presentation.pptx` | Direction, achats : la présentation commerciale | 12 |
| `build-dsi.js` | `Quantinvo-dossier-DSI.pptx` | Direction informatique : architecture, hébergement, déploiement MDM, comptes, sécurité, RGPD | 12 |
| `build-prise-en-main.js` | `Quantinvo-prise-en-main.pptx` | Superviseurs et compteurs : le guide de prise en main | 15 |

## Générer

```
npm install pptxgenjs sharp
node build.js
node build-dsi.js
node build-prise-en-main.js
```

`FONT_MODE=brand node build.js` produit la variante `-marque` (Sora et Inter,
les polices de la charte), à présenter depuis un poste où elles sont
installées — celui de Julien. La version sans suffixe est en Arial : c'est
celle qu'on envoie, elle s'affiche à l'identique partout.

Les fichiers `.pptx` sont **générés, jamais retouchés à la main** : une
retouche serait écrasée à la prochaine génération. On modifie le script.

## Ce qui a été décidé en les écrivant (23 août 2026)

Julien : *« les decks ne doivent pas ressembler à une génération IA, pas
d'empreinte IA, ajoute de l'humanité »*. Un premier jet avait les tics du
genre : surtitres en capitales espacées, rangées de trois cartes identiques
avec une icône dans un rond, titres-slogans. Tout a été repris, et la charte
`charte.js` fixe le parti :

- **des pages de document, pas des grilles de cartes** — une colonne de
  titre à gauche, du texte courant à droite, des filets, un tableau
  avant / après, une grande citation. Aucune icône décorative ;
- **de vraies captures du produit**, recadrées depuis `web/screenshots/`
  (hors en-tête et hors nom du magasin d'essai). Elles sont réelles : si
  l'écran change, les captures se refont avec
  `npx playwright test screenshots` dans `web/`, et les recadrages
  (`capture(...)` en tête de chaque script) sont à vérifier ;
- **des pages qu'une machine n'écrit pas** : « D'où ça vient » (signée
  Julien), « Ce qu'on ne vous promet pas », « Ce qui n'existe pas encore »,
  « Quand ça ne se passe pas comme prévu ». Elles disent les limites avant
  qu'on les découvre ;
- **une voix** : « nous », des phrases courtes, des détails de terrain (la
  réserve sans réseau, le fichier à reformater, le mardi matin avant
  l'ouverture). Les notes du présentateur sont écrites pour être lues par
  Julien, pas pour être projetées.

## Ce qu'il faut savoir avant de modifier

- **La grille de l'offre** (deck commercial, page 11) suit la grille au
  volume de stock révisée le 21 août 2026 : 2 100 / 4 200 / 6 600 / 10 200 /
  14 400 € par an et par magasin, puis sur devis au-delà d'un million
  d'unités. Les noms de profil sont ceux de `web/lib/tarifs.ts` et de
  l'annexe 2 des CGV. Le volume se compte en **unités**, jamais en
  références. Le prix ne s'affiche plus sur le site côté client ; il reste
  dans le deck parce qu'on le présente en face à face, et au devis.
- **Le dossier DSI recopie des faits** de `deploiement-mdm.md` (identifiants,
  adresses réseau), de `docs/privacy.html` (sous-traitants) et d'AGENTS.md
  (audit, mots de passe, sessions). Si l'un bouge, la page correspondante
  bouge. Il dit aussi ce qui n'existe pas (SSO, AppConfig, Android, API,
  codes de secours TOTP) et qu'aucun test d'intrusion externe n'a été fait.
- **Le guide de prise en main décrit les écrans du code** : libellés
  « Compter des articles », « Auditer des articles », « Clôturer la
  balise », « Revenir sur une balise », « Rejoindre un inventaire », les
  onglets Suivi / Set up / Écarts d'audit / Rapport / Équipe. Un libellé qui
  change dans l'application change ici. Les deux téléphones dessinés
  (page 12) sont des schémas, pas des captures : il n'existe pas de capture
  de l'application mobile dans le dépôt.
- **Contact** : `contact@quantinvo.com` partout, jamais l'adresse Gmail.
- Les couleurs et le logo sont ceux de `web/app/globals.css` et de
  `web/components/Logo.tsx` : si la charte bouge, reprendre `charte.js`.
