import type { Metadata } from 'next'
import type { Langue } from '@/lib/traduction'
import { metaVitrine } from '@/lib/metaVitrine'

/**
 * Les titres et descriptions des pages de la vitrine, dans les deux langues,
 * en UN SEUL endroit : la page française et sa jumelle `/en` lisent la même
 * entrée, donc elles ne peuvent pas diverger.
 */
export const META_VITRINE = {
  accueil: (l: Langue): Metadata => metaVitrine(l, '/', {
    title: "Quantinvo — l'outil d'inventaire pour le commerce de détail",
    description: "Comptez vos stocks en magasin avec le téléphone de vos équipes : balises QR imprimées, scan des codes-barres, seconde passe d'audit et rapport d'écarts exportable. Fonctionne sans réseau en réserve.",
  }, {
    title: 'Quantinvo — the stocktaking tool for retail',
    description: 'Count your store stock with your team’s phones: printed QR tags, barcode scanning, a second audit pass and an exportable variance report. Works offline in the stockroom.',
  }),
  tarifs: (l: Langue): Metadata => metaVitrine(l, '/tarifs', {
    title: 'Tarifs',
    description: 'Un prix par magasin, calé sur le nombre de personnes qui comptent en même temps. Essential 89 €/mois, Advanced 310 €, Enterprise 890 € — sans engagement au mois, sans déclaration de stock et sans terminal à acheter.',
  }, {
    title: 'Pricing',
    description: 'One price per store, based on how many people count at the same time. Essential €89/month, Advanced €310, Enterprise €890 — no monthly commitment, no stock declaration, no hardware to buy.',
  }),
  inventaire: (l: Langue): Metadata => metaVitrine(l, '/inventaire', {
    title: 'L’inventaire : pourquoi compter son stock, et comment bien le faire',
    description: 'Inventaire annuel, tournant, ciblé : ce qu’est un inventaire, ce que révèle l’écart entre stock théorique et stock réel — démarque inconnue, vol, casse, erreurs de gestion — et comment fiabiliser son stock toute l’année.',
  }, {
    title: 'Stocktaking: why count your stock, and how to do it well',
    description: 'Annual, cycle and targeted counts: what a stocktake is, what the gap between book stock and actual stock reveals — shrinkage, theft, breakage, admin errors — and how to keep stock reliable all year.',
  }),
  pourquoi: (l: Langue): Metadata => metaVitrine(l, '/pourquoi-nous-choisir', {
    title: 'Pourquoi choisir Quantinvo',
    description: 'Vos équipes comptent avec leur téléphone, vous pilotez en direct, le stock validé est fiable. Import sans reformater, audit des écarts, licence par magasin à partir de 89 € par mois : les raisons de choisir Quantinvo.',
  }, {
    title: 'Why choose Quantinvo',
    description: 'Your teams count with their phones, you follow live, and the validated stock is reliable. Import without reformatting, variance audit, a per-store license from €89 a month: the reasons to choose Quantinvo.',
  }),
  inscription: (l: Langue): Metadata => metaVitrine(l, '/inscription', {
    title: 'Inscrire mon entreprise',
    description: 'Inscrivez votre entreprise en ligne : quelques questions, votre offre magasin par magasin, et vos accès s’ouvrent au règlement.',
  }, {
    title: 'Sign up my company',
    description: 'Sign your company up online: a few questions, your plan store by store, and your access opens on payment.',
  }),
  souscrire: (l: Langue): Metadata => metaVitrine(l, '/souscrire', {
    title: 'Souscrire',
    description: 'Souscrivez à Quantinvo en ligne : votre offre, quatre informations, le paiement par carte. Votre espace est créé dès l’encaissement.',
  }, {
    title: 'Subscribe',
    description: 'Subscribe to Quantinvo online: your plan, four details, card payment. Your space is created as soon as the payment goes through.',
  }),
  superviseur: (l: Langue): Metadata => metaVitrine(l, '/superviseur', {
    title: 'Accès superviseur',
    description: 'Un accès superviseur Quantinvo est ouvert par l’administrateur de votre entreprise, ou par Quantinvo pour les entreprises qui n’en ont pas encore.',
  }, {
    title: 'Supervisor access',
    description: 'A Quantinvo supervisor access is opened by your company administrator, or by Quantinvo for companies that do not have one yet.',
  }),
  open: (l: Langue): Metadata => metaVitrine(l, '/open', {
    title: 'Ouvrir l’application',
    description: 'Ouvrez l’application Quantinvo sur votre téléphone, ou accédez à votre espace sur le web.',
  }, {
    title: 'Open the app',
    description: 'Open the Quantinvo app on your phone, or access your space on the web.',
  }),
  suppression: (l: Langue): Metadata => metaVitrine(l, '/suppression-compte', {
    title: 'Supprimer son compte',
    description: 'Comment demander la suppression de votre compte Quantinvo et des données associées, depuis l’application ou par courrier électronique.',
  }, {
    title: 'Delete your account',
    description: 'How to request the deletion of your Quantinvo account and the data attached to it, from the app or by email.',
  }),
}
