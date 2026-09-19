# Le reste de la maquette d'onboarding (28 août 2026)

Les six points qui restaient de la maquette du 23 août
(https://claude.ai/code/artifact/e54ce742-3f4c-4788-839e-d118f82c2e02), faits
dans la foulée des trois premiers.

## Le viseur enseigne, une consigne à la fois

Quand rien n'est lu, l'écran ne montrait qu'un cadre : rien ne disait si l'on
est trop loin, trop près, ou dans le noir. Deux phrases se succèdent
maintenant sous le cadre — « Rapprochez-vous, le code doit remplir le cadre »
à 3,5 s, puis « Trop sombre ? Allumez la lampe » à 8 s (ou « Reculez un peu »
si la lampe est déjà allumée).

- **⚠️ Ils s'arrêtent à la première lecture et ne reviennent pas.** Défaut vu
  au simulateur en l'exerçant : sans ce garde-fou, « Rapprochez-vous » repart
  trois secondes après **chaque** scan — donc pendant qu'on marche vers
  l'article suivant, à quelqu'un qui vient précisément de réussir. Ces
  conseils apprennent à viser, ils ne commentent pas un comptage. Remis à zéro
  au changement de phase : viser un QR de balise et viser un code-barres ne se
  règlent pas pareil.
- **⚠️ Leurs hooks sont AVANT les deux retours anticipés** de `scanner.tsx`
  (permission inconnue, écran d'amorce). Posés plus bas, avec le texte qu'ils
  servent, ils seraient sautés d'un rendu à l'autre — « rendered fewer hooks
  than expected », et l'écran de comptage tombe. Un test compare les deux
  positions dans le fichier.
- **La forme du cadre annonce ce qu'on attend** : carré pour le QR d'une
  balise, rectangle large pour un code-barres. Le carré est mesuré en points
  (la caméra a une hauteur fixe de 200) — un carré demande la même valeur dans
  les deux sens.
- **La trace du dernier scan** (« Dernier scan · Robe midi bleu nuit ») occupe
  la barre quand il n'y a ni conseil ni détection en cours : elle lève le
  doute « est-ce que ça a pris ? » sans quitter la caméra des yeux. L'ordre de
  la barre est fixe : ce qui se passe maintenant, puis ce qu'il faut essayer,
  puis ce qui vient d'être enregistré.

## Les notifications s'annoncent avant de se demander

La boîte iOS partait seule à l'ouverture d'un inventaire, sans un mot sur ce
qu'on recevrait — or **un refus est définitif**, il ne se défait qu'en passant
par les Réglages. Une carte sur la liste du compteur l'amorce désormais :
« Être prévenu des prochains inventaires · Activer · Plus tard ».

- `etatNotifications()` (`lib/push.ts`) lit l'état **sans jamais ouvrir la
  boîte** : c'est ce qui permet de ne proposer « Activer » que si le système
  accepte encore la question.
- **⚠️ Déjà accordées : rien à l'écran, mais le jeton se réenregistre en
  silence.** Un jeton Expo peut tourner ; sans ce rafraîchissement, les
  personnes déjà installées cesseraient d'être prévenues sans que rien ne le
  dise.
- **Le compteur n'a plus de demande automatique** — `useNotificationsSurInventaire`
  a quitté son écran d'inventaire. **Le superviseur la garde** : c'est lui qui
  invite, être sollicité là ne le surprend pas.
- **⚠️ Invisible au simulateur** : `Device.isDevice` y est faux, la carte ne
  s'y montre jamais. Ce chemin ne se vérifie qu'appareil en main.

## Deux sorties qui manquaient

- **« Je n'ai pas reçu mon invitation »** sur l'écran de connexion. Elle
  explique que l'invitation vient du **responsable**, à qui la redemander —
  jamais « contactez le support » : il sait qui doit être dans quelle équipe,
  nous non. ⚠️ Le commentaire du fichier cite la formule interdite pour dire
  qu'on ne l'écrit pas : la garde doit lire le code **sans ses commentaires**.
- **Le repère « où se lisent le rapport et les écarts »**, une fois, sur
  l'écran d'un inventaire. ⚠️ **Adapté** : la maquette parlait d'« un menu en
  haut à droite », qui n'existe pas dans l'app — les actions sont listées sur
  l'écran. Le repère dit donc ce qui ne se voit pas : l'export Excel vit
  *dans* le rapport, et le site montre les mêmes tableaux en plus large. Il
  attend qu'il y ait quelque chose à lire (`countedPieces > 0`).
- **Un membre qui n'est jamais entré se voit** : badge « Mot de passe à
  créer » sous son nom, le libellé du site. ⚠️ `is_active` veut dire « s'est
  déjà connecté », rien d'autre — même piège de lecture que sur « Mon équipe »
  en août.

## L'administrateur d'entreprise a ses propres étapes

Il voyait le bandeau d'un superviseur — « Générer mes balises », qui n'est pas
son travail. `etapesAdmin` (`components/BandeauDemarrage.tsx`) lui en donne
trois : ses magasins créés, **un superviseur par magasin**, un premier
inventaire lancé. Un seul bandeau à l'écran, le sien.

- **⚠️ « Un superviseur par magasin » ne le compte pas lui-même.** Il a tous
  les magasins par construction (déclencheurs du 22 août) : se compter
  cocherait l'étape d'office. `ca_company_overview` exclut déjà les
  administrateurs de `supervisors` — c'est cette exclusion qui rend l'étape
  utile.
- **L'étape « un premier inventaire » se lit sur `last_session_at`**, le
  dernier inventaire *créé* : elle ne se décoche pas quand on clôture. Même
  règle que le bandeau du superviseur, corrigé le matin même.
- **`debutant` ne vaut pas pour lui** : il ne crée pas d'inventaires, ce sont
  ceux de ses superviseurs. Son bandeau s'efface quand ses trois étapes sont
  faites, et `demarrageFini` le note alors comme pour tout le monde.
- **Ses magasins disent qui les tient** (écran Magasins) : deux noms puis
  « et N autres », ou la pastille « Aucun superviseur · à pourvoir ». L'écran
  dit aussi où cela se règle — **la page Mon équipe du site** : l'application
  n'a pas d'écran d'administration, et ce n'est pas ce chantier qui allait lui
  en donner un.
- `src/types/database.types.ts` a été **régénéré** pour `ca_company_overview`
  (ils dataient du 21 août) ; il porte donc aussi le schéma du soir même.

## Ce qui n'a pas été fait, et pourquoi

**L'équipe d'un inventaire ne montre ni « Renvoyer l'invitation » ni QR.** La
maquette les demandait — mais **il n'y a plus d'invitation en attente à un
inventaire** : `invite-to-session` refuse les adresses sans compte et ajoute
directement à `session_members`. La table `session_invitations` est vide en
production, et son bloc dans l'app ne sert plus qu'à d'éventuelles lignes
anciennes. Renvoyer quoi, à qui ? Le vrai risque que la maquette visait — « la
veille de l'inventaire, la moitié de l'équipe n'est jamais entrée » — est
couvert par le badge « Mot de passe à créer » ci-dessus. Le QR, lui,
supposerait un lien profond que l'app ne sait pas ouvrir, pour faire circuler
un code semi-confidentiel : à rouvrir seulement si le besoin se présente en
vrai.

**⚠️ La question ouverte est tranchée : NON** (Julien, 28 août 2026). Un seul
inventaire ouvert dans le magasin **ne s'ouvre pas directement** — la liste
reste, même à une ligne. Elle porte le nom de l'inventaire et son magasin,
c'est-à-dire la preuve qu'on est au bon endroit ; et surtout le comportement
ne change pas le jour où un deuxième s'ouvre, ce qui arrive précisément un
matin d'inventaire, à quelqu'un qui a pris l'habitude de l'autre. Le seul gain
aurait été un appui. **Ne pas réintroduire de redirection automatique** depuis
l'accueil du compteur : un test la refuse.

## Vérifications

Au simulateur, sur les données réelles : le repère du menu au-dessus
d'« Actions », le **cadre carré** en phase balise et le **cadre large** en
phase article (les deux photographiés), et le conseil « Trop sombre ? Allumez
la lampe » — l'écran de comptage d'un simulateur n'ayant pas de caméra, c'est
même exact. La balise ouverte pour l'occasion était déjà terminée : contrôlé
en base après coup, `count_status` et `count_done_at` n'ont pas bougé (règle
du 25 août — consulter n'écrit rien).

**Non vérifié à l'écran** : l'écran de connexion (il faudrait se déconnecter,
et je ne peux pas me reconnecter), la carte des notifications (invisible au
simulateur), et les étapes de l'administrateur (elles demandent une session
d'administrateur d'entreprise).

Tests de garde : `tests/compte.test.ts`, blocs « le viseur enseigne », « les
notifications s'annoncent avant de se demander », « les sorties qui
manquaient » et « l'administrateur d'entreprise a ses propres étapes ».
