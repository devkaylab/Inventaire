# Les huit Price Stripe, contrôlés un par un (4 et 5 septembre 2026)

Julien a recréé les six Price aux tarifs du 31 août et posé les six secrets.
Contrôle de bout en bout : six sessions Checkout ouvertes par la fonction
déployée (une par couple offre × rythme), et **le montant lu sur chaque page
de paiement** —

| | mensuel | annuel |
|---|---|---|
| Essential | 89,00 € | 950,00 € |
| Advanced | 310,00 € | 3 300,00 € |
| Enterprise | 890,00 € | 9 450,00 € |

⚠️ **C'est le montant affiché qui fait foi, pas le fait que la session s'ouvre.**
Une inversion mensuel/annuel ouvre une page tout aussi valide et facturerait
9 450 € par mois. C'est le contrôle du 30 août, refait à l'identique.

Deux constats au passage :

- **le compte est toujours en mode TEST** (`cs_test_…`, « Environnement de test
  Devkaylab ») : rien n'est encaissé pour de vrai tant que les clés `live` ne
  sont pas posées ;
- **aucune ligne de TVA sur les pages**, donc `STRIPE_TAX_RATE` n'est pas posé.
  Toléré en test, **refusé en live** par la fonction elle-même (`tva_absente`,
  503) — voir « La TVA : un taux fixe, et un garde-fou contre l'oubli ».

Données d'essai supprimées, **zéro résidu contrôlé** : 0 demande, 2 entreprises,
2 magasins — inchangés.
