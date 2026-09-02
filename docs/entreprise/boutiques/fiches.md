# Les deux fiches, prêtes à coller

Ce fichier est **la source** : ce qu'on colle dans App Store Connect et dans la
Google Play Console vient d'ici, et une correction se fait ici d'abord.

---

## ⚠️ Le parti pris, avant les textes

**Quantinvo ne s'ouvre que sur invitation.** Personne ne s'inscrit seul : un
compteur est ajouté par son superviseur, un superviseur par l'administrateur de
son entreprise. Cela renverse la règle habituelle des fiches de boutique.

- **Une fiche qui maximise les téléchargements nous nuit.** Quelqu'un qui
  installe l'application après une recherche générique se heurte à l'écran de
  connexion et ne peut rien faire. Il laisse un avis à une étoile — « impossible
  de créer un compte » — et la note d'une application neuve ne s'en remet pas.
- **Et c'est un motif de refus chez Apple** (règle 2.1) : une application dont
  la fonction principale est inaccessible sans compte doit dire clairement, dès
  la description, comment on obtient l'accès. Ne pas l'écrire, c'est un
  aller-retour de refus garanti à la première soumission.

Donc : **la première phrase de chaque description dit que l'accès vient de
l'entreprise.** Ce n'est pas de la prudence, c'est ce qui protège la note et ce
qui fait passer la revue.

**Ce que la fiche doit vraiment réussir**, dans l'ordre :

1. **Être trouvée par son nom.** Le cas de très loin le plus fréquent : un
   compteur reçoit son invitation, on lui dit « installe Quantinvo », il tape
   « Quantinvo ». La fiche doit le rassurer en trois secondes — c'est bien la
   bonne, elle vient de la bonne société, elle a l'air sérieuse.
2. **Rassurer une DSI ou un responsable** qui vérifie avant de déployer. D'où
   les phrases sur les données, l'absence de traceur, l'hébergement européen.
3. **Se faire trouver sur « inventaire magasin »**, loin derrière. C'est un
   bonus, jamais l'objectif.

---

## App Store (fr-FR)

### Nom — 30 caractères maximum

```
Quantinvo — Inventaire magasin
```

30 caractères tout juste. « Inventaire » et « magasin » sont indexés par le
nom : inutile de les remettre dans le champ de mots-clés.

### Sous-titre — 30 maximum

```
Scan, audit et écarts de stock
```

30 tout juste. Il n'ajoute aucun mot déjà présent dans le nom, et porte les
quatre termes qui décrivent le travail réel.

### Mots-clés — 100 maximum, séparés par des virgules SANS espace

```
code-barres,douchette,comptage,démarque,réserve,rayon,commerce,retail,EAN,SKU,zone,balise,équipe
```

⚠️ **Aucun mot du nom ni du sous-titre n'y figure** — Apple les indexe déjà, les
répéter gaspille des caractères. ⚠️ **Pas de pluriel** : Apple indexe les deux
formes. ⚠️ **Aucun nom de marque concurrente** : c'est un motif de rejet.

### Texte promotionnel — 170 maximum

Il se modifie **sans nouvelle version de l'application** : c'est là qu'on met ce
qui bouge.

```
L'accès à Quantinvo est ouvert par votre entreprise. Vous recevez une invitation par courrier électronique, vous choisissez votre mot de passe, et vous comptez.
```

### Description — 4 000 maximum

```
Quantinvo est l'outil d'inventaire des commerces de détail. Les équipes comptent le stock en rayon avec le téléphone qu'elles ont déjà ; le responsable suit l'avancement en direct et sort le rapport d'écarts.

ACCÈS SUR INVITATION
Quantinvo s'utilise dans le cadre professionnel. On ne s'y inscrit pas seul : votre responsable ou l'administrateur de votre entreprise ouvre votre accès, et vous recevez une invitation par courrier électronique. Si vous n'avez pas reçu la vôtre, demandez-la à votre responsable — c'est lui qui sait qui doit être dans quelle équipe.

COMPTER
• Le téléphone lit les codes-barres à la caméra. Une douchette Bluetooth s'y connecte pour les gros volumes, et la saisie au clavier reste là pour une étiquette abîmée.
• Le magasin se découpe en zones par des balises : des étiquettes QR numérotées, imprimées depuis l'outil sur des planches autocollantes ordinaires. Plusieurs personnes comptent en même temps, chacune son rayon, sans se gêner.
• La quantité se corrige d'un geste. Un article inconnu se crée sur place, sans quitter le comptage.

AUDITER
Un second passage, par quelqu'un d'autre, sur les rayons qui le méritent. L'écart entre les deux comptages s'affiche en unités et en valeur ; le superviseur tranche à l'écran, au rayon, sans rien noter sur un papier.

SUIVRE ET RENDRE COMPTE
L'avancement se lit en direct, rayon par rayon. À la clôture, le rapport donne le stock théorique, le stock compté, l'écart en pièces et en euros, article par article — et s'exporte en tableur.

SANS RÉSEAU
La réserve, le sous-sol, l'arrière-boutique : le comptage continue sans signal. Les scans sont mis en file et repartent seuls dès que le réseau revient. Rien n'est perdu, rien n'est à ressaisir.

VOS DONNÉES
Aucun traceur, aucune mesure d'audience, aucune publicité. Les données sont hébergées dans l'Union européenne. Un compte ne voit que ce qui le concerne, et la règle est appliquée par la base elle-même, pas seulement par l'écran. La caméra ne sert qu'à lire les codes-barres : aucune photo n'est enregistrée.

CE QU'IL FAUT SAVOIR
L'application est le poste de terrain. La préparation d'un inventaire — import du référentiel articles et du stock théorique, gestion de l'équipe, rapports élargis — se fait depuis le site, sur un ordinateur.

Quantinvo est édité par Devkaylab. Une question : contact@quantinvo.com
```

### Le reste des champs

| Champ | Valeur |
|---|---|
| Catégorie principale | Professionnel (Business) |
| Catégorie secondaire | Productivité |
| Classification par âge | 4+ — aucun contenu sensible |
| URL d'assistance | `https://www.quantinvo.com` |
| URL marketing | `https://www.quantinvo.com` |
| Politique de confidentialité | `https://www.quantinvo.com/confidentialite` |
| Droits de contenu | Ne contient, n'affiche ni n'accède à aucun contenu de tiers |
| Chiffrement | Déclaré exempt (`ITSAppUsesNonExemptEncryption = false`) — HTTPS et trousseau système uniquement |

---

## Google Play (fr-FR)

### Titre — 50 maximum

```
Quantinvo — Inventaire magasin et stock
```

39 caractères. Chez Google, le titre est le champ le plus lourd pour la
recherche : « inventaire », « magasin » et « stock » y sont donc, contrairement
à Apple où le sous-titre les porte.

### Description courte — 80 maximum

```
Comptez et auditez votre stock en magasin, au téléphone. Accès sur invitation.
```

78 caractères. ⚠️ **La mention de l'invitation tient dans les 80** — c'est le
seul texte visible avant le « Plus d'infos », et c'est là qu'elle sert le plus.

### Description complète — 4 000 maximum

La même que celle de l'App Store. Elle est **indexée** chez Google, ce qui
n'est pas le cas chez Apple : les mots y comptent vraiment, mais la densité doit
rester naturelle — au-delà de 5 % d'un même terme, Google traite le texte comme
du bourrage.

### Le reste des champs

| Champ | Valeur |
|---|---|
| Catégorie | Professionnel (Business) |
| Étiquettes | inventaire, gestion de stock, code-barres, commerce, productivité |
| Adresse électronique d'assistance | `contact@quantinvo.com` |
| Site web | `https://www.quantinvo.com` |
| Politique de confidentialité | `https://www.quantinvo.com/confidentialite` |
| Suppression de compte (URL) | `https://www.quantinvo.com/suppression-compte` |
| Classification du contenu | Questionnaire IARC — aucun contenu sensible, aucune interaction entre utilisateurs publique |
| Publicités | Aucune |

---

## Ce qu'il faut donner à l'examinateur

⚠️ **Sans compte de démonstration, la revue Apple s'arrête à l'écran de
connexion et refuse l'application** (règle 2.1). C'est le motif de refus le plus
courant pour une application professionnelle.

Dans App Store Connect → **Informations pour la vérification**, et dans la Play
Console → **Accès à l'application** :

- adresse : `jthiongkay+demo-superviseur@gmail.com`
- mot de passe : **il n'est pas écrit ici** — c'est celui du compte de
  démonstration Maison Oberlin, à coller depuis le gestionnaire de mots de
  passe. Un mot de passe n'entre pas dans un dépôt, même privé.
- notes, à recopier :

```
Quantinvo est un outil professionnel : l'accès est ouvert par l'entreprise cliente, il n'y a pas d'inscription libre. Le compte fourni est un compte de démonstration de superviseur, avec un inventaire en cours (« Rayon textile », magasin Oberlin Lyon).

Pour voir le produit en trois minutes :
1. Se connecter avec le compte fourni.
2. Ouvrir l'inventaire « Rayon textile » : l'avancement, les actions et le rapport y sont.
3. « Zones & balises » montre l'impression des étiquettes ; « Écarts d'audit » montre l'arbitrage ; « Rapport inventaire » montre le résultat.
4. « Compter des articles » ouvre le scanner. La caméra ne trouvera aucun code-barres dans le simulateur : l'onglet « Manuel » permet de saisir un code à la main. Les codes de la démonstration commencent par 3701000.

La caméra sert uniquement à lire les codes-barres des articles et les étiquettes QR des rayons. Aucune photo n'est enregistrée ni transmise.
```

---

## ⚠️ Ce qu'on ne met pas

- **Aucune mention promotionnelle dans les visuels** — pas de « gratuit », pas
  de note en étoiles, pas de faux badge de récompense. Motif de refus des deux
  côtés.
- **Aucun prix dans la fiche.** L'application est gratuite au téléchargement ;
  la licence se vend au magasin, hors boutique. Annoncer un prix ici ferait
  croire à un achat intégré qui n'existe pas — et Apple demanderait alors qu'il
  passe par son propre système de paiement.
- **Aucun lien d'achat dans l'application** (règle 3.1.1 d'Apple). Vérifié : les
  seuls liens sortants mènent à la page d'accueil du site, à la politique de
  confidentialité et au parcours « mot de passe oublié ».
- **Aucune capture d'écran dans le bandeau Play** : elles sont juste en dessous.
