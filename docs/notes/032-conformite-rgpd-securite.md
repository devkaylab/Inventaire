# Conformité RGPD / sécurité

Audit complet du 13 août 2026 : 15 manquements relevés (2 critiques, 7 élevés,
6 moyens). Rapport détaillé :
https://claude.ai/code/artifact/0db58594-ff3e-4ad5-91a8-29b85cbb3621

## Traité

- **C1 — présence temps réel** : les canaux sont désormais `private: true` des
  deux côtés, et `realtime.messages` porte deux policies adossées à
  `can_join_session_topic()` (migration `20260813000009`). **Un canal public ne
  consulte aucune autorisation** — c'est le piège : ne jamais recréer un canal
  sans `private: true`, la RLS ne rattraperait rien.
- **M2** — `check_invitation` révoquée à `anon`/`authenticated` (oracle
  d'énumération d'e-mails), `compose_full_name` reçoit un `search_path` figé
  (migration `20260813000010`).
- **E7, partie code** — mot de passe porté à 12 caractères sur `/bienvenue`.
- **M3, renvoi par e-mail** — fonction edge `submit-supervisor-request` :
  elle appelle `submit_supervisor_request_detailed` en `service_role` et écrit à
  l'adresse saisie « vous avez déjà un compte » ou « votre demande est déjà en
  cours ». **« Code inconnu » et « demande créée » partagent le même message**,
  sans nom de magasin : deux textes distincts rouvriraient l'oracle, puisque
  qui essaie des codes utilise sa propre adresse. Déployée en
  `verify_jwt: false` — un formulaire public n'a pas de session — avec la
  limitation de débit comme contrepartie, appliquée avant tout travail. Le
  formulaire retombe sur la fonction publique de la base si l'edge est
  indisponible : la demande passe, sans l'e-mail. C'est la deuxième fonction du
  projet sans vérification de jeton, avec le futur webhook Stripe.
- **M4 — journal des actions d'administration** : table `admin_audit_log`
  (numéro croissant, RLS lecture admin seulement, aucune écriture côté client),
  alimentée par les onze fonctions `admin_*` d'écriture via `log_admin_action`.
  **La trace s'écrit dans la même transaction que l'action** : une action qui
  ne peut pas se journaliser échoue — ne jamais entourer `log_admin_action`
  d'un bloc qui avale les erreurs, et journaliser toute nouvelle fonction
  `admin_*` (test de garde : `web/tests/journal-admin.test.ts`). Les libellés
  (auteur, cible) sont figés au moment de l'action pour survivre aux
  suppressions. Lecture par `admin_list_audit_log`, affichage dans /admin
  (section « Journal des actions »). Conservation 1 an, purgée par
  `purge_expired_data()`. Migration `20260818000003`. Registre : T8.
- **M6 — droits outillés, procédure écrite.** `export_my_data()` (migration
  `20260818000004`) rend à la personne authentifiée un JSON complet de ce qui
  est rattaché à son compte — bouton « Télécharger mes données » sur la page
  Mon compte, annoncé dans la politique. **Aucun code d'accès n'y figure**
  (entreprise, magasin, sécurité) et le détail ligne à ligne des inventaires
  n'y est que résumé : l'employeur en est responsable de traitement, l'export
  le dit et renvoie vers lui. Procédure de violation :
  `docs/conformite/procedure-violation-donnees.md` (72 h, et surtout la
  distinction responsable / sous-traitant — pour les données d'inventaire,
  Devkaylab prévient l'entreprise cliente sans délai, c'est elle qui notifie) ;
  registre des violations à tenir dans `registre-des-violations.md`.
  Tests de garde : `web/tests/mes-donnees.test.ts`.
- **M3, partie sécurité** — `submit_supervisor_request` répond désormais
  **exactement la même chose** pour un code magasin inconnu, un compte déjà
  existant, une demande en cours ou une création réussie
  (`{success: true, received: true}`), et ne renvoie plus le nom du magasin.
  Le détail existe toujours dans `submit_supervisor_request_detailed`,
  exécutable par le **seul `service_role`**. Les erreurs de saisie restent
  explicites : elles ne parlent que de ce que la personne vient de taper.
  `rate_limit_ok` limite les deux formulaires à 5 envois par heure et par
  adresse e-mail, 20 par point de connexion (`submission_attempts`, purgée à
  24 h). Migration `20260818000002`, appliquée en live après essai en
  transaction annulée. **Ne pas réintroduire de message distinct** : c'est
  l'oracle que ce correctif ferme, et deux tests le gardent
  (`web/tests/formulaires-publics.test.ts`). ⚠️ Ce verrou a été **perdu puis
  rétabli** sur le formulaire d'inscription : voir « Un `create or replace` ne
  dit pas ce qu'il fait disparaître », plus bas.
- **M1** — six en-têtes de sécurité posés dans `web/next.config.mjs` (et non
  dans `vercel.json`, pour qu'une règle trop stricte se voie dès le
  développement). La CSP ferme `frame-ancestors`, `object-src`, `base-uri` et
  `form-action`, et n'ouvre `connect-src` que vers Supabase, WebSocket compris.
  **`script-src` garde `unsafe-inline`** : le routeur d'application de Next
  injecte ses scripts d'hydratation en ligne, et `layout.tsx` pose celui du
  thème. S'en passer demande un nonce par requête, donc un middleware, au prix
  du rendu statique — arbitrage ouvert. Vérifié au navigateur : aucune
  violation sur les cinq pages publiques, et une destination externe est bien
  refusée nommément par la CSP. Tests : `web/tests/entetes-securite.test.ts`.
- **E1 / E2, partie effacement** — la suppression de compte **échouait** :
  cinq clés étrangères pointaient `profiles` en NO ACTION, donc supprimer un
  compte ayant compté levait une violation de contrainte. Migration
  `20260818000001` appliquée en live : les comptages se détachent au lieu de
  bloquer, un déclencheur BEFORE DELETE sur `auth.users` efface l'identité
  résiduelle (demandes anonymisées, invitations supprimées), et
  `purge_expired_data()` porte les durées — 3 mois, 1 an, 3 ans — en un seul
  point. ⚠️ **Corrigé le 28 août 2026** : `pg_cron` est installé et la purge
  tourne tous les jours à 03 h 15 UTC — voir « La purge s'exécute enfin toute
  seule » plus bas. Pendant sept semaines, elle n'a jamais été exécutée.
- **E5 / E6, hébergement de la politique** — découvert le 18 août 2026 :
  l'adresse `devkaylab.github.io/Inventaire/privacy.html`, vers laquelle
  pointent l'app et le site, renvoyait **404** — GitHub Pages n'était pas
  activé sur le dépôt. Réactivé (branche `main`, dossier `/docs`). Aucun test
  automatique ne surveille cette adresse : après tout changement de
  configuration du dépôt GitHub, vérifier au moins une fois qu'elle répond.
- **E5 / E6** — `docs/privacy.html` réécrite : les quatre sous-traitants
  (Supabase, Vercel, Resend, **Expo** — les jetons de notification partent vers
  `exp.host`), les transferts hors UE, les finalités et bases légales, les
  durées, le **droit de réclamation auprès de la CNIL**, et la répartition
  responsable / sous-traitant vis-à-vis des entreprises clientes. La mention
  d'information s'affiche **sous chaque formulaire** de collecte
  (`MentionCollecte`), pas seulement en pied de page — volontairement sans case
  à cocher, la base légale n'étant pas le consentement. Des tests gardent le
  tout (`web/tests/confidentialite.test.ts`) : ajouter un prestataire sans le
  déclarer, ou un formulaire sans la mention, fait échouer la suite.
  La politique déclare aussi le suivi nominatif de l'activité (constat E3) —
  restent l'information des salariés, la consultation du CSE et l'AIPD. Elle
  disait franchement que les demandes et invitations n'étaient pas encore
  purgées (E1 / E2). ⚠️ **Récrit le 28 août 2026**, le jour où la purge a été
  planifiée : la section 7 énumère désormais les six durées et dit qu'elles
  s'appliquent automatiquement. Une politique qui annonce un manque déjà comblé
  est aussi fausse qu'une politique qui cache un manque — **la relire à chaque
  fois que les durées bougent**.
- **E4, page en place** — `/mentions-legales` sur le site, alimentée par
  `web/lib/legal.ts`. **L'activité éditrice n'est pas encore immatriculée** :
  tant qu'une mention requise manque, `mentionsCompletes()` est faux, la page
  passe en `noindex` et le pied de page ne l'annonce pas — une identification à
  trous ne vaut pas mieux que pas de page. Remplir les valeurs dans ce seul
  module suffit à tout activer. L'adresse et le téléphone de Vercel sont à
  recopier depuis leurs informations légales : `vercel.com` est bloqué depuis
  l'environnement de l'agent, et ces coordonnées ne se citent pas de mémoire.
- **C2 — `xlsx`** : SheetJS ayant quitté npm, l'archive officielle 0.20.3 est
  versionnée dans `vendor/` et installée en `file:` des deux côtés. Les deux
  failles de la partie lecture (CVE-2023-30533, CVE-2024-22363) sont corrigées,
  et `xlsx` a disparu des deux `npm audit`. **Ne jamais faire
  `npm install xlsx`** : cela ramènerait 0.18.5 en écrasant le `file:` sans
  rien signaler — deux tests montent la garde (`tests/xlsx.test.ts` de chaque
  côté). Procédure de mise à jour : `vendor/LISEZMOI.md`, outillage :
  `scripts/installer-sheetjs.mjs`.

## ⚠️ Un `create or replace` ne dit pas ce qu'il fait disparaître (28 août 2026)

Revue de sécurité du 28 août 2026, dix-huit points passés en revue. Le seul
vrai trou trouvé : **`submit_company_request` avait perdu sa limitation de
débit**, et c'est la fonction publique du formulaire d'inscription — appelable
sans compte, depuis n'importe où.

Le mécanisme mérite d'être retenu, parce qu'il se reproduira. Le durcissement
du 18 août avait posé les deux verrous. Les migrations `20260821210001` (SIREN
et magasins déclarés) puis `20260821230001` (code APE) ont **réécrit la
fonction en entier** pour ajouter des colonnes, sans recopier le bloc. Rien ne
l'a signalé : `create or replace` ne compare pas, il remplace. Relevé en
interrogeant `pg_get_functiondef` sur la définition **en vigueur**, pas sur les
fichiers du dépôt.

Deux conséquences pendant la semaine où le verrou manquait : l'inondation
possible du formulaire (et des accusés de réception qu'il déclenche), et
surtout la réouverture de l'énumération d'adresses — la fonction répond « Une
demande est déjà en cours pour cette adresse » quand elle connaît l'adresse.

Rétabli par `20260828120001`. Trois points à ne pas défaire :

- **Le verrou est placé après la validation de saisie et AVANT la recherche
  par adresse.** Une faute de frappe ne doit pas consommer le quota de
  quelqu'un ; et un script ne doit pas pouvoir interroger la base autant qu'il
  veut avant d'être freiné. L'ordre est ce qui fait le contrôle.
- **La réponse reste différenciée**, contrairement à la version du 18 août qui
  répondait `{success: true, received: true}` dans les deux cas. C'est une
  décision de produit — un client qui a déjà déposé une demande mérite qu'on le
  lui dise — que la limitation rend tenable : cinq essais par heure ne font pas
  un annuaire. Le sujet reste ouvert si l'énumération redevient un souci.
- **Les droits se reposent dans la même migration.** `create or replace` rend
  EXECUTE à PUBLIC — la leçon de `20260819172706`, et le second piège de la
  même famille.

**Le garde-fou a changé de nature, et c'est le plus important.** Les tests du
dépôt lisent une migration **nommée en dur** ; aucun ne lisait celles de
21 août, donc aucun n'a rien vu. `derniereDefinition()`
(`web/tests/formulaires-publics.test.ts`) prend désormais la **dernière**
migration qui définit la fonction — celle qui décrit ce qui tourne. Vérifié
dans les deux sens : sans le correctif, deux tests échouent. À reprendre pour
les autres fonctions sensibles si le sujet revient.

Vérifié en base le 28 août 2026, en transactions annulées : cinq envois
passent, le sixième est refusé ; dix saisies invalides ne consomment pas le
quota et l'envoi valable qui suit passe ; aucune ligne résiduelle ni dans
`company_requests` ni dans `submission_attempts` ; une seule signature de la
fonction ; droits limités à `anon`, `authenticated` et `service_role`.

### Et le texte est borné (`20260828130001`)

Second volet du même constat. Le stock, la surface et le nombre de magasins
étaient bornés depuis le premier jour ; le **texte** ne l'était pas. Un
anonyme pouvait écrire ce qu'il voulait, de la longueur qu'il voulait, dans
`company_name`, `message`, `contact_phone`, le prénom et le nom.

**⚠️ Refus, pas troncature — et c'est le point.** Le nom de l'entreprise
devient `companies.name` à la création, puis figure sur le devis et sur la
facture Stripe : des pièces datées, qui ne se réécrivent pas. Une troncature
silencieuse y produirait un document faux, et le message du client serait
amputé sans qu'il le sache. La règle du projet s'applique telle quelle : les
erreurs de saisie restent explicites, elles ne parlent que de ce que la
personne vient de taper.

**Les chiffres, et d'où ils viennent** — 80 pour le nom d'entreprise, le
prénom et le nom : c'est la borne de `nom_propre()`, qui gouverne déjà tous
les renommages. Sans cet alignement, une entreprise créée depuis une demande
pouvait porter un nom qu'aucun renommage n'aurait pu lui redonner. Puis 254
pour l'e-mail (RFC 5321), 30 pour le téléphone, 2 000 pour le message. **Le
nom de magasin passe de 120 à 80** pour la même raison ; lui reste tronqué et
non refusé, comportement d'origine, et l'écran le borne déjà à 80.

**La mesure passe avant le comptage du quota** : une saisie trop longue ne
consomme pas le quota de quelqu'un, au même titre qu'une faute de frappe.

**Trois épaisseurs, et elles ne font pas double emploi** : l'écran empêche
(`maxLength` sur les six champs de `/inscription` — sans quoi on n'apprend
qu'après avoir cliqué qu'un texte collé est trop long), la fonction refuse
avec un message lisible, et la contrainte `company_requests_longueurs` est la
ceinture — elle vaudra aussi pour la fonction qu'on écrira demain. La table
était vide au moment de la poser, vérifié avant.

À savoir : **`decline_quote_by_token` était déjà bornée** (`left(…, 500)` sur
le motif de refus, l'autre écriture ouverte à `anon`). Rien à y faire.

Vérifié en base, en transactions annulées : chaque borne refuse à +1 et
accepte à la limite exacte ; un `insert` direct qui contourne la fonction est
refusé par la contrainte ; le nom de magasin de 200 caractères ressort à 80 ;
aucun résidu. Et au navigateur sur `/inscription` : les six `maxLength` sont
bien dans le DOM, la page rend sans erreur de console.

### Et il répond la même chose (`20260828140001`)

Troisième volet, et fermeture du constat. La fonction publique répondait deux
choses différentes — `{success: true, request_id}` pour une adresse inconnue,
`{success: false, error: 'Une demande est déjà en cours…'}` sinon. On pouvait
donc lui poser une question qu'on ne lui avait pas posée : *cette adresse
a-t-elle déjà parlé à Quantinvo ?*

**⚠️ La limitation de débit ne suffisait pas, et il faut savoir pourquoi.** La
limite à 5 est posée **sur l'adresse testée** : quelqu'un qui essaie mille
adresses différentes a droit à un essai sur chacune, elle ne le gêne pas. Seule
la limite par point de connexion (20 par heure) le freinait. **Une limitation
de débit ne remplace pas une réponse uniforme**, elle la rend seulement plus
lente à contourner — à retenir la prochaine fois que le raisonnement se
présente.

Le motif est celui de `submit_supervisor_request` / `…_detailed`, repris tel
quel :

- **`submit_company_request_detailed`** fait tout le travail et rend le détail
  (`outcome` : `created` ou `request_pending`). Exécutable par le **seul rôle
  serveur** — `revoke … from public, anon, authenticated`, et **aucun `grant`**.
- **`submit_company_request`** est un **mince enrobage** public qui n'en laisse
  sortir que `{success: true, received: true}`.

Points à ne pas défaire :

- **⚠️ L'enrobage APPELLE, il ne recopie pas.** La duplication est exactement
  ce qui a fait perdre la limitation de débit le 21 août. Une seule
  implémentation, donc rien à resynchroniser — un test le vérifie (`not
  toContain('insert into public.company_requests')`).
- **⚠️ `request_id` a disparu de la réponse publique.** Le rendre à la création
  et pas autrement aurait laissé l'oracle intact : un identifiant présent ou
  absent est une réponse aussi bavarde qu'une phrase. Personne ne le lisait.
- **Les erreurs de saisie restent explicites** — champ vide, e-mail malformé,
  SIREN faux, texte trop long, excès de tentatives. Elles ne parlent que de ce
  que la personne vient de taper. C'est la règle depuis M3.
- **C'est la fonction edge qui dit la vérité au vrai client**, par e-mail :
  « votre demande est déjà en cours ». Le canal n'atteint que le propriétaire
  de l'adresse — c'est tout l'intérêt. Elle ne rend **jamais** `outcome` à son
  appelant : ce serait rouvrir l'oracle un cran plus haut.
- **Le texte de ce message ne reprend pas le nom d'entreprise saisi**, et se
  termine par « si vous n'êtes pas à l'origine de cet envoi, vous pouvez
  ignorer ce message » : n'importe qui peut poster ce formulaire avec une
  adresse qui n'est pas la sienne. C'est la contrepartie connue du motif — il
  permet de déclencher un e-mail vers une adresse arbitraire, bornée par les
  cinq envois par heure.
- **Pas d'avis interne dans cette branche** : il n'y a pas de nouvelle affaire
  à traiter.

**Limite assumée** : une demande créée déclenche deux e-mails, une demande déjà
en cours un seul — le temps de réponse diffère donc un peu. Canal auxiliaire
étroit, bruité par le réseau, et déjà présent sur le formulaire superviseur. On
ne le ferme pas.

⚠️ **La fonction edge a été redéployée** (version 7, `verify_jwt: false`
inchangé) — sans quoi la base et le code auraient divergé : `outcome` étant
devenu invisible à la surface publique, l'ancienne edge aurait envoyé un accusé
de réception et un avis interne pour une demande qui n'a rien créé.

Vérifié en base (réponses **identiques au caractère près** dans les deux cas,
erreurs de saisie intactes, `anon` refusé sur `…_detailed`) puis **en vrai sur
la fonction déployée** : deux envois de la même adresse → deux réponses
identiques `{"success":true,"received":true,"emailed":true}`, une seule ligne
créée. Données d'essai supprimées, zéro résidu contrôlé.

Le reste de la revue — rapport complet, neuf constats classés — est là :
https://claude.ai/code/artifact/e0b727e9-5d2d-4110-bc0c-01d97c663595

## Quatre durcissements de la revue (28 août 2026)

Suite du même passage. Ce qui ne méritait pas un chantier, mais ne devait pas
rester en l'état.

## Une formule ne s'exécute plus depuis un export CSV

Constat n°4. `toCsv` échappait correctement guillemets et points-virgules, mais
**ne neutralisait pas les cellules qu'un tableur évalue** — celles qui
commencent par `=`, `+`, `-` ou `@`. Or les libellés, marques et SKU du rapport
viennent du **fichier fournisseur importé**, que Quantinvo ne contrôle pas : un
libellé forgé devenait une commande exécutée sur le poste de la personne qui
ouvre le rapport.

`neutraliserFormule` (`web/lib/report.ts`) préfixe une apostrophe, la parade de
l'OWASP. Elle se voit dans la cellule — c'est le prix, et il ne se paie que sur
les valeurs qui commençaient par l'un de ces caractères.

**⚠️ Les nombres ne passent jamais par là, et c'est le piège de ce correctif.**
Un écart de −650 commence par un tiret. Le préfixer en ferait du texte, donc
une colonne que le tableur ne sait plus additionner — sur la colonne même que
le rapport existe pour montrer. D'où le tri sur `typeof v === 'number'` :
`buildVarianceRows` et `buildDetailRows` produisent de vrais nombres pour
toutes les quantités, et des chaînes pour tout le reste. Un test le fige.

**L'export XLSX n'était pas concerné**, vérifié à la source plutôt que supposé :
SheetJS écrit ces valeurs en cellules de type `s` (chaîne), jamais `f`
(formule). Essayé — `json_to_sheet([{A:'=1+1'}])` rend `{"t":"s","v":"=1+1"}`.
C'est aussi pourquoi l'application mobile n'avait rien à corriger : elle
n'exporte qu'en XLSX.

Tests de garde : `web/tests/report.test.ts`, bloc « les formules ne s'exécutent
pas ».

## Deux fonctions retirées à `anon` (`20260828160001`)

Constat n°6. Six fonctions étaient exécutables par `anon` ; quatre à dessein
(parcours de devis public, formulaire d'inscription). Les deux autres étaient
des oublis : `admin_list_audit_log`, qui rend le journal des actions
d'administration, et `team_invitations_figer_invariants`, la fonction de
déclencheur posée le matin même.

**Ni l'une ni l'autre ne fuyait** — essayé pour de vrai : la première répond
`forbidden`, la seconde refuse d'être appelée hors déclencheur. C'était un
droit accordé sans raison.

⚠️ **La cause est toujours la même** : `create or replace function` rend EXECUTE
à PUBLIC. Le projet l'a appris avec `get_session_activity` (`20260819172706`),
et l'a refait le matin même sur une fonction de déclencheur. Toute migration
qui définit une fonction repose ses droits dans le même fichier — **fonctions
de déclencheur comprises**, elles n'ont aucune raison d'être appelables.

## L'annuaire de toute l'entreprise n'est plus joignable (`20260828170001`)

Constat n°7. `get_company_directory` rend le nom et l'adresse e-mail de chaque
personne de l'entreprise. Correctement cloisonnée par `get_my_company()`, mais
**sans contrôle de rôle** : un compteur y lisait l'annuaire complet,
superviseurs compris. Sa voisine `get_store_directory` exige, elle,
`is_assigned_store`.

⚠️ **Le correctif est un retrait, pas un garde**, et c'est ce qui compte :
vérifié avant d'écrire, **plus aucun écran ne l'appelait**. Les deux
applications passent par `get_store_directory` depuis le 7 août 2026 (commit
`8ba7e30`), et le téléphone a été reconstruit plusieurs fois depuis. Une
fonction que personne n'appelle et qui rend les adresses de toute une
entreprise n'a pas besoin d'un contrôle de rôle : elle a besoin d'être
injoignable. L'enveloppe morte `getCompanyDirectory` a quitté
`src/lib/queries.ts` — c'est elle qui donnait l'illusion d'un appelant.

La fonction **reste en base**, droit retiré : on retire l'accès d'abord, on
supprime l'objet plus tard. Règle du projet.

## La purge s'exécute enfin toute seule (`20260828180001`)

Constat n°5, et c'est le plus embarrassant. `purge_expired_data()` portait les
durées de conservation en un seul point depuis le 18 août — et **rien ne
l'appelait**. `pg_cron` n'était pas installé, son corps n'avait jamais tourné.
Les durées annoncées dans la politique de confidentialité n'étaient donc pas
tenues : tout était conservé indéfiniment. Autant un sujet RGPD qu'un sujet de
sécurité — plus on garde, plus une fuite coûte cher.

⚠️ **Essayée à blanc avant d'être planifiée**, en transaction annulée : elle
s'exécute sans erreur et **ne supprimerait rien aujourd'hui**, les dix
compteurs de son rapport sont à zéro. La base est trop jeune pour qu'une durée
soit atteinte — c'est le meilleur moment pour la brancher, elle ne peut
surprendre personne. Ne pas planifier une fonction destructrice sans l'avoir
d'abord jouée à blanc.

Passage quotidien à **03 h 15 UTC**, hors des heures d'inventaire et décalé de
l'heure ronde. La trace vit dans `cron.job_run_details` (statut, durée,
horodatage), lisible depuis le tableau de bord Supabase :

```sql
select * from cron.job_run_details order by start_time desc limit 20;
select cron.unschedule('purge-donnees-expirees');   -- pour l'arrêter
```

Pas de ligne dans `admin_audit_log` : ce journal enregistre des gestes faits
sur des personnes et des entreprises, et 365 lignes par an disant « rien à
purger » le noieraient.

**⚠️ `pg_cron` est désormais installé** — ce n'est plus vrai que « la purge
n'est pas planifiée ». Si un autre travail périodique se présente, c'est là
qu'il ira. Test de garde : `web/tests/journal-admin.test.ts`, « et cette purge
est réellement planifiée ».

## Montée en Next 16 — fusionnée (28 août 2026)

Constat n°2 de la revue de sécurité. `npm audit` listait seize avis pour
Next.js 14.2.35, dont sept de gravité haute, et **aucun correctif n'existe pour
la branche 14** : le premier palier corrigé est 16.3.3.

Le travail a d'abord vécu sur la branche `montee-next16`, le temps qu'un essai
en session réelle confirme l'espace connecté — `git push` sur `main` déploie le
site, et un build qui passe n'est pas un site qui marche. **C'est fait : la
branche est fusionnée dans `main`**, qui est en Next 16.3.3.

⚠️ **La branche `montee-next16` ne sert donc plus à rien, et elle nuit.** Elle
n'a aucun commit que `main` n'ait pas, elle ne rattrape jamais, et Vercel lui
sert quand même une **préversion** — un instantané figé, de plus en plus vieux,
qu'on prend pour le site en regardant la mauvaise adresse. Constat de Julien le
29 août 2026, capture à l'appui : le bouton « Supprimer » des écarts, retiré le
matin même, y figurait encore. **Une branche fusionnée se supprime** : en
garder une, c'est garder une préversion qui ment.

Ce que la montée emporte : `next` 14.2.35 → **16.3.3**, `react` et `react-dom`
18.3.1 → **19.2.8**, `eslint` 8 → **9**, `eslint-config-next` → 16,
`@types/react` → 19, `vitest` → 3. Résultat : **`npm audit` rend zéro
vulnérabilité** sur le site, contre onze avant (dont une critique).

**Pourquoi c'était plus petit qu'il n'y paraît**, et c'est le point à retenir
si la question se repose : les quatre pages à paramètre (`[token]`,
`[sessionId]`, `[companyId]`, `[storeId]`) lisent leur paramètre avec
`useParams()`, un hook **client**. Le changement de rupture de Next 15 — les
`params` d'une page serveur devenus asynchrones — ne les concerne donc pas. Les
cinq pages sans `'use client'` sont des pages vitrines sans paramètre. Il n'y a
ni middleware, ni *server action*, ni route API, ni i18n : c'est ce qui rendait
l'exposition faible **et** la migration courte.

Ce qui a demandé du travail, en revanche : `next lint` n'existe plus, d'où le
passage à la configuration plate d'ESLint — voir « Lint du site » plus haut, la
règle du projet s'est inversée.

**Vérifié** : typage (`tsc --noEmit`, rien), 624 tests, `next build` avec la
**même table de routes** qu'avant (mêmes pages statiques, mêmes pages
dynamiques), lint à zéro erreur. Puis au navigateur, sur le serveur de
développement : `/`, `/inscription`, `/login`, `/devis/<jeton>` et
`/mentions-legales` répondent 200, aucune erreur de console, la police et le
thème s'appliquent, et **les six en-têtes de sécurité sont toujours servis** —
ce que le test de garde ne prouve pas, puisqu'il lit `next.config.mjs` sans
vérifier que Next l'honore.

**Vérifié depuis, en session réelle**, ce que je ne pouvais pas voir : le
tableau de bord d'un inventaire, l'import d'un fichier, le rapport, /equipe et
la console.

## Un paiement resté sans suite se dit tout seul (28 août 2026)

Dernier manque de la revue. Les journaux existaient — `admin_audit_log`,
`company_audit_log`, écrits dans la même transaction que l'action — mais
**personne n'était prévenu de rien**. Le cas qui coûte de l'argent est toujours
le même : un client paie par carte, le webhook Stripe ne passe pas,
l'entreprise n'est jamais créée. Le client a payé, il n'a rien, et on
l'apprend quand il écrit.

**⚠️ La détection existait déjà**, et c'est ce qui a rendu le travail court :
`web/lib/pipeline.ts` sait lire un `paid` sans création (« Payé — création en
attente », passé en alerte au bout d'un jour) et /admin l'affiche. Ce qui
manquait n'était pas l'intelligence, c'était le **facteur** — il fallait aller
chercher l'information.

**On surveille le résultat, pas la machine.** Pas les erreurs techniques des
fonctions : elles sont bruyantes, la plupart se règlent seules, et une alerte
qu'on cesse de lire ne protège plus rien. Une seule question, posée toutes les
heures à la minute 7 : *y a-t-il un paiement encaissé dont rien n'a été créé ?*

### Les quatre choses à ne pas défaire

- **⚠️ Quinze minutes de grâce.** Stripe réessaie quand une réponse tarde.
  Alerter à la seconde ferait sonner pour des paiements qui se règlent seuls
  deux minutes plus tard.
- **⚠️ La mémoire des alertes** (`alertes_envoyees`). Sans elle, un paiement
  bloqué produirait vingt-quatre e-mails par jour. Une anomalie qui dure est
  rappelée **une fois par jour**, pas davantage ; une anomalie réglée disparaît
  de la mémoire au bout de trente jours, de sorte qu'une récidive redonne lieu
  à une alerte plutôt qu'à un silence.
- **⚠️ On marque APRÈS l'envoi.** Un e-mail qui ne part pas laisse l'anomalie
  ouverte, et l'heure suivante réessaie. L'ordre inverse la ferait taire pour
  de bon sur un incident réseau d'une seconde.
- **Le silence est le cas normal**, et c'est lui qui rend l'alerte crédible.
  Rien à signaler, rien n'est envoyé — et `declencher_alerte` s'arrête même
  avant de réveiller la fonction edge.

### La clé, et pourquoi ce n'est pas la clé de service

`alerte-anomalies` est déployée en `verify_jwt: false` — une tâche `pg_cron`
n'a pas de session. La porte est une **clé partagée**, vérifiée en temps
constant, sur le modèle du webhook Stripe.

**⚠️ Cette clé n'autorise qu'une chose : demander le tour de garde.** Ce n'est
pas la clé de service ; si la base fuyait, ce jeton ne permettrait de lire
aucune donnée. Il vit dans le **coffre** (`vault.decrypted_secrets`, secret
`alerte_cle`), jamais en clair dans une définition de fonction —
`pg_get_functiondef` est lisible par qui peut lire le catalogue.

**Tant que le secret d'edge n'est pas posé, rien ne part** : la fonction répond
500 et la tâche planifiée ne l'appelle même pas. La planification est donc
inoffensive avant sa configuration.

**Il faut poser `ALERTE_CLE` dans les secrets d'edge functions**, avec la valeur
du coffre. Pour la relire :

```sql
select decrypted_secret from vault.decrypted_secrets where name = 'alerte_cle';
```

### Vérifié

En base, en transaction annulée, les cinq comportements : base saine →
silence ; paiement sans création depuis deux heures → détecté, avec le montant
et le nom ; juste après l'alerte → silence ; vingt-cinq heures plus tard,
toujours ouvert → rappelé ; paiement d'il y a cinq minutes → silence.

Sur la fonction déployée : elle démarre, refuse un GET (405) et refuse tout
sans clé. Et `declencher_alerte()` joué à la main sur la base réelle ne
provoque **aucun appel sortant** (`net._http_response` reste vide) : il n'y a
rien à signaler.

### L'écran dit la même chose que la boîte de réception

Julien, l'e-mail reçu : *« il serait intéressant de le voir sur le dashboard
admin également, non ? »* Il y était déjà — `lireVente` rendait `tour: 'nous'`
sur un `paid`, donc /admin l'affichait en alerte ambre dans « Ventes en
cours ». **Mal réglé, en revanche** : l'e-mail partait au bout de quinze
minutes, l'écran ne parlait de retard qu'au bout d'un jour, et son libellé
(« création en attente ») ne disait pas que quelque chose clochait.

⚠️ **`GRACE_PAIEMENT_MIN` (`web/lib/pipeline.ts`) doit rester égal à la grâce
de `anomalies_a_signaler`.** Un test compare la constante au texte de la
migration : deux seuils qui divergent, ce sont deux versions du même incident,
et c'est comme ça qu'on cesse de croire l'un ou l'autre. Passé la grâce,
l'écran écrit « rien n'a été créé, le client attend » — le mot dit
l'anomalie ; avant, il écrit « création en cours » et n'affole personne.

### Et la purge se surveille elle-même (`20260828200001`)

Julien, à qui je venais de demander de lancer une requête chaque matin pour
vérifier que la purge avait tourné : *« elle ne peut pas se run seule la
commande ? »*. Elle peut — et surtout **elle ne devrait pas exister** : une
vérification dont un humain est responsable s'arrête au bout de trois jours.

Le tour de garde pose donc une seconde question : *le ménage quotidien a-t-il
eu lieu ?* Même principe que la première — on regarde le **résultat**
(`cron.job_run_details`), pas une erreur de tâche.

- **⚠️ 48 heures, pas 24.** La purge passe une fois par jour : alerter à 24 h
  ferait sonner pour un passage décalé de quelques minutes ou une base
  momentanément indisponible. Deux nuits manquées, ce n'est plus un hasard.
- **⚠️ Le piège du démarrage.** Au moment de la pose, la purge n'avait **jamais
  tourné** : une condition naïve (« aucun passage réussi depuis 48 h ») était
  vraie tout de suite, et l'alerte serait partie avant que le ménage ait eu sa
  chance. D'où le `greatest(...)` avec une date d'installation en dur — et si
  la tâche ne démarrait jamais du tout, l'alerte finirait par partir quand
  même, ce qui est exactement ce qu'on veut.
- **⚠️ Le message se compose par nature.** Un seul texte, écrit pour les
  paiements, ferait dire « un paiement sans suite » à propos du ménage. Une
  alerte qui décrit mal ce qu'elle a vu ne se lit plus. `alerte-anomalies`
  sépare donc `paiement` et `purge` — titre, paragraphes et ligne de détail
  (celle d'une purge ne parle pas d'euros). Redéployée en version 3.

Vérifié en base : silencieuse aujourd'hui (le repli tient), et **la branche
purge se déclenche bien** — essayé en transaction annulée en reculant le repli
à huit jours, la fonction rend alors la ligne `purge:silencieuse`. La fonction
réelle est intacte après annulation, contrôlée sur `pg_get_functiondef`.

Tests de garde : `web/tests/alerte.test.ts`.

## Le jeton de session vit dans le trousseau (28 août 2026)

Constat n°8, dernier de la revue. `supabase-js` rangeait la session dans
`AsyncStorage` — un fichier en clair dans le bac à sable de l'application. Ce
bac à sable la protège des autres applications, **pas** d'un téléphone
déverrouillé, d'une sauvegarde non chiffrée ni d'un appareil débridé. Et une
session vaut trente jours d'inactivité.

Elle vit désormais dans `expo-secure-store` — Keychain sur iOS, Keystore sur
Android : chiffrée par le système et liée à l'appareil. Le branchement tient en
une ligne de `src/lib/supabase.ts` (`storage: sessionStore`) ; tout le reste est
dans `src/lib/sessionStore.ts`, et **les trois pièges y sont**.

- **⚠️ Le trousseau ne prend pas de grandes valeurs.** Expo annonce 2 048 octets
  par entrée et prévient qu'au-delà l'écriture pourra échouer. Une session
  Supabase — deux JWT et l'objet utilisateur — dépasse couramment ce seuil. Elle
  est donc **découpée** en morceaux de 1 800 octets (`<clé>__0`, `<clé>__1`…),
  leur nombre rangé sous `<clé>`. Ne pas « simplifier » en un `setItemAsync`
  direct : ça marche sur une session courte et casse sur une longue — donc plus
  tard, et sur le téléphone de quelqu'un d'autre.
- **⚠️ Personne n'est déconnecté par le changement.** À la première lecture, si
  le trousseau est vide, on regarde dans `AsyncStorage` : la session de l'ancien
  monde y est déménagée, puis l'ancienne copie effacée. Sans ce passage, tous
  les compteurs déjà installés se retrouveraient devant l'écran de connexion —
  un matin d'inventaire, ça se paie cher.
- **Une session plus courte ne laisse pas d'orphelins** : les morceaux au-delà
  du nouveau compte sont effacés, faute de quoi une lecture ultérieure
  recollerait la queue de l'ancienne session à la nouvelle.
- Un morceau manquant rend `null`, jamais un JSON tronqué : supabase-js
  redemande une connexion, ce qui vaut mieux qu'une valeur qu'il ne sait pas
  analyser.
- Sur le **web** (`react-native-web` est dans les dépendances), le trousseau
  n'existe pas : on retombe sur `AsyncStorage`. Le web n'est pas la cible, mais
  il ne doit pas planter.

**Le reste du cache hors ligne ne bouge pas** — catalogue d'articles, file de
comptages — et c'est délibéré : il est volumineux, et `oublierCachesLocaux`
l'efface déjà à la déconnexion. Le trousseau est pour le secret, pas pour le
volume.

⚠️ **`expo-secure-store` est une dépendance NATIVE.** Elle impose un
`pod install` et une **reconstruction de l'application** : tant que le nouveau
build n'est pas installé, rien ne change sur les téléphones. C'est aussi la
seule partie que les tests ne prouvent pas — ils couvrent le découpage, le
déménagement et le ménage des orphelins, avec les deux modules natifs simulés,
mais le trousseau réel ne se vérifie qu'appareil en main.

Tests de garde : `tests/session-store.test.ts`.

## « Supprimer mon compte » quitte le voisinage de « Se déconnecter » (28 août 2026)

Constat de Julien, en voulant se déconnecter : *« le bouton supprimer mon
compte est celui qu'on a envie de cliquer, car il ressemble fortement à un
bouton de déconnexion »*.

Il avait raison, et le défaut est de mise en page pure : les deux lignes se
suivaient **dans la même carte**, et la suppression était la **seule ligne
colorée de l'écran**. Autrement dit, le geste le plus grave était le plus
visible, à un centimètre de celui qu'on cherchait. Deux gestes sans rapport,
que rien ne séparait.

**Écran `(compte)/profile.tsx`**, qui rassemble ce qu'on vient modifier **sur
soi** : le prénom et le nom, le mot de passe, la double authentification —
puis, tout en bas, sous son propre titre « Zone sensible » et seule dans sa
carte, la suppression. C'est la **distance** qui protège ; la confirmation, elle,
n'a pas bougé.

Maquette validée avant codage :
https://claude.ai/code/artifact/fc883be2-b91f-4fab-b096-7d90c6bb504c

Points à ne pas défaire :

- **⚠️ « Se déconnecter » est passée en rouge, et ce n'était possible qu'après
  ce déménagement.** Elle est désormais la seule ligne colorée de « Mon
  compte » : le rouge y désigne une chose et une seule, la sortie. Tant que la
  suppression était juste en dessous, deux rouges voisins n'auraient rien
  distingué — ils auraient aggravé le problème.
- **Elle n'a pas de chevron** (`sansChevron`) : elle agit sur place, elle
  n'ouvre pas d'écran. Un chevron promettrait une page.
- **Le mot de passe a quitté « Ma sécurité »**, qui ne gardait plus qu'une
  ligne. La double authentification l'a suivi : elle appartient au même sujet.
- **Ce qui reste sur « Mon compte » est sans conséquence** — le travail du
  superviseur, l'export de données, les repères, la déconnexion. On peut y
  toucher n'importe quoi sans rien perdre.
- Le bandeau « demande de suppression en cours » reste affiché **sur les deux
  écrans** : c'est un état, pas une action, et il doit se voir sans avoir à
  chercher.

## Les icônes de menu (`components/ui/MenuIcons.tsx`)

Demandées dans la foulée, capture à l'appui. `MenuRow` accepte une icône, et
tous les rangs des deux écrans en portent une — un test le vérifie, parce
qu'une ligne sans icône dépareille immédiatement dans une colonne alignée.

- **⚠️ Au trait, jamais en aplat.** À 21 px une icône pleine devient une tache :
  on voit une forme colorée, pas un objet.
- **Elle prend la couleur du rang** (`danger ? theme.danger : theme.textMuted`),
  donc elle rougit avec « Se déconnecter » sans qu'on dessine une seconde
  version. Et c'est le gris des libellés secondaires, pas celui du texte : à
  cette taille, un trait à pleine valeur pèse plus que le mot qu'il accompagne.
- **Même grille de 24 et même épaisseur (1,7) pour toutes.** Ce qui fait tenir
  une colonne, c'est l'alignement des traits, pas le dessin de chacune — une
  icône hors grille se remarque aussitôt.
- Vocabulaire, si on en ajoute une : un contour fermé pour un lieu ou un objet
  (magasin, carte d'identité, bouclier), un trait ouvert pour un mouvement
  (téléchargement, sortie).

Tests de garde : `tests/compte.test.ts`, bloc « “Supprimer mon compte” n'est
plus voisine de “Se déconnecter” ». ⚠️ Ils lisent le **code seul** : les
commentaires de ces écrans racontent le défaut corrigé, donc citent
« Supprimer mon compte » et le mot `danger`, et feraient échouer une garde qui
porte sur ce que l'écran affiche.
