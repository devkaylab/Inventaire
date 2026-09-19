# ⚠️ La grille a été revalorisée le 31 août 2026 — Stripe ne le sait pas encore

*« Monte le prix entreprise à 890 € par mois, base-toi sur ce % d'augmentation
de prix pour les autres offres. Je sais que ça fera trop cher pour Essential
mais on y reviendra plus tard, pour l'instant je veux maximiser la marge sur
Advanced. »*

Enterprise passe de 650 à **890 €/mois**, soit **+36,9 %**, appliqué aux deux
autres offres. Les mensuels sont l'arrondi de ce calcul, les annuels gardent le
rapport d'environ 10,6 mensualités de la grille du 30 août :

| Offre | Avant | Après |
|---|---|---|
| Essential | 65 € / 690 € | **89 € / 950 €** |
| Advanced | 225 € / 2 400 € | **310 € / 3 300 €** |
| Enterprise | 650 € / 6 900 € | **890 € / 9 450 €** |
| Supplément par 10 appareils | 47 € / 500 € | **64 € / 690 €** |

**⚠️⚠️ RIEN N'EST ENCAISSÉ AU NOUVEAU PRIX TANT QUE LES SIX PRICE STRIPE N'ONT
PAS ÉTÉ RECRÉÉS.** C'est le point qui coûte de l'argent, et il ne se voit
nulle part dans le code : le montant prélevé vient du Price désigné par le
secret `STRIPE_PRICE_<OFFRE>_<RYTHME>`, jamais de la grille du dépôt. En
l'état, le site affiche 310 € et Stripe encaisse 225 €. Un Price Stripe **ne se
modifie pas** : il faut en créer six nouveaux dans le tableau de bord, puis
remplacer les six secrets d'edge functions. Aucun redéploiement de fonction
n'est nécessaire pour ça — les secrets se lisent à l'exécution — mais
`subscribe-online` doit tout de même être redéployée pour que sa grille
(affichage et `annual_price_cents`) suive.

⚠️ **REDÉPLOYÉE LE 4 SEPTEMBRE 2026** (version 4, `--no-verify-jwt`, contrôlé
inchangé), le jour où Julien a créé les nouveaux Price. La version en ligne
datait du 30 août et portait encore **l'ancienne grille** : avec les nouveaux
Price posés en secrets, Stripe aurait prélevé 310 € pendant que
`deposer_souscription` inscrivait 225 € dans les lignes de devis et dans
`stores.annual_price_cents`. Le client aurait payé le bon montant et nos
chiffres auraient dit le mauvais — un écart qui ne se voit qu'à la
réconciliation. **Toute revalorisation de la grille se termine par ce
redéploiement.** Vérifié après coup : `supabase functions download` puis
`diff` — les deux fichiers sont identiques au dépôt, et la fonction répond
« Offre inconnue » sur un plan invalide (donc son code est atteint sans JWT).

⚠️ **Un Price archivé ne peut plus ouvrir de paiement.** Stripe ne permet pas
de supprimer un Price, seulement de l'archiver — et un Price archivé continue
d'honorer les abonnements en cours mais **refuse toute nouvelle session
Checkout**. Les six secrets doivent donc porter les identifiants des NOUVEAUX
Price ; sinon l'offre répond 502 et personne ne peut souscrire. L'échec est
visible et sans dégât (la demande reste en `accepted` et remonte dans « Ventes
en cours »), mais il est total.

**⚠️ Les abonnements déjà souscrits gardent leur ancien Price.** Stripe ne
rétro-facture pas : c'est le comportement voulu, mais il faut le savoir avant
de croire qu'un client paie le tarif affiché.

Points à ne pas défaire :

- **La hausse est proportionnelle, donc tous les rapports de la grille sont
  préservés** : le prix par appareil décroît toujours (475 → 165 → 94,5 → 69 €),
  l'empilement reste perdant (10 Essential = 9 500 € contre 3 300 €), et le pas
  de la frontière Essential → Advanced vaut toujours 3,47.
- **⚠️ La marge sous l'ancre de marché a été dépensée.** Enterprise était 31 %
  sous Zebra SmartCount (≈ 10 000 €/magasin/an, confidentielle) ; à 9 450 € il
  est à ~5 %. Et un magasin à 150 appareils paie désormais 12 900 €, donc
  au-dessus de l'ancre — au-delà de cent appareils on sort de toute façon sur
  devis, c'est là que la question se traite.
- **Essential est assumé trop cher** (950 €/an pour deux appareils n'est plus un
  prix d'appel). Julien l'a dit en demandant la hausse : c'est un report, pas un
  oubli. Ne pas « corriger » Essential seul sans qu'il rouvre le sujet.
- **La grille vit dans `web/lib/offres.ts` et sa copie en centimes dans
  `subscribe-online`** ; les CGV (annexe 2) et
  `docs/entreprise/hypotheses-tarifaires.md` ont suivi, et un test compare les
  trois. Les pages publiques qui écrivent « à partir de … » ont suivi aussi.

Ce qui suit décrit le parcours lui-même, écrit le 30 août 2026 avec l'ancienne
grille — les montants qui y sont cités sont ceux de ce jour-là.
