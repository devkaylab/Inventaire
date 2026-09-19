# Les écrans du compteur, mesurés (31 août 2026)

*« Je pense qu'on a beaucoup travaillé sur le compte superviseur mais pas
compteur, sers-toi des skills de design pour vérifier les bugs d'affichage. »*
Deux défauts signalés, plus un audit.

## 1. « Clôturer la balise » chevauchait son voisin — CORRIGÉ

*« Le bouton clôturer en bas de page chevauche les autres boutons au-dessus,
voir les articles ou en attente de code, ça dépend du moment. »*

Mesuré sur le Pixel : **écart de 0 px**, le rouge dessiné PAR-DESSUS le coin
inférieur de la carte. Trois causes qui se cumulent, et il faut les trois :

- **`closeFooterBtn` n'avait pas de `marginTop`** — son voisin `voirScansBtn`
  n'a pas de `marginBottom`, donc rien ne les séparait ;
- **il porte une élévation** (`shadowButton`) : sur Android, un élément élevé se
  dessine **au-dessus** de ses frères. D'où « chevauche » et non « colle » ;
- **la colonne débordait**, et c'est ce qui explique « ça dépend du moment » :
  l'apparition de la rangée « Voir les N articles » change la hauteur totale.

⚠️ **La caméra est le seul élément qui cède la place** (`flexShrink: 1`,
`minHeight: 200`), les deux boutons sont en `flexShrink: 0`. Ne pas inverser :
le cadre suit, `rectCadre` travaille sur la hauteur **mesurée** (`onLayout`),
jamais sur la constante de 340 pt.

Vérifié sur l'appareil, au pixel : les deux écarts valent maintenant **8 dp**
(1841→1862 et 2000→2021), contre 0 avant.

## 2. Le bandeau blanc : Android repeignait l'app — CORRIGÉ

*« La page balises comptées change de couleur dark puis clair »*, puis, la
capture à l'appui : *« quand je passe en dark mode, l'app garde son bandeau
blanc au lieu de suivre le mode système ».*

⚠️ **Une première version de cette note concluait « ce n'est pas le force dark ».
C'était faux**, et l'erreur vaut d'être racontée : j'avais posé
`forceDarkAllowed=false`, vérifié qu'il était bien dans l'APK (`aapt2 dump`,
`0x0101058c=false`), constaté que le défaut persistait, et conclu trop vite. Ce
que je n'avais pas : **l'option développeur « Forcer le mode sombre » était
active sur le Pixel**, et elle est faite pour **ignorer l'opt-out des
applications** — c'est tout son objet.

**La preuve, en deux mesures.** Système en sombre, application relancée :

| | force-dark actif | `setprop debug.hwui.force_dark false` |
|---|---|---|
| bandeau | `#EFF3FF` (blanc) | `#0B0F19` — la vraie valeur |
| corps | `#08090C` | `#F7F8FA` — la vraie valeur |
| bouton « Rejoindre » | `#7361C9` délavé | l'indigo de la charte |

⚠️ **Le bouton est le témoin qui ne trompe pas** : `#7361C9` n'existe dans
aucune des deux palettes. C'est une **inversion de luminance à teinte
conservée** — la signature de l'algorithme d'Android, que le thème sombre de
l'app ne produit jamais (son accent est `#6366F1`, saturé). Quand une couleur
observée n'est dans aucune palette, ce n'est pas le code qui peint.

⚠️ **Et le bandeau sombre n'est PAS un défaut** : `headerBg` vaut `#0B0F19` en
clair et `#060910` en sombre — le « bandeau encre » de la charte, sombre dans
les deux thèmes, comme sur le site. C'est justement parce qu'il est
volontairement sombre que l'inversion d'Android le rendait **blanc**. Ne pas
« corriger » ça : un test fige les deux valeurs.

**Deux réglages, et ils ne valent que l'un par l'autre :**

- **`plugins/withAndroidForceDark.js`** pose `android:forceDarkAllowed=false`.
  Il protège tout le monde — sauf qui a activé l'option développeur, et là il
  n'y a rien à faire depuis le code. Cela ne peut pas passer par `app.json`
  (`userInterfaceStyle` n'écrit qu'une chaîne lue par expo-system-ui) et
  `android/` est généré : d'où le plugin.
- **`userInterfaceStyle` passe de `light` à `automatic`** — et c'est un **second
  défaut, réel**, trouvé en démontant le premier. Avec `light`, expo-system-ui
  posait `MODE_NIGHT_NO` sur l'activité, **`useColorScheme()` rendait toujours
  'light'**, et la préférence « Système » du sélecteur de thème ne pouvait
  **jamais** donner le sombre. Sur les deux plateformes, depuis toujours.

⚠️ **Et côté iOS, la même clé vit dans un fichier VERSIONNÉ.**
`ios/Inventaire/Info.plist` portait `UIUserInterfaceStyle = Light`, qui fige
`useColorScheme()` sur 'light' exactement comme MODE_NIGHT_NO le fait sur
Android. Contrairement à `android/`, `ios/` ne se régénère pas au build :
changer `app.json` ne suffisait pas, il a fallu **retirer la clé à la main** —
c'est ce que « automatic » veut dire. Un test le fige. Le piège se reposera à
chaque réglage de `app.json` qui touche l'iOS : vérifier ce que le plist
versionné en dit.

⚠️ **Les deux ensemble, jamais l'un sans l'autre** : `automatic` sans le plugin
laisserait Android repeindre l'app dès que le système passe en sombre. Un test
de `tests/compte.test.ts` refuse qu'on défasse l'un des deux.

**Ce qui a été écarté en chemin** : les cinq fichiers du gabarit Expo
(`themed-text`, `themed-view`, `hint-row`, `app-tabs.web` et leur
`@/constants/theme`) forment un **second système de thème** — la famille exacte
du bandeau blanc du 29 août — mais **aucun n'a d'appelant réel**, ils ne se
citent qu'entre eux. Code mort à supprimer un jour ; ce n'était pas la cause.

⚠️ **Sur le Pixel de Julien, l'option développeur reste à couper à la main** :
Options pour les développeurs → « Forcer le mode sombre ». J'ai posé
`debug.hwui.force_dark false` par adb pour la démonstration — ça ne survit pas
à un redémarrage.

## 3. L'audit déterministe, et ce qu'il a trouvé

⚠️ **Le script du skill `deterministic-design` exige un DOM : inapplicable.**
C'est la **méthode** qui se porte — mesurer plutôt que se fier à l'œil — et
l'équivalent Android existe : `uiautomator dump` donne les bounds exacts de
chaque nœud, la capture donne les couleurs. Outil dans le bac à sable
(`audit.mjs`) : collisions, alignements, rythme vertical, cibles tactiles.

Constat systématique sur les cinq écrans du compteur : **les cibles tactiles
sont sous le minimum Android de 48 dp**, et les pires sont partagées avec le
superviseur.

| cible | mesure | où |
|---|---|---|
| bouton thème et bouton profil | **32 × 32 dp** | `HeaderActions`, tous les écrans |
| « Clôturer » du bandeau de zone | **77 × 34 dp** | écran de scan |
| onglets Caméra / Manuel / Douchette | 39 dp de haut | écran de scan |
| « Quitter l'inventaire » | 45 dp | Ma progression |
| « Ouvrir » et le champ balise | 46 et 47 dp | écran de scan |
| lampe torche, et un bouton d'accueil | 40 × 40 dp, **sans libellé** | scan, accueil |

Rien de tout cela n'est corrigé — c'est une passe à part, et elle touche les
deux rôles.

## 4. La passe sur les cibles tactiles (31 août 2026)

Le minimum est **48 dp sur Android**, 44 pt sur iOS. Relevé écran par écran sur
le Pixel, puis corrigé.

⚠️ **Une cible se mesure zone tactile comprise, pas au rectangle de la vue.**
`hitSlop` n'apparaît PAS dans l'arbre d'accessibilité : la mesure brute
sur-signale, et la première lecture allait faire « corriger » la torche
(40 + 2×8 = 56, très bien) et les boutons d'en-tête (32 + 2×8 = 48, corrects).
**Le nombre pointe, le code tranche** — vérifier le `hitSlop` avant de toucher.

⚠️ **Et deux `hitSlop` voisins ne doivent pas se chevaucher.** Les deux boutons
d'en-tête font 32 dp avec un slop de 8, séparés de 8 : leurs zones mordaient
l'une sur l'autre de 8 dp, et dans cette bande c'est **le dernier rendu** qui
prend l'appui. **L'écart passe à 16** — les deux zones de 48 se touchent
exactement au milieu.

⚠️ **La pastille, elle, NE GRANDIT PAS, et c'est une leçon payée.** Premier
jet : 32 → 40 dp avec un slop de 4. Aucun gain — elle était **déjà** à 48 de
cible — et sur **iOS 26** les ronds remplissaient alors la **capsule que le
système dessine lui-même** autour des boutons de barre (Liquid Glass), d'où un
double habillage. Constat de Julien, capture à l'appui : « problème avec les
boutons sous iOS uniquement ». Reverti le jour même.
· `react-native-screens` expose bien `hidesSharedBackground` / `sharesBackground`
  pour cette capsule, mais **react-navigation ne les remonte pas** : on ne peut
  pas la désactiver depuis le code de l'app.
· La règle qui reste : **c'est le `hitSlop` qui fait la cible, pas le dessin.**
  Mesurer avant d'agrandir, et n'agrandir que ce qui est réellement sous 48
  zone tactile comprise.

| cible | avant | après |
|---|---|---|
| bouton thème, bouton profil | zones qui se chevauchent | **écart porté à 16 dp** |
| onglets Caméra / Manuel / Douchette | 39 dp | `minHeight: 48` |
| champ balise et bouton « Ouvrir » | 47 et 46 dp | `minHeight: 48` |
| « Quitter l'inventaire » | 45 dp | `minHeight: 48` |
| « Clôturer » du bandeau de zone | 34 dp | 34 + slop 7 = **48** |

⚠️ **« Clôturer » garde sa pastille compacte** et gagne du `hitSlop` plutôt que
de la hauteur : le bandeau de zone doit rester une rangée, pas un bloc. Le
risque d'appui accidentel est couvert — la clôture demande confirmation depuis
le 25 août.

**Deux boutons en icône seule étaient muets** pour un lecteur d'écran : la
lampe torche et le bouton de compte. Ils portent un `accessibilityLabel`, et
celui de la lampe dit son **effet** (« Allumer » / « Éteindre »), pas son nom.

⚠️ **Ce qui n'a PAS été touché** : les cartes de la liste (104 dp), les champs
de saisie (51 dp) et les boutons pleins (56 dp) étaient déjà au-dessus. Une
passe de ce genre se juge sur ce qu'elle laisse tranquille.

Tests de garde : `tests/compte.test.ts`, bloc « les cibles tactiles atteignent
48 dp ».
