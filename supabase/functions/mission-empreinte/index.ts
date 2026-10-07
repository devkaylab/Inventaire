// Edge function : l'empreinte de la carte, avant l'inventaire (7 octobre 2026).
//
// Julien : « je suis facturé au bout de 7 jours automatiquement sur mon mode de
// paiement déjà renseigné avant l'inventaire. Paiement que Quantinvo a vérifié
// comme valide. »
//
// Cette fonction est le « avant ». Elle ne débite rien : elle ouvre un Checkout
// Stripe en `mode: setup`, qui fait vérifier la carte par la banque et nous
// rend un moyen de paiement réutilisable. C'est l'enregistrement de ce moyen de
// paiement — et lui seul — qui ouvre la fenêtre d'accès de la location.
//
// Deux gestes :
//   · `ouvrir`    : rendre l'adresse de la page de Stripe ;
//   · `confirmer` : au retour, relire la session et enregistrer la carte.
//
// ⚠️ DÉPLOYÉE **AVEC** VÉRIFICATION DE JETON. Celui qui donne sa carte a un
// compte : il vient de réserver. Et, règle du 22 août 2026, cette fonction
// N'AJOUTE AUCUN DROIT — la RPC qui décide (`mon_empreinte_a_prendre`) est
// appelée AVEC LE JETON DE L'APPELANT, donc c'est la base qui dit si cette
// mission est la sienne. La clé de service ne sert qu'à écrire ce que le
// navigateur ne doit pas voir : les identifiants Stripe.
//
// ⚠️ **AUCUN MONTANT NE VIENT DU NAVIGATEUR, ET AUCUN PRICE N'EST CRÉÉ.** Le
// prix est lu en base, où il a été figé à la réservation par `prix_mission`.
// Le corps de la requête ne porte qu'un identifiant de mission.
//
// ⚠️ **PAS DE TVA** tant que Devkaylab est en franchise en base (article 293 B
// du CGI) : `TVA_APPLICABLE = false`, comme dans `offres.ts`, `subscribe-online`
// et `libre-service`. Un test compare les copies.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { creerEmpreinteCheckout, lireEmpreinteCheckout } from '../_shared/stripe.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors },
  })

/**
 * ⚠️ JUMEAU DE `venteOuverte()` DANS `web/lib/legal.ts`, comme dans
 * `inscription` et `subscribe-online` — la vente en ligne est fermée tant que
 * la société n'est pas immatriculée (Julien, 5 septembre 2026). Prendre
 * l'empreinte d'une carte EST une vente : elle engage le client à payer sept
 * jours plus tard. Elle se rouvre dans le même commit que les mentions.
 */
const VENTE_OUVERTE = false

/** ⚠️ JUMEAU DE `TVA_APPLICABLE` — franchise en base (4 septembre 2026). */
const TVA_APPLICABLE = false

const boutiqueFermee = () =>
  json({
    success: false,
    code: 'vente_fermee',
    error:
      'La location en ligne n’est pas encore ouverte. Écrivez-nous et nous ouvrons vos accès.',
  }, 503)

const indisponible = () =>
  json({
    success: false,
    code: 'indisponible',
    error:
      'Le paiement en ligne n’est pas disponible pour l’instant. Écrivez-nous, nous prenons le relais.',
  }, 503)

/** Ce que chaque refus de la base veut dire, en français. */
const REFUS: Record<string, string> = {
  non_connecte: 'Votre session a expiré. Reconnectez-vous.',
  introuvable: 'Cette réservation n’existe pas.',
  interdit: 'Cette réservation n’est pas la vôtre.',
  etat: 'Cette réservation n’attend plus de carte.',
  montant: 'Cette réservation n’a pas de montant.',
}

const euros = (cents: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(cents / 100)

const leJour = (d: Date) =>
  new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }).format(d)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ success: false, error: 'Méthode non autorisée' }, 405)

  // ⚠️ LA PORTE SE FERME AVANT TOUTE LECTURE ET TOUTE ÉCRITURE. Envoyer
  // quelqu'un sur une page de paiement qui refuserait sa carte serait pire que
  // de ne rien ouvrir du tout.
  if (!VENTE_OUVERTE) return boutiqueFermee()

  const jeton = req.headers.get('Authorization') ?? ''
  if (!jeton) return json({ success: false, error: 'Session expirée.' }, 401)

  let corps: Record<string, unknown>
  try {
    corps = await req.json()
  } catch {
    return json({ success: false, error: 'Requête illisible.' }, 400)
  }

  const action = String(corps.action ?? '').trim()
  const missionId = String(corps.missionId ?? '').trim()
  const tentative = Number.isInteger(corps.tentative) ? Number(corps.tentative) : 0

  if (action !== 'ouvrir' && action !== 'confirmer') {
    return json({ success: false, error: 'Geste inconnu.' }, 400)
  }
  if (!missionId) return json({ success: false, error: 'Réservation absente.' }, 400)

  const cle = Deno.env.get('STRIPE_SECRET_KEY')
  if (!cle) return indisponible()
  // ⚠️ LE MÊME GARDE-FOU QUE `subscribe-online` : hors franchise, vendre en
  // live sans taux de TVA ferait sortir la taxe de la poche de l'éditeur.
  if (TVA_APPLICABLE && cle.startsWith('sk_live') && !Deno.env.get('STRIPE_TAX_RATE')) {
    return indisponible()
  }

  const url = Deno.env.get('SUPABASE_URL')!
  // Le client de l'APPELANT : c'est lui qui porte la garde « cette mission est
  // la tienne ». Rien ne se décide ici.
  const appelant = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: jeton } },
  })
  // Le client de service : seulement pour écrire les identifiants Stripe, que
  // le navigateur ne doit jamais voir.
  const service = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  const { data: brut, error: eLecture } = await appelant.rpc('mon_empreinte_a_prendre', {
    p_mission: missionId,
  })
  if (eLecture) return json({ success: false, error: eLecture.message }, 400)
  const m = (brut ?? {}) as Record<string, unknown>

  // ⚠️ `deja_verifie` N'EST PAS UNE ERREUR SUR LE CHEMIN DU RETOUR. Le client
  // qui recharge la page de succès repasse ici : lui répondre « refusé » le
  // ferait recommencer un paiement déjà fait.
  if (m.code === 'deja_verifie') {
    return json({ success: true, deja: true, etat: m.etat ?? null })
  }
  if (!m.success) {
    const code = String(m.code ?? '')
    return json({
      success: false,
      code,
      error: REFUS[code] ?? 'Cette réservation ne peut pas recevoir de carte.',
    }, 400)
  }

  const prixCents = Number(m.prix_cents ?? 0)
  const reference = String(m.reference ?? '')
  const email = String(m.email ?? '')

  // ─── CONFIRMER ────────────────────────────────────────────────────────────
  //
  // Le client revient de Stripe. On ne croit pas le retour sur parole — il
  // suffirait d'ouvrir l'adresse de succès à la main : c'est Stripe qu'on
  // relit, et c'est lui qui dit si la carte a été validée.
  if (action === 'confirmer') {
    const sessionId = String(m.session_id ?? '')
    if (!sessionId) {
      return json({ success: false, code: 'aucune_session',
        error: 'Aucune carte n’a été demandée pour cette réservation.' }, 400)
    }

    let prise
    try {
      prise = await lireEmpreinteCheckout(cle, sessionId)
    } catch (e) {
      console.error('empreinte: lecture Stripe', e)
      return indisponible()
    }
    if (!prise) return indisponible()

    if (!prise.paymentMethod || !prise.customer) {
      // La session est ouverte, expirée, ou le SetupIntent attend encore une
      // authentification. Rien n'est enregistré, rien ne s'ouvre.
      return json({ success: true, enregistre: false, statut: prise.statut })
    }

    const { data: pose, error: ePose } = await service.rpc('enregistrer_l_empreinte', {
      p_mission: missionId,
      p_customer: prise.customer,
      p_setup_intent: prise.setupIntent,
      p_payment_method: prise.paymentMethod,
    })
    if (ePose) {
      console.error('empreinte: enregistrement', ePose)
      return json({ success: false, error: 'Votre carte a été validée, mais nous n’avons pas pu ouvrir vos accès. Écrivez-nous.' }, 500)
    }
    const r = (pose ?? {}) as Record<string, unknown>
    if (!r.success) {
      return json({ success: false, code: String(r.code ?? ''),
        error: 'Votre carte a été validée, mais cette réservation n’attendait plus de carte. Écrivez-nous.' }, 409)
    }

    return json({
      success: true,
      enregistre: true,
      etat: r.etat ?? null,
      acces_ouverts_le: r.acces_ouverts_le ?? null,
      acces_expirent_le: r.acces_expirent_le ?? null,
    })
  }

  // ─── OUVRIR ───────────────────────────────────────────────────────────────
  //
  // ⚠️ SI UNE SESSION EST ENCORE OUVERTE, ON LA REPREND. Fermer l'onglet est le
  // geste le plus banal du monde, et une seconde session laisserait deux
  // empreintes sur la même carte (constat de Julien sur le libre-service, une
  // heure après la mise en ligne).
  const sessionConnue = String(m.session_id ?? '')
  if (sessionConnue && tentative === 0) {
    try {
      const prise = await lireEmpreinteCheckout(cle, sessionConnue)
      if (prise?.url) return json({ success: true, url: prise.url, reprise: true })
    } catch (e) {
      console.error('empreinte: reprise impossible', e)
    }
  }

  const jours = Number(m.fenetre_jours ?? 7)
  const debut = new Date(String(m.debut_prevu))
  const fin = new Date(debut.getTime() + jours * 24 * 3600 * 1000)
  const appareils = Number(m.appareils ?? 0)

  // ⚠️ CE QUE LE CLIENT LIT AVANT DE DONNER SA CARTE. En mode `setup`, Checkout
  // n'affiche aucune ligne de prix : cette phrase est le SEUL endroit où le
  // montant et la date se voient. Elle dit les trois choses qui comptent — rien
  // aujourd'hui, combien, et quand.
  const annonce = `Quantinvo — location de ${jours} jours`
    + (appareils > 0 ? `, ${appareils} appareil${appareils > 1 ? 's' : ''}` : '')
    + ` (${reference}). Rien n’est débité aujourd’hui : ${euros(prixCents)}`
    + ` seront prélevés le ${leJour(fin)}, à la fin de votre semaine.`

  const site = Deno.env.get('SITE_URL') ?? 'https://www.quantinvo.com'

  let session
  try {
    session = await creerEmpreinteCheckout(cle, {
      missionId,
      reference,
      customerEmail: email,
      customer: (m.customer_id as string | null) ?? null,
      annonce,
      successUrl: `${site}/reserver?carte=ok&mission=${encodeURIComponent(missionId)}`,
      cancelUrl: `${site}/reserver?carte=abandon&mission=${encodeURIComponent(missionId)}`,
      tentative,
    })
  } catch (e) {
    console.error('empreinte: ouverture Stripe', e)
    return indisponible()
  }

  // ⚠️ RETENUE AVANT QUE LE CLIENT PARTE. C'est ce qui permet de rattraper un
  // navigateur fermé : `empreintes_en_attente` relit cette session à l'heure
  // suivante. Sans elle, une carte validée resterait invisible pour nous.
  const { error: eRetenir } = await service.rpc('retenir_la_session_d_empreinte', {
    p_mission: missionId,
    p_session: session.id,
    p_customer: session.customer,
  })
  if (eRetenir) console.error('empreinte: session non retenue', eRetenir)

  return json({ success: true, url: session.url })
})
