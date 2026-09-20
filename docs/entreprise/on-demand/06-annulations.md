# Quantinvo On-Demand — quand quelqu'un se retire

*Document de conception, 20 septembre 2026. Rien n'est construit.*
Couvre les points 34 et 35 du plan.

---

## 1. Le principe

**Ce qui est facturé au client couvre ce qui est versé à l'équipe, plus ce qui
a été engagé.** Pas davantage. Une pénalité qui rapporte est une pénalité qu'on
finit par souhaiter — et le client le sent.

Et l'empreinte bancaire rend tout ça exécutable : le montant est déjà bloqué,
on ne réclame rien après coup (voir `01-comptes-et-droits.md`, la machine
d'état).

---

## 2. Le client annule

Sur l'exemple à 949 €, équipe de 6 + 1 payée 666 € :

| Quand | Facturé | Versé à l'équipe | Reste |
|---|---|---|---|
| Plus de 72 h avant | **0 €** | 0 € | 0 € |
| De 72 h à 24 h | **284 €** (30 %) | 67 € (10 % de la rémunération) | 217 € |
| Moins de 24 h | **474 €** (50 %) | 200 € (30 %) | 274 € |
| L'équipe est sur place | **949 €** (100 %) | 666 € (tout) | 237 € |

⚠️ **Les pourcentages sont des réglages**, dans la même console que ceux du
prix, et chaque changement est daté dans le journal des actions.

⚠️ **Le dernier cas n'est pas une punition, c'est la réalité** : sept personnes
se sont déplacées la nuit. Elles sont payées entièrement, et Quantinvo ne gagne
rien de plus que sur une mission faite.

### Ce que le client voit

L'écran d'annulation affiche **le montant réel de sa réservation**, pas un
barème abstrait : « gratuite jusqu'au dimanche 27 septembre à 20:00 », puis les
trois lignes chiffrées en euros — arrondies à l’euro **inférieur**, en sa faveur. Et la phrase qui explique : *nous rémunérons
les inventoristes qui se sont rendus disponibles pour vous.*

⚠️ **Jamais un barème en pourcentages seuls.** « 30 % » ne veut rien dire au
moment de décider ; « 284 € » se comprend tout de suite.

---

## 3. Quantinvo annule

C'est le cas le plus grave, et il n'a qu'une règle : **le client n'est jamais
débité, et il est prévenu par téléphone.**

Il arrive quand l'équipe ne peut pas être constituée, ou tombe sous les trois
quarts de son effectif après désistements. La décision se prend **au plus tard
à H−4**, jamais le soir même.

⚠️ Ce chiffre est celui qu'on suit en priorité (voir `04-economie-et-tva.md`) :
un client annulé par le prestataire ne revient pas.

---

## 4. L'inventoriste se retire

| Quand | Effet sur le score | Autre |
|---|---|---|
| Plus de 72 h avant | faible | remplacement lancé aussitôt |
| De 72 h à 24 h | net | remplacement en priorité haute |
| Moins de 24 h | lourd | alerte d'exploitation immédiate |
| Il ne vient pas, sans prévenir | **très lourd** | suspension automatique du profil, revue humaine |

⚠️ **Le no-show n'est pas une annulation tardive, c'est autre chose.** Une
annulation, même tardive, laisse le temps de chercher. Ne pas venir laisse
l'équipe à cinq et le magasin ouvert.

⚠️ **La suspension automatique doit être revue par quelqu'un** — c'est une
décision qui coupe un revenu, donc le même régime que le score : explicable et
contestable (article 22, voir `03-matching-et-score.md`).

⚠️ **Une annulation pour raison de santé ou d'accident ne se traite pas comme
un désistement de confort.** Il faut un chemin pour le dire, et quelqu'un pour
en décider — sinon le score punit exactement les gens qu'on veut garder.

---

## 5. Ce que ça suppose côté argent

- **L'empreinte vaut jusqu'à la clôture.** Une autorisation bancaire expire
  (souvent sept jours) : pour une réservation prise trois semaines à l'avance,
  il faut la renouveler, ou déclencher le débit au moment de l'annulation
  facturable. À trancher avec Stripe en main, pas sur le papier.
- **Une annulation facturée est une vente** : elle porte une facture, et elle
  compte dans le chiffre d'affaires — donc dans le seuil de la franchise.
- **Un remboursement partiel** n'est pas une annulation : c'est un litige, et
  il passe par la console.

---

## 6. Ce qui reste ouvert

- Le délai de 72 h : à confronter au temps réel de constitution d'une équipe,
  qu'on ne connaît pas encore.
- L'indemnité de l'inventoriste quand le client annule : les 10 % et 30 % du
  tableau sont des hypothèses, pas des engagements.
- Le report plutôt que l'annulation — « je décale d'une semaine » est ce qu'un
  magasin demandera en premier, et ce n'est dessiné nulle part.
