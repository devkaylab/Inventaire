# Les visuels de boutique passent à Ardoise (13 septembre 2026)

Julien cherchait « le logo de Quantinvo ». En listant où il vit, trois visuels
sont sortis **à l'ancienne identité** — cube violet, dégradé, filet de scan
cyan, Sora — dix jours après que le site, l'application et les e-mails en
soient sortis : l'image de partage du site, le bandeau Google Play et l'icône
512 de la fiche Play.

⚠️ **ILS VIVENT DANS `docs/`, DONC HORS DE TOUTES LES GARDES.** Le site balaie
`web/`, l'application `src/` ; personne ne regardait `docs/entreprise/`. C'est
la seule raison pour laquelle ça a tenu dix jours — et c'est le motif à
retenir : *un changement d'identité se propage là où des gardes balaient, et
nulle part ailleurs.*

**Le plus grave des trois était `og.png`** : il part à chaque fois qu'un lien
du site est collé dans LinkedIn, Slack ou un message. Les deux autres attendent
une publication ; celui-là était en ligne.

Un seul script produit les trois (`docs/entreprise/boutiques/produire.mjs`), et
**l'icône s'est corrigée toute seule** en le relançant : elle est réduite depuis
`assets/images/icon.png`, à jour depuis le 7 septembre. Seuls les deux gabarits
HTML portaient l'ancienne identité.

## ⚠️ `document.fonts.check()` NE MORD PAS — mesuré

Le script refuse de sortir une image si une police n'a pas été résolue : une
police absente ne lève aucune erreur, le navigateur retombe en silence sur une
fonte système. Ce contrôle vérifiait **Sora**, donc plus rien depuis Ardoise.

Ma première réécriture est passée par `document.fonts.check()`. **Elle ne
protégeait rien** : `check('700 64px FamilleQuiNexistePas')` répond **`true`**
— sondé en direct. Il dit « rien ne bloque le rendu », pas « la police demandée
sera utilisée ». Ne pas y revenir.

La forme qui tient ne dépend ni du dessin de la police ni de ce que le
navigateur déclare : **on rend le même texte avec deux familles de secours**
(`X, monospace` contre `X, serif`). Police résolue → elle gagne deux fois →
largeurs identiques. Police absente → chaque secours s'applique → elles
diffèrent. La mesure d'origine, elle, comparait Sora à `sans-serif` : ça tenait
parce que Sora est très dessinée, et ça se serait mis à refuser du bon travail
avec Archivo, qui est proche d'Helvetica.

## ⚠️ ET LE SABOTAGE ÉVIDENT N'EN EST PAS UN SUR CE MAC

Couper le lien Google Fonts dans un gabarit ne prouve rien : **Archivo et
Public Sans sont installées dans `~/Library/Fonts`**. Le navigateur les résout
depuis le système, le visuel sort juste, la garde a raison de se taire. J'ai
conclu deux fois de suite que la garde était cassée avant de regarder les
polices du poste — le piège du projet, dans sa forme la plus pure : *un
résultat de sabotage invraisemblable est d'abord un sabotage qui ne sabote
rien.* Pour l'éprouver, saboter **le nom que la garde cherche**. Les deux
sabotages lèvent alors, chacun nommant sa police.

## Ce qui a été décidé sur les visuels

- **Pas de décor.** Le plan de magasin agrandi a été essayé des deux côtés,
  puis retiré : coupé par le bord il perd son cadre, et il ne reste que des
  bandes verticales qui se lisent comme un défaut de rendu, pas comme la
  marque. Le vide de droite n'est pas un manque — c'est la zone que Play
  recadre, et Ardoise n'habille pas un fond pour le remplir.
- **L'accent ne porte QUE la seconde ligne du titre**, et une garde le compte.
  Sur une image, la promesse est la seule chose qui engage.
- **Les deux visuels partagent une composition**, au corps du titre près (88
  contre 74 : l'og est plus large de 176 px et ne subit aucun recadrage
  latéral). Deux mises en page à tenir d'accord divergent toujours.
- Contrastes mesurés sur les trois valeurs du fond : titre 15,0 à 16,4:1,
  accent 9,2 à 10,1:1, sous-titre 6,7 à 7,3:1. Et le bandeau reste lisible
  réduit à **336 px**, la taille où Play l'affiche le plus souvent.

## ⚠️ Le LISEZMOI décrivait la piste qui n'avait PAS été retenue

Onze jours durant. Trois pistes avaient été présentées le 2 septembre ; Julien
a choisi **« la phrase »** (B), la première version du bandeau a produit **« le
geste »** (C) par erreur, le gabarit a été corrigé le jour même — et personne
n'est revenu dans le LISEZMOI, qui a continué de décrire C. Quatrième fois que
ce projet paie une note périmée. Corrigé, avec la raison du choix.

## ⚠️ J'AI ANNONCÉ DES CAPTURES À REFAIRE. ELLES ÉTAIENT DÉJÀ REFAITES.

Cette section disait : « les douze captures de la fiche montrent encore
l'ancienne interface, à refaire avant de déposer ». **C'était faux.** Elles
avaient été refaites le **8 septembre 2026**, déposées sur App Store Connect et
sur la Play Console, et elles portent bien Ardoise et Registre — accroche en
deux lignes, fond plein, téléphone en perspective, cinq écrans par boutique.
Constat de Julien, le 13 septembre : « on a déjà des nouvelles captures ».

⚠️ **LE DÉPÔT DISAIT L'INVERSE DE LA RÉALITÉ, ET C'EST TOUT LE MÉCANISME** :
les captures déposées vivaient hors du dépôt
(`~/Desktop/quantinvo-captures-boutiques/`), pendant que
`docs/entreprise/boutiques/` gardait celles du 2 septembre. J'ai lu le dossier,
pas ce qui était en ligne — et j'ai relancé un build de simulateur pour refaire
un travail déjà fait.

**Trois choses à en retenir, et la première est la plus générale :**

- ⚠️ **Un livrable qui vit hors du dépôt finit toujours par faire mentir le
  dépôt.** Ce qui est remis à une boutique, à un client ou à un tiers se range
  dans le dépôt le jour où il est remis. C'est réparé : les dix visuels sont
  dans `captures-app-store/` et `captures-google-play/`, les anciens sont
  partis, et `captures-ipad-13/` avec eux — `supportsTablet` vaut **faux**
  depuis le 8 septembre, Apple ne demande plus de captures iPad.
- ⚠️ **L'information était DÉJÀ dans le dépôt, et je suis passé dessus.**
  `docs/entreprise/deck/LISEZMOI.md` écrit noir sur blanc que les captures du
  Bureau « montrent bien la nouvelle application ». Je l'ai lue le matin même,
  en cherchant autre chose. Quand deux notes se contredisent, ce n'est pas un
  détail de rédaction : c'est le signe qu'une des deux décrit un état périmé.
- ⚠️ **C'est la CINQUIÈME note périmée qui coûte à ce projet**, après la liste
  d'onboarding du 28 août (deux fausses annonces le 4 septembre), le garde-fou
  du retour du 29 août, les orphelins de migrations déjà rattrapés, et les deux
  Price Stripe « à poser » qui l'étaient. À la différence des quatre autres,
  **celle-ci a été écrite le matin même par la session qui s'est fait avoir
  l'après-midi** : une note fausse n'a pas besoin de vieillir pour nuire.

**La vérification qui aurait tranché en dix secondes** : regarder la fiche
déposée, ou la date des fichiers, avant d'annoncer un manque. Un fichier de
`captures-ios-69/` datait du 2 septembre — mais l'app avait été envoyée à
Apple en build 3 **le 8**, et personne ne dépose un binaire neuf avec des
captures qu'on sait périmées.

## Vérifications

Trois visuels régénérés et relus à l'écran ; cinq sabotages sur la garde
nouvelle, cinq échecs ; deux sabotages sur le contrôle de police, deux levées ;
1 432 tests du site, `tsc` propre, `eslint .` à zéro erreur (50 avertissements
`react-hooks/*` connus, aucun sur les fichiers touchés), `next build` avec la
table de routes inchangée.

Tests de garde : `web/tests/visuels-boutiques.test.ts` — il **déduit** les
gabarits du dossier et les polices de leurs liens Google Fonts, donc un
troisième visuel ajouté demain est couvert, et le jour où un gabarit change de
police, la garde exige que le script surveille la nouvelle.
