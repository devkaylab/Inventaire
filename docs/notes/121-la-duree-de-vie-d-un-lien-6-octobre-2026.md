# ⚠️ La durée de vie d'un lien d'authentification — 6 octobre 2026

> « Faut-il réellement un délai pour la création de compte ? »

Oui — mais le délai n'était pas le problème.

## Un seul réglage pour les deux liens

Réinitialiser un mot de passe et en créer un passent par la même fonction
Supabase, `auth.admin.generateLink`, types `recovery` et `invite`. Leur durée de
vie vient d'un **unique** réglage du projet :

**Authentication → Providers → Email → Email OTP Expiration**

On ne peut pas les séparer. Supabase refuse au-delà de **86 400 secondes
(24 heures)** : plus un lien vit, plus on a le temps de le deviner.

⚠️ **Le dépôt ne sait pas lire ce réglage.** Le CLI ne sait que *pousser* une
config, aucun outil ne l'expose. Ce qui a pu être mesuré : l'analyseur de
sécurité de Supabase lève une alerte au-delà d'une heure, et il n'en lève
aucune sur la production — la valeur était donc d'au plus une heure.

## Pourquoi un délai est justifié, même pour une création

Le lien d'invitation est **une clé vers un compte sans mot de passe**. Qui le
détient devient cette personne dans Quantinvo, et voit les inventaires de son
entreprise.

Cette clé dort dans une boîte mail. Dans un magasin, les boîtes sont partagées,
reprises par le suivant, laissées ouvertes sur le poste de la réserve. Un lien
qui n'expire jamais est une clé qui reste dans le tiroir pendant des mois.

C'est différent d'une réinitialisation, où le compte est déjà vivant : là on
vole une place occupée, ici on prend une place vide. Le dégât n'est pas le
même ; il est réel.

## Mais une heure est absurde pour une invitation

La personne n'a rien demandé : elle reçoit. Elle peut être en repos. **Décision
de Julien : 24 heures**, le maximum que Supabase autorise.

⚠️ **Le réglage se change dans le tableau de bord, et personne d'autre ne peut
le faire.** Tant qu'il n'est pas changé, les e-mails de ce dépôt promettent
24 h alors que le serveur en applique une.

## Ce qui rend le délai inoffensif existait déjà

Vérifié en base, dans `demander_reinitialisation` : elle ne contrôle qu'une
chose, que l'adresse existe dans `auth.users`. Or **une personne invitée y
existe dès l'invitation**, avant d'avoir choisi quoi que ce soit.

Donc « Mot de passe oublié » renvoie un lien neuf à quelqu'un qui n'a jamais eu
de mot de passe. La sortie était là, complète, depuis toujours.

**Ce qui manquait, c'était de le dire.** L'app envoyait d'abord chercher
quelqu'un :

> « C'est la personne qui vous a ajouté à son équipe qui envoie l'invitation […]
> demandez-lui de vous la renvoyer. »

Le bouton qui règle le cas est sur le même écran, deux lignes au-dessus. Et le
site ne disait rien du tout : qui n'a jamais eu de mot de passe ne clique pas
« Mot de passe oublié ».

⚠️ **Et une garde figeait ce mauvais conseil** — elle exigeait la phrase
« Votre invitation vient de votre responsable ». Deuxième fois en deux jours
qu'une garde protège un défaut au lieu d'une décision.

Le responsable reste la réponse au seul cas qu'il est seul à régler :
l'invitation jamais partie, ou partie à une autre adresse. Il passe en second.

## La durée ne s'écrit plus qu'à un endroit

`DUREE_LIEN_HEURES` dans `supabase/functions/_shared/email.ts`. L'e-mail de
réinitialisation l'annonçait en clair, **deux fois** — « valable une heure ».
Porter le réglage à 24 h sans toucher ces lignes, c'était écrire un mensonge
dans un e-mail, et aucun test ne l'aurait dit.

La garde (`web/tests/email-template.test.ts`) balaie neuf surfaces — les
fonctions edge qui écrivent du courrier et les écrans de connexion — et refuse
toute durée en désaccord avec la constante. Elle refuse aussi une constante
supérieure à 24, qui promettrait ce que le serveur n'appliquera pas.

## Sabotages

Six morsures :

- l'e-mail réécrit « une heure » en clair → mord
- l'app annonce 48 heures → mord
- la constante dépasse le maximum de Supabase → mord
- l'aide de l'app ne nomme plus « Mot de passe oublié » → mord
- le libellé redevient « je n'ai pas reçu mon invitation » → mord
- (et la garde lit le code **sans ses commentaires** : ils racontent le défaut,
  donc ils citent « une heure ». Huitième fois que ce piège se présente)

## ⚠️ Écrit en parallèle d'une session cloud

Le même jour, une session cloud corrigeait l'autre moitié du problème : l'analyse
de liens de Microsoft 365 ouvrait le lien avant le destinataire et **grillait le
jeton** — fiche 120. Les deux travaux se sont croisés sur
`mot-de-passe-oublie`, et la fusion garde les deux : son lien qui ne se
consomme plus au survol, ma durée centralisée.

À retenir : le bouton de l'e-mail ne porte plus le lien de Supabase mais une
page du site (`/bienvenue`, `/reinitialisation`) qui ne présente le jeton qu'au
clic. **La durée, elle, n'a pas changé de nature** : c'est toujours le réglage
Supabase qui décide.

## ⚠️⚠️ L'avertissement de Supabase est ASSUMÉ — ne pas le « corriger »

Dès le réglage posé à 24 h, le tableau de bord affiche une alerte de sécurité :
l'analyseur (`auth_otp_long_expiry`) la lève au-delà d'une heure.

**Sa raison ne s'applique pas ici.** Elle vise le code à **six chiffres** que
Supabase peut envoyer par courriel : plus il vit, plus on a le temps de le
deviner. Or Quantinvo n'en vérifie jamais.

Mesuré le 6 octobre 2026 :

- `verifyOtp` n'est appelée qu'à **un seul endroit** (`web/lib/jetonDuLien.ts`,
  et une garde le vérifie), et elle ne reçoit qu'un `token_hash` — un condensat,
  pas un nombre qu'on énumère ;
- le code à six chiffres de l'inscription est **le nôtre** : table
  `codes_email`, **10 minutes**, compteur d'essais et quota. Le réglage de
  Supabase n'a aucun effet dessus ;
- `resetPasswordForEmail` ne subsiste qu'en **repli**, si notre fonction est
  injoignable — et le message de Supabase porte lui aussi un lien.

**Ce qu'il ne faut donc PAS faire : repasser le réglage à une heure pour faire
disparaître le voyant.** Ça casserait l'invitation d'un compteur qui ouvre son
courrier le lendemain, pour fermer un risque que ce produit ne court pas.

⚠️ À savoir quand même : depuis que la sortie est écrite sur les deux écrans
(« Mot de passe oublié » renvoie un lien neuf), **une heure redeviendrait
tenable** — le cul-de-sac a disparu. 24 h reste le choix de Julien parce qu'il
est plus aimable, pas parce que l'autre est impossible.

## Ce qui reste à faire

1. ✅ **Réglage porté à 24 h** par Julien, le 6 octobre 2026.
2. ✅ **`mot-de-passe-oublie` déployée** le même jour — version 4, toujours
   publique (`verify_jwt: false`), et le fichier téléchargé est identique au
   dépôt, `_shared/email.ts` compris.
3. ⚠️ **L'app est publiée : son texte ne part qu'avec un build**, et le
   déclenchement appartient à Julien. D'ici là, l'app continue d'envoyer
   chercher le responsable.

Le site est parti au push.
