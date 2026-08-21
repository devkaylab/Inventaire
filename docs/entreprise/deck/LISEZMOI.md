# Deck de vente Quantinvo

`build.js` génère la présentation commerciale en PowerPoint — neuf
diapositives : couverture, le problème, la solution, le parcours en quatre
étapes, les quatre piliers, le paysage concurrentiel, la confiance (RGPD),
l'offre, et l'appel à l'action.

## Générer

```
npm install pptxgenjs react-icons react react-dom sharp
node build.js                 # Quantinvo-presentation.pptx        (Arial)
FONT_MODE=brand node build.js # Quantinvo-presentation-marque.pptx (Sora/Inter)
```

**Deux variantes, et c'est voulu.** La version Arial s'envoie par e-mail :
elle s'affiche à l'identique sur l'ordinateur d'un prospect. La version
« marque » utilise Sora et Inter, les polices de la charte, et sert à
présenter depuis un poste où elles sont installées (celles de Julien le
sont, dans ~/Library/Fonts).

## À reprendre

- **Le fond est sombre.** La charte v1.1 (21 août 2026) impose le **fond
  blanc** pour tout document qu'on imprime, signe ou projette — voir la
  palette « Papier ». Ce deck est donc à refaire en blanc s'il est repris.
- Les tarifs de la diapositive « L'offre » suivent la grille au volume de
  stock, révisée le 21 août 2026 : 2 100 / 4 200 / 6 600 / 10 200 / 14 400 €
  par an et par magasin, puis sur devis au-delà d'un million d'unités. Ces
  montants sont les anciens (1 200 / 2 400 / 3 900 / 6 000 / 8 400) regonflés
  de la fiscalité — voir la note de grille dans la mémoire du projet : ils
  laissent le montant d'origine **net en poche**, une fois l'IS et la flat tax
  payés. Le volume se
  compte en **unités** (pièces physiques), jamais en références. Cinq paliers
  au lieu de quatre : la diapositive porte donc cinq cartes, plus étroites.

Les couleurs et le logo sont recopiés de `web/app/globals.css` et de
`web/components/Logo.tsx` : si la charte bouge, les reprendre ici.
