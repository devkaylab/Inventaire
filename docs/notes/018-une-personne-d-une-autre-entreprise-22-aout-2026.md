# Une personne d'une autre entreprise (22 août 2026)

Ajouter à son équipe quelqu'un dont le compte appartient à une autre
entreprise affichait « **Erreur** — Cette adresse est déjà utilisée dans une
autre entreprise », sans dire quoi faire. Constat de Julien, capture à
l'appui : *« plutôt qu'un message d'erreur, signale que cette personne fait
partie d'une entreprise extérieure à celle-ci, inviter à passer par l'admin de
l'entreprise »*.

Les deux fonctions edge concernées (`invite-teammate` pour l'équipe,
`invite-to-session` pour un inventaire) renvoient désormais
`code: 'other_company'` avec un texte qui donne la marche à suivre :
s'adresser à l'administrateur de son entreprise, ou utiliser une autre
adresse. **Le code compte autant que le texte** : sans lui, un écran ne peut
que titrer « Erreur » et recopier la phrase.

Trois points à ne pas défaire :

- **Ce n'est pas une faute de saisie.** Rien à corriger dans le formulaire :
  l'app titre « Cette personne n'est pas de votre entreprise », le site
  affiche l'explication **sous le formulaire** et non dans une notification
  qui s'efface avant qu'on l'ait lue.
- **Ne jamais nommer l'autre entreprise.** Le superviseur apprendrait quelque
  chose sur un client qui n'est pas le sien. Un test le vérifie.
- Compromis assumé : le message **confirme** que l'adresse a un compte
  ailleurs. C'est ce que Julien a demandé, et c'est déjà ce que faisait
  l'ancien texte — mais cela reste une information sur l'existence d'un
  compte, à garder en tête si le sujet de l'énumération d'adresses revient
  (voir constat M3).

`src/lib/queries.ts` fait voyager le code sur l'erreur levée
(`err.code = res.code`) : sans cela il se perdait entre la fonction edge et
l'écran.

**Les deux fonctions edge doivent être redéployées** pour que le message
change réellement — le dépôt ne déploie rien tout seul.

Tests de garde : `web/tests/admin-entreprise.test.ts`, bloc « une personne
d'une autre entreprise ».
