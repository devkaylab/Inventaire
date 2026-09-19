# Le build de rattrapage, éprouvé sur le Pixel (7 septembre 2026)

*« Run les tests du build qu'on devait faire hier, tu peux utiliser le pixel. »*
Trois chantiers attendaient un build pour exister sur un téléphone : Ardoise et
Registre dans l'application (6 septembre), le mot-symbole de l'écran d'ouverture
et la zone de comptage (7 septembre). APK construit par `./scripts/pixel.sh` et
installé à 19:39:52 — date relevée sur `dumpsys package`, pas déduite.

## Ce qui a été vu, appareil en main

| | Constaté |
|---|---|
| Écran d'ouverture | **« Quantinvo »** en Archivo, plus `QUANTINVO` espacé ; marque à 28 % de la largeur ; l'allée balaie |
| Ardoise | encre, papier, vert forêt, or de l'audit ; cartes sans ombre ni bordure ; **boutons à coins ronds**, blocs à coins nets |
| Sélecteur de thème | les **trois** positions (système / clair / sombre) répondent — `userInterfaceStyle: automatic` et le plugin force-dark tiennent |
| Registre — Rapport | titre en serif, filets d'encre, nombres et codes en chasse fixe, bouton d'export **en accent** (plus le vert du succès) |
| Registre — Écarts | idem, et **les deux zéros sans couleur** (règle du 29 août) |
| Zone de comptage | le formulaire s'ouvre **directement** (des emplacements existent, la question ne se pose plus), la bascule « Une seule balise » passe bien de **deux champs à un**, « Créer d'autres balises » en lien discret, flèche de retour présente |
| Décompte d'appareils | **une place prise** à l'ouverture du comptage, **rendue à la sortie sans attendre les 90 s**, pic du jour à 1, zéro refus |

⚠️ **L'en-tête vert de l'écran de comptage n'est PAS un défaut** — vérifié dans
le code avant de le signaler : `headerStyle` prend la couleur du mode (accent
pour compter, or pour auditer). C'est le langage des deux passes, pas un oubli
d'Ardoise.

⚠️ **ZÉRO ÉCRITURE SUR LES DONNÉES DE JULIEN**, contrôlé en base après coup : la
balise 1000 garde sa date de clôture du 2 septembre, la 1001 reste `pending`,
les 10 comptages sont intacts. La règle du 25 août — *consulter n'écrit rien* —
tient sur ce build.

## Deux observations mineures, à reprendre si le sujet revient

- **Le titre de la carte d'affectation ne suit pas la bascule.** Il reste
  « Affecter une **plage** à un emplacement », et sa description parle de
  plages, alors qu'un seul champ « Balise » est à l'écran. Le message d'erreur,
  lui, suit déjà (`validateRange(..., unique)`). Vaut pour les deux surfaces.
- **« Les articles apparaîtront après le comptage »** s'affiche sur les écarts
  d'un inventaire qui a **déjà** 10 pièces comptées mais aucun audit. La phrase
  devrait parler de l'audit.

## Ce qui n'est TOUJOURS pas vérifié, et pourquoi

- **Le mode avion** (le hors ligne du 2 septembre, et le catalogue par delta du
  4). L'éprouver demande de scanner, donc **d'écrire dans les données de
  travail de Julien** : ce n'est pas à moi de le décider. C'est le scénario
  qu'il a lui-même joué pour trouver le défaut.
- **Le va-et-vient du tunnel de préparation** — il faut créer un inventaire
  pour y entrer.
- **L'export du rapport** (Registre sur le fichier Excel) — il ouvre une feuille
  de partage.

Ces trois-là sont les mêmes que la veille : ils ne se prouvent qu'en écrivant.
