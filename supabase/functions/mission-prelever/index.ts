// Edge function : le prélèvement du septième jour (7 octobre 2026).
//
// Julien : « je suis facturé au bout de 7 jours automatiquement sur mon mode de
// paiement déjà renseigné avant l'inventaire. »
//
// Elle fait deux travaux, et ils se tiennent par le même fil — une carte
// vérifiée d'un côté, un montant dû de l'autre :
//
//   1. **RATTRAPER** les cartes validées chez Stripe que nous n'avons pas
//      enregistrées, parce que le client a fermé son onglet avant de revenir.
//      Sans ça, il a donné sa carte et sa fenêtre ne s'ouvre jamais.
//   2. **PRÉLEVER** ce qui est dû : une facture par mission dont la semaine est
//      passée, réglée hors présence du client sur la carte enregistrée.
//
// ⚠️ ELLE N'EST PAS APPELÉE PAR UN NAVIGATEUR mais par la tâche planifiée de
// la base (`declencher_le_prelevement`, toutes les heures à la minute 15). D'où
// `verify_jwt: false` — une tâche `pg_cron` n'a pas de session — et d'où la clé
// partagée, vérifiée **en temps constant**, sur le modèle d'`alerte-anomalies`
// et du webhook Stripe. Sans elle, n'importe qui pourrait déclencher les
// prélèvements de tout le monde.
//
// ⚠️ **QUI DÉCIDE DE CE QUI EST DÛ : LA BASE, PAS CETTE FONCTION.**
// `missions_a_prelever` porte tous les critères — semaine passée, carte
// vérifiée, pas déjà facturée, moins de trois refus, six heures de repos — et
// un index unique sur `stripe_invoice_id` interdit la double facture même si ce
// fichier est réécrit de travers. Ici on n'ajoute aucune règle : on appelle
// Stripe et on consigne la réponse.
//
// ⚠️ **ET ON MARQUE LA TENTATIVE AVANT L'APPEL, PAS APRÈS.** Un appel dont la
// réponse se perd — temps mort, fonction tuée à mi-course — aurait peut-être
// débité le client. Marquer d'abord met la mission au repos six heures ; le
// tick suivant retrouvera la facture par sa clé d'idempotence au lieu d'en
// créer une seconde.
//
// ⚠️ **PAS DE TVA** tant que Devkaylab est en franchise en base (article 293 B
// du CGI). La facture porte la MENTION, pas le taux. Jumeau de
// `TVA_APPLICABLE` dans `offres.ts` ; un test compare les copies.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { facturerLaLocation, lireEmpreinteCheckout } from '../_shared/stripe.ts'
// ⚠️ On RÉUTILISE la mention de TVA du module de devis plutôt que de la
// recopier : elle est légale, et deux copies d'une mention légale finissent par
// dire deux choses.
import { MENTION_TVA } from '../_shared/devis.ts'

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

/** Comparaison à temps constant : une comparaison naïve fuit la clé, caractère par caractère. */
function egalConstant(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

/** ⚠️ JUMEAU DE `TVA_APPLICABLE` — franchise en base (4 septembre 2026). */
const TVA_APPLICABLE = false

type APrelever = {
  mission_id: string
  reference: string
  customer_id: string
  payment_method_id: string
  prix_cents: number
  client_nom: string
  magasin_nom: string
  articles_retenus: number
  appareils: number | null
  acces_ouverts_le: string
  acces_expirent_le: string
  echecs: number
}

type EnAttente = { mission_id: string; reference: string; session_id: string }

const nombre = (n: number) => new Intl.NumberFormat('fr-FR').format(n)

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ success: false, error: 'Méthode non autorisée' }, 405)

  const attendue = Deno.env.get('PRELEVEMENT_CLE')
  if (!attendue) return json({ success: false, error: 'PRELEVEMENT_CLE absente' }, 500)
  const fournie = req.headers.get('x-prelevement-cle') ?? ''
  if (!egalConstant(fournie, attendue)) return json({ success: false, error: 'Accès refusé' }, 403)

  const cle = Deno.env.get('STRIPE_SECRET_KEY')
  if (!cle) return json({ success: false, error: 'STRIPE_SECRET_KEY absente' }, 500)
  const taxRateId = TVA_APPLICABLE ? (Deno.env.get('STRIPE_TAX_RATE') ?? null) : null
  // ⚠️ LE MÊME GARDE-FOU QUE `subscribe-online` : hors franchise, facturer en
  // live sans taux ferait sortir la TVA due de la poche de l'éditeur. On
  // s'arrête AVANT de débiter quoi que ce soit.
  if (TVA_APPLICABLE && cle.startsWith('sk_live') && !taxRateId) {
    return json({ success: false, error: 'STRIPE_TAX_RATE absente en live' }, 500)
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // ─── 1. Rattraper les cartes validées qu'on n'a pas enregistrées ─────────
  //
  // D'abord, parce qu'une mission rattrapée ici n'a pas encore de semaine
  // écoulée : elle ne peut pas se retrouver dans la liste suivante. L'ordre
  // n'est donc pas un hasard, c'est juste le sens du temps.
  let rattrapees = 0
  const { data: brutAttente, error: eAttente } = await admin.rpc('empreintes_en_attente')
  if (eAttente) console.error('prélèvement: liste des empreintes', eAttente)
  for (const e of ((brutAttente ?? []) as EnAttente[])) {
    try {
      const prise = await lireEmpreinteCheckout(cle, e.session_id)
      if (!prise?.paymentMethod || !prise.customer) continue
      const { data: pose, error } = await admin.rpc('enregistrer_l_empreinte', {
        p_mission: e.mission_id,
        p_customer: prise.customer,
        p_setup_intent: prise.setupIntent,
        p_payment_method: prise.paymentMethod,
      })
      if (error) { console.error(`prélèvement: ${e.reference} non rattrapée`, error); continue }
      if ((pose as Record<string, unknown>)?.success) rattrapees += 1
    } catch (err) {
      console.error(`prélèvement: ${e.reference} relecture Stripe`, err)
    }
  }

  // ─── 2. Prélever ce qui est dû ───────────────────────────────────────────
  const { data: brut, error } = await admin.rpc('missions_a_prelever')
  if (error) return json({ success: false, error: error.message }, 500)
  const dues = (brut ?? []) as APrelever[]

  let payees = 0
  let refusees = 0
  const details: { reference: string; etat: string; motif?: string }[] = []

  for (const m of dues) {
    // ⚠️ AVANT L'APPEL. Voir l'en-tête : c'est ce qui empêche un double débit
    // quand la réponse de Stripe se perd.
    const { error: eMarque } = await admin.rpc('prelevement_tente', { p_mission: m.mission_id })
    if (eMarque) {
      console.error(`prélèvement: ${m.reference} non marquée, on s'abstient`, eMarque)
      continue
    }

    const debut = new Date(m.acces_ouverts_le)
    const fin = new Date(m.acces_expirent_le)
    const jours = Math.max(1, Math.round((fin.getTime() - debut.getTime()) / 86400000))

    try {
      const facture = await facturerLaLocation(cle, {
        missionId: m.mission_id,
        reference: m.reference,
        customer: m.customer_id,
        paymentMethod: m.payment_method_id,
        montantCents: m.prix_cents,
        description: `Location Quantinvo — ${m.reference}`,
        ligne: `Quantinvo, ${jours} jours sur « ${m.magasin_nom} »`
          + (m.appareils ? `, ${m.appareils} appareil${m.appareils > 1 ? 's' : ''}` : '')
          + ` — jusqu’à ${nombre(m.articles_retenus)} pièces`,
        pied: MENTION_TVA,
        periode: { debut, fin },
        taxRateId,
        // ⚠️ Le compteur de refus entre dans la clé d'idempotence du
        // RÈGLEMENT seulement : sans lui, Stripe rejouerait le refus de la
        // première tentative au lieu d'en tenter une seconde.
        tentative: m.echecs,
      })

      // ⚠️ `paid` ET RIEN D'AUTRE. Une facture `open` n'est pas réglée : la
      // compter comme payée fermerait la mission sur un encaissement qui n'a
      // pas eu lieu.
      if (facture.statut !== 'paid') {
        refusees += 1
        await admin.rpc('echouer_le_prelevement', {
          p_mission: m.mission_id,
          p_motif: `facture ${facture.invoiceId} en état « ${facture.statut} »`,
        })
        details.push({ reference: m.reference, etat: 'refuse', motif: facture.statut })
        continue
      }

      const { error: ePose } = await admin.rpc('enregistrer_le_prelevement', {
        p_mission: m.mission_id,
        p_invoice: facture.invoiceId,
        p_payment_intent: facture.paymentIntent,
        p_facture_url: facture.url,
        p_facture_numero: facture.numero,
      })
      if (ePose) {
        // ⚠️ LE CAS LE PLUS DÉSAGRÉABLE : encaissé chez Stripe, pas consigné
        // chez nous. On le crie dans les journaux et on ne compte pas de
        // refus — l'heure suivante retrouvera la MÊME facture par sa clé
        // d'idempotence et réessaiera de la consigner.
        console.error(`prélèvement: ${m.reference} ENCAISSÉE MAIS NON CONSIGNÉE`
          + ` (facture ${facture.invoiceId})`, ePose)
        details.push({ reference: m.reference, etat: 'encaisse_non_consigne' })
        continue
      }

      payees += 1
      details.push({ reference: m.reference, etat: 'payee' })
    } catch (err) {
      // ⚠️ TOUT REFUS SE RESSEMBLE ICI, ET C'EST VOULU. Carte refusée,
      // authentification requise, plafond atteint, panne réseau : on consigne
      // le message tel quel et on laisse les six heures de repos faire le tri.
      // Distinguer les causes demanderait de deviner, et trois tentatives
      // bornent déjà les dégâts dans les deux cas.
      const motif = err instanceof Error ? err.message : String(err)
      refusees += 1
      const { data: suite } = await admin.rpc('echouer_le_prelevement', {
        p_mission: m.mission_id,
        p_motif: motif,
      })
      const abandonne = (suite as Record<string, unknown>)?.abandonne === true
      console.error(`prélèvement: ${m.reference} refusée${abandonne ? ' — ABANDON' : ''}`, motif)
      details.push({ reference: m.reference, etat: abandonne ? 'litige' : 'refuse', motif })
    }
  }

  return json({ success: true, rattrapees, dues: dues.length, payees, refusees, details })
})
