# Le build du 13 septembre 2026

Julien, en réponse à une liste de tâches où j'avais remis « reconstruire
l'app » en tête : **« le build est déjà fait »**.

Ce que ça lève, et c'est tout ce qui compte : les deux chantiers postérieurs au
build du 8 septembre vivaient dans le dépôt et nulle part ailleurs —
**la traduction anglaise de tous les écrans** (11 septembre) et **« un
inventaire clôturé n'appartient plus qu'à son créateur »** (8 septembre), dont
le volet « Clôturer » restait offert aux invités sur les téléphones installés.

⚠️ **CE N'EST PAS UN CONSTAT DE MA PART, ET IL FAUT LE DIRE AINSI.** Je n'ai
rien pu vérifier : `android/` est régénéré à chaque build et gitignoré, le
dossier d'archive iOS avait été nettoyé, et aucun appareil n'était branché.
C'est Julien qui construit et qui a répondu — première main, mais pas une
mesure. Le jour où le doute revient, ce qui tranche est toujours la même
chose : la date du binaire installé, jamais celle d'`Info.plist`
(`xcrun simctl get_app_container` puis `stat`, ou `adb shell dumpsys package`).

⚠️ **La plateforme n'est pas notée, parce qu'elle ne m'a pas été dite.** iOS et
Android sont deux chemins indépendants — `./scripts/simulateur.sh` et Xcode
d'un côté, `./scripts/pixel.sh` de l'autre — et un build de l'un ne dit rien de
l'autre. Ne pas supposer les deux.
