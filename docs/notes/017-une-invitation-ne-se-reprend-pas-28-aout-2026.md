# Une invitation ne se reprend pas (28 août 2026)

Constat n°3 de la revue de sécurité. **`team_invitations.email` est unique pour
toute la base, pas par entreprise** — et `invite-teammate` écrivait sa ligne en
`upsert` sur cette colonne, **avec la clé de service, donc hors RLS**, sans
regarder à qui elle appartenait.

Le chemin, en trois temps. S'il existe une invitation en attente pour
`bob@exemple.fr` avec `role = 'company_admin'`, un superviseur de **n'importe
quelle autre entreprise** ajoute cette adresse à son équipe :

1. l'`upsert` bascule `company_id` sur la sienne ;
2. **`role` n'était pas dans la charge**, donc PostgREST ne le met pas à jour —
   la valeur privilégiée survit à l'écrasement ;
3. `handle_new_user` honore la ligne à l'inscription. La personne devient
   administrateur de l'entreprise de l'attaquant.

La fenêtre est étroite : il faut une invitation privilégiée dont le compte
`auth` n'a pas encore été créé, ce qui n'arrive que si l'envoi a échoué en
cours de route. Le geste correct existait pourtant déjà à côté —
`ca_invite_supervisor` refuse dès qu'une invitation existe pour l'adresse.

## Deux invariants, en base

Migration `20260828150001`, déclencheur `team_invitations_figees` :

- une invitation **ne change pas d'entreprise** ;
- une invitation **ne change pas de rôle**.

Les deux se défont de la même façon : on **annule et on réinvite**. Un geste
délibéré et tracé, plutôt qu'un effet de bord d'`upsert`.

**⚠️ Ce déclencheur vaut pour TOUS LES RÔLES, `service_role` compris.** C'est
ce qui le distingue de `profiles_pin_privileged`, qui ne mord que sur
`authenticated` et `anon` : ici le trou est précisément dans un chemin en clé
de service, le borner aux rôles clients ne fermerait rien. **Ne jamais y
ajouter de condition sur `current_user`** — un test le vérifie.

Ce que ça ne casse pas, vérifié fonction par fonction avant d'écrire :
**aucune fonction du produit ne fait d'UPDATE sur `team_invitations`**. Les
trois fonctions d'invitation (`admin_invite_company_admin`,
`ca_invite_supervisor`, `invite_company_admin_after_payment`) font des INSERT ;
`handle_new_user`, les annulations et les purges font des DELETE. Le seul
UPDATE du produit était cet `upsert` — celui qu'on ferme.

## Et un refus lisible, dans la fonction edge

Le déclencheur suffit à fermer le trou, mais il répondrait par une exception.
`invite-teammate` lit donc l'invitation existante **avant** d'écrire, et
refuse en deux cas :

- **une autre entreprise** → `code: 'other_company'`, le même que pour un
  compte existant ailleurs, avec le même soin : on ne nomme jamais l'autre
  entreprise ;
- **la même entreprise, mais un autre poste** (`role <> 'employee'`) →
  `code: 'already_invited'`. Un superviseur ne reprend pas l'invitation d'un
  superviseur ou d'un administrateur, fût-elle de chez lui.

**⚠️ Et `role: 'employee'` est désormais posé explicitement dans la charge de
l'`upsert`.** Sans cette ligne, le rôle de la ligne existante survit — c'est la
moitié du défaut, et elle ne se voit pas à la lecture : l'absence d'une colonne
dans un `upsert` ne veut pas dire « remets-la à sa valeur par défaut », elle
veut dire « n'y touche pas ».

⚠️ **La fonction edge a été redéployée** (version 24, `verify_jwt: true`
inchangé) — le dépôt ne déploie rien tout seul. Vérifié après coup : elle
démarre et atteint son code (`{"success":false,"error":"Session expirée."}` sur
un appel sans session valable).

Vérifié en base, en transaction annulée, sur deux entreprises réelles : une
invitation `company_admin` posée pour A, sa reprise par B **refusée**, son
changement de rôle **refusé**, une correction de prénom acceptée, et
l'annulation-puis-réinvitation acceptée.

⚠️ **`session_invitations` n'a pas ce défaut** : sa contrainte d'unicité porte
sur `(session_id, email)`, donc elle est déjà bornée à un inventaire. Vérifié —
il n'y avait rien à y faire.

Tests de garde : `web/tests/admin-entreprise.test.ts`, bloc « une invitation ne
se reprend pas ».
