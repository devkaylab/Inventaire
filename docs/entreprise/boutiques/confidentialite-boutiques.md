# Les deux formulaires de confidentialité, question par question

Apple appelle ça **App Privacy**, Google **Sécurité des données**. Ce sont les
mêmes faits, posés dans deux vocabulaires différents.

⚠️ **C'est le document où une erreur ne se voit pas tout de suite.** Une case
mal cochée passe la revue sans problème, et se paie des mois plus tard : Google
suspend une fiche dont la déclaration ne correspond pas au comportement observé
de l'application, et Apple retire les mises à jour. Ce qui suit est établi en
lisant le code, pas en supposant.

---

## Ce que l'application collecte réellement

Établi en relevant les dépendances de `package.json` et leurs appelants.

| Donnée | D'où elle vient | Où elle va | Pourquoi |
|---|---|---|---|
| Adresse électronique | Saisie à la connexion | Supabase (UE) | Identifier le compte |
| Prénom et nom | Renseignés à l'invitation | Supabase (UE) | Nommer qui a compté |
| Identifiant de compte | Créé par le service | Supabase (UE) | Rattacher les comptages |
| Comptages et audits | Scans en rayon | Supabase (UE) | C'est l'objet du produit |
| Jeton de notification | `expo-notifications` | Expo (`exp.host`) puis Supabase | Prévenir d'un inventaire |
| Contenu d'un fichier importé | `expo-document-picker` | Supabase (UE) | Référentiel articles, stock théorique |

**Et ce que l'application NE collecte pas**, vérifié plutôt que supposé :

- **Aucune mesure d'audience, aucun outil de plantage, aucune publicité,
  aucune attribution.** Il n'y a ni Firebase, ni Sentry, ni Facebook SDK, ni
  AppsFlyer, ni Adjust dans les dépendances. C'est ce qui permet de répondre
  « non » à toutes les questions de pistage, et cette réponse doit rester vraie :
  **ajouter un jour un outil d'analytique oblige à revenir ici.**
- **Aucune position géographique**, aucun accès aux contacts, à la
  photothèque, au calendrier, au micro, à la santé.
- **Aucun identifiant publicitaire** (IDFA / Advertising ID). C'est pour cela
  qu'aucune demande de suivi (ATT) n'apparaît sur iOS.
- **Les images de la caméra ne sortent pas de l'appareil et ne sont pas
  enregistrées.** Elle est analysée en direct pour y lire un code-barres, rien
  n'est conservé. Une caméra utilisée ainsi **ne se déclare pas comme une
  collecte de données** — c'est une permission, pas une donnée.

---

## App Store — App Privacy

Dans App Store Connect → **Confidentialité de l'app**. Pour chaque type :
« collectée ? », « liée à l'utilisateur ? », « utilisée pour le suivi ? »,
puis les finalités.

| Type de donnée | Collectée | Liée à la personne | Suivi | Finalité |
|---|---|---|---|---|
| Coordonnées → Adresse e-mail | Oui | Oui | **Non** | Fonctionnalité de l'app |
| Coordonnées → Nom | Oui | Oui | **Non** | Fonctionnalité de l'app |
| Identifiants → ID utilisateur | Oui | Oui | **Non** | Fonctionnalité de l'app |
| Identifiants → ID d'appareil | Oui | Oui | **Non** | Fonctionnalité de l'app |
| Contenu utilisateur → Autre contenu | Oui | Oui | **Non** | Fonctionnalité de l'app |
| Tout le reste | **Non** | — | — | — |

Trois précisions qui évitent de se tromper :

- **« ID d'appareil » couvre le jeton de notification.** Il est propre à
  l'installation et part chez Expo pour acheminer la notification. Ne pas le
  déclarer serait la case la plus facile à oublier, et la plus vérifiable.
- **« Autre contenu utilisateur » couvre les comptages et les fichiers
  importés.** Ce sont des données que la personne produit dans l'app et qui
  partent au serveur.
- **« Utilisée pour le suivi » est NON partout**, et ce n'est pas une facilité :
  rien n'est croisé avec des données d'autres sociétés, il n'y a pas
  d'identifiant publicitaire. C'est ce qui dispense de la demande ATT.

Le reste de la section :

| Champ | Réponse |
|---|---|
| Politique de confidentialité | `https://www.quantinvo.com/confidentialite` |
| L'app propose la suppression du compte | **Oui** (Mon compte → Supprimer mon compte) |
| Données utilisées pour le suivi publicitaire | Aucune |

---

## Google Play — Sécurité des données

Console → **Contenu de l'application** → **Sécurité des données**.

⚠️ **Google distingue « collectées » et « partagées ».** *Partagé* veut dire
transmis à un tiers **pour ses propres usages**. Supabase et Expo traitent pour
notre compte, sur nos instructions : c'est de la **collecte**, pas du partage.
Répondre « partagé » ici serait faux et ferait déclarer des transferts qui
n'existent pas.

| Catégorie → Type | Collectée | Partagée | Obligatoire | Finalité |
|---|---|---|---|---|
| Informations personnelles → Nom | Oui | Non | Oui | Fonctionnalité, Gestion du compte |
| Informations personnelles → Adresse e-mail | Oui | Non | Oui | Fonctionnalité, Gestion du compte |
| Informations personnelles → ID utilisateur | Oui | Non | Oui | Fonctionnalité, Gestion du compte |
| Fichiers et documents → Fichiers et documents | Oui | Non | Non | Fonctionnalité |
| ID de l'appareil ou autres ID | Oui | Non | Non | Fonctionnalité |
| Actions dans l'application → Autres actions | Oui | Non | Oui | Fonctionnalité |
| Tout le reste | Non | — | — | — |

- **« Fichiers et documents » est déclaré, et c'est un choix.** L'application
  laisse un superviseur choisir un fichier (référentiel, stock théorique) dont
  le contenu part au serveur. Ce n'est pas une donnée personnelle, et beaucoup
  d'applications professionnelles ne le déclarent pas — mais la lecture stricte
  de Google porte sur les fichiers choisis par l'utilisateur, et **sous-déclarer
  est ce qui fait suspendre une fiche**. On déclare.
- **« Autres actions » couvre les comptages.** Il n'existe pas de catégorie
  plus juste chez Google.
- **Marqué « non obligatoire » là où l'app fonctionne sans** : on peut compter
  sans jamais importer de fichier et sans accepter les notifications.

Les questions de sécurité, en bas du formulaire :

| Question | Réponse |
|---|---|
| Les données sont chiffrées en transit | **Oui** (HTTPS de bout en bout) |
| L'utilisateur peut demander la suppression de ses données | **Oui** |
| URL de suppression de compte | `https://www.quantinvo.com/suppression-compte` |
| L'application respecte la politique Familles | Non concerné (usage professionnel) |
| Vous avez fait auditer votre sécurité par un tiers | **Non** — voir plus bas |

⚠️ **Répondre « non » à l'audit indépendant.** Le projet a été passé en revue
plusieurs fois (modélisation de menaces, revue du parcours de paiement,
durcissement du backend), mais **par nous**. Google demande une validation
externe, contre un référentiel reconnu. Cocher « oui » serait une fausse
déclaration pour un badge.

---

## Classification du contenu (IARC)

Le questionnaire est le même chez Google et sert aussi ailleurs. Toutes les
réponses sont « non » : aucune violence, aucun contenu sexuel, aucune
grossièreté, aucun jeu d'argent, aucune substance, aucune peur.

| Question | Réponse |
|---|---|
| Catégorie | Application (utilitaire / professionnel) |
| Les utilisateurs peuvent-ils interagir entre eux ? | **Non** — pas de messagerie ni de contenu public entre utilisateurs |
| L'app partage-t-elle la position de l'utilisateur ? | Non |
| L'app permet-elle d'acheter des biens numériques ? | **Non** — la licence se vend hors boutique |
| Contenu généré par l'utilisateur visible publiquement | Non |

Résultat attendu : **PEGI 3 / Tout public**, et **4+** côté Apple.

---

## Ce qui doit rester vrai

Un formulaire de confidentialité n'est pas un document qu'on remplit une fois.
Trois changements obligent à revenir ici, et chacun s'est déjà présenté sur
d'autres produits :

1. **Ajouter un outil de mesure d'audience ou de plantage** — même « juste pour
   voir » : toutes les réponses « aucun pistage » deviennent fausses le jour de
   l'installation du paquet.
2. **Ajouter une permission** — la photothèque pour joindre une photo à un
   écart, par exemple. Elle apparaît dans le manifeste avant d'apparaître ici.
3. **Faire transiter une donnée par un nouveau prestataire** — il devient un
   sous-traitant à déclarer dans la politique de confidentialité *et* dans ces
   deux formulaires. `web/tests/confidentialite.test.ts` fait échouer la suite
   si un prestataire est ajouté sans être déclaré ; ces deux formulaires, eux,
   n'ont aucun test qui les surveille. **C'est à faire à la main.**
