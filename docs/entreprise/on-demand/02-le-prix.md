# Quantinvo On-Demand — le prix

*Document de conception, 20 septembre 2026. Rien n'est construit.*
Couvre les points 11, 12, 13 et 38 du plan.

---

## 1. La promesse, et ce qu'elle interdit

Le client voit **un prix, tout de suite, sans devis**. Trois conséquences qui
ferment des portes :

- **le calcul ne peut pas dépendre de nous.** Si le prix demandait un arbitrage
  humain, ce serait un devis déguisé. Le moteur doit rendre un montant à chaque
  fois, ou refuser franchement (hors zone, hors créneau) ;
- **le prix ne bouge plus après réservation.** Il est verrouillé sur la mission,
  pas recalculé à l'affichage ;
- **le calcul vit en base.** Le navigateur affiche ce que le serveur a calculé.
  Même règle que `prix_offre` / `finaliser_inscription` : laisser le client
  porter un montant, c'est le laisser réserver à un centime.

---

## 2. Le modèle, en cinq pas

### 1) Ce qu'il y a à compter

On retient **le haut de la tranche déclarée**, jamais le milieu. Un prix ferme
se calcule sur le cas le plus lourd que le client a lui-même annoncé —
c'est ce qui permet de ne pas revenir vers lui.

### 2) Combien d'heures-personne

```
heures-personne = articles retenus ÷ productivité retenue
```

La **productivité retenue** est un réglage (800 articles/heure au départ). Elle
doit rester **en dessous** de ce que font les bons inventoristes : le score d'un
Expert tourne autour de 814 articles/heure, et une productivité de planification
calée sur les meilleurs produit des missions systématiquement en retard.

⚠️ Elle dépend du secteur et du code-barres. Un stock partiellement non
code-barré se compte à la main, référence par référence — c'est le coefficient
le plus lourd du modèle.

### 3) Combien de personnes, et combien de temps

L'équipe se déduit d'une **durée cible** (4 h 30 : au-delà, la précision chute
et les gens partent). Puis :

```
inventoristes = arrondi SUPÉRIEUR de (heures-personne ÷ durée cible)
durée         = heures-personne ÷ inventoristes, arrondie à la demi-heure SUPÉRIEURE
```

⚠️ **L'arrondi EST la marge de sécurité, et il n'en faut pas d'autre.** Ajouter
en plus un pourcentage de sécurité sur la durée, c'est payer deux fois la même
prudence et sortir du marché.

**Un responsable est ajouté dès trois inventoristes.** En dessous, personne ne
contrôlerait les écarts sur place — et c'est Quantinvo qui répond de la qualité,
pas le magasin.

### 4) Ce que ça coûte

```
équipe = (inventoristes × taux inventoriste + taux responsable) × durée
coût   = équipe + frais fixes par mission
```

Les **frais fixes par mission** couvrent la commission Stripe sur
l'encaissement, les frais de versement Connect, et les coûts d'exploitation
rapportés à une mission.

⚠️ **La rémunération est un taux horaire plat.** Les coefficients ci-dessous
jouent sur le PRIX, pas sur la paie : un inventoriste est payé pareil pour la
même durée, et c'est ce qui rend sa rémunération annonçable avant qu'il
accepte.

### 5) Le prix

```
prix = coût ÷ (1 − marge cible), × coefficients, arrondi à l'euro
```

Refus si le résultat passe sous la **marge minimum** : mieux vaut ne pas servir
une mission que la servir à perte.

---

## 3. L'exemple, calculé pas à pas

Paris Rivoli, textile, 600 m² de vente, tranche « 10 000 à 20 000 articles »,
mercredi 20:00, stock entièrement code-barré.

| | |
|---|---|
| Articles retenus (haut de tranche) | 20 000 |
| Productivité retenue | 800 articles/heure |
| Heures-personne | 20 000 ÷ 800 = **25 h** |
| Équipe (durée cible 4 h 30) | **6 inventoristes + 1 responsable** |
| Durée | 25 ÷ 6 = 4 h 10 → arrondie à **4 h 30** |
| Rémunération d'un inventoriste | 20 €/h × 4,5 = **90 €** |
| Rémunération du responsable | 28 €/h × 4,5 = **126 €** |
| Versé à l'équipe | 6 × 90 + 126 = **666 €** |
| Frais fixes par mission | **46 €** |
| Coût | **712 €** |
| Marge cible | 25 % |
| Prix | 712 ÷ 0,75 = 949,33 → **949 €** |
| Marge réelle | 237 ÷ 949 = **25,0 %** |

⚠️ **LE PLAN DONNAIT 660 € D'ÉQUIPE, 40 € DE FRAIS, 249 € ET 26,2 %.** Ces
quatre nombres sont cohérents entre eux, mais **ils ne sortent d'aucun taux
horaire rond** : six inventoristes et un responsable payés 4 h 30 à 20 et
28 €/h font 666 €, pas 660 €. La chaîne ci-dessus est calée sur les taux, parce
que ce sont eux qui existeront pour de vrai — et les frais fixes à 46 € font
retomber le prix affiché exactement sur 949 €. Si tu préfères garder 660 €,
c'est le taux horaire qui doit descendre à 19,80 €, et il faudra l'assumer sur
la fiche de paie.

---

### Les quatre magasins de la maquette, par la même chaîne

| Magasin | Articles retenus | Équipe | Durée | Versé | Coût | Prix |
|---|---|---|---|---|---|---|
| Lille Centre | 10 000 | 3 + 1 | 4 h 30 | 396 € | 442 € | **589 €** |
| Paris Rivoli | 20 000 | 6 + 1 | 4 h 30 | 666 € | 712 € | **949 €** |
| Lyon Part-Dieu | 20 000 | 6 + 1 | 4 h 30 | 666 € | 712 € | **949 €** |
| Paris Haussmann | 30 000 | 9 + 1 | 4 h 30 | 936 € | 982 € | **1 309 €** |

La marge ressort à 25,0 % sur les quatre : c'est un réglage, pas une variable.
Ce qui bouge d'un magasin à l'autre, c'est le volume — donc l'équipe, donc le
prix. Total des quatre, pour une réservation groupée : **3 796 €**.

---

## 4. Les réglages, et ce qu'ils font

| Réglage | Départ | Ce qu'il touche |
|---|---|---|
| Taux inventoriste | 20 €/h | la paie et le coût |
| Taux responsable | 28 €/h | la paie et le coût |
| Productivité retenue | 800 art./h | la durée et l'équipe |
| Durée cible | 4 h 30 | la taille de l'équipe |
| Frais fixes par mission | 46 € | le coût |
| Marge cible | 25 % | le prix |
| Marge minimum | 22 % | le refus de servir |
| Coefficient secteur | textile 1,00 · cosmétique 1,15 | le prix |
| Coefficient géographique | Paris et petite couronne 1,10 | le prix |
| Coefficient horaire | démarrage après 22 h 1,25 | le prix |
| Coefficient week-end | dimanche 1,40 | le prix |
| Stock non code-barré | 1,35 | le prix |
| Arrondi | à l'euro | l'affichage |

⚠️ **Ces valeurs vivent en base, pas dans le code**, et chaque changement est
daté et signé dans `admin_audit_log` — comme toute action d'administration sur
ce projet. Un prix est une décision commerciale ; il ne doit pas demander un
déploiement.

⚠️ **Un changement de réglage ne touche jamais une mission déjà réservée.** Le
prix verrouillé l'est pour de bon, sinon « le prix affiché est le prix payé »
ne veut plus rien dire.

---

## 5. Quand le prix a le droit de bouger

Une seule fois, et avant de commencer : **si le magasin trouvé sur place n'est
pas celui qui a été décrit.** Deux fois plus de stock, une réserve fermée, un
rayon en vrac malgré l'engagement signé à l'étape 3.

Le déroulé, et il n'y en a pas d'autre :

1. le responsable sur place constate et le signale depuis son écran ;
2. Quantinvo recalcule et appelle le client **avant** le premier scan ;
3. le client accepte le nouveau prix, ou annule sans frais.

⚠️ **Jamais après.** Un prix révisé à la clôture, c'est un litige, et c'est la
promesse du produit qui tombe.

---

## 6. Ce qui reste ouvert

- **La productivité par secteur** n'a aucune mesure réelle : les 800
  articles/heure sont une hypothèse. Les premières missions doivent la
  corriger, et le modèle doit pouvoir être recalé sans redéploiement.
- **La durée annoncée engage** vis-à-vis du client comme de l'inventoriste
  (qui est payé dessus). Une mission qui déborde coûte à Quantinvo : c'est
  voulu, c'est ce qui force à ne pas sous-estimer.
- **Le prix plancher** : en dessous d'un certain volume, une équipe de deux
  personnes pour deux heures reste plus chère que ce qu'un petit commerce
  acceptera. La question « à partir de quelle taille sert-on ? » n'est pas
  tranchée.

---

## La seconde formule : le logiciel seul (20 septembre 2026)

⚠️ **ELLE EST NÉE D'UN CONTRESENS**, relevé par Julien : la page « À la
demande » envoyait « vous, avec votre équipe » vers **l'abonnement annuel**.
Quelqu'un qui compte une fois par an n'a aucune raison d'acheter douze mois de
logiciel — et le lui proposer sur la page « à la demande », c'est lui proposer
l'inverse de ce qu'il est venu chercher. « Il peut y aller directement par
l'offre quantinvo » s'il veut l'abonnement.

D'où `missions.formule`, qui vaut `equipe_quantinvo` ou `logiciel_seul`. Même
réservation, même prix ferme, même annulation.

### Le dimensionnement ne change pas

Articles → heures-personne → nombre de personnes → durée : **mot pour mot la
même chaîne**. C'est ce qui rend les deux prix comparables sur la même page, et
c'est ce que Julien a demandé — « tarifs sur les mêmes critères on demand mais
sans les compteurs ».

Ce qui change commence au coût :

```
appareils = personnes + (un qui encadre, dès trois)
licence   = appareils × tarif appareil
prix      = licence + frais fixes logiciel, arrondi à l'euro
```

### Les deux réglages

| | | pourquoi |
|---|---|---|
| Tarif par appareil | **16 €** | Advanced vaut 310 € par mois pour 20 appareils, soit 15,50 € l'appareil. Seize euros, c'est « un mois d'abonnement ramené aux appareils dont votre inventaire a besoin » — une phrase qui se défend devant un client. |
| Frais fixes logiciel | **19 €** | ⚠️ **PAS LES 46 € DE L'ÉQUIPE.** Ceux-là couvrent la commission Stripe, **les frais de versement Connect** et l'exploitation. Sans équipe, il n'y a personne à payer : pas de Connect, pas de constitution d'équipe, pas de contrôle qualité sur place. |

⚠️ **LE LOGICIEL NE PASSE PAS PAR LA MARGE CIBLE.** Son prix EST la somme de la
licence et des frais. Le diviser par 0,75 reviendrait à inventer un coût pour
le majorer — exactement ce que « le prix affiché est le prix payé » interdit de
faire dans le dos du client.

### Ce que ça donne

| Articles | Appareils | À la carte | Avec notre équipe |
|---|---|---|---|
| 2 000 | 1 | **35 €** | 128 € |
| 5 000 | 2 | **51 €** | 248 € |
| 10 000 | 4 | **83 €** | 589 € |
| 20 000 | 7 | **131 €** | 949 € |
| 30 000 | 10 | **179 €** | 1 309 € |
| 50 000 | 15 | **259 €** | 1 909 € |
| 100 000 | 29 | **483 €** | 3 589 € |

Deux inventaires de 20 000 articles dans l'année : **262 €**, contre 3 300 €
d'abonnement Advanced. C'est assumé — un client qui compte deux fois par an
n'aurait jamais pris l'abonnement. Celui qui compte toute l'année, lui, le
prend : dès le troisième inventaire l'abonnement repasse devant, et la page le
dit.

### Trois refus tombent avec l'équipe, et ils tombent par nécessité

| Refus | Avec équipe | Logiciel seul | Pourquoi |
|---|---|---|---|
| Hors zone | `hors_zone` | **accepté** | Nous ne savons pas envoyer six personnes à Bordeaux ; le logiciel y marche. Refuser une licence sur un code postal, c'est refuser de vendre ce qu'on sait livrer. |
| Moins de 48 h | `trop_tot` | **accepté** | Le délai existe pour constituer une équipe. Sans équipe, il n'empêche que de servir quelqu'un qui compte ce soir. |
| Coefficients | appliqués | **aucun** | Secteur, horaire, dimanche, code-barres décrivent tous la pénibilité du **travail humain**. Le logiciel coûte la même chose un dimanche à 23 h qu'un mardi à 10 h. |

Une date passée reste refusée dans les deux formules.

### Et la machine d'état le sait

Une mission sans équipe n'a pas d'étape de constitution d'équipe :
`confirmee → prete` directement, et `terminee → payee` sans
`paiement_prestataires` — il n'y a personne à proposer, personne à attendre,
personne à payer. `admin_proposer_mission` **refuse** d'affecter un inventoriste
à une mission `logiciel_seul` : envoyer six personnes chez quelqu'un qui a
acheté une licence serait une intrusion, et Quantinvo paierait des gens pour un
travail que personne n'a commandé.

Mesuré par `scripts/replique/60-a-la-carte.sql`, gardé par
`web/tests/prix-on-demand.test.ts`.
