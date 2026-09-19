# Lint du site : `eslint .`, et pourquoi la règle a changé (28 août 2026)

**Le site se vérifie avec `npm run lint` depuis `web/`**, qui appelle
`eslint .` et lit `web/eslint.config.mjs`.

⚠️ **Cette règle est l'inverse de celle qui tenait jusqu'au 28 août 2026**, et
le renversement mérite d'être compris avant d'y toucher.

**L'ancienne règle** — « `npx next lint`, jamais `eslint` à la main » — avait
une bonne raison : `npx eslint` lancé depuis `web/` **remontait
l'arborescence** et chargeait `eslint.config.js` à la **racine du dépôt**,
celle de l'application Expo. On croyait alors voir une trentaine d'erreurs
(« setState dans un useEffect » sur chaque page qui charge ses données au
montage) là où `next lint` n'en signalait aucune. Une fausse erreur a été
annoncée à Julien le 22 août, puis une désactivation de règle inutile écrite
et retirée.

**Ce qui a changé** : Next 16 a **supprimé la commande `next lint`**. Elle prend
désormais son argument pour un dossier — `npx next lint` répond « Invalid
project directory provided, no such directory: …/web/lint ».

**Et pourquoi le piège ne se rouvre pas** : ESLint 9 s'arrête à la **première**
configuration plate trouvée en partant du dossier courant. `web/eslint.config.mjs`
est trouvée avant celle de la racine, qui n'est donc plus jamais atteinte
depuis `web/`. **Vérifié, pas déduit** : en déplaçant temporairement le fichier,
`eslint --print-config` rend la configuration Expo (`import/ignore` sur
`@react-native`, extensions `.android.js`) ; en le remettant, non.

Deux détails à connaître :

- **`eslint-config-next` 16 exporte directement une configuration plate.** Pas
  de `FlatCompat` : il casse dessus (« Converting circular structure to JSON »,
  il tente de valider à l'ancienne une configuration qui ne l'est plus).
- **Trois règles de pureté React sont en avertissement**, pas en erreur :
  `react-hooks/set-state-in-effect`, `react-hooks/refs`, `react-hooks/purity`.
  Elles relèvent 35 points, dont 30 du même motif — une page qui charge ses
  données dans un effet. ⚠️ **Ce sont de vraies remarques**, à la différence de
  celles d'avant : elles décrivent une dette de style réelle. Elles restent
  visibles plutôt que désactivées, et ne bloquent pas — les traiter est une
  refonte des hooks, pas un sujet de sécurité, et cela ne se mène pas au milieu
  d'une montée de version. Les repasser en `error` le jour où on s'y attelle.

Ce qui ne change pas : **ne rien désactiver sur la foi d'un lint mal
configuré** — vérifier d'abord d'où viennent les règles.

## « À traiter » sur /admin : des gestes, pas des constats (22 août 2026)

Julien : *« pas besoin d'avoir ce genre de message, qui ne sont pas en
réalité des alertes »* — à propos de « n'a jamais lancé d'inventaire » et
« n'a pas compté depuis 64 jours ». Un magasin qui ne compte pas suit son
rythme, ce n'est pas une anomalie à corriger. Le bloc ne liste plus que ce
qui appelle un geste de Quantinvo : entreprise sans magasin (donc sans
licence facturée), entreprises sans administrateur, demandes de suppression
de compte. `admin_business_overview` rend toujours `idle_stores` ; la page
l'ignore. Ne pas réafficher ces lignes.
