# Le décompte d'appareils, éprouvé sur un vrai téléphone (4 septembre 2026)

Premier build Android portant le décompte. Tout ce qui vit sur le téléphone
n'avait **jamais tourné** : c'est fait, appareil en main, sur La Samaritaine et
son forfait de deux appareils.

| Ce qui n'avait jamais tourné | Constaté |
|---|---|
| Le téléphone prend sa place | ligne dans `appareils_actifs`, `refuse = false` |
| L'écran d'amorce n'en prend pas | aucune place tant que la caméra n'est pas accordée |
| Le pic s'enregistre | `appareils_par_jour.pic = 1` |
| La place est rendue en quittant | zéro place au retour, **sans attendre les 90 s** |
| Le verrou refuse le troisième | écran « 2 appareils comptent déjà », caméra fermée |
| Le refus se compte UNE FOIS | `refus = 1` après plusieurs réessais |
| La notification part | `forfait_trop_juste` déposée pour l'administrateur |
| L'écran se débloque seul | caméra rouverte ~10 s après la libération, sans un geste |

⚠️ **« VOTRE RESPONSABLE » SONNAIT FAUX, ET C'EST L'ÉCRAN QUI L'A DIT.** Julien,
lisant le refus depuis un compte de **superviseur** : il EST le responsable du
magasin. Élargir un forfait n'est pas son geste — c'est celui de
l'administrateur de l'entreprise, et c'est lui que l'écran nomme désormais.
Une formulation qui vise « le rôle au-dessus » doit nommer le rôle, pas la
relation : « votre responsable » change de sens selon qui lit.

⚠️ **UNE LIMITE DE MON BANC, PAS DU PRODUIT.** Les deux appareils qui occupaient
les places ont été insérés en base, donc sans passer par
`prendre_place_appareil` : le pic est resté à 1, et `besoin` (pic + refus) a
valu 2 au lieu de 3. La notification a donc proposé « les offres » au lieu
d'Enterprise. En vrai, deux appareils qui comptent portent le pic à 2 et le
besoin à 3. **Ne pas « corriger » `besoin` sur la foi de ce test.**

⚠️ **Piège du pilotage par `adb`** : un appui à des coordonnées relevées sur une
capture précédente atterrit ailleurs dès que la page a défilé. Le mien a ouvert
la confirmation de suppression d'un inventaire — annulée aussitôt, rien n'a été
détruit, et c'est la confirmation nommée qui a servi de filet. **Recapturer
l'écran avant chaque appui**, ou lire les bornes plutôt que de les déduire.

Données d'essai retirées, zéro résidu contrôlé : 0 place, 0 jour, 0
notification, 5 inventaires, 165 comptages, 2 magasins — comme avant.

## Le forfait trop juste part aussi par e-mail (4 septembre 2026)

Julien : *« pas besoin de proposer d'offre sur l'app je pense, site uniquement
et côté admin qui doit recevoir la même alerte de son côté (avec mail). »*

Le premier point était déjà tenu : l'écran de refus ne cite ni prix ni offre —
il s'ouvre devant un compteur debout dans un rayon, qui n'a pas la main. Un
test balaie désormais tout `src/` et refuse qu'un nom d'offre y apparaisse.

Le second manquait. L'administrateur voyait la cloche et la bannière, encore
fallait-il qu'il ouvre le site. L'alerte passe donc par le **tour de garde
horaire**, quatrième nature après paiement, purge et volume.

- **⚠️ ELLE NE REDÉTECTE RIEN.** Elle part des notifications DÉJÀ déposées par
  `prevenir_forfait_trop_juste` — celles de la cloche. Une seule détection,
  donc les deux canaux ne peuvent pas se contredire, et le repos de trente
  jours de la notification vaut pour les deux sans qu'on l'écrive deux fois.
  Une seconde règle aurait divergé de la première au premier ajustement.
- **⚠️ C'EST LA PREMIÈRE ALERTE DU TOUR DE GARDE QUI S'ADRESSE AU CLIENT.** Les
  trois autres vont aux administrateurs Quantinvo. D'où `destinataire`,
  `prenom` et `besoin` dans la charge — nuls pour les natures internes — et
  **deux messages distincts** : un seul qui les mêlerait dirait à un client ce
  qui ne le regarde pas.
- **⚠️ UN ÉCHEC DE NOTRE MESSAGE NE RETIENT PLUS CELUI DU CLIENT.** Le `catch`
  sortait en 500 : le client n'aurait rien reçu parce que notre alerte interne
  n'était pas partie. Il journalise et poursuit.
- **⚠️ ON NE MARQUE QUE CE QUI EST PARTI** (`clesEnvoyees`). Avant, tout était
  marqué dès qu'un message passait ; une alerte qui n'a pas pu être envoyée
  doit rester ouverte pour l'heure suivante.
- **Il ne se rappelle pas**, comme le volume : `o.nature not in ('volume',
  'forfait')`.
- **Pas de cinquième copie de la grille** : le nom de l'offre vient de
  `nomOffre` de `_shared/devis.ts`.

Vérifié **en vrai** : notification déposée, `declencher_alerte()` joué, réponse
`{"anomalies":1,"internes":0,"forfaits":1,"emailed":true,"memorise":true}` —
donc un message client, aucun message interne, et l'e-mail réellement envoyé.
Second tour : plus rien à signaler, il ne repart pas. Trois sabotages, trois
échecs. Données d'essai retirées, zéro résidu.

Tests de garde : `web/tests/alerte.test.ts`, blocs « le forfait trop juste part
aussi par e-mail » et « l'application ne vend rien ».
