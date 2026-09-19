# Supprimer un inventaire : créateur ou administrateur d'entreprise (21 août 2026)

`delete_session` ne vérifiait que `can_access_session`, c'est-à-dire **n'importe
quel superviseur participant**. Le bouton était caché aux autres côté
navigateur ; la fonction ne l'était pas. Un co-superviseur pouvait effacer
comptages, stock théorique, audits, membres et référentiel d'un inventaire
qu'il n'avait pas créé — même famille que le trou d'`advance_pass`.

Règle arrêtée par Julien : **le créateur** pour ses propres inventaires,
**l'administrateur d'entreprise** pour tous ceux de son entreprise, y compris
ceux auxquels il ne participe pas — c'est justement son rôle. Migration
`20260821250001`. Le créateur rétrogradé en compteur perd le droit avec le
rôle, et `is_company_admin()` porte l'exigence aal2 conditionnelle.

L'écran applique la même règle : sur la liste des inventaires, la case à cocher
et la corbeille n'apparaissent que sur ce qu'on peut supprimer, plutôt que de
laisser découvrir le refus après coup.

**Sélection multiple** sur `/dashboard`, trois précautions à ne pas relâcher :

- « Tout sélectionner » ne porte que sur `filtered`, la liste **après
  recherche**. Sur `sessions`, un « tout » déborderait de ce que la personne
  voit.
- La confirmation **nomme** les inventaires (huit au plus, puis « et N
  autres ») et signale ceux encore en cours.
- Il n'existe pas de RPC de suppression groupée : on appelle `delete_session`
  une fois par inventaire et **on rapporte les échecs** au lieu d'annoncer un
  succès global. Sur dix inventaires, un refus ne doit pas passer inaperçu.

**Un inventaire clôturé ne se rouvre que par son créateur** (ou l'administrateur
d'entreprise). Migration `20260821250002`, qui referme deux trous de la même
famille :

- la policy UPDATE de `inventory_sessions` acceptait n'importe quel superviseur
  participant : un invité pouvait rouvrir un inventaire clôturé, et un rapport
  déjà exporté se remettait à bouger. La garde tient sur la **ligne existante**
  (`status <> 'closed' or created_by = auth.uid() or is_company_admin(...)`) —
  clôturer et préparer restent ouverts aux participants, ce sont des gestes de
  terrain que le créateur peut défaire ;
- la policy DELETE acceptait elle aussi tout participant, ce qui permettait de
  **court-circuiter `delete_session`** en supprimant la ligne en direct, et de
  laisser comptages, articles et audits orphelins. Elle est supprimée : la
  suppression passe par la fonction, SECURITY DEFINER donc hors RLS.

**La liste sépare les siens des invités.** `/dashboard` groupe par magasin les
inventaires qu'on a créés, puis affiche « Inventaires invités » à part, avec la
raison écrite : on peut y compter et lire le rapport, la clôture définitive et
la réouverture appartiennent au créateur. Dire la règle par la mise en page
évite de la découvrir au moment du refus.

**Ajouter quelqu'un à un inventaire : on cherche, on ne saisit pas.** L'onglet
Équipe d'un inventaire proposait, sur le site, un formulaire prénom / nom /
e-mail qui appelait `invite-teammate` — la fonction qui **crée un compte pour
l'entreprise**. Deux choses clochaient : ce n'est pas le geste attendu là
(créer un compteur se fait depuis « Mon équipe »), et surtout **personne
n'était ajouté à l'inventaire**. On remplissait le formulaire, l'équipe de
l'inventaire ne bougeait pas.

`AddSessionMember` cherche désormais dans l'équipe du magasin
(`get_store_directory`), suggestions à la frappe, et appelle
`invite-to-session` — la même edge function que l'app mobile, qui refuse les
adresses sans compte. Les personnes déjà dans l'inventaire ne sont pas
proposées. **`AddCounter` reste en place sur /equipe** : c'est là que créer un
compte a un sens, ne pas confondre les deux.

**L'app suit le même découpage** : l'écran d'accueil du superviseur
(`(supervisor)/index.tsx`) sépare « Mes inventaires » et « Inventaires
invités », avec la même explication. Le bloc « En cours » qui coiffait la liste
a disparu : il répétait les inventaires en cours, dont le statut figure déjà
sur chaque tuile.

Tests de garde : `web/tests/suppression-inventaire.test.ts` et
`tests/compte.test.ts` (bloc « accueil superviseur »).

(Les deux droits qui manquaient ici — suppression des comptes par
l'administrateur d'entreprise, demande d'ajout de magasin — ont été tranchés
et construits le 22 août 2026 : voir les deux sections suivantes.)
