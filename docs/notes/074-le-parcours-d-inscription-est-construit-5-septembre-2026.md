# Le parcours d'inscription est construit (5 septembre 2026)

*« Fais le reste. Aucun sujet ne doit rester en suspens. »* Les cinq tranches
annoncées le matin sont là. Maquette, décisions 1 à 5 comprises :
https://claude.ai/code/artifact/27d8f3e6-5e7a-4de7-a1eb-6da9d39cce3a

Migrations `20260905140001` (le socle), `…150001` (la demande et le paiement),
`…160001` (les relances et la purge), `…170001` (le tour de garde). Fonction
edge `inscription`, écran `/inscription` en huit étapes, module
`web/lib/inscription.ts`.

## Le parcours, en une phrase par étape

1. l'adresse → un code à six chiffres part par e-mail ;
2. le code ; 3. le mot de passe → **le compte existe**, et il ne voit rien ;
4. la pratique actuelle ; 5. fréquence et volume de références ;
6. les magasins, **avec leurs appareils, magasin par magasin** ;
7. l'entreprise (SIREN, raison sociale, contact) ;
8. l'offre — **une par magasin, additionnées** — puis le paiement.

## ⚠️ CE QUI REMPLACE LE VERROU DE L'AUTO-INSCRIPTION

`handle_new_user` refusait tout e-mail sans invitation depuis le 13 août. Il
accepte désormais un quatrième cas, et **un seul fait** : une adresse dont le
code a été consommé il y a moins de quinze minutes. Le profil qui en sort est
`employee` sans entreprise — **vérifié, pas déduit** : 0 magasin, 0 entreprise,
0 inventaire, 0 comptage, 0 article, et son auto-promotion est ignorée.

Le détail du code (CSPRNG qualifié, modulo rejeté, bcrypt, dix minutes, usage
unique, cinq essais comptés avant la comparaison, quota avant la recherche par
adresse) est dans la section « Le socle du prospect » plus haut.

## ⚠️ LE BROUILLON VIT DANS SA PROPRE TABLE

`inscriptions`, pas `company_requests` : `admin_pipeline` rend « tout ce qui
n'est pas terminé » de cette table, et un brouillon abandonné à l'étape 4 s'y
afficherait comme une vente en cours, avec un nom vide et un revenu de zéro.

Il devient une `company_requests` **à la finalisation**, en `accepted` — et à
partir de là c'est la machinerie du 22 août, inchangée : Checkout, webhook,
`fulfil_paid_request`. **Aucun second chemin de création d'entreprise.**

## ⚠️ LE PAIEMENT PROMEUT LE COMPTE, IL N'INVITE PAS

`invite_company_admin_after_payment` refuse une adresse qui a déjà un compte
(`account_exists`, garde VR-003) — c'est exactement le cas du prospect. Sans la
promotion, il paierait et n'obtiendrait rien : le défaut vécu en vrai le 30 août
sur la souscription en ligne.

**On promeut `user_id`, noté sur la demande à sa naissance, jamais l'adresse
relue** : quelqu'un qui change d'adresse entre le dépôt et l'encaissement se
verrait sinon attribuer l'entreprise d'un autre. Et
`promouvoir_admin_apres_paiement` ne déplace jamais un compte déjà rattaché.

## ⚠️ LE PRIX VIENT DU SERVEUR

`finaliser_inscription` est appelée **avec le jeton du prospect** : lui laisser
porter un montant le laisserait s'inscrire à un centime. Elle appelle
`prix_offre`, magasin par magasin, et la borne des 200 appareils reste là-bas —
on n'en fait pas une copie. L'écran, lui, n'affiche que ce que `prixCents` dit,
et refuse la borne **avant le clic**.

Vérifié de bout en bout, en transaction annulée, sur les trois magasins de la
maquette : 140 + 12 + 2 appareils → 1 146 + 310 + 89 = **1 545 €/mois**, ou
**16 460 €/an**. Les mêmes chiffres à l'écran et en base.

## Les trois relances, et la paire qu'elles forment

J+1, J+8, J+21 — trois, jamais quatre — et une rétention de **30 jours**.

- **⚠️ LE CALENDRIER ET LA RÉTENTION VIVENT AU MÊME ENDROIT.** J+21 contre une
  purge à 30 jours ne laisse que **neuf jours** de marge : si la rétention
  redescendait sans que le calendrier suive, la troisième relance partirait sur
  des réponses déjà effacées. Un test compare les deux.
- **⚠️ Une relance n'est PAS une anomalie**, et ne passe donc pas par
  `anomalies_a_signaler` : elle a sa propre mémoire, son propre calendrier et
  son propre destinataire — le prospect, pas nous. L'y mêler lui aurait fait
  hériter du rappel à 24 h, donc d'un quatrième envoi.
- **⚠️ On marque APRÈS l'envoi**, et **des relances seules sont un succès** :
  `clesEnvoyees` ne porte que les alertes, et un tour de garde qui n'avait rien
  à signaler mais a relancé trois prospects répondait 500 — donc `pg_cron`
  l'aurait rejoué toutes les heures. Même famille que le défaut du 4 septembre.

## ⚠️ UN ÉCART ASSUMÉ AVEC LA MAQUETTE, à corriger si Julien préfère

La règle 8 demandait un **jeton de reprise** aléatoire à durée limitée. Il n'y
en a pas, et c'est délibéré : le prospect a un compte et un mot de passe dès
l'étape 3. La relance le ramène sur `/inscription`, sa session le reconnaît (ou
il se connecte), et `mon_inscription` retrouve son brouillon par `auth.uid()`.
**Un jeton qui authentifie serait un identifiant de plus à protéger** pour un
gain nul ; un jeton qui n'authentifie pas ne servirait à rien.

## ⚠️ CE QUI RESTE À FAIRE, ET QUE JE NE PEUX PAS FAIRE

- ~~Les deux Price `STRIPE_PRICE_APPAREILS_*` restent à poser~~ — **FAUX, et
  c'est moi qui l'ai écrit**. Ils étaient posés depuis le 4 septembre 17 h 09.
  Constat de Julien : « je comprends pas, on n'a pas déjà fait les price sur
  Stripe ? ». J'avais repris la note du dépôt au lieu de lancer
  `supabase secrets list`. **Les huit Price existent**, et les deux
  « appareils » ont été relus sur les pages de paiement le 5 septembre.
- **⚠️ LE PARCOURS A ÉTÉ ÉPROUVÉ CONTRE STRIPE, en test** (5 septembre 2026) :
  compte de prospect créé par la fonction edge, session ouverte, dépôt d'un
  magasin à 140 appareils, et les deux pages de paiement relues — mensuelle et
  annuelle. Voir « Les huit Price Stripe » plus haut pour les montants.
  Données d'essai supprimées, **zéro résidu contrôlé** (0 brouillon, 0 demande,
  0 code, 8 comptes et 8 profils comme avant).
- **Aucun euro n'a circulé** : les deux sessions ont été abandonnées, elles
  expirent d'elles-mêmes. Et **l'e-mail du code n'a pas été reçu dans une vraie
  boîte** — le code a été lu en base pour ne pas écrire à un domaine d'essai.

## Six gardes réorientées, aucune affaiblie

`/inscription` a cessé d'être un formulaire d'un seul tenant : six gardes
décrivaient son ancienne écriture. Chacune vise maintenant ce qu'elle défend —
les mots des libellés plutôt que le composant partagé, les bornes plutôt que
des `id` figés, la fonction edge plutôt que la RPC. Et l'une d'elles garde
désormais **l'inverse** : la page n'a **plus** de repli sur une RPC directe,
parce que sans la fonction edge il n'y a pas de paiement.

## Trois gardes qui ne mordaient pas

Toutes trois du même genre, et le genre est instructif :

1. **`espaces()` avant `sansCommentaires()` ne retire aucun commentaire** —
   aplatir efface les débuts de ligne. Négations comme positives se lisaient
   sur la documentation du fichier.
2. **`toContain('essais >= 5')` accepte `essais >= 5000`.**
3. **`toContain('length(v_nom) > 80')` accepte `> 800`.**

*Une garde sur un nombre porte sur sa borne, pas sur son préfixe.*

## Vérifications

- **En base, tout en transactions annulées** : les douze comportements du code,
  la création de compte, ce que le prospect voit (rien), le parcours complet
  brouillon → reprise → quatre refus de saisie → dépôt → webhook → promotion,
  le rejeu `already`, et les six cas du calendrier de relance (J+2, J+9, J+22,
  après trois, au-delà de la rétention, brouillon déjà déposé).
- **Parité dépôt/base** : les quinze fonctions touchées ont la même empreinte
  MD5, corps normalisés.
- **Dix-huit sabotages, dix-huit échecs** (après resserrement des trois gardes
  molles).
- **Au navigateur**, route jetable retirée, `git status` contrôlé, clair et
  sombre à 1 280 px : les étapes 4, 6 et 8, **débordement horizontal nul**.
  ⚠️ Le volet annonçait 204 px de débordement — c'était `clientWidth` à zéro,
  le volet étant masqué. **Mesurer après avoir posé une largeur explicite.**
- 1 199 tests du site, `tsc --noEmit`, `eslint .` à zéro erreur, `next build`
  avec `/inscription` en route statique.
- **Six fonctions edge déployées** — `inscription` (v2, `verify_jwt: false`),
  `alerte-anomalies`, et les quatre qui embarquent `_shared/stripe.ts`
  (`accept-quote`, `subscribe-online`, `stripe-webhook`, `libre-service`), ce
  module ayant gagné les lignes multiples. `verify_jwt` relevé avant, recontrôlé
  après : rien n'a bougé.
- Zéro résidu contrôlé : 0 brouillon, 0 demande, 0 code, 2 entreprises,
  2 magasins.

Tests de garde : `web/tests/inscription.test.ts`.

## Le menu mobile arrive, il n'apparaît pas (5 septembre 2026)

*« Je veux cette animation d'arrivage quand on ouvre le menu burger en version
mobile »* — enregistrement d'écran de la version mobile de Qonto à l'appui.

**⚠️ MESURÉ, PAS DEVINÉ.** Le film a été découpé à 1/30 s (AVFoundation, faute
de ffmpeg sur la machine — un petit binaire Swift dans le bac à sable, plus une
planche-contact pour ne lire qu'une image au lieu de cinquante). La largeur
couverte par le panneau, image par image : **33 % · 60 % · 85 % · 95 % · 99 %**.
Six images, soit **200 ms**, et une forte décélération.

- **Le panneau glisse depuis la DROITE**, d'un bloc — le contenu ne se décale
  pas séparément.
- **La courbe est la plus proche des standards, pas une courbe ajustée sur
  cinq points.** `cubic-bezier(0.33, 1, 0.68, 1)` suit la mesure à 4,6 points
  en moyenne, aussi bien que la courbe d'iOS et mieux que Material ou le
  mot-clé `ease-out`. L'écart restant (dix points sur la première image) tient
  dans l'erreur de mesure : une image vaut 33 ms, et 33 ms de décalage
  déplacent la courbe d'une quinzaine de points à cet endroit. **Prétendre
  mieux serait de la fausse précision.**
- **⚠️ C'est une `animation`, pas une `transition`.** Le panneau se ferme par
  `[hidden]`, donc par `display: none` : une transition n'aurait rien à animer
  au retour, et la faire vivre demanderait de toucher au mécanisme du `hidden`
  — celui-là même qui avait fait ouvrir le site AVEC le menu déployé le matin
  du 5 septembre. Une animation se rejoue à chaque affichage sans qu'on y
  touche.
- **La fermeture reste instantanée.** Chez Qonto elle est en **fondu** (mesuré
  aussi, à 2,7 s du film) ; c'est un second geste, à faire seulement si Julien
  le redemande.
- `prefers-reduced-motion` la supprime.

⚠️ **Piège du volet navigateur, une variante de plus** : `getAnimations()` rend
une liste **vide** juste après l'ouverture — l'onglet est masqué, aucune frame
n'est produite, donc l'animation ne démarre jamais. Ce qui se vérifie quand
même : `getComputedStyle` rend bien `animation-duration` et
`animation-timing-function`, et un premier appel — passé pendant que
l'animation tournait encore — a montré les deux images clés
(`translateX(100%)` → `none`). La courbe, elle, se vérifie par le calcul.

Tests de garde : `web/tests/navigation.test.ts`, bloc « le menu mobile arrive ».
