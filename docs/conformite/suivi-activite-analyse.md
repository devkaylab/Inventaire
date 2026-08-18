# Suivi de l'activité des compteurs — analyse et obligations

**Base** : constat E3 de l'audit du 13 août 2026
**Dernière mise à jour** : 18 août 2026

## Ce que le produit observe réellement

Relevé dans le code (`src/lib/presence.ts`, `web/hooks/useSessionLive.ts`,
RPC `get_session_activity`), pas déduit d'une intention :

| Signal | Détail | Persisté ? |
|---|---|---|
| Présence | Nom de la personne, connectée ou non, battement toutes les 30 s | Non |
| Écran | `session` ou `scan` — donc « en train de scanner » | Non |
| Mode | Comptage ou audit | Non |
| Zone | Balise ouverte, avec son libellé | Non |
| Premier plan | L'application est-elle affichée, ou passée en arrière-plan | Non |
| Activité déduite | Cadence des scans, « depuis 4 min », dernière balise | Oui, via les comptages |

Le superviseur voit tout cela **nominativement et en direct**. Un compteur qui
range son téléphone dans sa poche apparaît comme n'ayant plus l'application au
premier plan.

## Est-ce de la surveillance des salariés ?

Oui, au sens du droit du travail : le dispositif permet de suivre l'activité
individuelle d'un salarié pendant son temps de travail. Peu importe que ce ne
soit pas sa finalité première — c'est son effet.

Deux nuances qui jouent en faveur du dispositif :

- il ne fonctionne **que pendant un inventaire**, pas en continu ;
- rien n'est conservé : la présence disparaît avec la connexion.

## Ce qui doit être fait, et par qui

L'entreprise cliente est responsable de traitement : ces obligations lui
incombent. Devkaylab doit les lui signaler et lui fournir les éléments.

### 1. Information individuelle des salariés — obligatoire

Aucun dispositif de suivi n'est opposable à un salarié qui n'en a pas été
informé. Une note d'information type est fournie :
`information-salaries.md`.

### 2. Consultation du comité social et économique — obligatoire si CSE

Le CSE doit être consulté **avant** la mise en place d'un dispositif permettant
de contrôler l'activité des salariés (article L. 2312-38 du code du travail).
La consultation précède le déploiement : la régulariser après coup ne l'efface
pas.

### 3. Analyse d'impact (AIPD) — probablement requise

Les critères des lignes directrices européennes retenus ici :

| Critère | Rempli ? |
|---|---|
| Surveillance systématique | Oui — battement régulier, activité en continu pendant l'inventaire |
| Personnes vulnérables | Oui — un salarié n'est pas en position de refuser |
| Évaluation ou notation | Non |
| Décision automatisée | Non |
| Données sensibles | Non |
| Grande échelle | Non, à ce stade |

Deux critères remplis : l'analyse d'impact est **en principe requise**. La
liste de la CNIL vise le « contrôle permanent de l'activité des employés » — le
caractère intermittent du dispositif laisse une marge d'appréciation, mais elle
est trop mince pour s'en dispenser sans avis. À faire trancher par un conseil,
entreprise cliente par entreprise cliente.

## Recommandation produit : retirer le signal « premier plan »

Un signal se distingue des autres. Savoir sur quelle zone travaille un compteur
sert à piloter l'inventaire — c'est le métier. Savoir si son téléphone est
allumé et l'application affichée ne sert **à rien pour l'inventaire** : cela
renseigne uniquement sur le comportement de la personne.

C'est le signal le plus intrusif et le moins utile. Le retirer réduirait
sensiblement la portée du dispositif, donc la lourdeur des obligations, sans
rien coûter au produit. À arbitrer.

Deux minimisations moins tranchées, à considérer ensuite :

- n'afficher la présence qu'**agrégée** hors inventaire en cours ;
- remplacer « depuis 4 min » par un simple indicateur d'activité récente, qui
  informe le superviseur sans chronométrer la personne.

## État

- [ ] Information des salariés diffusée par chaque entreprise cliente
- [ ] CSE consulté, le cas échéant
- [ ] AIPD conduite ou écartée par écrit et motivée
- [ ] Arbitrage sur le signal « premier plan »
- [x] Traitement déclaré dans la politique de confidentialité et au registre
