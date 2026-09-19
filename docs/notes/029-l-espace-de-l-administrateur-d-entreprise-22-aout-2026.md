# L'espace de l'administrateur d'entreprise (22 août 2026)

Julien : *« il voit tout et tout le monde dans son entreprise, il sait qui fait
quoi (console comme admin Quantinvo), il gère les membres quel que soit le
niveau, il gère les magasins, il peut consulter les inventaires et les gérer
aussi. C'est le maître ; au-dessus de lui il y a l'admin Quantinvo. Exemple :
le chemin “mon espace” ne mène pas vers inventaire pour lui, ce n'est pas sa
priorité. »*

**La définition qui a servi de règle** : son autorité vient de son rôle, pas
d'une affectation, et il administre — il ne fait pas le travail. Les
inventaires sont ceux de ses superviseurs.

Trois manques constatés avant d'écrire, et c'est le diagnostic qui compte :

1. **Il ne voyait pas les inventaires de son entreprise** auxquels il n'avait
   pas été invité. Ses droits de clôture, réouverture et suppression existaient
   déjà (migrations `20260821250001/2`) — c'était la *lecture* qui manquait.
2. **`company_audit_log` n'était affiché nulle part.** Il se remplit à chaque
   action depuis le 20 août ; « il sait qui fait quoi » n'avait aucun écran.
3. **Aucune vue d'ensemble** : son entreprise ne se lisait qu'en ouvrant les
   inventaires un par un.

Migration `20260822160001`, maquette validée avant codage :
https://claude.ai/code/artifact/ad0f725e-f87d-4c37-856a-4bae82d0a6c9

## Sa barre, et son atterrissage

`Tableau de bord · Magasins · Équipe · Inventaires · Journal`, et
`homePathForRole` le pose sur `/entreprise`. C'est la charpente de la console
Quantinvo à son échelle : l'état, le patrimoine, les personnes, le travail, la
trace.

**« Boîte à outils » a quitté sa barre** pour le menu de son avatar : imprimer
des balises est un geste de terrain, occasionnel pour lui. Elle reste un onglet
pour un superviseur ordinaire. Cinq onglets est la limite avant que la barre ne
passe sur deux rangs (elle le fait sous 900 px).

## Une ligne ouvre tous les inventaires

`is_session_participant` gagne `or public.is_company_admin(s.company_id)`.
**C'est le point de passage unique** : cette fonction garde la policy de lecture
d'`inventory_sessions` *et* `can_access_session`, dont dépendent comptages,
zones, audits, rapports et membres. Une ligne ouvre tout, de façon cohérente ;
la même règle dispersée dans quinze policies aurait garanti un oubli. Même
levier que `store_supervisors` pour les magasins, le matin même.

Conséquence à l'écran : `/dashboard` ne coupe plus sa liste en
« Mes inventaires / Inventaires invités » — ce sont ceux de son entreprise.

## Le tableau de bord, rangé par magasin

Demande de Julien : *« ranger les 3 blocs par magasin, comme pour la page
entreprise de l'admin Quantinvo »*. Les chiffres en tête, puis un bloc par
magasin portant ce qui est à lui : ses alertes, ses inventaires, son équipe.

- **Les alertes se calculent dans `web/lib/entreprise.ts`, pas en SQL.** Ce sont
  des règles de jugement (« neuf jours, c'est long ») : elles changeront plus
  souvent que la requête, et elles se testent sans base ni navigateur. Les
  seuils sont réunis dans `SEUILS` — ils se discutent, ils ne se devinent pas.
- **Un magasin qui tourne ne produit aucune alerte** et n'affiche donc aucun
  bandeau : c'est ce silence qui donne du poids aux autres.
- **`ca_company_overview` ne calcule pas l'avancement** : ce serait reparcourir
  zones et balises de chaque inventaire ouvert à chaque ouverture de page — le
  motif retiré pour la tenue en charge le 21 août. Elle rend les pièces
  comptées et le stock théorique attendu ; l'écran en tire une proportion
  **quand un fichier attendu existe**, et n'affiche rien sinon. Un pourcentage
  inventé serait pire que pas de pourcentage.
- **L'administrateur n'apparaît pas comme superviseur de chaque magasin** dans
  ces blocs : il les supervise tous depuis le matin, le répéter partout ne
  dirait rien de qui tient réellement le magasin.

⚠️ **Le journal reste global, et c'est un constat, pas un choix de mise en
page** : rien de ce que `company_audit_log` enregistre ne porte de magasin —
inviter un superviseur, retirer un accès, supprimer un compte, demander un
magasin. Le ranger par magasin supposerait d'abord de l'écrire autrement.

## Le journal

`ca_list_audit_log` (bornée à 500 lignes quoi qu'on demande) et l'écran
`/journal`. **Les libellés de `web/lib/journal.ts` sont des participes sans
auxiliaire** — « invité Marc », pas « a invité Marc » : c'est ce qui permet
d'écrire « Julien a invité » et « Vous avez invité » sans deux tables, et ce
qui a corrigé le « Vous a invité » du premier jet. Une action sans libellé
s'affiche en clair plutôt que de disparaître, **et un test échoue** si une
fonction `ca_*` journalise une action qu'aucun libellé ne couvre.

## L'équipe se lit personne par personne

Pour lui seulement : la liste part des personnes, avec leur rôle, leurs
magasins (retirables), leur dernier comptage et le nombre d'inventaires
comptés, plus une recherche et un filtre par magasin. Le bloc « Compteurs ·
autres magasins » ajouté le matin n'a plus d'objet — cette liste couvre toute
l'entreprise. Un superviseur ordinaire garde son rangement par magasin : c'est
ainsi qu'il travaille, un saisonnier part d'un magasin et pas de tous.

## Vérifications

En base, en transaction annulée : `ca_company_overview` rendue sur les données
réelles d'Entreprise C (4 magasins, 2 inventaires ouverts, superviseurs,
compteurs), refus opposé à un superviseur ordinaire, `anon` refusé partout.

Au navigateur, par **route jetable** (`/tmp-polish`, retirée ensuite — vérifier
au `git status`) : les blocs magasin en clair et en sombre. Un défaut trouvé
ainsi et corrigé : `.mag .signal` est plus spécifique que `.signal-alerte`,
l'ambre des alertes était donc écrasé et elles se lisaient comme des lignes
ordinaires — d'où le `:not(.signal-alerte)`.

**Non vu à l'écran** : les pages complètes `/entreprise`, `/journal` et
`/equipe` demandent une session d'administrateur d'entreprise.

## Second passage, le même jour

Retour de Julien sur le premier jet : *« réduire la taille des tuiles pour que
ça tienne sur une ligne, liste magasins collapsable nom magasin en en-tête et
placer cette section dans page Magasins, bouton ouvrir le magasin mène à page
du magasin en question — son profil — où on trouve son code, ses membres, ses
inventaires, place activités récentes sous tableau de bord. La page magasins de
l'admin entreprise doit s'inspirer de la page entreprises de l'admin
Quantinvo. »*

- **Le tableau de bord ne porte plus que deux blocs** : les cinq indicateurs
  (`.dash-kpis-5`, qui rétrécit les tuiles au lieu de les casser sur deux
  rangs — repasse à trois colonnes sous 1040 px) et l'activité récente.
- **Les magasins ont déménagé sur `/magasins`**, chacun dans un `Volet` —
  replié, nom en en-tête, résumé et pastille (« 2 à surveiller » / « À jour »).
  Les règles du composant s'appliquent : rien ne s'ouvre tout seul, et
  l'en-tête doit dire ce qu'il y a dedans, sinon on n'a fait que déplacer le
  mur.
- **La page reprend la figure de `/admin/entreprises`** : compte dans le titre,
  recherche par fragments (« lyon part » trouve « Magasin Lyon Part-Dieu »),
  une fiche derrière chaque ligne. ⚠️ **Elle garde deux lectures** : un
  superviseur ordinaire y vient relever un code d'accès, il ne doit pas
  hériter de la console.
- **`/magasins/[storeId]`, la fiche d'un magasin** : son code, ses membres,
  ses inventaires. `ca_store_detail` (migration `20260822170001`) rend
  l'historique complet — la liste, elle, n'affiche que les inventaires ouverts
  et le dernier clôturé. **L'activité d'un compteur y est celle de ce
  magasin** : quelqu'un qui compte beaucoup ailleurs n'y est pas actif pour
  autant. La garde porte sur l'entreprise **du magasin visé**, jamais sur un
  paramètre de l'appelant.
- `CorpsMagasin` est partagé par la liste et la fiche : deux écrans qui
  montrent la même chose doivent la montrer de la même façon.

Deux doublons évités au passage, et c'est le genre que Julien repère :
`depuis()` refaisait `relativeTime()` de `lib/format` (avec un « il y a 3
jours » là où le site dit « il y a 3 j »), et `nb()` était recopié dans quatre
pages — il a rejoint `lib/format`.

Vérifié au navigateur (route jetable, clair et sombre) : les cinq tuiles sur
une ligne, les volets repliés, un volet ouvert. Un défaut corrigé ainsi —
« Ouvrir le magasin » s'étirait sur toute la largeur, un bouton dans une
colonne flex prenant toute la place.

Tests de garde : `web/tests/espace-admin-entreprise.test.ts`.
