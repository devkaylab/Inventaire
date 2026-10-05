# ⚠️⚠️ La location suit l'abonnement — 5 octobre 2026

> « Peux-tu me dire si nos prix ne sont pas un peu trop accessibles ? Je me dis
> 129 € pour 10/20 000 pièces, 6 appareils, ça semble peu crédible non ? »

Oui. Mais le défaut était plus grave que l'apparence.

## Le vrai problème : la location cassait l'abonnement

Six appareils, c'est **Advanced : 310 € par mois**, 3 300 € par an. On vendait
une semaine du **même produit** — zones, balises, audit, rapport — à **129 €**,
soit 2,4 fois moins qu'un seul mois.

Un magasin qui fait deux inventaires par an payait 258 € au lieu de 3 300 €. Il
lui aurait fallu **vingt-six réservations dans l'année** pour que s'abonner
redevienne intéressant. Personne ne fait vingt-six inventaires.

Les deux pages sont sur le même site : un client qui compare n'avait aucune
raison de s'abonner.

## Sa règle, et ce que j'ai failli lui faire dire

> « Monte à 10 % plus cher que l'abonnement prix mensuel. »

J'ai proposé de **lisser** entre les trois paliers, parce qu'appliqués tels
quels ils donnent un mur : 2 appareils 98 €, 3 appareils 341 €, soit ×3,5 pour
cent pièces de plus — et le nombre d'appareils se déduit du volume **déclaré**,
donc un client qui voit ça sous-déclare son stock.

⚠️ **Mais le lissage effaçait sa décision.** La règle « mois + 10 % » ne tombe
juste qu'aux trois ancres (2, 20, 100 appareils). Au milieu, la courbe part
d'Essential à 89 € et reste très en dessous : son propre exemple passait de
**129 € à 152 €**. Vingt-trois euros.

⚠️⚠️ **Et je lui avais donné un chiffre faux pour le rassurer** : « à 20 000
pièces, le logiciel pèse 36 % du tout ». J'avais pris le prix à 20 appareils
(341 €) alors qu'un magasin de 20 000 pièces en utilise 6. La vraie part, avec
le lissage, était de **16 %** — à peine mieux que les 14 % d'avant. J'avais
résolu le mur, pas sa question.

La correction mesurée en base a changé sa décision.

## Ce qu'il a tranché : la grille mixte

**Un tarif d'entrée jusqu'à 10 000 pièces, puis le palier plein + 10 %.**

| Pièces | Appareils | Location | Équipe entière | Part du logiciel |
|---|---|---|---|---|
| < 5 000 | 1–2 | **98 €** | — | — |
| 5 000 – 10 000 | 3 | **111 €** | 589 € | 19 % |
| 10 000 – 50 000 | 6–15 | **341 €** | 949 € | **36 %** |
| 50 000 et plus | 29+ | **979 €** | ~3 000 € | 33 % |

Pourquoi le tarif d'entrée : la règle sèche aurait donné 341 € dès 5 000 pièces,
contre 589 € pour qu'une **équipe entière** vienne tout faire. 58 % du service
rendu complet, pour un logiciel que le client exploite lui-même : il se serait
dit « pour 250 € de plus, ils viennent le faire ». Au-dessus de 10 000 pièces le
rapport redevient tenable, et le palier plein s'applique.

Le point d'entrée n'est pas inventé : il est sur la droite qui joint Essential à
Advanced.

## Comment c'est construit

**Une version 3 des réglages, pas une correction de la 2.** `missions` fige
`reglages_version` à la réservation et `missions_figer_le_prix` interdit d'y
toucher : une réservation déjà prise doit continuer de se lire avec la grille
qui l'a chiffrée. La version 2 reste en base, hors vigueur, avec
`part_du_mois = 0.50` — ce qu'elle valait vraiment.

**`part_du_mois` est un réglage**, pas une constante : changer 1,10 ne demande
plus de toucher à une fonction.

**`tranches_prix.prix_cents` ne fait plus le prix.** La tranche garde son nom,
son plafond d'articles (au-delà, `hors_grille`) et le minimum d'appareils
qu'elle impose. Sa colonne de prix dit désormais ce que coûte la tranche **au
minimum d'appareils** — elle reste vraie au lieu de rester vieille, et c'est
elle que lit la vitrine pour écrire « à partir de 98 € ».

`supplement_appareil_cents` et `tarif_appareil_cents` ne servent plus.

## ⚠️ Deux fautes à moi, rattrapées par les gardes

**J'ai ouvert `prix_mission` à `authenticated`.** En reposant les droits après
le `create or replace`, j'ai écrit `from public, anon` puis `to authenticated,
service_role`. Cette fonction rend `cout_cents`, `marge_cents` et les
rémunérations : **n'importe quel client connecté aurait su au centime ce que
Quantinvo gagne sur son inventaire.** Une garde du 28 septembre exigeait
exactement cette forme, et elle a mordu à la première exécution.

**Une valeur mal arrondie** dans les tranches (274 € écrit, 273 € calculé). La
garde ne relit plus la colonne : elle la **recalcule** depuis la courbe.

## ⚠️ Et une garde qui manquait

Les réglages étaient comparés un par un entre le site et la base, mais **pas la
courbe**. Le `case` du SQL et `moisCouvrant()` sont deux implémentations
indépendantes de la même décision : sabotage fait, le tarif d'entrée étendu à
six appareils **côté base seulement**, tout restait vert pendant que le site
affichait 341 € et que la base aurait facturé 152 €.

Le navigateur affiche, la base engage : c'est la base qui gagne, et le client
voit l'autre prix. La garde lit maintenant les seuils du `case` dans la
définition qui tourne et les compare un par un.

De même, `partDuMois` n'était comparée nulle part — elle décide pourtant seule
du prix de toute location.

## Les gardes, et leurs sabotages

Dix-sept morsures. Les plus utiles :

- la part du mois repasse sous 1 (louer moins cher que s'abonner) → mord
- le tarif d'entrée s'étend, côté site **ou** côté base → mord
- un palier change, côté site **ou** côté base → mord
- un seuil se déplace (20 → 25 appareils) → mord
- un mur apparaît ailleurs qu'à une frontière d'offre → mord
- la courbe redescend → mord
- une tranche ne vaut plus le prix de son minimum d'appareils → mord
- `prix_mission` rouvre à `authenticated` → mord

Les frontières légitimes sont **déduites** de `offres.ts` : le haut de chaque
palier, le tarif d'entrée, et les paquets de dix appareils au-delà de cent.

## Ce qui a été vérifié

- **En base**, les huit tranches et les cas à appareils choisis.
- **Dans la réplique**, sur une base reconstruite à neuf : les 30 migrations se
  rejouent, Quantinvo OS se comporte à l'identique, et une réservation sans
  compte ni entreprise préexistants coûte **341 €**.
- **Au volet** : le tunnel affiche 341 € pour 10–20 000 pièces et 6 appareils,
  la vitrine « à partir de 98 € » se recalcule toute seule, aucune erreur de
  console.
- **`get_advisors(security)`** : `prix_mission` n'y apparaît plus.
- 1 697 tests site, 551 app, lint 0 erreur.

## Ce qui reste

- **Rien n'est dans Stripe en live.** Changer la grille aujourd'hui ne coûte
  rien ; après la publication, ce sera une autre affaire (`docs/notes/047`).
- La phrase « Prix de la tranche » du tunnel a été corrigée : elle décrivait un
  calcul qui n'existe plus.
