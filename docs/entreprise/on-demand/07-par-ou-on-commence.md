# Quantinvo On-Demand — par où on commence

*Document de conception, 20 septembre 2026. Rien n'est construit.*
Couvre les points 46, 47 et 48 du plan.

---

## 1. ⚠️ Ce qui doit être réglé avant la première ligne de code

Aucun de ces points n'est technique, et aucun ne se rattrape après.

1. **Le statut des inventoristes.** Indépendants payés par Quantinvo — décidé
   le 20 septembre. Une équipe encadrée par un responsable qui attribue les
   zones et contrôle le travail est la définition du lien de subordination : le
   contrat doit être une **prestation de résultat**, pas une fourniture
   d'heures. À faire valider par un avocat avant d'ouvrir les inscriptions.
2. **La TVA.** On-Demand fait sortir Quantinvo de la franchise vers la
   quarantième mission, et l'abonnement OS en sort avec. Décision comptable,
   puis décision de prix, puis code (`04-economie-et-tva.md`).
3. **Stripe Connect.** Onboarding, clé restreinte, second endpoint de webhook.
   Et les deux documents de conformité à mettre à jour
   (`01-comptes-et-droits.md`).
4. **Le lancement en cours.** Les deux boutiques sont en examen, Stripe live
   n'est pas fait, la vente est fermée. **On-Demand ne commence pas avant que
   Quantinvo OS soit vendu au moins une fois.**

---

## 2. Le socle, qui ne se voit pas

Dans cet ordre, parce que chacun dépend du précédent.

1. **Les droits** — `entitlements`, `provider_profiles`, `mission_access`, et
   la deuxième source d'appartenance dans toutes les règles d'accès. C'est le
   plus gros morceau et le moins visible.
2. **Le trou du plafond d'appareils** — `plafond_appareils` qui ne refuse rien
   quand elle rend `null`. À fermer de toute façon, On-Demand ou pas.
3. **La mission** — la table, la machine d'état, et l'ouverture/fermeture des
   accès temporaires en un seul endroit.
4. **Le prix** — en base, avec ses réglages et son verrouillage.

⚠️ **Rien de tout ça ne produit d'écran.** C'est trois à quatre semaines sans
rien à montrer, et c'est normal : construire le tunnel d'abord obligerait à le
refaire.

---

## 3. La première mission, faite à la main

L'objectif n'est pas un produit : c'est **une vraie mission, pour un vrai
magasin, payée**. Tout ce qui peut être manuel l'est.

| Ce qui est construit | Ce qui est manuel |
|---|---|
| le tunnel client jusqu'au paiement | la constitution de l'équipe |
| la mission et ses accès temporaires | le choix des inventoristes |
| le comptage (c'est Quantinvo OS, déjà là) | le versement, à la main chez Stripe |
| le rapport (déjà là) | le contrôle qualité, par téléphone |

**Le client doit croire que tout est automatique. Nous devons savoir que non.**

Ce qu'on mesure sur cette mission, et qui vaut plus que le reste : le temps
passé à constituer l'équipe, l'écart entre durée annoncée et durée réelle, et
la productivité réelle en articles par heure. Les trois hypothèses du modèle de
prix sont là-dedans.

---

## 4. Ensuite, dans l'ordre de ce qui fait mal

1. **L'inscription des inventoristes** et leur vérification — sans ça, le
   vivier se constitue par téléphone, et ça ne passe pas l'échelle.
2. **La proposition de mission** sur téléphone : voir, accepter. C'est le geste
   qui décide si les gens restent.
3. **Les versements automatiques** par Connect, le mercredi.
4. **Le pointage et l'attribution de zone**, qui remplacent le responsable qui
   coche sur un papier.
5. **Le score**, quand il y a assez de missions pour qu'il veuille dire quelque
   chose — pas avant.
6. **Le matching assisté**, quand cinquante missions faites à la main ont donné
   les vrais critères.

⚠️ **Le matching automatique est le dernier, pas le premier.** C'est le plus
tentant à construire et le plus dangereux à deviner
(`03-matching-et-score.md`).

---

## 5. Plus tard, et seulement si le reste tient

Prix dynamique, paiement instantané avec frais, nouvelles villes, prédiction de
durée, comptes grands réseaux. Aucun ne se pose tant qu'on n'a pas trente
missions par mois qui se passent bien.

⚠️ **Les grands comptes (point 49) sont une exception à ranger tôt.** Une
enseigne qui veut réserver quatre inventaires d'un coup ne doit pas retomber
dans un devis — c'est toute la promesse. Mais c'est un écran, pas une
architecture : le modèle de données le porte déjà, puisqu'une entreprise a
déjà plusieurs établissements.

---

## 6. Ce qui ferait tout arrêter

Autant l'écrire maintenant, à froid :

- **l'avocat dit que le montage expose à la requalification** et qu'aucune
  rédaction ne le règle ;
- **on ne trouve pas d'inventoristes** — le produit n'existe pas sans eux, et
  c'est le seul point que ni le code ni le prix ne résolvent ;
- **le coût de constitution d'une équipe reste supérieur à 100 € par mission**
  après cinquante missions : la marge de 237 € ne paie plus le travail qu'elle
  demande.

Ces trois-là se mesurent tôt. C'est d'ailleurs pour ça que la première mission
se fait à la main.
