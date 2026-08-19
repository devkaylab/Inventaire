# Tableau de bord superviseur — état des lieux

> Branche `claude/inventory-dashboard-supervisor-n92vr0` · PR #2
> Dernière mise à jour : 12 août 2026

Ce document sert à reprendre le chantier sans avoir suivi son développement. Il dit ce qui
est fait, **pourquoi ça a été fait comme ça**, ce qui reste, et comment tester.

---

## 1. Où en est le chantier

| | État | Action nécessaire |
|---|---|---|
| Code | 2 commits sur la branche, poussés | — |
| PR #2 | ouverte en **brouillon** | à sortir du brouillon une fois le test terrain passé |
| Base de données | 4 migrations **appliquées** sur `heabesqvlinzarqenymj` | — |
| Site | preview Vercel déployée et fonctionnelle | — |
| Application iPhone | build actuel **sans la présence** | **nouveau build requis** (§7) |

Vérifications passées en local : `tsc --noEmit`, `next lint`, `next build`, `expo lint`,
79 tests unitaires, 25 scénarios Playwright.

⚠️ **La preview Vercel pointe sur la base de production.** Pour tester, créer un inventaire
dédié — l'onglet Écarts et la suppression définitive agissent sur les vraies données.

---

## 2. Ce qui est fait

Le site (`web/`) ne faisait que consulter : 3 onglets, 3 mutations. Tout le métier
superviseur était réservé au mobile. Le tableau de bord d'un inventaire est devenu son
profil complet, en six onglets.

### Suivi — qui est connecté, qui compte quelle balise

| Fichier | Rôle |
|---|---|
| `src/lib/presence.ts` | **mobile** : publie la présence sur un canal Realtime |
| `web/lib/presence.ts` | **site** : contrat partagé + aplatissement de l'état du canal |
| `web/hooks/useSessionLive.ts` | une seule socket : présence + broadcast + sondage de repli |
| `web/lib/presence-summary.ts` | compte les appareils par mode — **tout ce que le site déduit de la présence** |
| `web/lib/activity.ts` | lit le fil des scans (sans l'auteur) |
| `web/components/dashboard/tabs/SuiviTab.tsx` | l'écran |

Côté mobile, le hook est appelé depuis `src/components/scanner.tsx` (là où vit le mode
courant) et depuis les deux écrans de session superviseur et compteur. Le scanner émet
aussi un `pingSession` après chaque scan et chaque ouverture/clôture de balise.

**Depuis le 19 août 2026 (contrat v2)**, la présence ne transporte plus que le mode et le
battement : ni nom, ni écran, ni balise, ni état d'avant-plan. Le site en tire des
compteurs et n'émet rien lui-même. Voir `docs/conformite/suivi-activite-analyse.md`.

### Les autres onglets

- **Zones & balises** — `web/lib/zones.ts`, `ZonesTab.tsx` : affectation de plages à un
  emplacement (`define_zone`), suppression, et réouverture/clôture d'une balise laissée
  ouverte par un compteur parti trop vite (`set_balise`).
- **Fichiers** — `web/lib/import.ts`, `FichiersTab.tsx` : portage de `src/lib/import.ts`.
  Parsing, normalisation d'en-têtes et envoi par lots repris à l'identique ; seules les
  entrées/sorties changent (`File` du navigateur au lieu d'`expo-document-picker`).
- **Écarts** — `web/lib/discrepancies.ts`, `EcartsTab.tsx` : la règle métier isolée dans un
  module pur, plus l'écran d'arbitrage.
- **Rapport** — `web/lib/report.ts`, `RapportTab.tsx` : portage de `src/lib/report.ts`,
  mêmes deux feuilles, plus un export CSV. `xlsx` est en import différé pour ne pas peser
  sur le premier chargement.
- **Équipe** — `EquipeTab.tsx` : membres, invitations, identifiants, clôture et suppression.
- **Création** — `web/app/dashboard/new/page.tsx`, avec l'enchaînement guidé
  zones → fichiers → suivi, en miroir de `src/app/(supervisor)/new-session.tsx`.

Fondations transverses : jetons de design sémantiques dans `globals.css`,
`web/lib/format.ts`, `web/hooks/useAuthGuard.ts` (garde unique), `web/components/ui/`
(toasts, confirmation, états vides, ossatures), `web/app/error.tsx`.

---

## 3. Décisions structurantes, et pourquoi

C'est la partie qui se perd le plus vite. Elle explique des choix qui, sans leur raison,
ressemblent à des complications gratuites.

### Deux couches pour la présence, pas une

Rien dans la base ne trace la présence, et c'est voulu.

| Source | Sait | Ne sait pas |
|---|---|---|
| Canal Realtime | combien d'appareils sont connectés, et dans quel mode | qui ils sont — plus rien ne le dit depuis la v2 |
| Fil des scans (`counts`) | ce qui a été scanné, où, quand | par qui : l'auteur n'est plus descendu au navigateur |

`get_session_activity`, qui rendait une ligne nominative par personne, n'a plus d'appelant.
Sa suppression est prête mais **différée au déploiement** du contrat v2 — voir
`docs/conformite/suivi-activite-analyse.md`.

### La règle des 90 secondes

Une présence dont le dernier battement dépasse `STALE_MS` (90 s, soit trois battements
manqués) **cesse d'être comptée** : sans ce filtre, une socket fermée brutalement
gonflerait durablement le nombre d'appareils connectés. C'est le cas du téléphone oublié dans une poche
ou de la réserve sans réseau — celui où un suivi naïf ment avec assurance, parce que la
socket serveur survit au téléphone. La règle est testée dans `web/tests/merge.test.ts`.

Corollaire tenu partout : **« en ligne » ne vient jamais des comptages.**

### Sondage + broadcast, pas `postgres_changes`

`postgres_changes` aurait imposé de publier `counts` dans `supabase_realtime`, de passer la
table en `REPLICA IDENTITY FULL` pour que les suppressions portent le `session_id` du
filtre, et surtout Realtime aurait réévalué la policy `SELECT` de `counts` — deux fonctions
`SECURITY DEFINER`, dont un `exists` corrélé — **pour chaque ligne et chaque abonné, pendant
une rafale de scans**. Le tout pour apprendre « quelque chose a changé », ce que le
broadcast dit gratuitement. Le sondage (8 s, onglet visible seulement) et le broadcast
laissent l'accès aux données exactement là où il est : PostgREST et ses policies.

### Duplication assumée entre `src/` et `web/`

Deux paquets npm distincts, React 19 contre React 18, Expo contre Next : mutualiser
imposerait un workspace, et Metro avec du hoisting est une source connue d'ennuis. La
logique dupliquée est pure, et une dérive y serait **bruyante** (un import raté se voit).

**L'exception, c'est le contrat de présence** : une dérive y serait *silencieuse* — le site
afficherait « personne connectée » sans que rien ne signale l'erreur. D'où le champ `v`
(`PRESENCE_V`) : le site écarte les charges dont il ne connaît pas la version et affiche un
bandeau « version d'application inconnue » plutôt que de faire semblant.

### Clôturer n'est pas supprimer

« Clôturer » appelait `delete_session` et effaçait tout. Séparer les deux ne suffisait pas :
aucune policy d'insertion de `counts` ne regardait le statut, donc un compteur resté sur son
téléphone aurait continué d'écrire dans un inventaire clôturé, et un rapport exporté la
veille n'aurait plus correspondu aux données du lendemain. D'où la migration `…000003`.

---

## 4. Incohérences corrigées

Chacune avec son symptôme observable, pour repérer une régression.

| Incohérence | Symptôme si elle revient |
|---|---|
| « Clôturer » supprimait tout | le statut « Clôturée » n'est jamais atteint ; la liste « Clôturés » reste vide |
| Un inventaire clôturé acceptait les scans | scanner sur un inventaire clôturé enregistre au lieu d'être refusé |
| `get_session_detail` partait du comptage | un article audité jamais compté n'apparaît pas dans l'export |
| `parseFloat('1,5')` valait `1` | arbitrer `2,5` enregistre `2` |
| `find_user_by_email` exécutable par `PUBLIC` | un compte connecté peut énumérer les utilisateurs par e-mail |
| Pas de rafraîchissement | l'écran reste figé pendant un comptage en cours |
| `recompute_session_audit` à chaque montage d'onglet | une écriture serveur à chaque changement d'onglet |
| Garde d'authentification dupliquée 4 fois | contenu qui s'affiche puis disparaît à la redirection |
| Admin non superviseur | un administrateur est renvoyé vers `/account` sans accès aux inventaires |
| Jetons de design absents | les couleurs d'état repassent en hexadécimal en dur |

---

## 5. Migrations

Toutes **déjà appliquées** sur `heabesqvlinzarqenymj`, et présentes dans
`supabase/migrations/`.

| Migration | Effet |
|---|---|
| `20260812000001_get_session_detail_full_join` | la clé (article, balise) vient de l'union comptage ∪ audit — les lignes auditées jamais comptées réapparaissent |
| `20260812000002_session_activity` | RPC `get_session_activity` + deux index sur `counts` (aucun ne couvrait `created_at`). La RPC n'a plus d'appelant ; sa suppression est différée au déploiement. Les index restent utiles au fil des scans |
| `20260812000003_closed_session_is_read_only` | un inventaire clôturé refuse les insertions de `counts` et `set_balise` |
| `20260812000004_revoke_anon_session_rpcs` | droits d'exécution refermés ; `find_user_by_email` revient au `service_role` seul |

Sur la dernière : révoquer sur `anon` ne suffisait pas. `PUBLIC` est un pseudo-rôle qui
englobe `anon` et `authenticated` — tant que le droit `PUBLIC` subsiste, retirer `anon` ne
change rien. C'est ce qui explique que des révocations de migrations antérieures n'avaient
jamais pris effet.

---

## 6. Ce qui reste à faire

### Bloquant

- [ ] **Valider la présence temps réel sur le terrain** — protocole au §7. C'est la seule
      chose que l'environnement de développement ne pouvait pas exercer : il n'a pas accès
      à `*.supabase.co`. Les tests couvrent le comportement quand la présence est
      indisponible, pas quand elle fonctionne.

### À décider

- [ ] Sortir la PR #2 du brouillon une fois le test passé.
- [ ] **Canaux Realtime privés.** Aujourd'hui le canal `session:<uuid>:presence` est public :
      quiconque connaît l'UUID d'un inventaire peut lire la présence. L'UUID n'est pas
      devinable et la charge ne contient que des noms déjà visibles des participants, donc
      c'est acceptable en l'état. Pour durcir : activer l'autorisation Realtime avec une
      policy sur `realtime.messages` adossée à `is_session_participant`, et passer
      `private: true` **des deux côtés en même temps** — sinon la présence s'arrête sans
      bruit.
- [ ] Ajouter `expo-dev-client` si plusieurs allers-retours de test sont prévus : le profil
      `development` d'`eas.json` deviendrait opérationnel et le JS se rechargerait à chaud.

### Dette identifiée, non traitée

- **Dérive du dossier `migrations`.** Une dizaine d'objets existent en base sans fichier :
  les tables `stores`, `zones`, `account_deletion_requests`, la colonne `profiles.is_admin`,
  et les fonctions `is_admin()`, `norm_balise()`, `generate_zones()`, `ensure_zone()`,
  `set_zone_status()`, `register_balise()`, `admin_create_company()`, `admin_delete_*()`,
  `request_account_deletion()`. **La base fait foi, pas le dossier.** Avant toute
  intervention sur le schéma, régénérer les types et interroger `pg_policies` / `pg_proc`.
- **`xlsx@0.18.5`** est la dernière version publiée sur npm ; les correctifs de sécurité
  (pollution de prototype, ReDoS) ne sont que sur le CDN SheetJS. L'exposition est faible —
  un superviseur ouvre son propre fichier dans son propre navigateur — mais si l'on migre,
  il faut migrer **les deux applications ensemble**, sous peine de parsing divergent.
- **`expo lint`** signale des erreurs préexistantes dans `src/components/scanner.tsx`
  (lignes 276 et 309), `src/components/HelpModal.tsx` et `src/hooks/use-color-scheme.web.ts`
  (`setState` synchrone dans un effet), plus des apostrophes non échappées dans plusieurs
  écrans. Rien de tout cela n'a été introduit ici et la correction touche au comportement du
  scanner — laissé de côté volontairement.

---

## 7. Protocole de test iPhone + site

### Prérequis

```bash
git fetch origin
git checkout claude/inventory-dashboard-supervisor-n92vr0
npm install            # racine : application Expo
cd web && npm install  # site
```

Deux fichiers d'environnement, tous deux ignorés par git :

- **racine `.env`** → `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- **`web/.env.local`** → `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Mêmes valeurs, noms différents : Next impose le préfixe `NEXT_PUBLIC_`. Sans
`web/.env.local`, `next build` échoue sur un message sans rapport (« supabaseUrl is
required »), le client Supabase étant instancié à l'import de chaque page.

### Le site

La preview Vercel est déjà déployée et branchée sur la vraie base — rien à installer. Elle
se met à jour à chaque push sur la branche. En local si besoin : `cd web && npm run dev`.

### Le build iPhone

**La présence est du code neuf** : l'application déjà installée ne l'a pas. Sans nouveau
build, le tableau de bord n'affichera jamais personne « en ligne ».

Le profil `development` d'`eas.json` **ne fonctionne pas en l'état** — il demande
`developmentClient: true` alors qu'`expo-dev-client` n'est pas dans les dépendances. Deux
chemins praticables :

```bash
# a. EAS, profil preview — sans câble ni Xcode, lien + QR à la fin (15-25 min)
npx eas-cli build --platform ios --profile preview

# b. Xcode, iPhone au câble — immédiat, et les logs Metro sous les yeux
npx expo run:ios --device
```

Le dossier `ios/` est déjà généré : pas de prebuild à refaire.

### Déroulé, à deux comptes

Utiliser **deux comptes différents** : compteur sur le téléphone, superviseur sur
l'ordinateur. Avec le même compte des deux côtés, le site fusionne les appareils en une
seule ligne (il garde le battement le plus récent) — ça marche, mais on ne voit rien.

1. Ordinateur : créer un inventaire de test, mode « Zones et balises ».
2. Onglet **Zones & balises** : affecter une plage, par exemple « Réserve » = balises 1 à 5.
3. Onglet **Fichiers** : importer un petit référentiel (SKU / EAN / Marque / Libellé).
4. Onglet **Équipe** : relever le numéro d'inventaire et le code d'accès.
5. iPhone : rejoindre l'inventaire avec ces identifiants.
6. Rester sur l'onglet **Suivi** et observer.

| Sur l'iPhone | Sur le site, onglet Suivi |
|---|---|
| App ouverte sur l'inventaire | pastille verte, « connecté · ne scanne pas » |
| Entrer dans *Compter des articles* | « scanner ouvert · aucune balise ouverte », badge **Comptage** indigo |
| Scanner une balise | « balise 1 · Réserve · depuis moins d'une minute », la durée avance |
| Scanner des articles | le fil se remplit en ~1 s, la progression bouge |
| Rescanner la balise pour la clôturer | la pastille de la balise se remplit dans la grille |
| Refaire le parcours en *Auditer* | badge **Audit** doré, la seconde barre avance |
| Verrouiller le téléphone | « connecté · application en arrière-plan » |
| Couper Wi-Fi et données | après ~90 s : « hors ligne · dernier scan il y a X · balise 1 » |

**La dernière ligne est le point le plus important du test.**

Puis : provoquer un écart en audit → onglet **Écarts**, tester « Auditeur » puis une
quantité avec virgule (`2,5`) ; onglet **Rapport** → export Excel, vérifier la feuille
*Détail par zone* et ses colonnes « Compté par » / « Audité par » ; onglet **Équipe** →
*Clôturer*, puis retenter un scan sur l'iPhone — **il doit être refusé** ; enfin *Rouvrir*.

### Si la présence ne remonte pas

L'en-tête affiche l'état du canal, ce qui oriente le diagnostic :

- **« Temps réel indisponible »** → le canal ne s'ouvre pas. Vérifier que Realtime est activé
  sur le projet ; un 403 au `subscribe` dans la console signale un jeton non transmis. Le
  site continue en sondage : l'activité reste juste, seul le « en ligne » manque.
- **« Temps réel actif » mais le téléphone n'apparaît jamais** → c'est presque toujours le
  build. Confirmer que l'app installée vient bien de cette branche.
- **Bandeau orange « version d'application inconnue »** → `src/lib/presence.ts` et
  `web/lib/presence.ts` ont divergé.
- **Le téléphone apparaît sans balise** → il est sur l'écran de session, pas dans le
  scanner, ou aucune balise n'est ouverte. Comportement attendu.

---

## 8. Points de vigilance

1. **`src/lib/presence.ts` et `web/lib/presence.ts` doivent rester synchronisés.** Les deux
   portent un en-tête qui le rappelle. En cas de changement de format, incrémenter
   `PRESENCE_V` des deux côtés — le site signalera visiblement les versions inconnues au
   lieu d'afficher une liste vide.
2. **La preview Vercel tape sur la base de production.** Ne pas tester sur un inventaire
   réel.
3. **`counts` est un journal append-only.** Les corrections sont des lignes de quantité
   négative, et il n'existe aucune policy `UPDATE`. Toujours `SUM(qty)`, jamais `COUNT(*)`.
4. **L'écart d'audit ne se calcule que dans une balise dont l'audit est terminé.** Sans ce
   garde-fou, tout article pas encore repassé par l'auditeur ressortirait à `−compté`
   pendant l'audit.
5. **La visibilité d'un inventaire est personnelle** : créateur ou membre. L'affectation
   magasin ne donne que le droit de *créer*. Un superviseur non participant ne voit rien —
   c'est voulu.
