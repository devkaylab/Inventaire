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
2. **La console `/admin/missions/[id]`** garde la partie « proposer la mission
   à des candidats, en retirer quelqu'un » (`admin_proposer_mission`,
   `admin_candidats_mission`, `admin_retirer_de_la_mission`).
3. **« Zone desservie »** (`zones_desservies`, `estDesservi`) suppose que
   Quantinvo envoie des gens quelque part. Sans équipe envoyée, la notion
   change de sens, voire disparaît.

## ⚠️ Et une question de modèle, avant d'écrire quoi que ce soit

« Un pro qui réalise un inventaire chez son propre client » n'a **pas**
d'équivalent aujourd'hui : tout se rattache à une entreprise et à un magasin.
Le stock compté n'appartient pas à celui qui compte. À qui appartiennent le
magasin, le rapport, les écarts — et qui paie ? Ça se décide avant le code.

## Vérifié

551 tests de l'app, 1 638 du site, `tsc` sans erreur, lint 0 erreur.
