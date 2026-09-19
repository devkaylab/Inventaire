# L'application et l'espace connecté parlent anglais (11 septembre 2026)

*« La traduction de l'app et du site en anglais. Fais attention au wording,
rien de trop formel, mais pas friendly non plus. »* Puis le périmètre :
**anglais seulement**, la langue par défaut reste le français, et chacun peut
changer — un bouton FR/EN sur le site, une ligne « Langue » dans Mon compte
sur l'application. La détection automatique est gardée : un appareil ou un
navigateur en anglais démarre en anglais.

## Ce qui est traduit, et ce qui ne l'est pas

| Surface | Langue |
|---|---|
| L'application, tous les écrans | FR / EN |
| L'espace connecté du site (`AppShell`, connexion, bienvenue, mots de passe) | FR / EN |
| La vitrine (`/`, `/tarifs`, `/inscription`…) | français |
| E-mails, PDF de devis, exports Excel et CSV | français |
| Mentions légales et politique de confidentialité | français, **avec une note en anglais** : « la version française fait foi » |
| La console Quantinvo (`/admin`) | français — c'est nous |

## ⚠️ LA PHRASE FRANÇAISE EST LA CLÉ

Pas d'identifiants (`login.title`) : `t('Se connecter')`, `tn('%{count} pièce',
'%{count} pièces', n)`. Le dictionnaire (`src/i18n/en.ts`, `web/i18n/en.ts`)
rend l'anglais, et **une clé inconnue s'affiche en français, jamais un trou**.
Conséquences à connaître avant de toucher à un texte :

- **changer une phrase française change sa clé** : la traduction tombe, et
  l'écran retombe sur le français sans erreur. C'est la garde
  (`tests/i18n.test.ts`, `web/tests/i18n.test.ts`) qui le dit — elle extrait
  chaque littéral passé à `t()` / `tn()` et exige son entrée ;
- **les constantes de module restent en français** (`STATUS_LABELS`,
  `ACTIONS` du journal, le contenu de la prise en main…) et sont enveloppées
  **au rendu** : `t(STATUS_LABELS[s])`. La garde ne voit pas ces clés
  calculées — leurs valeurs sont dans le dictionnaire à la main ;
- **`%{var}` interpole**, `%{count}` est groupé en milliers ; le pluriel suit
  la langue (fr : n ≤ 1 singulier, en : n === 1) ;
- **les espaces insécables sont normalisées** dans la clé : `Total :` et
  `Total :` sont la même entrée ;
- **`toLocaleString('fr-FR')` est devenu `locale()`** partout où une date ou un
  nombre s'affiche — la règle « la locale est toujours nommée » tient, elle
  vient maintenant du module.

## Les refus du serveur se traduisent À LA LECTURE

Les fonctions SQL répondent en français (`'error', 'Inventaire clôturé'`).
Les traduire côté serveur aurait voulu dire faire renvoyer des codes par cent
cinquante fonctions `SECURITY DEFINER`, en reposant les droits à chacune (le
piège de `create or replace`). `lib/erreursServeur.ts` — **copie exacte des
deux côtés**, un test compare — traduit donc le message français à
l'affichage, et les messages concaténés (« Transition impossible depuis … »)
par leur début. **Une phrase ajoutée à une fonction SQL se signale toute
seule** : la garde du site extrait tous les `'error', '…'` des migrations.

## Ce qui porte le choix

- **App** : `lib/i18n.ts` (module `t`, `tn`, `useLangue`, `locale`),
  `lib/langueAppareil.ts` (`expo-localization`, clé `ui.langue.v1`), écran
  `(compte)/langue.tsx`. ⚠️ **La pile racine est CLÉE sur la langue**
  (`<Stack key={langueCourante}>`) : changer de langue remonte tous les
  écrans, sinon un écran déjà monté garderait ses textes.
- **Site** : `lib/i18n.tsx` (`useTraduction()` dans les pages ; les composants
  enfants importent le `t` de module et se rendent sous une page abonnée),
  cookie `qlang` + `localStorage`, `LangueProvider` dans `app/layout.tsx`.
  ⚠️ **Le rendu serveur est toujours en français** (instantané 'fr') : la
  langue s'applique à l'hydratation, ce qui évite l'erreur d'hydratation et
  garde les pages statiques.
- **Le mot de passe et les pages de récupération portent aussi le bouton** :
  ce sont les premières pages qu'un compte anglophone voit.

## Vocabulaire fixé (voir l'en-tête de `src/i18n/en.ts`)

inventaire → inventory · balise → tag · emplacement → location · comptage /
audit → count / audit · compteur → counter · superviseur → supervisor ·
administrateur d'entreprise → company administrator · offre → plan · appareil
→ device · référence → SKU · pièce → unit. Anglais américain, « you » à
l'impératif, pas de « please » à chaque phrase, pas de point d'exclamation.

## Vérifications

- 520 tests de l'application, 1 360 du site, `tsc --noEmit` des deux côtés,
  `eslint .` à zéro erreur, `next build` avec la table de routes inchangée.
- **Au navigateur** : `/login` bascule FR → EN au bouton, la préférence suit
  d'une page à l'autre, la note anglaise apparaît en tête de
  `/mentions-legales`. Aucune erreur de console.
- **58 gardes réorientées, aucune affaiblie** (34 côté app, 24 côté site) :
  elles citaient les libellés français en dur, elles visent la forme `t('…')`.

Tests de garde : `tests/i18n.test.ts` et `web/tests/i18n.test.ts`.

## ⚠️ Après un `pod install`, les frameworks prébuilts mentent sur leur variante (11 septembre 2026)

Trouvé en reconstruisant pour le simulateur après l'installation
d'`expo-localization`. Deux symptômes successifs, une seule cause.

1. **« Undefined symbols for architecture arm64: facebook::react::Sealable »**
   à l'édition de liens, sur du code sain. Le core React prébuilt
   (`ios/Pods/React-Core-prebuilt/React.xcframework`) était la variante
   **Release**, servie par le cache CocoaPods — et le script de React Native
   (`replace-rncore-version.js`) qui doit l'échanger en Debug ne le fait que
   s'il trouve un repère `.last_build_configuration` ; **sans repère, il
   SUPPOSE Debug et ne touche à rien**.
2. Le core forcé en Debug, **l'application plante au lancement** (SIGSEGV dans
   `Props::Props()`, pendant l'enregistrement des vues Expo). Cette fois
   `ios/Pods/ExpoModulesCore/artifacts/.last_build_configuration` disait bien
   « debug » — mais le framework en place était la variante **Release**
   (empreinte MD5 identique à `ExpoModulesCore-release.tar.gz`). `pod install`
   écrit le repère ET pose ce que le cache lui donne, sans vérifier que les
   deux s'accordent. Le script d'échange lit le repère, conclut qu'il n'y a
   rien à faire, et un module Release se retrouve chargé contre un core Debug.

**Le remède est dans `scripts/simulateur.sh`** : quand `ios/Pods/Manifest.lock`
est plus récent que le jalon `ios/build/.prebuilts-verifies`, tous les repères
(core React et `ios/Pods/*/artifacts/`) sont déclarés « release », ce qui force
la ré-extraction en Debug au build suivant. Une extraction, une fois par
`pod install`.

À retenir au-delà du script :

- **un repère de variante ne prouve rien** — quand un prébuilt se comporte
  bizarrement, comparer l'empreinte du binaire en place à celle des deux
  archives d'`artifacts/`, c'est ce qui a tranché ;
- **ne pas conclure à un défaut du code** sur une erreur de lien ou un
  SIGSEGV dans du code React/Expo juste après un `pod install` : c'est la
  première chose à regarder ;
- **ne pas relancer l'application en boucle pour « voir »** : chaque
  plantage ouvre un rapport sur le Mac de Julien (constat du jour).

## La vitrine aussi, sous `/en` (11 septembre 2026, après-midi)

*« Bouton changement de langue à mettre sur tout le site, pas uniquement après
la connexion. »* Puis, la méthode tranchée par Julien parmi trois : **des
adresses `/en` dédiées, indexables** — pas une bascule sur place, qui aurait
laissé l'anglais invisible de Google.

| | Français | Anglais |
|---|---|---|
| Accueil | `/` | `/en` |
| Les huit autres pages de la vitrine | `/tarifs`, `/inventaire`, … | `/en/tarifs`, `/en/inventaire`, … |
| Connexion, espace connecté, devis | une seule adresse, langue du **cookie** | |

**⚠️ SUR LA VITRINE, LA LANGUE EST DANS L'ADRESSE — PAS DANS LE COOKIE.**
`lib/vitrine.ts` porte la règle (`langueDuChemin`, `lienVitrine`,
`cheminDansLangue`), et `useLangue()` l'applique : sous `/en` le rendu serveur
sort **déjà en anglais**, sans désaccord d'hydratation, et Google lit deux
pages liées par `hreflang` (`lib/metaVitrine.ts`, `x-default` sur le
français). Ailleurs, rien ne change : c'est le choix de l'appareil.

Ce qui porte le chantier :

- **`lib/traduction.ts`** est le cœur SANS React ni `'use client'` : un
  composant serveur appelle `traduction(langue)` et reçoit `{ t, tn, lien }`.
  `lib/i18n.tsx` ne garde que l'abonnement et la persistance.
- **Chaque page de la vitrine est un composant** (`components/vitrine/*.tsx`)
  rendu par deux enveloppes — `app/x/page.tsx` en `fr`, `app/en/x/page.tsx` en
  `en` — qui lisent la **même** entrée de `lib/metaVitrineTextes.ts`. Une
  garde vérifie que les jumelles ne divergent pas.
- **Les liens s'écrivent en français et passent par `lien()`** : `/tarifs`
  devient `/en/tarifs` sur la version anglaise, `/login` et un `mailto:` ne
  bougent pas. Une garde refuse un `href` de vitrine écrit en dur.
- **Le bouton FR/EN fait deux choses différentes** : sur la vitrine il
  NAVIGUE vers la jumelle et note le choix dans le cookie (pour que la
  connexion suive) ; ailleurs il change la langue sur place.
- **La détection automatique** (`components/RedirectionLangue.tsx`) ne va
  que **du français vers l'anglais**, seulement si la préférence enregistrée
  dit « en », **jamais pour un robot** — un moteur qui explore `/tarifs` doit y
  trouver la page française. `replace`, pas `push`.
- **`<html lang>`** reste « fr » dans le HTML serveur (le layout racine ne
  connaît pas l'adresse) : un script en tête le passe à « en » sous `/en`
  avant le premier affichage, et ce sont les `hreflang` qui font foi pour les
  moteurs.
- **La grille, les FAQ, les longs paragraphes** gardent leur français comme
  clé ; les paragraphes qui portent un mot en gras sont découpés en segments.
  Le titre de l'accueil passe en `absolute` : le gabarit `%s — Quantinvo`
  l'aurait doublé.

Vérifié : HTML servi par le serveur en anglais sous `/en` (titre, `h1`,
navigation préfixée, `hreflang` dans les deux sens), bouton EN → FR qui
renvoie sur `/` avec le cookie posé, cookie « en » + `/tarifs` → `/en/tarifs`,
grille des tarifs en anglais dès le rendu, débordement horizontal nul. 1 368
tests, `next build` avec neuf routes `/en` statiques de plus.

Tests de garde : `web/tests/i18n.test.ts`, bloc « la vitrine a deux adresses
par page ».
