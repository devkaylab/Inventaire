import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { OFFRES, euros } from '../lib/offres'

const racine = join(__dirname, '../..')
const lire = (p: string) => readFileSync(join(racine, p), 'utf8')

/**
 * Le code sans ses commentaires.
 *
 * ⚠️ Les commentaires de ces fichiers CITENT les noms qu'ils décrivent — c'est
 * même leur intérêt. Une garde qui porte sur l'ordre des appels doit donc lire
 * le code seul, sinon elle mesure la position d'une phrase. Même piège que
 * `sansCommentaires()` de formulaires-publics.test.ts.
 */
const sansCommentaires = (t: string) =>
  t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

const edge = lire('supabase/functions/subscribe-online/index.ts')
const edgeNu = sansCommentaires(edge)
const webhook = lire('supabase/functions/stripe-webhook/index.ts')
const stripe = lire('supabase/functions/_shared/stripe.ts')
const page = lire('web/app/souscrire/page.tsx')

describe('la grille de la fonction edge ne diverge pas du site', () => {
  it('porte les mêmes montants, en centimes', () => {
    // Doublon volontaire : le site et les fonctions edge ne compilent pas
    // ensemble (npm d'un côté, esm.sh de l'autre) — même motif que
    // web/lib/devis.ts et _shared/devis.ts. Ce test est ce qui les tient
    // d'accord.
    for (const o of OFFRES) {
      expect(edge, `${o.nom} mensuel en centimes`).toContain(`monthly: ${o.mois * 100},`)
      expect(edge, `${o.nom} annuel en centimes`).toContain(`yearly: ${o.an * 100},`)
      expect(edge, `${o.nom} nommée`).toContain(`nom: '${o.nom}'`)
    }
  })

  it('n’oublie aucune offre', () => {
    for (const o of OFFRES) expect(edge).toContain(`${o.cle}: {`)
  })
})

describe('la souscription ne crée rien qu’on ne puisse payer', () => {
  it('vérifie le Price AVANT d’écrire la demande', () => {
    // Une demande enregistrée sans page de paiement derrière laisserait une
    // ligne morte et un client persuadé d'avoir souscrit.
    const posPrice = edgeNu.indexOf('Deno.env.get(clePrice(')
    const posDepot = edgeNu.indexOf('deposer_souscription')
    expect(posPrice).toBeGreaterThan(-1)
    expect(posPrice, 'le Price doit être lu avant le dépôt').toBeLessThan(posDepot)
  })

  it('ne crée jamais un prix à la volée', () => {
    // ⚠️ Un prix créé par du code est un prix que personne n'a relu, et il
    // serait facturé à un vrai client. Les six Prices vivent dans le tableau
    // de bord Stripe et voyagent par secret.
    expect(edge, 'le Price vient d’un secret').toContain('STRIPE_PRICE_')
    const abonnement = stripe.slice(stripe.indexOf('creerAbonnementCheckout'))
    expect(abonnement, 'pas de price_data en mode abonnement')
      .not.toContain('price_data')
  })

  it('répond « indisponible » plutôt que d’envoyer sur un paiement vide', () => {
    expect(edge).toContain("code: 'indisponible'")
    expect(edge).toContain('503')
  })

  it('n’a pas de repli sur une RPC directe, contrairement à /inscription', () => {
    // Sans la fonction edge il n'y a pas de session Stripe : déposer la
    // demande quand même laisserait croire à une souscription faite.
    expect(page).not.toContain("supabase.rpc('deposer_souscription")
  })
})

describe('on refuse avant d’encaisser', () => {
  // Le premier test réel (30 août 2026) a créé l'entreprise, encaissé, puis
  // échoué à inviter l'administrateur : l'adresse appartenait déjà à une autre
  // entreprise. Le garde-fou VR-003 avait bien joué — APRÈS le paiement.
  const migration = lire('supabase/migrations/20260830180002_souscription_refuse_avant_encaissement.sql')

  it('vérifie l’adresse avant d’écrire la demande', () => {
    const posControle = migration.indexOf('LE CONTROLE QUI EVITE')
    const posInsert = migration.indexOf('insert into public.company_requests')
    expect(posControle).toBeGreaterThan(-1)
    expect(posControle, 'le contrôle doit précéder l’écriture').toBeLessThan(posInsert)
  })

  it('couvre les trois façons d’être déjà connu', () => {
    for (const code of ['compte_existant', 'invitation_en_cours', 'deja_souscrit']) {
      expect(migration, `le cas ${code} doit être traité`).toContain(code)
    }
  })

  it('ne nomme jamais l’autre entreprise', () => {
    // Le souscripteur apprendrait quelque chose sur un client qui n'est pas le
    // sien — même règle que `other_company` depuis le 22 août.
    const bloc = migration.slice(migration.indexOf('compte_existant'), migration.indexOf('invitation_en_cours'))
    expect(bloc).not.toMatch(/company_name|c\.name|entreprise_nom/)
  })

  it('laisse la limitation de débit devant la recherche par adresse', () => {
    // Un script ne doit pas pouvoir interroger la base autant qu'il veut avant
    // d'être freiné : c'est l'ordre qui fait le contrôle (leçon du 28 août).
    expect(migration.indexOf('rate_limit_ok')).toBeLessThan(migration.indexOf('LE CONTROLE QUI EVITE'))
  })

  it('distingue un refus d’une panne, à l’écran', () => {
    expect(page).toContain('saitQuoiFaire')
    expect(lire('web/app/globals.css')).toContain('.souscrire-erreur.douce')
  })
})

describe('le paiement se fait chez Stripe, jamais ici', () => {
  it('ne collecte aucune donnée bancaire sur le site', () => {
    for (const motif of ['cc-number', 'card-number', 'cardNumber', 'cvc', 'cvv']) {
      expect(page, `la page ne doit pas porter de champ ${motif}`).not.toContain(motif)
    }
  })

  it('paie par carte, pas par prélèvement', () => {
    // Le SEPA convient à une facture annuelle d'enseigne ; son délai de
    // règlement ferait attendre l'ouverture des accès de plusieurs jours,
    // après que la personne a cliqué « Souscrire ».
    const abonnement = stripe.slice(stripe.indexOf('creerAbonnementCheckout'))
    const bloc = abonnement.slice(0, abonnement.indexOf('lireSessionCheckout'))
    expect(bloc).toContain("payment_method_types: ['card']")
    expect(bloc).not.toContain('sepa_debit')
  })
})

describe('le webhook suit le cycle de vie', () => {
  it('traduit les trois événements d’abonnement', () => {
    for (const e of ['invoice.payment_failed', 'invoice.paid', 'customer.subscription.deleted']) {
      expect(webhook, `${e} doit être traité`).toContain(e)
    }
    expect(webhook).toContain('sync_subscription_status')
  })

  it('transmet l’abonnement à la création', () => {
    // En mode abonnement il n'y a pas de payment_intent : c'est l'abonnement
    // qui identifie la licence, et c'est par lui que le cycle de vie la
    // retrouvera.
    expect(webhook).toContain('p_subscription_id')
  })

  it('ne coupe jamais l’accès sur un impayé', () => {
    // Même règle que le plafond souple : couper un magasin sur un incident de
    // carte, c'est bloquer un inventaire un soir de comptage.
    for (const mot of ['suspend', 'revoke', 'delete from', 'disable']) {
      expect(webhook.toLowerCase(), `le webhook ne doit rien ${mot}`).not.toContain(mot)
    }
  })

  it('garde la signature comme seule porte', () => {
    const nu = sansCommentaires(webhook)
    const posSignature = nu.indexOf('verifierWebhook(secret')
    const posLecture = nu.indexOf('event.type')
    expect(posSignature).toBeLessThan(posLecture)
  })
})

describe('la page de souscription', () => {
  it('reste hors de la coquille', () => {
    expect(page).not.toContain('<AppShell')
    expect(page).toContain('<SiteHeader />')
  })

  it('annonce le bon prix sur son bouton', () => {
    expect(page).toContain('euros(annuel ? offre.an : offre.mois)')
  })

  it('dit les deux engagements', () => {
    expect(page).toContain('L’année est due jusqu’à son terme')
    expect(page).toContain('Sans engagement')
  })

  it('est atteinte depuis la page tarifs, avec l’offre choisie', () => {
    const grille = lire('web/components/TarifsGrille.tsx')
    expect(grille).toContain('/souscrire?offre=')
    expect(grille).toContain("rythme=annuel")
  })

  it('affiche des montants et non des centimes', () => {
    expect(euros(OFFRES[1].mois)).toBe('225 €')
  })
})
