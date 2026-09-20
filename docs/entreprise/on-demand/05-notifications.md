# Quantinvo On-Demand — ce qu'on envoie, et quand

*Document de conception, 20 septembre 2026. Rien n'est construit.*
Couvre le point 43 du plan.

---

## 1. Ce qui existe déjà, et qu'on ne refait pas

- **Un seul gabarit d'e-mail transactionnel** (`docs/notes/012`), par Resend.
  Les e-mails d'On-Demand passent dedans — ne pas ouvrir un second gabarit.
- **Les notifications sur appareil** existent : table `push_tokens`,
  acheminement par Expo, traitement T6 du registre.
- **La table `notifications`** et le rail de messagerie (`docs/notes/005`).
- **`alertes_envoyees`** garde ce qui est parti : c'est ce qui empêche
  d'envoyer deux fois la même alerte.

---

## 2. La règle qui décide de tout

**On n'envoie que ce qui demande une action ou change un engagement.**

Un message qui ne fait ni l'un ni l'autre entraîne la désactivation des
notifications — et c'est alors le message utile, trois semaines plus tard, qui
n'arrive pas.

Corollaire : **le canal se choisit par l'urgence, pas par l'importance.**
Un SMS pour ce qui se joue dans l'heure. Une notification pour la journée. Un
e-mail pour ce qui se garde et se retrouve.

---

## 3. Côté client

| Quand | Canal | Pourquoi |
|---|---|---|
| Réservation confirmée | e-mail | il garde la trace et le prix |
| Équipe complète | notification | fin de l'incertitude |
| La veille | e-mail | ce qu'il doit préparer sur place |
| L'inventaire a commencé | notification | il peut suivre |
| Écart de périmètre constaté sur place | **SMS + appel** | il doit décider avant qu'on commence |
| Inventaire terminé, rapport disponible | e-mail | c'est le livrable |
| Facture | e-mail | comptabilité |

⚠️ **L'écart de périmètre est le seul cas où on appelle.** Le prix ferme peut
bouger, l'équipe attend, le magasin est ouvert : rien de tout ça ne se règle par
un message qu'on lira demain.

⚠️ **Pas de notification pendant l'inventaire.** Le suivi est sur un écran
qu'il ouvre s'il veut. Le prévenir à chaque zone terminée, c'est le réveiller
à minuit pour rien.

---

## 4. Côté inventoriste

| Quand | Canal | Pourquoi |
|---|---|---|
| Nouvelle mission proposée | notification | c'est le cœur du produit, et ça se périme |
| Mission attribuée | notification + e-mail | il bloque sa soirée |
| Rappel la veille | notification | adresse, heure, ce qu'il apporte |
| Rappel 2 h avant | notification | c'est le dernier moment utile |
| Il n'a pas pointé à l'heure | **SMS** | on a 15 minutes pour trouver quelqu'un |
| Mission annulée par le client | notification + e-mail | sa soirée se libère, et il peut être indemnisé |
| Versement parti | e-mail | c'est de l'argent |
| Profil validé | notification + e-mail | ça débloque tout |
| Pièce manquante depuis 7 jours | e-mail | sinon le profil dort |

⚠️ **Une mission proposée se périme.** La notification porte un délai
(« répondez avant 18:00 »), et l'absence de réponse n'est pas un refus : elle
compte dans le taux d'acceptation, pas dans le taux d'annulation.

---

## 5. Côté Quantinvo

Ce sont des alertes d'exploitation, pas des messages :

- **mission en danger** — équipe incomplète à H−4 ;
- **désistement** — dès qu'il arrive, quel que soit le délai ;
- **pas de pointage** — 15 minutes après l'heure attendue ;
- **mission qui déborde** — durée réelle au-delà de la durée annoncée ;
- **versement bloqué** — compte Stripe incomplet la veille du virement ;
- **paiement client échoué** à la clôture.

⚠️ **Une alerte sans destinataire ne sert à rien.** Tant que l'équipe
d'exploitation, c'est une personne, elles vont sur son téléphone — pas dans un
écran qu'il faut penser à ouvrir.

---

## 6. Ce qui ne s'envoie jamais

- **Le nom d'un inventoriste au client.** Ni dans un message, ni dans un
  rapport, ni dans une facture.
- **Le prix client à l'inventoriste.** Il connaît sa rémunération ; savoir que
  le magasin a payé 949 € pour ses 90 € n'aide personne.
- **Une relance commerciale déguisée en message de service.** L'e-mail
  transactionnel a la confiance qu'il a parce qu'il ne vend rien.

---

## 7. Ce qui reste ouvert

- Le **SMS** n'existe pas encore dans le produit : ni prestataire, ni coût, ni
  entrée au registre. Deux cas seulement en ont besoin — l'écart de périmètre
  et le pointage manquant — mais ce sont les deux qui comptent.
- Les **préférences** : l'inventoriste doit pouvoir couper les propositions
  sans couper les rappels de ses missions acceptées.
