# Violation de données — fiche réflexe

*Réponse au constat M6 de l'audit du 13 août 2026 (articles 33 et 34 du RGPD).
À relire une fois par an. Version du 18 août 2026.*

**Une violation**, c'est tout incident qui touche des données personnelles :
accès par quelqu'un qui n'aurait pas dû, fuite, perte, altération. Exemples
concrets pour Quantinvo : clé `service_role` exposée (dans un dépôt, un
message, une capture), compte administrateur compromis, e-mail envoyé au
mauvais destinataire avec des données dedans, faille qui ouvre la base ou le
temps réel à d'autres entreprises, appareil volé avec une session ouverte.

## Réflexe immédiat : noter l'heure

**Le délai de 72 heures court dès la prise de connaissance**, pas dès qu'on a
tout compris. Noter par écrit : date et heure de la découverte, comment on l'a
su, ce qu'on sait déjà. Ce premier écrit alimente tout le reste.

## 1. Contenir (dans l'heure)

- Clé ou secret exposé → le **révoquer** dans la console Supabase
  (Settings → API) ou chez le prestataire concerné, et le remplacer.
- Compte compromis → réinitialiser son mot de passe, fermer ses sessions
  (console Supabase → Authentication → l'utilisateur → Sign out).
- Faille dans le code → couper la fonctionnalité en cause plutôt que de la
  laisser ouverte le temps de corriger.
- Conserver les preuves : journaux Supabase et Vercel, journal des actions
  d'administration (`admin_audit_log`), captures.

## 2. Déterminer qui doit notifier — le point qui change tout

| Données touchées | Rôle de Devkaylab | Qui notifie la CNIL |
|---|---|---|
| Comptes, profils, demandes d'inscription, devis, invitations | **Responsable de traitement** | **Devkaylab**, sous 72 h |
| Comptages, audits, activité des équipes pendant un inventaire | **Sous-traitant** | L'**entreprise cliente** — Devkaylab la prévient **sans délai** (article 33-2), c'est elle qui décide et notifie |

Si les deux catégories sont touchées, faire les deux. Prévenir un client se
fait par écrit (e-mail au superviseur ou au contact de l'entreprise), avec les
faits connus, même incomplets.

## 3. Évaluer le risque pour les personnes

Trois questions : **quelles données** (identifiants ? téléphones ? activité de
salariés ?), **combien de personnes**, **quelles conséquences plausibles**
(hameçonnage, usurpation, pression de l'employeur sur un salarié…).

- Aucun risque (données déjà publiques, chiffrées, incident purement interne
  sans exposition) → pas de notification, mais **inscription au registre**
  des violations quand même.
- Risque → **notifier la CNIL sous 72 h**.
- Risque élevé → notifier la CNIL **et informer chaque personne concernée**
  (article 34), en français simple : ce qui s'est passé, ce qu'elles risquent,
  ce qu'on a fait, ce qu'elles peuvent faire (changer de mot de passe…).

## 4. Notifier la CNIL

- Téléservice : **notifications.cnil.fr** (compte à créer le jour même si
  besoin, ne pas attendre d'avoir un compte pour travailler le dossier).
- Contenu attendu : nature de la violation, catégories et nombre approximatif
  de personnes et d'enregistrements, conséquences probables, mesures prises et
  prévues, point de contact (contact@quantinvo.com).
- **On peut notifier en deux temps** : une notification initiale avec ce qu'on
  sait dans les 72 h, complétée ensuite. Dépasser 72 h se justifie, mais se
  motive dans la notification.

## 5. Inscrire au registre des violations

Toute violation, notifiée ou non, s'inscrit dans
`docs/conformite/registre-des-violations.md` : faits, effets, mesures. C'est
une obligation (article 33-5), et c'est ce que la CNIL demande en premier lors
d'un contrôle.

## Après coup

Corriger la cause, pas seulement le symptôme. Reporter la leçon dans
`AGENTS.md` (section conformité) pour que les sessions suivantes ne recréent
pas la faille. Si l'incident vient d'un sous-traitant (Supabase, Vercel,
Resend, Expo), leur avis de violation déclenche exactement la même procédure.
