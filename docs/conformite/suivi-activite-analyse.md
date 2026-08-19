# Suivi de l'activité des compteurs — analyse et obligations

**Base** : constat E3 de l'audit du 13 août 2026
**Dernière mise à jour** : 19 août 2026 — *le dispositif a changé, voir ci-dessous*

## Décision produit du 19 août 2026 : passage à un suivi agrégé

Le suivi nominatif en direct a été **retiré**. Il est remplacé par des
compteurs : nombre d'appareils connectés, nombre en comptage, nombre en audit.
Le pilotage de l'inventaire passe désormais par l'avancement par zone, qui
décrit le **travail** et non les personnes.

Ce que le canal temps réel transporte encore (contrat de présence v2,
`web/lib/presence.ts` et `src/lib/presence.ts`) :

| Signal | Détail | Persisté ? |
|---|---|---|
| Mode | Comptage, audit, ou aucun | Non |
| Battement | Horodatage, pour écarter une socket fantôme | Non |

Et ce qui en a disparu : le **nom**, l'**écran ouvert**, la **balise en cours**,
l'**horodatage de début d'activité** et l'**application au premier plan**. La
clé de présence n'est plus l'identifiant de l'utilisateur mais un identifiant
d'appareil tiré au hasard à chaque montage : plus rien sur ce canal ne désigne
une personne. Le site, de son côté, **écoute sans publier**.

Retirés également, côté données descendantes :

- `get_session_activity` — une ligne nominative par personne, avec cadence et
  dernière balise — n'est plus appelée par aucun client ;
- le fil des derniers scans n'affiche plus l'auteur, et `counted_by` n'est même
  plus demandé au serveur pour l'alimenter.

## Ce qui reste nominatif, et pourquoi

`counts.counted_by` continue d'être écrit à chaque scan, et ressort dans le
rapport et l'export (« Compté par », « Audité par »).

C'est **une autre finalité** : arbitrer un écart entre comptage et audit
suppose de savoir qui a compté, pour reprendre avec la bonne personne. L'usage
est différé, à la demande du superviseur, et non un flux d'observation continu.
Supprimer cette colonne retirerait au produit sa capacité d'audit — c'est-à-dire
sa raison d'être.

## Est-ce encore de la surveillance des salariés ?

Le dispositif ne permet plus de suivre l'activité **individuelle** en direct.
Il subsiste un traitement de données personnelles — les comptages sont
nominatifs — mais il documente un travail accompli, comme le ferait n'importe
quel enregistrement de production.

### Critères de l'analyse d'impact, réexaminés

| Critère | Avant le 19 août | Après |
|---|---|---|
| Surveillance systématique | Oui — battement régulier, activité observée en continu | **Non** — plus d'observation individuelle, des compteurs agrégés |
| Personnes vulnérables | Oui — un salarié n'est pas en position de refuser | Oui, inchangé |
| Évaluation ou notation | Non | Non |
| Décision automatisée | Non | Non |
| Données sensibles | Non | Non |
| Grande échelle | Non | Non |

Deux critères remplis appelaient une analyse d'impact ; **il n'en reste qu'un**.
L'AIPD n'est donc, en principe, plus requise. Cette conclusion doit être
confirmée par un conseil et **écrite** : une AIPD écartée se motive par écrit,
elle ne se déduit pas d'un silence.

## Ce qui doit être fait, et par qui

L'entreprise cliente est responsable de traitement. Devkaylab lui signale ces
obligations et lui fournit les éléments.

### 1. Information des salariés — toujours obligatoire

Les comptages restent nominatifs : les personnes doivent le savoir. La note
type reste valable, allégée de ce qui ne s'applique plus (`information-salaries.md`).

### 2. Consultation du CSE — à réexaminer

L'obligation vise les dispositifs permettant de **contrôler l'activité** des
salariés (article L. 2312-38 du code du travail). Le suivi en direct ayant été
retiré, l'argument d'un simple enregistrement de production devient défendable.
La prudence reste de mise : informer le CSE coûte peu et sécurise.

### 3. Analyse d'impact — probablement écartée

Voir le tableau ci-dessus. À faire trancher et motiver par écrit.

## État

- [x] Suivi nominatif en direct retiré (contrat de présence v2, 19 août 2026)
- [x] Signal « application au premier plan » supprimé
- [x] `get_session_activity` sans appelant ; fil des scans anonyme
- [x] Traitement déclaré dans la politique de confidentialité et au registre
- [ ] Information des salariés diffusée par chaque entreprise cliente
- [ ] Position écrite sur le CSE
- [ ] AIPD écartée par écrit et motivée, ou conduite

## Reste ouvert

La RPC `get_session_activity` existe toujours en base, sans appelant. La
supprimer demande une migration ; tant qu'elle est là, elle reste exécutable
par un participant de l'inventaire qui appellerait l'API directement.
