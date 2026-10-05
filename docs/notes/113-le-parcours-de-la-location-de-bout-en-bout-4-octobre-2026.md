# Le parcours de la location, de bout en bout — 4 octobre 2026

Julien : « pense au workflow de A à Z, rien ne doit manquer, que rien ne bloque
l'user et son inventaire ». Déroulé jusqu'au comptage, sur la base d'essai,
avec une vraie réservation.

## ⚠️⚠️ Une location restait bloquée POUR TOUJOURS

Le défaut le plus grave, et il tenait à **une ligne manquante**.

`reserver_ma_mission` calcule bien le prix en `logiciel_seul` — le JSON
`calcul` le dit — mais **n'écrivait pas la colonne `formule`** de la mission.
Celle-ci gardait son défaut, `equipe_quantinvo`, posé le 20 septembre quand
toute mission venait avec une équipe.

Or c'est cette colonne que lit `missions_verifier_transition` pour choisir la
machine d'états :

```
location : confirmee → prete            → en_cours
équipe   : confirmee → en_constitution  → equipe_complete → prete
```

`confirmee → prete` était donc **refusé**, et `en_constitution` réclame une
équipe qu'on ne constitue plus. La mission ne pouvait plus avancer du tout.

Et tout en dépend : la **session d'inventaire** n'est créée qu'au passage
« en cours » (`admin_avancer_mission`), et les **appareils** ne s'ouvrent que
par le déclencheur qui suit ce même passage. Le client réservait, payait, et
son inventaire ne pouvait jamais commencer.

**Mesuré, pas déduit** : `admin_avancer_mission(..., 'prete')` rendait « Cette
mission ne peut pas passer de "confirmee" à "prete" » sur la réservation
d'essai.

## ⚠️ Et aucun écran ne faisait avancer une mission

`admin_avancer_mission` existe depuis le 20 septembre. **Aucun fichier de
`web/` ne l'appelait** — vérifié sur tout le dossier, et sur la version
conservée de la branche. Même sans le défaut ci-dessus, rien n'aurait bougé.

La console d'une mission porte maintenant les commandes du parcours. ⚠️ Elle
**ne recopie pas la machine d'états** : elle propose, la base arbitre. Deux
tables qui divergent, c'est un bouton qui ne marche pas.

## Ce que le parcours produit, vérifié

Chaîne rejouée dans une transaction annulée, sur la vraie réservation :

| étape | résultat |
|---|---|
| `paiement_autorise` → `confirmee` → `prete` → `en_cours` | les quatre passent |
| session d'inventaire | **créée** |
| accès | **ouverts** |
| appareils ouverts par la mission | **9** |
| plafond du magasin | **109** (100 + 9) |

## Louer crée un vrai client

Réponse à la question de Julien : oui, et comme un utilisateur ordinaire de
Quantinvo OS. `reserver_ma_mission` :

- crée l'**entreprise** si la personne n'en a pas, et la pose
  **`role = supervisor`, `is_company_admin = true`** ;
- crée le **magasin** s'il n'existe pas sous ce nom ;
- pose le droit **`on_demand / actif / libre`** dans `entitlements`.

Elle peut donc ensuite inviter superviseurs et compteurs par les écrans
habituels : rien de spécifique à On-Demand là-dedans.

⚠️ **Mais un magasin créé par une location a `devices` nul**, donc un plafond
de **2** hors mission — voir la fiche On-Demand. Pendant la fenêtre, la mission
ajoute ses appareils ; en dehors, le client retombe à deux.

## ⚠️ Ce qui manque encore, et qui n'est pas de mon ressort

- **Le paiement.** `prix_calcule → paiement_autorise` n'a **aucun chemin
  automatique** : la fonction edge `stripe-webhook` ne connaît pas les
  missions. Aujourd'hui c'est la console qui pose l'état à la main.
- **L'inscription d'un client neuf** passe par la fonction edge `inscription`,
  donc par `VENTE_OUVERTE` — fermé tant que `web/lib/legal.ts` est incomplet.
  Et aucune fonction edge n'est déployée sur le projet d'essai.
## ⚠️ Et une erreur de ma part, corrigée par Julien

J'avais écrit que le client « n'a nulle part où préparer tant que la mission
n'est pas ouverte ». **C'est faux.** Julien : « pourquoi le client n'atterrit
pas sur son Dashboard Quantinvo OS ? »

Il y atterrit. Vérifié sur l'aperçu avec le compte d'essai : tableau de bord
complet, « Nouvel inventaire », « Mon équipe », les compteurs du mois. Louer
fait de lui un utilisateur ordinaire, et il prépare comme n'importe qui.

**Ce qui reste vrai, et qui est une autre question :** ouvrir la mission crée
**un second inventaire**, celui de la mission, avec son propre numéro. Si le
client en a déjà créé un lui-même, rien ne les relie — son import et ses
balises sont dans l'autre.

## Les appareils, pour un client neuf

Une entreprise créée par une location prend le plan `standard`, que
`plafond_appareils` ne connaît pas : elle rend `null`, et le plafond effectif
retombe sur son plancher.

| | appareils |
|---|---|
| pendant la semaine louée | **11** (2 + les 9 de la mission) |
| en dehors | **2** |

Préparer — importer, imprimer les balises, inviter l'équipe — ne consomme
aucun appareil. Le plancher ne gêne donc pas la préparation.


## Un seul inventaire, et il naît avec la réservation

Julien, entre les deux sorties proposées : **B** — « la mission crée
l'inventaire dès la réservation, et c'est celui-là que le client prépare ».

- `creer_la_session_de_mission` accepte d'être appelée dès `prix_calcule`.
  Elle exigeait `confirmee`, ce qui n'avait de sens que pour une équipe qui se
  constitue après la confirmation.
- `reserver_ma_mission` l'appelle dans la foulée de l'insert.
- L'écran du client y mène **avant** le jour — « Préparer l'inventaire » — et
  devient « Votre rapport » ensuite. Le même, du début à la fin.

⚠️ Rien ne peut en créer deux : la fonction rend `{deja: true}` si la mission
en a déjà une, et `admin_avancer_mission` ne l'appelle que sur un identifiant
nul.

## ⚠️⚠️ Et un piège de méthode, trouvé par une garde d'un autre sujet

Reprendre une définition de `pg_get_functiondef` est la bonne méthode — elle
évite de recopier deux cents lignes et d'y glisser une divergence. Mais **sa
sortie se termine par `$function$` sans point-virgule**, et l'ajouter sur la
ligne suivante produit `$function$\n;`.

Or `derniereDefinition` — le helper par lequel passent **toutes** les gardes du
projet — borne un corps en cherchant `$function$;`. Sans cette suite exacte,
elle lit **jusqu'à la fin du fichier**, donc la fonction suivante.

Dans la migration qui en portait deux, le corps de la première contenait celui
de la seconde : une garde de l'espace administrateur a signalé un promoteur de
plus, et elle avait raison. Quatre migrations de la journée étaient dans ce
cas. Toutes recollées, et une garde refuse désormais la terminaison détachée.

C'est le genre de défaut qui ne casse rien et rend tout approximatif.


## ⚠️ Un inventaire loué naissait sans zones — 5 octobre 2026

Vu à l'écran sur une réservation réelle : « Mode : Classique (sans balise) ».

`creer_la_session_de_mission` décidait du mode par `inventoristes >= 3` — les
gens qu'on envoyait. En location ce nombre vaut **0** par construction : tout
inventaire loué naissait donc sans zones, **même à neuf téléphones**.

Les zones répartissent le magasin et font suivre l'avancement. À neuf
compteurs sans elles, personne ne sait qui compte quoi, et deux personnes
recomptent le même rayon.

⚠️ **ET MA CORRECTION ÉTAIT ENCORE FAUSSE.** J'ai remplacé `inventoristes` par
`appareils` — le bon nombre — **en gardant le seuil**. Julien : « l'inventaire
doit toujours être créé avec des zones de comptage, c'est la norme. »

Le seuil lui-même n'avait pas lieu d'être. Sur le chemin ordinaire de
Quantinvo OS, le superviseur coche « organisation du comptage » et la case est
**cochée par défaut** ; sur une mission, personne n'est là pour choisir. Faire
dépendre le mode d'un seuil, c'était livrer au client un inventaire moins bien
rangé que celui qu'il aurait créé lui-même.

`uses_zones` vaut **`true`**, sans condition. Vérifié sur la plus petite
réservation possible : 1 500 pièces, 1 appareil, `uses_zones = true`.

⚠️ Et la garde a mordu sur ses propres commentaires — ceux qui CITENT les deux
seuils écartés pour expliquer pourquoi ils le sont. Troisième fois dans la même
journée : **une garde lit le code sans ses commentaires**, sinon interdire un
motif interdit aussi de l'expliquer.
