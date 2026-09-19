# Application mobile : « Mon profil » rangé comme le site (21 août 2026)

L'écran profil de l'app était le carrefour que le site avait démonté quelques
jours plus tôt : identité, entreprise, magasins et leurs codes, balises,
inventaires, équipe, déconnexion et suppression, empilés sur deux hauteurs
d'écran. Il suit désormais la même logique — **la personne, puis des lignes
vers le travail** — mais sans barre d'onglets : sur mobile, le bouton profil du
bandeau ouvre un **seul écran, `account.tsx` (« Mon compte »)**, qui mène aux
autres.

Ce qui a bougé :

- `(supervisor)/profile.tsx` **supprimé**, remplacé par `(compte)/account.tsx` ;
- écrans nés de son démembrement, dans `(supervisor)` car ils sont le travail
  du superviseur : `stores.tsx` (Magasins), `team.tsx` (Mon équipe),
  `tools.tsx` (Boîte à outils) — mêmes noms que les onglets du site ;
- **groupe `(compte)`** : `account.tsx`, `password.tsx`, `mfa.tsx`,
  `my-data.tsx`, `name.tsx`, communs à tous les rôles (voir plus bas) ;
- **« Mes inventaires » retiré** : l'écran Sessions les liste déjà. C'est le
  doublon que le site avait lui aussi sorti de `/account`.
- `MenuList.tsx` (`MenuCard`, `MenuRow`, `SectionLabel`, `ChevronIcon`) : le
  motif de menu existait déjà, redessiné à la main dans l'écran d'un
  inventaire. Une seule définition maintenant.
- Requêtes devenues sans objet et retirées : `getMySessions`,
  `getTeamMembers`, `getTeamInvitations`, le type `Invitation`.

**`my_team_by_store` est la même RPC que la page « Mon équipe » du site**, et
c'est voulu : deux écrans qui montrent la même chose doivent la demander de la
même façon. Piège vérifié à la source — elle **ne renvoie pas `full_name`**
pour les invitations, seulement `first_name` et `last_name` (type `TeamInvite`,
volontairement plus étroit que la ligne de table). S'appuyer sur le type de la
table afficherait un nom vide en toutes circonstances. L'annulation passe par
`cancel_my_invitation`, comme le site, et non plus par un DELETE nu sur
`team_invitations`.

Les types `src/types/database.types.ts` ont été **régénérés** au passage : ils
dataient d'avant `first_name`/`last_name`/`is_company_admin` sur `profiles` et
d'avant `export_my_data` et `my_team_by_store`.

## Mot de passe, double authentification, export : l'app ne renvoie plus au site

Les trois fonctions n'existaient que sur le site. Elles sont dans l'app.

- **`src/lib/password.ts` est la copie exacte de `web/lib/password.ts`**, comme
  `baliseSeries` et `presence` : l'app et le site ne compilent pas ensemble.
  Les deux fichiers bougent ensemble — `web/tests/password.test.ts` échoue
  s'ils divergent, et la console Supabase reste la seule à faire foi.
- **`src/lib/mfa.ts` n'est pas une copie** : il rend en plus l'adresse
  `otpauth://`. Sur un téléphone, l'application d'authentification est
  installée sur l'appareil qui affiche le QR code — **on ne peut pas le
  scanner**. Le chemin principal est donc l'ouverture directe de l'application,
  ou la clé recopiée ; le QR ne sert qu'à s'enrôler depuis un autre appareil.
  Le QR est redessiné avec `qrcode` + `react-native-svg` (`QrCode.tsx`) : celui
  de Supabase est une image SVG en `data:`, que `<Image>` ne sait pas afficher.
  Et **pas de `canOpenURL`** avant l'ouverture : sur iOS il répond faux pour
  tout schéma absent de `LSApplicationQueriesSchemes`, même quand une
  application sait l'ouvrir.
- **Conséquence obligatoire, à ne jamais défaire : la connexion de l'app
  demande le code.** `AuthProvider` expose `mfaRequired` (contrat aal1/aal2
  identique au site), `index.tsx` renvoie vers `/login` tant qu'il est vrai, et
  `login.tsx` affiche la deuxième étape. Sans cela, activer la double
  authentification depuis le téléphone ne protégerait que le site : le
  téléphone continuerait à laisser entrer au mot de passe seul. Tests de garde :
  `tests/compte.test.ts`.
- **Il n'y a toujours pas de codes de secours.** Un téléphone perdu se dépanne
  en base (`delete from auth.mfa_factors where user_id = …`, en `service_role`).
  Ouvrir l'activation à tous les superviseurs rend ce dépannage plus fréquent :
  l'écran le dit avant l'activation, dans un encadré, plutôt qu'après la perte.

## Le compte est le même pour tous les rôles — groupe `(compte)`

Les écrans de compte ont d'abord été écrits sous `(supervisor)`, ce qui les
rendait **inatteignables pour un compteur** : la garde de ce groupe renvoie
vers la connexion tout ce qui n'est pas superviseur. Or changer son mot de
passe, activer sa double authentification ou récupérer ses données ne dépend
pas du rôle. Ils vivent donc dans `(compte)`, dont la seule condition d'entrée
est d'avoir un profil — et une session complète (`mfaRequired` y est refusé,
sinon on pourrait retirer son second facteur à moitié authentifié).

`(compte)/account.tsx` est **un seul écran pour tout le monde**, comme
`/account` sur le site : seul le bloc « Mon travail » (Magasins, Mon équipe,
Boîte à outils) est conditionné au rôle superviseur. Les deux layouts,
`(supervisor)` et `(employee)`, ouvrent le même écran par le bouton profil du
bandeau.

**Le groupe porte aussi les écrans de travail — et c'est la flèche de retour
qui l'a imposé.** Magasins, Mon équipe, Boîte à outils et Ajouter un membre
sont restés d'abord dans `(supervisor)` : les ouvrir depuis « Mon compte »
traversait deux groupes de routes, la pile repartait de zéro et **le bouton
retour disparaissait**. Règle à retenir : *ce qu'un écran ouvre doit être dans
sa pile*. La garde de rôle que portait le groupe `(supervisor)` est donc posée
dans chacun de ces quatre écrans (`profile?.role !== 'supervisor'` → retour à
« Mon compte ») ; les RPC refusent déjà un compteur côté serveur, cette garde
lui évite un écran en erreur.

**L'administrateur d'entreprise est un superviseur comme les autres pour ces
écrans**, et c'est un piège de rédaction : lui écrire « l'administrateur de
votre entreprise vous affectera un magasin » le renvoie à lui-même. Les états
vides de Magasins et Mon équipe branchent donc sur `profile?.is_company_admin`.
⚠️ **Leur texte a changé le 22 août 2026** : il ne s'affecte plus rien, il est
affecté à *tous* les magasins de son entreprise (section « L'administrateur
d'entreprise supervise tous les magasins » plus bas). S'il n'en voit aucun,
c'est que l'entreprise n'en a aucun.

**Un échec de chargement n'est pas une liste vide.** Ces deux écrans
distinguent `isError` du cas « aucune ligne » : sans cela, une coupure de
réseau annonce « Aucun magasin » à quelqu'un qui en a, et l'envoie réclamer un
accès pour rien. Vu en simulateur, requête refusée et message « Aucun
magasin » à l'écran.

« Mon compte », lui, est le **premier** écran de sa pile : la flèche native ne
s'affiche pas alors qu'on arrive bien de Sessions ou de l'accueil. D'où le
`headerLeft` « Retour » du layout, conditionné à `router.canGoBack()`.

Conséquence côté compteur : « Déconnexion » posé en haut de son accueil et le
lien souligné « Supprimer mon compte » en pied ont disparu — les deux sont
dans « Mon compte », comme pour le superviseur. `DeleteAccountButton` (le
lien) n'avait plus d'appelant : le fichier est devenu
`components/AccountDeletion.tsx`, qui n'expose plus que `useAccountDeletion`
et `DeletionPendingNote`.

Maquette de référence :
https://claude.ai/code/artifact/032d3ee8-ee0f-4b32-9b21-c6a5d278356c
