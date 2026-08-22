// Edge function : un administrateur d'entreprise demande l'ajout d'un magasin,
// et reçoit l'accusé de réception (22 août 2026).
//
// Elle n'ajoute aucun droit : la demande passe par la RPC `ca_request_store`,
// appelée **avec le jeton de l'appelant**, donc gardée par is_company_admin()
// comme avant — double authentification conditionnelle comprise. L'edge ne fait
// qu'écrire l'e-mail par-dessus.
//
// Le site retombe sur la RPC directe si cette fonction est injoignable : la
// demande passe alors sans accusé, plutôt que de ne pas passer du tout. Même
// choix que pour `submit-supervisor-request`.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { emailQuantinvo } from '../_shared/email.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

const nb = (v: number) => v.toLocaleString('fr-FR')

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ success: false, error: 'Méthode non autorisée' }, 405)

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json({ success: false, error: 'Non authentifié' }, 401)

  let payload: { name?: string; message?: string; units?: number | null; sqm?: number | null }
  try {
    payload = await req.json()
  } catch {
    return json({ success: false, error: 'Requête invalide' }, 400)
  }
  const name = (payload.name ?? '').trim()
  const message = (payload.message ?? '').trim()
  const units = typeof payload.units === 'number' ? Math.round(payload.units) : null
  const sqm = typeof payload.sqm === 'number' ? Math.round(payload.sqm) : null
  if (!name) return json({ success: false, error: 'Le nom du magasin est requis.' }, 400)

  const url = Deno.env.get('SUPABASE_URL')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!

  const caller = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } })
  const { data: userData, error: userErr } = await caller.auth.getUser()
  if (userErr || !userData?.user) return json({ success: false, error: 'Session expirée.' }, 401)

  const { data: result, error: rErr } = await caller.rpc('ca_request_store', {
    p_name: name,
    p_message: message,
    p_units: units,
    p_sqm: sqm,
  })
  if (rErr) return json({ success: false, error: rErr.message }, 500)
  if (!result?.success) return json({ success: false, error: result?.error ?? 'Demande impossible.' }, 403)

  // La demande est écrite. À partir d'ici, un échec d'e-mail ne doit pas la
  // faire passer pour perdue : on répond « enregistrée, sans accusé ».
  const sansAccuse = (raison: string) =>
    json({ success: true, requested: true, emailed: false, error: raison })

  const email = userData.user.email
  if (!email) return sansAccuse('aucune adresse sur le compte')

  const resendKey = Deno.env.get('RESEND_API_KEY')
  if (!resendKey) return sansAccuse('Resend non configuré')

  const { data: profil } = await caller
    .from('profiles')
    .select('first_name')
    .eq('id', userData.user.id)
    .maybeSingle()
  const prenom = (profil?.first_name ?? '').trim()

  const appUrl = Deno.env.get('APP_PUBLIC_URL') ?? 'https://quantinvo.vercel.app'
  const details: { intitule: string; valeur: string }[] = [{ intitule: 'Magasin', valeur: name }]
  if (units !== null) details.push({ intitule: 'Stock théorique', valeur: `${nb(units)} pièces` })
  if (sqm !== null) details.push({ intitule: 'Surface de vente', valeur: `${nb(sqm)} m²` })

  const { html, text } = emailQuantinvo({
    titre: 'Votre demande de magasin est bien reçue',
    apercu: `Demande reçue pour ${name}.`,
    salutation: prenom ? `Bonjour ${prenom},` : 'Bonjour,',
    paragraphes: [
      'Nous avons bien reçu votre demande d’ajout de magasin. Elle est en cours d’étude : nous revenons vers vous avec un devis adapté à ce magasin.',
      'Vous n’avez rien à faire d’ici là. Vous pouvez suivre ou annuler cette demande depuis vos magasins, tant qu’elle n’a pas été traitée.',
    ],
    details,
    bouton: { libelle: 'Voir mes magasins', lien: `${appUrl}/magasins` },
    raison: 'Vous recevez ce message parce que vous avez demandé l’ajout d’un magasin sur Quantinvo.',
    siteUrl: appUrl,
  })

  const fromAddr = Deno.env.get('INVITE_FROM_EMAIL') ?? 'Quantinvo <onboarding@resend.dev>'
  try {
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: fromAddr,
        to: [email],
        subject: `Demande reçue — ${name}`,
        html,
        text,
      }),
    })
    if (!resp.ok) return sansAccuse(`${resp.status} ${await resp.text()}`)
    return json({ success: true, requested: true, emailed: true })
  } catch (e) {
    return sansAccuse(e instanceof Error ? e.message : String(e))
  }
})
