# Quantinvo On-Demand — comptes, rôles et droits

*Document de conception, 20 septembre 2026. Rien de ce qui suit n'est construit.*
*Maquette du parcours client : https://claude.ai/artifact/BSqAQUPZ7tnjAfdswK35MV*

Couvre les points 3, 4, 25, 26, 40, 41 et 42 du plan On-Demand. Les autres
points structurels (prix, matching, score, économie, notifications, annulations)
font l'objet de documents séparés — voir « Ce qui reste » à la fin.

---

## 1. Ce que la base fait aujourd'hui, vérifié

Avant de proposer quoi que ce soit, l'état réel au 20 septembre 2026.

**L'authentification ne regarde déjà pas l'abonnement.** `web/lib/auth.ts`
(`homePathForRole`) lit `role`, `is_admin`, `is_company_admin` — rien d'autre.
Le point 41 du plan est donc à moitié acquis : rien à défaire, seulement à
prolonger.

**Un compte sans entreprise ni abonnement existe déjà.** C'est le prospect de
l'étape 3 du parcours d'inscription : « le compte existe, et il ne voit rien »
(`docs/notes/074`). Son profil est `employee`, `company_id` nul. Ce qui manque
n'est pas l'identité : c'est la couche qui dirait ce qu'un tel compte a le droit
de faire. Aujourd'hui, la réponse est « rien », et elle est implicite.

**La porte d'entrée est fermée sauf trois cas.** `handle_new_user` refuse toute
adresse sans invitation depuis le 13 août 2026, à l'exception d'une adresse dont
le code e-mail a été consommé il y a moins de quinze minutes. C'est là que le
parcours inventoriste devra se brancher — et c'est un endroit sensible.

**L'abonnement vit sur l'entreprise ET sur le magasin.**
`companies.license_status` et `companies.plan` d'un côté, `stores.devices`,
`stores.annual_price_cents` et `stores.stripe_subscription_id` de l'autre. Un
magasin porte son propre abonnement depuis le 4 septembre (`docs/notes/065`).

**Le verrou d'usage est le nombre d'appareils simultanés par magasin.**
`plafond_appareils(store_id)` dérive de `stores.devices`, à défaut de
`companies.plan`. ⚠️ **Quand elle rend `null`, `reclamer_appareil` ne refuse
plus rien** (`if not v_deja and v_plafond is not null`). Un magasin sans offre
connue est donc illimité.

**Une personne d'une autre entreprise ne peut pas rejoindre un inventaire.**
`invite-to-session` renvoie `other_company` (`docs/notes/018`), et l'appartenance
se déduit partout de `profiles.company_id`.

---

## 2. Les trois murs, et ce qu'ils imposent

### Mur 1 — l'appartenance se déduit d'une seule colonne

Un inventoriste est par construction extérieur à l'entreprise du client. Les
droits d'accès aux inventaires, zones, comptages et articles passent par
`profiles.company_id`. **`MISSION_ACCESS` n'est donc pas un droit de plus :
c'est une deuxième source d'appartenance**, à faire passer dans chaque policy
et dans les fonctions qui contrôlent l'accès.

C'est le gros du travail, et c'est invisible à la maquette.

### Mur 2 — le plafond d'appareils s'ouvre en grand

Une mission à six inventoristes, c'est six appareils simultanés dans un magasin
dont le client n'a aucun abonnement. Deux façons de se tromper :

- laisser `plafond_appareils` rendre `null` → **le magasin devient illimité**,
  et le client peut compter lui-même, gratuitement, pour toujours ;
- appliquer le plafond de l'offre → **la mission est refusée** au septième
  appareil.

Ce qu'il faut : **un plafond porté par la mission**, valable pendant sa fenêtre
et nul en dehors. `plafond_appareils` devient « le plus élevé de : le plafond
d'abonnement du magasin, et le plafond de la mission en cours sur ce magasin ».
Et le cas `null` doit cesser d'être permissif — c'est un défaut ouvert
aujourd'hui, indépendamment d'On-Demand.

### Mur 3 — le prix ne peut pas venir du client

Règle déjà posée pour l'inscription : `finaliser_inscription` est appelée avec
le jeton du prospect et appelle `prix_offre` en base, « lui laisser porter un
montant le laisserait s'inscrire à un centime » (`docs/notes/074`). Le moteur de
prix On-Demand suit la même règle : **le navigateur affiche, le serveur
calcule et verrouille**.

---

## 3. Identité, appartenance, droits : trois choses distinctes

| Objet | Répond à | Où il vit |
| --- | --- | --- |
| **Compte** | Qui est cette personne ? | `auth.users` + `profiles` |
| **Entreprise** | Pour qui travaille-t-elle ? | `companies`, `profiles.company_id` |
| **Rôle** | Que fait-elle dans cette entreprise ? | `profiles.role`, `is_company_admin` |
| **Droit produit** | À quoi son entreprise a-t-elle accès ? | `entitlements` *(neuf)* |
| **Profil inventoriste** | Peut-elle réaliser des missions ? | `provider_profiles` *(neuf)* |
| **Accès mission** | Peut-elle toucher CET inventaire, maintenant ? | `mission_access` *(neuf)* |

**La règle qui ne se négocie pas : l'authentification répond « qui », jamais
« a le droit de ». Un compte se crée sans rien acheter, et ne voit rien de
plus.**

### `entitlements` — ce qu'une entreprise a le droit de faire

Une ligne par produit ouvert, portée par l'entreprise et non par la personne :

```
entitlements(company_id, produit, etat, source, ouvert_le, ferme_le)
  produit : 'os' | 'on_demand'
  etat    : 'actif' | 'suspendu' | 'ferme'
  source  : 'abonnement' | 'libre' | 'admin'
```

`on_demand` est ouvert **à la création de l'entreprise**, sans contrepartie :
c'est ce qui rend le compte gratuit et le point 41 vrai. `os` n'est ouvert que
par un abonnement payé, et se ferme avec lui. `license_status` reste la source
de vérité côté Stripe ; `entitlements` est la lecture que le produit en fait.

⚠️ **Ne pas déduire le droit On-Demand de l'absence d'abonnement OS.** Une
entreprise suspendue pour fraude doit pouvoir perdre On-Demand sans perdre OS,
et l'inverse.

### `provider_profiles` — l'inventoriste

```
provider_profiles(user_id, etat, niveau, siret, forme_juridique,
                  experience_annees, secteurs[], langues[],
                  mobilite, rayon_km, verifie_le)
  etat   : 'incomplet' | 'en_revue' | 'verifie' | 'actif' | 'suspendu' | 'refuse'
  niveau : 'nouveau' | 'confirme' | 'expert' | 'chef_d_equipe'
```

⚠️ **Un inventoriste n'a pas de `company_id`.** Le rattacher à une entreprise
factice « Quantinvo » serait commode et faux : il hériterait des droits de cette
entreprise sur ses inventaires. Son `company_id` reste nul, et c'est
`mission_access` qui lui ouvre une porte, une mission à la fois.

### `mission_access` — le droit temporaire

```
mission_access(mission_id, user_id, inventory_session_id, role, expire_le)
  role : 'counter' | 'team_leader'
```

Trois propriétés à ne pas défaire :

1. **Il expire**, et l'expiration est lue à chaque vérification, jamais
   présumée par un travail de fond.
2. **Il ne porte que sur l'inventaire de la mission.** Pas sur le magasin, pas
   sur l'entreprise, pas sur les autres inventaires du même magasin.
3. **Il ne rend pas abonné.** Rien dans ce chemin ne doit écrire dans
   `companies`, `entitlements` ou `stores`.

---

## 4. Ce que ça change dans les règles d'accès

Partout où une policy dit aujourd'hui « la ligne appartient à mon entreprise »,
elle devra dire « … ou un accès mission non expiré me l'ouvre ».

```sql
-- la forme, pas le code définitif
create or replace function public.peut_voir_inventaire(p_session uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (                        -- appartenance d'entreprise
    select 1 from public.inventory_sessions s
      join public.stores st on st.id = s.store_id
      join public.profiles p on p.id = auth.uid()
     where s.id = p_session and p.company_id = st.company_id)
      or exists (                        -- accès mission, non expiré
    select 1 from public.mission_access m
     where m.inventory_session_id = p_session
       and m.user_id = auth.uid()
       and m.expire_le > now());
$$;
```

⚠️ **La garde se pose sur la ligne visée, jamais sur un paramètre de
l'appelant.** C'est la règle déjà écrite dans `AGENTS.md`, et elle vaut
doublement ici : `mission_access` est un droit qu'un attaquant aurait intérêt à
se fabriquer.

⚠️ **`invite-to-session` doit continuer de refuser `other_company`.** Le chemin
inventoriste ne passe pas par une invitation : c'est Quantinvo qui affecte, et
l'affectation crée le `mission_access`. Deux chemins, deux règles — ne pas
assouplir le premier pour faire passer le second.

---

## 5. La mission, de bout en bout (point 15)

```
BROUILLON → PRIX_CALCULE → PAIEMENT_AUTORISE → CONFIRMEE
   → EN_CONSTITUTION → EQUIPE_COMPLETE → PRETE
   → EN_COURS → CONTROLE_QUALITE → TERMINEE
   → PAIEMENT_PRESTATAIRES → PAYEE

Ailleurs : ANNULEE · REMBOURSEE · LITIGE · ECHOUEE
```

Deux ancrages qui ne sont pas cosmétiques :

- **`PAIEMENT_AUTORISE` avant `CONFIRMEE`** : l'empreinte bancaire est prise à
  la réservation, le débit à `TERMINEE`. C'est ce qui rend les frais
  d'annulation (point 34) exécutables sans avoir à réclamer de l'argent après
  coup.
- **`CONFIRMEE` ne dépend pas de l'équipe.** Le client est confirmé avant que le
  premier inventoriste ait accepté ; constituer l'équipe est notre problème,
  pas le sien (point 16). `EN_CONSTITUTION` est un état interne que le client
  voit comme « nous constituons votre équipe ».

Le passage à `EN_COURS` est le moment où les `mission_access` s'ouvrent ; le
passage à `TERMINEE` est le moment où ils se ferment. Un seul endroit doit les
créer et les fermer.

---

## 6. Où chacun atterrit après connexion (point 42)

`homePathForRole` s'étend. L'ordre compte, du plus spécifique au plus général :

1. `is_admin` → `/admin`
2. profil inventoriste actif → `/app/provider`
3. deux produits ouverts → **le sélecteur**, sauf si la personne a mémorisé son
   choix
4. `is_company_admin` → `/entreprise`
5. `role = 'supervisor'` → `/dashboard`
6. sinon → `/account`

⚠️ **Le sélecteur n'est pas une page de plus dans tous les cas** : il ne
s'affiche que si l'entreprise a réellement les deux. Sinon il fait payer à tout
le monde un choix que presque personne n'a à faire.

---

## 7. Ce que Quantinvo fait déjà — à réutiliser, pas à refaire

Vérifié dans le dépôt et les documents de conformité le 20 septembre 2026.

### Le paiement est déjà branché

- **Un seul webhook**, `supabase/functions/stripe-webhook`, déployé en
  `verify_jwt: false` : Stripe n'envoie pas de jeton, **c'est la signature qui
  garde la porte**. Il traite aujourd'hui `checkout.session.completed`,
  `invoice.paid`, `invoice.payment_failed`,
  `customer.subscription.deleted`.
- **L'idempotence existe** : `stripe_events_traites` reçoit l'`event_id` avant
  tout travail, et `purge_expired_data()` la vide. Les événements On-Demand
  passent par **la même table** — ne pas en créer une seconde.
- **Le client Stripe existe déjà** (`companies.stripe_customer_id`). Une
  mission réutilise ce client ; en ouvrir un second dédoublerait la facturation
  d'une même entreprise.
- **Le montant vient de la base**, jamais du navigateur (`prix_offre`,
  `finaliser_inscription`). Même règle pour le prix d'une mission.

⚠️ **Connect n'est pas une extension du webhook actuel.** Les événements de
compte connecté (`account.updated`, `capability.updated`, `payout.*`,
`transfer.*`) arrivent sur un **autre endpoint** et parfois au nom d'un autre
compte. Deuxième fonction edge, même table d'idempotence, et la clé restreinte
devra gagner la permission Connect — comme elle doit déjà gagner
**Subscriptions** avant le passage en live.

### Les données personnelles ont déjà un cadre

- Le registre (`docs/conformite/registre-des-traitements.md`) tient huit
  traitements et pose la répartition : Devkaylab est **responsable** pour la
  relation client, **sous-traitant** pour les données d'inventaire, dont
  l'entreprise cliente est responsable.
- `export_my_data()` rend à une personne authentifiée tout ce qui est rattaché
  à son compte, sans aucun code d'accès. `purge_expired_data()` applique les
  durées de conservation. `admin_audit_log` garde un an les actions
  d'administration.

⚠️ **Pour un inventoriste, Devkaylab est responsable de traitement, pas
sous-traitant** : il n'y a pas d'employeur derrière lui. C'est un régime plus
lourd que celui des données d'inventaire, et il demande **deux entrées neuves
au registre** — profils d'inventoristes, puis missions et rémunérations — avec
leurs durées. `export_my_data()` devra rendre aussi le profil, les missions et
les paiements.

⚠️ **LES DEUX DOCUMENTS INTERNES DE CONFORMITÉ N'ONT PAS SUIVI LA POLITIQUE
PUBLIQUE, AU SUJET DE STRIPE.** Vérifié le 20 septembre :

- `docs/privacy.html` — la politique servie au public — **déclare bien
  Stripe** dans son tableau de sous-traitants, et dit que les coordonnées
  bancaires sont saisies directement chez lui. Une garde le vérifie
  (`web/tests/confidentialite.test.ts`, qui exige Supabase, Vercel, Resend,
  Expo et Stripe) ;
- `docs/conformite/registre-des-traitements.md` (article 30) et
  `docs/conformite/sous-traitance-article-28.md` **ne le mentionnent nulle
  part**.

Le client est donc correctement informé ; ce sont les documents internes qui
sont en retard sur la réalité. C'est une mise à jour, pas un défaut
d'information — mais le registre de l'article 30 doit être exact, et Connect
va lui confier bien davantage : identité et compte bancaire des inventoristes.
À reprendre en même temps que les deux entrées neuves ci-dessus.

⚠️ **Un score qui écarte automatiquement quelqu'un d'une mission est une
décision automatisée** (article 22 du RGPD) : il faut pouvoir l'expliquer et
permettre une intervention humaine. À traiter dans le document du matching, pas
après.

### La sécurité a une méthode, et un motif de défaut qui revient

- **La garde se pose sur la ligne visée, jamais sur le rôle de l'appelant.**
  C'est le constat du 8 septembre (`ensure_zone`, `set_zone_status`) et la
  quatrième occurrence du même motif sur ce projet. `mission_access` est
  exactement le genre de droit qu'on aura envie de vérifier « par rôle » : ne
  pas le faire.
- **Une fonction qui ouvre trop et que personne n'appelle se retire, elle ne se
  garde pas.**
- **Un canal temps réel est `private: true` avec sa policy** — un canal public
  ne consulte aucune autorisation, la RLS ne rattrape rien. Le suivi live d'une
  mission en ajoute un.
- **Pas d'oracle d'énumération** : l'inscription d'un inventoriste doit répondre
  la même chose pour une adresse connue et une adresse inconnue, et compter les
  tentatives **avant** de chercher (`submission_attempts`, `codes_email`).
- **Quatre fonctions seulement sont ouvertes à `anon`**, et c'est mesuré à
  chaque revue. En ajouter une est une décision, pas un détail.
- **Toute fonction `admin_*` journalise dans la même transaction** que son
  action, avec son test de garde. Le back-office On-Demand (affecter un
  inventoriste, valider une mission, déclencher un payout) en est plein.
- La double authentification existe déjà (`web/lib/mfa.ts`) : un administrateur
  qui déclenche des versements devrait l'avoir obligatoire.

---

## 8. Ce qui reste à écrire

- **Le moteur de prix** (points 11, 13, 38) — variables, verrouillage, borne de
  recalcul, paramètres réglables sans toucher au code.
- **Le matching et le score** (points 21, 22, 23, 35) — critères, remplacement,
  ce qui se mesure et ce qui ne se mesure pas.
- **L'économie** (point 39) — GMV, payouts, take rate, et **le point dur :
  Julien est en franchise en base de TVA ; si le GMV transite par Devkaylab,
  la franchise saute dès les premiers mois.** À trancher avec le comptable
  avant d'écrire une ligne de code de paiement.
- **Le statut des inventoristes** — décidé le 20 septembre : indépendants payés
  par Quantinvo, donc Stripe Connect.

  ⚠️ **QUANTINVO NE STOCKE AUCUNE COORDONNÉE BANCAIRE, ET AUCUN PAPIER
  D'IDENTITÉ.** Avec Connect, c'est Stripe qui collecte l'IBAN et vérifie
  l'identité — il y est obligé en tant qu'établissement de paiement. La base
  garde `stripe_account_id`, et lit l'état que Stripe rend
  (`payouts_enabled`) ; elle ne le recopie pas et ne le décide pas. Le tableau
  de vérification côté inventoriste est donc en deux familles : ce que
  Quantinvo relit (téléphone, e-mail, expérience) et ce que Stripe contrôle
  (identité, SIRET, compte bancaire). Poser un champ IBAN dans notre base
  serait un risque gratuit : rien dans le produit n'a besoin de le lire. ⚠️ Une équipe encadrée par un chef
  d'équipe qui attribue les zones et contrôle le travail est la définition du
  lien de subordination : le montage contractuel doit être une prestation de
  résultat, pas une fourniture d'heures. À faire valider juridiquement.
- **Les notifications** (point 43) et **les annulations** (points 34, 35).
- **Le découpage en phases** (points 46 à 48).
