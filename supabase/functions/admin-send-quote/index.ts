// Edge function : Quantinvo envoie le devis (22 août 2026).
//
// Elle sert **les deux parcours** : l'inscription d'une entreprise et l'ajout
// d'un magasin à une entreprise existante (`target`). Deux fonctions auraient
// voulu dire deux mises en page du même document.
//
// Elle enchaîne ce qui se faisait à la main : la RPC `admin_quote_company_request`
// (appelée **avec le jeton de l'administrateur**, donc gardée par is_admin() et
// sa double authentification), la fabrication du PDF, et l'envoi par Resend avec
// le PDF en pièce jointe et le lien d'acceptation.
//
// Le montant qui part est **celui saisi en console**, jamais recalculé ici : la
// grille propose, l'administrateur dispose, et un devis se négocie.
//
// La console retombe sur la RPC directe si cette fonction est injoignable : le
// devis est alors enregistré sans partir, et l'écran le dit.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { adresseDeContact, emailQuantinvo, envoyerEmail } from '../_shared/email.ts'
import { type LigneDevis, euros, jour, nombre } from '../_shared/devis.ts'
import { devisEnPdf, enBase64 } from '../_shared/devisPdf.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ success: false, error: 'Méthode non autorisée' }, 405)

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json({ success: false, error: 'Non authentifié' }, 401)

  let payload: {
    requestId?: string
    reference?: string
    amountCents?: number
    note?: string
    lines?: LigneDevis[]
    /** 'company' (inscription) ou 'store' (ajout de magasin). */
    target?: 'company' | 'store'
  }
  try {
    payload = await req.json()
  } catch {
    return json({ success: false, error: 'Requête invalide' }, 400)
  }
  const requestId = (payload.requestId ?? '').trim()
  const reference = (payload.reference ?? '').trim()
  const amountCents = typeof payload.amountCents === 'number' ? Math.round(payload.amountCents) : null
  const lines = Array.isArray(payload.lines) ? payload.lines : []
  const target = payload.target === 'store' ? 'store' : 'company'
  if (!requestId) return json({ success: false, error: 'Demande absente.' }, 400)
  if (amountCents === null || amountCents < 0) return json({ success: false, error: 'Montant invalide.' }, 400)

  const url = Deno.env.get('SUPABASE_URL')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!

  const caller = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } })
  const { data: userData, error: userErr } = await caller.auth.getUser()
  if (userErr || !userData?.user) return json({ success: false, error: 'Session expirée.' }, 401)

  const rpc = target === 'store' ? 'admin_quote_store_request' : 'admin_quote_company_request'
  const { data: result, error: rErr } = await caller.rpc(rpc, {
    p_id: requestId,
    p_reference: reference,
    p_amount_cents: amountCents,
    p_note: (payload.note ?? '').trim(),
    p_lines: lines,
  })
  if (rErr) return json({ success: false, error: rErr.message }, 500)
  if (!result?.success) return json({ success: false, error: result?.error ?? 'Devis impossible.' }, 403)

  // Le devis est enregistré : à partir d'ici, un échec ne le défait pas.
  const sansEnvoi = (raison: string) => json({ ...result, emailed: false, error: raison })

  const q = result.quote ?? {}
  const destinataire = (q.contact_email ?? '').trim()
  if (!destinataire) return sansEnvoi('aucune adresse de contact sur la demande')

  if (!Deno.env.get('RESEND_API_KEY')) return sansEnvoi('Resend non configuré')

  const appUrl = Deno.env.get('APP_PUBLIC_URL') ?? 'https://www.quantinvo.com'
  // Celui qui envoie le devis est celui à qui on répond.
  const contact = adresseDeContact(userData.user.email ?? null)
  const lien = `${appUrl}/devis/${result.token}`
  const emisLe = new Date(q.sent_at ?? Date.now())
  const expireLe = new Date(q.expires_at ?? Date.now())
  const prenom = (q.contact_first_name ?? '').trim()
  const nomComplet = `${prenom} ${(q.contact_last_name ?? '').trim()}`.trim()
  const lignes: LigneDevis[] = Array.isArray(q.lines) ? q.lines : []
  const magasins = lignes.length || q.store_count || 0
  const magasin = (q.store_name ?? '').trim()

  let piece: string
  try {
    const octets = await devisEnPdf({
      reference: q.reference || 'DEVIS',
      entreprise: q.company_name ?? '',
      objet: magasin ? `Ajout du magasin ${magasin}` : undefined,
      contact: nomComplet,
      siren: q.siren ?? null,
      lignes,
      totalCents: amountCents,
      emisLe,
      expireLe,
    })
    piece = enBase64(octets)
  } catch (e) {
    return sansEnvoi(`PDF impossible à produire : ${e instanceof Error ? e.message : String(e)}`)
  }

  const { html, text } = emailQuantinvo({
    titre: magasin ? `Votre devis pour ${magasin}` : 'Votre devis Quantinvo',
    apercu: `Devis ${q.reference} pour ${magasin || q.company_name}.`,
    salutation: prenom ? `Bonjour ${prenom},` : 'Bonjour,',
    paragraphes: [
      magasin
        ? `Voici votre devis pour l’ajout du magasin « ${magasin} » à votre licence. Il est joint à ce message, et vous pouvez l’accepter en ligne d’un clic.`
        : `Voici votre devis pour l’équipement de ${magasins > 1 ? `vos ${nombre(magasins)} magasins` : 'votre magasin'}. Il est joint à ce message, et vous pouvez l’accepter en ligne d’un clic.`,
      contact
        ? `Il est valable jusqu’au ${jour(expireLe)}. Une question sur une ligne ou sur un volume déclaré ? Écrivez-nous à ${contact}.`
        : `Il est valable jusqu’au ${jour(expireLe)}.`,
    ],
    details: [
      { intitule: 'Référence', valeur: q.reference || '—' },
      { intitule: 'Entreprise', valeur: q.company_name ?? '' },
      ...(magasin
        ? [{ intitule: 'Magasin', valeur: magasin }]
        : [{ intitule: 'Magasins', valeur: nombre(magasins) }]),
      { intitule: 'Montant annuel HT', valeur: euros(amountCents) },
    ],
    bouton: { libelle: 'Voir et accepter le devis', lien },
    note: magasin
      ? 'L’acceptation vaut bon pour accord. Le magasin est créé, avec son code d’accès, après règlement de la facture.'
      : 'L’acceptation vaut bon pour accord. Vos accès sont ouverts après règlement de la facture.',
    raison: 'Vous recevez ce message parce que vous avez demandé un devis Quantinvo.',
    siteUrl: appUrl,
  })

  try {
    await envoyerEmail({
      to: destinataire,
      subject: magasin
        ? `Votre devis Quantinvo — ${magasin}`
        : `Votre devis Quantinvo — ${q.reference || q.company_name}`,
      html,
      text,
      attachments: [{ filename: `devis-${(q.reference || 'quantinvo').replace(/[^\w-]/g, '')}.pdf`, content: piece }],
      replyTo: contact,
    })
    return json({ ...result, emailed: true, sentTo: destinataire })
  } catch (e) {
    return sansEnvoi(e instanceof Error ? e.message : String(e))
  }
})
