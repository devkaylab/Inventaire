# Renommer un magasin, renommer une entreprise (23 août 2026)

*« Les comptes admin doivent pouvoir renommer un magasin et entreprise. »*
Rien ne le permettait : un nom saisi de travers au moment du devis, ou une
enseigne qui change, obligeait à **supprimer et recréer** — c'est-à-dire à
perdre les inventaires du magasin.

Migration `20260823140001`, quatre fonctions, **deux par autorité** : les deux
ont de bonnes raisons de renommer. Quantinvo corrige ce qu'il a saisi
(`admin_rename_company`, `admin_rename_store`, journal `admin_audit_log`),
l'entreprise cliente porte son propre nom (`ca_rename_company`,
`ca_rename_store`, journal `company_audit_log`).

- **⚠️ Renommer ne touche à rien d'autre.** Code d'accès, licence, inventaires
  et comptages sont attachés à l'identifiant, jamais au nom. Les documents déjà
  émis — devis, factures Stripe — gardent le nom qu'ils portaient : ce sont des
  pièces datées, elles ne se réécrivent pas.
- **`nom_propre(text)`** détoure, refuse le vide et borne à 80 caractères. Une
  seule définition pour les quatre fonctions.
- **⚠️ La garde du client porte sur l'entreprise DU MAGASIN**, jamais sur un
  paramètre de l'appelant — sinon on renomme le magasin d'un autre client.
  Même règle que `ca_store_detail`.
- **Deux magasins d'une même entreprise ne portent pas le même nom** (comparé
  en minuscules) : ils ne se distingueraient plus, ni dans une liste ni dans un
  devis. Même règle qu'à l'ajout.
- **Le même nom deux fois répond `already: true`**, pas une erreur.
- **Le journal garde le nom d'avant** (`details.avant`) : « renommé en X » sans
  le nom précédent ne dit pas ce qu'on a perdu.

Côté écran, `components/ui/Renommer.tsx`, le même geste aux quatre endroits :
un lien « Renommer » à côté du nom, qui devient un champ sur place, avec
Entrée pour valider et Échap pour annuler. **Pas de modale** — on renomme ce
qu'on a sous les yeux, et c'est réversible d'un second renommage. Un refus du
serveur (doublon, nom vide) **reste sous le champ** le temps qu'on corrige,
plutôt que dans une notification qui s'efface.

Les quatre points d'entrée : la fiche entreprise de la console (titre + chaque
magasin), la fiche d'un magasin côté client, et le tableau de bord de
l'entreprise pour son nom.

⚠️ **Le garde-fou du journal balayait la mauvaise migration.** Il ne lisait
que `20260818000003_journal_actions_admin.sql` : une fonction `admin_*` écrite
plus tard vivait dans son propre fichier et passait sans trace. Il balaie
maintenant **toutes** les migrations.

Vérifié en base, en transactions annulées : nom vide refusé, nom trop long
borné, magasin d'une autre entreprise refusé, administrateur Quantinvo refusé
sur les fonctions client, et les deux renommages réels avec le journal portant
le nom d'avant. À l'écran (route jetable, retirée) en clair et en sombre : le
lien, le champ présélectionné, le refus sous le champ.

Tests de garde : `web/tests/admin-entreprise.test.ts` et
`web/tests/journal-admin.test.ts`.
