# On-Demand commence par le logiciel seul

*Décision de Julien, 28 septembre 2026. **Rien n'est codé.*** Preview
uniquement. Révise le périmètre de `07-par-ou-on-commence.md`.

> « Commençons par un On-Demand juste en réservation de logiciel. Peut-être que
> des pros passeront par là car ils auront déjà des clients, et ça enlève la
> charge de trouver nous-mêmes des compteurs. »

Et une décision qui vaut pour plus tard : **les inventoristes sont
auto-entrepreneurs. Quantinvo n'a pas de salariés.**

---

## 1. Ce que la décision retire — et c'est le plus gros morceau

`07-par-ou-on-commence.md` listait quatre choses « à régler avant la première
ligne de code ». **La formule équipe en portait trois. Deux disparaissent
complètement :**

| Prérequis | Sort du chemin ? |
|---|---|
| **Le statut des inventoristes** — lien de subordination, contrat de prestation de résultat, **validation par un avocat** | ✅ **supprimé** — il n'y a plus d'inventoriste |
| **Stripe Connect** — onboarding, clé restreinte, second endpoint de webhook, deux documents de conformité à reprendre | ✅ **supprimé** — on encaisse, on ne reverse à personne |
| La TVA | ⚠️ **reste**, mais c'est une vente de logiciel, traitée comme l'abonnement |
| « On-Demand ne commence pas avant que Quantinvo OS soit vendu au moins une fois » | ⚠️ **reste** — et la vente est fermée tant que `legal.ts` est incomplet |

Et dans le socle, `provider_profiles` (le profil d'inventoriste) disparaît
aussi. Avec lui : tout `03-matching-et-score.md`, les notifications aux
inventoristes de `05-notifications.md`, et la moitié compliquée de
`06-annulations.md` — celle qui indemnise une équipe déjà constituée. **Annuler
une licence non consommée ne coûte rien à personne.**

⚠️ **Ce qui disparaît n'est pas du code : ce sont les deux dépendances
extérieures.** Un avocat et un onboarding Stripe Connect ne se planifient pas,
ils s'attendent. Le logiciel seul ne dépend plus que de nous.

---

## 2. Le parcours passe de trois questions à deux

Le tunnel actuel en pose trois : **où**, **quand**, **quoi compter**. Pour le
logiciel, la moitié des réponses ne sert à rien — et le code le dit déjà :

| Question posée aujourd'hui | À quoi elle sert | Pour le logiciel seul |
|---|---|---|
| Code postal | vérifier qu'une équipe peut s'y rendre | ❌ *`estDesservi` n'est déjà pas appliqué* |
| Secteur | coefficient de pénibilité | ❌ *« aucun coefficient sur le logiciel seul »* |
| Tous les articles ont-ils un code-barres | coefficient de pénibilité | ❌ *idem* |
| Tranche de références | — | ❌ n'entre dans aucun calcul |
| Tranche d'articles | dimensionner l'équipe, **donc déduire les appareils** | ⚠️ **à remplacer** |
| Date et heure | constituer l'équipe (délai 48 h) | ⚠️ *délai déjà nul* — reste la fenêtre |

**Ce qu'on garde, et ce qu'on ajoute :**

1. **Combien d'appareils compteront en même temps ?** — la question que Julien
   a relevée comme manquante, et **l'assiette de tout Quantinvo**
   (`offres.ts`). Aujourd'hui elle est *déduite* du volume d'articles : un
   magasin de 2 000 articles qui mobilise six personnes paie **un** appareil.
2. **Quel jour ?** — la fenêtre d'ouverture de la licence.

L'adresse reste, mais elle descend avec le compte et la facturation : ce n'est
plus une question de prix, c'est une donnée client.

⚠️ **« Deux questions et votre prix s'affiche » est une meilleure promesse que
trois.** Et elle est tenable, parce que plus rien dans le prix ne dépend de ce
qu'il y a dans le magasin.

---

## 3. Ce qu'il faut quand même construire

Le raccourci ne dispense pas du socle invisible — et l'un des points devient
**plus** critique, pas moins.

1. ⚠️⚠️ **Le trou de `plafond_appareils`.** Quand elle rend `null`, le magasin
   devient illimité. Pour la formule équipe c'était un défaut ; **ici c'est le
   produit tout entier** : on vend « N appareils pendant une fenêtre ». Si le
   plafond ne refuse rien, le client compte gratuitement, avec autant
   d'appareils qu'il veut, pour toujours. **À fermer avant la première vente.**
2. **`entitlements` et `mission_access`** — « cette entreprise a le droit
   d'utiliser Quantinvo sur ce magasin, jusqu'à telle date ». Sans
   `provider_profiles`.
3. **Le prix en base, verrouillé à la réservation.** Même règle que
   `prix_offre` : le navigateur affiche, le serveur calcule.
4. **La fenêtre de la licence.** Elle n'est définie nulle part. Proposition :
   **elle ouvre à l'heure choisie et dure 24 h**, parce qu'un inventaire qui
   déborde à 2 h du matin ne doit pas se retrouver dehors — et parce qu'une
   règle en heures se dit en une phrase.

---

## 4. Le prestataire n'est pas un prospect d'abonnement : c'est LE client

L'intuition de Julien est juste, et elle l'est pour une raison qu'il faut
écrire, parce qu'elle change la stratégie de prix.

**Une licence Quantinvo OS couvre UN magasin** (`offres.ts`). Un prestataire
qui compte pour trente enseignes clientes ne peut donc **pas** acheter
l'abonnement : il lui en faudrait trente.

| | Prestataire, 30 magasins clients, 2 inventaires/an chacun |
|---|---|
| 60 réservations On-Demand à 6 appareils | **11 340 €/an** |
| 30 abonnements Essential annuels | **28 500 €/an** |

⚠️ **Donc On-Demand n'est pas une porte d'entrée vers l'abonnement pour lui :
c'est la seule offre qui lui va.** Le revenu par réservation n'est pas un
revenu d'essai, c'est le revenu récurrent. Il doit être fixé comme tel.

Et ça ouvre une question qui n'existait pas : **faut-il un tarif pro** — un
carnet de réservations prépayé, ou une dégressivité au-delà de N réservations
dans l'année ? Un professionnel qui paie soixante fois le plein tarif finit par
chercher ailleurs. Ce n'est pas à trancher aujourd'hui, mais à ne pas oublier
le jour où le premier en fait trois.

---

## 5. Le prix, et l'inversion à corriger

Reprise de `08-le-prix-recale-sur-le-marche.md`, section 5 :

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

⚠️ **Le plafond au mois d'abonnement n'est pas une coquetterie** : sans lui,
20 appareils coûteraient 539 € en ponctuel contre 310 € pour un mois
d'Advanced. Le ponctuel deviendrait un piège au lieu d'une porte.

⚠️ **« À partir de 35 € » devient « à partir de 89 € ».** Et la page n'a plus à
afficher deux prix d'appel contradictoires : il n'y a plus qu'une offre.

---

## 6. Ce que la page vitrine devient

`PageOnDemand.tsx` présente aujourd'hui **deux cartes** — « Vous, avec la
vôtre » et « Nous, avec la nôtre ». La seconde n'a plus d'objet.

⚠️ **Ne pas la remplacer par une carte unique centrée.** Une page qui a perdu
son choix ne se répare pas en supprimant une colonne : c'est la proposition
qu'il faut réécrire, et elle est meilleure sans l'alternative — « ouvrez
Quantinvo le temps d'un inventaire, rien à installer, rien à résilier ».

⚠️ **Et `PageDevenirInventoriste.tsx` n'a plus de destinataire.** Elle reste
dans le dépôt, hors navigation, jusqu'au jour où la formule équipe revient.

---

## 7. Pour plus tard : les inventoristes sont auto-entrepreneurs

Décision de Julien du 28 septembre 2026, à garder pour le jour où la formule
équipe revient — elle change les chiffres de `08` :

- **Quantinvo n'a pas de salariés.** Pas de charges patronales, pas de CDD
  d'usage, pas de fiche de paie.
- ⚠️ **Mais le plancher de 125 € net ne se verse pas tel quel.** Un
  auto-entrepreneur qui reçoit 140 € en garde **109 € net** après cotisations.
  Pour qu'il en garde 125, il faut lui en verser **160 €** — **+14 % sur le
  coût de la main-d'œuvre**, et autant de marge en moins.
- ⚠️ **La question juridique ne disparaît pas, elle se déplace.** Un
  responsable qui attribue les zones et contrôle le travail, c'est la
  définition du lien de subordination — auto-entrepreneur ou pas. Le contrat
  doit être une prestation de résultat, et un avocat doit le dire.
- Julien : *« nous allons devoir trouver une solution pour attirer des
  inventoristes, mais ça viendra après »*. C'est le vrai obstacle de la formule
  équipe, et il n'est ni juridique ni technique.

---

## 8. Ce qui reste à trancher

1. **La fenêtre de la licence : 24 h ?** Rien ne la définit aujourd'hui.
2. **Peut-on vendre avant que Quantinvo OS soit vendu une fois ?**
   `07-par-ou-on-commence.md` dit non, et la vente est fermée tant que
   `legal.ts` n'a pas l'adresse et le téléphone de l'hébergeur.
3. **Un tarif pro** — carnet prépayé ou dégressivité. Pas aujourd'hui, mais
   avant le premier prestataire régulier.
4. **Le magasin du client du prestataire.** Il crée un magasin par client,
   dans SON entreprise. Rien ne l'en empêche — mais personne n'a vérifié que
   les écrans tiennent avec trente magasins dont vingt-neuf sont inactifs.
