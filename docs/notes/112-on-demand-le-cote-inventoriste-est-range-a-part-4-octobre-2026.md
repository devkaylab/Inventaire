# On-Demand : le côté inventoriste est rangé à part — 4 octobre 2026

## Le cadrage, de Julien

> « On-Demand = client qui veut louer Quantinvo pour un inventaire, c'est tout.
> Le côté marketplace où l'on cherche des compteurs n'est plus d'actualité le
> temps d'avoir un juriste. Un client peut être un magasin qui a déjà son
> équipe, ou un simple pro qui réalise un inventaire chez son propre client. »

Le chantier avait été construit AVANT ce cadrage. Une partie du code servait
donc une promesse qui n'est plus la nôtre — et la décrire comme telle était
faux.

## Rien n'est perdu

**Branche `on-demand-inventoristes`**, poussée, sommet `5913830`. Elle porte
l'état complet d'avant le rangement. Le jour où le juriste tranche, tout est
là.

## Ce qui est parti de `on-demand`

| | |
|---|---|
| `src/app/(provider)/` | les six écrans de l'inventoriste |
| `src/components/BarreInventoriste.tsx` | sa barre |
| `src/lib/onDemand.ts` | ses cinq appels |
| `src/app/index.tsx` | l'aiguillage vers son espace — **revenu à la version de `main`** |
| `web/app/devenir-inventoriste/` + `PageDevenirInventoriste.tsx` | la page publique qui recrutait |

⚠️ **Les migrations NE SONT PAS touchées.** Les tables et fonctions du côté
inventoriste restent décrites par le dossier, et restent appliquées dans les
deux bases. Les retirer casserait la propriété qu'on a mesurée le même jour —
« le dossier décrit la base » — et obligerait à toucher la production, où ces
objets dorment sans danger. Du code qui n'existe plus n'appelle rien.

## ⚠️ Une garde affaiblie sans bruit, trouvée au passage

`seo.test.ts` tient une liste d'exceptions : les pages publiques volontairement
absentes du plan du site. `devenir-inventoriste` y figurait, et **y est resté
après la suppression de la page**. La suite est restée verte. Le jour où une
page reprendrait ce nom, elle serait écartée du plan du site sans que personne
ne l'ait décidé — une exception qui survit à sa page affaiblit la garde pour
toujours.

La garde refuse maintenant toute exception qui ne correspond plus à un dossier
de page. ⚠️ Elle teste **l'existence du dossier**, pas `routes()` : `devis`
n'a pas de `page.tsx` à sa racine — il sert `devis/[token]` — et s'appuyer sur
`routes()` l'aurait déclaré périmé alors qu'il est bien là. Sabotée en
remettant l'exception : elle mord.

## ⚠️ Ce qui reste à trancher, et que je n'ai pas tranché

Trois choses portent encore la logique de la place de marché. Les retirer
serait un choix de produit, pas de rangement :

1. **Le modèle de prix** (`web/lib/prixOnDemand.ts`, `reglages_prix`,
   `coefficients_prix`) calcule le tarif à partir du **coût d'une équipe
   d'inventoristes** — taux horaire, productivité, marge. Si le client compte
   avec sa propre équipe, ce coût n'existe plus : le prix d'une location ne
   s'en déduit pas.
2. ~~La console `/admin/missions/[id]`~~ — **tranché le soir même** : « on ne
   propose plus d'équipe donc on ne garde pas ce qui y fait référence ». La
   section « L'équipe — N inventoristes » et toute la partie « Qui pourrait la
   faire » sont parties, avec leur état, leurs deux mutateurs et leurs tables
   de libellés. La console montre désormais **ce que le client a loué** :
   appareils, début, durée. Les fonctions SQL restent, inertes.
3. ~~« Zone desservie »~~ — **tranché le soir même.** Julien : « la notion
   "envoyer une équipe" est nulle ». Voir ci-dessous.

## ⚠️ Et une question de modèle, avant d'écrire quoi que ce soit

« Un pro qui réalise un inventaire chez son propre client » n'a **pas**
d'équivalent aujourd'hui : tout se rattache à une entreprise et à un magasin.
Le stock compté n'appartient pas à celui qui compte. À qui appartiennent le
magasin, le rapport, les écarts — et qui paie ? Ça se décide avant le code.

## Vérifié

551 tests de l'app, 1 638 du site, `tsc` sans erreur, lint 0 erreur.


## ⚠️ La zone desservie ne gouverne plus rien — 4 octobre 2026, le soir

`/on-demand/groupe` grisait les magasins d'un département « non desservi » et
refusait de les réserver. **Une enseigne de dix magasins dont quatre hors zone
n'en réservait que six.**

Le reste du code avait déjà raison : partout ailleurs la zone n'est regardée
que si la formule est `equipe_quantinvo`, et la base elle-même **retombe sur
`logiciel_seul`** quand la ligne ne dit rien (`reserver_ma_mission`). Le
navigateur refusait donc ce que le serveur acceptait — le pire cas, parce que
rien ne remonte.

Et **aucune garde ne le voyait** : la suite est restée verte avant comme après
la correction. Trois gardes neuves, deux sabotages :

- **la liste se déduit** — tout fichier du site qui appelle `estDesservi` doit
  aussi regarder la formule ; sinon il refuse une location que la base
  accepterait ;
- la page « groupe » ne consulte plus la zone **du tout** : elle ne connaît pas
  la formule, donc elle n'a aucun moyen de poser la question correctement ;
- le refus `hors_zone` de la bibliothèque reste conditionné à `!logiciel`.


## Et trois décisions du 4 octobre au soir

**1. Pas de frais d'annulation.** Ils payaient les inventoristes qui s'étaient
rendus disponibles pour une nuit — l'écran le disait mot pour mot. Plus
personne ne se rend disponible : des frais sans cette raison ne seraient plus
qu'une punition. `frais_annulation` rend `a_payer_cents: 0` **toujours**, et ne
lit plus ni `reglages_annulation` ni `remuneration_totale`. Le tableau « si
vous annulez / vous payez » quitte l'écran : un tableau à une seule ligne à
zéro se lit comme un piège qu'on cherche.

⚠️ **Quatre gardes sont tombées, et elles avaient raison.** « Le barème
d'annulation retombe sur le document » défendait les trois paliers et le fait
que **les deux arrondis aillent chacun contre Quantinvo** — le client à l'euro
inférieur, l'équipe à l'euro supérieur. C'était vrai. La décision l'a renversé.
On ne retire pas une garde parce qu'elle gêne : elle est **remplacée** par
celle de la décision qui l'a renversée, et le remplacement est dit dans son
commentaire. `reglages_annulation` n'est pas supprimée pour autant — la formule
équipe est fermée, pas effacée.

**2. Le code postal et l'adresse restent obligatoires.** Décision de Julien,
pour facturer. Rien à changer.

**3. Plus aucune référence à une équipe proposée.** Voir le point 2 ci-dessus.
