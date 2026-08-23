# Le dossier de prestation

Ce que Quantinvo remet à un client, et ce que Devkaylab garde pour soi. Les
deux listes vivent ici parce que la frontière se déplace : un document interne
finit souvent par sortir, et il vaut mieux savoir lequel.

Établi le 22 août 2026.

## Remis au client

| Document | Destinataire chez le client | Quand |
|---|---|---|
| [`deck/`](deck/LISEZMOI.md) — présentation commerciale | Direction, achats | Avant-vente |
| [`deck/`](deck/LISEZMOI.md) — dossier technique (`Quantinvo-dossier-DSI.pptx`) | Direction informatique, RSSI | Avant-vente, dès que la DSI entre dans la boucle |
| [`deck/`](deck/LISEZMOI.md) — guide de prise en main (`Quantinvo-prise-en-main.pptx`) | Superviseurs, compteurs | Après signature, avant le premier inventaire |
| [`../conformite/synthese-audit-2026-08.pptx`](../conformite/LISEZMOI-synthese.md) — synthèse RGPD et sécurité | Direction, DPO | Avant-vente, dès que la question de la conformité arrive |
| [`modeles/devis.html`](modeles/LISEZMOI.md) — devis | Achats | Proposition |
| [`cgv-quantinvo-brouillon.md`](cgv-quantinvo-brouillon.md) — conditions générales | Juridique | Signature. **Encore un brouillon : à faire relire.** |
| [`../conformite/sous-traitance-article-28.md`](../conformite/sous-traitance-article-28.md) — clauses de sous-traitance | Juridique, DPO | Signature |
| **[`deploiement-mdm.md`](deploiement-mdm.md) — déploiement par catalogue d'entreprise** | **Direction informatique** | **Dès la préparation du déploiement** |
| [`../conformite/information-salaries.md`](../conformite/information-salaries.md) — note d'information aux salariés | Ressources humaines, CSE | Avant la première utilisation sur le terrain |
| [`../privacy.html`](../privacy.html) — politique de confidentialité | Public, DPO | En ligne en permanence |
| [`modeles/facture.html`](modeles/LISEZMOI.md) — facture | Comptabilité | À l'encaissement |

**La fiche de déploiement est celle qu'on oublie.** Les clients visés — retail,
logistique — n'installent pas leurs applications depuis l'App Store : elles
arrivent par un catalogue interne piloté par un outil de gestion de parc
(Workspace ONE UEM, Intune, SOTI, Ivanti). Personne ne déploie sans savoir quoi
autoriser, et trois points bloquent silencieusement s'ils ne sont pas dits :
la caméra désactivée par le profil de restrictions, les adresses réseau
filtrées, et l'effacement à distance pendant un comptage hors ligne — qui perd
le travail non synchronisé. Version mise en page, à envoyer telle quelle :
https://claude.ai/code/artifact/c8e58fd2-4fd3-49b7-ba9d-547bce0cce43

## Gardé en interne

| Document | Objet |
|---|---|
| [`hypotheses-tarifaires.md`](hypotheses-tarifaires.md) | Les deux façons de facturer, chiffrées. Le raisonnement derrière la grille, pas la grille. |
| [`creation-devkaylab-checklist.md`](creation-devkaylab-checklist.md) | Immatriculation de la structure et obligations qui en découlent. |
| [`../conformite/registre-des-traitements.md`](../conformite/registre-des-traitements.md) | Registre RGPD. Se montre à la CNIL, pas au client. |
| [`../conformite/procedure-violation-donnees.md`](../conformite/procedure-violation-donnees.md) | Conduite à tenir en cas de violation. Le client en voit l'engagement dans les CGV, pas la procédure. |
| [`../conformite/suivi-activite-analyse.md`](../conformite/suivi-activite-analyse.md) | Pourquoi l'AIPD n'est pas requise. À produire seulement si on la conteste. |

## Ce qui manque encore

- ~~Un guide de prise en main~~ — **fait le 23 août 2026**
  (`deck/Quantinvo-prise-en-main.pptx`), avec le dossier technique pour la
  DSI (`deck/Quantinvo-dossier-DSI.pptx`).
- **Un questionnaire de sécurité pré-rempli.** Toute DSI d'une enseigne un peu
  grande en envoie un avant signature (hébergement, chiffrement, sauvegardes,
  réversibilité, sous-traitants). Les réponses existent, éparpillées entre la
  politique de confidentialité, les clauses de l'article 28 et la synthèse
  d'audit ; les rassembler une fois évite de les réécrire à chaque client.
- **Un plan de déploiement type** : de la signature au premier inventaire —
  création des magasins, invitation des superviseurs, import du référentiel et
  du stock théorique, impression des balises, formation. Le produit sait tout
  faire, l'ordre n'est écrit nulle part.
