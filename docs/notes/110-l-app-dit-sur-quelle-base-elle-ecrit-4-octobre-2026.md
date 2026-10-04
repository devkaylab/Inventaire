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

## Vérifié

- **Six sabotages, six morsures** : l'hôte de production lu dans
  l'environnement, un `includes` au lieu de l'égalité, la sortie du composant
  déplacée après la construction de la vue, la couleur prise au thème, le
  bandeau retiré du layout, et `BASE` acceptant le mode Debug.
- 549 tests de l'app au vert, 1 565 du site, `tsc` sans erreur.
