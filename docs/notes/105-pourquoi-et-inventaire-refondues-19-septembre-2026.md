# « Pourquoi nous choisir » et « L'inventaire », refondues (19 septembre 2026)

Demande de Julien : refaire les deux pages « en t'inspirant de Découvrir, pas
en faisant un copier-coller ». Maquette validée point par point avant la mise
en ligne : https://claude.ai/artifact/G51NqkJA3oHfPUjPzhmHkL

## Ce qui vient de Découvrir, ce qui est propre à chaque page

Commun : titres à gauche, une phrase par idée, fonds qui alternent, l'accent
une seule fois (« Fiabilisez votre stock avec Quantinvo »).

- **Pourquoi** : six raisons en ONGLETS (`components/OngletsRaisons.tsx`) —
  les six titres toujours visibles, une seule raison dépliée avec l'écran qui
  la prouve. Puis un face-à-face « D'habitude / Avec Quantinvo ». On compare à
  une pratique, jamais à un concurrent.
- **L'inventaire** : chaque section a la forme de son idée — l'obligation
  légale en tête (Code de commerce, L123-12, demandée par Julien en premier),
  la définition en soustraction, la démarque en un chiffre, les anomalies,
  l'année dessinée en 52 semaines (`components/RythmesAnnee.tsx`), la méthode
  en quatre temps numérotés (une vraie suite).

## Retours de Julien sur la maquette

Pas de sous-titre sous les titres de page ; « Un suivi en direct » (sans
« respectueux ») ; les téléphones ENTIERS, jamais rognés par le bas ;
« Des terminaux à acheter ou à louer, qui ne servent qu'aux inventaires » ;
« comparé au stock attendu » ; la phrase du bandeau final sur UNE ligne
(`.final p` sans plafond, `text-wrap: balance`, espace insécable avant « : »).

## Polices : la charte

Archivo pour les titres ET les nombres, Public Sans pour le texte. La mono
(IBM Plex Mono) et le serif (Newsreader) ne servent QUE sur les écrans qui
font foi (rapport, écarts). Le site ne charge qu'Archivo 500-700 et Public
Sans 400-600 : ne pas demander 700 à Public Sans (graisse synthétisée).
Vérifié par `getComputedStyle` sur chaque élément des deux pages.

## Le bloc illustré a disparu

Plus aucune page ne posait `.bloc-illustre` : son style est retiré, et
`tests/vitrine-captures.test.ts` reconnaît désormais les pages à leurs images
(accueil exclu, il a ses gardes). Sabotage vérifié : une capture posée deux
fois fait tomber la garde.

⚠️ **Référencement** : L'inventaire était un article (« inventaire magasin »).
Le texte a fondu ; les termes cherchés restent dans les titres et les tuiles.
Surveiller la position dans la Search Console.
