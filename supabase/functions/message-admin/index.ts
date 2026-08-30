// Edge function : un superviseur écrit à l'administrateur de son entreprise
// (30 août 2026 — le « ticket » de la maquette du tableau de bord).
//
// Elle n'ajoute aucun droit : le dépôt passe par la RPC
// `deposer_message_admin`, appelée **avec le jeton de l'appelant** — c'est
// elle qui refuse un compteur, un administrateur qui s'écrirait à lui-même,
// un message vide ou trop long, et c'est elle qui écrit les notifications aux
// administrateurs. La clé de service ne sert qu'APRÈS, à lire les adresses
// pour l'e-mail — jamais à écrire (règle de ca-request-store).
//
// Le reply_to est l'adresse du superviseur : l'administrateur répond
// directement à la personne, pas à une boîte de service. Un e-mail qui ne
// part pas n'annule rien : les notifications sont déjà écrites, on répond
// { success: true, emailed: false }.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { emailQuantinvo } from '../_shared/email.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

/** Les refus de la RPC, dits en français — le code voyage pour l'écran. */
const REFUS: Record<string, string> = {
  vous_etes_administrateur: 'Vous êtes l’administrateur de votre entreprise : ce message vous serait adressé.',
  aucun_administrateur: 'Votre entreprise n’a pas encore d’administrateur à qui écrire.',
  message_vide: 'Le sujet et le message sont requis.',
  message_trop_long: 'Le message est trop long (120 caractères pour le sujet, 2 000 pour le message).',
  aucune_entreprise: 'Votre compte n’est rattaché à aucune entreprise.',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ success: false, error: 'Méthode non autorisée' }, 405)

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json({ success: false, error: 'Non authentifié' }, 401)

  let payload: { sujet?: string; message?: string }
  try {
    payload = await req.json()
  } catch {
    return json({ success: false, error: 'Requête invalide' }, 400)
  }
  const sujet = (payload.sujet ?? '').trim()
  const message = (payload.message ?? '').trim()

  const url = Deno.env.get('SUPABASE_URL')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  const caller = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } })
  const { data: userData, error: userErr } = await caller.auth.getUser()
  if (userErr || !userData?.user) return json({ success: false, error: 'Session expirée.' }, 401)

  const { data: result, error: rErr } = await caller.rpc('deposer_message_admin', {
    p_sujet: sujet,
    p_message: message,
  })
  if (rErr) {
    const code = Object.keys(REFUS).find((c) => rErr.message.includes(c))
    if (code) return json({ success: false, code, error: REFUS[code] }, 400)
    return json({ success: false, error: rErr.message }, 500)
  }
  if (!result?.success) return json({ success: false, error: 'Dépôt impossible.' }, 500)

  // Les notifications sont écrites : à partir d'ici, un échec d'e-mail se
  // dit, il ne fait pas croire que rien n'a été déposé.
  const sansEmail = (raison: string) =>
    json({ success: true, emailed: false, error: raison })

  const resendKey = Deno.env.get('RESEND_API_KEY')
  if (!resendKey) return sansEmail('Resend non configuré')

  try {
    const admin = createClient(url, serviceKey)
    const [{ data: profil }, { data: destinataires }] = await Promise.all([
      admin.from('profiles').select('full_name, first_name, company_id, companies(name)')
        .eq('id', userData.user.id).maybeSingle(),
      admin.from('profiles').select('id, first_name')
        .eq('company_id',
          (await admin.from('profiles').select('company_id').eq('id', userData.user.id).maybeSingle())
            .data?.company_id ?? '')
        .eq('is_company_admin', true)
        .neq('id', userData.user.id),
    ])
    const nomExpediteur = ((profil as { full_name?: string } | null)?.full_name ?? '').trim() || 'Un superviseur'
    const entreprise = ((profil as { companies?: { name?: string } | null } | null)?.companies?.name ?? '').trim()

    const adresses: string[] = []
    for (const d of (destinataires ?? []) as { id: string }[]) {
      const { data: u } = await admin.auth.admin.getUserById(d.id)
      if (u?.user?.email) adresses.push(u.user.email)
    }
    if (adresses.length === 0) return sansEmail('aucune adresse d’administrateur')

    const appUrl = Deno.env.get('APP_PUBLIC_URL') ?? 'https://www.quantinvo.com'
    const adresseExpediteur = userData.user.email ?? ''
    const { html, text } = emailQuantinvo({
      titre: 'Message d’un de vos superviseurs',
      apercu: `${nomExpediteur} : ${sujet}`,
      paragraphes: [
        `${nomExpediteur}${entreprise ? ` (${entreprise})` : ''} vous écrit depuis son tableau de bord :`,
        `« ${message} »`,
        // La règle du projet : un texte qui invite à écrire donne l'adresse.
        adresseExpediteur
          ? `Votre réponse partira directement à ${adresseExpediteur}.`
          : '',
      ].filter(Boolean),
      details: [
        { intitule: 'Sujet', valeur: sujet },
        { intitule: 'De', valeur: adresseExpediteur ? `${nomExpediteur} — ${adresseExpediteur}` : nomExpediteur },
      ],
      bouton: { libelle: 'Ouvrir mon espace', lien: `${appUrl}/entreprise` },
      raison: 'Vous recevez ce message parce que vous administrez cette entreprise sur Quantinvo.',
      siteUrl: appUrl,
    })

    const fromAddr = Deno.env.get('INVITE_FROM_EMAIL') ?? 'Quantinvo <onboarding@resend.dev>'
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: fromAddr,
        // La réponse va au superviseur : c'est une conversation entre eux.
        reply_to: userData.user.email ?? undefined,
        to: adresses,
        subject: `Message de ${nomExpediteur} — ${sujet}`,
        html,
        text,
      }),
    })
    if (!resp.ok) return sansEmail('envoi refusé par Resend')
  } catch {
    return sansEmail('envoi impossible')
  }

  return json({ success: true, emailed: true })
})
