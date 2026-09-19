# Revue de sécurité d'avant publication (8 septembre 2026)

*« Avant de publier l'app, je veux qu'on vérifie une dernière fois la sécurité. »*
Troisième passage après ceux du 28 août (parcours de l'argent, puis backend).
Même méthode, et c'est elle qui compte : **par MOTIF de défaut, sur la BASE
RÉELLE** (`pg_get_functiondef`, `pg_policies`), jamais sur `supabase/migrations/`.

Périmètre : tout ce qui s'est ajouté depuis le 28 août — l'auto-inscription
**rouverte** le 5 septembre, le libre-service Stripe, le décompte d'appareils,
le rapport magasin, la pagination, l'archivage, et l'ouverture de
`vider_balise` aux compteurs la veille. Chiffres du jour : 201 fonctions
(192 en `SECURITY DEFINER`), 4 ouvertes à `anon`, 37 policies, 33 tables toutes
sous RLS, 6 déclencheurs.

## ⚠️ UN CONSTAT — `ensure_zone` et `set_zone_status` (`20260908130001`)

**Garde sur le RÔLE, pas sur la ligne visée.** Les deux vérifient
`get_my_role() = 'supervisor'` **OU** l'appartenance à la session : la première
branche suffit, et elle est vraie pour un superviseur de n'importe quelle
entreprise.

**Prouvé en direct, en transaction annulée** : une superviseure de Maison
Oberlin a créé une balise dans un inventaire du Groupe Bon Marché, et changé le
statut d'une zone du même inventaire.

- **Leurs sœurs `generate_zones` et `register_balise`, écrites le même jour,
  bornent bien sur `created_by = auth.uid()`.** C'est l'asymétrie entre
  fonctions voisines, quatrième occurrence sur ce projet.
- **⚠️ Le correctif est un RETRAIT, pas un garde-fou** — règle de
  `get_company_directory` : une fonction que personne n'appelle et qui ouvre
  trop n'a pas besoin d'un contrôle, elle a besoin d'être injoignable. Vérifié
  dans les trois directions avant d'écrire : aucun appel dans `src/`, dans
  `web/`, dans `supabase/functions/`, ni dans aucune fonction SQL.
- **Gravité réelle : faible.** Il fallait être un client connecté ET connaître
  l'identifiant interne d'un inventaire qui n'est pas le sien — que rien ne lui
  montre. Aucune lecture de données, aucune destruction.
- Les objets restent, seuls les droits partent ; `service_role` les garde.

## Ce qui a été balayé et qui TIENT

Dit explicitement, parce qu'une absence de constat ne vaut que si on sait ce qui
a été regardé. Tout est mesuré, rien n'est déduit :

- **les 4 fonctions ouvertes à `anon` sont exactement les 4 voulues** (parcours
  de devis public + formulaire d'inscription) ;
- **l'auto-inscription ne fuit pas** : un compte authentifié sans entreprise
  voit **zéro** magasin, entreprise, inventaire, comptage, article, profil,
  zone et demande — et se fait refuser `vider_balise`, `annuler_balise`,
  `prendre_place_appareil` et le rapport magasin. Les deux tables du parcours
  (`codes_email`, `inscriptions`) sont sous RLS sans aucun accès client, et
  cinq de ses huit fonctions sont réservées à `service_role` ;
- **un superviseur d'une autre entreprise est refusé partout ailleurs** :
  `vider_balise`, `set_balise`, `etat_import`, `get_balise_detail`, et il ne
  voit que ses propres inventaires ;
- **les fonctions d'argent récentes gardent sur la LIGNE visée**, jamais sur un
  paramètre de l'appelant (`deposer_changement_offre` sur l'entreprise du
  magasin, `changer_rythme_demande` sur celle de la demande), et elles posent
  leur garde **avant** toute écriture ;
- **`prix_offre` ne lit ni n'écrit rien** — c'est ce qui permet de l'ouvrir ;
- **les verrous anti-course sont là où il faut** (`fulfil_paid_request`,
  `appliquer_changement_offre`, `prendre_place_appareil`, `admin_fulfil_*`), et
  `finaliser_inscription` refuse un second dépôt ;
- **les quatre invariants portés par un déclencheur ne se contournent pas par
  un autre verbe** : pas de policy DELETE sur `inventory_sessions` ni sur
  `profiles`, et l'INSERT de `team_invitations` est contraint à
  `role = 'employee'` — VR-003 et VR-008 restent fermés ;
- **73 fonctions d'écriture ouvertes à `authenticated`, toutes gardées** — les
  trois qui semblaient nues ne le sont pas (`get_my_role()`, que la première
  requête ne cherchait pas), et l'ancienne signature de `ca_request_store` ne
  fait que rendre un refus lisible.

⚠️ **UNE FAUSSE ALERTE, ET LA LEÇON VAUT POUR LA PROCHAINE FOIS.**
`sessions_supervisor_update` a paru avoir perdu la garde du 21 août : elle
était dans le **`USING`**, et ma requête n'affichait que le `WITH CHECK`. Sur
une policy UPDATE, **les deux clauses se lisent, jamais l'une seule** — le
`USING` regarde la ligne AVANT, le `WITH CHECK` la ligne APRÈS.

## Deux observations, sans correctif

- **`article_audit` est en `ALL` pour un superviseur participant** : un invité
  peut effacer les lignes d'audit d'un inventaire, donc les **arbitrages**
  (`final_qty`). Les chiffres, eux, se reconstruisent — la table est dérivée de
  `counts`. C'est le pendant de VR-007 sur l'autre table.
- **Le `WITH CHECK` de `sessions_supervisor_update` n'exige pas
  `is_assigned_store`** alors que l'INSERT si : un superviseur pourrait déplacer
  un inventaire vers un magasin de son entreprise qu'il ne supervise pas.
  **Non exploitable aujourd'hui** — mesuré : aucun compte n'a cette
  configuration.

Tests de garde : `web/tests/backend-durcissement.test.ts`.
