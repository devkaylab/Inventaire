# La politique de confidentialité est servie par le site (2 septembre 2026)

*« Je préfère utiliser le lien de notre site pour les communications
commerciales, pas github ou autre. »* Elle vivait sur GitHub Pages
(`devkaylab.github.io/Inventaire/privacy.html`), et cette adresse figurait dans
la fiche produit, le dossier de déploiement MDM, la note aux salariés, les
e-mails et les deux applications.

Nouvelle adresse : **`https://www.quantinvo.com/confidentialite`**.

## ⚠️ UN SEUL DOCUMENT, DEUX ADRESSES

La page **ne recopie pas** la politique : `web/app/confidentialite/page.tsx` lit
`docs/privacy.html` **à la construction** et injecte son `<body>` tel quel.
Recopier une politique de confidentialité, c'est garantir que les deux versions
divergeront — et c'est le document où ça se paie le plus cher. Le fichier reste
l'original, avec sa garde (`web/tests/confidentialite.test.ts`, qui refuse un
sous-traitant non déclaré) et son hébergement GitHub Pages.

- **Lue à la construction, jamais à la requête** : la page est statique (`○`
  dans la table des routes), et le fichier n'a pas à exister sur le serveur qui
  la sert. `process.cwd()` vaut `web/` pendant `next build`, d'où
  `path.join(process.cwd(), '..', 'docs', 'privacy.html')`.
- **Une lecture ratée fait ÉCHOUER la construction** (`throw`) : mieux vaut un
  build rouge qu'une page de confidentialité vide en ligne. Un test le fige.
- **Page publique, donc hors d'`AppShell`** : elle s'ouvre depuis un e-mail,
  souvent au téléphone, et l'espace connecté se ferme sous 720 px.
- Le corps injecté porte ses propres classes (`.meta`, `.note`, `.wrap`) et des
  tableaux sans classe : `globals.css` les habille **sous `.legal`**, sans
  toucher au document. Le tableau des sous-traitants défile **dans son cadre**
  à 375 px — vérifié, débordement de page nul.

## ⚠️ GITHUB PAGES RESTE EN LIGNE, ET DOIT LE RESTER

On ajoute une adresse, on n'en retire pas. Deux populations pointent encore vers
l'ancienne, et aucune ne peut être mise à jour à distance :

- **les applications installées** — `src/constants/links.ts` ne prend effet
  qu'au prochain build ;
- **les e-mails déjà partis**, et ceux qui partiront jusqu'au redéploiement des
  fonctions edge : `POLITIQUE_URL` d'`_shared/email.ts` est une **constante**,
  pas une variable d'environnement lue à l'exécution.

Rien ne casse entre-temps, précisément parce que l'ancienne page répond
toujours. ⚠️ Ne pas désactiver GitHub Pages sur le dépôt.

## Ce qui a basculé, et quand ça prend effet

| Où | Effet |
|---|---|
| `web/lib/links.ts` | au déploiement du site (immédiat) |
| `docs/entreprise/fiche-produit/` | fiche régénérée, Word et PDF |
| `docs/entreprise/deploiement-mdm.md`, `docs/conformite/information-salaries.md` | documents remis |
| `src/constants/links.ts` | **au prochain build mobile** |
| `supabase/functions/_shared/email.ts` | **fait** — quatorze fonctions redéployées le 2 septembre 2026 |

## Les quatorze fonctions qui envoient un e-mail, redéployées

`POLITIQUE_URL` vit dans le gabarit partagé : **toute fonction qui envoie un
message la porte dans son pied**. Elles sont donc toutes concernées —
`accept-quote`, `admin-fulfil-store-request`, `admin-reject-store-request`,
`admin-send-quote`, `alerte-anomalies`, `ca-invite-supervisor`,
`ca-request-store`, `decline-quote`, `invite-company-admin`, `invite-teammate`,
`invite-to-session`, `message-admin`, `stripe-webhook`, `submit-company-request`.

- **Par le CLI**, `stripe-webhook` comprise — c'est le chemin que la règle du
  projet impose pour elle, et il était de nouveau joignable ce jour-là (le CLI
  est authentifié ; seul l'accès HTTP sortant vers `*.supabase.co` reste bloqué
  depuis l'agent).
- **⚠️ `--no-verify-jwt` sur les cinq publiques uniquement** : `accept-quote`,
  `decline-quote`, `submit-company-request`, `alerte-anomalies`,
  `stripe-webhook`. Les neuf autres se déploient sans le drapeau. **L'état a été
  relevé sur la base AVANT de déployer**, pas déduit de cette note — et
  recontrôlé après : `verify_jwt` n'a bougé sur aucune.
- **⚠️ Vérifier ce qu'on emporte avant de redéployer.** Un redéploiement pousse
  le dépôt entier de la fonction, pas seulement le changement voulu. Les
  commits postérieurs au dernier déploiement ont été listés dossier par
  dossier : tous étaient le commit du déploiement lui-même (le projet déploie,
  vérifie, puis commite), donc rien d'autre n'est parti.

**Contrôle de clôture, celui qui manquait le matin même** :
`supabase functions download stripe-webhook` puis `diff` — les trois fichiers
(`index.ts` et les deux `_shared/`) sont **identiques au dépôt**, et le bundle
déployé porte bien la nouvelle adresse.

**Et vérifié en fonctionnement, par `pg_net` depuis Postgres** (le proxy bloque
`*.supabase.co` depuis l'agent) : `stripe-webhook` répond 405 sur GET et
**400 « signature absente »** sur un POST nu — ce 400 est aussi le contrôle de
`verify_jwt`, une fonction protégée aurait répondu 401 avant d'atteindre le
code ; `accept-quote` répond 400 « Lien invalide. », donc elle atteint la base
et ses trois modules partagés se chargent.

Tests de garde : `web/tests/confidentialite.test.ts`, bloc « la politique est
servie par le site ».
