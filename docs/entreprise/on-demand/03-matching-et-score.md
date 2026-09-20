# Quantinvo On-Demand — constituer l'équipe, et mesurer

*Document de conception, 20 septembre 2026. Rien n'est construit.*
Couvre les points 21, 22, 23 et 35 du plan.

---

## 1. Ce que le client achète, et ce que ça impose

Le client n'achète pas six personnes : il achète un inventaire. Il ne choisit
personne, il ne voit personne. **C'est donc Quantinvo qui répond de l'équipe**,
et le matching n'est pas un marché — c'est une affectation.

Deux conséquences :

- **le refus d'un inventoriste ne remonte jamais au client.** Il voit « nous
  constituons votre équipe », puis « équipe complète ». Entre les deux, nos
  problèmes restent les nôtres ;
- **le client ne voit pas les noms.** L'écran de suivi dit « 3 inventoristes »
  et « le responsable », jamais qui. Une personne affectée à une mission n'a
  pas à être identifiable par le magasin où elle compte.

---

## 2. Le matching commence à la main, et c'est un choix

Au démarrage, l'administrateur voit une liste classée et propose. Pas
d'affectation automatique.

**Pourquoi** : un algorithme de matching se règle avec des données qu'on n'a
pas encore. Cinquante missions faites à la main donneront les vrais critères ;
cinquante missions faites par un algorithme deviné donneront cinquante
mauvaises équipes et aucune donnée exploitable.

**Ce que la machine fait déjà** : filtrer (disponible sur le créneau, dans le
rayon, vérifié, pas déjà pris), classer, et proposer en un geste aux quatre
premiers.

**Ce qu'elle ne fait pas** : décider.

---

## 3. Les critères, dans l'ordre où ils comptent

1. **Disponible sur le créneau** — déclaré dans son planning. Éliminatoire.
2. **Vérifié et payable** — profil validé et compte Stripe complet.
   Éliminatoire : affecter quelqu'un qu'on ne peut pas payer crée une dette et
   un litige.
3. **Distance** — au-delà du rayon qu'il a lui-même fixé, on ne propose pas.
4. **Secteur** — a déjà compté du textile, et mieux : a déjà compté **dans ce
   magasin**. C'est le critère le plus prédictif et le moins cher à calculer.
5. **Fiabilité** — ponctualité, taux d'annulation, no-show.
6. **Précision** — le seul critère de qualité mesurable objectivement.
7. **Niveau** — certaines missions ne s'ouvrent qu'aux niveaux supérieurs.

⚠️ **Une équipe entièrement composée de nouveaux ne part pas.** Au moins la
moitié de l'équipe doit avoir de l'expérience, et le responsable est toujours
un Expert. Sans cette règle, le matching optimisera la disponibilité et
produira une équipe qui n'a jamais compté ensemble.

---

## 4. Le score

Cinq mesures, toutes issues de ce que le produit sait déjà faire :

| Mesure | D'où elle vient |
|---|---|
| Précision | écarts constatés sur ses comptages après recomptage |
| Vitesse | articles comptés ÷ temps passé, déjà mesuré par l'app |
| Ponctualité | écart entre l'heure attendue et le pointage |
| Annulations | désistements après acceptation, pondérés par le délai |
| Contrôles qualité | recomptages qui confirment son premier comptage |

⚠️ **La vitesse ne doit jamais peser plus que la précision.** Un inventoriste
rapide et faux coûte plus cher qu'un lent et juste : ses écarts déclenchent des
recomptages, qui mangent la marge et retardent la clôture. Le score doit
refléter ça, sinon il sélectionne exactement le mauvais profil.

⚠️ **Un nouveau n'a pas de score, il n'a pas un mauvais score.** Afficher 0 ou
50 le condamnerait avant sa première mission. Les écrans montrent « — ».

---

## 5. Les niveaux

| Niveau | Ce qui l'ouvre |
|---|---|
| Nouveau | profil vérifié |
| Confirmé | 10 missions, précision ≥ 99 %, annulations < 5 % |
| Expert | 100 missions, précision ≥ 99,5 %, annulations < 2 % |
| Responsable | Expert, plus une formation et un accord explicite |

Les seuils sont des réglages, pas des constantes de code — comme les
coefficients de prix, et pour la même raison.

---

## 6. ⚠️ Le score est une décision automatisée

Un classement qui écarte quelqu'un d'une mission, et donc d'un revenu, **tombe
sous l'article 22 du RGPD** dès qu'il agit sans intervention humaine.

Ce que ça impose, et qui doit être construit avec le score, pas après :

- **l'expliquer** : l'inventoriste voit les cinq mesures, leurs valeurs, et ce
  qui ouvre le niveau suivant. C'est déjà ce que fait l'écran « Mon score » ;
- **le contester** : un bouton qui écrit à quelqu'un, et quelqu'un qui répond.
  « Si l'un vous paraît faux, écrivez-nous : quelqu'un le regarde » ;
- **le repêchage manuel** : l'administrateur doit pouvoir proposer une mission
  à quelqu'un que le filtre a écarté. L'écran de matching le permet ;
- **le dire** : une entrée au registre des traitements, et une mention dans les
  conditions du prestataire.

⚠️ Tant que le matching est manuel, l'article 22 ne mord pas — c'est un humain
qui décide. **Il mordra le jour de l'automatisation**, et c'est ce jour-là
qu'on ne voudra pas construire ces quatre choses dans l'urgence.

---

## 7. Le remplacement

Un désistement déclenche la recherche **immédiatement**, sans attendre une
décision humaine : le temps est la seule ressource qui manque à ce moment-là.

- **plus de 72 h avant** : on repropose normalement ;
- **moins de 24 h** : on élargit le rayon et on relâche le critère de secteur,
  jamais celui de la vérification ;
- **équipe incomplète au départ** : la mission part quand même si elle garde au
  moins les trois quarts de son équipe, avec la durée recalculée et le client
  prévenu. En dessous, c'est nous qui annulons, et le client n'est pas débité.

⚠️ **Ne jamais compléter une équipe avec quelqu'un qui n'a pas dit oui.** Un
inventoriste qu'on « assigne » sans acceptation ne viendra pas, et la mission
partira en croyant être complète.

---

## 8. Ce qui reste ouvert

- La pondération exacte des cinq mesures dans le score.
- Ce qui se passe quand deux missions se disputent la même personne le même
  soir — priorité à la plus ancienne, ou à la plus en danger ?
- La formation d'un responsable : contenu, durée, qui la donne.
