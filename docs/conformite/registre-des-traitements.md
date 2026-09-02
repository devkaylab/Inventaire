# Registre des activités de traitement

**Responsable** : Devkaylab, éditeur de Quantinvo — contact@quantinvo.com
**Dernière mise à jour** : 19 août 2026
**Base** : article 30 du RGPD (constat M5 de l'audit du 13 août 2026)

> Ce registre décrit ce que le produit fait **réellement** : chaque ligne a été
> établie en relisant le code et le schéma de la base, non un modèle type. Il
> doit être relu par un conseil juridique avant d'être opposé à un tiers, et
> tenu à jour à chaque évolution fonctionnelle.

## Rappel de la répartition des rôles

| Traitement | Devkaylab est… | L'entreprise cliente est… |
|---|---|---|
| Relation client (demandes, devis, comptes) | responsable de traitement | — |
| Inventaires : comptages, audits, activité des équipes | sous-traitant | responsable de traitement |

Cette répartition doit être formalisée par le contrat de l'article 28
(`docs/conformite/sous-traitance-article-28.md`).

---

## T1 — Demandes d'inscription d'entreprise

| | |
|---|---|
| **Finalité** | Instruire une demande, établir un devis, encaisser, créer l'entreprise et ses magasins |
| **Base légale** | Mesures précontractuelles, puis exécution du contrat |
| **Personnes** | Contact professionnel de l'entreprise candidate |
| **Données** | Nom de l'entreprise, **SIREN**, **code APE**, prénom, nom, adresse électronique, téléphone, **magasins déclarés (nom, stock théorique en unités, surface de vente en m²)**, nombre de magasins, message libre ; statut, devis, montant, horodatages, note administrative |
| **Support** | Table `company_requests` |
| **Destinataires** | Administrateur Quantinvo uniquement (aucune policy RLS : accès par fonctions `SECURITY DEFINER`) |
| **Conservation** | Rejetées : 1 an. Autres : contact anonymisé à 3 ans (`purge_expired_data`) |
| **Sous-traitants** | Supabase (hébergement) |

Le **SIREN** est demandé à la place d'un extrait Kbis, et c'est un choix de
minimisation : le Kbis porte les date et lieu de naissance, la nationalité et
l'adresse personnelle du dirigeant, données d'identité sans rapport avec la
finalité — vérifier qu'une société existe et qu'elle est active. Le SIREN
d'une personne morale n'est pas une donnée à caractère personnel ; il en va
autrement pour un entrepreneur individuel, dont le SIREN identifie une
personne physique. Aucun document n'est téléversé ni conservé : la
consultation se fait sur le registre public.

Le **stock déclaré et la surface** servent à déterminer la tranche tarifaire
et à la recouper. Ce sont des données d'entreprise, non personnelles.

La **consultation du registre public** part du navigateur du visiteur, pas de
nos serveurs : `recherche-entreprises.api.gouv.fr` voit donc son adresse IP,
exactement comme s'il consultait lui-même l'annuaire des entreprises. Nous ne
transmettons que le numéro saisi. Du résultat, seules la raison sociale,
l'état administratif, la commune et le code APE sont lus ; le champ
`dirigeants`, qui porte des noms de personnes physiques, est ignoré. **Réserve
à garder en tête** : pour un entrepreneur individuel, la raison sociale *est*
un nom de personne — donnée publiée en données ouvertes par l'État, et rendue
à la personne qui vient de saisir son propre numéro, mais donnée personnelle
tout de même.

Le **code APE** est conservé avec la demande. Ce n'est pas une donnée à
caractère personnel : c'est la classification d'activité d'un établissement.
Il ne sert qu'à choisir la fourchette de densité stock / surface qui a un sens
pour ce commerce (`web/lib/secteurs.ts`), et n'ouvre aucun droit. Comme il
transite par le navigateur du visiteur, il vaut indication et non preuve — la
console d'administration porte le lien vers l'annuaire des entreprises pour
vérifier d'un clic.

## T2 — Demandes d'accès superviseur

| | |
|---|---|
| **Finalité** | Vérifier qu'une personne est habilitée par son magasin, puis créer son accès |
| **Base légale** | Mesures précontractuelles, puis exécution du contrat |
| **Personnes** | Salarié candidat au rôle de superviseur |
| **Données** | Prénom, nom, adresse électronique, téléphone, magasin et entreprise visés, statut, décision et son auteur |
| **Support** | Table `supervisor_requests` |
| **Destinataires** | Administrateur Quantinvo |
| **Conservation** | Anonymisées 1 an après traitement ; immédiatement si le compte est supprimé |
| **Sous-traitants** | Supabase, Resend (courrier d'invitation) |

## T3 — Comptes et profils

| | |
|---|---|
| **Finalité** | Authentifier, rattacher à une entreprise et à des magasins, appliquer les droits |
| **Base légale** | Exécution du contrat |
| **Personnes** | Compteurs, superviseurs, administrateur |
| **Données** | Adresse électronique et empreinte du mot de passe (`auth.users`) ; prénom, nom, rôle, entreprise (`profiles`) |
| **Support** | Tables `auth.users`, `profiles`, `store_supervisors`, `store_team` |
| **Destinataires** | La personne elle-même, son superviseur, l'administrateur |
| **Conservation** | Durée du compte. Suppression à la demande, avec détachement des comptages |
| **Sous-traitants** | Supabase (authentification), Resend (liens de connexion) |

## T4 — Inventaires : comptages et audits

| | |
|---|---|
| **Rôle** | **Sous-traitance** pour le compte de l'entreprise cliente |
| **Finalité** | Compter les stocks, auditer, produire le rapport d'écarts |
| **Base légale** | Déterminée par l'entreprise cliente (exécution du contrat de travail, intérêt légitime) |
| **Personnes** | Compteurs et superviseurs |
| **Données** | Articles et stocks importés ; comptages **nominatifs** (qui, quoi, quelle zone, quand), audits et arbitrages |
| **Support** | Tables `counts`, `article_audit`, `articles`, `theoretical_stock`, `zones` |
| **Destinataires** | Participants de l'inventaire et superviseurs des magasins concernés (cloisonnement appliqué en base, ligne par ligne) |
| **Conservation** | Décidée par l'entreprise cliente. Le lien avec l'identité est rompu si le compte est supprimé |
| **Sous-traitants** | Supabase |

## T5 — Activité en direct pendant un inventaire

| | |
|---|---|
| **Rôle** | **Sous-traitance** pour le compte de l'entreprise cliente |
| **Finalité** | Permettre au superviseur de savoir combien d'appareils travaillent, et dans quel mode |
| **Base légale** | Intérêt légitime de l'entreprise cliente — **à documenter par elle** (voir l'analyse E3) |
| **Personnes** | Aucune n'est identifiée depuis le 19 août 2026 : le signal porte un identifiant d'appareil tiré au hasard |
| **Données** | Mode (comptage / audit / aucun) et battement toutes les 30 s. **Depuis le 19 août 2026** : plus de nom, d'écran, de zone en cours ni d'état d'avant-plan (contrat de présence v2) |
| **Support** | Canal temps réel Supabase (`session:<id>:presence`), **non persisté**. La RPC `get_session_activity`, nominative, a été supprimée le 19 août 2026 |
| **Destinataires** | Superviseurs de l'inventaire concerné, sous forme de compteurs agrégés |
| **Conservation** | Aucune : l'information n'existe que pendant la connexion |
| **Sous-traitants** | Supabase |

## T6 — Notifications sur appareil

| | |
|---|---|
| **Finalité** | Prévenir une personne qu'elle est conviée à un inventaire |
| **Base légale** | Consentement (autorisation système de l'appareil, révocable) |
| **Personnes** | Utilisateurs de l'application mobile |
| **Données** | Jeton de notification propre à l'appareil, rattaché au compte |
| **Support** | Table `push_tokens` ; envoi via `exp.host` |
| **Destinataires** | **Expo** (États-Unis) |
| **Conservation** | Supprimé avec le compte (cascade) ou au retrait de l'autorisation |
| **Sous-traitants** | Expo, Supabase |

## T7 — Demandes de suppression de compte

| | |
|---|---|
| **Finalité** | Recevoir et tracer l'exercice du droit à l'effacement |
| **Base légale** | Obligation légale (article 17 du RGPD) |
| **Données** | Identifiant du compte, adresse électronique, nom, rôle, statut, horodatage |
| **Support** | Table `account_deletion_requests` |
| **Conservation** | 1 an, puis suppression ; identité effacée dès l'exécution de la demande |

## T8 — Journal des actions d'administration

| | |
|---|---|
| **Finalité** | Tracer qui a fait quoi et quand (imputabilité, article 32 ; réponse au constat M4) |
| **Base légale** | Intérêt légitime (sécurité et preuve) |
| **Personnes** | Administrateur (auteur) ; personnes visées par une action (superviseur validé, compte supprimé…) |
| **Données** | Auteur, action, cible et son libellé au moment de l'action, horodatage |
| **Support** | Table `admin_audit_log`, alimentée par les fonctions `admin_*` dans la même transaction que l'action |
| **Destinataires** | Administrateur Quantinvo (lecture seule ; aucune écriture ni suppression côté client) |
| **Conservation** | 1 an (CNIL, délibération 2021-122 ; ANSSI PA-022), purge par `purge_expired_data` |
| **Sous-traitants** | Supabase (hébergement) |

---

## Sous-traitants et transferts

| Sous-traitant | Rôle | Localisation | Transfert hors UE |
|---|---|---|---|
| Supabase | Base de données, authentification, temps réel | Irlande (`eu-west-1`) | Société établie aux États-Unis |
| Vercel | Hébergement du site | États-Unis | Oui |
| Resend | Courriers électroniques de service | États-Unis | Oui |
| Expo | Acheminement des notifications | États-Unis | Oui |
| Apple, Google | Distribution de l'application mobile | États-Unis | Oui |

## Mesures de sécurité

- Cloisonnement appliqué **par la base** (RLS ligne par ligne), pas seulement par l'application ;
- canaux temps réel privés, autorisation vérifiée à l'abonnement ;
- fonctions d'administration réservées au rôle `service_role` ;
- chiffrement des échanges (HTTPS), mots de passe stockés sous forme d'empreinte ;
- aucun secret dans le dépôt ;
- journal des actions d'administration (`admin_audit_log`, 1 an) ;
- procédure de violation documentée (`procedure-violation-donnees.md`), registre des violations tenu.

## Points ouverts

- Contrat de sous-traitance (article 28) à établir avec chaque entreprise cliente — **M5** ;
- information des salariés pour T4 (les comptages restent nominatifs), et position écrite sur le CSE et l'AIPD — **E3**, réexaminé le 19 août après le passage au suivi agrégé ;
- planification automatique de `purge_expired_data` (pg_cron non installé) — **E1/E2**.
