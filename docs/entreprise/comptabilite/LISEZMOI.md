# Le livre de comptes

Un classeur Excel pour tenir les comptes de Devkaylab et sortir le bilan et le
compte de résultat d'un exercice **sans client** — celui qui se clôt le
**31 décembre 2026**. Demande de Julien, le 15 septembre 2026 : « je n'ai pas
envie de payer un comptable alors que nous n'avons pas de client. En revanche
on a déjà avancé des frais qu'il faudra déclarer. »

| Fichier | Quoi |
|---|---|
| `build-comptabilite.py` | le générateur |
| `Quantinvo-comptabilite-MODELE.xlsx` | le classeur vide, produit par le script |

## ⚠️ LE MODÈLE N'EST PAS LE LIVRE

Le script écrit un classeur **vide**. Le livre est une **copie** renommée, qui
vit **hors du dépôt** — il porte des montants, des fournisseurs et un solde
bancaire, et le dépôt n'est pas l'endroit pour ça.

C'est pour cette raison que le fichier produit porte `MODELE` dans son nom :
régénérer le modèle ne peut jamais écraser des écritures.

## Ce que le classeur fait, et ce qu'il n'est pas

Sept feuilles : mode d'emploi, journal, immobilisations, apports et trésorerie,
compte de résultat, bilan, plan de comptes. Les trois dernières se calculent
toutes seules à partir des trois premières.

⚠️ **Ce n'est pas un logiciel comptable**, et le mode d'emploi le dit à
l'ouverture. C'est une **tenue de trésorerie avec des catégories comptables**,
plus les écritures de clôture qu'un exercice sans client demande. Le régime réel
simplifié l'autorise : on tient la trésorerie en cours d'année, on passe les
écritures d'inventaire à la clôture. Il ne remplit pas la liasse fiscale — mais
ses chiffres s'y recopient.

## Les décisions qui le gouvernent

- **⚠️ Franchise en base de TVA : tout est en TTC.** Devkaylab ne facture pas de
  TVA (article 293 B, voir `web/lib/offres.ts`), donc elle ne la **récupère
  pas** non plus. La colonne « dont TVA » du journal est **informative** — elle
  servira le jour où la franchise tombera. Ne pas la brancher sur un calcul.
- **La catégorie commande tout.** On choisit un libellé français dans un menu ;
  le compte du plan comptable et la rubrique du compte de résultat s'en
  déduisent. Ajouter une catégorie = une ligne dans « Plan de comptes ».
- **⚠️ Au-delà de 500 € HT, ce n'est plus une charge.** Un ordinateur, un
  téléphone, s'inscrivent dans « Immobilisations » et s'amortissent — jamais
  dans le journal, qui les compterait une seconde fois. C'est l'erreur qui
  fausse le plus sûrement un bilan, et le mode d'emploi lui consacre un bloc.
- **⚠️ Les frais engagés AVANT l'immatriculation** ne sont repris par la société
  que s'ils figurent sur l'état des actes accomplis pour son compte. D'où la
  colonne « Avant immat. » : elle sert à les retrouver, pas à les valider.
- **Le contrôle du bilan est la pièce maîtresse.** Actif − Passif doit valoir
  zéro. Autre chose : il manque une écriture. C'est ce qui permet à quelqu'un
  dont ce n'est pas le métier de savoir que quelque chose cloche.

## ⚠️ Deux défauts trouvés en CALCULANT un exemplaire, pas en relisant le code

Les deux seraient passés inaperçus à la lecture, et les deux cassaient le
résultat. La vérification qui vaut : remplir un exemplaire d'essai, le faire
calculer par LibreOffice, et relire les nombres.

1. **La dotation aux amortissements se référençait elle-même** — elle se bornait
   au cumul, qui valait la dotation. Excel rendait `#VALEUR!`, et l'erreur se
   propageait jusqu'au résultat et au bilan.
2. **Une immobilisation avancée par Julien n'entrait pas dans son compte
   courant.** La feuille n'avait pas de colonne « Payé par » : le bilan ne
   tombait pas, d'un montant qui était exactement celui du Mac. C'est le
   contrôle Actif − Passif qui l'a dit.

Après correction, sur un jeu d'essai cohérent : dotation 698,35 € pour un Mac à
2 499 € mis en service le 1er mars, résultat −1 121,75 €, **contrôle à zéro**.

## Régénérer

`openpyxl` n'est pas installable sur le Python du système (PEP 668). Un
environnement isolé, une fois :

```bash
python3 -m venv ~/.venvs/compta && ~/.venvs/compta/bin/pip install openpyxl
~/.venvs/compta/bin/python build-comptabilite.py
```

⚠️ **Le classeur est généré, jamais retouché à la main** — même règle que les
decks. Une colonne ou une formule se change dans le script, qui réécrit le
modèle ; le livre, lui, garde ses écritures puisque c'est un autre fichier.
