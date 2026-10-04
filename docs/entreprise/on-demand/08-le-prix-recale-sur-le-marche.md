# On-Demand — le prix, recalé sur le marché

*Simulation demandée par Julien le 28 septembre 2026. **Rien n'est codé.***
Prolonge `02-le-prix.md`, qu'il contredit sur trois points.

Les deux repères viennent de Julien, qui vient du métier :

- **le marché facture à la pièce** — 220 000 unités ≈ 22 000 € chez un
  prestataire lambda, **quelle que soit la durée**. Soit **0,10 € la pièce** ;
- **un inventoriste moyen fait 500 articles/heure.** Certains vont plus vite,
  beaucoup vont moins vite ;
- **un inventoriste doit toucher au minimum 125 € net pour 7 h.**

---

## 1. L'écart : nous sommes deux à trois fois sous le marché

Le modèle en vigueur, passé sur huit volumes, contre 0,10 €/pièce :

| Volume | Notre prix | €/pièce | Marché | Écart |
|---|---|---|---|---|
| 2 000 | 128 € | 0,064 € | 200 € | −36 % |
| 5 000 | 248 € | 0,050 € | 500 € | −50 % |
| 10 000 | 589 € | 0,059 € | 1 000 € | −41 % |
| 20 000 | 949 € | 0,047 € | 2 000 € | −53 % |
| 30 000 | 1 309 € | 0,044 € | 3 000 € | −56 % |
| 50 000 | 1 909 € | 0,038 € | 5 000 € | −62 % |
| 100 000 | 3 589 € | 0,036 € | 10 000 € | −64 % |
| 220 000 | 7 669 € | 0,035 € | 22 000 € | **−65 %** |

⚠️ **Le défaut n'est pas que les prix soient bas : c'est qu'ils BAISSENT à la
pièce quand le volume monte** — 0,064 € à 2 000 articles, 0,035 € à 220 000.
Plus le client est gros, moins on gagne par unité comptée. Le marché fait
l'inverse, ou au mieux tient son prix.

C'est mécanique, et c'est le modèle « coût + marge » qui le produit : les frais
fixes (46 €) se diluent, et rien d'autre ne monte avec le volume. **Aucun
réglage ne corrige ça** — il faut changer la formule.

---

## 2. Trois causes, dans l'ordre d'importance

### a) La productivité à 800 articles/heure planifie sur des experts

`02-le-prix.md` pose sa propre règle : la productivité retenue « doit rester
**en dessous** de ce que font les bons inventoristes », et cite l'Expert à
« 814 articles/heure ». **800 est à 1,7 % de l'Expert.** La règle est écrite,
et le réglage la viole.

Le repère de Julien est **500**. L'écart n'est pas cosmétique : il multiplie
par 1,6 les heures-personne, donc l'équipe, donc le coût.

À elle seule, cette correction remonte le prix de 7 669 € à 11 989 € sur
220 000 articles — de −65 % à −46 % du marché.

⚠️ Et elle a un effet que le prix ne montre pas : **les missions actuelles sont
sous-dimensionnées**. Une équipe calée sur 800 et qui compte à 500 finit en
retard de 60 %. Le document le dit lui-même : « une productivité de
planification calée sur les meilleurs produit des missions systématiquement en
retard ». Le réglage produit exactement ce qu'il annonce éviter.

### b) La durée cible de 4 h 30 rend le plancher de paie ruineux

Avec 500 articles/heure, un taux de 20 €/h et un plancher de 125 €, voici ce
qu'un compteur coûte **par pièce comptée** :

| Durée | Pièces comptées | Payé | Coût à la pièce |
|---|---|---|---|
| 3 h | 1 500 | 125 € | 0,083 € |
| 4 h 30 | 2 250 | 125 € | 0,056 € |
| 5 h | 2 500 | 125 € | 0,050 € |
| **6 h 15** | **3 125** | **125 €** | **0,040 €** |
| 7 h | 3 500 | 140 € | 0,040 € |
| 8 h | 4 000 | 160 € | 0,040 € |

⚠️ **Le plancher de 125 € et le taux de 20 €/h se croisent à 6 h 15.** En
dessous, on paie le déplacement et pas le comptage : à 4 h 30, la
main-d'œuvre coûte **39 % plus cher à la pièce** qu'à 6 h 15. Au-dessus, le
coût à la pièce est plat — l'heure supplémentaire est neutre.

**Donc : ou bien on garde 4 h 30 et on assume de payer 27,80 €/h, ou bien on
passe à des missions de 7 h et le plancher devient indolore.** `02-le-prix.md`
justifie 4 h 30 par la précision (« au-delà, la précision chute et les gens
partent »). Les deux positions sont défendables — mais elles ne coûtent pas la
même chose, et c'est un arbitrage, pas un réglage.

### c) « Coût + marge » ne sait pas où est le marché

Le prix se calcule aujourd'hui sur notre structure de coûts. Celle d'un
concurrent est différente, et c'est pourtant à lui que le client nous compare —
**à la pièce**, parce que c'est la seule unité que les deux devis partagent.

---

## 3. Ce que 220 000 articles révèle

Le volume que Julien cite **ne passe pas dans le modèle** :

- 220 000 ÷ 500 = **440 heures-personne** ;
- à 4 h 30 par mission : **98 inventoristes en même temps** ;
- à 7 h : **63**.

Aucune des deux n'est une équipe qu'on constitue. Un inventaire de cette taille
se fait **sur plusieurs jours, ou plusieurs vagues** — et le modèle n'a ni
l'une ni l'autre notion.

⚠️ **Les tranches s'arrêtent d'ailleurs à 100 000 articles** (`TRANCHES_ARTICLES`,
tranche `g`). Le cas de 220 000 n'est pas seulement mal tarifé : il n'est pas
saisissable.

---

## 4. La proposition — le prix à la pièce, avec un plancher

```
prix = max( plancher , tarif à la pièce × articles retenus ) × coefficients
```

Le coût ne sert plus à fabriquer le prix : il sert à **refuser** la mission si
la marge tombe sous le minimum. C'est son vrai rôle.

**Réglages proposés**, les changements en gras :

| Réglage | Aujourd'hui | Proposé |
|---|---|---|
| Productivité retenue | 800 art./h | **500 art./h** |
| Durée cible | 4 h 30 | **7 h** |
| Taux inventoriste | 20 €/h | 20 €/h |
| **Plancher de rémunération** | *aucun* | **125 € par mission** |
| Taux responsable | 28 €/h | 28 €/h (plancher 175 €) |
| Responsable à partir de | 3 inventoristes | **5** |
| **Tarif à la pièce** | *n'existe pas* | **0,085 €** |
| **Prix plancher** | *n'existe pas* | **290 €** |
| Marge cible | 25 % | *supprimée* |
| Marge minimum | 22 % | 22 % (refus) |

Ce que ça donne :

| Volume | Équipe | Durée | Payé/compteur | Coût | **Prix** | Marge | Marché |
|---|---|---|---|---|---|---|---|
| 2 000 | 1 | 4 h | 125 € | 171 € | **290 €** | 41 % | 200 € |
| 5 000 | 2 | 5 h | 125 € | 296 € | **425 €** | 30 % | 500 € |
| 10 000 | 3 | 7 h | 140 € | 466 € | **850 €** | 45 % | 1 000 € |
| 20 000 | 6+1 | 7 h | 140 € | 1 082 € | **1 700 €** | 36 % | 2 000 € |
| 30 000 | 9+1 | 7 h | 140 € | 1 502 € | **2 550 €** | 41 % | 3 000 € |
| 50 000 | 15+1 | 7 h | 140 € | 2 342 € | **4 250 €** | 45 % | 5 000 € |
| 100 000 | 29+1 | 7 h | 140 € | 4 302 € | **8 500 €** | 49 % | 10 000 € |

**15 % sous le marché partout**, sauf sous 3 400 articles où le plancher prend
le relais. Une remise annonçable — « 15 % moins cher, et vous voyez le rapport
en direct » — au lieu d'un prix deux fois plus bas, qui fait douter.

⚠️ **Le plancher de 290 € est la réponse à « un compteur ne se déplacerait pas
pour si peu ».** Il couvre 125 € de paie, 46 € de frais, et laisse 41 %. Sous
2 000 articles, c'est le même prix : on ne vend pas un déplacement moins cher
que ce qu'il vaut.

⚠️ **Le responsable passe de 3 à 5 inventoristes.** À 3, il représente 30 % de
l'équipe et creuse un trou de marge à 10 000 articles (22 %, soit le minimum de
refus). À 5, la marge ne descend plus sous 30 %.

---

## 5. Le logiciel seul — la question qu'on ne pose pas

**Le nombre d'appareils n'est jamais demandé : il est DÉDUIT du volume
d'articles.** C'est la remarque de Julien, et elle a deux conséquences
opposées :

| Volume déclaré | Appareils déduits | Prix | Ce qu'une équipe de 6 devrait payer |
|---|---|---|---|
| 2 000 | 1 | 35 € | 115 € |
| 5 000 | 2 | 51 € | 115 € |
| 10 000 | 4 | 83 € | 115 € |
| 20 000 | 7 | 131 € | 115 € |

Un magasin de 2 000 articles qui mobilise six personnes paie **un** appareil.
Un magasin de 20 000 qui compte à deux en paie **sept**. Dans les deux cas le
prix ne décrit pas ce qui est vendu — **et l'assiette de tout Quantinvo est le
nombre d'appareils qui comptent en même temps** (`offres.ts`). La question
manque.

**Grille proposée** — l'appareil demandé, plancher 89 €, **plafonné au mois
d'abonnement du palier qui couvre ces appareils** :

```
logiciel = min( max(89 €, 25 € × appareils + 39 €), prix mensuel du palier )
```

| Appareils | Aujourd'hui | Proposé | 1 mois d'abonnement |
|---|---|---|---|
| 1 | 35 € | **89 €** | 89 € |
| 2 | 51 € | **89 €** | 89 € |
| 3 | 67 € | **114 €** | 310 € |
| 6 | 115 € | **189 €** | 310 € |
| 10 | 179 € | **289 €** | 310 € |
| 20 | 339 € | **310 €** | 310 € |

⚠️ **Le plafond n'est pas une coquetterie.** Sans lui, 20 appareils coûteraient
539 € en ponctuel contre 310 € pour un mois d'Advanced : le client prendrait
l'abonnement, et le ponctuel deviendrait un piège au lieu d'une porte d'entrée.
Le prix ponctuel ne doit **jamais** dépasser le mois qui le couvre.

⚠️ **Et « à partir de 35 € » devient « à partir de 89 € »**, en face de « à
partir de 290 € » pour l'équipe. Les deux chiffres racontent enfin la même
histoire : 89 € vous comptez, 290 € nous venons.

---

## 6. Ce qui doit être tranché avant de coder

1. ⚠️⚠️ **Les 20 €/h, c'est ce qu'on VERSE ou ce que le compteur GARDE ?**
   C'est la question la plus lourde de ce document, et elle n'est écrite nulle
   part. Si les inventoristes sont auto-entrepreneurs, verser 140 € leur laisse
   **109 € net** après cotisations — **sous le plancher de 125 €**. Pour qu'ils
   nettent 125 €, il faut leur verser **160 €**, soit **+14 % de coût**. En
   salariés (CDD d'usage), 125 € net coûtent plutôt **230 €** chargés, soit
   **+64 %** — et les marges du tableau ci-dessus perdent une quinzaine de
   points. **Tout le modèle bascule sur cette réponse.**
2. **4 h 30 ou 7 h ?** La précision contre 39 % de main-d'œuvre. `02-le-prix.md`
   a tranché pour 4 h 30 sans connaître le coût du plancher.
3. **0,085 € ou 0,10 € la pièce ?** À 15 % sous le marché on a un argument ; au
   prix du marché on gagne 59 % de marge sur les gros volumes et on n'a plus
   que le produit pour convaincre.
4. **Au-dessus de 100 000 articles**, il faut des vagues ou des journées
   multiples. Aujourd'hui c'est hors grille.

---

## 7. Ce que ce document NE dit pas

- **Aucune mesure réelle de productivité.** 500 est le repère de Julien, 800
  était une hypothèse. Les premières missions trancheront, et le réglage doit
  rester en base pour être corrigé sans déploiement.
- **Les 0,10 €/pièce sont un point, pas une courbe.** Ils viennent d'un cas à
  220 000 unités. Un prestataire facture probablement plus cher à la pièce sur
  2 000 articles — donc notre écart au marché est sans doute plus favorable
  qu'affiché sur les petits volumes.
- **La TVA n'est pas dans ces chiffres** — voir `04-economie-et-tva.md`.
