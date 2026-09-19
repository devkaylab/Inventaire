# Le devis se dessine quand même (13 septembre 2026)

Défaut trouvé le 7 septembre en sondant la production, corrigé six jours plus
tard. `quote_lines` est du **JSONB**, écrit par cinq chemins SQL — le devis
manuel de la console, la souscription en ligne, l'inscription, le changement
d'offre, et les lignes d'avant la bascule aux appareils du 2 septembre. Rien ne
garantit qu'une clé soit là.

Les deux fonctions edge qui produisent le PDF faisaient pourtant :

```ts
const lignes: LigneDevis[] = Array.isArray(data.lines) ? data.lines : []
```

**Un cast, pas un contrôle.** Le type promettait une forme que personne ne
vérifiait. Une ligne sans `appareils` tombait dans `nombre(undefined)`,
`drawText` levait, et **aucun document ne sortait** — ni pour le client qui le
télécharge, ni en pièce jointe de l'e-mail. Un devis muet sur le chemin de
l'argent.

## ⚠️ LE CORRECTIF EST AU BORD, PAS DANS LE DESSIN

**Trois champs étaient fragiles, pas un.** `libelle` et `prixCents` levaient de
la même façon — le premier dans `drawText(undefined)`, le second dans
`euros(undefined)`. Les rattraper un par un à l'endroit où on les lit laisse le
quatrième, celui qu'on ajoutera demain.

`lignesDevis(brut: unknown)` remet en forme **une fois, à l'entrée**, et le
code de dessin peut continuer à faire confiance à son type — c'est à ça qu'un
type sert. Les valeurs de repli sont celles de `lignesProposees` : « Magasin 2 »
pour un libellé absent, `null` pour un nombre qui n'en est pas. Le document dit
alors « — » ou « sur devis », ce qui est **vrai**, au lieu de ne pas exister.

⚠️ **Et le type du corps de requête d'`admin-send-quote` est passé à `unknown`.**
Il annonçait `lines?: LigneDevis[]` : c'est cette promesse-là qui autorisait le
cast. Un bord qui annonce un type qu'il ne vérifie pas est le défaut, pas sa
conséquence.

⚠️ **Le chemin d'ÉCRITURE n'est pas touché**, délibérément. La console envoie
des lignes bien formées (construites par `lignesProposees` dans le navigateur),
et changer ce qu'on STOCKE sur le chemin de l'argent demanderait de vérifier
d'abord ce que le SQL relit. Contrôlé au passage, pour savoir : les migrations
lisent `libelle`, `appareils`, `prixCents` et `annuelCents` de ce JSONB — soit
exactement les champs de `LigneDevis` moins `offre`, qui n'est que de
l'affichage. Le type est donc complet.

## Ce qui a été vérifié

- **En production, sur la fonction déployée** : un devis d'essai portant
  EXACTEMENT la ligne fautive (`{"offre":"Enterprise"}` — ni libellé, ni
  appareils, ni prix) plus une ligne bien formée. `quote-pdf` répond
  **200 · `application/pdf` · `%PDF-1.7`**. Avant, ce même devis répondait 500.
  Données d'essai supprimées, **zéro résidu contrôlé**.
- **`verify_jwt` relevé sur la BASE avant de déployer**, jamais depuis ces
  notes : vrai pour `admin-send-quote`, faux pour `quote-pdf`. Recontrôlé
  après : inchangé. Les six fichiers téléchargés depuis la production sont
  **identiques au dépôt**.
- **Cinq sabotages, cinq échecs.** Dont celui qui compte : remettre le cast
  dans une fonction edge.

⚠️ **La garde des fonctions edge DÉDUIT ses fichiers** — elle retient ceux qui
appellent `devisEnPdf` et exige `lignesDevis` chez chacun. Celle qu'on écrira
demain est couverte ; nommer les deux d'aujourd'hui n'aurait protégé que
celles-là.

⚠️ **La page publique du devis, elle, était déjà juste** : elle déclare
`appareils?: number | null` et teste `l.appareils == null` — l'égalité lâche,
qui attrape `undefined`. Même donnée, deux lecteurs, un seul défensif. C'est
celui qui ne l'était pas qui tombait.

Tests de garde : `web/tests/devis.test.ts`, blocs « se dessine quand même sur
une ligne mal formée », « ce qui est BIEN formé traverse sans être touché » et
« toute fonction edge qui produit le PDF passe par `lignesDevis` ».
