# Le parcours d'inscription — le socle (5 septembre 2026)

Maquette validée point par point, décisions 1 à 5 tranchées :
https://claude.ai/code/artifact/27d8f3e6-5e7a-4de7-a1eb-6da9d39cce3a

*« On paie, on est inscrit »* — plus de demande, plus de devis, plus d'attente.
Julien, la maquette close : « Tu peux coder ». **Ce qui suit est la PREMIÈRE
TRANCHE, pas le parcours complet** : le socle en base. La liste de ce qui reste
est en bas de section.

## ⚠️ CETTE MIGRATION ROUVRE L'AUTO-INSCRIPTION

Depuis le 13 août 2026, `handle_new_user` refusait **tout** e-mail sans
invitation. C'était LE verrou qui protégeait le reste du produit, et il saute.

Ce qui le remplace n'est pas rien, mais il faut le dire franchement : **un
e-mail vérifié par un code à six chiffres, et un profil qui ne voit rien.**
N'importe qui pourra créer un compte Quantinvo vide. C'est le prix de
l'ouverture, et il est acceptable — un compte sans entreprise n'ouvre aucune
donnée. Ce qui reste à surveiller est le volume d'e-mails envoyés, que la
limitation de débit borne sans le supprimer.

## Le code à six chiffres (migration `20260905140001`)

- **CSPRNG, qualifié par son schéma** — `extensions.gen_random_bytes`. L'appel
  nu échoue à l'EXÉCUTION, pas à la création : la migration passerait et la
  génération casserait au premier essai. Leçon du 28 août, payée une fois.
- **⚠️ Le modulo est rejeté, pas subi.** 2^32 n'est pas un multiple de 10^6 :
  un `% 1000000` nu favoriserait les codes les plus bas. On retire le reliquat
  au-dessus de 4 294 000 000.
- **Jamais en clair** : bcrypt (`extensions.crypt`), et la comparaison passe
  par lui — constante en temps.
- **Dix minutes, usage unique, cinq essais.** Sans cette dernière borne, un
  million de combinaisons se teste vite, et le code est la SEULE barrière.
  ⚠️ **L'essai est compté AVANT la comparaison** : cinq essais doivent coûter
  cinq essais.
- **Une nouvelle demande REMPLACE la précédente** : sinon on accumulerait des
  codes vivants pour une même adresse, chacun avec ses cinq essais.
- **⚠️ Le quota se pose APRÈS la saisie et AVANT la recherche par adresse.**
  L'ordre EST le contrôle : une faute de frappe ne consomme pas le quota de
  quelqu'un, et un script ne peut pas interroger la base à volonté avant d'être
  freiné. Leçon du 28 août sur `submit_company_request`.
- **⚠️ Les quatre fonctions et la table sont fermées à `authenticated` AUSSI.**
  `demander_code_email` rend `compte_existant` : c'est un oracle, et c'est
  précisément pour ça qu'elle n'est pas publique. **La réponse uniforme est le
  travail de la fonction edge** — l'écran dit toujours « nous vous avons envoyé
  un code », et c'est l'e-mail, qui n'atteint que le propriétaire de la boîte,
  qui dit la vérité. Motif de `submit_company_request_detailed`.

## La quatrième branche de `handle_new_user`

Elle n'accepte **qu'un fait** : une adresse dont le code a été consommé il y a
moins de quinze minutes. Pas un paramètre, pas une métadonnée du client —
`raw_user_meta_data` est écrit par l'appelant, il ne prouve rien.

- **⚠️ Elle ne donne RIEN** : `role = 'employee'`, `company_id` nul. Toutes les
  policies se cloisonnent par l'entreprise, le magasin ou la session : sans
  entreprise elles comparent `null = null`, donc faux.
- **⚠️ VÉRIFIÉ, PAS DÉDUIT** (la maquette l'exigeait, c'est l'hypothèse non
  vérifiée qui avait produit VR-007). Session de prospect simulée en
  transaction annulée : 0 magasin, 0 entreprise, 0 inventaire, 0 comptage,
  0 article, `get_my_company` nul, `is_admin` et `is_company_admin` faux,
  `my_team_by_store` et `ca_company_overview` refusées, `get_my_stores` vide.
  Il voit **son propre profil**, et rien d'autre.
- **⚠️ Elle ne touche ni `profiles_pin_privileged` ni la policy d'INSERT fermée
  par VR-008.** Vérifié en direct : le prospect qui tente de s'écrire une
  entreprise et le rôle superviseur voit son écriture **ignorée**.
- **⚠️ L'ordre des branches compte** : après les invitations (quelqu'un qui a
  une invitation en attente ET une adresse vérifiée doit recevoir son
  invitation), avant le refus final — qui reste intact.
- **Reprise de `pg_get_functiondef`, pas du dépôt.** C'est la fonction qui
  conditionne toute création de compte : la réécrire de mémoire ressusciterait
  une version périmée.

## ⚠️ Deux gardes qui ne mordaient pas, et les deux motifs sont neufs

1. **`espaces()` avant `sansCommentaires()` ne retire aucun commentaire** :
   aplatir efface les débuts de ligne, et le filtre ne reconnaît plus rien.
   Négations *comme positives* se lisaient alors sur la documentation du
   fichier. Sixième variante de ce piège — d'où un seul helper, `code()`, qui
   retire d'abord et aplatit ensuite.
2. **`toContain('essais >= 5')` accepte `essais >= 5000`.** Le sabotage
   passait. On ancre sur la fin de la clause (`'v_ligne.essais >= 5 then'`).
   *Une garde sur un nombre doit porter sur sa borne, pas sur son préfixe.*

## Ce qui a été vérifié

- **En base, en transactions annulées** : mille codes tous bien formés ; e-mail
  vide et malformé refusés sans consommer le quota ; code haché ; cinq mauvais
  essais puis **le bon code refusé** ; nouveau code, bon code accepté, rejeu
  refusé ; adresse avec compte existant → pas de code ; sixième demande de
  l'heure refusée. Puis la création de compte elle-même : adresse non vérifiée
  **toujours refusée**, adresse vérifiée → profil `employee` sans entreprise.
- **Parité dépôt/base** : les cinq corps ont la même empreinte MD5.
- **Sept sabotages, sept échecs** (après correction des deux gardes molles).
- 1 174 tests du site, `tsc --noEmit`, zéro résidu contrôlé.

## ⚠️ CE QUI RESTE À FAIRE — le parcours n'est pas utilisable

Rien n'est branché à un écran : il n'existe aucun chemin pour un prospect
aujourd'hui, et c'est voulu tant que les tranches suivantes ne sont pas là.

1. **La demande** : `company_requests` gagne `user_id` (le compte à promouvoir,
   rule 7 de la maquette), les réponses du questionnaire, un jeton de reprise
   aléatoire à durée limitée (rule 8), et le suivi des relances.
2. **Le paiement promeut le compte existant** au lieu d'inviter — c'est
   `fulfil_paid_request`, et **jamais l'adresse relue** (famille de VR-003).
3. **Les fonctions edge** : envoi du code, vérification + création du compte
   (`createUser` en clé de service), dépôt de la demande. La réponse uniforme
   vit là.
4. **Les huit écrans**, mobile et bureau.
5. **Les trois relances** J+1, J+8, J+21, rétention 30 jours. ⚠️ Les deux
   valeurs doivent vivre au même endroit : J+21 contre une purge à 30 jours ne
   laisse que neuf jours de marge.
6. **Le nombre exact au-delà de 100 appareils** (tranché le 5 septembre) : le
   prix s'y compte par dix, une tranche ne suffit plus.

Tests de garde : `web/tests/inscription.test.ts`.
