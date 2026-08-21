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
tarifaire (1 200 à 5 400 € HT par an et par magasin) vise des enseignes qui
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
- [ ] Passer le compte Apple Developer en compte **Organisation** (il faut un
      numéro D-U-N-S, gratuit, obtenu depuis le SIREN en une à deux semaines).
      Le transfert d'app d'un compte individuel vers l'organisation se fait
      depuis App Store Connect.
      Fait le : ______
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
