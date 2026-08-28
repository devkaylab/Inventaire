// Le paiement passe par Stripe, et la création suit le paiement (22 août 2026).
//
// Ce que ces tests empêchent de défaire :
//   · la signature du webhook est vérifiée sur le corps brut, avec un vrai
//     HMAC — c'est la seule porte d'une fonction déployée sans JWT ;
//   · la création ne se déclenche que depuis le webhook, en service_role,
//     jamais depuis le client ni depuis l'acceptation ;
//   · un webhook rejoué répond 200 sans rien refaire (Stripe rejoue tant
//     qu'il n'a pas son 200) ;
//   · la session Checkout est idempotente par demande : un devis accepté deux
//     fois ne se paie pas deux fois.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { createHmac } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { formulaire, verifierWebhook } from '../../supabase/functions/_shared/stripe'
import { derniereDefinition, fichierDe } from './migrations'

const lire = (p: string) => readFileSync(path.resolve(__dirname, p), 'utf8')
const webhook = lire('../../supabase/functions/stripe-webhook/index.ts')
const accept = lire('../../supabase/functions/accept-quote/index.ts')
const stripe = lire('../../supabase/functions/_shared/stripe.ts')
const pageDevis = lire('../app/devis/[token]/page.tsx')

// ⚠️ La DERNIÈRE migration qui définit la fonction, pas un fichier nommé en dur.
// Ce test lisait `20260822250001_stripe_paiement.sql` : le 28 août 2026,
// `fulfil_paid_request` et `invite_company_admin_after_payment` ont été
// corrigées ailleurs, et le test a continué de passer en validant une
// définition qui ne tournait plus. Même défaut que celui qui a fait perdre sa
// limitation de débit à `submit_company_request` le 21 août.
const corps = (fn: string) => derniereDefinition(fn).corps
/** Le fichier entier — les GRANT sont hors du corps de la fonction. */
const fichier = (sig: string) => fichierDe(sig.split('(')[0])

/** Signe comme Stripe : `t=<ts>,v1=hmac(secret, "<ts>.<corps>")`. */
function signer(secret: string, corps: string, ts = Math.floor(Date.now() / 1000)) {
  const v1 = createHmac('sha256', secret).update(`${ts}.${corps}`).digest('hex')
  return `t=${ts},v1=${v1}`
}

describe('la signature du webhook', () => {
  const secret = 'whsec_test_secret'
  const corpsBrut = JSON.stringify({ type: 'checkout.session.completed', data: { object: { id: 'cs_1' } } })

  it('accepte une signature valide et rend l’événement', async () => {
    const ev = await verifierWebhook(secret, corpsBrut, signer(secret, corpsBrut))
    expect(ev.type).toBe('checkout.session.completed')
  })

  it('refuse un corps modifié après signature', async () => {
    const sig = signer(secret, corpsBrut)
    const trafique = corpsBrut.replace('cs_1', 'cs_2')
    await expect(verifierWebhook(secret, trafique, sig)).rejects.toThrow('signature invalide')
  })

  it('refuse un mauvais secret, une signature absente, un horodatage trop vieux', async () => {
    await expect(verifierWebhook('autre', corpsBrut, signer(secret, corpsBrut))).rejects.toThrow()
    await expect(verifierWebhook(secret, corpsBrut, null)).rejects.toThrow('absente')
    const vieux = Math.floor(Date.now() / 1000) - 3600
    await expect(verifierWebhook(secret, corpsBrut, signer(secret, corpsBrut, vieux))).rejects.toThrow('ancienne')
  })

  it('est vérifiée avant toute lecture, dans la fonction déployée', () => {
    // Le webhook n'a pas de JWT : sans cette vérification, n'importe qui
    // créerait une entreprise en postant un faux événement.
    const avant = webhook.indexOf('verifierWebhook(')
    const lecture = webhook.indexOf("event.type")
    expect(avant).toBeGreaterThan(0)
    expect(lecture).toBeGreaterThan(avant)
    expect(webhook).toContain("Deno.env.get('STRIPE_WEBHOOK_SECRET')")
  })
})

describe('la session Checkout', () => {
  it('encode les champs imbriqués comme Stripe les attend', () => {
    const q = formulaire({
      mode: 'payment',
      line_items: [{ quantity: 1, price_data: { currency: 'eur', unit_amount: 660000 } }],
      metadata: { request_id: 'abc' },
    })
    expect(q).toContain('mode=payment')
    expect(q).toContain('line_items%5B0%5D%5Bquantity%5D=1')
    expect(q).toContain('line_items%5B0%5D%5Bprice_data%5D%5Bunit_amount%5D=660000')
    expect(q).toContain('metadata%5Brequest_id%5D=abc')
  })

  it('est idempotente par demande, et fait produire la facture par Stripe', () => {
    // Un devis accepté deux fois ne se paie pas deux fois ; et c'est Stripe
    // qui facture — il n'y a pas de RIB.
    expect(stripe).toContain("'Idempotency-Key': `checkout-${p.kind}-${p.requestId}-${p.tentative ?? 0}`")
    // Et une session encore ouverte se relit plutôt que de se recréer : Stripe
    // refuse une clé d'idempotence rejouée avec d'autres paramètres (vu en
    // test : `expires_at` changeait à chaque seconde).
    expect(stripe).not.toContain('expires_at:')
    expect(accept).toContain('lireSessionCheckout(')
    expect(stripe).toContain('invoice_creation')
    expect(stripe).toContain("payment_method_types: ['card', 'sepa_debit']")
  })

  it('s’ouvre à l’acceptation, et se rattache à la demande', () => {
    expect(accept).toContain('creerSessionCheckout(')
    expect(accept).toContain("rpc('attach_checkout_session'")
    expect(accept).toContain('paymentUrl')
    // La page suit l'adresse rendue.
    expect(pageDevis).toContain('window.location.assign(data.paymentUrl)')
  })
})

describe('payé, donc créé', () => {
  it('seul le serveur peut déclencher la création', () => {
    // ⚠️ Cinq arguments depuis `20260828250001` : `p_event_id` s'ajoute, et
    // l'ancienne signature à quatre est SUPPRIMÉE — deux signatures rendraient
    // un appel à quatre arguments ambigu.
    for (const fn of ['fulfil_paid_request(text, text, text, text, text)', 'attach_checkout_session(text, uuid, text, text)',
      'invite_company_admin_after_payment(uuid, text, text, text)', 'log_system_action(text, text, text, text, text, jsonb)']) {
      const f = fichier(fn)
      expect(f, fn).toContain(`revoke all on function public.${fn} from public, anon, authenticated`)
      expect(f, fn).toContain(`grant execute on function public.${fn} to service_role`)
    }
    // Et l'acceptation, elle, ne crée toujours rien.
    expect(corps('accept_quote_by_token')).not.toMatch(/insert into public\.(companies|stores)\b/)
  })

  it('un webhook rejoué répond déjà-fait, une session inconnue échoue', () => {
    const c = corps('fulfil_paid_request')
    expect(c).toContain("v_req.status in ('paid', 'created')")
    expect(c).toContain("'already', true")
    expect(c).toContain("'Session inconnue'")
    // Côté fonction : déjà-fait → 200 (Stripe s'arrête), inconnue → 500 (Stripe réessaie).
    expect(webhook).toContain('if (result.already) return json({ received: true, already: true,')
    expect(webhook).toContain("if (!result?.success) return json({ error: result?.error ?? 'refus' }, 500)")
  })

  it('deux livraisons du même événement ne créent pas deux entreprises', () => {
    // VR-001, 28 août 2026. Le contrôle de statut était une LECTURE, et une
    // lecture ne sérialise rien : deux webhooks concurrents lisaient tous deux
    // « accepted » et créaient chacun une entreprise complète. L'index unique
    // sur stripe_checkout_session_id ne protège pas de ça — il porte sur la
    // table des demandes, le doublon naît dans companies et stores.
    const c = corps('fulfil_paid_request')
    // Le verrou de ligne, sur les DEUX branches (entreprise et magasin).
    // `for update;` — l'instruction, pas les mots : le commentaire au-dessus du
    // premier select les contient aussi.
    expect(c.match(/for update;/g)?.length, 'for update sur les deux select').toBe(2)
    // La ceinture : la transition ne s'applique pas deux fois.
    expect(c.match(/and status = 'accepted'/g)?.length, 'garde sur les deux update').toBe(2)
    // ⚠️ Et le rejeu répond « already », jamais une erreur : Stripe rejoue tant
    // qu'il n'a pas son 200, une erreur relancerait la boucle qu'on ferme.
    expect(c).toContain("'status', 'paid', 'company_id', v_req.company_id")
  })

  it('un événement Stripe ne se traite qu’une fois', () => {
    // 28 août 2026. Défense en profondeur au niveau de l'ÉVÉNEMENT, en plus du
    // `for update` qui tient déjà la course au niveau de la demande.
    const c = corps('fulfil_paid_request')
    expect(c).toContain('insert into public.stripe_events_traites')
    expect(c).toContain('on conflict (event_id) do nothing')
    // ⚠️ Le marquage est DANS la transaction de création, et il vient en
    // premier. Marquer depuis la fonction edge, avant l'appel, rendrait tout
    // échec définitif : le rejeu serait écarté comme « déjà vu ».
    expect(webhook).toContain('p_event_id:')
    expect(webhook).not.toContain("rpc('marquer_evenement_stripe'")
    // La table entre dans la purge, comme tout le reste.
    expect(corps('purge_expired_data')).toContain('delete from public.stripe_events_traites')
  })

  it('une invitation en attente ailleurs ne se reprend pas', () => {
    // VR-003, 28 août 2026. Le delete n'était borné par aucune entreprise :
    // payer en nommant l'adresse d'un tiers effaçait son invitation en attente.
    // C'est la reprise que le déclencheur `team_invitations_figees` interdit —
    // il se réveille sur UPDATE, ce chemin fait DELETE + INSERT.
    const c = corps('invite_company_admin_after_payment')
    expect(c).toContain("'other_company'")
    expect(c).toContain('company_id = p_company')
    // ⚠️ Le delete nu sur la seule adresse ne doit jamais revenir.
    expect(c).not.toMatch(/where lower\(email\) = v_email;/)
  })

  it('crée ce qui a été devisé, pas ce que le client a déclaré', () => {
    // VR-002, 28 août 2026. La boucle suivait `store_count`, saisi par le
    // prospect dans le formulaire public (borné à 500), et non les lignes du
    // devis payé. Le PDF, lui, comptait déjà les lignes — les deux pouvaient
    // diverger dans un seul sens : plus de magasins livrés que facturés.
    const c = corps('fulfil_paid_request')
    expect(c).toContain('for v_i in 1..v_n loop')
    // ⚠️ Le `nullif(…, 0)` est ce qui garde le repli : `jsonb_array_length('[]')`
    // vaut 0, pas null. Sans lui, un devis sans lignes créerait ZÉRO magasin.
    expect(c).toContain("nullif(jsonb_array_length(coalesce(v_req.quote_lines, '[]'::jsonb)), 0)")
    // Le prix de repli se divise par ce qui est réellement créé.
    expect(c).toContain('v_req.quote_amount_cents / v_n')
    // Et le devis lui-même ne peut plus être incohérent.
    expect(corps('admin_quote_company_request')).toContain('v_lignes <> 0 and v_lignes <> v_n')
  })

  it('crée les magasins avec les noms du devis, et invite le contact comme administrateur', () => {
    const c = corps('fulfil_paid_request')
    // En deux temps depuis `20260822270001` (le prix par magasin) : la ligne du
    // devis est capturée, puis son libellé lu. On vérifie l'intention, pas une
    // écriture — c'est ce refactor qui avait rendu l'assertion précédente
    // inopérante sans que rien ne le signale.
    expect(c).toContain('v_ligne := v_req.quote_lines -> (v_i - 1)')
    expect(c).toContain("btrim(v_ligne ->> 'libelle')")
    expect(corps('invite_company_admin_after_payment')).toContain("'company_admin'")
    expect(webhook).toContain("rpc('invite_company_admin_after_payment'")
    expect(webhook).toContain("type: 'invite'")
  })

  it('journalise sous l’auteur Stripe, sans auth.uid()', () => {
    expect(corps('log_system_action')).not.toContain('auth.uid()')
    expect(corps('fulfil_paid_request')).toContain("log_system_action('Stripe'")
  })

  it('ignore ce qui n’est pas un paiement réglé, sans faire relancer Stripe', () => {
    expect(webhook).toContain("if (event.type !== 'checkout.session.completed') return json({ received: true")
    expect(webhook).toContain("session.payment_status !== 'paid'")
  })
})

describe('trous trouvés au test complet du parcours (22 août 2026)', () => {
  const m2 = lire('../../supabase/migrations/20260822270001_prix_paye_sur_le_magasin.sql')
  const corps2 = (fn: string) => m2.split(`function public.${fn}(`)[1]?.split('$$;')[0] ?? ''

  it('le prix payé se reporte sur le magasin créé', () => {
    // Les magasins nés du webhook n'avaient pas de prix : le tableau de bord
    // les estimait au panier moyen alors qu'on connaît le montant exact.
    const c = corps2('fulfil_paid_request')
    expect(c).toContain("(v_ligne ->> 'prixCents')::bigint")
    expect(c).toContain('insert into public.stores (company_id, name, join_code, annual_price_cents)')
    expect(c).toContain('values (v_sto.company_id, v_sto.store_name, v_store_code, v_sto.quote_amount_cents)')
    // Et le rattrapage de l'existant.
    expect(m2).toContain("set annual_price_cents = (l ->> 'prixCents')::bigint")
  })

  it('le client retrouve le lien de paiement depuis ses magasins', () => {
    // Un client qui a fermé Stripe sans régler n'avait plus d'issue depuis
    // son espace : le texte annonçait une facture qui n'existe plus.
    const magasins = lire('../app/magasins/page.tsx')
    expect(magasins).toContain('Régler en ligne')
    expect(magasins).not.toContain('Votre facture arrive')
  })
})

describe('les codes d’accès', () => {
  // VR-004, 28 août 2026. `join_code` est un secret — il ouvre l'entrée dans un
  // magasin, et la colonne est révoquée en SELECT pour anon/authenticated —
  // mais il sortait de `random()`, non cryptographique (CWE-338). Les jetons de
  // devis, eux, utilisaient déjà gen_random_uuid().
  it('sortent d’un générateur cryptographique', () => {
    for (const fn of ['gen_store_code', 'gen_company_code']) {
      const c = corps(fn)
      // ⚠️ Qualifié par son schéma : pgcrypto vit dans `extensions` chez
      // Supabase et ces fonctions figent search_path à 'public'. L'appel nu
      // échoue à l'exécution, pas à la création.
      expect(c, fn).toContain('extensions.gen_random_bytes(6)')
      expect(c, fn).not.toContain('random() * length(v_alphabet)')
    }
  })

  it('ne sont plus fabricables par un client', () => {
    // C'est la moitié la plus utile du correctif : `authenticated` pouvait
    // appeler ces fonctions à volonté, donc observer les sorties du
    // générateur. Sans cet oracle, il n'y a plus de suite à inférer.
    for (const fn of ['gen_store_code', 'gen_company_code']) {
      expect(fichierDe(fn), fn).toContain(
        `revoke all on function public.${fn}() from public, anon, authenticated`)
    }
  })
})
