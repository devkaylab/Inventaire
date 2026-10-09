# ⚠️ Le premier pas de la montée Expo : 56.0.11 → 56.0.23 — 9 octobre 2026

Julien : « On peut peut-être le faire maintenant non ? Avant de lancer notre
prochaine mise à jour. »

Oui, et le raisonnement vaut d'être écrit : **l'app ne part pas aujourd'hui.**
On-Demand est bloqué sur des actions qui n'appartiennent qu'à lui (App Store
Connect → Business, secrets Stripe). Ce temps mort est exactement ce qu'une
montée de SDK réclame — des semaines de décantation avant le dépôt. En janvier,
c'eût été soit sous pression, soit une deuxième revue App Store.

Ce qui ne bouge pas pour autant : **aucun build ne part en revue sans avoir été
ouvert depuis TestFlight**, sur un vrai appareil. TestFlight demande l'archive,
donc le portail des certificats. La montée se *fait* aujourd'hui ; elle ne se
*valide* qu'après.

## Ce qui a été fait, et ce qui ne l'a pas été

**Fait : 56.0.11 → 56.0.23**, le dernier correctif du même majeur. Pas de
prebuild, `ios/` n'est pas réécrit, les numéros de build ne bougent pas.

**Pas fait : 57.** Il réécrit les dix-neuf fichiers d'`ios/` par prebuild, avec
le piège des numéros de build à deux endroits du `project.pbxproj`. ⚠️ Et
surtout, le mener pendant le chantier On-Demand rendrait toute casse
inattribuable — SDK ou fonctionnalité ? C'est toute la raison du « un majeur à
la fois ». Il se fera en chantier isolé.

`npx expo install --fix` a aligné **onze paquets** en retard sur ce que 56.0.23
attend, dont deux natifs (`react-native-screens` 4.25.2 → 4.26.2,
`@expo/ui`). React Native n'a pas bougé : **0.85.3**.

### Le greffon ajouté dans `app.json` est un inerte

`--fix` ajoute `"expo-web-browser"` à la liste des plugins. Vérifié dans son
code : `if (!props) return config` puis
`if (!props.experimentalLauncherActivity) return config` — **sans propriétés,
il ne fait rien**. Gardé quand même : le retirer le ferait revenir au prochain
`--fix`. Ne pas chercher ce qu'il configure, il ne configure rien.

## ⚠️⚠️ LE PIÈGE, et il aurait fait compiler du vieux code natif

**`pod install` sort à 0 et laisse le `Podfile.lock` PÉRIMÉ.** Après
l'alignement des paquets, CocoaPods n'a mis à jour **aucune** version déjà
verrouillée : il a affiché un seul avertissement, pour `ExpoFileSystem`, et a
rendu la main sans erreur. Mesuré en comparant le lock à `node_modules` :
**dix-neuf pods en retard**, dont `Expo` lui-même (56.0.11 contre 56.0.23),
`ExpoModulesCore` (56.0.16 contre 56.0.27) et `RNScreens` (4.25.2 contre
4.26.2).

Autrement dit : le `package.json` annonçait les nouvelles versions, et la
compilation iOS serait partie sur les anciennes. **Rien dans le code de retour
ne le dit.** C'est précisément pourquoi la consigne est de LIRE la sortie de
`pod install` — mais ici même la sortie ne le disait qu'à un pod sur dix-neuf.
Ce qui le dit vraiment, c'est de **comparer le lock à `node_modules`**.

Le correctif : `pod update <les pods concernés> --no-repo-update`.

⚠️ **Et un second piège par-dessus le premier : zsh ne découpe pas une variable
non quotée.** `pod update $PODS` a passé les dix-neuf noms comme **un seul**
nom de pod ; CocoaPods a répondu « Pod is not installed and cannot be updated »
— et **est sorti à 0**. Deuxième code de retour menteur dans la même
opération. En zsh il faut `${=PODS}`, et vérifier le résultat dans le lock, pas
dans le code de sortie.

⚠️ `Yoga` et `hermes-engine` sont de faux positifs d'une telle comparaison :
leurs podspecs portent par convention une version différente de celle de leur
paquet (`0.0.0`, `250829098.0.10`). Les exclure.

## Ce qui a été vérifié

| | |
|---|---|
| types app / site | propres |
| gardes app | **567** |
| pods en retard, après correction | **0** |
| `pod install` puis build Xcode 26.6 | verts |
| app au simulateur | écran de connexion, identique à avant |
| navigation (RNScreens a changé de version) | **aller et retour bons** |

La navigation a été exercée exprès : c'est `react-native-screens` qui a fait le
plus gros saut, et c'est lui qui gouverne la pile d'écrans.

## ⚠️ Ce qui n'est pas vérifié

**Rien sur un vrai appareil.** Le simulateur ne dit rien de la rafale d'une
douchette, de la caméra, ni du verrouillage d'écran. Et **rien n'est passé par
TestFlight** — le portail des certificats n'est pas encore confirmé.

**Rien n'est en production** : tout s'accumule sur `on-demand` jusqu'à la mise
à jour unique (fiche 109).

## L'ordre qui reste

1. ~~56.0.11 → 56.0.23~~ — **fait** ;
2. portail des certificats confirmé → gel iOS levé ;
3. **57 avec `ios.enableSceneSupport`**, en chantier isolé, puis TestFlight sur
   le téléphone de Julien ;
4. 58 en routine, en retirant l'option (c'est le défaut à partir de là).

Rappel de la date : Apple exigera le SDK iOS 27 pour tout téléversement à
partir d'**avril 2027**. Voir `docs/notes/106`.
