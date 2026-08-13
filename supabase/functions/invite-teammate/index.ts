// Edge function : ajouter un membre (compteur) à son équipe.
// - Vérifie que l'appelant est superviseur.
// - Pré-inscrit l'e-mail (team_invitations) dans son entreprise.
// - Envoie un e-mail (Resend) invitant la personne à finaliser son compte.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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

  let payload: { email?: string; fullName?: string; firstName?: string; lastName?: string; storeIds?: string[] }
  try {
    payload = await req.json()
  } catch {
    return json({ success: false, error: 'Requête invalide' }, 400)
  }
  const email = payload.email?.trim().toLowerCase()
  const firstName = (payload.firstName ?? '').trim()
  const lastName = (payload.lastName ?? '').trim()
  // `fullName` reste accepté pour les versions de l'app antérieures au passage
  // à prénom / nom séparés.
  const fullName = [firstName, lastName].filter(Boolean).join(' ') || (payload.fullName ?? '').trim()
  const storeIds = Array.isArray(payload.storeIds) ? payload.storeIds.filter((s) => typeof s === 'string') : []
  if (!email || !email.includes('@')) return json({ success: false, error: 'Adresse e-mail invalide.' }, 400)

  const url = Deno.env.get('SUPABASE_URL')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  const caller = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } })
  const { data: userData, error: userErr } = await caller.auth.getUser()
  const inviter = userData?.user
  if (userErr || !inviter) return json({ success: false, error: 'Session expirée.' }, 401)

  // Profil de l'appelant : doit être superviseur et rattaché à une entreprise.
  const { data: prof } = await caller
    .from('profiles')
    .select('role, company_id, full_name')
    .eq('id', inviter.id)
    .maybeSingle()
  if (!prof || prof.role !== 'supervisor' || !prof.company_id) {
    return json({ success: false, error: 'Réservé aux superviseurs.' }, 403)
  }

  const admin = createClient(url, serviceKey)

  // Déjà un compte ?
  const { data: existing } = await admin.rpc('find_user_by_email', { p_email: email })
  const found = Array.isArray(existing) && existing.length > 0 ? existing[0] : null
  if (found) {
    if (found.company_id === prof.company_id) {
      return json({ success: false, error: 'Cette personne fait déjà partie de votre équipe.' })
    }
    return json({ success: false, error: 'Cette adresse est déjà utilisée dans une autre entreprise.' })
  }

  // Les magasins doivent appartenir au superviseur : sans ce filtre, un appel
  // direct à l'API rattacherait un compteur à n'importe quel magasin.
  let allowedStoreIds: string[] = []
  if (storeIds.length > 0) {
    const { data: mine } = await admin
      .from('store_supervisors')
      .select('store_id')
      .eq('user_id', inviter.id)
    const mineSet = new Set((mine ?? []).map((s: { store_id: string }) => s.store_id))
    allowedStoreIds = storeIds.filter((id) => mineSet.has(id))
    if (allowedStoreIds.length === 0) {
      return json({ success: false, error: "Aucun des magasins choisis ne vous est affecté." }, 403)
    }
  }

  // Pré-inscription (idempotent). `store_ids` vide = tous les magasins du
  // superviseur, résolu à l'inscription par `handle_new_user`.
  const { error: iErr } = await admin
    .from('team_invitations')
    .upsert(
      {
        company_id: prof.company_id,
        email,
        full_name: fullName,
        first_name: firstName,
        last_name: lastName,
        store_ids: allowedStoreIds,
        created_by: inviter.id,
      },
      { onConflict: 'email' },
    )
  if (iErr) return json({ success: false, error: iErr.message }, 500)

  // E-mail d'onboarding (Resend, si configuré).
  let emailSent = false
  let emailError: string | null = null
  const resendKey = Deno.env.get('RESEND_API_KEY')
  const fromAddr = Deno.env.get('INVITE_FROM_EMAIL') ?? 'Quantinvo <onboarding@resend.dev>'
  const appUrl = Deno.env.get('APP_PUBLIC_URL') ?? 'https://quantinvo.vercel.app'
  if (resendKey) {
    const greeting = fullName ? `Bonjour ${fullName},` : 'Bonjour,'
    const inviterName = prof.full_name ? ` par ${prof.full_name}` : ''
    const html = `<div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;max-width:520px;margin:auto;color:#111"><h2 style="font-weight:800">Quantinvo</h2><p>${greeting}</p><p>Vous avez été ajouté à une équipe d'inventaire${inviterName}. Pour finaliser votre compte, ouvrez l'application Quantinvo, choisissez « Je rejoins mon équipe » et inscrivez-vous avec cette adresse e-mail (${email}) en définissant votre mot de passe.</p><p style="margin-top:24px"><a href="${appUrl}/open" style="background:#111;color:#fff;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:600">Ouvrir Quantinvo</a></p><p style="color:#666;font-size:13px;margin-top:24px">Si vous n'attendiez pas cette invitation, vous pouvez ignorer cet e-mail.</p></div>`
    try {
      const resp = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: fromAddr, to: [email], subject: 'Rejoignez votre équipe sur Quantinvo', html }),
      })
      emailSent = resp.ok
      const bodyText = await resp.text()
      if (!resp.ok) {
        console.error('[teammate] Resend error', resp.status, bodyText)
        emailError = `${resp.status} ${bodyText}`
      } else {
        console.log('[teammate] Resend ok', bodyText)
      }
    } catch (e) {
      console.error('[teammate] Resend fetch failed', e)
      emailError = e instanceof Error ? e.message : String(e)
    }
  } else {
    emailError = 'RESEND_API_KEY absent'
  }

  return json({ success: true, emailSent, emailError })
})
