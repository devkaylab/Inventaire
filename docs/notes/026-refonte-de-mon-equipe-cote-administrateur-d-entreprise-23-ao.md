# Refonte de « Mon équipe », côté administrateur d'entreprise (23 août 2026)

*« La page équipe de l'admin entreprise n'est pas logiquement bien
sectionnée. »* Elle s'était construite par couches. Maquette validée avant
codage : https://claude.ai/code/artifact/33d0abae-d861-425c-baa4-4517abc7a914

Six défauts, dont un qui n'était pas qu'une question de rangement :

1. **deux portes pour ajouter des gens** — un bouton « Ajouter un compteur »
   dans l'en-tête, un formulaire « Inviter un superviseur » déplié en
   permanence au milieu de la page ;
2. **ce formulaire coupait les deux listes**, qui ne se lisaient jamais l'une
   après l'autre ;
3. **la recherche et le filtre magasin ne couvraient que les compteurs** ;
4. **deux dessins pour la même chose** — cartes `store-block` pour les
   superviseurs, `req-row` pour les compteurs, reste du rangement par magasin ;
5. **les invitations reléguées tout en bas**, après tout le reste ;
6. **⚠️ `AddCounter` envoyait `storeIds: []`**, et une liste vide veut dire
   *tous les magasins du superviseur* — donc, pour un administrateur
   d'entreprise, **l'entreprise entière** à chaque compteur ajouté d'ici.

Le découpage retenu : **invitations en attente en tête**, puis une seule
section **Membres** avec recherche, filtre magasin et filtre type de profil.

- **Les invitations passent devant parce qu'elles attendent** — même règle que
  « Ventes en cours » sur /admin. La section disparaît quand il n'y en a
  aucune ; le bloc du bas ne sert plus qu'au superviseur ordinaire.
- **Le rôle est une pastille (`.pill-role`), pas une section.** Dans une liste
  unique il devient ce qui distingue les gens : il doit se repérer d'un coup
  d'œil. Pastille neutre, pour ne voler la vedette ni à « Admin » (accent) ni
  à « Mot de passe à créer » (ambre). L'ordre reste celui du serveur.
- **⚠️ Le filtre par magasin ne cache pas les administrateurs** : ils les ont
  tous par construction, les retirer d'une liste filtrée laisserait croire
  qu'ils n'y travaillent pas.
- **Une seule porte d'ajout** (`AjouterPersonne`, qui remplace `InviteForm` et
  `AddCounter` pour l'administrateur), le rôle sur deux cartes plutôt qu'un
  menu — ce n'est pas un réglage parmi d'autres, c'est ce qui décide de la
  fonction appelée et de l'obligation d'un magasin. **Les magasins sont
  demandés dans les deux cas** : c'est ce qui ferme le défaut 6.
- **Sa propre ligne et celle d'un autre administrateur ne portent aucune
  action** (`intouchable`) : ces comptes restent chez Quantinvo, et l'écran le
  dit — « Géré par Quantinvo » — plutôt qu'un bouton qui refuserait.
- **Le superviseur ordinaire garde son rangement magasin par magasin** : c'est
  ainsi qu'il travaille, un saisonnier part d'un magasin et pas de tous.

## Un compteur compte pour quelqu'un — le superviseur d'abord

*« Ajout membre par admin entreprise, compteur : l'admin doit préciser qui est
le superviseur, puis sélectionner le magasin, liste magasin = liste magasin
superviseur. »* Maquette :
https://claude.ai/code/artifact/3c19c9ed-11f9-4d68-887a-ca5f8b41eb03

Le panneau d'ajout enchaîne désormais **rôle → identité → superviseur →
magasins**, et les deux champs qui dépendent l'un de l'autre sont voisins.
Avant, l'administrateur cochait n'importe quel magasin de l'entreprise — y
compris un magasin que **personne ne supervise**. Le compteur existait alors
sans apparaître dans le « Mon équipe » de qui que ce soit.

⚠️ **Le superviseur choisi ne s'enregistre nulle part** (option A, tranchée
par Julien). *« Le superviseur d'un compteur » n'existe pas en base* : un
compteur appartient à des magasins, un superviseur aussi, et c'est le magasin
qui les relie. Ce menu ne fait que **restreindre la liste en dessous**. Si le
superviseur quitte le magasin, le compteur y reste et passe sous la
responsabilité de celui qui le reprend — on encadre un magasin, pas des
personnes. Ne pas ajouter de colonne « superviseur » à `profiles` ou à
`team_invitations` en croyant compléter ce travail : c'est l'option B, elle a
été écartée.

- **Un superviseur qui n'a qu'un magasin le voit coché d'office** — la
  question a déjà sa réponse. Même règle que la création d'inventaire dans
  l'application.
- **L'administrateur figure dans la liste**, avec « tous les magasins » : dans
  une petite structure c'est lui qui encadre, l'écran ne doit pas l'obliger à
  nommer quelqu'un d'autre.
- **Le rôle Superviseur n'affiche pas ce menu** : un superviseur ne compte
  pour personne. Sa liste reste celle de tous les magasins de l'entreprise.
- **Un magasin absent de la liste se dit** — « … ne les supervise pas » —
  sinon on cherche un défaut là où il y a une règle.
- **Une entreprise sans aucun superviseur ne peut pas recevoir de compteur**,
  et le panneau le dit avec le geste qui débloque (« Inviter un superviseur »,
  qui bascule le rôle).
- **⚠️ Un magasin est désormais exigé pour les deux rôles.** La liste vide
  voulait dire « tous les magasins du superviseur » : depuis l'écran d'un
  administrateur, cela donnait l'entreprise entière à chaque compteur ajouté.

Vu à l'écran (route jetable rendant le vrai panneau, retirée — `git status`
contrôlé), clair et sombre : les quatre états (superviseur non choisi, deux
magasins, un seul coché d'office, entreprise sans superviseur).

## Affecter un magasin à un compteur (`ca_set_counter_stores`)

Migration `20260823130001`. Il n'existait que `remove_counter_from_store` : on
pouvait retirer un compteur d'un magasin, jamais lui en donner un. Un compteur
retiré de son dernier magasin devenait donc **invisible partout** — les listes
se lisent magasin par magasin — donc irrécupérable, et impossible à promouvoir
puisqu'un superviseur a toujours au moins un magasin. Vu en vrai le même jour.

Miroir de `ca_set_supervisor_stores`, à une différence volontaire : **un
compteur sans magasin est un état normal**, la liste vide n'est pas refusée.
⚠️ Deux tables (`store_supervisors` / `store_team`), donc deux fonctions —
mais **un seul geste à l'écran** : `changerMagasins` route selon le rôle.

## Deux corrections de feuille de style

- **`.toolbar select { width: auto }`** — la règle groupée mettait `width:
  100%` sur les champs *et* les menus. Avec deux filtres dans la même barre,
  les trois contrôles s'empilaient. Un filtre se dimensionne sur son contenu.
- **`.dash-sub-compte` / `.dash-sub-n`** — un titre de section qui porte un
  compte, et « x sur y » avec « Effacer les filtres » dès qu'un filtre est
  actif. `.dash-sub` reste un simple libellé partout ailleurs.

Vu à l'écran (route jetable rejouant le vrai rendu, retirée — `git status`
contrôlé), clair et sombre : les trois sections, les filtres sur une ligne, le
panneau dans les deux rôles, et « Membres · 2 sur 5 » sur un filtre actif.

Tests de garde : `web/tests/admin-entreprise.test.ts`, bloc « refonte de
“Mon équipe” ».
