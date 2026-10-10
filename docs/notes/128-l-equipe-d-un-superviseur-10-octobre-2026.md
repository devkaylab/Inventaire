# ⚠️⚠️ L'équipe d'un superviseur, et le mot de passe qui manquait — 10 octobre 2026

Julien, deux demandes dans le même message :

> « Dans mon équipe, le superviseur doit voir son équipe à lui en premier et
> ensuite celle de ses collègues. Et le superviseur n'a pas le droit de retirer
> un membre d'une autre équipe que la sienne. […] Il peut quand même ajouter des
> personnes d'autres équipes du magasin à ses inventaires. »

Puis, en vérifiant une personne précise :

> « Vérifie bien que Julia a bien un mdp, je crois qu'elle n'a pas été au bout. »

Julia était allée au bout — mesuré. Mais la question a fait tomber un défaut
plus grave, introduit **le jour même**.

## 1. « Mon équipe » n'existait pas en base

Le 23 août 2026, décision écrite (« option A ») :

> « Le superviseur choisi ne s'enregistre nulle part : "le superviseur d'un
> compteur" n'existe pas en base, c'est le magasin qui relie les deux. […] On
> encadre un magasin, pas des personnes. »

`store_team` ne retenait donc que `(magasin, personne)`. `team_invitations`
savait qui invitait, mais **la ligne est effacée dès que le compte est créé**.

La demande de Julien renverse cette décision. D'où **`store_team.ajoute_par`**.

⚠️ **Ce qui NE change pas, et c'est le cœur** : le magasin reste l'unité
d'accès. Le superviseur voit **tout le monde** dans ses magasins et met qui il
veut sur ses inventaires. On sait seulement, en plus, qui a fait entrer qui.

### La règle est posée par des déclencheurs, pas par chaque appelant

**Onze endroits** insèrent dans `store_team` — inscription, onboarding,
changement de rôle, arrivée sur un inventaire. Demander à chacun de porter
`ajoute_par`, c'est garantir qu'un oublié subsistera, et qu'un douzième naîtra
sans. Même leçon que `role_de_session` (fiche 123).

Un déclencheur `before insert` le remplit, dans cet ordre :

1. **l'invitation d'équipe en attente** — son auteur est celui qui fait entrer.
   ⚠️ Elle est encore là : `handle_new_user` insère dans `store_team` **avant**
   de supprimer l'invitation ;
2. l'invitation à un inventaire, même raisonnement ;
3. à défaut, l'appelant.

⚠️ **Jamais la personne elle-même** : à l'inscription, `auth.uid()` EST le
nouveau venu — sans cette borne il se ferait entrer tout seul.

### La règle de départ, demandée par Julien

> « Si un superviseur part, les compteurs passent sous admin le temps d'avoir un
> nouveau superviseur pour reprendre l'équipe. »

Tenue **deux fois**, parce qu'il y a deux façons de partir :

- `on delete set null` sur la colonne — la **suppression du compte** ;
- ⚠️ un déclencheur `after delete` sur `store_supervisors` — la simple **perte
  du magasin** (« Retirer les accès », passage en compteur, réaffectation), que
  la clé étrangère ne voit pas.

`ajoute_par` nul veut dire exactement « sous la responsabilité de
l'administrateur ».

### ⚠️ Le refus est en base, pas à l'écran

`remove_counter_from_store` exige `ajoute_par = auth.uid()` pour un
superviseur ; l'administrateur passe. Cacher le bouton n'aurait rien fermé —
une porte fermée à l'écran seulement s'ouvre avec une adresse (fiche 123).

## 2. ⚠️⚠️ `is_active` ne dit pas que le mot de passe existe

`is_active` vaut `last_sign_in_at is not null`. Or **`verifyOtp` EST une
connexion** : cliquer « Continuer » sur le lien d'invitation la pose, **avant**
que le mot de passe soit choisi.

Conséquence : la personne exactement dans le cas de la fiche 127 — interrompue
entre le clic et le mot de passe — passait **« active »**. Le badge ambre
disparaissait, et avec lui le bouton « Renvoyer le lien » posé quelques heures
plus tôt. **Celui qui en avait le plus besoin était le seul à ne pas l'avoir.**

Le vrai signal est `encrypted_password`. Les deux fonctions de lecture exposent
désormais `a_un_mot_de_passe`. ⚠️ `is_active` **survit à côté** : « s'est déjà
connecté » reste une information utile ; ce qui était faux, c'est de lui faire
dire « a fini son inscription ».

⚠️⚠️ **Et une garde PROTÉGEAIT ce défaut.** `pages-connectees.test.ts` exigeait
que l'ambre suive `is_active`, au nom du contresens corrigé le 23 août. Elle a
figé la mauvaise moitié de la leçon pendant sept semaines.

## Ce qui a été mesuré

Sur le **jumeau**, par de vraies invitations, dans un bloc terminé par un
`raise exception` — donc rien d'écrit :

| | |
|---|---|
| qui a fait entrer CA / CB | **A** / **B** |
| A retire le compteur de B | **refusé** |
| ce que A voit | **le sien d'abord** `[a_moi=true mdp=false]`, puis celui de B `[a_moi=false mdp=true]` |
| A retire le sien | accepté |
| l'administrateur retire n'importe qui | accepté |
| A quitte le magasin | son équipe **repasse à l'admin** |

La quatrième ligne prouve les deux chantiers d'un coup : CA s'était connecté et
n'avait pas de mot de passe.

## ⚠️ Trouvé par `get_advisors`, APRÈS application

Mes deux fonctions de déclencheur étaient **exécutables par `authenticated`**.
Supabase accorde `EXECUTE` par défaut sur toute fonction neuve, et un
`revoke … from public, anon` **ne l'enlève pas**. Relevé : les treize autres
déclencheurs du produit sont fermés, ces deux-là étaient les seules ouvertes.

C'est précisément ce que la règle « appliquer, puis contrôler » existe pour
attraper : le rejeu ne l'aurait pas vu.

## Les gardes

`web/tests/l-equipe-d-un-superviseur.test.ts` — **huit sabotages, huit
morsures**.

⚠️ **Deux gardes citaient la FORME du code** (`=> (` de la flèche) et sont
tombées sur du code juste quand le bloc a pris un corps. Réancrées sur le
découpage. **Troisième fois** que ce piège se présente.

## ⚠️ Ce qui n'est pas vérifié

**L'écran du superviseur n'a pas été exercé avec deux superviseurs** : il
faudrait un second compte. Ce qui est tenu à sa place : le banc sur le jumeau,
qui joue exactement ce cas en base.

## ⚠️⚠️ Un bouton rangé dans un menu n'existe pas (10 octobre, le soir)

« Tu n'as pas ajouté de bouton renvoyer le lien sur admin. » Il **y était**,
depuis la correction du matin — dans le menu « ⋯ » de la rangée, en tête de
liste. Personne ne l'a trouvé.

Le menu « ⋯ » de `/equipe` n'est pas un rangement, c'est une **distance** :
il existe pour éloigner « Supprimer le compte » de ce qui est anodin et
réversible. Y déposer le renvoi du lien faisait exactement l'inverse de ce
que le menu sert à faire — mettre le seul geste attendu face à une ligne
ambre au même endroit que le geste définitif, derrière le même clic
d'ouverture. Le superviseur, lui, l'avait en clair : deux écrans, deux
réponses au même fait.

Il est désormais rendu **dans la cellule ambre**, sous « Mot de passe à
créer » : le manque et son remède dans la même cellule, là où le regard est
déjà. Le menu garde les gestes de gouvernance (changer le rôle, retirer les
accès, supprimer). `align-self: flex-start` n'est pas du goût : `.membres > *`
est une colonne flex étirée, sans lui le bouton prend toute la largeur de la
colonne et se lit comme une barre.

### Et la bande de résumé mentait encore

« Mot de passe à créer » comptait `!m.is_active`. Le badge et le bouton
avaient été corrigés le matin, **pas le compteur au-dessus d'eux** : la bande
pouvait annoncer « 0 » au-dessus de lignes ambre. Troisième endroit du même
contresens sur le même écran — la leçon n'est pas « corriger le badge », c'est
**chercher tous les lecteurs d'un signal qu'on remplace**.

### ⚠️ Une garde gelait le défaut

`web/tests/admin-entreprise.test.ts` exigeait `toContain('!m.is_active')`
(21 août 2026). Elle serait tombée au vert sur l'écran faux et au rouge sur
le juste. Elle exige maintenant `!m.compte_finalise` **et refuse le retour de
l'ancien**. Deuxième garde de ce genre en deux jours (l'autre :
`pages-connectees.test.ts`). Une garde écrite avec un signal faux rend ce
signal obligatoire.

Trois sabotages sur `renvoyer-le-lien.test.ts`, trois morsures — dont celle
du bouton neutralisé par un `false &&`, qui ne mordait pas avant d'ancrer la
garde sur la CONDITION et plus seulement sur la présence du bouton.

## ⚠️ Ce qui n'est pas vérifié (suite)

**L'écran de l'administrateur n'a pas été regardé après cette correction** :
il demande une session d'administrateur, que seul Julien ouvre.

## ⚠️⚠️ « Un lien vient de partir » — alors que rien ne partait

Après la correction du bouton, Julien clique. L'écran : « Un lien vient de
partir à marc@… ». Rien n'arrive. Il réessaie par « Mot de passe oublié ».
Même phrase, même silence. **Une heure**, et la seule trace était dans les
journaux du serveur :

```
09:13:10  generateLink User with this email not found
09:15:44  generateLink User with this email not found
```

### La cause immédiate : un compte posé à la main n'est pas un compte

J'avais créé Marc Oberlin par un `insert` dans `auth.users`. La rangée était
incomplète, et **`instance_id` valait NULL** : le serveur d'authentification
cherche ses comptes en filtrant sur cette colonne, il ne trouvait donc rien.
Manquaient aussi `created_at`, `updated_at`, `raw_app_meta_data`, les colonnes
de jetons (vides, pas NULL) et **la ligne `auth.identities`**.

La leçon n'est pas « il manquait une colonne ». C'est qu'**écrire une rangée
dans `auth.users` n'est pas créer un compte** : la forme attendue n'est pas
documentée dans le schéma, elle est dans le code de GoTrue. Réparé en
comparant colonne par colonne avec un vrai compte invité — c'est la seule
méthode qui ne devine pas.

### La cause réelle : l'écran promettait ce qu'il ne pouvait pas savoir

`mot-de-passe-oublie` est **publique** et répond toujours
`{success: true, received: true}`, qu'un compte existe ou non. C'est JUSTE :
autrement le formulaire devient un oracle d'énumération d'adresses (défaut
fermé le 28 août 2026), et c'est l'e-mail — qui n'atteint que le propriétaire
de la boîte — qui dit la vérité.

Mais l'écran de l'équipe appelait cette fonction publique et annonçait
ensuite **« Un lien vient de partir »** par un `alert` posé APRÈS le
`try/catch` : il parlait dans tous les cas, échecs compris. C'est la même
famille que « un bouton qui annonce un envoi doit envoyer » (9 octobre) — un
cran plus loin : **un écran qui annonce une remise doit pouvoir la constater.**

⚠️ **Et l'argument du mutisme ne tient pas pour un responsable** : il a la
liste de son entreprise sous les yeux, il n'a aucune adresse à découvrir. Le
silence ne le protège de rien et lui cache tout.

### Deux publics, deux chemins

`renvoyer-le-lien` (authentifiée, `verify_jwt: true`) est née à côté de
`mot-de-passe-oublie`, qui n'a pas bougé. **Pas un drapeau sur l'ancienne** :
un « dis-moi la vérité si je suis administrateur » mettrait les deux publics
dans le même code, et un jour le mauvais passerait par le bon chemin.

La décision reste en base — `renvoyer_le_lien_au_membre`, quatre bornes :
même entreprise ; droit calculé **sur la ligne visée** (l'administrateur
couvre l'entreprise, le superviseur les compteurs de ses magasins) ; compte
non fini (le droit suit le geste : le bouton n'existe que là) ; et **le même
seau de quota que le formulaire public**, sinon ce chemin en serait le
contournement.

⚠️ Le quota vient **après** le contrôle de droit, à l'inverse du formulaire
public. Là-bas l'ordre protégeait d'une énumération anonyme ; ici l'appelant
est connu, et un refus de droit ne doit pas consommer le quota de la personne
visée. L'ordre d'un contrôle se justifie par la menace, pas par l'habitude.

⚠️ Aucun `redirectTo` ne vient du client : il n'y a qu'une destination, donc
pas de surface de redirection ouverte à défendre. L'ancienne en accepte un et
le borne ; celle-ci n'en accepte pas.

L'écran dit maintenant les deux côtés, en avis éphémère et plus en `alert` :
le succès avec la durée de validité, l'échec avec son motif en clair (« le
serveur d'authentification n'a pas pu produire de lien pour cette adresse,
rien n'a été envoyé ») et le détail technique dans la console.

### Les gardes

Quatre sabotages, quatre morsures. ⚠️ Et le troisième a d'abord **passé** :
la garde « l'échec est annoncé » cherchait `toast.error` dans tout le corps de
la fonction, or celui du `catch` suffisait — le refus, qui est le cas qui est
arrivé, pouvait redevenir muet sans que rien ne tombe. Réancrée sur la
BRANCHE de refus. Une garde posée sur un corps entier ne garde que le corps.

## ⚠️⚠️ Trois écritures justes, et rien à l'écran

Julien envoie la demande depuis le compte de Marc, puis : « tu dis que la
demande également dans mes notifs, non ça n'y est pas, puis je ne vois nulle
part une demande, il faut une section dans équipe, le lien du mail doit y
emmener ».

Mesuré avant de répondre : la demande **était** en base (`id` 1, état
« en_attente », motif, demandeur), la notification **était** posée pour
Camille (type `demande_suppression`, non lue), l'e-mail **était** parti. Le
parcours d'écriture était bon de bout en bout. **Deux trous à la lecture**, et
chacun suffisait à tout annuler.

### 1. Une liste blanche ne prévient jamais de ce qu'elle jette

`mes_notifications` filtre les types :

```sql
and n.type in ('invitation_inventaire', 'compteur_actif',
               'inventaire_volumineux', 'forfait_trop_juste')
```

J'avais ajouté les deux nouveaux types à la contrainte de la table, au
composant qui les affiche, à l'e-mail — **et pas à cette liste**. Son propre
commentaire disait, mot pour mot : « un type déposé sans être ajouté ICI
n'apparaît jamais dans la cloche, sans que rien ne le signale ».
L'avertissement était écrit à l'endroit exact de l'oubli, et je suis passé
devant.

La leçon n'est pas « lire les commentaires ». C'est qu'**un type de
notification vit à TROIS endroits** — la contrainte, la liste blanche, le
composant — et que l'oubli d'un seul est silencieux. La garde compare
désormais les deux listes : elle extrait les `case '…'` du composant et exige
que la liste blanche les porte tous. Elle aurait attrapé ce défaut.

⚠️ Conséquence tirée tout de suite : le refus **n'a pas** son propre type. Il
réutilise `demande_suppression_traitee` avec un drapeau `refusee` dans les
données — un drapeau ne traverse qu'un seul des trois endroits.

### 2. Aucune page ne montrait les demandes

L'administrateur recevait une notification et un e-mail pour un geste
qu'**aucun écran ne proposait**. Pour y répondre il devait retenir le nom, le
retrouver dans la liste des membres, et deviner que « Supprimer le compte »
était la réponse à la demande.

`ca_list_team` rend maintenant `demandes_suppression` (en attente seulement),
et `/equipe` leur donne une section **avant les invitations** — elle porte le
geste le plus lourd de la page. Le motif y est en clair : celui qui tranche
sur un effacement définitif ne doit pas aller le chercher.

L'ancre `#demandes-suppression` est écrite à trois endroits (l'e-mail, la
notification, la page) ; une garde tient l'accord. ⚠️ Et elle est amenée **à
la main** par un effet : la section n'existe pas quand le navigateur cherche
l'ancre, elle attend `ca_list_team`. Sans ça le lien du courriel ouvre le haut
de la page.

### 3. Et une demande pouvait ne jamais sortir de la liste

Non demandé, mais la section le rendait inévitable : le seul chemin ouvert
était la suppression. Un administrateur qui ne veut **pas** supprimer n'avait
aucun geste — la demande restait « en attente » pour toujours, et le
superviseur n'apprenait jamais la décision. C'est le cul-de-sac du 9 octobre,
à l'autre bout du même parcours.

`ca_refuser_suppression` : administrateur seulement, borne sur l'entreprise de
la **demande**, `for update` (deux administrateurs peuvent répondre en même
temps — le second doit lire l'état écrit par le premier), refus impossible
deux fois, et le demandeur prévenu.

⚠️ **Le commentaire du refus est FACULTATIF**, alors que le motif de la
demande est obligatoire. Ce n'est pas une asymétrie par négligence : celui qui
demande fait arbitrer quelqu'un d'autre sur un geste définitif, il doit sa
raison ; celui qui refuse ne détruit rien. Exiger un texte pour ne RIEN faire
ajouterait une friction à la décision prudente.

### Éprouvé, et les gardes

Banc sur la production en transaction annulée, **9 constats rendus en table**
(pas en `raise notice` : le CLI les avale) : l'administrateur voit la demande
avec nom, motif et demandeur ; le superviseur ne lit pas la liste de
l'entreprise ; il ne peut pas refuser sa propre demande ; l'administrateur
refuse ; le demandeur reçoit la notification avec `refusee` et le commentaire ;
**la cloche la laisse passer des deux côtés** ; deux refus sont impossibles ;
la demande quitte la liste. Banc vérifié mordant (assertion inversée → échec),
et la demande réelle retrouvée en « en_attente » après le `rollback`.

Quatre sabotages des gardes, quatre morsures.

### ⚠️ Deux gardes de plus qui gelaient un défaut

`admin-entreprise.test.ts` exigeait `!m.is_active` sur l'écran équipe — elle
serait tombée au vert sur l'écran faux. Et le journal d'entreprise réclame un
libellé pour toute action écrite en base : `suppression_refusee` l'a signalé
tout seul. Ces deux-là ont travaillé.
