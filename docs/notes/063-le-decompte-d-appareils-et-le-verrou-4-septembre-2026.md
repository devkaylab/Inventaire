# Le décompte d'appareils, et le verrou (4 septembre 2026)

*« Fais le décompte d'appareils. »* La page de tarifs promet « deux appareils à
la fois » depuis le 30 août, l'assiette de la licence est ce nombre-là depuis le
2 septembre — et **rien ne le mesurait ni ne l'appliquait**. Une entreprise
Essential pouvait faire compter cinquante téléphones sans que personne ne le
sache, ni elle, ni nous. Maquette validée avant codage :
https://claude.ai/code/artifact/f3b2baf3-564a-4da0-bf5f-d4cb879ca53d

Migration `20260904210001`, module `src/lib/appareil.ts`, module de jugement
`web/lib/appareils.ts`, section « Appareils » sur la fiche d'un magasin.

## ⚠️ LA RÈGLE : RIEN DE PLUS SANS PAIEMENT

Arbitrée par Julien le 4 septembre 2026, en ces termes : **« on n'accepte ni
magasin, ni appareil supplémentaires sans paiement »**. Le plafond n'est donc
pas indicatif — le troisième appareil d'un forfait Essential **ne peut pas
ouvrir son écran de comptage**.

**Cette note remplace le « plafond souple » posé le 27 août pour l'offre Solo.**
Elle ne vaut que pour les appareils et les magasins : un plafond de *volume
compté*, s'il revient un jour, reste une autre question.

## ⚠️ LES TROIS BORNES DU VERROU

Ce ne sont pas des adoucissements, ce sont les conditions pour qu'il ne casse
pas un inventaire. Ne pas les défaire sans que Julien rouvre le sujet.

1. **Un appareil qui compte n'est JAMAIS éjecté.** Le verrou refuse une entrée,
   il n'interrompt pas un travail. En base, le chemin « il est déjà là » passe
   **avant** tout comptage : un plafond abaissé entre-temps ne renvoie personne
   de son rayon.
2. **Hors ligne, on laisse compter.** Un téléphone sans réseau ne peut ni
   réserver ni se voir refuser. La borne vit côté application, sous une forme
   plus large : **on n'échoue jamais du côté fermé** — réseau coupé, serveur
   muet, code inconnu, tout accorde. Le seul refus qui ferme la porte est un
   `forfait_plein` explicitement prononcé par le serveur.
3. **Sans plafond connu, aucun refus.** Un magasin dont `stores.devices` est nul
   et dont l'entreprise n'a pas de `plan` n'a pas d'assiette : on mesure, on ne
   juge pas. Un plafond inventé fermerait la porte à tort.
   · **⚠️ Au 4 septembre 2026 il n'y a AUCUN CLIENT RÉEL** (Julien : « à l'heure
     actuelle nous n'avons que des comptes et entreprises tests »). Ce n'est
     donc pas un historique à ménager : c'est simplement qu'aucune licence n'a
     encore été vendue. **Ne pas écrire au client qu'un magasin « a été ouvert
     avant que la licence ne se compte ainsi »** : c'est une histoire qu'on ne
     connaît pas.
   · **Un forfait de 2 appareils a été posé sur La Samaritaine** le 4 septembre
     2026, à la demande de Julien, pour exercer le verrou pour de vrai. C'est
     le seul magasin où il mord ; **Oberlin Lyon reste sans forfait**, et c'est
     voulu — c'est le compte de démonstration des captures, un refus au milieu
     d'une passe de captures serait une plaie. Ne pas lui en poser un sans
     raison.
   · **⚠️ ET LE VERROU SE VÉRIFIE AVEC LE BON COMPTE.** ⚠️ **CORRIGÉ LE
     5 SEPTEMBRE 2026 — cette note était fausse.** L'administrateur d'entreprise
     de Groupe Bon Marché est **`jthiongkay@gmail.com`**, le compte personnel de
     Julien (relevé en base). C'est pour cela qu'il reçoit les e-mails d'alerte
     de ce magasin. La section « Appareils »
     de la fiche magasin, la notification et la bannière ne s'adressent qu'à
     l'administrateur : depuis un autre compte, il n'y a rien à voir — et ce
     n'est pas une panne. Même piège que les inventaires de démonstration posés
     sur le mauvais compte, le matin même.

## ⚠️ LE SIGNAL COMMERCIAL N'EST PAS LE PIC, C'EST LE REFUS

Conséquence directe du verrou, et elle renverse ce qu'on aurait écrit
spontanément : **le pic ne peut plus dépasser le plafond, par construction**.
« Sept appareils ont compté sur un forfait de deux » n'arrivera plus jamais.

Ce qui dit qu'une offre plus large est devenue nécessaire, c'est donc le nombre
d'appareils **éconduits**, et `besoin` (`pic + refus` du jour le plus chargé),
qui estime ce qu'il aurait fallu.

- **⚠️ Le refus se compte UNE FOIS PAR APPAREIL, jamais par tentative.** Un
  téléphone éconduit redemande sa place toutes les trente secondes ; sans la
  colonne `appareils_actifs.refuse`, « douze refus » voudrait dire « une
  personne a patienté six minutes ». Ce chiffre décide d'une montée d'offre : il
  doit compter des appareils.
- **⚠️ `besoin` MAJORE, et l'écran ne l'affirme pas.** Deux appareils refusés à
  deux heures d'écart s'y additionnent alors qu'ils n'étaient pas simultanés.
  D'où « il vous en aurait fallu **au moins** N » — un test garde la formule.
- Un appareil refusé **ne tient aucune place** : les deux comptages du plafond
  excluent `refuse`.

## La page de tarifs annonce « Jusqu'à N » et invite à commencer (4 septembre 2026)

Deux détails demandés par Julien sur `/tarifs`, et les deux valent comme règle.

- **« Jusqu'à 2 / 20 / 100 appareils », jamais « 3 à 20 ».** Une borne basse
  n'aide personne à choisir — elle donne l'impression qu'on peut être « trop
  petit » pour une offre — et elle est de toute façon redondante : le palier en
  dessous dit déjà où il s'arrête. Le libellé vit dans `OFFRES[].plage`, donc il
  suit aussi sur `/souscrire` et dans le balisage schema.org ; un test vérifie
  qu'il porte bien le `max`.
- **« Commencer avec Essential », plus « Choisir Essential ».** « Choisir »
  décrit un tri, « Commencer avec » dit ce qui va se passer. Un test refuse le
  retour de l'ancien libellé.

⚠️ Vérifié au navigateur : la page débordait alors de **40 px** — le cube
décoratif `.deco-droite`, coupé par l'`overflow-x: clip` de la racine (règle du
30 août : `clip`, jamais `hidden`, sinon l'en-tête collant décroche). **Ce cube
a été retiré le 6 septembre 2026** (section « Les cubes du décor sont partis »),
donc le débordement vaut désormais zéro. La règle du `clip` ne bouge pas.

## ⚠️ LE VOCABULAIRE DE L'ÉCRAN — deux mots interdits

Constat de Julien le 4 septembre 2026, sur le premier jet : *« tu n'utilises
pas des mots adaptés au contexte, "sans assiette" n'est pas clair […] pareil
pour "votre pic de", un pic signifie que ça va redescendre après, donc pas
d'intérêt de passer à la tranche supérieure ».*

- **« Assiette » ne s'écrit jamais à l'écran.** C'est notre mot de
  facturation, il vient du droit fiscal ; le client lit **« forfait »**. Le
  terme reste dans le code et dans ces notes, jamais dans une phrase qu'il voit.
- **« Pic » non plus, et l'argument dépasse le vocabulaire.** Un pic redescend :
  affiché à un client, il l'invite à conclure qu'il n'a rien à changer. Ce qui
  appelle une décision, c'est qu'un appareil ait été **refusé**. La fiche du
  magasin n'affiche donc pas le pic — il reste dans ce que rend la base, pour
  notre propre usage.
- **⚠️ Et c'est « JUSQU'À », jamais « AU MOINS ».** `besoin` majore : le vrai
  besoin est **au plus** ce chiffre. Le premier jet écrivait « il en aurait
  fallu au moins 7 », c'est-à-dire l'inverse de la vérité. Un test fige la
  formule et interdit l'autre.

Les trois tuiles mènent chacune à un geste : *En train de compter*,
*Refusés · 30 derniers jours*, *Votre forfait*.

## ⚠️ LE PLAFOND EST LE HAUT DU PALIER, PAS LE NOMBRE DEVISÉ

La grille vend des paliers : Advanced, c'est « 3 à 20 appareils » pour 310 €. Un
client devisé sur 7 appareils paie Advanced et a donc droit à **20** — lui en
refuser un huitième lui vendrait moins que ce que la page publique lui promet.
`plafond_appareils` arrondit donc au haut du palier, et prolonge Enterprise par
tranches de dix **entamées**, exactement comme `prixCents` les facture.

Trois sources, dans cet ordre : `stores.devices` (l'assiette devisée), puis le
palier de `companies.plan` — **une souscription en ligne n'écrit PAS `devices`**,
vérifié le 4 septembre, sans ce repli un client Advanced n'aurait aucun plafond
—, puis rien.

⚠️ Les trois nombres (2, 20, 100) et la tranche de dix sont **la copie** de
`OFFRES[].max` et `SUPPLEMENT.par` de `web/lib/offres.ts` : le site et la base
ne compilent pas ensemble. Même duplication assumée que la grille de
`_shared/devis.ts`, même remède — un test compare les deux.

## ⚠️ L'OFFRE PROPOSÉE COUVRE LE BESOIN, ELLE NE MONTE PAS D'UN CRAN

Arbitré par Julien : un magasin Essential dont le besoin monte à 40 se voit
proposer **Enterprise**, pas Advanced. Lui proposer le rang suivant le
laisserait au-dessus de son forfait dès le lendemain, et il faudrait le
rappeler une semaine plus tard. `proposer()` (`web/lib/appareils.ts`) le fait ;
le prix vient de `prixCents`, jamais d'une addition faite sur place.

**⚠️ On n'écrit pas ce que l'interface fait déjà voir** (Julien, le même jour,
sur « Le changement se fait en ligne, tout de suite » : *« pas besoin de mettre
ce genre de phrase »*). Il y a un bouton, il est là — le dire ne fait que
diluer les phrases qui apprennent quelque chose.

**⚠️ Et le bouton dit l'ACTION, jamais le montant** (Julien, le même jour).
« Passer à Advanced », « Passer à 120 appareils » quand le palier ne change pas
de nom, « Créer le magasin » pour un magasin de plus. Jamais « Ajouter 20
appareils » — un bouton qui change de verbe selon le palier laisse croire qu'il
fait autre chose — et jamais « Payer 124 € et créer le magasin » : le prix et le
prorata sont écrits juste au-dessus, les répéter alourdit et fait douter de ce
que le bouton déclenche. Un test vérifie le préfixe « Passer à » sur cinq cas.

## L'identifiant, sur le téléphone

- **⚠️ Il vit dans le trousseau, et il DOIT y vivre.** `oublierCachesLocaux`
  balaie `AsyncStorage` à chaque `signOut` : rangé là, l'identifiant changerait
  à chaque relève d'équipe, et un téléphone partagé entre le matin et
  l'après-midi compterait pour **deux** appareils. Or c'est exactement
  l'argument de vente — « comptes illimités, deux appareils à la fois ».
- **⚠️ Il n'est relié à AUCUN compte**, et `appareils_actifs` n'a délibérément
  pas de colonne d'utilisateur. On compte des appareils, jamais des personnes
  (constat E3, 19 août 2026). Ce qui reste nominatif, et doit le rester, c'est
  `counts.counted_by`.
- **⚠️ La promesse est mise en cache, pas seulement la valeur.** Deux appels
  concurrents tireraient sinon deux identifiants, et un seul téléphone
  consommerait deux places.
- Conséquence assumée : réinstaller l'application peut changer l'identifiant
  (le Keystore d'Android est effacé à la désinstallation, le trousseau d'iOS
  non). L'ancienne place se libère seule en quatre-vingt-dix secondes.

## La cadence, et pourquoi c'est celle de la présence

**30 secondes entre deux signalements, 90 secondes de fenêtre côté serveur** —
c'est-à-dire `BEAT_MS` et `STALE_MS` de `lib/presence.ts`, à l'identique. Ce
n'est pas une coïncidence : si le verrou retenait une place plus longtemps que
le tableau de bord ne montre l'appareil, l'écran du superviseur dirait « un
appareil » pendant que le verrou en compterait deux. **Un seul silence, une
seule conclusion.**

La place est en outre **rendue au démontage** (`rendre_place_appareil`), sans
attendre l'expiration : sur un forfait plein, un collègue qui prend le relais
attendrait sinon une minute et demie pour rien.

- **⚠️ `usePlaceAppareil` ne se monte QUE sur l'écran qui compte** (`scanner.tsx`).
  L'assiette est « les appareils qui comptent en même temps » : un téléphone
  posé sur l'écran d'un inventaire ne compte pas, et lui faire prendre une place
  priverait un collègue de la sienne. Un test refuse le hook ailleurs.
- Le verrou sérialise les demandes concurrentes par un `for update` sur la ligne
  du magasin — sans lui, deux téléphones obtiennent la même dernière place. Le
  motif exact de VR-001, sur un autre objet.

## Le forfait trop juste se dit au client, et Quantinvo n'envoie rien

Julien, sur la maquette : *« on n'envoie plus de devis. Envoie une notification
du type "votre forfait semble être trop juste pour votre utilisation, n'hésitez
pas à passer à <nom du forfait>" avec un bouton découvrir. »* Le premier jet
faisait du dépassement une affaire de vendeur — « un magasin au-dessus de son
forfait est un devis à envoyer ». C'était le réflexe de l'ancien monde : depuis
que l'offre est publique, **le client n'a besoin de personne**, il lui faut
seulement savoir et savoir quoi prendre. La console ne sert plus qu'à voir
venir.

Migration `20260904220001`, type de notification `forfait_trop_juste`.

- **⚠️ Une fois par magasin et par MOIS.** Un appareil éconduit redemande sa
  place toutes les trente secondes ; sans ce repos, une matinée d'inventaire
  serré produirait des dizaines de notifications et la cloche deviendrait une
  chose qu'on ferme sans lire. Même règle que la mémoire d'`alertes_envoyees`.
  L'appel vit dans le `if not v_refuse`, donc au **premier** refus d'un
  appareil donné, jamais à chacune de ses tentatives.
- **⚠️ Seul l'administrateur d'entreprise la reçoit.** Un superviseur ne décide
  pas de la licence, un compteur encore moins — le leur dire ne ferait que
  déplacer une contrariété. Même périmètre que la section « Appareils ».
- **⚠️ `donnees` porte des NOMBRES, jamais un nom d'offre.** Le nom se déduit à
  l'affichage par `proposer()` (`web/lib/appareils.ts`), seul endroit qui
  connaisse l'échelle des paliers ; le figer en base en ferait une quatrième
  copie de la grille. Ce sont les nombres qui décrivent la situation, le nom
  n'en est que la lecture.
  · Limite assumée : `besoin` est figé au **premier** refus de l'épisode. Si la
    demande grossit ensuite, la notification propose un palier calculé sur ce
    premier constat — la fiche du magasin, elle, calcule en direct et fait foi.
- **⚠️ LES DEUX FILTRES DE LA CLOCHE, ET IL FAUT LES DEUX** :
  `notifications_type_check` **et** la liste blanche de `mes_notifications`. Un
  seul des deux suffit à rendre la cloche muette sans le moindre message
  d'erreur — leçon du 3 septembre, payée en direct. Un test le vérifie aux deux
  endroits.
- **⚠️ L'appel est ENVELOPPÉ dans un bloc d'exception.** Une notification qui
  échoue ne doit pas faire échouer la demande de place : `usePlaceAppareil`
  accorde sur toute erreur (borne 3), donc une cloche cassée désactiverait le
  verrou **en silence**. C'est le seul endroit du produit où avaler une
  exception est le moindre mal, et le mode de panne connu est fermé par le test
  ci-dessus, pas par de la chance.
- **⚠️ UNE BANNIÈRE DOUBLE LA CLOCHE, en haut à droite** (Julien, le même
  jour). La cloche attend qu'on l'ouvre — or un forfait trop juste est
  précisément ce qu'on ne va pas chercher : on ne sait pas encore qu'il y a
  quelque chose à savoir.
  · **Elle vit dans `Notifications.tsx`, pas dans `AppShell`**, pour une seule
    raison : la liste y est déjà chargée. Un second `mes_notifications` à
    chaque page serait du bruit pur. Sa position est `fixed`, l'endroit du DOM
    où elle est rendue n'a donc aucune importance.
  · **Ce n'est pas un toast** : elle ne s'efface pas toute seule, parce qu'elle
    porte une décision et non un accusé de réception.
  · **Une fois par session ET PAR AVIS** — la clé de `sessionStorage` porte
    l'identifiant. Sans lui, le premier refus de l'année ferait taire tous les
    suivants.
  · **⚠️ Tout accès à `sessionStorage` est protégé** : il lève en navigation
    privée, et la bannière ferait tomber la cloche entière. Sans mémoire, elle
    s'affiche — montrer deux fois vaut mieux que jamais.
- **⚠️ L'APPEL À L'ACTION NOMME L'OFFRE : « Découvrir Advanced ».** « Découvrir »
  seul ne dit pas quoi, et une invitation sans objet ne fait pas agir (Julien,
  4 septembre 2026). Le nom vient de `proposer()`, jamais d'une chaîne écrite
  sur place.
- **Il porte le DESSIN PLEIN des autres boutons du produit** (`btn btn-primary
  btn-sm`), à l'identique dans la cloche et dans la bannière. Une pastille en
  contour se lisait comme une étiquette et n'incitait à rien — premier jet,
  corrigé le jour même.
- **⚠️ Mais dans la cloche c'est un `span`, pas un `button`**, et ce n'est pas
  négociable : le rang entier est déjà un bouton, un `<button>` imbriqué n'est
  pas du HTML valide (les navigateurs s'en sortent au hasard) et deux cibles
  pour un seul geste se disputent le clic. Le `span` hérite du clic du rang,
  qui mène au même endroit. Dans la bannière, qui n'est pas un bouton, c'est un
  vrai `<button>`. Deux tests figent les deux moitiés de cette règle.

## La console voit venir, elle n'agit plus

`appareils_des_magasins(company_id)` rend l'état de **tous** les magasins d'une
entreprise en un seul appel — une boucle par magasin serait le motif retiré
partout ailleurs pour la tenue en charge. Une ligne par magasin sur la fiche
entreprise : pastille (`Forfait trop juste` / `Dans le forfait` / `Forfait non
défini`), appareils en train de compter, forfait, refus sur trente jours, et
l'offre qui couvrirait le besoin.

- **⚠️ EN LECTURE SEULE, sans un seul bouton.** On n'envoie plus de devis : le
  client est prévenu tout seul et change d'offre lui-même. Un test refuse
  `<button>`, `<Link>` et le mot « devis » dans ce bloc.
- **⚠️ Elle ne rend pas `pic`**, et c'est délibéré : depuis que le verrou ferme
  la porte, il ne peut plus dépasser le plafond. Le rendre inviterait à s'en
  servir. Un test l'interdit.
- Le jugement est celui de la fiche du magasin — `lireAppareils` ne demande
  plus que le plafond et le besoin, pour que les deux écrans lisent la même
  règle à partir de deux sources qui ne rendent pas les mêmes colonnes.

## ⚠️ Un `fichierDe(fn)` ne parle QUE de `fn`

Trouvé en écrivant ces gardes, et c'est une variante neuve d'un piège connu.
`web/tests/decompte-appareils.test.ts` lisait « le fichier de
`prendre_place_appareil` » pour y vérifier les droits des **trois autres**
fonctions et la DDL des deux tables. Le jour où une migration a redéfini cette
seule fonction, `fichierDe` a rendu le nouveau fichier — qui ne contient rien
de tout cela — et trois assertions sont tombées.

Elles avaient raison de tomber : elles ne validaient plus rien depuis la
première seconde de la nouvelle migration. **`derniereDefinition` et
`fichierDe` répondent « la dernière définition de CETTE fonction »** — c'est
tout leur intérêt, encore faut-il les appeler une fois par fonction plutôt que
de se servir du fichier de la voisine.

## L'écran de refus ne cite aucun prix

Il s'ouvre devant un compteur, souvent un saisonnier, debout dans un rayon : une
proposition commerciale n'a rien à y faire, et il n'a de toute façon pas la
main. Il dit la seule chose vraie et utile — attendre suffit — et renvoie au
responsable, qui décide sur le site. Un test refuse « € », « Essential »,
« Advanced », « Enterprise » et « offre » dans ce bloc.

Symétriquement, **la section « Appareils » du site est réservée à
l'administrateur d'entreprise et à Quantinvo** : elle passe par
`peut_lire_rapport_magasin`, la même porte que le rapport consolidé. Ce n'est
pas une donnée d'inventaire, c'est l'état d'une licence.

## Vérifications

- **En base, en transactions annulées, sur les fonctions réellement
  appliquées** : le troisième appareil refusé sur un forfait de deux, l'appareil
  déjà présent qui garde sa place, la clé invalide, l'étranger à l'inventaire
  refusé, la place rendue puis reprise par le refusé, la lecture accordée à
  l'administrateur d'entreprise et **refusée à un compteur (42501)**, la RLS qui
  ferme les deux tables même à `authenticated`, et **sans plafond aucun refus**.
- **La dé-duplication des refus est prouvée** : un appareil refusé cinq fois et
  un second refusé une fois donnent `refus = 2`, pas 6.
- **Le dépôt et la base sont identiques** : les quatre corps de fonction, une
  fois commentaires et blancs normalisés, ont la **même empreinte MD5**.
- **Les gardes mordent** : cinq sabotages (borne 1 retirée, refus compté à
  chaque tentative, plafond ouvert à `authenticated`, un prix dans l'écran de
  refus, la place prise sur l'écran d'un inventaire) font échouer exactement les
  cinq tests correspondants.
- **Au navigateur**, par route jetable (retirée, `git status` contrôlé), clair
  et sombre, à 1280 px et 900 px : les quatre états, **débordement horizontal
  nul**.
- 1 001 tests du site, 416 de l'application, `tsc --noEmit` des deux côtés,
  `eslint .` à zéro erreur, `next build` avec la table de routes inchangée.
- **Zéro résidu contrôlé** : 0 ligne dans les deux tables, 165 comptages,
  2 magasins sans assiette — comme avant.

⚠️ **NON VÉRIFIÉ, ET IL FAUT LE SAVOIR : rien ne mesure encore.** L'identifiant
et la demande de place vivent sur le téléphone — **il faut un build**. D'ici là
les écrans afficheront zéro appareil et le verrou ne mordra pas, ce qui est
exact : aucun téléphone ne sait encore demander sa place. Et aucun magasin n'a
d'assiette, donc le verrou resterait muet même avec le build.

## Le libre-service a été construit dans la foulée

Cette section annonçait un chantier ; il est fait le jour même. Voir « Le
libre-service : changer d'offre, ajouter un magasin » plus bas. Ce qu'elle
prévoyait tient toujours — un abonnement par entreprise, un article par
magasin — à un ajustement près : **un client qui n'a pas encore d'abonnement
passe par une session Checkout ordinaire**, et c'est le cas de tout le monde
aujourd'hui.

Tests de garde : `web/tests/decompte-appareils.test.ts`.

## ⚠️ Piège de méthode du jour — `tsc | head` rend le code de sortie de `head`

J'ai poussé un JSX cassé. La commande était
`npx tsc --noEmit 2>&1 | head -3 && npx vitest run && git commit …` : `tsc` a
bien signalé trois erreurs, mais **le code de sortie d'un tube est celui de sa
dernière commande** — `head`, qui réussit toujours. Le `&&` a donc laissé passer
le commit.

C'est mot pour mot le piège de `./scripts/pixel.sh | tail -5` (31 août 2026),
sur un autre outil. **Ne jamais filtrer la sortie d'un contrôle qui garde un
`&&`** : lancer le contrôle seul, lire son code de sortie, puis enchaîner. Et
`next build` avant de pousser, pas seulement les tests — c'est lui qui compile
réellement le JSX.

Corrigé dans la foulée : un commentaire `{/* … */}` ne peut pas être le premier
enfant d'un `cond && (…)` qui rend un seul élément. Il se pose **avant** la
condition.
