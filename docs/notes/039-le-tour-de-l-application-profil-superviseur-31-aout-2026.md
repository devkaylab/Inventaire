# Le tour de l'application — profil superviseur (31 août 2026)

Même maquette, même règle posée par Julien : *« tu ne changes rien, tu adaptes
uniquement le contenu ».* Deux repères ajoutés, deux textes adaptés — et une
pièce de la maquette **abandonnée**.

| pièce | où | nature |
|---|---|---|
| Balise, emplacement, plage | Zones | repère `balises-vocabulaire` |
| Deux fichiers, deux rôles | Fichiers | repère `fichiers-roles` |
| Le choix du mode est définitif | Nouvel inventaire | **texte**, forme inchangée |
| La clôture compte ce qui reste | Fiche d'inventaire | **texte**, forme inchangée |

## ⚠️ « La progression compte des balises » n'a PAS été ajouté

La maquette le proposait. **L'écran le dit déjà**, mot pour mot : « % des
balises comptées », « % des balises auditées ». Un repère qui explique ce qui
est écrit à l'écran n'est pas un repère, c'est du bruit — et il aurait
consommé le crédit d'attention des trois autres. En mode classique la question
ne se pose pas non plus : l'écran affiche un **nombre de pièces**, pas un
pourcentage. Un test fige cette absence, pour qu'on ne « complète » pas un jour
en croyant qu'il manque.

## Ce qui porte ces quatre pièces

- **⚠️ Deux ne sont pas des repères mais des adaptations de texte**, et la forme
  ne bouge pas : le choix du mode reste un `Switch` — pas les deux cartes de la
  maquette — et la clôture reste le même `demander`. Un test vérifie les deux.
- **Le texte du mode ne décrit plus le mécanisme, il dit ce que le choix
  CHANGE** — compter à plusieurs sans se gêner, l'avancement rayon par rayon —
  puis, seul en gras, **ce qu'on ne peut pas deviner : « Ce choix ne se change
  plus après la création. »** Le mécanisme, on le découvre à l'écran suivant ;
  l'irréversibilité, jamais.
- **La confirmation de clôture COMPTE CE QUI RESTE** : « 3 balises sur 10
  n'ont pas été comptées. Elles compteront pour zéro dans le rapport. » C'est
  le seul chiffre qui puisse faire changer d'avis, donc il passe **avant** le
  reste du texte. Aucune requête nouvelle — `zoneMissing` est déjà sur l'écran.
- **Les deux repères sont posés sur des écrans qui DÉFILENT** (`zones.tsx` et
  `import.tsx` sont des `ScrollView`). Même règle que côté compteur : une carte
  ne s'insère que là où elle ne peut rien faire déborder.

## Vérifications

Au simulateur, par une route jetable (retirée, `git status` contrôlé), **clair
et sombre** : les deux astuces et le texte du mode. Aucun débordement, aucun
signe double en tête de ligne, l'icône alignée sur la première ligne.
Espaces insécables renforcées là où une largeur plus étroite couperait mal
(« étiquette à scanner : », « 1000 à 1049 »).

⚠️ **Non vu dans l'application elle-même** : ces écrans demandent une session de
superviseur, et le téléphone de test est connecté en compteur. Ce qui est
vérifié, c'est le rendu des composants avec leur texte réel — pas leur place
dans l'écran complet.

Tests de garde : `tests/compte.test.ts`, bloc « le tour de l'application, côté
superviseur ».
