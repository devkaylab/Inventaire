# Prérequis de publication — l'état au 8 septembre 2026

Second lot de la revue d'avant publication. Rien n'a été modifié : lecture,
plus un build iOS pour vérifier que la chaîne passe.

⚠️ **DEUX AFFIRMATIONS FAUSSES ONT ÉTÉ ANNONCÉES À JULIEN AVANT CETTE
VÉRIFICATION**, toutes deux reprises de notes de ce fichier sans les
contrôler : « l'APK Android est signé avec la clé de debug » (faux depuis le
2 septembre) et « le build iOS est cassé » (il remarche). **Une note d'état se
vérifie avant d'être citée** — c'est la quatrième fois que ce fichier induit en
erreur, après la liste d'onboarding du 28 août, le garde-fou du retour du
29 août et les orphelins de migrations.

## Ce qui est prêt

| | |
|---|---|
| Identité | Quantinvo, 1.0.0, `com.quantinvo.app` sur les deux boutiques |
| iOS | build 3, chaîne vérifiée le 8 septembre (`simulateur.sh` passe) |
| Android | clé de signature en place, `play.sh` contrôle le bundle produit |
| Icônes | régénérées le 7 septembre, la marque « plan de magasin » |
| Permission caméra | texte français explicite, et « aucune photo n'est enregistrée » |
| Chiffrement | `ITSAppUsesNonExemptEncryption = false` — évite le questionnaire à chaque envoi |
| Confidentialité | servie par le site (`/confidentialite`), et GitHub Pages en secours |
| Suppression de compte | dans l'app — **Apple l'exige**, son absence est un refus |
| Play Console | identité validée (Julien, 8 septembre 2026) |

## ⚠️ LA PUBLICATION iOS PASSE PAR XCODE, PAS PAR LE TERMINAL

Décision de Julien, 8 septembre 2026 : *« la prochaine fois je fais l'étape
d'archive moi-même sur Xcode, pas besoin de passer par le terminal »*.
**Ne pas lancer `scripts/appstore.sh` pour lui** — le chemin est
Xcode → Window → Organizer → Distribute App → App Store Connect.

**Deux raisons, mesurées le jour même** :

- `xcodebuild -exportArchive` répond **« No Accounts »** : il n'a pas les
  identifiants Apple, Xcode les a. Il ne peut donc pas régénérer le profil de
  distribution, et l'export s'arrête là ;
- le projet force `CODE_SIGN_IDENTITY[sdk=iphoneos*] = "iPhone Developer"`
  (reste du gabarit Expo, deux occurrences dans `project.pbxproj`) — donc même
  une archive **Release** sort signée « Apple Development ». Organizer, lui,
  re-signe avec le bon certificat et régénère le profil.

⚠️ **Cela ne change rien au reste** : `./scripts/simulateur.sh` demeure le seul
chemin de build local iOS (il pose `app.config`, sans quoi l'app s'ouvre sur un
écran rouge), et `./scripts/play.sh` demeure celui d'Android — lui produit un
AAB signé sans avoir besoin de parler à Google.

`appstore.sh` reste dans le dépôt : sa première garde — refuser de partir sans
certificat « Apple Distribution » — a servi, et son contrôle de signature du
`.ipa` vaudra le jour où l'export en ligne de commande sera possible (il
faudrait alors une clé API App Store Connect, un secret de plus à protéger).

## ⚠️ LE BLOQUANT DU 8 SEPTEMBRE, LEVÉ LE JOUR MÊME : le certificat « Apple Distribution »

La machine ne porte qu'un certificat **Apple Development**, qui sert à
installer sur un appareil de test. App Store Connect refuse un binaire signé
avec — et le refus arrive **à l'envoi, après tout le build**.

**Créé par Julien le 8 septembre 2026** (Xcode → Réglages → Comptes →
Gérer les certificats… → + → Apple Distribution), équipe `8YL7866PHB`, celle
que le projet attend. Vérifié : `security find-identity -v -p codesigning` rend
bien les deux identités.

⚠️ **Le guide a fait perdre du temps sur un détail inutile** : j'ai fait
chercher un « rôle » dans l'onglet Comptes, que Julien ne voyait pas — *« je te
dis que je suis déjà connecté »*. Le seul geste qui compte est le bouton
**Gérer les certificats…** ; le reste de cet écran n'a pas à être décrit.

⚠️ **L'archive `ios/build/Quantinvo.xcarchive` du 3 septembre ne sert à rien** :
signée « Apple Development », build 2, et cinq jours de travail plus tard. Ne
pas la déposer ; `appstore.sh` en produira une neuve.

## Deux décisions qui appartiennent à Julien

- **`supportsTablet: true`** → Apple exigera des **captures iPad** en plus de
  celles d'iPhone, alors que l'app est en portrait et pensée pour un téléphone.
  Soit on fournit les captures, soit on passe le drapeau à `false`.
- **La vente est fermée** jusqu'à l'immatriculation (`venteOuverte()`, le
  5 septembre). Publier maintenant, c'est laisser quelqu'un télécharger l'app
  sans pouvoir créer de compte.

## Ce qui se fait dans les consoles, pas dans le code

Fiches boutique, captures, descriptions, et les deux questionnaires
obligatoires : **App Privacy** (Apple) et **Data Safety** (Google). Ils
décrivent ce que l'app collecte — la politique de confidentialité du site en
donne déjà la matière.

## ✅ ENVOIS À APP STORE CONNECT — builds 3 et 4

**Build 3** envoyé le 8 septembre 2026, **build 4 depuis** (confirmé par Julien
le 11 septembre) — par Xcode → Organizer → Distribute App → App Store Connect.

⚠️ **LES DEUX SONT PARTIS : LA PROCHAINE ARCHIVE EST DONC LE 5.** Apple refuse
un numéro déjà utilisé, et le refus arrive **à la fin de l'envoi**. Aujourd'hui
les trois endroits disent `4` et sont cohérents — c'est l'état d'un numéro
**consommé**, pas d'un numéro disponible.

⚠️ **Le numéro se monte JUSTE AVANT l'archive, jamais après un envoi réussi**
(le monter sans envoyer ne ferait que creuser un trou dans la série), et jamais
non plus « pour être tranquille » : c'est ce qui a fait écrire ici, le
11 septembre, qu'il fallait « monter le numéro » alors qu'il était déjà monté.
**Avant d'affirmer où il en est, le lire dans les trois fichiers.**

⚠️ **ET LE JOUR VENU, IL VIT À TROIS ENDROITS** (la note en annonçait deux ;
c'est la garde de `tests/compte.test.ts` qui a rattrapé le troisième au passage
de 3 à 4, le 8 septembre 2026) : `app.json` (`ios.buildNumber`),
`ios/Inventaire/Info.plist` (`CFBundleVersion`) et
`ios/Inventaire.xcodeproj/project.pbxproj` (`CURRENT_PROJECT_VERSION`, **deux
occurrences**, Debug et Release). Les deux derniers sont versionnés et ne se
régénèrent pas. Apple refuse un numéro déjà utilisé, et le refus arrive à la
fin de l'envoi. **Lancer `npx vitest run` après l'avoir changé** : la garde
compare les trois. C'est le
même piège que `supportsTablet` et `UIUserInterfaceStyle` : **une valeur iOS
qui vit dans `app.json` vit presque toujours aussi dans le projet Xcode.**

Ce qui reste avant de soumettre à la revue : la fiche (nom, description,
mots-clés), les **captures iPhone** — plus besoin d'iPad, la compatibilité a
été retirée le jour même — et le questionnaire **App Privacy**.

## ✅ BUNDLE ANDROID PRODUIT — 8 septembre 2026

`./scripts/play.sh` : `android/app/build/outputs/bundle/release/app-release.aab`,
**86 Mo**, signé `CN=Thiong-kay Julien, OU=Devkaylab, O=Devkaylab, L=Paris` —
donc la vraie clé de dépôt, pas celle de debug ; le script l'a vérifié
lui-même sur le bundle produit.

⚠️ **LES 86 Mo NE SONT PAS CE QUE LES GENS TÉLÉCHARGENT**, et il ne faut pas
partir en chasse à l'optimisation sur ce chiffre. Mesuré : ~40 Mo de symboles
de débogage (`BUNDLE-METADATA/debugsymbols`, jamais livrés, ils servent aux
rapports de plantage) et **quatre architectures** — dont `x86` et `x86_64`
(28,4 Mo chacune) qui ne visent que les émulateurs et quelques Chromebooks.
Play découpe et ne sert à chaque appareil que la sienne : **25 à 30 Mo au
téléchargement réel** sur un téléphone moderne (`arm64-v8a`, 26 Mo).

## ⚠️ DEUX BOUTIQUES, DEUX NOMS D'ÉDITEUR — à régulariser après l'immatriculation

| Boutique | Nom affiché aujourd'hui |
|---|---|
| Google Play | **Devkaylab** (nom du développeur du compte) |
| App Store | **Julien Thiong-Kay** (compte Apple *Individuel*) |

Un client verrait donc deux éditeurs différents selon son téléphone. **Ce n'est
pas bloquant pour publier**, et c'est le choix retenu pour le premier
lancement — mais ça n'inspire pas confiance sur un outil qu'on installe dans un
magasin.

- **Ce qui les réconciliera** : convertir le compte Apple en **Organisation**,
  une fois la société immatriculée. C'est une demande au **support Apple
  Developer** — pas un champ qu'on modifie soi-même — avec l'entité juridique
  et son numéro **D-U-N-S**. Les apps, l'historique et les achats suivent ;
  seul le nom affiché change. Quelques jours à quelques semaines.
- ⚠️ **À faire dans le même lot que l'immatriculation**, avec les mentions
  légales du site (`web/lib/legal.ts`, qui attend les sept valeurs) et la
  réouverture de la vente (`venteOuverte()`). Les trois disent la même chose au
  public : qui édite Quantinvo.
- ⚠️ **La clé de signature Android, elle, ne se change JAMAIS** — elle porte
  déjà « Devkaylab », et son nom n'est de toute façon pas public : elle ne sert
  qu'à prouver que les mises à jour viennent de nous. La renommer voudrait dire
  en changer, donc republier l'app sous un autre identifiant.

## Le jour de la publication

`web/lib/appStores.ts` : **passer `PUBLIEE` à `true`, et rien d'autre.** Les
deux adresses de fiche y sont désormais les vraies (App Store `id6807966626`,
Play `com.quantinvo.app`) ; un test échoue si un composant se met à écrire une
adresse en dur.

⚠️ **L'adresse Play y était FAUSSE jusqu'au 15 septembre 2026** —
`com.devkaylab.quantinvo`, un paquet qui n'existe ni dans `app.json`, ni dans la
Play Console, ni nulle part ailleurs dans le dépôt. Tant que `PUBLIEE` vaut
faux, les boutons ouvrent la recherche des boutiques : la faute ne se serait vue
que le jour de la publication, sur une fiche introuvable. La garde déduit
désormais le paquet d'`app.json` plutôt que de le citer.
