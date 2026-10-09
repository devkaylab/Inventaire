# ⚠️⚠️ Un lien d'invitation ne mène plus à un cul-de-sac — 9 octobre 2026

Julien :

> « L'admin de l'entreprise a dû supprimer un superviseur car il ne pouvait pas
> renvoyer un lien pour que le superviseur puisse finaliser la création de son
> compte. Ce dernier avait cliqué sur le lien mais la deuxième fois il était
> expiré, car il avait cliqué sur continuer mais n'avait pas créé son mot de
> passe. »

Puis, sur le terrain :

> « Le membre qui fait la manip sur son téléphone, son navigateur qui relance la
> page automatiquement renvoie à une page où il est écrit lien expiré, c'est
> frustrant. »

**Un compte a été supprimé pour un problème qui avait déjà une solution.**

## Trois défauts, et chacun suffisait

### 1. La page concluait « expiré » sans regarder la session

Le jeton d'un lien ne sert **qu'une fois**. Il est consommé au clic sur
« Continuer », puis retiré de l'adresse (il ne doit pas rester dans
l'historique). Sur un téléphone, le navigateur recharge la page tout seul —
onglet repris, mémoire récupérée. Il n'y a alors plus de jeton… **et la page ne
relisait pas la session**, qui était pourtant ouverte depuis le premier clic.

Elle annonçait donc « Lien expiré » à quelqu'un **d'encore connecté, à un clic
de finir**.

Désormais : la session prime sur le jeton au chargement, et un échange de jeton
raté est rattrapé par la session en cours.

⚠️ **La protection contre les analyseurs de liens n'est pas affaiblie**
(fiche 120, Microsoft 365) : un robot qui ouvre la page n'a pas de session, donc
il retombe sur le bouton et ne consomme toujours rien.

### 2. L'écran « expiré » envoyait chercher quelqu'un

Il disait : « demandez une nouvelle invitation à la personne qui vous a ajouté ».

Or **depuis le 6 octobre, « Mot de passe oublié » renvoie un lien neuf à une
adresse qui n'a JAMAIS eu de mot de passe** — `demander_reinitialisation` ne
contrôle que l'existence de l'adresse dans `auth.users`, et une personne invitée
y est dès l'invitation (fiche 121). La sortie était là, complète, et invisible.

L'écran y mène maintenant. ⚠️ **On ne recopie pas le formulaire d'envoi** : on
pointe celui qui existe, qui borne l'hôte de retour (pas de redirection ouverte)
et qui ne dit jamais si un compte existe.

### 3. Face à un compte jamais finalisé, la seule action visible était « Supprimer »

C'est le défaut qui a fait le dégât. **« Renvoyer le lien »** apparaît désormais
tant que le mot de passe n'existe pas — en **tête** du menu pour
l'administrateur, avant « Supprimer le compte », et à côté du retrait pour le
**superviseur**, qui est le premier à voir qu'un compteur n'a pas fini : c'est
lui qui l'a ajouté.

## ⚠️ Ce qu'on n'a PAS fait, et pourquoi

Julien demandait que **le lien continue de fonctionner**. Ce n'est pas un
réglage : il faudrait **fabriquer notre propre jeton**, stocké en base,
échangeable plusieurs fois jusqu'à ce que le mot de passe existe.

Le jeton de Supabase est à usage unique **par construction, et c'est voulu** :
ce lien est une clé vers un compte **sans mot de passe**, qui dort dans une
boîte mail parfois partagée, reprise, laissée ouverte sur le poste de la
réserve. Le rendre rejouable, c'est le rendre rejouable par quiconque la lit.

Décision : les trois corrections d'abord. Si le cas revient malgré elles, on
fabriquera ce jeton — en sachant alors qu'on paie cette complexité pour une
raison démontrée.

## La garde

`web/tests/renvoyer-le-lien.test.ts`. Elle lit le code **sans ses commentaires**
— ils racontent le défaut, donc ils contiennent les mots qu'on cherche ; neuvième
fois que ce piège se présente. Elle tient trois faits : l'ordre session/jeton au
chargement, le rattrapage après un échange raté, et le renvoi proposé **des deux
côtés** (compté par le nombre d'appels, pas par un texte d'interface).

**Cinq sabotages, cinq morsures.**

## ⚠️ Ce qui n'est pas vérifié

**Aucun e-mail n'a été envoyé**, et **l'écran n'a pas été regardé** : `/bienvenue`
ne s'atteint qu'avec un vrai lien. Ce qui est tenu à sa place : les types, le
lint, 1 593 gardes côté site.
