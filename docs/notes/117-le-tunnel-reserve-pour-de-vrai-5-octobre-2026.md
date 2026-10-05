# ⚠️⚠️ Le tunnel réservait… rien. Et le pro qui revient — 5 octobre 2026

> « Un pro qui revient avec une adresse connue en tant que client doit pouvoir
> louer Quantinvo s'il le souhaite. »

La demande venait d'un point signalé la veille : la fonction edge `inscription`
répond « vous avez déjà un compte, il n'y a rien à créer » à une adresse connue,
et renvoyait vers `/login`, qui ne sait rien d'une réservation en cours.

## ⚠️⚠️ Ce qu'on a trouvé en cherchant où brancher ce cas

**Le tunnel `/reserver` ne créait AUCUNE réservation.** Son seul appel serveur
était l'envoi d'un code d'inscription ; `reserver_ma_mission` n'était appelée de
nulle part dans le site — seule `reserver_un_groupe`, depuis la page de
réservation groupée, y touchait.

L'écran d'arrivée affirmait pourtant :

> « L'empreinte bancaire n'est pas encore branchée. **Votre réservation est
> enregistrée avec ce prix** ; nous vous écrivons dès que le paiement ouvre. »

Elle ne l'était pas. Ni pour un visiteur, ni pour un client déjà connecté. Le
tunnel posait trois questions, calculait un prix juste, et jetait tout.

Le pro à l'adresse connue n'avait donc pas un problème de message : il n'avait
nulle part où arriver. **Répondre à sa demande, c'était fermer ce chemin.**

## Ce qui a été construit

`reserverMaMission()` dans `web/lib/onDemandClient.ts`, appelée par les deux
boutons « Réserver » quand la personne est connectée.

**Aucun montant ne part du navigateur.** Ce qui est envoyé, ce sont les
réponses ; `reserver_ma_mission` recalcule le prix en base — « laisser le client
porter un montant, c'est le laisser réserver à un centime » (`docs/notes/074`).

Le pro qui revient se connecte par « J'ai déjà un compte », qui existait depuis
le début, et **la connexion enchaîne la réservation** : le bouton dit « Se
connecter et continuer », l'envoyer sur un écran d'attente serait lui faire
recommencer.

### La raison sociale se demande, elle ne se devine pas

Un pro connecté n'a pas forcément d'entreprise utilisable — et depuis le même
jour, un compteur invité chez quelqu'un d'autre n'en a plus : celui qui paie
devient le client, avec la sienne (`docs/notes/116`). Le tunnel ne l'a jamais
demandée à un client connecté.

L'écran **ne relit pas `profiles.role` pour deviner le cas** : il recopierait une
règle qui vit en base, et les deux divergeraient le jour où elle change. Il
tente, et si le serveur refuse avec le code `entreprise`, il demande la raison
sociale et réessaie. Le serveur décide.

## Trois défauts trouvés en chemin

**Le bouton « Réserver » du récapitulatif n'avait pas le verrou de vente.**
Celui de l'écran du prix l'avait ; celui du récapitulatif, non. Tant que rien
n'était enregistré, ça ne se voyait pas — le jour où il réserve pour de vrai, il
vendrait pendant que `web/lib/legal.ts` est incomplet. Et **en formule logiciel,
c'est LUI l'action principale** : le parcours s'arrête à la date, l'écran du prix
n'est jamais atteint.

**Un bouton mort ne disait pas pourquoi.** Mesuré au volet juste après avoir posé
le verrou : bouton gris, pas un mot. L'explication vivait sur l'écran du prix,
que ce parcours n'atteint pas. Elle est maintenant sous le bouton.

**L'écran du prix n'avait aucun endroit pour une erreur.** Normal : il ne parlait
pas au serveur. Un refus rendu par la base — « cette date est trop proche » — ne
se serait écrit nulle part.

## L'e-mail de l'adresse connue

Il annonçait un refus (« il n'y a rien à créer ») et renvoyait vers `/login`. Il
ramène maintenant là d'où la personne vient, et dit quoi faire : « Reprenez où
vous en étiez et choisissez *J'ai déjà un compte* ». Le tunnel conserve le
parcours par navigateur (`quantinvo-reserver`), donc rien n'est à retaper.

⚠️ **Et le retour est sur LISTE BLANCHE.** `inscription` sert DEUX tunnels —
`/inscription` (l'abonnement) et `/reserver` (la location). Chaque page dit d'où
elle vient ; la fonction traduit par une table, et ce qui n'y est pas retombe sur
`/login`. Un chemin recopié depuis le corps de la requête ferait de ce bouton une
**redirection ouverte signée Quantinvo**.

⚠️ L'écran d'arrivée du visiteur ne dit toujours pas si l'adresse est connue :
l'oracle d'énumération fermé le 28 août 2026 reste fermé. C'est l'e-mail, qui
n'atteint que le propriétaire de la boîte, qui dit la vérité.

## ⚠️ La fonction edge n'est PAS déployée

Le dépôt ne déploie rien. Le site, lui, part au push : il enverra `retour:
'reserver'` à une fonction qui l'ignore encore, et le bouton de l'e-mail
retombera sur `/login` — l'ancien comportement, pas une panne. Le déploiement de
`inscription` reste à faire, et il appartient à Julien.

## Ce qui a été vérifié

Au volet, sur `/reserver?formule=logiciel_seul`, déconnecté — **la page ne parle
pas au serveur dans cet état, le prix est calculé dans le navigateur, donc rien
ne pouvait être écrit** (le `.env.local` du site pointe sur la production) :

- tranche 10–20 000 → 6 appareils compris, 7 h estimées, **129 €** ;
- « Du mardi 20 octobre au mardi 27 octobre » — la fenêtre de sept jours ;
- le bouton « Réserver » **désactivé**, avec sa phrase sous lui ;
- aucune erreur de console.

Les écrans d'arrivée (la référence, et le renvoi vers la boîte mail) ne sont pas
atteignables tant que la vente est fermée : ils sont tenus par les gardes, pas
par une capture.

### Les gardes, et leurs sabotages

Onze de plus, onze morsures :

- le tunnel ne réserve plus → mord
- le navigateur porte un prix → mord
- le bouton du récapitulatif perd son verrou → mord
- un refus de la base perd sa phrase → mord
- l'arrivée redevient unique (« enregistrée » pour tout le monde) → mord
- l'écran devine le rôle au lieu de demander → mord
- le retour de l'e-mail est recopié, ou la liste blanche retirée → mord
- un tunnel ne dit plus d'où il vient → mord
- une clé mal nommée (`code_postal` → `codePostal`) → mord
- une clé envoyée que la base ne lit pas → mord
- une clé oubliée → mord

⚠️ **Et une garde qui ne mordait pas**, trouvée en la sabotant : elle lisait
`fn.slice(fn.indexOf('…'))`. `indexOf` rend `-1` quand la ligne a disparu,
`slice(-1)` rend le dernier caractère, et la garde passait au vert sur un fichier
saboté. L'ancre est désormais vérifiée avant d'être lue.

⚠️ Les deux dernières gardes valent le détour : **une clé mal nommée ne lève
rien.** `p_reponses ->> 'code_postal'` sur un objet qui porte `codePostal` rend
`null`, et la réservation est refusée pour une raison qui ne dit pas laquelle.
Aucun type ne protège — c'est du JSON des deux côtés. La garde lit les clés que
la fonction DEMANDE, dans la définition qui tourne, et vérifie les deux sens.

## Ce qui reste ouvert

- **Le paiement.** L'écran d'arrivée le dit maintenant au lieu de prétendre
  qu'une carte a été prise.
- **Le visiteur sans compte.** `ouvrirMonCompte` envoie un code… et l'action
  `creer` n'est jamais appelée : aucun compte ne se crée par ce tunnel. C'est le
  même chantier que le paiement, et il attend la même décision.
- **Déployer `inscription`** (ci-dessus).
