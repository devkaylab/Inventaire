# Quantinvo On-Demand — l'économie, et la TVA

*Document de conception, 20 septembre 2026. Rien n'est construit.*
Couvre le point 39 du plan, et le sujet qu'il ne mentionne pas.

---

## 1. Ce qu'une mission laisse

Sur l'exemple calculé dans `02-le-prix.md` :

| | |
|---|---|
| Payé par le client | 949 € |
| Versé à l'équipe | − 666 € |
| Frais fixes (Stripe, Connect, exploitation) | − 46 € |
| **Reste à Quantinvo** | **237 €** |
| **Marge** | **25,0 %** |

Ce que ça donne à l'échelle, à titre d'ordre de grandeur :

| Missions par mois | Encaissé | Marge brute |
|---|---|---|
| 10 | 9 490 € | 2 370 € |
| 30 | 28 470 € | 7 110 € |
| 100 | 94 900 € | 23 700 € |

⚠️ **La marge brute n'est pas le résultat.** Il en sort encore le temps passé à
constituer les équipes — qui est manuel au départ, et qui est le vrai coût
caché du modèle. Une mission qui demande quarante minutes de back-office mange
la moitié de ses 237 €. C'est l'automatisation du matching qui décide si
l'affaire tient, pas le prix.

---

## 2. ⚠️ On-Demand fait sortir Quantinvo de la franchise en base de TVA

C'est le point le plus lourd de tout le projet, et il n'est pas technique.

### L'état actuel, vérifié dans le code

`web/lib/offres.ts` porte `TVA_APPLICABLE = false`, et son commentaire dit
exactement ce qu'il commande : le taux appliqué par Stripe, ce que les pages
affichent, et la mention portée par les devis et les factures. Tant qu'il vaut
`false`, **le prix affiché EST le prix payé** — il n'y a ni HT ni TTC — et les
documents portent « TVA non applicable, article 293 B du CGI ».

### Pourquoi On-Demand casse ça

Le client paie **949 € à Quantinvo**, et Quantinvo paie **666 € aux
inventoristes**. Ce n'est pas une commission de 237 € : c'est un chiffre
d'affaires de 949 €, parce que le produit vendu est un inventaire réalisé par
Quantinvo — et cette qualification-là n'est pas négociable, c'est elle qui
protège du prêt de main-d'œuvre (voir `01-comptes-et-droits.md`).

Le seuil de la franchise pour une prestation de services est de l'ordre de
**37 500 €** de chiffre d'affaires annuel. **À 949 € la mission, il est franchi
vers la quarantième.** Une mission par semaine pendant neuf mois. Un seul mois
correct.

⚠️ Le seuil exact et ses tolérances doivent être confirmés par le comptable :
ils ont bougé récemment et ce document n'est pas une source fiscale.

### Ce que ça change, et ce n'est pas qu'On-Demand

Sortir de la franchise ne touche pas seulement la nouvelle activité :
**l'abonnement Quantinvo OS en sort aussi**, puisque c'est la même entreprise.

- `TVA_APPLICABLE` passe à `true` — un seul interrupteur, trois effets ;
- la grille publique (89, 310, 890 €) devient **HT**, et les pages doivent
  afficher le TTC au moment de payer ;
- `STRIPE_TAX_RATE` doit exister et être posé, et le refus de vendre en live
  sans lui — écrit en supposant que la TVA s'applique toujours — redevient
  pertinent ;
- la mention « TVA non applicable, article 293 B du CGI » disparaît des devis
  et des factures ;
- la TVA devient déductible sur les achats, ce qui joue dans l'autre sens.

⚠️ **Côté achats, il n'y a presque rien à déduire.** Les inventoristes
auto-entrepreneurs sont eux-mêmes en franchise : leurs factures ne portent pas
de TVA. Sur 949 € encaissés, on collecte 190 € de TVA et on n'en déduit
quasiment aucune. En B2B ce n'est pas un problème commercial — le client la
récupère — mais **ça change le prix affiché, et il faut le décider avant
d'afficher quoi que ce soit.**

### Ce qu'il faut trancher, et dans quel ordre

1. **Le comptable d'abord.** Seuil exact, moment du basculement, option
   volontaire pour la TVA dès le départ (qui évite un changement de prix en
   cours d'année, et qui est probablement le bon choix).
2. **Puis le prix affiché.** Ouvrir On-Demand en affichant des prix TTC dès le
   premier jour est plus simple que de les changer à la quarantième mission.
3. **Puis seulement le code.** `TVA_APPLICABLE`, le taux Stripe, les mentions.

---

## 3. Ce qu'on suit, en interne

| Indicateur | Définition |
|---|---|
| Encaissé | ce que les clients ont payé |
| Versé | ce qui est parti aux inventoristes |
| Frais | commissions Stripe, Connect, cartes |
| Marge brute | encaissé − versé − frais |
| Taux de marge | marge brute ÷ encaissé |
| Coût de constitution | temps de back-office par mission |
| Missions parties incomplètes | équipe réduite au départ |
| Missions annulées par nous | le seul chiffre qui tue le produit |

⚠️ **Le dernier compte plus que tous les autres.** Un client dont l'inventaire
est annulé par le prestataire ne revient pas, et il le raconte. Une marge à
25 % avec 5 % d'annulations vaut moins qu'une marge à 20 % avec zéro.

⚠️ Aucun de ces chiffres ne s'affiche côté client. Il achète un inventaire à
949 €, pas six rémunérations et une marge.

---

## 4. Ce qui reste ouvert

- Le **coût réel de constitution d'une équipe**, qui n'est mesurable qu'en en
  faisant. À mesurer dès la première mission, sinon le modèle reste une
  hypothèse.
- Le **délai de portage** : le client est débité à la clôture, les inventoristes
  sont payés le mercredi suivant. Si un jour le client paie à 30 jours, c'est
  Quantinvo qui avance 666 € par mission.
- Les **impayés** : un client dont l'empreinte bancaire échoue à la clôture.
  L'équipe, elle, a travaillé et doit être payée.
