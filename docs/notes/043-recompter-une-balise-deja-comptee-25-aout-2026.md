# Recompter une balise déjà comptée (25 août 2026)

Question de Julien : *« si un compteur recompte accidentellement une balise
déjà comptée par quelqu'un d'autre, ça efface le précédent compte ou ça
additionne ? »*

**Ça additionne, et rien ne s'efface jamais.** `counts` est en ajout pur :
chaque scan écrit une ligne, la table n'a **aucune policy UPDATE**, et
`set_balise` ne fait que basculer `count_status` / `audit_status` — elle ne
touche pas aux comptages. C'est le même principe qui permet les corrections :
un « − » écrit une ligne négative. Recompter une balise **double donc les
quantités**.

## Ce que voit un compteur, et ce qu'il ne voit pas

Le partage est plus fin qu'il n'y paraît, et il faut le connaître avant de
toucher à cet écran :

- **le détail des lignes est cloisonné.** `getMyScanEntries` demande bien
  toutes les lignes de la balise, tous compteurs confondus (« pour permettre
  la correction »), mais c'est la RLS qui tranche :
  `counts_select_supervisor` rend l'équipe entière, `counts_select_own`
  (`counted_by = auth.uid()`) ne rend que ses propres lignes. **La liste
  s'affiche donc vide à un compteur sur une balise faite par un collègue** —
  vérifié en base, transaction annulée : 0 ligne là où il y en a 29 ;
- **le total, lui, est partagé.** `get_zone_dashboard` est SECURITY DEFINER et
  somme tous les compteurs : le même compteur y lit « balise 1000 · done ·
  23 u. ». C'est la seule donnée que les deux rôles partagent.

## L'avertissement

Il n'y a donc **rien à ouvrir côté serveur** — les droits sur les lignes
restent ce qu'ils sont, et la donnée nécessaire est déjà sur le téléphone. Ce
qui manquait, c'était de la montrer **au bon moment** : à l'ouverture d'une
balise déjà terminée, une question nomme le total (« 13 pièces sur
3 références y sont déjà enregistrées. Vos scans viendront s'ajouter à ce
total : rien ne sera remplacé. »).

Quatre points à ne pas défaire :

- **⚠️ La question se pose AVANT `set_balise`.** Après, la balise serait déjà
  rouverte, et un refus obligerait à la reclôturer — ce qui déplacerait sa
  date de clôture pour rien. Un test de garde vérifie l'ordre des deux appels
  dans le fichier.
- **⚠️ Elle ne se pose PAS depuis « Revenir sur une balise ».** Ce rang affiche
  déjà le total et son bouton dit « Rouvrir » : la personne vient exprès. Une
  question de plus y apprendrait à cliquer sans lire, et la question ne
  servirait plus là où elle compte — le scan d'une étiquette qu'on croit
  neuve. D'où le paramètre `sansAvertir`.
  **⚠️ Amendé le soir même, à la demande de Julien** (« ajoute un pop up
  demande si l'user est sûr de vouloir rouvrir la balise, ça évite les manip
  accidentelles ») : ce rang pose désormais **sa propre** question, courte
  (`rouvrirDepuisListe`). Ce n'est pas l'avertissement ci-dessus qu'on y
  répète — celui-ci apprend un fait, celui-là demande une intention — et le
  motif a changé avec l'ouverture différée : rouvrir n'écrit plus rien, le
  risque n'est plus de perdre l'état de la balise mais de **compter dans un
  rayon fini** après un rang touché du pouce en faisant défiler, sur un écran
  dont la caméra est vive et le scan automatique actif. `sansAvertir` garde
  son sens : ne pas rejouer l'avertissement long.
- **Elle ne nomme personne.** Le total est partagé entre membres, le détail
  non : dire « comptée par Nadia » rouvrirait par l'interface ce que la RLS
  ferme. Un test le vérifie.
- **Elle lit le statut du mode en cours.** Une balise comptée mais pas encore
  auditée ne doit pas déclencher l'avertissement quand on vient l'auditer.
- Le code est normalisé comme en base (`norm_balise` : sans espaces, en
  capitales), sinon le numéro scanné ne retrouverait pas sa ligne.

Hors ligne, le tableau de bord est celui du cache : sans donnée, pas
d'avertissement. C'est la dégradation assumée — on ne devine pas.

## Un défaut du composant de dialogue, trouvé en l'exerçant

Les deux boutons d'une carte de question sont à `flex: 1`, donc à largeur
égale quelle que soit la longueur des libellés. Ils étaient aussi à `height`
**figée** à 44 px : sur la largeur d'un téléphone, « Compter quand même »
passe à la ligne et **le texte débordait de la pastille**. `minHeight`
remplace `height`, avec rembourrage et centrage — le bouton grandit, et le
`stretch` de la rangée donne la même hauteur à son voisin. Ne pas y remettre
une hauteur fixe : le défaut vaut pour toutes les cartes de l'application, pas
seulement celle-ci.

Vérifié au simulateur le 25 août 2026 sur les données réelles : la question à
l'ouverture de la balise 1 (13 pièces / 3 références), « Ne pas ouvrir » qui
**ne touche pas au serveur** (date de clôture inchangée, contrôlée en base),
et « Rouvrir » qui ouvre sans rien demander. Données remises comme trouvées —
50 comptages, 12 articles, balise reclôturée.

Tests de garde : `tests/compte.test.ts`, bloc « rouvrir une balise déjà
comptée ».
