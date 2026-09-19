# L'écran de scan : le cadre, le retour, l'objectif (29 août 2026)

Trois défauts trouvés en exerçant le comptage sur un vrai téléphone.

## ⚠️ `getAvailableLensesAsync` rend le NOM LOCALISÉ, pas l'identifiant

Le plus coûteux, et invisible : côté natif, expo-camera fait
`availableLenses.map { $0.localizedName }`, et compare `selectedLens` **au même
nom**. Une liste écrite en identifiants — `builtInTripleCamera`,
`builtInDualWideCamera` — ne correspond donc **jamais**.

Conséquence : aucun objectif sélectionné, donc `defaultBackCamera`, qui rend
**`builtInWideAngleCamera`** — l'objectif simple, qui ne fait pas le point sous
une dizaine de centimètres. **La mise au point rapprochée était hors d'atteinte
depuis le 13 août**, et rien ne le signalait : la caméra marchait, elle ne
faisait simplement plus le point de près.

L'objectif se cherche donc par ce que son nom **dit**, dans la langue du
téléphone : « triple », « double », « dual », accents et casse ignorés. Un
périphérique virtuel embarque l'ultra grand-angle et laisse iOS basculer en
macro. ⚠️ **Toujours pas l'ultra grand-angle seul** : son champ à 0,5× rendrait
les codes minuscules à distance normale.

⚠️ **Un bouton macro ne sert à rien** — essayé, retiré. Le code natif dit
pourquoi : `videoZoomFactor = 1.0 * pow(max, zoom)`, et `zoom = 0` est **déjà**
le défaut. Le bouton mettait le zoom là où il était.

⚠️ **`autofocus` est bien réglé et ne se touche pas** : `off` (le défaut) vaut
`.continuousAutoFocus`, `on` vaudrait « faire le point une fois puis
**verrouiller** ». Le commentaire du fichier disait vrai — c'est l'objectif qui
était en cause, pas le mode de mise au point.

## Le cadre fait loi

`onBarcodeScanned` travaille sur **toute l'image**, pas sur le cadre dessiné :
un code posé sur la table ou imprimé sur le carton d'à côté était compté comme
s'il avait été visé. Le filtre teste **le centre** du code contre le cadre —
pas son débordement, un code-barres qui dépasse un peu ayant bel et bien été
visé.

⚠️ **Il laisse passer quand la position est inconnue.** expo-camera prévient
que `bounds` « peut représenter un rectangle vide » : refuser dans ce cas
rendrait des codes illisibles sans que rien ne l'explique.

⚠️ **Le viseur est passé à 340 pt, et c'est ce filtre qui le permet.** Agrandir
sans lui aurait aggravé le problème — plus de surface visible, plus de codes
ramassés au passage. Les deux ne tiennent qu'ensemble.

⚠️ **Une seule définition de la géométrie** (`rectCadre`), lue par le dessin
*et* par le filtre. Deux définitions dériveraient au premier ajustement, et le
cadre cesserait de dire la vérité — le défaut même qu'on ferme.

La liste des scans est passée derrière « Voir les N articles scannés » (absent
tant que rien n'est scanné), dans un **voile posé sur l'écran, pas une
`Modal`** : la fiche « article inconnu » en est une, et iOS refuse d'en
présenter deux. Ce qui rend le geste sûr, c'est que « Dernier scan » — qui
affiche désormais **le code-barres, pas le libellé** — répond déjà à « est-ce
que ça a pris ? ».

## Deux cartes de confirmation, une seule forme

⚠️ **La question du retour se pose TOUJOURS**, plus seulement sur une balise
ouverte. Elle ne protège pas une donnée, elle rattrape un doigt qui glisse — et
ça arrive autant sur une balise consultée. Ne pas la reconditionner.

⚠️ **Et elle a la même forme que la clôture** : « Annuler » à gauche, l'action
à droite en bouton plein. Le 25 août, « Rester » en bouton plein était cohérent
isolément et **faux à côté de la clôture** : une carte où le bouton plein
annule et l'autre agit inverse le geste d'un écran à l'autre, et on finit par
appuyer à droite sans lire. La clôture, elle, porte le rouge du bouton qui
l'ouvre — mais garde le surtitre « Confirmation », le défaut du ton `danger`
étant « Action définitive », ce que clôturer n'est pas.

## Le bandeau de démarrage ne tient plus à un jalon d'appareil

L'étape « Générer mes balises » se coche sur un **jalon local** : changer de
téléphone la remet à faire, et le bandeau revenait à quelqu'un qui a une équipe
et des inventaires depuis des semaines. `demarrageAcquis` clôt donc le
démarrage sur les deux faits qui vivent **en base** — équipe constituée et
inventaire créé —, qui suivent la personne d'un appareil à l'autre.

Tests de garde : `tests/comptage.test.ts` et `tests/compte.test.ts`.
