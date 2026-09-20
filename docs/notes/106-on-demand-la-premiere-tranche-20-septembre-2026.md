# On-Demand, construit sur la branche `on-demand` (20 septembre 2026)

⚠️ **RIEN DE TOUT CECI N'EST EN PRODUCTION, ET RIEN N'EST APPLIQUÉ EN BASE.**
Tout vit sur la branche `on-demand`, publiée sur la préversion Vercel
(`quantinvo-git-on-demand-devkaylab.vercel.app`, protégée par le compte
Vercel). Les huit migrations sont **en fichiers** : aucune n'a été jouée.
Décision de Julien : « à publier uniquement sur le site preview, pas la prod ».

Conception : `docs/entreprise/on-demand/`. Maquette :
https://claude.ai/artifact/BSqAQUPZ7tnjAfdswK35MV

---

## Ce qui est construit

### En base — huit migrations, aucune appliquée

| Fichier | Ce qu'il pose |
|---|---|
| `20260920120001_on_demand_le_socle` | `entitlements`, `provider_profiles`, `provider_availability`, `mon_acces()` |
| `20260920130001_on_demand_la_mission` | `missions` et sa machine d'état, `mission_assignments`, `mission_access`, huit policies d'OS réécrites, le trou du plafond d'appareils |
| `20260920140001_on_demand_le_prix` | `reglages_prix`, `coefficients_prix`, `zones_desservies`, `prix_mission`, `devis_mission` |
| `20260920150001_on_demand_reserver` | `reserver_ma_mission`, `frais_annulation`, `annuler_ma_mission`, le barème |
| `20260920160001_on_demand_la_console` | `admin_missions`, `admin_mission`, `admin_candidats_mission`, proposer / retirer / avancer |
| `20260920170001_on_demand_l_inventoriste` | `mes_propositions`, `repondre_a_une_mission`, `mon_espace_inventoriste`, `ma_zone_de_mission` |
| `20260920180001_on_demand_prix_et_paiements` | `admin_poser_reglages_prix`, `admin_apercu_prix`, `admin_paiements` |
| `20260920190001_on_demand_reservation_groupee` | `reserver_un_groupe` |

### Sur le site

`/a-la-demande` (les deux offres au même rang) · `/reserver` (le tunnel, deux
étapes 1 selon qu'on est connecté) · `/devenir-inventoriste` ·
`/a-la-demande/mes-inventaires` et son détail avec l'annulation chiffrée ·
`/a-la-demande/groupe` · `/admin/missions` et son détail avec le matching ·
`/admin/prix` · `/admin/paiements`.

**« À la demande » est en deuxième position dans la barre de menus**, juste
après « L'inventaire » : c'est la seconde façon de faire la chose dont parle le
premier lien, pas une étape de la découverte.

### Dans l'application

`src/app/(provider)` — missions proposées et acceptées, la mission avec son
pointage, les disponibilités, les revenus, le profil et sa vérification. Une
seule app : un inventoriste compte avec le même écran de scan que tout le
monde, et une seconde application aurait voulu dire deux fois le mode hors
ligne, deux fois les passes, deux fois les balises.

---

## Les huit décisions qui ne se relisent pas dans le code

1. **Aucune policy d'écriture sur `provider_profiles`.** Avec un `update`
   ouvert, n'importe qui se poserait `etat = 'actif'` et
   `paiements_ouverts = true`. L'écriture passe par une fonction qui ne touche
   que les colonnes déclaratives, et sa seule transition d'état va vers le bas.

2. **Pas de `company_id` sur l'inventoriste.** Le rattacher à une entreprise
   lui donnerait les droits de cette entreprise sur ses inventaires. Son accès
   passe par `mission_access`, une mission à la fois.

3. **`mission_access` plutôt qu'une ligne dans `session_members`.**
   `session_members_supervisor` est `for all` : un superviseur du client
   pourrait mettre notre équipe dehors au milieu de l'inventaire qu'il paie.

4. **Le plafond d'appareils ne rendait rien du tout.** `companies.plan` vaut
   `'standard'` par défaut, donc `plafond_appareils` rendait `null`, que
   `prendre_place_appareil` traduisait par « ne rien refuser » : **le cas par
   défaut de toute entreprise créée à la main était illimité.** Fermé par
   `plafond_appareils_effectif`, plancher à deux. `plafond_appareils` garde son
   sens commercial — y verser la mission bloquerait la vente d'une offre
   pendant une mission.

5. **Les coefficients de prix partent tous à 1,00**, ce qui corrige le document
   de conception : il annonce « Paris 1,10 » mais ses propres exemples ne
   l'appliquent pas. Avec, Paris Rivoli vaudrait 1 044 € et les quatre prix de
   la maquette seraient faux.

6. **Trois fuites d'argent fermées.** `reglages_prix` dit le taux horaire qu'on
   verse et la marge qu'on prend : policy `is_admin()`. `prix_mission` rend le
   coût : `service_role` seul, et `devis_mission` recopie en liste blanche.
   `missions` donne son droit de lecture **colonne par colonne**, sans
   `cout_cents` — la RLS choisit des lignes, pas des colonnes.

7. **Une proposition de mission ne montre pas l'adresse.** Avant acceptation :
   secteur, ville, heure, rémunération. Après : l'adresse et comment entrer.
   Quelqu'un qui refuse tout aurait sinon ramassé l'adresse et l'heure de
   chaque magasin servi.

8. **Le matching n'écarte personne.** Chaque profil sort avec `retenu` et
   `pourquoi`, « Voir tout le monde » montre les autres : article 22 du RGPD,
   un profil écarté par un calcul doit pouvoir être repêché à la main.

---

## Ce que les outils du dépôt ont attrapé

- **`scripts/verifier-migrations.py`** (neuf) analyse les migrations avec
  `libpg_query`, corps PL/pgSQL compris, sans se connecter. Il a refusé
  `if … case … end and … then` dans `repondre_a_une_mission` : le `end` du
  `case` est pris pour la fin du bloc. **En base, le fichier aurait échoué à
  mi-transaction.**
- La garde du plan du site a exigé une décision pour chaque page publique
  neuve ; les trois pages On-Demand sont écartées nommément, `noindex`, et en
  français seul.
- La garde des liens de vitrine a exigé que les sorties passent par `lien()`.
- La garde `[hidden]` a relevé que `.field-duo` impose `display: grid`, qui bat
  l'attribut — la saisie d'adresse restait à l'écran alors qu'un établissement
  était choisi.
- La garde « aucun texte n'invite à écrire sans dire où » a mordu sur un
  « écrivez-nous » de la réservation groupée.
- Le lint de l'application refuse un `setState` dans un effet : les
  disponibilités se déduisent maintenant au lieu d'être recopiées, ce qui
  supprime aussi l'écrasement d'une saisie en cours au premier rafraîchissement.

---

## ⚠️ Ce qui n'est PAS construit

- **Le paiement.** Ni empreinte bancaire, ni débit, ni Stripe Connect, ni
  versements. `venteOuverte()` ferme la réservation comme elle ferme
  l'inscription, et les écrans le disent au lieu de faire semblant.
- **Le score de l'inventoriste** (planche Prestataire-Score) : il n'y a pas
  encore de missions pour le calculer, et le document du matching dit de ne pas
  en inventer un.
- **La distance en kilomètres** dans le matching : aucune coordonnée en base,
  aucun géocodage branché. On affiche le secteur et le rayon déclaré.
- **Le sélecteur de produit** (planche Selecteur) : il toucherait le chemin de
  connexion de tout le monde pour un cas qui ne concerne qu'une entreprise
  abonnée ET utilisatrice d'On-Demand. Le rail porte « À la demande », ça suffit
  tant que ce cas n'existe pas.
- **L'écran du responsable d'équipe** (planche TeamLeader-Mission) : il fait ce
  que les écrans superviseur font déjà, et `a_un_acces_mission` lui en ouvre
  l'accès. En redessiner une version donnerait deux écrans à tenir en phase.
- **Les notifications** (document 05) et **les deux entrées de registre RGPD**
  que Connect impose (document 01).

Et les quatre points de `07-par-ou-on-commence.md` restent entiers : statut
juridique des inventoristes, TVA, Stripe Connect, et le lancement de Quantinvo
OS qui passe d'abord.
