# ⚠️ L'offre Solo — décidée, PAS ENCORE CONSTRUITE (27 août 2026)

Question de Julien : le modèle à trois profils sert les grandes structures,
comment le simplifier pour la boutique de quartier tenue par une seule
personne ? L'exploration a d'abord établi que **le modèle en base marche déjà
par construction** : un compte est à la fois admin d'entreprise + superviseur
(drapeau `is_company_admin`, `role = 'supervisor'`), affecté à son magasin par
le trigger `sync_company_admin_stores`, et il compte lui-même
(`counts_insert_supervisor`, boutons « Compter / Auditer des articles » sur la
fiche). `create_session` n'exige aucun membre. **Aucun 4e rôle n'est donc
prévu, jamais** — ce qui manque est commercial et d'interface.

Décision de Julien : une **offre Solo** — abonnement mensuel ou annuel, achat
en libre-service — construite pour qu'une grande structure n'ait aucun intérêt
à la prendre : *« acheter un coca à l'unité revient plus cher que d'acheter un
pack »*. Rien de tout cela n'existe dans le code ni en base à ce jour ; le
plan détaillé a été validé sur son principe le 27 août 2026, la mise en œuvre
est **explicitement reportée**. Ne rien construire sans que Julien relance le
sujet.

Ce qui est arrêté, à reprendre tel quel le jour venu :

- **Prix** : 49 €/mois ou 490 €/an HT, plafond 2 000 unités — chiffres à
  **revalider par Julien** avant construction. La règle « coca » impose que le
  prix par unité de stock reste ≥ à la tranche Boutique (0,245 et 0,294 €/u/an
  contre 0,21) ; un test de garde devra encoder cette inégalité.
- **Trois verrous cumulés**, le prix seul ne suffisant pas : le prix à
  l'unité ; les verrous structurels (**1 magasin** — `ca_request_store`
  refuse —, **1 utilisateur** — la policy INSERT de `team_invitations` refuse
  pour une entreprise solo, point unique qui couvre les deux edges et l'app,
  avec un `code: 'solo_plan'` sur le modèle d'`other_company`) ; et le
  plafond ci-dessous.
- **⚠️ Le plafond se mesure sur les pièces comptées, agrégées sur 30 jours
  glissants — jamais à l'import ni par inventaire.** Constat de Julien sur la
  première proposition : un client découperait son stock en plusieurs petits
  inventaires pour rester sous un plafond par fichier. Découper 10 000 pièces
  en cinq sessions de 2 000 ne réduit pas le total compté. Seuil prévu : 2 ×
  le plafond de stock sur 30 j ; au-delà, **seule la création d'un nouvel
  inventaire est refusée** — on ne bloque jamais un comptage en cours ni la
  lecture des rapports. Dépassement signalé au client (bandeau d'upgrade) et
  remonté dans `admin_pipeline` : c'est du revenu qui attend.
- **Le plan est commercial, porté par l'entreprise** : `companies.plan`
  (`standard` par défaut / `solo`) + `license_status`, écrits par le seul
  `service_role`. L'interface s'allège sur ce fait, pas sur une heuristique
  « équipe vide » : bandeau à 2 étapes, tunnel sans `invite?from=new`, écrans
  d'équipe retirés (app et site) pour un plan solo.
- **Stripe en mode abonnement** : deux Prices récurrents posés en secrets
  (jamais créés à la volée), `checkout.session.completed` →
  `fulfil_solo_subscription` (miroir de `fulfil_paid_request`, `service_role`
  seul), `invoice.payment_failed` / `invoice.paid` /
  `customer.subscription.deleted` pour le cycle de vie. Mêmes règles que le
  webhook actuel : signature seule porte, rejeu `already`, 200 sur l'ignoré.
- **Achat par une page publique `/solo`** hors `AppShell` (elle s'ouvre au
  téléphone), edge `subscribe-solo` sans JWT avec `rate_limit_ok`, demande
  enregistrée dans `company_requests` (marqueur de plan) pour réutiliser
  pipeline et purge. Premier prix affiché sur le site public — assumé pour
  Solo seulement, la grille standard reste sur devis.
- **La bascule Solo → grille standard** est le parcours devis existant,
  résiliation de l'abonnement à l'encaissement. Pas de prorata au premier
  jet. Les CGV devront porter la clause de dépassement.

**Un défaut réel à corriger indépendamment de l'offre**, trouvé par la même
exploration : le bandeau de démarrage se fige à jamais sur « Constituer mon
équipe · 2 sur 3 » pour tout admin qui démarre sans compteur —
`my_team_by_store` ne compte que les `role = 'employee'`, donc
`equipeConstituee` reste faux et l'étape 3 n'est jamais atteinte. Correctif
retenu : l'étape équipe se coche **aussi** sur le premier inventaire créé
(`faite: equipeConstituee || inventaireCree` dans `etapesDemarrage`) — créer
son inventaire répond à la question de l'équipe, et le bandeau s'efface alors
de lui-même. Mettre à jour le test du bandeau dans le même commit.
