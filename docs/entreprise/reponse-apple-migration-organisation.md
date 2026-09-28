# Réponse à Apple Developer Support — migration en Organisation

Dossier **102964327628** (Sukkry, Developer Support), courriel du 21 septembre
2026. Il liste six points et se termine par « When you're ready to start the
migration […] please respond to this email ». La réponse ci-dessous les reprend
dans l'ordre : un support qui retrouve ses propres points répond plus vite
qu'un support qui doit les rechercher.

Rédigée en anglais parce que Sukkry a écrit en anglais.

## ⚠️ À vérifier AVANT d'envoyer

1. **La double authentification** est bien active sur l'Apple Account de
   l'adhésion (point 1). Je ne me connecte pas à ses comptes : c'est le seul
   point de la lettre que Julien affirme sans que je l'aie vu.
2. **Les chiffres de téléchargement sont exportés** depuis App Store Connect
   (point 5). Ils disparaissent avec l'adhésion individuelle, et l'app est
   publiée depuis le 27 septembre 2026 : c'est l'historique du lancement.
3. **La dénomination est celle du RCS, à la lettre.** La lettre écrit
   « Devkaylab ». Si l'extrait porte une autre casse ou une autre forme, c'est
   celle-là qu'il faut — Apple compare à la fiche D&B, qui compare au registre.
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
> - Legal entity name: Devkaylab
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
> 4. Understood. Devkaylab will apply to all apps we distribute.
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
