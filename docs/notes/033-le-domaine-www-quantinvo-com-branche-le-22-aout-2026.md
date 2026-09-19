# Le domaine : `www.quantinvo.com` (branché le 22 août 2026)

Le site vit sur **`https://www.quantinvo.com`** — c'est l'adresse canonique,
choisie par Vercel à l'ajout du domaine : `quantinvo.com` redirige en 308
vers `www`, et `quantinvo.vercel.app` reste servi en alias (les liens déjà
envoyés par e-mail continuent de marcher). Le DNS est chez Vercel
(`ns1/ns2.vercel-dns.com`) ; l'e-mail (ImprovMX pour `contact@`, Resend sur
`send.quantinvo.com`) n'en dépend pas.

Ce qui a bougé dans le dépôt (commit `80d5e2b`) : tous les replis
`https://quantinvo.vercel.app` — `src/constants/links.ts` (`SITE_URL`, app
mobile, effectif au prochain build), `_shared/email.ts` (`SITE_PAR_DEFAUT`,
donc l'adresse du logo PNG des e-mails), les quatorze fonctions edge, le pied
du PDF de devis, l'écran « ordinateur requis », `docs/privacy.html`, les
modèles de documents et le deck.

**Les fonctions edge n'ont pas été redéployées pour ça** : elles lisent
`APP_PUBLIC_URL` à l'exécution, la valeur écrite en dur n'est qu'un repli.
Poser le secret suffit ; le repli ne sert qu'au prochain redéploiement de
chaque fonction, quelle qu'en soit la raison.

**Posé le 22 août 2026 par Julien**, et vérifié pour l'edge par un envoi réel
(l'accusé d'une demande d'essai chargeait déjà son logo depuis le nouveau
domaine, fonction non redéployée) : le secret `APP_PUBLIC_URL`, qui n'avait
**jamais existé** avant ce jour — toutes les fonctions tournaient sur leur
repli —, et la console Supabase (Authentication → URL Configuration) :
**Site URL** `https://www.quantinvo.com`, et les **Redirect URLs**
`https://www.quantinvo.com/reinitialisation` et `/bienvenue` — en gardant les
anciennes (`https://quantinvo.vercel.app/…` et
`https://quantinvo-*-devkaylab.vercel.app/reinitialisation`) tant qu'un e-mail
déjà parti peut encore être cliqué. Secret edge `APP_PUBLIC_URL` =
`https://www.quantinvo.com`.

## Double authentification (TOTP)

Le parcours vit dans l'app web depuis le 19 août 2026 — la console Supabase
n'avait rien à activer, le TOTP y est permis d'office ; ce qui manquait,
c'était l'interface. Activation depuis **Mon compte** (`MfaPanel` : QR code,
puis code de vérification), saisie du code à chaque connexion (`/login`,
deuxième étape), logique dans `web/lib/mfa.ts`. `useAuthGuard` renvoie vers
`/login` toute session restée au mot de passe seul (`aal1`) alors que le
compte a un facteur — sans cette garde, fermer l'onglet entre le mot de passe
et le code laisserait entrer à moitié authentifié.

Le compte administrateur est enrôlé (19 août 2026), et **le serveur l'exige
désormais** : migration `20260819123621_mfa_admin_aal2`. La garde tient en un
seul point — les dix-huit fonctions `admin_*` passent toutes par `is_admin()`,
qui répond faux à une session restée au mot de passe seul. Avant cette
migration, un jeton `aal1` gardait tous les droits côté serveur : la garde
client ne protégeait que l'interface, pas l'API.

**L'exigence est conditionnelle, ne pas la « simplifier »** en un `aal2`
obligatoire : elle ne vise que les comptes ayant un facteur vérifié. C'est ce
qui rend le dépannage possible — un téléphone perdu se règle en `service_role`
(`delete from auth.mfa_factors where user_id = …`), l'administrateur retrouve
ses droits au mot de passe seul le temps de se réenrôler, sans qu'il faille
défaire la migration. Il n'y a pas de codes de secours. Tests de garde :
`web/tests/mfa.test.ts`.

Non concernés : les comptes sans second facteur, les superviseurs ordinaires,
`service_role` (pas de `auth.uid()`), et l'app mobile — elle n'appelle aucune
fonction `admin_*`. **Si un écran mobile devait un jour en appeler une**, il
faudrait d'abord y porter le parcours TOTP : sans lui, une session mobile est
en `aal1` et serait refusée.

## Changer son mot de passe exige l'ancien (21 août 2026)

`updateUser({ password })` ne demande rien d'autre que d'être connecté. Un
téléphone laissé déverrouillé, ou un poste resté ouvert, suffisait donc à
changer le mot de passe et à s'approprier le compte — au moment même où l'on
ajoutait un second facteur contre ce risque. **Le trou existait des deux
côtés** : l'app l'a recopié du site en portant le formulaire. Relevé par Julien
en test.

Les deux formulaires (`web/app/account/page.tsx`, `src/app/(compte)/password.tsx`)
demandent maintenant le mot de passe actuel, et offrent la sortie « mot de passe
oublié » pour qui ne s'en souvient plus — c'est le parcours par e-mail qui
vérifie alors l'identité, et c'est la bonne porte.

**La vérification passe par un client Supabase jetable** (`lib/reauth.ts` des
deux côtés) : `signInWithPassword` remplace la session du client qui l'appelle.
Sur le client principal, vérifier ferait retomber la session en `aal1` et
redemanderait le code de double authentification au milieu du formulaire.

Deux conséquences à connaître :

- la vérification laisse une **session serveur orpheline**, jamais rafraîchie.
  Elle meurt par l'expiration pour inactivité posée plus haut ;
- ⚠️ elle **dépend de « Single session per user » resté fermé**. Cette option ne
  garde que la dernière connexion : vérifier son mot de passe déconnecterait de
  l'app ou de l'onglet en cours. Le conseil de ne pas l'activer devient donc
  porteur.

Tests de garde : `web/tests/password.test.ts`, bloc « changement de mot de
passe — l'ancien est exigé ».

## Expiration des sessions (posée en console le 21 août 2026)

Constat de départ : `auth.sessions.not_after` est vide partout, et une session
de compteur ouverte le 18 juin vivait encore le 13 août. **Rien n'expire.** Un
téléphone perdu reste connecté indéfiniment, sur un outil qui porte des données
de stock et des noms de salariés.

À savoir d'abord, parce que la question revient : **le code de double
authentification n'est pas demandé périodiquement.** Le niveau `aal2` est
stocké sur la ligne de session, pas seulement dans le jeton ; le
rafraîchissement horaire le reconduit. On ne le ressaisit qu'à une nouvelle
connexion. Un « se souvenir de cet appareil » maison est à écarter : on ne peut
pas accorder `aal2` côté client, donc sauter l'écran laisserait la session en
`aal1` — les fonctions `admin_*` refuseraient, et pour un superviseur ce serait
une protection de façade.

**Réglage en place**, Authentication → Sessions (offert à partir du plan Pro —
l'organisation y est). **Les deux champs sont en heures**, pas en jours :

- *Inactivity timeout* — la session meurt faute d'usage → **720 h (30 jours)** ;
- *Time-box user sessions* — plafond absolu depuis la connexion →
  **4320 h (180 jours)**.

⚠️ **Ce réglage ne se relit pas depuis la base.** Le plafond n'est pas
matérialisé dans `auth.sessions` (`not_after` reste vide) : GoTrue compare
`created_at + plafond` et `refreshed_at + inactivité` au moment du
rafraîchissement. Seule l'API de gestion, ou le panneau de la console, dit ce
qui est configuré. En cas de doute, aller le lire — ne pas conclure de
`not_after` vide que rien n'est posé.

Qui compte régulièrement n'est jamais dérangé ; qui n'a pas ouvert l'app depuis
un mois ressaisit son mot de passe une fois.

Trois précisions de la documentation Supabase, qui évitent des surprises :

- **La durée réelle est le réglage plus l'expiration du jeton** (une heure ici).
  Le contrôle n'a lieu qu'au rafraîchissement suivant.
- **Changer le réglage ne tue pas les sessions en cours** : elles tombent au fur
  et à mesure de leurs rafraîchissements. Les sessions expirées sont effacées de
  la base 24 h plus tard.
- **Ne pas activer *Single session per user*.** Cette option ne garde que la
  dernière connexion : se connecter sur le téléphone déconnecterait du site, et
  inversement. Or un superviseur travaille précisément avec les deux.

**Ce qu'il fallait corriger avant d'activer, et qui l'est.** Une session
expirée n'annule pas les comptages en attente :

- `syncNow` ne tente rien sans session valide. Sinon la requête part en
  anonyme, PostgREST répond « permission denied », et `flush()` rangeait des
  comptages **valides** dans les échecs définitifs — le compteur perdait son
  travail.
- `isAuthExpired` (jeton périmé, 401, session absente) est traité comme une
  coupure réseau : l'opération reste en file. **`42501` n'en fait pas partie** —
  refus de droits avec session valide (retiré de l'inventaire, inventaire
  clôturé), ça doit rester un échec visible.
- Tests de garde : `tests/offline.test.ts`, blocs « une session expirée
  conserve la file » et « un refus de droits reste un échec définitif ».

**Le risque résiduel, à connaître avant de choisir des durées courtes** : si
une session expire pendant un comptage hors ligne, la personne est renvoyée
vers la connexion et ne peut pas se reconnecter sans réseau. Ses comptages sont
conservés, mais elle ne peut plus compter. C'est ce qui plaide pour un plafond
large plutôt que serré.

## Politique de mot de passe (console + code, 19 août 2026)

La console applique désormais : **12 caractères minimum**, une minuscule, une
majuscule, un chiffre, un symbole, et le refus des mots de passe présents dans
les fuites connues (**Leaked password protection**, HaveIBeenPwned). L'advisor
`auth_leaked_password_protection` a disparu — il ne reste que les avertissements
`*_security_definer_function_executable`, connus et voulus (les RPC portent
leurs propres contrôles).

`web/lib/password.ts` **rejoue ces règles côté client** pour les énoncer en
français avant l'envoi, et traduit les refus que seul le serveur peut prononcer
(mot de passe issu d'une fuite, réutilisation de l'ancien) — sans quoi la
personne reçoit un message technique en anglais. Les deux formulaires
(`/bienvenue`, `/reinitialisation`) affichent les exigences cochées à la frappe
(`PasswordRules`).

**Console et code doivent bouger ensemble** : assouplir la console sans
toucher au module afficherait une exigence qui n'existe plus ; la durcir sans
lui laisserait passer une saisie que le serveur refusera. Tests de garde :
`web/tests/password.test.ts` (dont le seuil de 12, figé explicitement).

## Suivi d'activité : agrégé, plus nominatif (E3, 19 août 2026)

Le suivi nominatif en direct a été **retiré**. Le superviseur voit des
compteurs — appareils connectés, en comptage, en audit — et pilote par
l'avancement par zone, qui décrit le travail et non les personnes.

**Contrat de présence v2** (`web/lib/presence.ts` et `src/lib/presence.ts`,
dupliqués volontairement, à garder synchronisés) : il ne reste que `mode` et
`beat`. Ont disparu le nom, l'écran, la balise en cours, le début d'activité et
**l'application au premier plan**. La clé de présence est un identifiant
d'appareil tiré au hasard, plus l'`user_id` — il voyageait dans le protocole
même absent de la charge. Le site **écoute sans publier**.

Le bump de version est ce qui protège la transition : une application mobile
restée en v1 continue d'émettre l'ancienne charge, mais le site l'écarte et la
compte dans `unknownVersions`, affiché à l'écran. **Ne jamais réutiliser le
numéro de version** en changeant le contrat.

Retirés aussi : l'appel à `get_session_activity` (nominative) et `counted_by`
dans la requête du fil des scans — ce qui n'est pas affiché n'a pas à descendre
au navigateur.

La RPC elle-même a été supprimée (`20260819174148`), **et le chemin pour y
arriver vaut d'être retenu** : une première suppression (`20260819171741`) a dû
être annulée dans la minute (`20260819172557`) parce que le site en production
l'appelait encore — le tableau de bord affichait alors « Cet inventaire n'est
pas accessible » à l'ouverture d'un inventaire, `refreshLive` la joignant dans
un `Promise.all` dont l'échec remonte jusqu'à l'écran. **Déployer le code
d'abord, supprimer l'objet ensuite.** Et à la restauration d'une fonction,
reposer les GRANT dans la même migration : `create or replace` rend EXECUTE à
PUBLIC (corrigé par `20260819172706`).

**Ce qui reste nominatif et doit le rester** : `counts.counted_by`, écrit à
chaque scan et restitué dans le rapport. Arbitrer un écart suppose de savoir
qui a compté ; finalité distincte, usage différé. Le supprimer retirerait au
produit sa capacité d'audit.

Conséquence sur les obligations : le critère « surveillance systématique »
tombe, il ne reste que « personnes vulnérables » — l'AIPD n'est donc en
principe plus requise, mais **cela se motive par écrit**. Analyse à jour :
`docs/conformite/suivi-activite-analyse.md`. Tests de garde :
`web/tests/presence-summary.test.ts` et le bloc « Suivi — activité agrégée »
de `web/tests-e2e/dashboard.spec.ts`.

## Reste à traiter, par ordre de priorité

1. **M5 — documents écrits, à faire relire.**
   `docs/conformite/registre-des-traitements.md` (7 traitements, établis en
   relisant le code) et `sous-traitance-article-28.md` (clauses à intégrer aux
   conditions de service). Ni l'un ni l'autre n'a été relu par un juriste.

## ~~Dérive entre le dépôt et la base~~ — CLOS LE 6 SEPTEMBRE 2026

`account_deletion_requests` et `request_account_deletion` n'avaient **aucune
migration** : créés directement par la console. C'est réparé — voir « La
discipline des migrations est faite » en fin de fichier. Il n'y a plus de
`supabase db pull` à faire avant de toucher à ces objets, leur définition est
écrite dans `20260906120001_socle_des_premiers_jours.sql`.

## Points conformes à préserver

Aucun traceur ni mesure d'audience — **aucun bandeau cookies n'est requis**, ne
pas en ajouter par réflexe. Polices Google auto-hébergées par `next/font` (pas
d'appel à Google au chargement). Données en `eu-west-1`. Aucun secret versionné.
La suppression de compte anonymise les comptages au lieu de les détruire.
