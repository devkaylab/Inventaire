# Le magasin créé demande qui le supervise (4 septembre 2026)

Julien, au retour de son paiement : *« une fois le paiement accepté, ouvrir un
pop-up pour ajouter des superviseurs sur le magasin, ça évite de chercher la
page équipe du magasin. »*

**Un magasin sans superviseur ne sert à rien** — personne ne peut y lancer
d'inventaire. Le geste suivant est donc toujours le même, et il était à chercher
deux écrans plus loin. `web/components/QuiSupervise.tsx`, ouvert au retour de
`?magasin=ok&demande=<id>`.

- **⚠️ AUCUN SECOND CHEMIN D'AFFECTATION** : la fenêtre appelle
  `ca_set_supervisor_stores`, celle de la page Équipe, avec ses gardes.
- **⚠️ ELLE REMPLACE LA LISTE DES MAGASINS D'UNE PERSONNE.** On lui envoie donc
  les siens **plus celui-ci** — lui envoyer ce seul magasin retirerait la
  personne de tous les autres. Le piège est dans le nom de la fonction, pas
  dans son comportement.
- **Les administrateurs d'entreprise ne sont pas proposés** : ils ont tous les
  magasins par construction depuis le 22 août, et `ca_set_supervisor_stores`
  refuse nommément un profil `is_company_admin`.
- **⚠️ ON ATTEND LE WEBHOOK, ET C'EST TOUTE LA DIFFICULTÉ.** Stripe renvoie le
  client sur la page dans la seconde ; le magasin naît quand le webhook passe.
  Sans cette attente — dix essais, deux secondes d'écart — on lirait une demande
  encore en `paid` et on conclurait qu'il n'y a rien à montrer. Au-delà de vingt
  secondes c'est une anomalie, qui remonte déjà dans « Ventes en cours ».
- **L'adresse se nettoie tout de suite** (`replaceState`) : un rafraîchissement
  ne doit pas rouvrir la fenêtre.
- `magasin_cree_par` **rend le statut même quand le magasin n'existe pas
  encore** : c'est ce qui permet à l'écran de distinguer « ça arrive » de « il
  n'y a rien à voir ».
- L'adresse d'un superviseur **se tronque, elle ne casse pas la ligne** : une
  adresse longue reléguait « 1 magasin » sur un second rang et déséquilibrait
  toute la liste.

Tests de garde : `web/tests/libre-service.test.ts`, blocs « l'abonnement suit le
magasin » et « le magasin créé demande qui le supervise ».

## ⚠️ On ne facture pas les tranches deux fois (4 septembre 2026)

Trouvé **en relisant pour répondre à Julien**, qui demandait confirmation que le
chantier était clos — pas par un test, pas par un sabotage. Il n'avait jamais
tourné, et il n'aurait fait de dégât qu'au premier changement d'offre d'un
client abonné.

Un magasin né d'un Checkout **au-delà de cent appareils** porte déjà une ligne
« appareils supplémentaires » chez Stripe, alors que
`stores.stripe_item_appareils` est **nul** : le paiement enregistre
l'abonnement, pas le détail de ses lignes. Le chemin d'API ne cherchait dans
l'abonnement que l'article de l'offre ; le supplément, lui, partait à `null` —
c'est-à-dire « crée-le ». **Le client aurait payé ses tranches deux fois**, et
rien ne l'aurait signalé.

⚠️ **La leçon : un identifiant qu'on n'a pas enregistré ne vaut pas un
identifiant qui n'existe pas.** `null` en base voulait dire « je ne sais pas »,
et le code le lisait « il n'y en a pas ». Partout où un article, un abonnement
ou un client Stripe est absent de nos colonnes, il faut aller **regarder chez
Stripe** avant de conclure — c'est ce que faisait déjà l'article de l'offre, et
c'est exactement pour ça qu'il ne saignait pas.

Tests de garde : `web/tests/libre-service.test.ts`, bloc « on ne facture pas les
tranches deux fois ».

## Une alerte s'éteint quand le geste qui la règle est fait (4 septembre 2026)

Relevé en auditant le décompte d'appareils à la demande de Julien (« au-delà du
build, tout est fait ? »). La tuile « Refusés · 30 derniers jours » se teintait
d'ambre dès qu'un refus existait — **y compris après le passage à l'offre
supérieure**. Les refus restent trente jours : le client aurait vu un mois
durant une alerte pour un problème qu'il venait de régler en payant.

L'ambre suit donc le **verdict** (`etat === 'depasse'`), pas le compte. Le
chiffre, lui, ne bouge pas : c'est un fait, et il reste lisible.

⚠️ **Une alerte qui persiste après le geste qui la règle est une alerte qu'on
cesse de lire** — et c'est la même famille que « un zéro ne porte aucune
couleur » (29 août) : la couleur dit ce qu'il faut faire, jamais ce qui s'est
passé.

⚠️ **Piège de rédaction, troisième fois** : un commentaire `{/* … */}` n'est pas
du JSX valide **entre deux attributs** d'une balise, pas plus qu'en premier
enfant d'un `cond && (…)`. Il se pose avant la balise.

Tests de garde : `web/tests/decompte-appareils.test.ts`, bloc « une alerte
s'éteint quand le geste qui la règle est fait ».
