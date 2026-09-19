# Reconstruire pour le simulateur : trois pièges (28 août 2026)

Le bundle figé signalé plus haut a une suite. En voulant vérifier que le
simulateur tournait bien sur le dernier build, trois choses ont fait perdre du
temps — deux sont des pièges réels, la troisième est une erreur de méthode qu'il
vaut mieux ne pas refaire.

## ⚠️ 1. `pod install` échoue en silence dans un shell sans locale

```
Unicode Normalization not appropriate for ASCII-8BIT (Encoding::CompatibilityError)
```

CocoaPods normalise les chemins en Unicode. Un shell **non interactif** — celui
d'un agent, d'un script, d'un hook — n'a pas de locale UTF-8, Ruby travaille en
`ASCII-8BIT`, et l'installation s'arrête avant d'avoir rien fait. La commande
qui marche :

```bash
cd ios && LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 pod install
```

**Ce qui rend le piège coûteux, c'est le silence** : enchaînée avec `&&` ou son
code de sortie ignoré, l'installation ratée ne se voit pas, le build suivant
réussit, et l'application livrée est amputée de son module natif sans le moindre
avertissement. La règle de la mémoire projet — « toute dépendance native se
termine par un `pod install` avant de faire reconstruire » — se complète donc
ainsi : **il ne suffit pas de le lancer, il faut lire ce qu'il répond**
(« Pod installation complete! N dependencies, N total pods installed »).

## ⚠️ 2. Le bon probe est `ExpoModulesProvider.swift`, pas `strings`

Pour savoir si un module natif Expo est réellement lié à l'application
installée, **un seul artefact fait foi** :

```bash
grep -i <module> ios/Pods/Target\ Support\ Files/Pods-Inventaire/ExpoModulesProvider.swift
```

C'est le fichier que CocoaPods génère à chaque `pod install`, et il liste
exactement les modules enregistrés au démarrage (43 aujourd'hui).

**Trois probes tentants et tous faux**, essayés dans cet ordre avant de trouver
le bon :

- `strings <app>/Inventaire | grep <module>` — rend 0 même quand le module est
  là : compilé en bibliothèque statique, il n'apparaît pas en chaîne lisible ;
- `ls <app>/Frameworks/` — ne montre que les pods construits en frameworks
  dynamiques. `ExpoSecureStore` n'y est pas, `ExpoCamera` oui : l'absence ne
  prouve rien ;
- `ls ios/Pods/<Module>` — un pod local (`:path => ../node_modules/…`) n'est pas
  toujours recopié dans `Pods/`. Là encore, l'absence ne prouve rien.

**Et la preuve qui vaut mieux que toutes les autres reste l'exécution** : si
`expo-secure-store` manquait, la session ne se restaurerait pas — le jeton y est
rangé. Une capture montrant quelqu'un de connecté suffit à trancher.

## ⚠️ 3. Vérifier la date du binaire, pas celle d'`Info.plist`

`Info.plist` garde une date recopiée depuis les produits de compilation : il
peut afficher une date ancienne sur une application fraîchement construite. Et
**le conteneur change à chaque réinstallation** — un chemin relevé une fois ne
vaut plus rien ensuite.

```bash
APP=$(xcrun simctl get_app_container <UDID> com.quantinvo.app)
stat -f "%Sm" -t "%d/%m %H:%M" "$APP/Inventaire"   # le binaire, pas l'Info.plist
```

## Ce que donne une vérification complète

Le 28 août 2026, après reconstruction : binaire à 21 h 39, `SecureStoreModule`
présent dans `ExpoModulesProvider.swift`, application ouverte sur une session
restaurée, et aucune erreur `SecureStore` ni « native module not available »
dans `xcrun simctl spawn <UDID> log show`. Les quatre ensemble, pas un seul.
