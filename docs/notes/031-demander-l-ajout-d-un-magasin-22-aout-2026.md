# Demander l'ajout d'un magasin (22 août 2026)

Un client ouvre un magasin. Il n'avait **aucun moyen de le dire depuis le
produit** : seul Quantinvo crée un magasin (`admin_add_store`, gardée par
`is_admin()`), parce que **la licence se facture par magasin**. Il fallait
téléphoner. Demande de Julien : un bouton.

**La règle qui porte tout le reste : une demande ne crée pas de magasin.**
`ca_request_store` n'insère que dans `store_requests` ; un test échoue si elle
touche un jour à `stores`. La création reste chez Quantinvo, et le devis reste
une conversation — comme pour une nouvelle entreprise.

Migration `20260822130001`, table `store_requests` (RLS lecture pour
l'administrateur Quantinvo et celui de l'entreprise, **aucune policy
d'écriture**), et six fonctions :

- côté client, gardées par `is_company_admin()` : `ca_request_store`,
  `ca_list_store_requests`, `ca_cancel_store_request` ;
- côté Quantinvo, gardées par `is_admin()` : `admin_list_store_requests`,
  `admin_fulfil_store_request`, `admin_reject_store_request`.

Points à ne pas défaire :

- **`admin_fulfil_store_request` appelle `admin_add_store`**, il ne recopie pas
  la génération du code d'accès. Deux chemins de création divergeraient un
  jour, et le magasin né d'une demande ne serait plus tout à fait un magasin.
  Effet visible et voulu : deux lignes au journal Quantinvo
  (`magasin_ajoute` puis `demande_magasin_creee`).
- **Les deux doublons sont refusés à la saisie** — un magasin qui porte déjà ce
  nom, une demande déjà en cours pour ce nom (comparaison en minuscules, nom
  détouré). Sans cela la même demande arrive trois fois et c'est Quantinvo qui
  fait le tri.
- **Une demande traitée ne se rejoue ni ne s'annule** : `admin_fulfil` refuse
  ce qui n'est plus `pending`, `ca_cancel` ne supprime que du `pending`. Une
  demande traitée est une trace, pas un brouillon.
- **Le motif de refus est repris tel quel sur l'écran du client.** « Refusée »
  tout court laisse l'administrateur d'entreprise sans rien à faire de
  l'information.
- **Purge à un an**, dans `purge_expired_data` comme le reste — mais seulement
  ce qui est traité (`handled_at is not null`) : une demande en attente attend.

Côté écrans :

- **`/magasins`** porte le bouton, pour le seul administrateur d'entreprise, et
  la liste de ses demandes (sans cela la même demande part trois fois). ⚠️ Son
  **état vide a été récrit** : « contactez l'administrateur de votre
  entreprise » s'adressait à l'administrateur de l'entreprise — le piège déjà
  rencontré côté mobile. Il renvoie maintenant vers /equipe, où il peut
  s'affecter un magasin lui-même.
- **`/admin`** fait remonter les demandes en tête de « À traiter » : c'est du
  revenu qui attend, ça passe avant les alertes d'usage. Deux appels au
  chargement plutôt qu'un — `admin_business_overview` est une vue d'affaires,
  pas une boîte de réception.
- **La fiche entreprise** porte « Créer le magasin » et « Refuser », juste
  au-dessus des magasins : une demande précède la création.

## Le formulaire de demande est celui de l'inscription

Correction du même jour, capture de /inscription à l'appui : *« c'est ça qu'il
faut comme formulaire de demande »*. Le premier jet ne demandait qu'un nom — or
**la licence se tarife au volume de stock**. Une demande sans stock est une
demande que Quantinvo ne peut pas deviser, donc un aller-retour de plus.

La carte de saisie (nom, stock théorique, surface, **tranche tarifaire affichée
à la frappe**) est sortie de `/inscription` dans
`web/components/MagasinSaisie.tsx` et sert aux deux écrans. Une seule
définition : les libellés, les unités et la tranche affichée ne doivent pas
diverger entre le parcours d'inscription et la demande. Migration
`20260822140001` (colonnes `units` / `sqm`).

Trois points :

- **Le stock est exigé, la surface non** : le premier donne le prix, la seconde
  ne sert qu'au recoupement.
- **Le recoupement stock / surface ne sort pas de la console.** Comme sur la
  fiche d'une demande d'entreprise : affiché au client, il lui indiquerait quel
  chiffre ajuster pour changer de tranche. La fiche entreprise montre donc
  pièces, m², pièces/m², tranche et prix ; l'écran du client ne montre que la
  tranche de ce qu'il vient de saisir.
- **L'ancienne signature `ca_request_store(text, text)` est supprimée**, pas
  laissée à côté de la nouvelle : Postgres garderait les deux et un appel à deux
  arguments deviendrait ambigu.

Vérifié en base le 22 août 2026, sessions simulées par `request.jwt.claims`,
**tout en transactions annulées** : demande créée, les trois refus de saisie
(doublon de demande, doublon de magasin, nom vide), refus opposé au superviseur
ordinaire comme aux deux fonctions Quantinvo, création réelle du magasin avec
son code, statut `created` relié au magasin, journaux des deux côtés, rejeu
refusé, et le motif de refus bien visible côté client. Aucune ligne résiduelle,
`anon` refusé sur les six fonctions. Le volume voyage bien (180 000 pièces,
1 200 m²), le stock manquant, nul ou absurde est refusé, et il ne reste qu'une
seule signature de `ca_request_store`.

**La carte de saisie, elle, a été vue au navigateur** : /inscription est
publique, donc la sortie du composant a pu être vérifiée pour de vrai — mise en
page identique, et la tranche s'affiche toujours à la frappe (180 000 →
« Grande surface — 50 001 à 200 000 · 6 600 € / an », total mis à jour).

### Passe de finition, sur capture de Julien (« barre de saisie à revoir »)

Le formulaire vu en production a montré quatre défauts, dont deux qui ne
tenaient pas à cet écran :

- **Le champ « nom du magasin » n'avait jamais eu d'habillage.** `.magasin-top
  input` ne portait qu'un `flex: 1` : dans la carte de 520 px de /inscription
  cela passait presque, dans l'espace connecté (1120 px) il devenait une barre
  d'un autre monde que les deux champs juste dessous. Il reprend exactement
  `.field input`.
- **Les champs étaient de la couleur de leur carte** (`--bg` sur `--bg`) : ils
  ne se lisaient que par leur filet. Ils passent à `--surface`, dans les deux
  thèmes.
- **Le formulaire prenait les 1120 px de l'espace connecté** — 150 caractères
  par ligne pour l'introduction, 1700 px pour un nom de vingtaine de signes.
  `.demande-magasin` le ramène à 560 px, la largeur utile de la carte
  d'inscription dont il est repris, **centré dans la page** (demande de Julien).
  La liste des demandes en cours, elle, reste alignée à gauche sur toute la
  largeur : c'est une liste d'enregistrements, comme celle des magasins
  au-dessus.
- **La pastille de rang a disparu quand il n'y a qu'un magasin** (`numero`
  devient facultatif) : numéroter un élément unique n'apprend rien.

Deux corrections systémiques au passage, valables pour tous les formulaires du
site : un **anneau de focus** (`box-shadow`) là où seul le changement de
bordure signalait le focus malgré `outline: none`, et la ligne de tranche
passée de `--text-3` à `--text-2` — 2,9:1 sur le fond de la carte, sous le
seuil AA, à l'endroit précis où l'on lit le prix. Les zones de texte ne se
redimensionnent plus qu'en hauteur.

Vérifié au navigateur, clair et sombre, par une **route jetable** rendant le
formulaire hors session (`/tmp-polish`, retirée ensuite — vérifier au
`git status` qu'elle n'est pas restée).

**Non vu à l'écran** : `/magasins` et la console demandent une session
connectée. Maquette validée avant codage :
https://claude.ai/code/artifact/1b6dfbe0-6866-4af9-a5ab-c6e6b1188231

### Une demande aboutie quitte l'écran du client, et se dit par e-mail

Constat de Julien, capture à l'appui : « Alltricks — Magasin créé » restait
affiché sous « Demandes de magasin », alors que le magasin avait été créé puis
supprimé (c'était un essai). La liste montrait une trace sans objet, sous un
titre qui annonce des demandes en cours.

Règle posée (migration `20260822200001`) : **la liste du client ne garde que ce
sur quoi il peut encore agir** — les demandes en attente, qu'il annule, et les
refusées récentes, dont il doit lire le motif. Les demandes abouties
(`created`, `removed`) sortent de l'écran : le magasin apparu — ou disparu —
dans la liste juste au-dessus est la confirmation. **La trace ne bouge pas** :
la ligne reste en base, visible 90 jours dans la console Quantinvo, purgée à un
an comme les journaux. On cesse d'afficher, on n'efface pas.

Deux e-mails accompagnent le parcours, par deux fonctions edge :

- `ca-request-store` — accusé de réception, à l'envoi de la demande ;
- `admin-fulfil-store-request` — « votre magasin est créé », quand Quantinvo
  crée.

Quatre points à ne pas défaire :

- **Elles n'ajoutent aucun droit.** Chacune appelle sa RPC **avec le jeton de
  l'appelant** (`is_company_admin()` / `is_admin()`, exigence aal2 comprise).
  Une création jouée en `service_role` contournerait toute la garde.
- **Le code d'accès du magasin ne part jamais par e-mail** : il ouvre l'entrée
  dans le magasin. Le message renvoie vers la fiche, où il se lit derrière une
  session. `admin_fulfil_store_request` ne le met pas non plus dans son objet
  `notify`.
- **Un e-mail qui ne part pas n'annule rien.** La ligne est déjà écrite quand
  on envoie : l'échec se dit (`emailed: false`), il ne fait pas croire que
  rien n'a été fait.
- **Les deux écrans retombent sur la RPC directe** si l'edge est injoignable —
  une demande qui passe sans accusé vaut mieux qu'une demande qui ne passe pas.

**Le refus part aussi par e-mail**, motif compris (ajouté dans la foulée, à la
demande de Julien) : `admin-reject-store-request`, et l'objet `notify` sur
`admin_reject_store_request` (migration `20260822210001`). Deux points : le
motif **voyage tel quel** — c'est déjà la règle de l'écran, « Refusée » tout
court ne dit pas quoi faire — et `kind` voyage avec lui, parce qu'un refus
d'ajout et un refus de suppression ne se disent pas de la même façon. La
demande refusée reste par ailleurs trente jours sur l'écran du client.

Tests de garde : `web/tests/demande-magasin.test.ts`, bloc « une demande
aboutie quitte l'écran ». Les deux fonctions edge **sont déployées** (22 août
2026) ; toute modification demande un redéploiement, le dépôt ne déploie rien.

## Demander la suppression d'un magasin (même jour)

*« Sur page magasin ajouter bouton de demande de suppression. »* Symétrique de
l'ajout, et pour la même raison : la licence se facture par magasin, donc
Quantinvo reste seul à supprimer comme il est seul à créer. Le bouton vit en
bas de la fiche d'un magasin, la demande s'annule tant qu'elle est en attente.

**Même table**, distinguée par `kind` (`add` / `remove`) : une seule boîte de
réception, une seule purge, un seul écran côté console. Le statut gagne
`removed` — « créé » ne se dit pas d'une suppression. Migration
`20260822180001`.

⚠️ **Un piège trouvé en l'écrivant, et qui existait avant :
`admin_delete_store` échouait.** Elle ne faisait qu'un `delete from stores`, or
`inventory_sessions.store_id` référence `stores` en **NO ACTION** — la
suppression partait donc en violation de clé étrangère dès que le magasin avait
connu un inventaire. **Le bouton « Supprimer » de la fiche entreprise était
cassé pour tout magasin ayant servi**, et une demande de suppression impossible
à honorer aurait été pire. Vérifié à la source : la suppression nue répond
`violates foreign key constraint "inventory_sessions_store_id_fkey"`.

La fonction supprime maintenant les inventaires du magasin d'abord — comme
`admin_delete_company` le fait pour une entreprise — et **les deux écrans le
disent avant** : « Ses inventaires et tous leurs comptages seront effacés. »
Ne pas retirer cette phrase : c'est elle qui rend le geste honnête.

Vérifié en base, en transactions annulées : demande créée, doublon refusé,
suppression honorée sur un magasin **portant un inventaire et des comptages**
(magasin parti, inventaires partis, demande en `removed` et détachée du magasin
disparu, journaux des deux côtés).

Tests de garde : `web/tests/demande-magasin.test.ts`.
