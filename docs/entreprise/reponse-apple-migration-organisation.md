# Réponse à Apple Developer Support — migration en Organisation

Dossier **102964327628** (Sukkry, Developer Support), courriel du 21 septembre
2026. Il liste six points et se termine par « When you're ready to start the
migration […] please respond to this email ». La réponse ci-dessous les reprend
dans l'ordre : un support qui retrouve ses propres points répond plus vite
qu'un support qui doit les rechercher.

Rédigée en anglais parce que Sukkry a écrit en anglais.

## ✅ ENVOYÉE LE 28 SEPTEMBRE 2026

Le compteur part de là. **Deux semaines = 12 octobre 2026**, au-delà desquelles
le silence n'est plus normal : demander un **rappel téléphonique** sur
`developer.apple.com/contact/`, pas une relance écrite (voir plus bas).
**Quatre semaines = 26 octobre 2026.**

Reçue le : ______  Issue : ______

## ⚠️ À vérifier AVANT d'envoyer

1. **La double authentification** est bien active sur l'Apple Account de
   l'adhésion (point 1). Je ne me connecte pas à ses comptes : c'est le seul
   point de la lettre que Julien affirme sans que je l'aie vu.
2. **Les chiffres de téléchargement sont exportés** depuis App Store Connect
   (point 5). Ils disparaissent avec l'adhésion individuelle, et l'app est
   publiée depuis le 27 septembre 2026 : c'est l'historique du lancement.
3. **La dénomination est celle du RCS, à la lettre.** La lettre écrit
   **`DEVKAYLAB`** en capitales, comme la checklist l'avait relevé le
   15 septembre 2026 — pas « Devkaylab » comme le site l'écrit pour le
   public. Apple compare à la fiche D&B, qui compare au registre : c'est la
   graphie du registre qui gagne, pas celle de la marque. À confirmer sur
   l'extrait avant d'envoyer.
4. ⚠️ **La fiche D&B classe Devkaylab en société, pas en entreprise
   individuelle.** C'est le seul vrai motif de refus (« Your organization is
   not listed as a legal entity »), et « à associé unique » peut induire un
   classement faux. Vérification :
   `developer.apple.com/enroll/duns-lookup/`. Le téléphone encore personnel sur
   cette fiche, lui, ne bloque rien.

## Ce qui a permis de répondre au point 2

Le point 2 demande un site public dont le domaine est associé à la société.
Trois preuves, toutes vérifiables sans se connecter :

- le WHOIS de `quantinvo.com` porte `Registrant Organization: Devkaylab`
  (corrigé le 21 septembre 2026, via **Vercel → Domains → Registrant
  Information**, pas chez Name.com) ;
- le pied de chaque page publique porte « © 2026 Devkaylab · Quantinvo » ;
- `https://www.quantinvo.com/mentions-legales` nomme la SASU, son RCS et son
  siège.

⚠️ Cette dernière page **n'est pas liée depuis le pied** et elle est en
`noindex` : `mentionsCompletes()` est faux tant que l'adresse et le téléphone
de l'hébergeur manquent dans `web/lib/legal.ts`. Si Apple demande les mentions
légales, il faut donner l'URL directe — elle répond.

## Le point 3 ne bloque pas, et c'est ce qui autorise à partir maintenant

Le portail Certificates, Identifiers & Profiles ferme pendant la migration.
Relevé le 28 septembre 2026 sur la machine de Julien :

| | |
|---|---|
| Certificat `Apple Distribution: Julien Thiong-Kay (8YL7866PHB)` | valable jusqu'au **8 septembre 2027** |
| Profil `iOS Team Store Provisioning Profile: com.quantinvo.app` | en cache local, **8 septembre 2027** |
| App Store Connect | reste ouvert pendant la migration (Apple, point 3) |

Une correction iOS peut donc être **signée et archivée** pendant toute la
migration. ⚠️ **À condition de ne rien faire qui force Xcode à régénérer un
profil** : pas de nouvelle capability, pas de changement d'identifiant, pas de
nouvel appareil enregistré. La restriction ne dure QUE la migration ; ensuite
les nouveaux certificats sont émis au nom de Devkaylab.

⚠️⚠️ **CE QUI N'EST PAS PROUVÉ : qu'on puisse la TÉLÉVERSER.** Apple écrit au
point 3 que « access to all other developer resources, including App Store
Connect, remains intact ». Un développeur écrit l'inverse sur le forum d'Apple
(fil 817034) : « I am unable to submit updates. I also cannot use the old
(individual) account normally because it appears to be locked in this
transition state. » **Aucun employé d'Apple n'a répondu, ni pour confirmer ni
pour démentir.** On part quand même — décision de Julien, 28 septembre 2026 —
mais en sachant que le pire cas est deux à quatre semaines sans pouvoir
corriger l'app iOS.

## Combien de temps

**Apple ne s'engage sur aucun délai**, ni dans le courriel de Sukkry ni dans sa
documentation. Relevé sur les forums d'Apple, cas de 2026 : 17 jours (fil
816092), « plus de trois semaines » (fil 814367), 61 jours (juillet-septembre).
Compter **deux à quatre semaines**, sans garantie.

⚠️ **Le levier si ça traîne** : l'auteur du fil 814367, bloqué à trois
semaines, a débloqué son dossier en demandant un **rappel téléphonique** depuis
`developer.apple.com/contact/` — pas en relançant par courriel. Ses relances
écrites étaient restées sans réponse.

---

## Le texte à envoyer

> Subject: Re: Case 102964327628 — migration to organization membership
>
> Hello Sukkry,
>
> Thank you for the details. We would like to start the migration of our
> individual membership to an organization membership.
>
> Organization details:
>
> - Legal entity name: DEVKAYLAB
> - Legal form: Société par actions simplifiée à associé unique (SASU),
>   incorporated in France
> - Registration: 109 680 389 R.C.S. Paris (SIREN 109 680 389)
> - D-U-N-S Number: 288196187
> - Registered address: 47 rue Vivienne, 75002 Paris, France
> - Website: https://www.quantinvo.com
> - Requester: Julien Thiong-Kay, founder and sole shareholder, authorised to
>   bind the company
>
> On your six points:
>
> 1. Two-factor authentication is enabled on the Apple Account of the
>    membership.
> 2. https://www.quantinvo.com is publicly available, and the domain is
>    associated with the organization: the WHOIS registrant organization is
>    Devkaylab, 47 rue Vivienne, 75002 Paris. The company name appears in the
>    footer of every page, and the legal notice at
>    https://www.quantinvo.com/mentions-legales states the company name, its
>    legal form and its R.C.S. registration number.
> 3. Understood. No certificate or provisioning profile renewal is planned
>    during the migration period.
> 4. Understood. DEVKAYLAB will apply to all apps we distribute.
> 5. Understood.
> 6. Not applicable. Our app is free and has no in-app purchases; subscriptions
>    are sold on our own website, outside the App Store.
>
> Please let us know if you need supporting documents — we can provide the
> company's Kbis extract and articles of association.
>
> Best regards,
>
> Julien Thiong-Kay
> Founder, Devkaylab
> contact@quantinvo.com · +33 6 88 59 27 65
> https://www.quantinvo.com

## Après la migration

- Le nom d'éditeur passe à **Devkaylab** sur l'App Store, et rejoint celui que
  Google Play affiche déjà depuis la bascule du 16 septembre 2026.
- Le copyright d'App Store Connect dit encore « 2026 Julien Thiong-Kay » : à
  reprendre à la version suivante.
- Les nouveaux certificats seront émis au nom de Devkaylab. Les anciens
  restent valables jusqu'à leur date.

---

## Le dossier est déposé — 2 octobre 2026

Apple a envoyé le lien d'adhésion, le formulaire est rempli, le code de
vérification est passé : **« enrollment is being processed »**.

Ce qui a été saisi, et pourquoi :

- **Legal entity name : `DEVKAYLAB`, et RIEN D'AUTRE.** ⚠️ Le champ demandait
  pourtant d'inclure le type d'entité, et le conseil donné sur le moment était
  `DEVKAYLAB SASU` — **il était faux** : cette graphie ne correspond pas à la
  fiche D&B, qui ne porte que la dénomination. C'est la fiche qui gagne,
  toujours : Apple compare à elle, pas à ce que le libellé du champ suggère.
  Capitales dans tous les cas — graphie du RCS ; « Devkaylab » est la marque.
  **La règle à retenir : recopier la fiche D&B à l'identique, et ignorer ce que
  le formulaire paraît demander en plus.**
- **Adresse de courrier : `contact@quantinvo.com`.** Apple refuse les
  fournisseurs gratuits ; surtout pas `devkaylab@gmail.com`, qui est l'adresse
  du compte Play. Ce qui rend celle-ci recevable n'est pas le nom du domaine
  mais le lien public domaine ↔ société : vérifié le 2 octobre, le WHOIS de
  `quantinvo.com` porte `Registrant Organization: Devkaylab`, et les MX
  répondent (ImprovMX). Le code y est bien arrivé.

⚠️ **Le WHOIS porte encore `Registrant Email: devkaylab@gmail.com`.** Ça ne
bloque rien — Apple lit le champ *Organization* — mais à passer à `contact@`
**une fois le dossier traité**, via **Vercel → Domains → Registrant
Information** (pas Name.com, simple registraire). Ne pas le changer pendant le
traitement : la fiche ne doit pas bouger sous les yeux de l'examinateur.

⚠️ **Rien côté iOS tant que ce n'est pas confirmé** : pas d'archive, pas de
capability, pas d'appareil enregistré. Relancer par rappel téléphonique si rien
au 12 octobre 2026.

---

## Suivi — relevé le 7 octobre 2026

Lu dans le compte développeur, cinq jours après le dépôt :

| Où | Ce que ça dit |
|---|---|
| developer.apple.com/account | **DEVKAYLAB (En attente)** |
| Bandeau | « Le traitement de votre inscription est en cours » |
| **Identifiant d'inscription** | **`9L95Q9R29F`** |
| Certificates, Identifiers & Profiles | **Access Unavailable** — fermé |
| App Store Connect | fonctionne, encore sous le compte personnel |

⚠️ **Deux numéros, et ils ne servent pas à la même chose :**

- **`9L95Q9R29F`** — l'identifiant d'**inscription**, affiché sur la page du
  compte. C'est celui qu'Apple demande quand on appelle au sujet de l'adhésion
  en cours.
- **`102964327628`** — le numéro du **dossier de support** ouvert avec Sukkry,
  celui du fil de courriels ci-dessus.

Rien n'est demandé : aucun document réclamé, aucun message sur la page. Il n'y
a donc rien à faire, seulement à attendre.

⚠️ Et les consignes d'AGENTS.md tiennent telles quelles, puisque le portail est
toujours fermé : pas de capability ajoutée, pas de changement de bundle ID, pas
d'appareil enregistré. Signer et archiver restent possibles (certificat et
profil en cache jusqu'au 08/09/2027) ; **téléverser n'est toujours pas prouvé**.

## ⚠️⚠️ ACCEPTÉE — 7 octobre 2026, 10 h 21

Courriel de l'Apple Developer Relations Team, reçu sur `devkaylab@gmail.com` :

> « Your enrollment request has been accepted. To complete your organization's
> enrollment in the Apple Developer Program, please sign in to your developer
> account to review and accept the Apple Developer Program License Agreement,
> and complete your membership purchase. »

Cinq jours après le dépôt. Aucun document supplémentaire n'a été réclamé : le
dossier a été accepté tel quel, et l'appel au support du 28 septembre n'aura
servi qu'à le débloquer.

**Il reste trois gestes, et ils sont tous les trois à Julien** — se connecter,
accepter un contrat, payer. Aucun ne peut être délégué, et aucun ne doit l'être.

1. Se connecter sur `developer.apple.com/account`.
2. Lire et accepter l'**Apple Developer Program License Agreement**.
3. Régler l'adhésion (99 €/an pour une organisation).

⚠️ **LE CHEMIN EST BIEN LE SITE, PAS L'APP.** Le courriel propose les deux, et
précise que l'app exige *le même appareil* que celui du dépôt. L'inscription
`9L95Q9R29F` s'affichait sur la page du compte, dans le navigateur, le
7 octobre au matin : le dépôt est donc passé par le site, et c'est là qu'il se
termine.

## Ce qui change quand c'est payé, et ce qui ne change pas tout seul

- Le portail **Certificates, Identifiers & Profiles** rouvre. Les consignes
  d'AGENTS.md — pas de capability, pas de bundle ID, pas d'appareil — peuvent
  alors être retirées. **À vérifier avant de les retirer** : le portail répond,
  et il répond pour l'équipe DEVKAYLAB.
## ⚠️⚠️ CE QU'ON FAIT ICI EST UNE CONVERSION, PAS UN SECOND COMPTE

**Correction du 7 octobre 2026, et elle compte.** J'avais écrit le matin que
l'app vivrait sous le compte personnel, que DEVKAYLAB naîtrait « à côté », et
qu'il faudrait un **App Transfer**. C'est très probablement faux, et la preuve
était déjà sous les yeux depuis le 2 octobre.

La procédure d'Apple pour passer un compte d'Individual à Organization est
documentée, et elle se déroule exactement comme ce dossier :

| Ce que la procédure dit | Ce qu'on a vécu |
|---|---|
| Passer par **Contact us → Membership and Account → Program Enrollment** | dossier de support **102964327628**, avec un conseiller (Sukkry) |
| Fournir raison sociale, **D-U-N-S**, titre, autorité légale | fourni le 28 septembre |
| Un représentant appelle pour vérifier | l'appel a eu lieu |
| Apple écrit ensuite pour **« accepter de nouveaux contrats »** | le courriel du 7 octobre, 10 h 21 |
| ⚠️ **« Certificates, Identifiers & Profiles peut être temporairement indisponible pendant la migration »** | **Access Unavailable** depuis le 2 octobre |

C'est la dernière ligne qui tranche : **une inscription SÉPARÉE ne fermerait pas
le portail du compte existant.** Un portail fermé est le symptôme d'une
conversion du compte, pas de la création d'un second.

Et « DEVKAYLAB (En attente) » sur la page du compte, avec App Store Connect
encore au nom personnel, ressemble **autant** à une conversion en cours qu'à un
second compte. J'ai lu une ambiguïté comme une certitude.

**Si c'est bien une conversion**, alors il n'y a **ni App Transfer, ni nouveau
bundle ID, ni nouvel examen** : la même équipe change de nom et de type, et
l'app ne bouge pas. C'est tout l'intérêt d'avoir pris ce chemin plutôt que
d'ouvrir un compte neuf.

⚠️ **Ce que coûterait un App Transfer, pour mémoire** (relevé dans la
documentation d'App Store Connect le 7 octobre) : TestFlight doit être ÉTEINT,
tous les builds et tous les testeurs retirés, les champs « Éléments à tester »
vidés ; l'historique d'App Analytics est perdu pour l'émetteur ; les codes promo
meurent. Autrement dit, le chemin qu'on a évité.

## Comment en être sûr, avant de payer

Dix secondes sur `developer.apple.com/account`, après connexion :

- **UNE seule équipe**, dont le nom devient DEVKAYLAB → conversion. Rien à
  transférer.
- **DEUX équipes**, la personnelle et DEVKAYLAB → second compte. Et là,
  l'App Transfer redevient la question.

⚠️ **Et l'écran de paiement dit le montant et la période : les lire.** Si Apple
réclame 99 € alors que l'adhésion personnelle court encore, c'est le moment de
le demander — en répondant sur le dossier **102964327628**, avant de payer, pas
après. Une conversion n'est pas censée faire payer deux fois une même année.

⚠️ **Et ne pas laisser l'adhésion personnelle expirer** tant que ce n'est pas
clarifié : une adhésion expirée retire l'app de la vente.
- La **clé live Stripe** et l'ouverture de la vente ne dépendent pas de ceci :
  elles dépendent de la publication sur les deux boutiques (décision de Julien)
  et des mentions légales.

## ⚠️⚠️ CONFIRMÉ : C'ÉTAIT UNE CONVERSION — 7 octobre 2026, au soir

Julien, après avoir terminé l'étape : « j'ai finalisé l'étape ASC et finalement
pas besoin de payer un nouvel abonnement. Le mien continue jusqu'en avril
2027. »

**L'adhésion continue, et elle n'a pas été rachetée.** C'est la preuve qu'il
s'agissait bien d'une conversion du compte existant, et non d'une seconde
inscription. Le « complete your membership purchase » du courriel était
générique — il décrit le cas d'une inscription neuve, pas celui-ci.

Ce qui tombe, du coup :

- **Pas d'App Transfer.** La même équipe change de nom et de type ; Quantinvo
  iOS ne bouge pas, garde son bundle ID, sa fiche publiée le 27 septembre, ses
  avis et son historique de builds.
- **Pas de second examen**, et pas de TestFlight à éteindre.
- **Pas de 99 € en plus.** Prochaine échéance : **avril 2027**, inchangée.

⚠️ **ET CE QUI RESTE À VÉRIFIER, EN DEUX CLICS :**

1. **Le portail Certificates, Identifiers & Profiles répond-il ?** C'est la
   seule condition pour retirer les consignes gelées d'AGENTS.md (pas de
   capability, pas de bundle ID, pas d'appareil). Il était fermé « pendant la
   migration » ; la migration est finie, il devrait être ouvert. **Non vérifié :
   une session neuve demande une connexion, et se connecter n'est pas de mon
   ressort.**
2. **Le nom du vendeur dans App Store Connect.** C'est le défaut connu des
   conversions : la fiche peut continuer d'afficher le nom personnel au lieu de
   DEVKAYLAB (cas signalé sur les forums développeurs d'Apple). Si c'est le cas,
   ça se règle par le support, pas par un réglage — et il vaut mieux le voir
   maintenant qu'au moment d'une mise à jour.
3. **Au prochain build, que Xcode résout toujours le profil.** Le certificat et
   le profil App Store sont en cache jusqu'au 08/09/2027, et l'équipe n'a pas
   changé d'identifiant — mais son NOM a changé, et c'est le genre de détail qui
   se voit à l'archivage, pas à la lecture. ⚠️ Toujours Xcode 26.6, et toujours
   pas de dépôt en revue sans être passé par TestFlight sur un vrai appareil.
