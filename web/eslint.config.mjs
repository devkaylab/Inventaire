// Lint du site — configuration « plate » d'ESLint 9.
//
// ⚠️ CE FICHIER REMPLACE `.eslintrc.json` ET LA RÈGLE « npx next lint ».
// Next 16 a **supprimé** la commande `next lint` (elle prend désormais son
// argument pour un dossier : « no such directory: …/web/lint »). On appelle
// donc `eslint` directement — ce que le projet interdisait jusqu'ici.
//
// L'interdiction avait une bonne raison, et elle est levée par la
// configuration plate, pas par oubli : `npx eslint` lancé depuis `web/`
// remontait l'arborescence et chargeait `eslint.config.js` **à la racine du
// dépôt** — celle de l'application Expo, avec ses règles React étrangères au
// site. On croyait alors voir une trentaine d'erreurs (« setState dans un
// useEffect » sur chaque page qui charge ses données au montage) là où il n'y
// en avait aucune.
//
// ESLint 9 s'arrête à la **première** configuration plate trouvée en partant
// du dossier courant : ce fichier-ci. La configuration Expo de la racine n'est
// donc plus jamais atteinte depuis `web/`. Vérifié en le lançant, pas déduit.
//
// La commande reste `npm run lint`, qui appelle maintenant `eslint .`.
//
// `eslint-config-next` 16 exporte directement une configuration plate : pas de
// `FlatCompat`, qui casse dessus (« Converting circular structure to JSON » —
// il tente de valider à l'ancienne une configuration qui ne l'est plus).
import coreWebVitals from 'eslint-config-next/core-web-vitals'

export default [
  {
    ignores: ['node_modules/**', '.next/**', 'out/**', 'playwright-report/**', 'test-results/**'],
  },
  ...coreWebVitals,
  {
    // ── Les trois règles de pureté React, en avertissement ──────────────────
    //
    // `eslint-config-next` 16 embarque les règles de l'ère du compilateur
    // React. Elles relèvent **35 points** sur ce site, dont 30 du même motif :
    // une page qui charge ses données dans un `useEffect` et appelle `setState`
    // au retour. C'est le motif de toutes les pages connectées ici, et c'est un
    // motif React parfaitement courant.
    //
    // ⚠️ Ce sont de VRAIES remarques, pas des faux positifs — à la différence
    // de celles que voyait `npx eslint` avant Next 16, qui venaient de la
    // configuration Expo chargée par erreur (voir l'en-tête). Elles décrivent
    // une dette de style réelle : un `setState` dans un effet provoque un
    // second rendu, et lire `ref.current` pendant le rendu peut désynchroniser.
    //
    // Elles restent donc **visibles en avertissement** plutôt que désactivées,
    // et ne bloquent pas : les traiter est un chantier de refonte des hooks, pas
    // un sujet de sécurité, et il ne se mène pas au milieu d'une montée de
    // version. Les remettre en `error` le jour où on s'y attelle.
    rules: {
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/purity': 'warn',
    },
  },
]
