# Synthèse de l'audit — support de présentation

`synthese-audit-2026-08.pptx` résume, à l'usage des **clients entreprises**,
l'audit RGPD / sécurité du 13 août 2026 : les 15 constats, ce qui est clos, ce
qui reste ouvert, et la répartition des responsabilités entre l'entreprise
cliente (responsable de traitement) et Devkaylab (sous-traitant).

Il est **généré**, pas édité à la main : `synthese-audit-2026-08.deck.js`
produit le fichier. Pour le mettre à jour, modifier le script puis :

```sh
node docs/conformite/synthese-audit-2026-08.deck.js
```

(le chemin de sortie est en fin de script ; `npm i pptxgenjs` si le module
manque). Éditer le `.pptx` directement fait diverger les deux — la prochaine
génération écraserait la retouche.

## Ce que le document engage

Chaque chiffre vient de `AGENTS.md` et du registre des traitements. **Trois
points sont volontairement dits tels quels**, parce qu'un client qui les
découvre après coup perd confiance bien plus qu'un client averti :

- les mentions légales ne sont pas encore activées (activité éditrice non
  immatriculée) ;
- le registre et les clauses de l'article 28 ne sont pas relus par un juriste,
  donc non opposables en l'état ;
- l'information des salariés, le CSE et l'AIPD relèvent du client, et ne sont
  pas faits.

**À mettre à jour dès que l'un de ces points bouge** — en particulier les
diapositives 3 (répartition chiffrée), 6, 7 et 10.
