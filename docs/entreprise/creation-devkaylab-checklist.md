# Création de Devkaylab — check-list

**Objet** : immatriculer la structure qui édite Quantinvo, puis cocher les
obligations qui en découlent, dans l'ordre où elles se débloquent.
**Établie le** : 21 août 2026.

> Ce document est une grille de travail écrite par l'assistant de
> développement, pas un conseil juridique ou comptable. Les montants et taux
> cités sont ceux connus début 2026 : **les faire confirmer par
> l'expert-comptable** avant de s'engager. Chaque étape porte une case à
> cocher et une ligne « fait le » à remplir.

## Hypothèse retenue

**SASU à l'impôt sur les sociétés**, dénomination sociale « Devkaylab », nom
commercial « Quantinvo ». Raisons : le produit est déjà construit, la grille
tarifaire (2 100 à 14 400 € HT par an et par magasin) vise des enseignes qui
demanderont un Kbis, une RC pro et des CGV ; la société doit posséder la marque,
le code et les contrats ; un associé ou un investisseur doit pouvoir entrer un
jour sans tout refaire.

Si la décision finale est la micro-entreprise, les étapes 0, 2, 3 et 6 à 10
restent valables ; les étapes 1, 4 et 5 tombent.

## Étape 0 — Avant de signer quoi que ce soit

- [ ] Rendez-vous avec un expert-comptable (premier échange souvent gratuit).
      Questions à poser : SASU ou micro selon ma situation ; rémunération ou
      dividendes ; option TVA réel ; honoraires annuels ; connexion Qonto.
      Fait le : ______
- [ ] Si salarié : relire le contrat de travail (clause d'exclusivité,
      obligation de loyauté, concurrence). Un inventaire tournant vendu à des
      enseignes peut toucher l'activité de l'employeur actuel.
      Fait le : ______
- [ ] Si demandeur d'emploi : vérifier le maintien de l'ARE (possible en SASU
      sans rémunération) et l'ACRE (exonération partielle la première année).
      Fait le : ______
- [ ] Choisir le siège : domicile (autorisé, sans limite de durée pour une
      SASU dont le président y habite) ou domiciliation commerciale.
      Fait le : ______
- [ ] Fixer le capital. 1 € est légal ; quelques centaines d'euros se lisent
      mieux sur un Kbis. Le capital reste disponible une fois la société
      immatriculée.
      Montant : ______

## Étape 1 — Constituer la SASU

- [ ] Rédiger les statuts (modèle type, ou parcours création de Qonto avec
      son partenaire juridique, ou l'expert-comptable). Points à fixer :
      objet social (« édition, développement et commercialisation de
      logiciels et d'applications, prestations associées »), durée (99 ans),
      exercice (clôture au 31 décembre, premier exercice allongé), président
      (Julien Thiong-kay), pouvoirs, cession d'actions.
      Fait le : ______
- [ ] Ouvrir le compte pro chez Qonto et y déposer le capital. Qonto délivre
      l'**attestation de dépôt de capital**, pièce obligatoire du dossier.
      Fait le : ______
- [ ] Publier l'annonce légale (journal habilité, environ 150 à 200 €).
      Fait le : ______
- [ ] Déposer le dossier sur le guichet unique (procedures.inpi.fr) : statuts
      signés, attestation de dépôt, annonce légale, pièce d'identité,
      déclaration de non-condamnation, justificatif du siège, **déclaration
      des bénéficiaires effectifs** (toi à 100 %).
      Code APE visé : 58.29C (édition de logiciels applicatifs) ; 62.01Z
      (programmation) est l'autre réponse possible, l'INSEE tranche.
      Fait le : ______
- [ ] Recevoir le Kbis, le SIREN, le SIRET et le numéro de TVA
      intracommunautaire.
      SIREN : ______  Reçu le : ______

## Étape 2 — Fiscal et social, dans le mois qui suit

- [ ] TVA : **opter pour le régime réel** (simplifié ou mini-réel) plutôt que
      la franchise. Les clients sont des entreprises et récupèrent la TVA ;
      la société récupère celle de Supabase, Vercel, Resend, Apple.
      Rappel : les factures des prestataires étrangers s'autoliquident — le
      numéro de TVA intracommunautaire doit leur être communiqué (réglages de
      facturation de chaque compte).
      Fait le : ______
- [ ] Impôt sur les sociétés : régime par défaut de la SASU, rien à demander.
      Vérifier avec l'expert-comptable l'opportunité d'une option IR
      temporaire (5 ans) — rarement utile ici.
- [ ] Créer l'espace professionnel sur impots.gouv (déclarations de TVA,
      IS, CFE).
      Fait le : ______
- [ ] CFE : exonérée la première année civile, déclaration initiale 1447-C
      à déposer avant le 31 décembre de l'année de création.
      Fait le : ______
- [ ] URSSAF : la SASU sans rémunération ne cotise pas. Le jour où une
      rémunération est décidée, il faut un bulletin de paie (l'expert-comptable
      s'en charge) — compter environ 80 % de charges sur le net.

## Étape 3 — Banque et outils (Qonto)

- [ ] Activer sur Qonto : carte, module de facturation (numérotation continue,
      mentions obligatoires), accès comptable en lecture.
      Fait le : ______
- [ ] Renseigner le numéro de TVA et l'adresse de la société chez chaque
      prestataire : Supabase, Vercel, Resend, Apple Developer, registrar du
      domaine quantinvo.com, Expo si une offre payante est prise.
      Fait le : ______
- [ ] Stripe, quand le paiement sera branché (voir AGENTS.md, section
      « Paiement : Stripe à terme ») : le compte Stripe se crée au nom de la
      société, avec son SIREN et son IBAN Qonto.

## Étape 4 — Propriété de Quantinvo

- [ ] Déposer la marque « Quantinvo » à l'INPI au nom de Devkaylab SASU.
      Classes utiles : 9 (logiciels), 42 (SaaS, logiciels en ligne), éventuellement
      35 (gestion de stocks, services aux entreprises). Une classe coûte
      environ 190 €, chaque classe supplémentaire environ 40 €.
      Vérifier d'abord la disponibilité sur data.inpi.fr.
      Fait le : ______  Numéro : ______
- [x] **Numéro D-U-N-S de Devkaylab : `288196187`.** Il EXISTAIT DÉJÀ —
      D&B l'avait attribué sans qu'on demande rien, ce qui est courant pour une
      société française une fois immatriculée. Trouvé le 15 septembre 2026 par
      la recherche d'Apple (`developer.apple.com/enroll/duns-lookup/`).
      ⚠️ **Chercher AVANT de demander** : la demande annonce cinq jours ouvrés,
      la recherche répond tout de suite.

      ⚠️ **Ce n'est PAS un bloquant pour publier.** Apple l'écrit : « If you're
      enrolling as an individual, you don't need a D-U-N-S Number. » Le compte
      est Individuel, la 1.0 peut partir sans.

      Délais annoncés par Apple : jusqu'à **5 jours ouvrés** pour recevoir le
      numéro de D&B (l'accélérer ne sert à rien), puis jusqu'à **2 jours
      ouvrés** pour qu'Apple le reçoive. Donc le demander tôt ne coûte rien.

      Ce que le formulaire demande : région, **dénomination exacte du RCS**,
      adresse du siège, adresse postale, et les coordonnées professionnelles de
      la personne qui demande. Il est protégé par un CAPTCHA, et un
      représentant D&B peut rappeler : avoir l'extrait RCS sous la main.

      ⚠️ **Le piège de la SASU** : Apple refuse les dossiers que D&B a classés
      en *sole proprietorship* (« si votre statut est une entreprise
      individuelle, inscrivez-vous comme individu »). Une SASU **est** une
      société, pas une entreprise individuelle — mais « à associé unique » peut
      induire un classement faux. Saisir la dénomination telle qu'elle figure
      au RCS, et faire corriger le profil D&B si le classement est mauvais.

- [ ] Faire apparaître **Devkaylab** comme éditeur sur l'App Store. Deux
      routes, toutes deux derrière le D-U-N-S :
      1. **convertir** le compte Individuel en Organisation — demande au
         support Apple Developer, non documentée publiquement ;
      2. **ouvrir un second compte Organisation et transférer l'app** — bien
         documenté, mais ⚠️ **« The app must have at least one version that was
         released to the App Store »** : le transfert est impossible AVANT la
         publication. Il faut aussi un **second Apple Account** — le 15
         septembre 2026, s'inscrire comme société depuis le compte actuel est
         refusé : « Your Apple Account is already associated with the Account
         Holder of a membership ». Plus une seconde adhésion à 99 €/an le temps
         du recouvrement.

      ⚠️ **LA ROUTE 1 N'A PAS LA CONTRAINTE DE LA ROUTE 2**, et une note de ce
      fichier a dit le contraire pendant une heure le 15 septembre 2026 : « la
      1.0 sortira sous le nom de Julien quoi qu'il arrive » n'est vrai que du
      **transfert**. Une conversion ne transfère rien — l'app ne bouge pas de
      compte, donc elle n'a pas besoin d'avoir été publiée. Si la conversion
      aboutit avant la soumission, la 1.0 sort directement sous Devkaylab.

      **Et le calendrier le permet** : Android est à quinze jours minimum de sa
      mise en production (test fermé obligatoire, voir AGENTS.md « Le tour des
      consoles »). Cette attente est le budget de temps de la conversion.

      **Le chemin exact de la demande** (relevé le 15 septembre 2026) :
      `developer.apple.com/contact/` → *View topics* → **Membership and
      Account** → **Program Enrolment** → **Email**. Le formulaire ne demande
      qu'un message : le nom et l'Apple Account sont pré-remplis. Le téléphone
      existe aussi, aux heures ouvrées.

      Ce que le message doit porter : dénomination `DEVKAYLAB`, forme SASU,
      SIREN 109 680 389 (RCS Paris), siège 47 rue Vivienne 75002 Paris,
      **D-U-N-S 288196187**, le fait qu'on a l'autorité d'engager la société, le
      message d'erreur reçu, et que l'app n'étant pas publiée le transfert n'est
      pas une option.

      **Demande de conversion envoyée le 15 septembre 2026** par ce formulaire.
      Réponse attendue par courriel ; Apple n'annonce aucun délai pour ce cas.
      Reçue le : ______  Issue : ______
- [ ] Google Play : même logique, compte développeur au nom de la société
      (utile pour le build Android en backlog).
- [ ] Nom de domaine quantinvo.com : mettre la société comme titulaire
      (registrant) chez le registrar.
      Fait le : ______
- [ ] Dépôt GitHub devkaylab/Inventaire : préciser dans le README que le code
      appartient à Devkaylab SASU. Un acte d'apport ou de cession du logiciel
      de Julien vers la société, daté, sécurise la propriété (l'expert-comptable
      ou un juriste fournit le modèle ; à valoriser prudemment, cela a un
      effet fiscal).
      Fait le : ______

## Étape 5 — Assurances

- [ ] **RC professionnelle éditeur de logiciel** : pas obligatoire, mais une
      enseigne la demandera avant de signer, et un écart d'inventaire imputé à
      l'application est le sinistre type. Demander deux devis (assureurs
      spécialisés tech ou via le courtier partenaire de Qonto).
      Fait le : ______
- [ ] Cyber-risques : option à étudier une fois les premiers clients signés.

## Étape 6 — Site et documents contractuels

- [ ] Remplir `web/lib/legal.ts` : statut (« SASU au capital de … € »),
      responsable de la publication, adresse du siège, téléphone, SIREN, RCS,
      capital, numéro de TVA. La page `/mentions-legales` s'active et sort du
      `noindex` dès que les mentions requises sont là. Adresse et téléphone de
      Vercel à recopier depuis leurs informations légales publiées.
      Fait le : ______
- [ ] Mettre à jour `docs/privacy.html` : identité de l'éditeur (forme,
      SIREN, adresse) à la place de la seule mention « Devkaylab ».
      Fait le : ______
- [ ] Finaliser les **CGV B2B** à partir du brouillon
      `docs/entreprise/cgv-quantinvo-brouillon.md`, les faire relire, les
      publier sur le site et les lier depuis le devis.
      Fait le : ______
- [ ] Annexer les clauses de sous-traitance
      (`docs/conformite/sous-traitance-article-28.md`) aux CGV.
      Fait le : ______
- [ ] Modèle de devis et de facture avec les mentions obligatoires : identité
      complète, numéro continu, date, désignation (licence annuelle, nombre de
      magasins, tranche de volume), prix HT, TVA, TTC, échéance, pénalités de
      retard, indemnité forfaitaire de recouvrement de 40 €, conditions
      d'escompte.
      Fait le : ______

## Étape 7 — RGPD, ce qui reste

Déjà fait : politique de confidentialité, mention sous chaque formulaire,
registre des traitements, procédure de violation, export des données, durées
de conservation, journal d'administration.

- [ ] Faire relire par un juriste le registre et les clauses article 28
      (constat M5 du rapport d'audit).
      Fait le : ______
- [ ] Pas de DPO obligatoire à ce stade (pas de suivi à grande échelle, pas
      d'organisme public). À réévaluer si le volume de salariés suivis devient
      important.

## Étape 8 — Chaque année, ensuite

- Approbation des comptes et dépôt au greffe dans les 6 mois suivant la
  clôture (l'expert-comptable prépare, le président signe).
- Liasse fiscale IS, déclarations de TVA selon le régime choisi, CFE en
  décembre.
- Mise à jour de la politique de confidentialité et du registre si un
  prestataire change (les tests du dépôt le rappellent).
- Renouvellement de la marque tous les 10 ans, du domaine chaque année, de
  l'Apple Developer Program chaque année.

## Coûts de départ, ordre de grandeur

| Poste | Montant indicatif |
|---|---|
| Annonce légale | 150 à 200 € |
| Greffe et bénéficiaires effectifs | environ 60 € |
| Statuts (modèle ou parcours Qonto) | 0 à 300 € |
| Qonto, offre de base | environ 10 € HT / mois |
| Marque INPI, une classe | environ 190 € |
| Expert-comptable | 1 000 à 2 000 € / an |
| RC pro éditeur | 300 à 800 € / an |

Total de lancement réaliste : **600 à 1 000 €** hors honoraires annuels.


---

## Étape 5 — La migration du compte Apple (réponse du support, 21 septembre 2026)

Apple a répondu (**dossier n° 102964327628**, Sukkry, Developer Support) :
la migration Individuel → Organisation peut démarrer **quand on veut**, en
répondant à son message. Six conditions, dont une seule bloque aujourd'hui.

### ✅ RÉGLÉ : le WHOIS du domaine dit Devkaylab (21 septembre 2026)

Apple exige que « le nom de domaine soit associé à votre organisation ».
Relevé d'abord sur `quantinvo.com` :

```
Registrant Organization : Domain Protection Services, Inc.
Registrant Name         : Redacted For Privacy
Registrant Country      : US — Denver, Colorado
```

La protection de confidentialité masquait le titulaire : l'équipe de
vérification d'Apple aurait vu une société américaine d'anonymisation, pas une
SASU parisienne. Cause classique de dossier bloqué.

⚠️ **ET LE DOMAINE NE SE GÈRE PAS CHEZ NAME.COM.** Il a été acheté par
**Vercel**, qui n'est que revendeur ; Name.com est le registraire en coulisses.
Tout se passe donc dans **Vercel → Domains → `quantinvo.com` → Registrant
Information**, où vivent le titulaire ET l'interrupteur de confidentialité.
Aucun compte Name.com n'existe.

⚠️ **CE QUE LA FICHE CONTENAIT, ET QU'IL A FALLU CORRIGER AVANT DE PUBLIER** :
le champ `Company` disait déjà Devkaylab, mais l'adresse était le **domicile**
(2a rue Jacques Sébastien Clerambourg, appt 101, Saint-Germain-en-Laye) et le
téléphone un **portable personnel**. Couper la protection d'abord aurait publié
les deux. L'ordre compte : corriger, enregistrer, puis couper.

⚠️ **L'E-MAIL DU TITULAIRE N'A PAS ÉTÉ TOUCHÉ, EXPRÈS.** Vercel confirme
automatiquement quand c'est l'adresse du compte ; avec une autre, il faut
confirmer un lien, et **sans confirmation le domaine passe en `clientHold`** —
le site tombe. Pour un domaine de production, ça ne vaut pas le gain cosmétique.

- [x] **Titulaire corrigé et protection coupée**, dans cet ordre. Vérifié au
      registre dans la minute :

      ```
      Registrant Organization : Devkaylab
      Registrant Street       : 47 rue Vivienne
      Registrant City         : Paris — 75002 — FR
      Registrant Phone        : +33.688592765
      Registrant Email        : devkaylab@gmail.com
      ```

- [ ] **Aligner la fiche D&B sur le même numéro** (`+33 6 88 59 27 65`, la
      ligne pro) sur `iupdate.dnb.com` — le portail officiel pour consulter et
      corriger sa propre fiche. Apple compare WHOIS, fiche D&B et site ; les
      deux premiers sont d'accord, le troisième aussi (mentions légales).

### Ce qui est déjà bon

| Condition d'Apple | État |
|---|---|
| Site de l'organisation public | ✅ `www.quantinvo.com/mentions-legales` déclare Devkaylab, SASU, SIREN 109 680 389, 47 rue Vivienne — vérifié en ligne |
| Domaine associé à l'organisation | ✅ WHOIS public : `Registrant Organization: Devkaylab`, 47 rue Vivienne, Paris |
| Rapports de ventes perdus (point 5) | sans objet : rien de publié, rien à perdre |
| Revenus et compte bancaire (point 6) | sans objet : **aucun achat intégré**, aucune dépendance StoreKit. L'abonnement se vend sur le site par Stripe |

### Ce qu'il faut vérifier soi-même (demande une connexion)

- [ ] **Double authentification** active sur l'Apple Account du programme.
- [ ] **La fiche D&B**, sur `developer.apple.com/enroll/duns-lookup/`, doit
      coïncider avec l'immatriculation. Relevé public le 21 septembre 2026 :

      | | |
      |---|---|
      | Dénomination | **DEVKAYLAB** |
      | SIREN / SIRET siège | 109 680 389 / 109 680 389 000 11 |
      | Siège | 47 RUE VIVIENNE 75002 PARIS |
      | Catégorie juridique | **5710 — société par actions simplifiée** |
      | Activité | 62.01Z, programmation informatique |
      | Immatriculée le | 7 septembre 2026 |

      ⚠️ La catégorie **5710 est une société par actions**, pas une entreprise
      individuelle : c'est ce qui protège du refus décrit à l'étape 4
      (« Apple refuse les dossiers que D&B a classés en *sole
      proprietorship* »). Si D&B a classé autrement, le faire corriger AVANT.

      ⚠️ Et le **téléphone** de la fiche D&B : Apple peut appeler pour vérifier.
      Il doit être joignable et identifier Devkaylab — c'est la ligne déjà
      ouverte dans la liste des tâches (numéro perso → pro).

### ⚠️ LE CALENDRIER : APRÈS LA PUBLICATION, PAS PENDANT L'EXAMEN

Point 3 d'Apple : « The Certificates, Identifiers & Profiles portal is
unavailable during the migration process. »

**La 1.0 build 5 est en cours d'examen.** Si Apple rejette et demande une
correction pendant la migration, on ne peut plus signer de build — le portail
des certificats et profils est fermé. Bloqué au pire moment, sans recours.

⚠️ **ET IL N'Y A RIEN À GAGNER À SE PRESSER.** Le point 4 dit que la
dénomination est appliquée à **toutes** les apps distribuées, migration faite :
le nom du vendeur se corrige donc aussi bien après publication qu'avant. Seul
le **copyright**, qui est un champ par version, ne se corrige pas
rétroactivement — d'où la ligne « copyright Devkaylab à la prochaine version ».

**Ordre retenu** : les deux boutiques en ligne → on répond à Sukkry →
migration → copyright « Devkaylab » au build suivant.

### Les deux réponses à Sukkry, prêtes

**(A) Maintenant — une question qui lève la dernière inconnue.** Rien
n'oblige à attendre pour poser une question, et la réponse décide du
calendrier :

> Hello Sukkry,
>
> Thank you for the details — case 102964327628.
>
> Before we start, one question about timing. We currently have version 1.0
> (build 5) of our app **in review**, with automatic release once approved.
>
> If we begin the migration now and the review comes back with a request for a
> new build, we would be unable to sign it while the Certificates, Identifiers
> & Profiles portal is unavailable. Would you recommend waiting until the app
> has been released before starting the migration, or does the migration not
> affect an app that is already in review?
>
> For reference, our organization is Devkaylab (SASU), registered in Paris,
> France, D-U-N-S 288196187, and our organization website is
> https://www.quantinvo.com.
>
> Best regards,
> Julien Thiong-Kay

**(B) Plus tard — le feu vert**, quand les deux applis sont en ligne et que le
WHOIS affiche Devkaylab :

> Hello Sukkry,
>
> We are ready to start the migration of our individual membership to an
> organization membership — case 102964327628.
>
> We have reviewed the six points. To confirm:
>
> - Two-factor authentication is enabled on our Apple Account.
> - Our organization website is https://www.quantinvo.com, publicly available,
>   and the domain is registered to Devkaylab.
> - We understand the Certificates, Identifiers & Profiles portal will be
>   unavailable during the migration. We have no build in review and none
>   planned until it completes.
> - Our legal entity name is **Devkaylab**, a French SASU registered in Paris
>   (SIREN 109 680 389), D-U-N-S 288196187.
> - We distribute no paid apps and no in-app purchases, so there are no
>   pending earnings to route.
>
> Please proceed at your convenience.
>
> Best regards,
> Julien Thiong-Kay
