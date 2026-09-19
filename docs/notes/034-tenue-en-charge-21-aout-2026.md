# Tenue en charge (21 août 2026)

Question posée : « Quantinvo résiste-t-il à 200 magasins faisant un inventaire
avec 100 compteurs chacun, au même moment ? » L'étude a montré que **le mur
n'est pas le nombre de magasins, mais le nombre de compteurs d'un même
magasin**, et qu'il ne tenait pas à la puissance louée mais à deux endroits du
code. Les deux sont corrigés ; le reste est un curseur et une facture.

## Ce qui a été corrigé

**Les totaux se calculent sur le serveur.** `getCountTotals` téléchargeait
toutes les lignes de `counts` de l'inventaire pour additionner quatre nombres
dans le navigateur — rejoué toutes les huit secondes par tableau de bord
ouvert, soit des centaines de milliers de lignes par sondage sur un gros
inventaire. Remplacé par la RPC `get_session_count_totals` (migration
`20260821240001`). **Ne jamais y remettre un `select` sur `counts`.**

**Les téléphones ne rejoignent plus le canal temps réel** — contrat de présence
**v3**. En v2, chaque téléphone publiait sa présence sur le canal de
l'inventaire, et le service recopiait chaque battement vers *tous* les membres,
donc vers les 99 autres téléphones qui n'en font rien : un coût en n² pour un
service en n. Mesuré à cent compteurs : ~336 messages/s pour la seule présence,
plus ~1 000 pour le `sync` émis à chaque scan, contre un plafond d'abonnement
de 500/s tous magasins confondus — et une connexion ouverte par téléphone, pour
un plafond de 10 000.

En v3, le téléphone envoie son battement par **broadcast HTTP**
(`channel.httpSend`), sans jamais s'abonner, et seul le tableau de bord écoute.
Deux bornes de cadence, aussi importantes que le reste : au plus un message
toutes les 5 s (une rafale de scans est regroupée — c'est ce qui remplace le
`sync` par scan), au moins un toutes les 30 s (sinon le site croit l'appareil
parti à 90 s). L'identifiant d'appareil, que la présence portait comme clé de
canal, voyage désormais dans la charge (`k`).

**Le tableau de bord ne recalcule qu'une fois par minute.** Un
rafraîchissement fait reparcourir tous les comptages de l'inventaire (zones et
totaux) : le coût est le même que le déclencheur soit le sondage régulier ou un
scan qui vient d'arriver. La limite `AUTO_MIN_GAP_MS` de `useSessionLive` vaut
donc **pour tous les déclencheurs à la fois** — la poser sur le seul sondage ne
changerait rien un jour de gros inventaire, où les scans arrivent en continu.
À 200 magasins, cela ramène la charge de ~50 calculs par seconde à moins de 7.

Ce qui rend une minute acceptable, et qu'il ne faut pas retirer : la limite est
à **seuil franchi**, donc sur un inventaire calme le premier scan venu
rafraîchit tout de suite ; le bouton « Mis à jour… » de l'en-tête et le retour
sur l'onglet passent outre (`refresh(true)`) ; et les compteurs d'appareils
connectés ne passent pas par là, ils suivent les battements en direct.

Le sondage bat **plus vite** que la limite (15 s contre 60) : sinon un
rafraîchissement déclenché à la dixième seconde ferait sauter le sondage
suivant et l'écran pourrait rester deux minutes sans bouger.

La temporisation de 750 ms qui précédait a été retirée, et le motif vaut d'être
retenu : elle reportait l'appel à chaque message reçu, donc sur un inventaire
animé — où les messages arrivent plus vite que ça — elle ne parvenait jamais à
son terme. Ce déclencheur ne servait plus à rien, sans que cela se voie.

**Chaque section ne recharge que ce qu'elle affiche.** `LIVE_SCOPES` (page du
tableau de bord) donne la portée de `refreshLive` : `suivi` (avancement, totaux
et fil des scans), `zones` (Set up, Écarts — sans le fil), `aucun` (Rapport,
Équipe). Le Rapport reste vivant : il recharge le sien à chaque battement, et
c'est bien ce qui est à l'écran — mais il ne fait plus recalculer l'avancement
par zone dont sa page ne montre rien.

Deux pièges déjà rencontrés, à ne pas réintroduire :

- **Le premier chargement ignore la portée** (`chargerLive('suivi')` dans
  `refreshAll`). Le bandeau de progression est visible sur toutes les sections :
  s'en remettre à la portée afficherait un bandeau à zéro sur un lien direct
  vers le Rapport.
- **Changer de section recharge tout de suite**, sans passer par la limite. Les
  rafraîchissements joués pendant un détour par le Rapport n'ont rien rechargé :
  sans ce geste, revenir sur Suivi montrerait un avancement figé. Et extraire
  `refresh` de l'objet `live` avant de le mettre en dépendance d'effet — la
  présence change à chaque battement, dépendre de l'objet entier rechargerait
  l'inventaire à chaque appareil qui se signale.

**Le tableau de bord se repose quand rien n'est signalé.** Sur un inventaire
ouvert où personne ne scanne, le sondage se contente d'une passe toutes les cinq
minutes (`IDLE_MAX_MS`) au lieu d'une par minute. Le mobile signale ses scans
(battements `dirty`, et **la file hors ligne qui remonte** — `syncNow` appelle
`pingSession`, sans quoi un retour de réserve verserait des centaines de
comptages sans prévenir).

**La garde qui rend ce repos acceptable est `!channelReadyRef.current`** : le
repos ne s'applique que si le canal est ouvert. Un tableau de bord dont le temps
réel est tombé ne reçoit plus aucun signal — s'y endormir afficherait des
chiffres figés cinq minutes sans que rien ne l'explique. Ne jamais retirer cette
condition.

## Ce qu'il faut savoir avant d'y toucher

- **La double écoute du site est temporaire et nécessaire.** `useSessionLive`
  lit à la fois la présence v2 et les battements v3, et fusionne. Les
  téléphones déjà installés émettent encore en v2 : retirer `flattenPresence`
  avant que le nouveau build soit partout ferait disparaître de l'écran des
  équipes bel et bien au travail. Même règle que pour `get_session_activity` —
  code déployé d'abord, ancien chemin retiré ensuite.
- **`PRESENCE_V` n'existe plus** : deux constantes distinctes, `BEAT_V = 3`
  (contrat v3) et `LEGACY_PRESENCE_V = 2` (lecture de transition, côté site
  seulement). Ne jamais réutiliser un numéro de version en changeant le
  contrat.
- **Sécurité inchangée, et vérifiée à la source de Realtime** : le canal reste
  privé, les policies de `realtime.messages` s'appliquent à l'envoi HTTP comme
  à l'envoi par socket, et les messages publics circulent sur une file
  distincte de la file privée — une injection anonyme n'atteindrait pas le
  tableau de bord.
- **Piège** : le point d'entrée HTTP de Realtime répond **202 quoi qu'il
  arrive**. Un message refusé faute de droits est écarté en silence. `httpSend`
  qui réussit ne prouve donc pas que le message est arrivé : si le tableau de
  bord n'affiche aucun appareil alors que les téléphones comptent, chercher du
  côté des droits sur l'inventaire, pas du réseau.
- **Un téléphone, une clé, un émetteur** (corrigé le 22 août 2026). La clé
  d'appareil était tirée dans `useSessionPresence`, donc **à chaque montage**.
  Or deux écrans montent ce hook en même temps : l'écran de l'inventaire reste
  monté dans la pile sous l'écran de comptage. Un seul téléphone comptait pour
  deux appareils dès qu'on ouvrait le comptage — constat de Julien, capture à
  l'appui. La clé est maintenant un `const` de module (`DEVICE_KEY`), tiré une
  fois par lancement de l'application ; **ne jamais la redescendre dans le
  composant**.

  Corollaire : les écrans s'inscrivent dans une **pile** (`holders`), calquée
  sur la navigation — le dernier monté donne le mode — et il n'y a plus qu'un
  émetteur (`engine`). Le même défaut cassait `pingSession` en silence : le
  second montage écrasait la référence de l'émetteur, et son démontage la
  remettait à `null` alors que le premier écran vivait toujours, si bien que
  les scans ne réveillaient plus le tableau de bord. Changer d'écran dans le
  même inventaire **ne redémarre pas** l'émetteur (sinon l'appareil clignote),
  mais déclenche un `markDirty` — sans lui, fermer le comptage laisserait
  l'appareil affiché « en comptage » pendant trente secondes.
- Les deux modules `presence.ts` (site et mobile) restent **dupliqués
  volontairement** et doivent bouger ensemble. Tests de garde :
  `web/tests/charge.test.ts` et `web/tests/presence-summary.test.ts`.

## Ce qui reste ouvert

- **Index manquant** sur `counts (session_id, zone, pass_number)` :
  `get_zone_dashboard` agrège tous les comptages de l'inventaire à chaque
  rafraîchissement. Sans intérêt aux volumes actuels (quelques centaines de
  lignes) ; à reprendre avec des chiffres sous les yeux, pas au jugé.
- **Compute Micro** (`max_connections` = 60) : à monter le jour où le volume
  arrive. 20 000 compteurs à six scans/minute font ~2 000 écritures/s, une
  Micro en encaisse 200 à 400. C'est un curseur, pas un chantier.
- **Abonnement Realtime** : le plafond de dépense limite à 500 connexions
  simultanées. À retirer avant d'ouvrir beaucoup de magasins.
- **Sortie réseau** : `primeOfflineCache` télécharge le référentiel articles
  **par appareil**. Cent téléphones sur un catalogue de 10 Mo font 1 Go pour un
  seul magasin ; le forfait en inclut 250.
