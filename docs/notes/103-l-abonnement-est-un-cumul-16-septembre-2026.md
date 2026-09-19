# L'abonnement est un cumul (16 septembre 2026)

Relu à la demande de Julien, et le défaut était réel — plus large que la note
du 11 septembre. **Une inscription à plusieurs magasins ouvre UN abonnement**
(Stripe refuse deux lignes au même Price) : une ligne par OFFRE, de quantité
égale au nombre de magasins, et UNE ligne de tranches pour tous. Les magasins
ainsi créés n'ont pas d'article à eux et retombent sur l'abonnement de
l'entreprise.

Le chemin d'API de `libre-service` prenait alors « la première ligne qui
n'est pas un supplément », **forçait sa quantité à 1** et **remplaçait la ligne
de tranches par celles du seul magasin** visé. Monter un magasin sur
« Advanced × 2 » faisait disparaître l'autre de la facture, en silence.

**Corrigé par `_shared/cumul.ts`**, module pur testé depuis le site :
`ecartAbonnement` retire UNE unité à l'offre actuelle du magasin (lue sur
`stores.devices` via `prix_offre`, jamais devinée sur les lignes), en ajoute
une à la nouvelle, et ajuste la ligne de tranches de l'ÉCART. Un seul
`POST /v1/subscriptions/{id}` (`modifierAbonnement`), donc une seule facture de
prorata.

- **⚠️ Il refuse plutôt que deviner** : si l'abonnement ne porte pas l'offre
  actuelle du magasin, ou moins de tranches qu'on veut en retirer, rien n'est
  envoyé à Stripe.
- **⚠️ Le rythme se lit sur l'abonnement** (`rythmeDesArticles`) : Stripe
  refuse de mélanger mois et année, et changer l'échéance d'un abonnement en
  cours reste une opération jamais exercée. Un choix d'échéance différent à
  l'écran est refusé avec `code: 'rythme_abonnement'` et un message qui dit
  quoi choisir.
- **`stores.stripe_item_*` ne sert plus** au changement d'offre : une ligne
  appartient au cumul, jamais à un magasin. Les colonnes restent.
- `libre-service` redéployée (v12, `verify_jwt` vrai), trois fichiers
  identiques au dépôt. Les autres fonctions qui embarquent `stripe.ts` n'ont
  pas besoin d'être redéployées : les ajouts sont inertes pour elles.

⚠️ **NON ÉPROUVÉ CONTRE STRIPE** : il faut un abonnement à plusieurs lignes, donc
une inscription à plusieurs magasins — fermée tant que la vente l'est. Le
chemin à un seul magasin (ajout en libre-service puis montée d'offre) peut se
rejouer dès maintenant en mode test.

Tests de garde : `web/tests/libre-service.test.ts`, bloc « l'abonnement est un
cumul » (deux sabotages, deux échecs).
