# Quantinvo On-Demand — la conception

⚠️ **CES DOCUMENTS SONT LA CONCEPTION, PAS L'ÉTAT DU PRODUIT.** Une première
tranche a été construite le 20 septembre 2026 sur la branche `on-demand` —
préversion uniquement, huit migrations en fichiers dont aucune n'est appliquée.
**Ce qui est fait, ce qui ne l'est pas, et les endroits où le code contredit ces
documents : `docs/notes/106`.** Trois corrections y sont notées, dont les
coefficients de prix, qui partent à 1,00 et non aux valeurs annoncées ici.

Le principe : une entreprise réserve un inventaire réalisé par une équipe
Quantinvo, avec **un prix affiché tout de suite et pas de devis**. C'est une
seconde activité à côté de Quantinvo OS, l'abonnement logiciel — le même compte
donne accès aux deux, ou à une seule.

## La maquette

Trente-cinq planches, cliquables :
https://claude.ai/artifact/BSqAQUPZ7tnjAfdswK35MV

Le tunnel client de bout en bout, les branches qui décident du concept (adresse
non desservie, créneau complet, annulation), le compte et les établissements,
le parcours de l'inventoriste sur son téléphone, et le back-office.

## Les documents

| | |
|---|---|
| [01 — comptes et droits](01-comptes-et-droits.md) | identité, entitlements, accès temporaire à un inventaire, machine d'état, et ce que Quantinvo fait déjà |
| [02 — le prix](02-le-prix.md) | le modèle, les réglages, l'exemple calculé pas à pas |
| [03 — matching et score](03-matching-et-score.md) | constituer une équipe, mesurer, et l'article 22 |
| [04 — économie et TVA](04-economie-et-tva.md) | ce qu'une mission laisse, et la sortie de la franchise |
| [05 — notifications](05-notifications.md) | ce qu'on envoie, à qui, par quel canal |
| [06 — annulations](06-annulations.md) | des deux côtés, et ce que ça coûte |
| [07 — par où on commence](07-par-ou-on-commence.md) | l'ordre, et ce qui ferait tout arrêter |

## Les quatre choses à régler avant d'écrire du code

1. **Le statut des inventoristes** — indépendants payés par Quantinvo. Le
   contrat doit être une prestation de résultat, pas une fourniture d'heures.
   Validation juridique nécessaire.
2. **La TVA** — On-Demand fait sortir Quantinvo de la franchise vers la
   quarantième mission, et l'abonnement OS en sort avec. Décision comptable.
3. **Stripe Connect** — onboarding, clé, second endpoint de webhook, et les
   deux documents de conformité à mettre à jour.
4. **Le lancement en cours** — On-Demand ne commence pas avant que Quantinvo OS
   ait été vendu au moins une fois.

## Le chiffre qui sert d'exemple partout

Paris Rivoli, textile, 600 m², tranche 10 000 à 20 000 articles, 20:00 :

```
20 000 articles ÷ 800 à l'heure = 25 h-personne
25 h ÷ 6 inventoristes = 4 h 10 → arrondi à 4 h 30 (c'est la marge)
6 × 90 € + 126 € = 666 € versés à l'équipe
+ 46 € de frais = 712 € de coût
÷ 0,75 (marge cible 25 %) = 949 € affichés
949 − 712 = 237 € pour Quantinvo, soit 25,0 %
```

⚠️ Ces nombres apparaissent sur les planches ET dans les documents. S'ils
divergent un jour, c'est qu'on a changé un réglage à un seul endroit.
