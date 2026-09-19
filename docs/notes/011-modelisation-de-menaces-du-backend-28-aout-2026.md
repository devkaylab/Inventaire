# Modélisation de menaces du backend (28 août 2026)

Balayage des 127 fonctions de `public` (121 en `SECURITY DEFINER`), des 38
policies RLS, des déclencheurs et des 17 fonctions edge. Cinq constats, tous
corrigés le jour même. Rapport hors dépôt :
`Risk_Assessment_Report/QUANTINVO-BACKEND-RAPPORT.md`.

**⚠️ La méthode compte autant que les constats : par MOTIF de défaut, pas par
lecture linéaire.** Lire 180 Ko de définitions à la file trouve mal et coûte
cher. Les sept motifs balayés sont ceux qui ont réellement produit des constats
sur ce projet : garde d'autorisation absente, garde portant sur un paramètre
plutôt que sur la ligne visée, droits trop larges, écriture sans borne
d'appartenance, lecture-puis-écriture, invariant de déclencheur contournable par
un autre verbe, policy court-circuitant la couche RPC. Chacun se pose en une
requête sur les catalogues. **Refaire ce travail depuis le dépôt plutôt que
depuis la base, c'est le refaire pour rien** — les migrations divergent.

## VR-006 · Un refus écrasait une acceptation (`20260828260001`)

Le plus grave. `accept_quote_by_token` gardait sa transition
(`and status = 'quoted'`), **`decline_quote_by_token` ne la gardait pas** — et
les deux gestes sont sur la même page, sous le même jeton.

Accord et refus concurrents : les deux lisent `quoted`, l'acceptation passe et
pose `accepted`, le refus attend la levée du verrou puis **écrase en
`declined`**. Or `accept-quote` a déjà rendu son adresse Stripe. Le client
paie → `fulfil_paid_request` trouve `declined` → « Transition impossible » →
500 → Stripe réessaie indéfiniment. **Le client a payé et n'obtiendra jamais
rien**, sans réparation automatique.

⚠️ **L'asymétrie entre fonctions sœurs est le signe habituel de l'oubli.** Elle
s'est répétée trois fois dans ce projet : `accept` / `decline`,
`admin_quote_company_request` / `admin_quote_store_request`,
`ca_set_supervisor_stores` / `ca_set_counter_stores`. Quand deux fonctions font
le même geste sur deux tables, les comparer ligne à ligne vaut mieux que les
lire séparément.

## VR-005 · Le double-clic de la console créait en double (même migration)

`admin_fulfil_company_request`, `admin_fulfil_store_request`,
`admin_fulfil_store_removal` et `admin_quote_store_request` : même défaut que
le webhook, sur le chemin manuel. L'acteur est de confiance (`is_admin()`),
donc **ce n'est pas une attaque, c'est un accident** — deux clics sur « Créer
le magasin » pendant que la réponse tarde, et l'entreprise ou le magasin est
créé deux fois, avec deux codes d'accès et une licence facturée en trop.

⚠️ **Ici `for update` SUFFIT, sans garde ajoutée sur l'UPDATE.** Ces cinq
fonctions portent déjà, après la lecture, un contrôle qui rejette l'état
d'arrivée (`status <> 'paid'`, `<> 'pending'`, `<> 'quoted'`) : le second appel
attend, relit la ligne transformée, et son propre contrôle le refuse. C'est ce
qui les distingue de `fulfil_paid_request`, dont le contrôle laissait passer et
où il a fallu garder l'UPDATE en plus. Vérifier ce point avant de recopier le
correctif ailleurs.

## VR-007 · Un superviseur invité pouvait effacer les comptages d'autrui (`20260828270001`)

La policy `counts_delete_supervisor` autorisait
`get_my_role() = 'supervisor' AND is_session_participant(session_id)`, **sans
restriction sur `counted_by`** : tout superviseur participant pouvait supprimer
n'importe quelle ligne de la session, celles de toute l'équipe comprises, en
une requête. Et `counts` n'est pas journalisée — la destruction ne laissait
aucune trace.

⚠️ **C'était la moitié restée ouverte du trou fermé le 21 août.** Ce jour-là,
`delete_session` a été réservée au créateur et à l'administrateur d'entreprise,
et la policy DELETE d'`inventory_sessions` supprimée. L'inventaire était
protégé ; **son contenu se vidait encore ligne à ligne.** Quand on ferme un
droit de suppression, vérifier aussi les tables que l'objet contient.

⚠️ **CE QUE LE RETRAIT NE TOUCHE PAS, ET C'EST LE POINT.** Règle rappelée par
Julien : un superviseur invité sur un inventaire y est parce qu'il supervise
aussi. Il ne peut ni clôturer ni supprimer, **mais il doit pouvoir superviser
et arbitrer**. Rien de cela ne passait par cette policy :

- `resolve_audit` — l'arbitrage, qui pose `final_qty` — est `SECURITY DEFINER`
  gardée par `can_access_session` : hors RLS, inchangée ;
- **`delete_audit_line` est le geste légitime de retrait d'une ligne**, elle
  aussi `SECURITY DEFINER` et gardée par `can_access_session`. Elle supprime
  bien dans `counts`, mais **bornée à un SKU dans une zone**, et elle est
  appelée par l'app (`src/lib/queries.ts`) comme par le site
  (`web/lib/inventory.ts`) ;
- la lecture des comptages (`counts_select_supervisor`) ne bouge pas ;
- `counts` reste en **ajout pur** : aucune policy UPDATE, une correction est une
  ligne négative.

Ce qui disparaît est donc la seule chose qu'aucun écran n'offrait : la
suppression brute, en masse, sur un critère choisi par le client.

## VR-008 · L'invariant de `profiles` se contournait par l'INSERT (même migration)

`profiles_pin_privileged` fige `role`, `company_id` et `is_admin` — mais c'est
un déclencheur **BEFORE UPDATE**, et la policy `profiles_insert` laissait un
client insérer sa propre ligne sans contrainte sur ces colonnes.

⚠️ **Forme exacte de VR-003** : un invariant posé sur un verbe, contourné par un
autre. Non atteignable — `handle_new_user` crée le profil dans la transaction de
l'insertion `auth.users`, `id` est clé primaire, et il n'existe aucune policy
DELETE sur `profiles` — mais **la sûreté tenait à un enchaînement, pas à une
règle**. `profiles_update` reste : chacun modifie son prénom et son nom.

## VR-009 · `join_code` restait modifiable (même migration)

Le code d'accès était bien **illisible** (`authenticated` ne lit que
`company_id, created_at, id, name` sur `stores`), mais la révocation d'origine
n'avait porté que sur `SELECT` : `INSERT`, `UPDATE` et `REFERENCES` restaient.
Inexploitable — ces tables n'ont aucune policy d'écriture — mais le jour où
quelqu'un ajouterait une policy UPDATE sur `stores`, le code deviendrait
modifiable par un superviseur.

⚠️ **Trois de ces cinq correctifs sont des RETRAITS, pas des resserrements.**
Règle apprise avec `get_company_directory` : une permission que personne
n'appelle et qui ouvre plus que nécessaire n'a pas besoin d'un contrôle, elle a
besoin d'être injoignable. Chaque retrait a été précédé d'une vérification de
l'absence d'appelant dans l'app, le site **et** les fonctions edge.

## Ce qui a été balayé et qui tient

- **Aucune fonction `SECURITY DEFINER` appelable par un client n'est dépourvue
  de contrôle.** Les seules sans garde sont les quatre du parcours de devis (le
  jeton tient lieu de clé) et quatre fonctions pures en `invoker`.
- **Les paramètres en tableau sont vérifiés élément par élément** :
  `ca_invite_supervisor` et `ca_set_supervisor_stores` comptent les magasins de
  l'entreprise et refusent si le compte diffère. Aucune affectation croisée
  possible.

## Deux fonctions sœurs traitent la même erreur pareil (`20260828280001`)

Relevé comme observation pendant le balayage, corrigé ensuite à la demande de
Julien. `ca_set_supervisor_stores` **refusait** une liste contenant un magasin
d'une autre entreprise ; `ca_set_counter_stores` le **filtrait** silencieusement
et rendait `success: true`.

Aucune fuite dans les deux cas — c'est pourquoi ce n'était pas un constat. Mais
les deux servent **le même geste à l'écran** (`changerMagasins` route selon le
rôle) : l'administrateur voyait son action échouer franchement sur un
superviseur et réussir à moitié sur un compteur, avec moins de magasins
affectés qu'il n'en avait cochés et rien pour le lui dire. Le journal
enregistrait le compte filtré, ce qui rendait l'écart invisible après coup.

⚠️ **Ce qui reste différent, et doit le rester : la liste vide.** Un compteur
sans magasin est un état normal — c'est même ce qui a justifié d'écrire cette
fonction le 23 août, un compteur retiré de son dernier magasin devenant
invisible partout et donc irrécupérable. Un superviseur, lui, garde toujours au
moins un magasin : pour le détacher, on lui retire le rôle. Ne pas « aligner »
cette différence-là.

Vérifié en transaction annulée, session d'administrateur simulée, sur les
données réelles : magasin étranger refusé avec le message exact de la jumelle,
liste vide acceptée, magasin de l'entreprise accepté.
- **Les 17 policies de lecture sont toutes cloisonnées** par entreprise, session
  ou personne.
- **Le formulaire public superviseur est bien éteint** : `submit-supervisor-request`
  répond **410 Gone**, vérifié en direct.
- **`admin-metrics`** existe et n'était documentée nulle part : fonction edge
  correctement gardée (`is_admin()` avec le jeton de l'appelant, 403 sinon, clé
  de métriques qui ne quitte pas le serveur). Rien à corriger.

## Limites

Aucune exploitation exécutée, aucune donnée de production modifiée. **VR-006 et
VR-005 n'ont pas été reproduits en concurrence réelle** — une session ne peut
pas se faire la course à elle-même ; ce qui est vérifié, c'est qu'un refus après
acceptation est désormais rejeté. Et **le balayage est par motif, donc
incomplet par construction** : il garantit qu'aucune des sept formes connues ne
se cache ailleurs, pas qu'il n'en existe pas d'autres. Le contenu métier des
fonctions n'a pas été relu — un défaut de calcul sortirait de ce périmètre.

Tests de garde : `web/tests/backend-durcissement.test.ts`.
