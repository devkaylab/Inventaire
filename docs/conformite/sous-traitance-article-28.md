# Contrat de sous-traitance — clauses à intégrer

**Objet** : encadrer le traitement des données que Devkaylab (Quantinvo) effectue
**pour le compte** des entreprises clientes.
**Base** : article 28 du RGPD (constat M5 de l'audit du 13 août 2026)

> Ces clauses sont à intégrer aux conditions de service ou à annexer au contrat
> signé avec chaque entreprise cliente. **À faire relire par un conseil
> juridique** : ce document décrit fidèlement ce que le produit fait, il ne
> remplace pas une rédaction contractuelle.

## Pourquoi c'est obligatoire

Dès qu'une entreprise cliente lance un inventaire, Devkaylab traite pour son
compte des données concernant ses salariés : qui compte, quoi, où, quand, et son
activité en direct. L'entreprise est responsable de traitement, Devkaylab
sous-traitant. L'article 28 impose alors un **contrat écrit** — sans lui, les
deux parties sont en infraction, indépendamment de la qualité technique du
service.

## 1. Objet, durée, nature et finalité

Le sous-traitant héberge et fait fonctionner l'application d'inventaire. Le
traitement dure le temps du contrat de service. Les catégories de données et de
personnes concernées sont celles décrites au registre
(`registre-des-traitements.md`, traitements T4 et T5).

## 2. Instructions documentées

Le sous-traitant ne traite les données que sur instruction documentée du
responsable. L'usage du service constitue cette instruction ; toute demande
particulière se formule par écrit. Le sous-traitant informe le responsable s'il
estime qu'une instruction constitue une violation du RGPD.

## 3. Confidentialité

Les personnes autorisées à accéder aux données chez le sous-traitant sont
soumises à une obligation de confidentialité. À ce jour, l'accès administratif
est limité au seul compte administrateur de l'éditeur.

## 4. Sécurité

Le sous-traitant met en œuvre : cloisonnement appliqué par la base ligne par
ligne, canaux temps réel privés avec vérification d'autorisation à l'abonnement,
fonctions d'administration réservées au rôle serveur, chiffrement des échanges,
stockage des mots de passe sous forme d'empreinte.

## 5. Sous-traitants ultérieurs

Le responsable autorise le recours aux sous-traitants suivants :

| Sous-traitant | Rôle | Localisation |
|---|---|---|
| Supabase | Base de données, authentification, temps réel | Irlande (`eu-west-1`) |
| Vercel | Hébergement du site | États-Unis |
| Resend | Courriers électroniques de service | États-Unis |
| Expo | Acheminement des notifications | États-Unis |

Tout ajout ou remplacement est notifié au responsable, qui dispose d'un délai
pour s'y opposer.

## 6. Transferts hors Union européenne

Les données d'inventaire sont stockées en Irlande. L'hébergement du site,
l'envoi des courriers et l'acheminement des notifications impliquent des
prestataires établis aux États-Unis. Ces transferts s'appuient sur les accords
de sous-traitance publiés par ces prestataires, intégrant les clauses
contractuelles types de la Commission européenne.

## 7. Assistance au responsable

Le sous-traitant aide le responsable à répondre aux demandes d'exercice des
droits, à notifier une violation, et à conduire une analyse d'impact. Les
demandes reçues directement d'une personne concernée sont relayées au
responsable, qui décide.

## 8. Violation de données

Le sous-traitant notifie le responsable **dans les meilleurs délais** après en
avoir pris connaissance, avec les éléments permettant la notification à
l'autorité dans les 72 heures. *(La procédure interne correspondante reste à
établir — constat M6.)*

## 9. Sort des données en fin de contrat

Au choix du responsable : restitution (export du rapport et des données
d'inventaire) ou suppression. À défaut d'instruction dans un délai convenu, les
données sont supprimées.

## 10. Audit

Le sous-traitant met à disposition les informations nécessaires pour démontrer
le respect de l'article 28 et permet les audits raisonnables du responsable.

---

## Points à trancher avant signature

- Délai de notification d'un changement de sous-traitant ultérieur ;
- délai de conservation après résiliation avant suppression définitive ;
- modalités concrètes d'audit (documentation sur demande plutôt qu'audit sur site) ;
- personne à contacter chez le responsable pour les notifications de violation.
