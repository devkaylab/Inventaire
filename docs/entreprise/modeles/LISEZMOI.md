# Modèles de devis et de facture

Deux modèles sur **fond blanc**, conformes à la palette « Papier » de la
charte Quantinvo v1.1 (logo inchangé, ligne de scan cyan sous l'en-tête,
titres en indigo profond, chiffres tabulaires).

## Utiliser un modèle

1. Ouvrir `devis.html` ou `facture.html` dans Chrome ou Safari (double-clic).
2. Cliquer sur n'importe quel texte pour le modifier. Les valeurs entre
   crochets, en indigo, sont celles qui manquent tant que la société n'est
   pas immatriculée (capital, adresse, SIREN, RCS, TVA, IBAN).
3. Quantité et prix unitaire : taper un nombre, les totaux se recalculent.
4. Cmd + P, destination « Enregistrer au format PDF », marges « Aucune ».
   Le bandeau de mode d'emploi ne s'imprime pas ; le document tient sur une
   page A4.

`exemple-devis.pdf` et `exemple-facture.pdf` montrent le résultat attendu.

## Numérotation

Les factures doivent porter une numérotation **continue et sans trou**
(F-2026-0001, F-2026-0002…). Les devis suivent leur propre suite
(D-2026-0001…). Le jour où la facturation passera par Qonto ou Stripe, ce
sont eux qui numérotent : ne plus émettre de facture depuis ce modèle en
parallèle, pour ne pas casser la suite.

## Modifier le gabarit

Les deux fichiers sont produits par `generer.py` (en-tête, styles et pied
communs). Pour changer une règle commune, modifier le script puis :

    python3 docs/entreprise/modeles/generer.py docs/entreprise/modeles

Ne pas éditer `devis.html` et `facture.html` à la main pour une règle
commune, la prochaine génération l'écraserait.

## Date de péremption : la facture électronique

La réforme française impose d'émettre les factures B2B au format
électronique via une plateforme agréée à partir du **1er septembre 2027**
pour les PME et micro-entreprises (réception obligatoire pour toutes dès le
1er septembre 2026). Devkaylab ne vend qu'à des entreprises : à cette date,
`facture.html` ne produira plus une facture valable. Le modèle de devis,
lui, reste utilisable. Prévoir la facturation dans Pennylane ou Qonto (tous
deux plateformes agréées) avant cette échéance — et dès le départ si
l'expert-comptable travaille sur Pennylane.
