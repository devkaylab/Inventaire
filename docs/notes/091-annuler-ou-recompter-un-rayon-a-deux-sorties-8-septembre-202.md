# Annuler ou recompter : un rayon a deux sorties (8 septembre 2026)

Constat de Julien : *« "rien n'est effacé", normalement ce qu'on souhaite en
rescannant une balise = corriger ce qui a déjà été compté, donc on remplace. En
revanche si on clôture en faisant retour ou avec les boutons dédiés sans rien
scanner, là on n'efface rien, c'est le résultat d'un cancel. »* Plan validé
avant codage : https://claude.ai/code/artifact/bd8b09f6-6e21-4f51-9ec0-fb59a8d828b8

## ⚠️ L'ÉCRAN N'AVAIT QU'UNE SORTIE, ET ELLE MENTAIT DEUX FOIS

Clôturer **annonce un rayon fini**. Quelqu'un qui ouvrait la mauvaise balise
n'avait donc aucun geste juste : clôturer écrivait une donnée fausse dans le
rapport, et partir laissait la balise ouverte — donc **absente de la liste des
balises à reprendre**, ses pièces introuvables sans rescanner l'étiquette.

Et la carte de réouverture promettait « vos scans viendront s'ajouter à ce
total », c'est-à-dire l'inverse de ce qu'on vient faire la plupart du temps.

## Les quatre gestes, et ce qui les sépare

| Geste | Ce qu'il touche |
|---|---|
| **Clôturer** | rien n'est effacé, le rayon est déclaré fini |
| **Annuler** | ce que CET appareil a écrit depuis l'ouverture, et rien d'autre |
| **Compléter** | rien — on ajoute, et la liste de ce qui est déjà là s'ouvre |
| **Recompter à zéro** | tout le contenu de la balise, **pour toute l'équipe** |

## ⚠️ « ANNULER » DÉFAIT LES SIENS, « RECOMPTER » DÉFAIT CEUX DE TOUS

C'est la borne que Julien a posée lui-même, et c'est ce qui rend les deux
gestes tenables côte à côte. Ne jamais les rapprocher.

- **Chaque scan s'écrit en base au moment où il est fait** : « rien ne sera
  enregistré » se tient par des lignes **négatives**, pas par une suppression.
  `counts` reste un journal en ajout pur — c'est déjà ce qu'écrit le « − » de
  la liste, et aucun droit nouveau n'a été ouvert pour ça.
- **⚠️ LA ZONE D'ABORD, LES LIGNES ENSUITE.** `annuler_balise` part en direct
  (pas de file d'attente, comme `vider_balise`) : sans réseau elle échoue, et
  dans cet ordre **rien n'a encore été touché**. L'ordre inverse laisserait un
  comptage à moitié défait dans une balise restée ouverte.
- **⚠️ ANNULER NE REMET PAS TOUJOURS « À FAIRE ».** Une balise qu'on rouvrait
  pour compléter doit **redevenir terminée** : la remettre à faire la
  décompterait, et c'est le défaut du 25 août. D'où `etatAvantRef`, posé à
  l'ouverture. Une ouverture différée jamais matérialisée n'a rien écrit côté
  serveur : il n'y a rien à défaire.
- **`annuler_balise` existe parce que `set_balise` ne sait pas dire
  « pending »** — elle ne connaît que « ouvert » et « terminé ». C'était le
  trou.

## ⚠️ LE DROIT DE VIDER EST OUVERT AUX COMPTEURS, ET LA PASSE LE BORNE

`vider_balise` passe de `can_access_session` (superviseurs) à
`membre_ou_superviseur` — demande explicite de Julien. Deux choses à ne pas
défaire :

- **⚠️ Ce n'est PAS le DELETE fermé par VR-007.** Là, le client choisissait son
  critère ; ici le périmètre est fixé par le serveur — UNE balise, nommée, d'un
  inventaire dont il est membre, non clôturé — et le geste laisse une trace
  dans `company_audit_log`. Ne jamais l'élargir à une liste ni à un filtre
  libre ; un test refuse un paramètre tableau.
- **⚠️ `p_passe` borne la destruction au cycle en cours.** Sans elle, recompter
  à zéro depuis l'écran d'**audit** emporterait le comptage de la passe 1 — le
  travail d'une autre équipe, souvent d'un autre jour. Décision prise seule et
  signalée : Julien a demandé « travaille sur les deux, c'est important », ce
  qui veut dire que le geste doit **exister** dans les deux modes, pas qu'il
  doit effacer les deux passes. **Le site, lui, appelle sans passe** : son
  geste à lui vide la balise entière, et il le dit.
- **⚠️ L'ancienne signature `(uuid, text)` est SUPPRIMÉE** : `p_passe` ayant un
  défaut, Postgres garderait les deux et un appel à deux arguments deviendrait
  ambigu (piège de `p_event_id`). Le site ne change pas — PostgREST appelle par
  NOMS de paramètres.

## Une seule carte pour rouvrir, quel que soit le chemin

Le scan, la saisie du numéro et le rang « Rouvrir » posent la **même** question.
Trois questions différentes pour un même acte apprennent à répondre sans lire —
et c'est ce qui s'était installé : le 25 août la liste avait la sienne, le
2 septembre la carte du scan ne parlait plus que des autres, le 7 septembre le
scan n'en posait plus aucune.

- **⚠️ « Compléter » MONTRE ce qui est déjà là** (`setFeuilleScans(true)`).
  Compléter à l'aveugle, c'est rescanner ce qui est déjà compté — donc doubler,
  ce qu'un journal en ajout pur ne rattrape pas tout seul.
- **Un rayon vide clôturé garde la question courte** : rien à compléter, rien à
  effacer, donc aucun choix à poser.
- **La carte ne nomme personne** : un compteur ne voit que ses propres lignes
  (`counts_select_own`), et le suivi a été dépersonnalisé le 19 août.
- **Le bandeau de zone n'a plus de bouton** (« il fait doublon », Julien) : le
  même geste à deux endroits de l'écran fait douter qu'il s'agisse du même, et
  les deux sorties ne se lisent que l'une à côté de l'autre.
- **⚠️ « Annuler » est en CONTOUR, jamais un second aplat.** Deux boutons pleins
  côte à côte se disputent le regard, et c'est le geste normal — clôturer — qui
  perdrait.

## Le retour pose les trois issues

Clôturer / Annuler / **Ignorer**. ⚠️ La décision du 29 août tient : le troisième
bouton fait **rester**, il ne laisse pas partir en abandonnant une balise
ouverte. Et chaque branche réutilise SA confirmation — on ne remplace pas une
question par une autre.

## Vérifications

- **Essai à blanc AVANT d'appliquer**, en transaction annulée, sur les données
  réelles de « Rayon textile » : un compteur vide la passe comptage (3 lignes),
  **la passe 2 reste intacte (0/3)**, statuts `pending / done`, la balise
  voisine inchangée, journal écrit avec la passe ; `annuler_balise` par un
  compteur ne détruit rien (6 lignes conservées, seul le cycle repasse à
  `pending`) ; passe et mode invalides refusés ; étranger refusé sur les deux ;
  l'appel à deux arguments du site vide toujours tout ; une seule signature ;
  `anon` sans droit. **Zéro résidu contrôlé** après annulation.
- **Six sabotages, six échecs** — après resserrement de deux gardes molles.
- 512 tests de l'application, 1 346 du site, `tsc --noEmit` des deux côtés,
  `eslint .` à zéro erreur, `next build` avec la table de routes inchangée, et
  la mesure de dérive à zéro.

**VÉRIFIÉ PAR JULIEN SUR LE PIXEL, le 8 septembre 2026** : « c'est bon j'ai fait
le test, c'est parfait ». C'était le seul contrôle qui comptait pour ce chantier
— son écran était verrouillé de mon côté et je n'ai pas le code, donc je n'avais
rien pu voir de l'interface.

⚠️ **DEUX GARDES QUI NE MORDAIENT PAS**, toutes deux du même genre :
· `web/tests/zones.test.ts` exigeait `can_access_session` dans `vider_balise` —
  et **passait au vert sur mon propre commentaire**, qui cite le mot pour dire
  qu'on ne l'emploie plus. Douzième variante.
· la même garde cherchait `revoke all on function …` par `toContain` : un
  `-- revoke …` commenté contient la phrase, donc le sabotage passait. **Une
  garde sur une ligne de droits s'ancre en DÉBUT DE LIGNE.** Treizième variante.
· et `signatureDe()` (`web/tests/migrations.ts`) **déduit** désormais la
  signature : citer `(uuid, text)` en dur faisait tomber la garde le jour où la
  fonction gagne un paramètre — sur du code juste, après avoir validé une
  définition qui ne tournait plus.

Tests de garde : `tests/comptage.test.ts` (blocs « rouvrir un rayon : une seule
carte » et « annuler un comptage »), `tests/compte.test.ts` et
`web/tests/zones.test.ts`.
