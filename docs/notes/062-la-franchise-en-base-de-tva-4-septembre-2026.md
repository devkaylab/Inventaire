# La franchise en base de TVA (4 septembre 2026)

*« Je suis en exonération de TVA, ça change quelque chose ? »* Oui, trois
choses — et la première aurait bloqué la vente le jour du passage en live.

## ⚠️ UN SEUL INTERRUPTEUR, `TVA_APPLICABLE`

Il vit dans `web/lib/offres.ts`, avec son jumeau dans `subscribe-online`
(doublon volontaire, comme la grille : le site et les fonctions edge ne
compilent pas ensemble, un test compare les deux). Il commande **tout** :

1. **Le refus de vendre en live sans `STRIPE_TAX_RATE`.** Ce garde-fou avait
   été écrit en supposant que la TVA s'applique toujours ; en franchise, il
   aurait exigé un taux qui n'a pas lieu d'exister et répondu « indisponible »
   à chaque souscription. Il est conditionné, et le taux est **ignoré même s'il
   traîne dans les secrets** — un taux posé par erreur facturerait une taxe que
   l'éditeur ne collecte pas.
2. **Ce que les écrans affichent.** En franchise il n'y a ni HT ni TTC : le
   prix affiché EST le prix payé. Annoncer « 310 € HT » puis « 372 € TTC »,
   c'est le symétrique exact du défaut que la TVA corrigeait le 30 août — un
   montant affiché qui n'est pas celui du relevé bancaire.
3. **La mention portée par les devis et les factures.** L'article 293 B du CGI
   impose ces mots-là. ⚠️ L'ancienne phrase — « TVA non applicable sur ce
   document, le montant hors taxes fait foi » — n'était pas la mention légale
   et **annonçait même l'inverse** : que la facture, elle, l'ajouterait.

Le jour où le seuil de la franchise est dépassé, on passe la constante à `true`
et rien d'autre ne bouge. ⚠️ **La formulation de la mention et le seuil ne sont
pas au code d'en décider** : c'est le comptable, et le commentaire le dit.

## ⚠️ LA GARDE BALAIE, ELLE NE CITE PAS — et c'est ce qui a payé

J'avais corrigé trois fichiers à la main. Le test qui balaie `web/app` et
`web/components` en a trouvé **six autres** : la grille de la page publique,
la page de devis que le client lit, l'estimation de `/inscription`, les deux
panneaux de devis de la console, et le balisage schema.org — qui annonçait
`valueAddedTaxIncluded: false` à des machines.

C'est la même leçon que le bouton retour, le même jour : **une garde qui nomme
les écrans à protéger ne protège que ceux qu'on connaissait en l'écrivant.**
Elle lit le code sans ses commentaires (ils citent forcément les mots qu'ils
décrivent) et regarde la ligne **et ses deux voisines** — la condition vit
souvent au-dessus, sur la première branche d'un ternaire.

## Ce qui a suivi

- **CGV** (article 6.1, annexe 2, identité de l'éditeur) et **modèle de devis à
  la main** alignés sur la même mention ; la ligne « TVA 20 % » du modèle est
  retirée, avec le commentaire qui dit quand la remettre.
- **Six fonctions edge redéployées** — celles qui embarquent `_shared/devis.ts`
  (`quote-pdf`, `accept-quote`, `decline-quote`, `admin-send-quote`,
  `ca-request-store`) plus `subscribe-online`. ⚠️ `verify_jwt` **relevé sur la
  base avant de déployer**, pas déduit de cette note : faux pour les quatre
  publiques, vrai pour les deux autres. Recontrôlé après : rien n'a bougé.
- **Trois tests amendés, aucun affaibli** : deux portaient sur une ligne
  d'import mot pour mot (elles ont gagné `TVA_APPLICABLE`) — elles vérifient
  désormais ce qui est importé ; le troisième exigeait le mot « TTC » sur le
  bouton de paiement. Ce qu'il défend n'a pas changé — *le bouton porte le
  montant réellement prélevé* — et c'est justement pour ça qu'il ne peut plus
  exiger « TTC ».

## Vérifications

- **Au navigateur** : `/tarifs` (« Prix par magasin. TVA non applicable,
  article 293 B du CGI. »), `/souscrire` (« 310 € · par mois, pour un
  magasin », la mention, et le bouton « Payer 310 € et créer mon espace ») et
  `/devis/<jeton>` (« Total mensuel 310,00 € », la mention sous le total).
- **Le PDF est réellement dessiné avec la mention** : `elementsDevis` est
  testable sans PDF (c'est pour ça que le module est séparé), et un test
  vérifie que le texte figure parmi les éléments — pas seulement qu'il est
  déclaré. Plus un appel réel à `quote-pdf` déployée : 200,
  `application/pdf`, `%PDF-1.7`.
- **Les gardes mordent** : interrupteurs divergents, mention redevenue
  descriptive, « HT » remis en dur dans la grille publique, « TTC » remis sur
  le bouton — quatre sabotages, quatre échecs.
- 969 tests du site, 416 de l'application, `tsc --noEmit` des deux côtés,
  `eslint .` à zéro erreur, `next build` avec la table de routes inchangée.
- Données d'essai supprimées, **zéro résidu contrôlé** : 0 demande,
  2 entreprises, 2 magasins.

**Non vérifié** : un encaissement réel en franchise, qui demande les clés
`live` — elles attendent l'immatriculation de la société.
