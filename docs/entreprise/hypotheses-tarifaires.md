# Hypothèses tarifaires

**Établi le** : 21 août 2026.
**Objet** : garder côte à côte les façons de facturer Quantinvo, avec ce que
chacune rapporte et ce qu'elle coûte, pour que le choix se fasse sur des
chiffres et non sur une impression. Quatre hypothèses au 30 août 2026 : au
volume de stock, au prix fixe par magasin, par magasin et par compteur, et au
nombre d'appareils qui comptent.

> **DÉCISION DU 30 AOÛT 2026 — c'est l'hypothèse 4 qui est retenue** : trois
> offres calées sur le **nombre d'appareils qui comptent**, pour **un
> magasin**, les trois souscrites **en ligne**. **Revalorisées le 31 août
> 2026** (+36,9 %) : Essential 89 €/mois ou 950 €/an, Advanced 310 € ou
> 3 300 €, Enterprise 890 € ou 9 450 € HT. Elle est
> **décidée, pas encore construite** : rien n'existe en base ni dans les
> écrans, et le nombre d'appareils n'est même pas mesurable aujourd'hui
> (`DEVICE_KEY` est retirée à chaque lancement de l'app). Lire la section en
> fin de document avant d'écrire la moindre ligne.
>
> Les trois hypothèses précédentes sont conservées telles quelles : elles
> portent le raisonnement, et l'hypothèse 1 (au volume de stock) est ce que le
> produit applique encore aujourd'hui — CGV, devis, `stores.annual_price_cents`
> et modèles de facture n'ont pas bougé.
>
> Historique des décisions : **21 août** — le volume est retenu, le prix fixe
> écarté. **22 août** — rouvert (la grille au volume ne se contrôle pas), le
> prix unique recalé à 6 900 € sur l'ancre de marché, puis **le volume est
> gardé « pour ne pas influencer le client »**. **30 août** — le motif du
> contrôle l'emporte, et l'assiette change : on facture ce qui se mesure.

> Comme la check-list de création, ce document est une grille de travail, pas
> un conseil comptable. Les taux d'imposition utilisés sont ceux connus début
> 2026 et doivent être confirmés par l'expert-comptable.

## Le net, et comment on y arrive

Les quatre hypothèses affichent des prix **hors taxes**, et le net se calcule
de la même façon dans tous les cas — hypothèse SASU à l'impôt sur les sociétés,
rémunération en dividendes :

| Étape | Effet | Reste sur 100 € |
|---|---|---|
| Bénéfice | — | 100,00 € |
| Impôt sur les sociétés, taux réduit 15 % | −15,00 € | 85,00 € |
| Flat tax 30 % (12,8 % IR + 17,2 % prélèvements sociaux) | −25,50 € | **59,50 €** |

**Un euro facturé laisse 0,595 € en poche**, d'où le coefficient de 1,68 pour
remonter d'un net voulu au prix à afficher.

Trois choses à ne pas oublier, valables pour toutes :

- **la TVA ne coûte rien** : elle s'ajoute au prix HT et se reverse. En B2B le
  client la récupère. Ce n'est qu'un sujet de trésorerie ;
- **les dividendes de SASU échappent aux cotisations URSSAF** — c'est ce qui
  rend ce chemin meilleur que le salaire, qui coûte environ 1,86 fois le net
  avant même l'impôt sur le revenu (mais ouvre des droits à la retraite) ;
- **le net est marginal** : les frais fixes (expert-comptable, RC pro,
  hébergement, Apple, outils) se déduisent avant l'IS. Les deux premiers
  magasins paient la structure avant que quoi que ce soit ne reste.

Au-delà de 42 500 € de bénéfice, l'IS passe à 25 % et le coefficient marginal
devient 1,90. En micro-entreprise il tomberait à environ 1,37, plafonné à
77 700 € de chiffre d'affaires.

---

## Hypothèse 1 — au volume de stock (validée le 21 août 2026)

C'est celle que portent les CGV, le deck, les modèles de devis et de facture.

| Stock du magasin (unités) | Prix HT | Net | € par pièce |
|---|---|---|---|
| jusqu'à 10 000 | 2 100 € | 1 250 € | 0,210 € |
| 10 001 – 50 000 | 4 200 € | 2 499 € | 0,084 € |
| 50 001 – 200 000 | 6 600 € | 3 927 € | 0,033 € |
| 200 001 – 500 000 | 10 200 € | 6 069 € | 0,020 € |
| 500 001 – 1 000 000 | 14 400 € | 8 568 € | 0,014 € |
| au-delà d'1 M | sur devis | — | — |

Le volume se compte en **unités** (pièces physiques), jamais en références.
La borne des 200 000 est celle du métier : au-delà, c'est un grand magasin.

**Ce qu'elle a pour elle.** Le prix suit la valeur : un magasin dont le budget
d'inventaire est dix fois plus gros paie plus. La grille est dégressive, donc
découper un magasin en deux pour changer de tranche coûte toujours plus cher —
elle se protège toute seule. Et elle rapporte quel que soit le mix de clients :
on n'a pas besoin de deviner qui va signer.

**Ce qu'elle coûte.** Elle repose sur une **déclaration** du client, et
Quantinvo ne sait pas la vérifier : l'import du stock théorique est facultatif,
il est rattaché à l'inventaire et non au magasin, et un inventaire se fait
souvent par marque ou par zone. Le Service ne peut constater qu'un plancher
(article 6.4 des CGV). Il faut donc une conversation sur le volume à chaque
devis, une clause de régularisation, et un recoupement fait à la main.

---

## Hypothèse 2 — prix fixe par magasin (écartée le 21 août, ROUVERTE le 22)

> **Lire la « Reprise du 22 août 2026 » en fin de document avant celle-ci.**
> Le prix de l'offre concurrente, appris depuis, montre que cette hypothèse
> avait été écartée sur un mauvais calage — 4 800 € était deux fois trop bas.

Un seul prix, quelle que soit la taille du magasin.

**Prix proposé : 4 800 € HT par an et par magasin**, soit **2 856 € nets** —
et surtout, à l'oral, « l'équivalent de 400 € par mois, tout compris, comptez
autant de fois que vous voulez ».

Trois calages possibles, selon le segment visé :

| Prix fixe HT | Net | Équivalent mensuel | Ce qu'il vise |
|---|---|---|---|
| 3 700 € | 2 202 € | 308 € | réplique le panier moyen de l'hypothèse 1 ; garde la petite boutique |
| **4 800 €** | **2 856 €** | **400 €** | **proposé** — le magasin de chaîne et la grande surface |
| 6 600 € | 3 927 € | 550 € | assume le haut de marché et renonce à la boutique |

### Ce que le prix fixe règle

- **La déclaration de stock disparaît.** Plus rien à déclarer, à vérifier, à
  régulariser. Les articles 5.1, 6.3, 6.4 et 6.5 des CGV se réduisent à une
  phrase, et le problème du client qui minore son stock n'existe plus.
- **Le prix devient public.** Un seul chiffre tient sur la page d'accueil.
  C'est la faille du marché : aucun concurrent du haut de gamme n'affiche de
  prix, et une grille à cinq tranches n'est pas affichable de la même façon
  qu'un nombre unique.
- **La vente raccourcit.** Pas de tranche à négocier, pas de fichier à
  demander avant le devis.
- **Le client n'a pas de mauvaise surprise** quand son stock grossit.

### Ce que le prix fixe coûte

- **Le haut de marché est bradé.** Un magasin d'un million de pièces paie
  4 800 € au lieu de 14 400 € : 9 600 € abandonnés, sur exactement le client
  qui a le budget. C'est le vrai prix de la simplicité.
- **Aucun revenu d'expansion.** Un compte qui grossit ne paie jamais plus. La
  seule croissance possible est le nombre de magasins.
- **La boutique est chassée.** À 4 800 €, un magasin de 10 000 pièces paie
  plus du double de l'hypothèse 1. Ce segment ne signera pas — ce qui est un
  choix défendable, mais il faut le faire exprès.
- **Il ne reste qu'un levier de négociation : la remise réseau.** Une enseigne
  de trente magasins verra 144 000 € et demandera un prix de groupe. Avec une
  grille, on répond « chaque magasin est tarifé à sa taille » ; avec un prix
  fixe, il n'y a rien d'autre à céder que du prix.

### Le point de bascule

Sur un portefeuille de magasins, la grille rapporte plus que le prix fixe dès
que la clientèle penche vers les gros. Avec un prix fixe à 4 800 € :

> **Dès qu'un magasin sur quatre dépasse 50 000 unités, l'hypothèse 1 rapporte
> davantage.**

Deux portefeuilles de vingt magasins pour l'illustrer :

| Mix | Hypothèse 1 | Hypothèse 2 (4 800 €) | Écart |
|---|---|---|---|
| 4 boutiques, 8 magasins, 5 grandes surfaces, 2 grands magasins, 1 très grand | 109 800 € | 96 000 € | **grille +14 %** |
| 10 boutiques, 8 magasins, 2 grandes surfaces | 67 800 € | 96 000 € | fixe +42 % |

Le second calcul est trompeur, et c'est le piège de l'exercice : à 4 800 €,
**les dix boutiques n'auraient pas signé**. Le prix fixe ne change pas
seulement ce qu'on facture, il change qui achète. Comparer les deux colonnes
à clientèle constante n'a pas de sens.

### La variante à retenir si le choix se porte là

**Prix fixe, plus un plafond de volume.** 4 800 € par magasin jusqu'à
500 000 unités, sur devis au-delà. On garde la simplicité pour 95 % des
prospects et on cesse de brader les cinq derniers pour cent. Ce n'est plus tout
à fait un prix unique, mais c'est la seule concession qui protège le haut de
marché, et elle tient en une ligne sur le site.

---

## Hypothèse 3 — par magasin et par compteur, à tranches (22 août 2026)

Présentation chiffrée en artifact :
https://claude.ai/code/artifact/6c91f361-6778-4032-b2f1-857b435cf41f

Deux variables au lieu d'une : un **socle annuel par magasin**, dégressif selon
le nombre de magasins sous licence, et un **supplément par tranche de
compteurs** sur chaque magasin. Le volume de stock ne sert plus à rien.

### La grille

**Socle annuel, par magasin** — la tranche se lit sur le nombre total de
magasins de l'entreprise :

| Magasins sous licence | Socle par magasin | Net |
|---|---|---|
| 1 – 3 | 2 100 € | 1 250 € |
| 4 – 10 | 1 900 € | 1 131 € |
| 11 – 30 | 1 700 € | 1 012 € |
| 31 et plus | 1 500 € | 893 € |

Le socle comprend **3 comptes compteurs** et un nombre d'inventaires illimité.

**Supplément compteurs, par magasin** — au-delà des 3 comptes inclus :

| Compteurs actifs sur le magasin | Supplément | Net |
|---|---|---|
| jusqu'à 3 | inclus | — |
| 4 – 10 | + 2 100 € | 1 250 € |
| 11 – 25 | + 3 000 € | 1 785 € |
| 26 – 50 | + 4 500 € | 2 678 € |
| 51 – 100 | + 8 100 € | 4 820 € |
| 101 – 200 | + 12 300 € | 7 319 € |
| au-delà de 200 | sur devis | — |

### D'où viennent ces montants

Ils ne sont pas inventés : ils **rejouent l'hypothèse 1**. La règle de métier
est qu'un inventaire mené sur une journée mobilise environ **un compteur pour
5 000 unités**. En appliquant cette règle, un client d'un seul magasin paie
exactement le même prix dans les deux hypothèses :

| Magasin | Compteurs attendus | Hypothèse 3 | Hypothèse 1 |
|---|---|---|---|
| boutique, 10 000 u | 2 – 3 | 2 100 € | 2 100 € |
| magasin, 50 000 u | ~10 | 4 200 € | 4 200 € |
| grande surface, 200 000 u | ~40 | 6 600 € | 6 600 € |
| grand magasin, 500 000 u | ~100 | 10 200 € | 10 200 € |
| très grand, 1 000 000 u | ~200 | 14 400 € | 14 400 € |

**Ce qui change n'est donc pas le montant, c'est la variable facturée** — et
surtout la façon de la vérifier. C'est tout l'intérêt de l'exercice : on peut
comparer les deux hypothèses sans se demander laquelle est simplement plus
chère.

### Ce qu'elle règle

- **La déclaration de stock disparaît**, comme dans l'hypothèse 2 — mais
  **sans brader le haut de marché**, puisque le nombre de compteurs suit la
  taille du magasin. C'est la seule des trois hypothèses qui obtient les deux
  à la fois. Les articles 5.1, 6.3, 6.4 et 6.5 des CGV sont remplacés par un
  article de relevé.
- **La base est vérifiable par le produit**, alors que le stock déclaré ne
  l'est pas : Quantinvo ne voit du stock théorique que ce que le client veut
  bien importer, et seulement à l'échelle d'un inventaire.
- **La remise réseau devient une règle, pas une négociation.** C'est la
  faiblesse nommée de l'hypothèse 2 et l'angle mort de l'hypothèse 1 : une
  enseigne de trente magasins demandera un prix de groupe, et aujourd'hui rien
  n'est écrit pour lui répondre. Ici, la réponse est dans la grille.
- **Revenu d'expansion** : un client qui ouvre un magasin ou mobilise plus de
  monde paie plus, mécaniquement, sans avoir à rouvrir le contrat.

### Ce qu'elle coûte — et c'est ce qui la disqualifie

**1. Elle fait payer le moins le client qui se sert le mieux du produit.**
C'est le défaut central, et il vise exactement le différenciateur de
Quantinvo. On vend l'inventaire tournant : compter toute l'année, par petites
touches, avec ses propres équipes. Or ce mode d'usage mobilise **peu de
personnes longtemps**. Un grand magasin de 500 000 unités qui compte en
tournant avec dix personnes paie **3 800 €** ici, contre 10 200 € dans
l'hypothèse 1 — pour le même service, sur le client qui a le plus gros budget.
À l'inverse, celui qui bloque un dimanche et mobilise cent intérimaires paie
le plein tarif. On récompense la pratique qu'on cherche à remplacer.

La contre-mesure évidente — un plancher de compteurs indexé sur le volume
déclaré — **réintroduit la déclaration de stock**, donc annule le seul
bénéfice réel de l'hypothèse. La boucle est fermée.

**2. Elle taxe chaque personne mobilisée.** Un client qui hésite entre compter
à quinze une matinée et compter à cinq pendant trois jours a maintenant une
raison financière de choisir la seconde. Le volume de stock, lui, ne dépend
pas de l'usage : le client peut compter autant qu'il veut, avec qui il veut.

**3. Le partage de comptes détruit l'assiette.** Rien n'empêche dix personnes
d'utiliser le compte « compteur 1 » à tour de rôle, et on ne peut pas s'en
protéger : l'option « une seule session par utilisateur » est volontairement
laissée fermée côté Supabase, parce qu'un superviseur travaille sur le
téléphone et sur le site en même temps. Le dégât est double — la base de
facturation s'effondre, et `counts.counted_by`, qui sert à arbitrer un écart,
ne veut plus rien dire. L'argument de vente existe (« un compte par personne,
c'est ce qui vous dit qui a compté quoi »), mais on facturerait une discipline
qu'on n'a aucun moyen d'imposer.

**4. La mesure n'existe pas encore, et le raccourci ne marche pas.** Vérifié en
base le 22 août 2026 :

- **compter après coup sous-estime**. Sur 207 lignes de comptage,
  **97 n'ont plus d'auteur** : supprimer un compte détache ses comptages
  (`on delete set null`, migration `20260818000001`, voulu pour le RGPD). Un
  client qui supprime les comptes de ses saisonniers en fin d'inventaire
  efface la base de facturation ;
- **`store_team` ne sert pas de substitut** : La Samaritaine y compte
  1 compteur rattaché alors que **3 comptes ont réellement compté** dans ce
  magasin.

Facturer au compteur suppose donc de **construire un relevé mensuel** — nombre
de comptes distincts ayant enregistré au moins un comptage, écrit dans une
table dédiée et jamais recalculé après coup — plus la clause de CGV disant que
ce relevé fait foi. Quelques jours de travail, et un objet de plus à maintenir.

**5. Le saisonnier fait sauter une tranche pour une semaine.** Un magasin qui
embauche 40 intérimaires une fois l'an bascule en tranche 26 – 50 sur la foi
de sept jours. Il faut choisir la règle et la tenir : **pic mensuel de
l'année** (simple, annoncé d'avance, avec régularisation à la baisse au
renouvellement) plutôt que moyenne des relevés, qui serait plus juste mais
imprévisible pour le client.

**6. Deux variables à négocier au lieu d'une.** Le devis s'allonge, et le prix
devient encore moins affichable en une ligne sur le site — c'est déjà le
reproche fait à l'hypothèse 1, aggravé.

### Sur un portefeuille

Vingt magasins, donc socle à 1 700 €, avec les deux mêmes mix que plus haut :

| Mix | Hypothèse 1 | Hypothèse 3 | Écart |
|---|---|---|---|
| 4 boutiques, 8 magasins, 5 grandes surfaces, 2 grands magasins, 1 très grand | 109 800 € | 101 800 € | −7 % |
| 10 boutiques, 8 magasins, 2 grandes surfaces | 67 800 € | 59 800 € | −12 % |

L'écart **est** la remise réseau : elle passe de la négociation au tarif. Ce
n'est pas une perte si elle achète le contrat ; c'en est une si on l'aurait
signé sans.

Ces chiffres supposent en plus que chaque magasin mobilise le nombre de
compteurs « attendu » pour sa taille. Dès qu'un client compte en tournant avec
des équipes réduites — c'est-à-dire dès qu'il fait ce qu'on lui vend —
l'écart se creuse dans le mauvais sens : si les trois plus gros magasins du
premier mix comptent à dix au lieu de cent ou deux cents, le portefeuille
tombe à **79 600 €**, soit 30 000 € de moins que l'hypothèse 1 sur exactement
les clients qui ont le budget.

### Un point à trancher si ce chemin est repris

**Le compteur qui tourne sur plusieurs magasins.** Une enseigne mutualise ses
équipes ; la même personne compte à Lyon puis à Paris. Faut-il la facturer
deux fois ? La licence étant par magasin, la réponse cohérente est oui (elle
consomme le service des deux), mais c'est ce que le client verra en premier et
c'est le point sur lequel il négociera. L'alternative — tranche de compteurs à
l'échelle de l'entreprise — casse la logique « une licence par magasin » sur
laquelle tout le reste est bâti.

### Verdict

**À ne pas retenir en l'état.** Elle est séduisante sur le papier parce
qu'elle facture une base que le produit peut vérifier, là où l'hypothèse 1
repose sur une déclaration. Mais elle met un prix sur chaque personne
mobilisée, donc sur l'usage même qu'on vend, et elle sous-facture précisément
le client qui pratique l'inventaire tournant. Le seul correctif possible
ramène la déclaration de stock qu'elle prétendait supprimer.

**Ce qu'il faut en garder tout de suite** : la **dégressivité par nombre de
magasins**. Elle manque à l'hypothèse 1 retenue, et le sujet arrivera au
premier prospect à plusieurs magasins. À écrire dans la grille officielle,
appliquée au prix de chaque tranche de volume :

| Magasins sous licence | Remise sur la grille au volume |
|---|---|
| 1 – 3 | prix affiché |
| 4 – 10 | −10 % |
| 11 – 30 | −20 % |
| 31 et plus | −30 %, plancher à négocier |

**Ce qu'il faut en garder pour plus tard** : si la déclaration de stock devient
ingérable en pratique — client qui minore, régularisations à répétition —
l'hypothèse 3 est la seule des trois qui la remplace sans brader le haut de
marché. Elle redevient alors la solution de repli, à condition d'accepter son
défaut central et de construire le relevé mensuel.

---

## Comment trancher

La question n'est pas « quelle grille rapporte le plus », elle est **quelle
clientèle on veut**.

- Si la cible reste large — de la boutique parisienne au grand magasin —
  **l'hypothèse 1** est la bonne : elle est la seule qui reste juste des deux
  côtés du spectre, et elle rapporte quel que soit le mix. **C'est le choix
  retenu** : la cible reste large, et on ne veut pas parier sur un mix de
  clientèle qu'aucun client réel n'a encore confirmé.
- Si la cible se resserre sur le magasin de chaîne et la grande surface, et
  qu'on accepte de ne pas vendre aux plus petits, **l'hypothèse 2 avec
  plafond** simplifie tout : la vente, le contrat, le site, et elle supprime
  d'un trait le problème de la déclaration de stock.
- Si la déclaration de stock devient ingérable en pratique, **l'hypothèse 3**
  est le repli : c'est la seule qui la supprime sans brader le haut de marché.
  Son défaut central reste entier — elle sous-facture le client qui pratique
  l'inventaire tournant, c'est-à-dire celui qu'on vise.

Ce qu'il ne faut pas faire, c'est panacher sans le dire : afficher un prix fixe
et négocier au cas par cas revient à n'avoir aucun tarif, et le premier prix
consenti devient la référence pour tous les suivants.

**Le seul emprunt à faire tout de suite** est la dégressivité par nombre de
magasins de l'hypothèse 3 (−10 / −20 / −30 %), qui manque à la grille retenue
et qui servira au premier prospect à plusieurs magasins.

---

## Reprise du 22 août 2026 — l'hypothèse 2, recalée sur le prix du marché

Constat de Julien : la grille au volume ne se contrôle pas, le modèle au
compteur est trop compliqué à expliquer au client, et **l'offre entreprise
comparable se vend autour de 10 000 € par an et par magasin**, quel que soit
le volume de stock et le nombre de compteurs, terminaux durcis en supplément.

Ce chiffre est **confidentiel** : il vient du métier de Julien et n'est pas
publié. Il sert à caler notre prix, il ne se recopie ni dans un devis, ni dans
le deck, ni sur le site.

Présentation chiffrée en artifact :
https://claude.ai/code/artifact/f73e19e1-ebca-48bb-b18f-53e93727379c

**Il change la conclusion du 21 août.** Le prix fixe avait été chiffré à
4 800 € et écarté parce qu'il bradait le haut de marché — mais ce chiffre
venait de nulle part, faute de prix public en face. Avec l'ancre à 10 000 €,
4 800 € n'était pas trop cher pour les petits : **il était deux fois trop bas
pour le marché**. Ce n'est pas le modèle qui était mauvais, c'est son calage.

### Prix recommandé

**6 900 € HT par an et par magasin, jusqu'à 500 000 unités, sur devis au-delà.**
Soit 4 106 € nets, 575 € par mois à l'oral, et 31 % sous le repère du marché —
sans terminal à acheter, ce qui creuse encore l'écart de coût total pour le
client.

Le chiffre n'est pas arbitraire : **c'est le prix de la grande surface dans la
grille au volume** (6 600 €), donc le magasin médian de la cible. On ne change
pas de niveau de prix, on cesse de le faire dépendre d'une déclaration
invérifiable.

| Prix unique | Net | Par mois | Face au repère | Qui achète |
|---|---|---|---|---|
| 3 500 € | 2 083 € | 292 € | −65 % | tout le monde, mais on se place en entrée de gamme |
| 4 800 € | 2 856 € | 400 € | −52 % | le calage du 21 août : sous le marché, et déjà trop cher pour la boutique |
| **6 900 €** | **4 106 €** | **575 €** | **−31 %** | **recommandé** — magasin de chaîne et grande surface |
| 8 400 € | 4 998 € | 700 € | −16 % | même cible, mais l'écart ne se voit plus assez |

### Ce que ça change en revenu

Panier moyen de 3 700 € (grille au volume) contre 6 900 € : **il faut deux
fois moins de clients**. 28 magasins pour 100 000 € nets, contre 51. Et un
client de vingt magasins, remise réseau de 20 % comprise, rapporte 110 400 € —
soit exactement ce que la grille au volume aurait facturé au même parc, sans
une seule déclaration à vérifier.

Les nets par magasin sont calculés au coefficient marginal 0,525 (IS à 25 % au-delà de
42 500 € de bénéfice, puis flat tax), pas à 0,595 : à ces volumes de clients,
c'est celui qui s'applique.

### La borne haute ne ramène pas le problème du contrôle

C'est l'objection à traiter, puisque 500 000 unités reste un volume. La
différence est décisive : dans la grille au volume, **chaque client** déclare
son stock et une erreur coûte une tranche à chaque fois. Avec une borne unique,
la déclaration ne concerne que les rares magasins géants — et **un magasin d'un
million de pièces ne peut pas se cacher**. La borne ne tarife pas, elle ouvre
une conversation avec les cinq pour cent qui la dépassent.

### Ce qu'il reste à décider : la boutique indépendante

Un prix unique n'est simple que si on ne fait **aucune** exception, et le
premier prospect à un seul magasin testera la règle. Deux réponses tenables,
à choisir maintenant plutôt qu'en rendez-vous :

- **un seul chiffre** — 6 900 €, cible assumée sur le magasin de chaîne et la
  grande surface ;
- **deux chiffres** — 3 500 € pour l'enseigne indépendante à un seul magasin,
  6 900 € au-delà. La condition « un seul magasin » se vérifie à l'œil,
  contrairement à un volume de stock.

### Conséquences produit si ce chemin est retenu

- `stores.annual_price_cents` reste utile (remises réseau, cas particuliers),
  mais le panier moyen d'estimation d'`admin_business_overview` passe de
  2 200 € au prix unique.
- Le **stock théorique du formulaire de demande** (`MagasinSaisie`, migration
  `20260822140001`) ne sert plus à deviser. Ne pas retirer le champ pour
  autant : il reste utile au dimensionnement et à la conversation sur la borne
  haute — mais son texte doit cesser d'annoncer une tranche tarifaire.
- Les articles 5.1, 6.3, 6.4 et 6.5 des CGV (déclaration et régularisation du
  volume) se réduisent à une phrase sur la borne.

---

## Hypothèse 4 — au nombre d'appareils qui comptent (RETENUE le 30 août 2026)

Demande de Julien : *« l'idéal est de facturer sur ce qu'on peut contrôler, le
nombre d'appareils connectés, le nombre de magasins »*, avec trois offres et la
règle que **la plus petite coûte le plus cher à l'unité**. C'est la réponse
directe au motif qui avait rouvert le sujet le 22 août : la grille au volume ne
se contrôle pas.

### La grille

| Offre | Appareils | Par mois | À l'année | Net (annuel) | € / appareil au plafond |
|---|---|---|---|---|---|
| **Essential** | 2 | **89 €** | **950 €** | 565 € | 475 € |
| **Advanced** | 3 à 20 | **310 €** | **3 300 €** | 1 964 € | 165 € |
| **Enterprise** | 21 à 100 | **890 €** | **9 450 €** | 5 623 € | 94,5 € |
| Au-delà | > 100 | +64 € / 10 | +690 € / 10 | — | 69 € |

**⚠️ Revalorisation du 31 août 2026.** Julien a posé Enterprise à 890 €/mois et
demandé que les deux autres suivent **le même pourcentage** (+36,9 %), dans un
but explicite : *maximiser la marge sur Advanced*. Les mensuels sont l'arrondi
de ce calcul (65 → 89, 225 → 310 — arrondi vers le haut, c'est l'offre qu'on
veut faire rendre —, 650 → 890) ; les annuels gardent le rapport d'environ 10,6
mensualités de la grille d'origine. **Essential est assumé trop cher en
l'état** — 950 € pour deux appareils n'est plus un prix d'appel — et sera revu
séparément : ce n'est pas un oubli, c'est un report.

**⚠️ Une licence couvre UN magasin**, et le nombre d'appareils est celui qui
compte *dans ce magasin*. Un second magasin prend sa propre licence, choisie
selon la taille de **son** équipe : un entrepôt qui compte à trente et une
boutique qui compte à deux ne prennent pas la même. Le multi-magasins passe par
un devis global — voir « la remise réseau est reportée » plus bas.

**Le mensuel est le prix affiché**, l'annuel est l'option qui économise
(118 / 420 / 1 230 €, soit ~11 % dans les trois cas). Douze mensualités, pas
treize : la piste « toutes les 4 semaines » a été essayée le 30 août au soir
puis écartée — un acheteur B2B compare en mois, et le treizième prélèvement
découvert sur un relevé se retourne contre le vendeur.

Maquettes des cinq directions de page publique (**la B est retenue** — trois
colonnes, thème clair, bascule mensuel/annuel) :
https://claude.ai/code/artifact/c833c707-c76a-4a5d-a127-c602d09ea82f

### ⚠️ Pourquoi « lier le prix aux dépenses » ne marche pas ici

C'était la consigne de départ, inspirée de Neon et Supabase. **Elle a été
écartée après calcul, et le calcul mérite d'être gardé** : il se représentera à
chaque révision de la grille.

Coût marginal annuel d'un client Enterprise (40 appareils, 4 inventaires par an) :

| Poste | Coût annuel |
|---|---|
| Messages temps réel (~460 000 par inventaire, forfait Pro à 5 M/mois) | ~5 € |
| Sortie réseau (catalogue de 10 Mo par appareil, forfait 250 Go) | < 1 € |
| Stockage, écritures | ~0 € |
| **Stripe (1,4 % + 0,25 €)** | **~132 €** |
| **Total** | **~140 € sur 9 450 € facturés, soit 1,5 %** |

Deux conclusions :

- **97 % du coût variable est Stripe**, donc un pourcentage fixe du prix. Sur
  Essential le ratio est identique (~13 € sur 950 €). **Les dépenses ne
  segmentent rien** : indexer la grille dessus donne trois prix proportionnels
  au même prix, et fait retomber sur le forfait à 30-60 €/mois que la mémoire
  projet interdit — l'erreur de facteur dix.
- Neon et Supabase indexent sur les dépenses parce que **leur coût marginal est
  leur produit** (calcul, stockage). Ici il est nul. La bonne référence est
  Claude Pro / Max : des paliers qui reflètent l'intensité d'usage, un prix calé
  sur la valeur.

**Ce qui segmente vraiment, c'est le temps de service.** À une personne, environ
350 h de support par an :

| | Clients servis | Chiffre d'affaires |
|---|---|---|
| Enterprise, ~10 h par client et par an | 35 | **330 750 €** |
| Advanced, ~6 h par client et par an | 58 | **191 400 €** |

Un petit commerçant non technique ne consomme pas moins de support qu'un grand
magasin — souvent davantage, il n'a pas d'informaticien. **C'est la
justification économique de la règle du prix à l'unité**, et elle est plus
solide que l'argument du « pack de coca » : à temps de service égal, le haut de
gamme rapporte 1,7 fois plus.

Corollaire à tenir en interface : **Essential se vend sans support humain**,
souscription en ligne et aide en ligne. C'est ce qui rend son prix défendable.

### Les deux axes ne se confondent pas

Le premier jet fusionnait la taille d'un site et la taille d'un parc. Ce sont
deux axes indépendants :

- **la taille d'un magasin** (appareils simultanés) **nomme l'offre** ;
- **le nombre de magasins est un multiplicateur**, jamais un palier.

Sans cette séparation, un réseau de 30 boutiques à 4 personnes — le plus gros
client possible — tomberait dans « Essential × 30 ». Il prend 30 Advanced :
99 000 € au tarif affiché, et c'est là qu'une remise se négocie.

⚠️ **Conséquence de vocabulaire à connaître** : « Enterprise » désigne ici **la
taille d'un magasin**, pas un réseau. Le commercial d'un client à 30 boutiques
voudra l'appeler Enterprise alors qu'il relève d'Advanced. À trancher le jour où
le cas se présente ; rien ne le bloque aujourd'hui.

### D'où viennent 950, 3 300 et 9 450

Les trois montants sont ceux du 30 août 2026 (690, 2 400, 6 900) revalorisés du
même pourcentage le 31 août. **Le raisonnement d'origine est conservé
ci-dessous** : il dit pourquoi les rapports entre les paliers sont ce qu'ils
sont, et la revalorisation les a précisément préservés.

- **690 € par tranche de 10 au-delà de 100 appareils** (64 € en mensuel) — et
  ce chiffre a une histoire à ne pas refaire. Le premier calage le posait au
  tarif moyen d'Enterprise : le supplément reconduisait le palier au lieu de le
  prolonger, alors que **la grille est dégressive à chaque palier**
  (475 → 165 → 94,5 € par appareil). 69 € par appareil est le cran suivant.
  ⚠️ **Un magasin à 150 appareils paie désormais 12 900 €, donc AU-DESSUS de
  l'ancre de marché** (≈ 10 000 €) — ce n'était pas le cas avant la
  revalorisation. Au-delà de cent appareils, on sort de toute façon sur devis :
  c'est là que la question se traite, pas dans la grille affichée.
- **9 450 €** vient de 6 900 €, le chiffre établi le 22 août pour le prix unique
  par magasin — le prix de la grande surface dans la grille au volume, alors
  31 % sous l'ancre de marché (Zebra SmartCount, ≈ 10 000 € par magasin et par
  an, **confidentielle, ne se cite dans aucun livrable**). ⚠️ **Cette marge de
  31 % a été dépensée** : à 9 450 € on est à ~5 % sous l'ancre. C'est le vrai
  coût de la revalorisation, et il se paiera en négociation face à Zebra. Le
  plafond ne monte pas au-delà : passé ce niveau, on sort sur devis.
- **950 €** vient de 690 €, lui-même une correction : Julien proposait un Solo à
  280 €, puis à 490 € pour un utilisateur. Passé à **deux** utilisateurs,
  l'offre change de nature — elle permet un vrai inventaire à deux, donc l'audit
  en seconde passe et l'arbitrage des écarts, la fonction qui sépare *compter*
  de *fiabiliser*. ⚠️ **Mais 950 €/an, soit 79 €/mois, n'est plus un prix
  d'appel**, et Julien le sait : il l'a dit en demandant la hausse. Essential
  est à revoir séparément — c'est le seul palier dont la revalorisation
  proportionnelle n'a pas de justification propre.
- **3 300 €** reste le prix de la frontière, pas celui du milieu. Avec Essential
  à deux appareils, on passe d'offre pour **un seul appareil de plus** : c'est
  l'endroit où le client a le plus intérêt à sous-déclarer, donc le pas doit
  rester tenable. Il vaut 3,47 (950 → 3 300), exactement celui du 30 août
  (3,48) — la hausse proportionnelle n'a pas déplacé cette frontière.

### La règle du prix à l'unité tient sans verrou juridique

475 € > 165 € > 94,5 €. Et surtout, l'empilement est perdant :

| Ce qu'on voudrait empiler | Coût | L'offre juste |
|---|---|---|
| 10 Essential pour 20 appareils | 9 500 € | 3 300 € |
| 50 Essential pour 100 appareils | 47 500 € | 9 450 € |

⚠️ **Un premier calage avait échoué sur ce point exact** (Essential à 290 € et
un palier à 1 900 € : cinq Essential coûtaient 1 450 €, donc moins). Il avait
été rattrapé par un verrou — « Essential = 1 magasin, non cumulable » — et
c'était le mauvais réflexe : **un prix qui a besoin d'un verrou pour tenir est
un prix mal calé.** Le verrou reste, mais il ne porte plus la grille.

Le verrou d'usage vaut d'être connu quand même : cinq Essential sont **cinq
magasins séparés, cinq inventaires séparés** — aucun comptage partagé, pas
d'audit à deux passes, pas de supervision. On ne compte pas à dix dans un
magasin avec cinq Essential.

### ⚠️ Ce qu'elle coûte, et il faut le savoir avant de signer

**À taille de magasin égale, elle facture nettement moins que la grille au
volume.** En convertissant par la règle de métier « un compteur pour 5 000
unités » (celle qui avait servi à caler l'hypothèse 3) :

| Appareils | Stock équivalent | Hypothèse 1 | Hypothèse 4 | Écart |
|---|---|---|---|---|
| 2 | 10 000 | 2 100 € | 950 € | −55 % |
| 20 | 100 000 | 6 600 € | 3 300 € | −50 % |
| 100 | 500 000 | 14 400 € | 9 450 € | −34 % |

Deux lectures, et la seconde atténue la première :

1. **La conversion surestime.** « Un compteur pour 5 000 unités » décrit ce
   qu'il faut mobiliser pour compter un magasin **en une journée**. Un
   inventaire tournant — le différenciateur qu'on vend — mobilise peu de monde
   longtemps. Un magasin de 100 000 unités compté à cinq relève d'Advanced.
2. **C'est le reproche fait à l'hypothèse 3**, et il est réel : on fait payer
   moins le client qui se sert le mieux du produit. La différence est que le
   palier est **large** (3 à 20) : un client qui passe de 5 à 15 personnes ne
   change pas de prix, là où l'hypothèse 3 facturait chaque tranche. La
   granularité grossière est ce qui rend l'effet supportable — **ne pas
   resserrer les paliers en croyant affiner.**

L'arbitrage assumé : on renonce à une part du haut de marché en échange d'une
assiette **vérifiable**, et on déplace la charge de la preuve du client vers la
mesure.

### ⚠️ Les trois décisions passées qu'elle déplace

1. **« Pas de plafond de compteurs » (23 août 2026)** — la licence était par
   magasin, utilisateurs illimités. Cette hypothèse la contredit frontalement.
   La note prévoyait sa réouverture « sur une demande entrante de tarification
   au poste » ; c'est Julien qui rouvre, avec une raison neuve — le contrôle.
   **Mais son argument le plus fort reste vrai** : *un plafond mal calé dit non à
   22 h, un soir de comptage.* D'où la règle non négociable ci-dessous.
2. **L'offre Solo (27 août 2026)** — 49 €/mois, 1 magasin, **1 utilisateur**,
   plafond de 2 000 unités. Elle est remplacée par Essential : deux
   utilisateurs, 950 €/an, pas de plafond de pièces. Son verrou « 1 utilisateur »
   passait par un refus sec dans la policy `team_invitations` ; à deux, ce n'est
   plus un refus mais **un décompte**.
3. **L'hypothèse 1, au volume de stock** — elle cesse d'être l'assiette. Le
   stock déclaré reste utile au dimensionnement et au recoupement
   (`alerteDensite`), il ne tarife plus.

### ⚠️ Le plafond est SOUPLE, et ce n'est pas un détail d'implémentation

**On ne refuse jamais un appareil pendant un inventaire.** On mesure le pic, on
l'affiche au client, et le dépassement se règle au renouvellement — ou bascule
automatiquement au palier suivant. C'est ce que font Claude et Neon : ils ne
coupent pas, ils facturent.

Un refus dur rejouerait exactement le risque asymétrique décrit le 23 août : le
plafond dit non au pire moment, et il n'y a personne pour le lever à 22 h.

### ⚠️ Ce qui n'est pas mesurable aujourd'hui

**`DEVICE_KEY` est tirée à chaque lancement de l'application** (const de module,
`src/lib/presence.ts` — voir la section « Tenue en charge » d'AGENTS.md, où
cette valeur a été remontée au module précisément pour qu'un même téléphone ne
compte pas double entre deux écrans). Elle ne survit pas à la fermeture de
l'app : **un même iPhone compte pour dix appareils sur dix lancements.**

Avant toute facturation à l'appareil, il faut donc :

- **persister la clé** (SecureStore, comme le jeton de session) ;
- **l'enregistrer côté serveur** avec son magasin ;
- **mesurer un pic simultané sur une fenêtre**, jamais un cumul — sinon un
  magasin qui renouvelle ses téléphones fait exploser son quota sans avoir
  changé sa façon de compter.

Bonne nouvelle au passage : cela **débloque ce qui avait disqualifié
l'hypothèse 3**. Elle avait été écartée aussi parce que *facturer au compteur
n'est pas mesurable a posteriori* — 97 lignes de comptage sur 207 n'ont plus
d'auteur (`on delete set null`, migration `20260818000001`, effet voulu pour le
RGPD). **Un appareil n'est pas un salarié** : pas de détachement à la
suppression de compte, pas de donnée personnelle, et il se mesure.

### Les arbitrages du 30 août au soir

Cinq décisions prises en dessinant la page, chacune avec sa raison.

**1. Les trois offres se souscrivent EN LIGNE, Enterprise comprise.** Elle
demandait un devis dans le premier jet. Conséquence directe et assumée : un
client peut engager 9 450 € par carte sans que personne ne lui parle, et **le
parcours devis existant ne sert plus qu'à deux cas** — le multi-magasins et les
établissements de plus de 100 appareils. C'est beaucoup moins de travail que
prévu (six prix Stripe récurrents et rien d'autre), mais c'est un choix
commercial : plus de qualification avant l'encaissement sur le haut de grille.

**2. La remise réseau est REPORTÉE après le lancement.** Elle était chiffrée
(−10 / −20 / −30 %) et intégrée aux maquettes ; elle en est retirée. Le
multi-magasins renvoie vers un devis global, sans prix affiché.
⚠️ **Ce report a une échéance naturelle** : dès le premier prospect à plusieurs
magasins, il faudra une réponse chiffrée, et c'est la remise qui reviendra. Ne
pas la redécouvrir alors — elle est écrite dans l'hypothèse 3, section « ce
qu'on en garde tout de suite ».

**3. Mensuel affiché par défaut, douze mensualités.** La piste « toutes les
4 semaines » (13 prélèvements) a été essayée puis écartée : un acheteur B2B
compare en mois, et un treizième prélèvement découvert sur un relevé est perçu
comme un piège — l'écart de prix se retourne alors contre le vendeur. L'annuel
reste l'option qui économise, affichée en euros (90 / 300 / 900 €) et jamais en
pourcentage : « vous économisez 900 € » pèse plus que « −11,5 % ».

**4. ⚠️ « Lier le supplément aux dépenses » a été calculé, puis écarté — une
seconde fois.** Julien a demandé le coût réel d'un appareil à plein régime,
multiplié par 2,5. Le calcul, à garder pour ne pas le refaire :

| Poste (24 journées de comptage par an) | Coût / appareil / an |
|---|---|
| Messages temps réel (12 battements/min × 480 min × 24 j, ×3 abonnés) | 1,04 $ |
| Sortie réseau (catalogue 10 Mo réamorcé à chaque inventaire) | 0,03 $ |
| Écritures et stockage (~72 000 lignes) | 0,02 $ |
| Part d'instance (une Large répartie sur les ~2 000 appareils qu'elle encaisse) | 0,66 $ |
| **Total** | **≈ 1,75 $, soit 1,65 €** |

**× 2,5 = 4,13 € par appareil et par an, soit 41 € par tranche de 10.** Le
chiffre est juste et inutilisable : 41 € sur une facture de 9 450 € ne vaut pas
la ligne de facturation. C'est la démonstration, en petit, de ce qui est écrit
plus haut — **le coût marginal est si proche de zéro qu'aucun multiplicateur
raisonnable n'en tire un prix**. Le supplément a donc été calé sur la
dégressivité de la grille, pas sur les dépenses.

**5. La page publique retenue est la direction B** — trois colonnes, thème
clair, bascule mensuel/annuel au-dessus des cartes, offre du milieu mise en
avant. Quatre autres directions ont été dessinées et écartées : un sélecteur
d'appareils, un comparatif dense, une page éditoriale et un simulateur. Elles
restent dans le canevas si le sujet se rouvre.

### Conséquences produit

- **Base** : `companies.plan` (`essential` / `advanced` / `enterprise`),
  `billing_period` (`monthly` / `yearly`) et `license_status`, écrits par le
  seul `service_role` — c'est déjà ce que prévoyait l'offre Solo du 27 août.
  Plus le relevé d'appareils et son pic.
- **Stripe** : **six prix récurrents** posés en secrets (trois offres × deux
  rythmes), jamais créés à la volée. `checkout.session.completed` →
  `fulfil_solo_subscription`, et les événements de cycle de vie
  (`invoice.payment_failed`, `invoice.paid`,
  `customer.subscription.deleted`).
- **Page publique `/tarifs`**, hors `AppShell` — elle s'ouvre au téléphone, et
  c'est le premier prix affiché du produit. La grille cessant d'être sur devis,
  `/inscription` peut afficher l'offre correspondante.
- **`MagasinSaisie`** : fait le 2 septembre 2026, et **la décision a changé en
  chemin**. Ce point disait « garder le champ de stock, changer son texte » ;
  Julien a tranché l'inverse — **le stock et la surface quittent les deux
  formulaires**, remplacés par le nombre d'appareils. Un chiffre qui ne tarife
  plus rien n'a rien à faire dans un formulaire public : il se remplit mal, il
  se discute pour rien, et il laisse croire qu'il pèse sur le prix.
  ⚠️ Contrepartie assumée : `alerteDensite` (le repérage d'un stock déclaré
  invraisemblable) et l'écran `/admin/usage` n'ont plus de source sur les
  demandes nouvelles. Ils ne servent plus qu'aux magasins déclarés avant cette
  date. Les colonnes `units` et `sqm` restent en base.
  Et **l'offre s'affiche à la frappe**, ce qui renverse la règle du 22 août :
  elle valait contre un chiffre déclaré et invérifiable, pas contre une assiette
  mesurable dont les trois prix sont publics.
- **CGV** : les articles 5.1, 6.3, 6.4 et 6.5 portent la déclaration et la
  régularisation du volume. Ils sont remplacés par une clause sur le nombre
  d'appareils et le dépassement.
- **Interface** : bandeau de dépassement côté client, remontée dans
  `admin_pipeline` (c'est du revenu qui attend), et écrans d'équipe allégés pour
  Essential.
- **Le sort des clients déjà devisés au volume reste à trancher** — aucun n'est
  signé à ce jour, la question est donc ouverte sans urgence.
