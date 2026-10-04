# L'app dit sur quelle base elle écrit — 4 octobre 2026

Même journée que les fiches 108 et 109. Le site a reçu son garde le matin ;
celui-ci est son équivalent pour l'application, et il ne pouvait pas être le
même.

## Pourquoi le garde du site ne se transpose pas

- Le site lit ses variables **au déploiement**, et Vercel sait leur donner une
  portée « Preview ». L'app lit `EXPO_PUBLIC_SUPABASE_URL` **au bundle**, dans
  un `.env` unique : pas de portée, pas d'environnement.
- ⚠️ **Il n'y a qu'une seule app.** Un identifiant, `com.quantinvo.app`, iOS et
  Android. Un build d'essai installé sur un vrai téléphone **écrase l'app
  publiée**, et rien ne les distingue sur l'appareil. Lui donner un autre
  identifiant est exclu pendant la migration Apple — Xcode régénérerait un
  profil.

D'où : on teste **au simulateur**, et l'app **dit** sur quelle base elle écrit.

## Le bandeau

`src/components/BandeauBaseEssai.tsx`, monté dans le layout racine **avant**
`OfflineTopBanner` : savoir sur quelle base on écrit prime sur le réseau.

- Hors production : une bande rouge, en permanence, qui nomme le projet
  (`BASE D'ESSAI — pas la production · lqgusznqcunjhrqslcug`). Le repère n'est
  pas décoratif — sans lui, deux bases d'essai se confondent.
- ⚠️ **Sur l'app publiée il rend `null`** — pas une bande de hauteur nulle,
  rien. Une bande nulle réserverait quand même la zone sûre et décalerait
  l'en-tête de tous les écrans. La sortie est la **première ligne** du
  composant, et une garde le vérifie.
- ⚠️ **Couleurs en dur, hors du thème.** Un thème se charge, peut échouer, et
  se choisit ; cette bande doit s'afficher quand tout le reste est encore gris.
- Pas d'animation, pas de fermeture : ce n'est pas un état qui change, c'est ce
  qu'est ce build.

⚠️ **L'hôte de production est écrit en dur** dans `src/lib/baseConnectee.ts`.
Le lire dans l'environnement rendrait la règle circulaire — c'est précisément
l'environnement qu'on met en doute. Et la comparaison est une **égalité
d'hôte**, jamais un `includes` : `…supabase.co.ailleurs.net` resterait suspect.

⚠️ **Une adresse absente n'est PAS la production.** Un build sans `.env` ne se
connecte à rien ; le prendre pour la production ferait disparaître le bandeau
au pire moment.

## Le choix de la base : `BASE=`

```
BASE=ondemand CONFIG=Release ./scripts/simulateur.sh
```

**Mesuré, pas supposé** : `@expo/env` n'écrase jamais une variable déjà posée
dans l'environnement du processus — vérifié en chargeant `.env` avec une
sentinelle en place, « la variable du shell gagne ». Le script **exporte** donc
le contenu de `.env.<nom>` et ne touche jamais à `.env`. Un `.env` échangé puis
restauré se perdrait au premier Ctrl-C, et le build suivant partirait sur la
base d'essai sans que personne ne l'ait demandé.

⚠️ **`BASE` refuse le mode Debug, et c'est le point le plus important de ce
chantier.** En Debug le JS ne vient pas de ce script : il vient de **Metro**,
lancé dans un autre terminal, qui lit `.env` et ne verra jamais ce qu'on
exporte ici. L'app tournerait sur la **production** en affichant le bandeau
« base d'essai ». Un garde qui ment est pire que pas de garde. Le script
s'arrête et donne la commande juste.

`.env.ondemand` vit sur la branche `on-demand`, pas sur `main` : le chantier
On-Demand ne laisse pas de trace dans le produit qui tourne. Le mécanisme, lui,
est générique — `BASE=<nom>` lit `.env.<nom>`.

## Vérifié au simulateur, dans les DEUX états

iPhone 17 Pro, `CONFIG=Release`, écran de connexion :

| build | bandeau | contenu décalé | réf. On-Demand dans le bundle |
|---|---|---|---|
| `BASE=ondemand` | **rouge, « BASE D'ESSAI — pas la production · lqgusznqcunjhrqslcug »** | oui | 1 |
| sans `BASE` | **aucun** | non | 0 |

Deux bundles d'empreintes différentes, et le second ne contient **aucune**
référence au projet d'essai.

## ⚠️ Deux pièges payés pour y arriver

**1. `strings` ne voit pas le texte du bandeau.** Première mesure : zéro
occurrence de « BASE D'ESSAI » dans le bundle — de quoi conclure que le build
était périmé. Faux. **Hermes range en UTF-16 toute chaîne contenant un
caractère non-ASCII**, et l'apostrophe typographique en est un. En comparant
les octets dans les deux encodages, les textes étaient bien là. Un chiffre
invraisemblable est d'abord un défaut de mesure.

**2. ⚠️ « ✓ Prêt » a menti, et le script le dit maintenant.** L'application
lancée n'était PAS celle qui venait d'être construite : `simctl install` avait
rendu 0 alors que le simulateur s'était éteint entre-temps. Le bandeau semblait
ne pas marcher. `scripts/simulateur.sh` **compare désormais le JavaScript
réellement installé à celui qu'il vient de produire**, et s'arrête si les deux
diffèrent. Le code de retour ne suffisait pas — c'est tout le propos.

## ⚠️ Troisième piège : le script n'imposait pas Xcode 26.6

Julien a lancé la commande sans le préfixe `DEVELOPER_DIR=…` — que j'avais mis
sans y penser dans mes propres essais. Le build est parti sur **Xcode 27**,
`iPhoneSimulator27.0.sdk`, et a échoué sur `ExpoModulesJSI xcframework` : un
mur de clang de trois cents lignes où le seul indice utile était le nom du SDK,
noyé au milieu.

**Une règle qu'il faut se rappeler à chaque fois n'est pas une règle, c'est un
piège.** Le script pose maintenant `DEVELOPER_DIR` lui-même quand
`/Applications/Xcode-26.6.app` existe, annonce la version qu'il emploie, et
**refuse** un Xcode 27 — sur la version réellement rendue par `xcodebuild`,
pas sur le chemin, pour qu'un Xcode 27 visé à la main soit arrêté aussi. Un
`DEVELOPER_DIR` passé par l'appelant reste prioritaire.

## Vérifié aussi

- **Six sabotages, six morsures** : l'hôte de production lu dans
  l'environnement, un `includes` au lieu de l'égalité, la sortie du composant
  déplacée après la construction de la vue, la couleur prise au thème, le
  bandeau retiré du layout, et `BASE` acceptant le mode Debug.
- Plus une septième garde, sabotée elle aussi : le contrôle d'installation.
- 550 tests de l'app au vert, 1 565 du site, `tsc` sans erreur.
