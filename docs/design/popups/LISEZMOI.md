# Les pop-ups de l'app — les trois canevas

Sources du canevas de design présenté à Julien le 24 août 2026, avant de
coder. Quatre planches : l'alerte iOS d'alors, puis trois directions.

| Fichier | Ce qu'il montre |
|---|---|
| `Aujourdhui.dc.html` | L'alerte iOS native, pour comparer |
| `Main.dc.html` | **A · La feuille** — le volet de fin de balise, étendu aux questions |
| `Carte.dc.html` | **B · La carte** — même interruption qu'avant, aux couleurs de l'app |
| `EnPlace.dc.html` | **C · En place** — la question s'ouvre dans le rang touché |

**Julien a retenu la direction B**, plus le bandeau qui passe tout seul pour
les résultats. Le code vit dans `src/lib/dialogue.ts` et
`src/components/ui/Dialogue.tsx`.

Le fichier publié (`popups-quantinvo.html`, ~2 Mo) n'est pas versionné : il se
régénère depuis ces sources. Le canevas en ligne :
https://claude.ai/code/artifact/e3b23ae2-2f15-40e1-bad9-fff1866a6095

Les valeurs dessinées sont celles de `src/constants/ink.ts` (thème sombre) et
du volet de `components/scanner.tsx` — rien n'y est inventé.
