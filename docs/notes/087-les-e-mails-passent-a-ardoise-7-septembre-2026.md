# Les e-mails passent à Ardoise (7 septembre 2026)

Constat de Julien, capture d'un message reçu à l'appui : le gabarit portait
encore l'identité d'avant — bandeau bleu nuit, filet de scan cyan, bouton
indigo, gris bleutés. **C'était le dernier endroit du produit dans ce cas** :
le site est passé le 6 septembre, l'application l'après-midi.

Maquette validée avant codage :
https://claude.ai/code/artifact/420a0c3c-d5ed-4d22-bc73-c2d99add5db6

## ⚠️ LE LOGO, LUI, ÉTAIT DÉJÀ BON — vérifié, pas supposé

`scripts/dessiner-logo-email.mjs` l'avait régénéré le 6 septembre, et le PNG
servi en production est **identique à l'octet près** à celui du dépôt : c'est
bien le plan de magasin. Le cube violet de la capture vient d'un message plus
ancien (ou du cache d'images de Gmail, qui proxifie et garde ses copies). Ce
qui restait périmé, c'est **tout ce qui l'entoure**, et ça vit dans un seul
fichier.

## Huit valeurs, et deux règles de géométrie

| rôle | avant | après |
|---|---|---|
| bandeau, titres | `#0b0f19` | **`#14181a`** — l'encre d'Ardoise |
| texte courant | `#2a3140` | **`#3a423f`** — l'encre adoucie, sans bleu |
| bouton, lien fort | `#6366f1` / `#4636b0` | **`#1e4d3b`** — `--accent` clair |
| second plan | `#5b6475` | **`#575f5c`** — `--text-2` |
| pied, encadré | `#f4f5f9` | **`#f2f3f1`** — le papier |
| filets | `#e3e6ee` | **`#e2e5e1`** |
| filet de scan | `#38c9ff` | **retiré** |
| rayons | 14 / 13 / 10 / 8 px | **4 / 3 px** |

- **⚠️ LE FILET DE SCAN A DISPARU AVEC LE CUBE QUI LE PORTAIT.** C'était son
  faisceau. Un filet décoratif n'engage rien, et dans Ardoise l'accent ne sert
  qu'à ce qui engage — même geste que la lueur retirée de tous les héros du
  site le 6 septembre.
- **⚠️ IL N'Y A PAS DE THÈME SOMBRE, et il ne faut pas en ajouter.** Un e-mail
  se lit dans une messagerie qui compose comme elle veut ; le gabarit déclare
  `color-scheme: light` et s'y tient. Les valeurs sont donc celles du thème
  clair du site, et rien d'autre.
- **⚠️ LES POLICES RESTENT CELLES DU SYSTÈME**, et c'est le seul écart assumé
  avec le site : un e-mail ne charge aucune police distante. Archivo et Public
  Sans n'y sont pas. La marque y tient par ses couleurs et sa géométrie.
- Contrastes mesurés : texte courant **10,3:1** sur blanc, second plan **6,6:1**
  sur blanc et **5,8:1** sur le pied, blanc du bouton **9,6:1** sur l'accent.

Les quatre règles du gabarit ne bougent pas : une seule image (le logo en PNG,
le mot-symbole en TEXTE à côté), tableaux et styles en ligne pour Outlook, tout
ce qui vient de la base échappé, et le module sans API Deno pour que les tests
du site l'exécutent.

## ⚠️ QUATORZE FONCTIONS DÉPLOYÉES, UNE LAISSÉE — et c'est le contrôle qui l'a dit

Le gabarit est **embarqué** dans chaque fonction edge, jamais lu à l'exécution :
une fonction non redéployée envoie à l'ancienne. Quinze l'embarquent (et non
quatorze — `inscription` s'y est ajoutée le 5 septembre).

**Le contrôle « vérifier ce qu'on emporte » a mordu.** Un redéploiement pousse
le dossier entier, et depuis le dernier déploiement `_shared/devis.ts` et
`_shared/devisPdf.ts` ont changé — c'est **le devis Registre du 6 septembre,
que Julien a explicitement mis en attente** (« toujours sur le preview »).

Cinq fonctions importent `devis.ts`, mais il a fallu regarder **ce qu'elles en
importent** :

- `alerte-anomalies` et `ca-request-store` → `nomOffre` ;
- `accept-quote` et `decline-quote` → `euros` ;
- **`admin-send-quote` → `devisEnPdf`** : c'est elle, et elle seule, qui dessine
  et joint le document.

Les quatre premiers helpers sont **inchangés** dans le commit Registre (vérifié
sur le diff : toutes ses lignes sont à l'intérieur d'`elementsDevis`). Les
quatorze autres fonctions sont donc parties sans rien emporter d'autre que le
gabarit.

**⚠️ ET LE DEVIS REGISTRE EST PARTI DANS LA FOULÉE**, sur le feu vert explicite
de Julien le 7 septembre 2026 (« je te donne mon feu vert pour l'e-mail, il faut
clôturer ce sujet ») : `admin-send-quote` **et** `quote-pdf`, ensemble et jamais
l'une sans l'autre — le PDF joint à l'e-mail et le PDF téléchargé sortent du
même module, les déployer séparément ferait deux documents différents. C'est ce
qui clôt l'attente ouverte le 6 septembre.

⚠️ **`verify_jwt` relevé sur la BASE avant de déployer, et la note du dépôt
était incomplète** : elle annonçait cinq fonctions publiques, il y en a **huit**
(`subscribe-online` et `inscription` s'étaient ajoutées). C'est exactement
pourquoi la règle dit « relever sur la base, jamais depuis cette note ».
Recontrôlé après : inchangé sur les seize.

## Vérifications

- **Le HTML réel produit, regardé au navigateur** — pas seulement testé :
  bandeau encre sans filet, bouton vert forêt, encadré en papier, coins nets,
  pied lisible. (Le logo n'y apparaît pas : son URL est celle de la production,
  que le volet local ne charge pas. Elle répond bien 200, vérifié au `curl`.)
- **Le gabarit déployé est identique au dépôt** : trois fonctions téléchargées,
  `diff` à zéro sur `_shared/email.ts`.
- **En direct** : `stripe-webhook` répond 405 sur GET et 400 « signature
  absente » sur un POST nu (donc son code est atteint sans JWT) ;
  `message-admin` répond 401 sans jeton.
- **Cinq sabotages, cinq échecs** : bandeau bleu nuit, bouton indigo, gris
  bleuté, filet de scan revenu, coins ronds.
- 1 345 tests du site, `tsc --noEmit`, `eslint .` à zéro erreur.

- **⚠️ ET LE DEVIS A ÉTÉ RÉELLEMENT DESSINÉ EN PRODUCTION, puis RELU.** Devis
  d'essai posé en base, `quote-pdf` appelée en direct : **200 ·
  `application/pdf` · `%PDF-1.7` · 2 689 octets**, document ouvert et lu —
  en-tête en filet, serif sur la marque et la référence, tableau ouvert sans
  cadre, total sous un trait, mention de TVA en ocre une seule fois, plus un
  seul indigo. Données d'essai supprimées, **zéro résidu contrôlé** (0 demande,
  2 entreprises, 2 magasins). C'est le seul contrôle qui vaille : un libellé
  qu'Helvetica n'encoderait pas ferait lever `drawText` et la fonction
  répondrait 500.

⚠️ **UN DÉFAUT LATENT TROUVÉ PAR CE CONTRÔLE, et il est plus vieux que ce
chantier.** ✅ **CORRIGÉ ET VÉRIFIÉ EN PRODUCTION LE 13 SEPTEMBRE 2026** — voir
« Le devis se dessine quand même » en fin de fichier. Ma première sonde a répondu **500**. Ce n'était pas Registre : c'est
`elementsDevis` qui écrit `l.appareils === null ? '—' : nombre(l.appareils)`
(commit du 2 septembre). Une ligne de devis dont `appareils` est **absent** —
`undefined`, et non `null` — tombe donc dans `nombre(undefined)` et **le PDF ne
se dessine plus du tout**, ni pour le client ni pour l'e-mail. Mon jeu d'essai
était mal formé, donc le défaut ne s'est pas manifesté sur des données réelles ;
mais le type déclare `appareils: number | null` sans que rien ne le vérifie à
l'exécution. **À reprendre le jour où on touchera aux lignes de devis** : un
`?? null` à la lecture suffirait.

⚠️ **CE QUI N'EST PAS PROUVÉ : un e-mail reçu dans une vraie boîte.** C'est la
seule preuve qui vaille pour un gabarit — c'est comme ça que le défaut « une
seule voix » a été trouvé le 30 août. Elle revient à Julien.

Tests de garde : `web/tests/email-template.test.ts`, blocs « pose la palette
d'ARDOISE », « le filet de scan a disparu » et « les coins sont ceux d'un outil
de travail ».
