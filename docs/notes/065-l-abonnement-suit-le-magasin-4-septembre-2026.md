# ⚠️ L'abonnement suit le magasin (4 septembre 2026)

**Trouvé en vérifiant le premier paiement réel du libre-service.** Le magasin
était créé, au bon prix, avec sa facture — et
`companies.stripe_subscription_id` restait **nul**. La branche d'ajout de
`fulfil_paid_request` créait le magasin sans jamais enregistrer l'abonnement
que le paiement venait d'ouvrir.

Ce n'est pas cosmétique, et la seconde conséquence coûte de l'argent :

- **`sync_subscription_status` cherche l'abonnement sur `companies`** — impayé,
  résiliation et reprise passaient inaperçus pour ce magasin ;
- **`deposer_changement_offre` décide du chemin sur cet abonnement.** Nul, il
  aurait ouvert un **second abonnement** au premier changement d'offre, et le
  client aurait payé les deux offres — le trou même que ce garde-fou existe
  pour fermer.

⚠️ **ET IL SE NOTE PAR MAGASIN, PAS PAR ENTREPRISE.** Une entreprise peut en
porter plusieurs — un par magasin ajouté en libre-service. L'écrire seulement
sur l'entreprise ferait modifier **l'article du mauvais magasin** au premier
changement d'offre. L'entreprise garde le premier, celui de sa licence, et on
ne l'écrase jamais.

C'est la limite notée le 2 septembre — « un magasin ajouté en mensuel crée un
second abonnement que rien ne suit » — qui n'était plus une limite mais un
défaut, depuis que ce chemin est celui de tout le monde. Migration
`20260904270001`.

⚠️ **Le magasin d'essai payé ce jour-là n'a pas d'abonnement enregistré** : son
identifiant n'a jamais été écrit, et il ne se retrouve pas après coup. Sans
conséquence, il est supprimé — mais c'est le genre de trace qu'on ne rattrape
pas.

## ⚠️ `supabase db query --file` applique une migration sans la retaper

Découvert en voulant réappliquer `fulfil_paid_request` (180 lignes) : la console
MCP exige que le SQL passe **dans l'appel**, donc qu'il soit réémis en entier.
`supabase db query --file <fichier> --linked` l'exécute **depuis le disque**.

- Il faut `supabase link --project-ref …` une fois ; `--project-ref` seul est
  refusé (« use it with --linked »).
- ⚠️ **Vérifier que `link` n'a pas créé de `supabase/config.toml`** : le dépôt
  n'en a pas, et c'est ce qui fait que le CLI déploie avec `verify_jwt` **activé
  par défaut**. Contrôlé le 4 septembre — il n'écrit que `supabase/.temp/`, qui
  est ignoré par git. Si un `config.toml` apparaît un jour, les cinq fonctions
  publiques doivent y être déclarées avant tout déploiement.
- Le passage par ce chemin **n'inscrit rien dans l'historique de migrations**.
  Sans conséquence ici : `db push` est interdit sur ce projet (le dossier
  diverge de la base), et la parité se contrôle par MD5 sur les corps.
