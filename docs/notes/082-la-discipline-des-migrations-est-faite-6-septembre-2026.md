# La discipline des migrations est faite (6 septembre 2026)

*« Ok alors vas-y commence et termine la discipline. »* Les neuf objets sans
migration relevés le 4 septembre sont écrits : migration
`20260906120001_socle_des_premiers_jours.sql`, mesure `scripts/mesurer-migrations.mjs`,
gardes `web/tests/discipline-migrations.test.ts`.

| | avant | après |
|---|---|---|
| Fonctions en base sans migration | 6 | **0** sur 198 |
| Tables en base sans migration | 3 | **0** sur 33 |
| Corps divergents du dépôt | 0 | **0** |

## ⚠️ CE FICHIER DÉCLARE L'EXISTANT, IL NE REJOUE RIEN

C'est la décision qui gouverne tout le reste, et elle repose sur une mesure :
**le dossier n'est pas rejouable de zéro, et ce rattrapage n'y change rien.**
`20260806000001_store_supervisors.sql` crée une policy `using (public.is_admin())`
alors qu'`is_admin()` n'est défini que le 19 août (`20260819123621`) — une policy
valide son expression à la création, donc un rejeu s'arrête là, quoi qu'on fasse
des neuf orphelins. Chercher un ordre parfait pour eux, c'était poursuivre une
propriété que le dossier n'a pas.

Le gain est ailleurs, et il est concret : **plus aucun objet de la base n'est
invisible au dépôt**. `derniereDefinition()` répond enfin pour ces six fonctions
— une garde posée sur `request_account_deletion` cherchait dans le vide, et rien
ne le disait. C'est la famille des gardes périmées qui revient depuis des
semaines, par une porte de plus.

Conséquence : les trois tables sont déclarées dans leur forme **d'aujourd'hui**,
colonnes tardives comprises. C'est ce que la base porte, et c'est ce qu'il faut
pour la rebâtir sans archéologie. Les morceaux qu'une autre migration possède
déjà (le code magasin, les colonnes de prix, le déclencheur des administrateurs)
sont nommés en commentaire — ils ne sont là que pour la complétude.

**La règle du projet ne change pas** : on applique par la console ou par
`supabase db query --file`, JAMAIS par `db push`.

## ⚠️ CHAQUE TABLE EST SOUS UNE GARDE D'ABSENCE, ET CE N'EST PAS COSMÉTIQUE

Le bloc `if to_regclass('public.stores') is null then …` porte la table, ses
contraintes, ses index, sa RLS, ses policies **et ses droits**. Sans lui, le
`grant all on table public.stores` qu'il contient RÉ-OUVRIRAIT le magasin en
écriture à `authenticated` sur la production — le trou exact que VR-009 a fermé
le 28 août 2026. Un test refuse qu'on retire l'une des trois gardes.

Les six fonctions, elles, sont en `create or replace` nu — il faut que le texte
soit lisible dans le fichier pour que `derniereDefinition()` le trouve —, donc
**chacune repose ses droits juste après** (`revoke … from public, anon` puis
`grant execute … to authenticated, service_role`). `create or replace` rend
EXECUTE à PUBLIC : leçon de `20260819172706`, et constat n°6 du 28 août.

## Ce qui a été vérifié, et comment

**Empreinte du catalogue avant / pendant / après** — 198 fonctions (MD5 de
`pg_get_functiondef` et ACL), 281 colonnes, 123 contraintes, 71 index,
37 policies, 5 déclencheurs, 33 tables sous RLS, 853 droits de table et
4 121 droits de colonne. La migration a d'abord été jouée **en transaction
annulée** avec l'empreinte relue à l'intérieur, puis appliquée pour de vrai :
**les neuf mesures sont identiques dans les trois états**. Zéro ligne de
catalogue modifiée.

⚠️ **`supabase db query --file` tient une transaction d'un bout à l'autre du
fichier** (vérifié sur un cas jetable), et rend les lignes du dernier `select`.
C'est ce qui permet le contrôle « appliquer sans appliquer » : `begin;` + la
migration + la requête d'empreinte + `rollback;` dans un seul fichier.

## La mesure se relance en une commande

```bash
node scripts/mesurer-migrations.mjs
```

Elle interroge la base, compare au dossier, et **sort en erreur au premier
écart**. Retirer le rattrapage lui fait rendre exactement les neuf objets
d'origine — c'est ainsi qu'elle a été mise à l'épreuve.

Deux faux positifs corrigés en l'écrivant, et les deux sont des pièges de
mesure, pas des défauts de la base :

- **les surcharges**. `ca_request_store` a deux signatures depuis le 2 septembre
  (l'ancienne devenue un refus lisible, la nouvelle). Comparer les deux corps de
  la base à la seule *dernière* définition en déclare forcément une divergente.
  Un corps est en règle s'il est écrit **quelque part** dans le dossier ;
- **les commentaires en fin de ligne**. `rate_limit_ok` porte un
  `end if;      -- rien à compter` dans son corps : un nettoyage qui ne retire
  que les lignes *commençant* par `--` la déclare divergente alors qu'elle est
  identique mot pour mot. Septième variante du piège des commentaires sur ce
  dépôt.

⚠️ Et la règle du 4 septembre tient toujours : **un chiffre de dérive
invraisemblable est d'abord un défaut de mesure.**

## ⚠️ LES GARDES DÉDUISENT LEUR LISTE, ELLES NE LA CITENT PAS

C'est ce qui empêche la dérive de revenir en silence. Une garde qui nommerait
les neuf objets d'aujourd'hui ne protégerait que ceux-là, et le dixième passerait
exactement comme les neuf premiers. Chacune part d'une trace que le dépôt porte
déjà :

| Règle | Ce qu'elle aurait vu |
|---|---|
| Toute RPC appelée par le produit (`.rpc('X')`) est définie dans une migration | `request_account_deletion` |
| Toute fonction dont une migration règle les droits y est définie | les cinq fonctions de balise (`20260812000004` leur retirait `anon`) |
| Toute table qu'une migration altère, ou sur laquelle elle pose une policy, y est créée | `stores`, `zones`, `account_deletion_requests` |

⚠️ **Elles ne voient que le dossier.** Un objet créé à la main, jamais altéré et
jamais appelé depuis le code resterait invisible : seule la base peut le dire,
d'où le script. Un quatrième test vérifie qu'il n'a pas disparu.

## Ce qui reste, et que ce chantier ne prétend pas régler

- **Le dossier n'est pas rejouable**, pour la raison mesurée plus haut. Le
  rendre rejouable demanderait de déplacer la définition d'`is_admin()`, donc de
  toucher à la fonction qui garde les dix-huit RPC d'administration — un
  chantier à part, et sans banc d'essai : je n'ai aucune base jetable où le
  vérifier, et une branche Supabase coûte de l'argent. **Ne pas l'entreprendre
  sans un endroit où le prouver.**
- **Quatre des six fonctions rattrapées n'ont plus aucun appelant** —
  `ensure_zone`, `generate_zones`, `register_balise`, `set_zone_status` ne
  figurent que dans `src/types/database.types.ts`, c'est-à-dire dans des types
  générés, et **aucune fonction SQL ne les appelle non plus** (mesuré sur
  `pg_proc.prosrc`). `norm_balise` sert, elle, à cinq autres fonctions. Les
  écrire d'abord est l'ordre du projet (« on retire les appels d'abord, on supprime l'objet plus
  tard ») : maintenant qu'elles sont décrites, leur suppression est une migration
  ordinaire, dans un commit à elle.

Tests de garde : `web/tests/discipline-migrations.test.ts`.
