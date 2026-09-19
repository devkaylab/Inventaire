# Le tour des consoles (15 septembre 2026)

Julien : *« je t'ai mis asc, playstore connect, stripe, vercel et quantinvo sur
chrome, je te laisse en autonomie »*. Relevé console par console, sur les vraies
pages — **aucun de ces chiffres ne vient d'une note du dépôt**, et deux notes
disaient autre chose que la réalité.

## ⚠️ ANDROID EST À 14 JOURS MINIMUM, ET PERSONNE NE LE SAVAIT

C'est le fait le plus lourd de la journée, et il ne se voit que dans la Play
Console. Le compte développeur **Devkaylab est un compte PERSONNEL**, et Google
impose depuis 2023 à ces comptes-là un test fermé avant tout accès en
production. Le tableau de bord le dit en toutes lettres, et rien n'est commencé :

| Étape | État au 15 septembre 2026 |
|---|---|
| Publier une version de test fermé | **rien n'a jamais été envoyé** — aucune release, sur aucun canal |
| Avoir au moins **12 testeurs** inscrits | « 0 testeur actuellement inscrit » |
| Exécuter le test fermé **au moins 14 jours** | pas commencé |
| Demander à publier en production | bouton **désactivé** |

- **L'AAB de 86 Mo construit le 8 septembre n'a jamais été téléversé.** Le
  bundle existe sur la machine, la Play Console n'en a aucune trace.
- **Le délai est un plancher, pas une estimation** : quatorze jours *après* que
  douze testeurs soient inscrits et que le test tourne. Recruter les testeurs
  est donc le premier geste, et c'est un geste de Julien.
- ⚠️ **Le nom diffère d'une boutique à l'autre** : Play porte encore
  « Quantinvo — Inventaire magasin » (30 caractères tout juste), l'App Store
  porte « Quantinvo » depuis le 15 septembre. Ce n'est **pas** forcément à
  corriger : Play n'a aucun champ de mots-clés, son titre est ce qui indexe —
  là où l'App Store a un champ dédié, qui porte maintenant les deux mots. Deux
  noms différents pour deux mécaniques d'indexation différentes se défend ; le
  savoir vaut mieux que l'aligner par réflexe.

### ⚠️ ET LES QUATORZE JOURS NE SONT PEUT-ÊTRE PAS UNE FATALITÉ

Question de Julien, le jour même : *« j'ai pas compris, j'ai un duns on ne peut
pas l'utiliser sur google ? »* Elle était juste, et elle renverse le paragraphe
ci-dessus.

**L'obligation est explicitement bornée aux comptes PERSONNELS.** L'article de
Google s'intitule « App testing requirements for new **personal** developer
accounts », et son texte dit : « Google Play requires **personal developer
accounts created after November 13, 2023**, to test their apps… ». Un compte
**organisation** n'y est pas soumis.

**Et la console permet la bascule** — « Modifier le type de compte » existe sous
*Compte de développeur → Détails du compte*. Elle est grisée, et son infobulle
dit exactement ce qui la débloque :

> « Pour modifier le type de votre compte, indiquez et validez un site Web pour
> votre organisation ci-dessous. »

⚠️ **CE N'EST DONC PAS LE D-U-N-S QUI BLOQUE, C'EST LA VALIDATION DU SITE.** La
chaîne, relevée dans la console :

1. le site déclaré est **périmé** — `https://quantinvo.vercel.app`, à remplacer
   par `https://www.quantinvo.com` ;
2. ce site doit d'abord être **possédé dans la Google Search Console** (« Vous
   devez enregistrer la propriété du site dans la Search Console avant de
   pouvoir la valider »).
   ✅ **FAIT le 15 septembre 2026** : le fichier de vérification fourni par
   Google est dans `web/public/`, donc servi à la racine du site.
   ⚠️ **IL NE SE SUPPRIME PAS.** Search Console le relit périodiquement ; le
   retirer perd la propriété **en silence**, et le statut du compte Play peut
   retomber avec. ⚠️ Et il ne se **commente pas** non plus : Google compare son
   contenu à la lettre, une ligne d'explication ajoutée dedans casse la
   validation. L'explication vit dans son test de garde
   (`web/tests/seo.test.ts`, « la preuve de propriété du site »), qui déduit le
   jeton du nom du fichier et refuse qu'il y en ait deux ;
3. « Envoyer une demande de validation » depuis la Play Console. ✅ Fait.
   ⚠️ **L'APPROBATION NE SE FAIT PAS PAR E-MAIL, malgré ce que tout annonce.**
   La Play Console dit « une demande de validation a été envoyée au
   propriétaire », et le courriel reçu côté Play n'est qu'un accusé de
   réception (« nous vous indiquerons si le propriétaire approuve »). Le geste
   vit dans **Search Console → Paramètres → Associations → Demandes en
   attente → RÉSOUDRE LA DEMANDE → APPROUVER**. Personne ne trouve cette page
   en suivant les instructions ; c'est là qu'il faut aller.
   ⚠️ **Et elle appartient au PROPRIÉTAIRE, pas au titulaire du compte Play.**
   Ici la propriété est validée par `jthiongkay@gmail.com` ; `devkaylab@gmail.com`
   n'y a qu'un « accès total », ce qui ne suffit pas. Search Console **ne
   permet plus d'ajouter un propriétaire** (le menu n'offre que *Restreint* et
   *Accès total*) : un propriétaire est quelqu'un qui a validé lui-même. Si les
   deux bouts doivent être sur le même compte un jour, il faut revalider la
   propriété depuis l'autre compte — un second fichier `googleXXXX.html` dans
   `public/`, et la garde passe alors de « un seul » à « au moins un ».
4. ✅ **« Modifier le type de compte » EST DÉBLOQUÉ** (15 septembre 2026,
   vérifié dans le DOM : le bouton ne porte plus `disabled`). C'est **là** que
   le D-U-N-S `288196187` sert, et c'est le geste de Julien : il déclare
   l'identité légale de la société, et le type de compte ne se défait pas d'un
   clic.

⚠️ **CE QUI N'EST PAS PROUVÉ** : que la bascule lève l'obligation **pour cette
app**, rétroactivement. Le texte de Google borne la règle aux comptes
personnels, donc elle devrait tomber avec le statut — mais la seule preuve est
le tableau de bord de la console après conversion. À vérifier là, pas ici. Et
tant que ce n'est pas prouvé, **ne pas abandonner le plan des douze testeurs** :
s'il faut y revenir, les quatorze jours repartent de zéro.

**16 septembre 2026 — le compte est passé en ORGANISATION** (confirmé par Julien : « google play est passé en organisation »). **Constaté le jour même dans le tableau de bord de l'app** : la Production demande toujours de « publier une version de test fermé », mais les seuils sont tombés à **0 testeur pendant 0 jour**. Il faut donc encore UNE version en test fermé (et répondre aux questions sur ce test à la demande), mais plus de délai de 14 jours ni de recrutement. **Le jour même, l'AAB versionCode 1 (1.0.0) a été téléversé sur la piste Alpha (France seulement, liste de testeurs = jthiongkay@gmail.com) et envoyé pour examen avec 12 autres modifications** (fiche, contenu, catégorie Professionnel, 18 ans et plus). « Accès à l'application » s'appelle désormais « Informations de connexion » dans la console, et le compte de démo y était déjà. Suite : Alpha publiée → Demander un accès en production. Le prochain bundle passe à versionCode 2. Contexte :
après dépôt de sa pièce d'identité et des documents de Devkaylab. ⚠️ **Non vu
par moi** : la prochaine session vérifie d'abord que « Type de compte » dit
*Organisation*, puis que la section Production n'exige plus le test fermé.

⚠️ **Le téléphone repris par Google est le numéro PERSO de Julien** : il vient
de la fiche Dun & Bradstreet du D-U-N-S, enregistrée avant l'existence d'une
ligne pro. Décision : valider quand même, puis changer le téléphone dans
Play Console → Détails du compte (code SMS), et faire corriger la fiche D&B —
qu'Apple lit aussi pour la conversion en organisation.

### Le compte personnel publie l'adresse du DOMICILE

Trouvé en passant, et c'est un second argument pour la bascule. Le profil
développeur porte « Nom légal et adresse : JULIEN SAMUEL THIONG-KAY », suivi de
l'adresse personnelle de Julien à Saint-Germain-en-Laye — et la console
prévient :

> « Si vous choisissez de générer des revenus sur Google Play, votre adresse
> légale complète sera visible publiquement, conformément aux lois sur la
> protection des consommateurs. »

Aujourd'hui l'app est gratuite et les abonnements se vendent sur le site, donc
le cas ne se déclenche pas. Un compte organisation y mettrait de toute façon le
siège — 47 rue Vivienne — au lieu du domicile.

## ⚠️ STRIPE LIVE N'EST PAS ACTIVÉ — pas « il manque les clés »

Les notes de ce fichier disaient « poser les clés live le jour venu ». C'est
plus gros que ça : le compte live (`acct_1U7Gj…ETFH`) est **à l'étape 1 sur 5
de son onboarding**, « Verify your business ». Il n'y a donc ni clés, ni les
huit Price, ni le taux de TVA, ni la permission Subscriptions — et il y a un
parcours d'identité et de compte bancaire à faire avant.

- **Le formulaire propose encore « Entrepreneur individuel / Micro-entrepreneur »**
  alors que Devkaylab est une SASU depuis le 8 septembre. À corriger à la
  première étape, sinon tout le reste est saisi sous le mauvais statut.
- ⚠️ **Ce parcours appartient à Julien** : il demande des pièces d'identité et
  un RIB. Un agent n'y touche pas.
- ⚠️ **ORDRE ARRÊTÉ PAR JULIEN LE 16 SEPTEMBRE 2026 : le live Stripe ne se fait
  qu'APRÈS la publication de l'app sur les DEUX boutiques.** Ne pas le proposer avant.
- Le sandbox, lui, est intact et c'est là que tout a été éprouvé jusqu'ici.

## App Store — ce qui est prêt, et les deux choix qui restent

Build **5** est bien attaché à la version 1.0 (« Prepare for Submission »),
cinq captures iPhone 6,9", App Privacy **publiée**, prix et disponibilité posés
(175 pays), compte de démonstration et contact de revue remplis, et les deux
adresses déclarées (`/confidentialite`, `/suppression-compte`) existent bien
dans `web/app/`.

- **Apple ID : `6807966626`** — c'est lui qui manquait à `appStores.ts`.
- ⚠️ **La fiche est en FRANÇAIS SEULEMENT**, alors que l'application parle
  anglais depuis le 11 septembre. Une localisation anglaise se ferait sans
  nouvelle version ; c'est un choix, pas un oubli, mais il n'a jamais été posé.
- ⚠️ **La version est réglée sur « publier automatiquement après approbation ».**
  Elle partirait donc en ligne le jour où Apple approuve — pendant qu'Android
  est à quinze jours, que la vente est fermée et que le site ne pointe pas
  encore vers la fiche. « Publier manuellement » rendrait la date à Julien.
- Le copyright dit « 2026 Julien Thiong-Kay », pas Devkaylab : cohérent tant que
  le compte Apple est **Individuel**, à revoir avec la conversion en
  Organisation.

## Vercel — les deux valeurs manquantes sont trouvées, et PAS posées

`vercel.com` était bloqué depuis l'environnement de l'agent ; le Chrome de
Julien l'ouvre. Adresse relevée dans le « Contact Us » de la notice de
confidentialité de Vercel, adresse **et** téléphone dans sa fiche du Data
Privacy Framework — deux sources publiées, jamais la mémoire.

⚠️ **Elles sont écrites en commentaire dans `web/lib/legal.ts`, pas dans les
`Mention`, et c'est délibéré : les poser OUVRE LA VENTE** — ce sont les deux
dernières mentions requises, et `venteOuverte()` vaut `mentionsCompletes()`.
Avec Stripe live non activé, un prospect irait jusqu'à une page de paiement qui
refuserait sa carte. Le jour venu, c'est un copier-coller.

## Deux notes qui disaient faux, corrigées

- **La page des mentions légales affirmait en production que « l'activité
  éditrice n'est pas encore immatriculée »** — faux depuis le 8 septembre. Elle
  dit maintenant ce qui est vrai dans tous les états : certaines mentions ne
  sont pas encore publiées.
- **Le commentaire de `legal.ts` comptait « trois mentions requises »** ; le
  téléphone de l'éditeur a été posé la veille, il en manque deux. *Une note qui
  compte ce qui manque se recompte quand on en remplit une* — sixième note
  périmée de ce projet.
