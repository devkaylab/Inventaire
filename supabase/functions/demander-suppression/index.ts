// Demande de suppression d'un compte, adressée aux administrateurs.
//
// ⚠️ **LA DÉCISION RESTE À LA BASE.** Cette fonction n'autorise rien : elle
// appelle `demander_suppression_compte` AVEC LE JETON DE L'APPELANT, donc sous
// `auth.uid()`, et la RPC vérifie les trois bornes (compteur, même entreprise,
// dans un magasin de l'appelant) et écrit la demande et les notifications.
// L'edge ne sert qu'à ce que la base ne sait pas faire : envoyer le courriel.
//
// ⚠️ Et elle ne décide pas non plus des destinataires : elle relit les
// administrateurs de l'entreprise avec la clé de service, après que la RPC a
// accepté. Une liste venue de l'appelant serait une liste de son choix.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { adresseDeContact, emailQuantinvo } from '../_shared/email.ts'

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

  let payload: { userId?: string; motif?: string }
  try { payload = await req.json() } catch { return json({ success: false, error: 'Requête invalide' }, 400) }
  const userId = (payload.userId ?? '').trim()
  const motif = (payload.motif ?? '').trim()
  if (!userId) return json({ success: false, error: 'Personne requise.' }, 400)

  const url = Deno.env.get('SUPABASE_URL')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  const caller = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } })
  const { data: rpc, error: rpcErr } = await caller.rpc('demander_suppression_compte', {
    p_user: userId, p_motif: motif,
  })
  if (rpcErr) return json({ success: false, error: rpcErr.message }, 500)
  const res = rpc as { success?: boolean; error?: string; code?: string; nom?: string } | null
  if (!res?.success) {
    return json({ success: false, error: res?.error ?? 'Demande impossible.', code: res?.code })
  }

  // ── Le courriel, en plus de la notification ──────────────────────────────
  //
  // ⚠️ Les deux, parce que Julien l'a demandé et que les deux ne disent pas la
  // même chose : la notification attend que l'administrateur se connecte, le
  // courriel le trouve là où il est. Un échec d'envoi NE REMET PAS la demande
  // en cause — elle est déjà écrite, et la notification est partie.
  const resendKey = Deno.env.get('RESEND_API_KEY')
  if (!resendKey) return json({ success: true, emailSent: false, nom: res.nom ?? '' })

  const admin = createClient(url, serviceKey)
  const { data: moi } = await admin.from('profiles').select('company_id, full_name')
    .eq('id', (await caller.auth.getUser()).data.user?.id ?? '').maybeSingle()
  if (!moi?.company_id) return json({ success: true, emailSent: false, nom: res.nom ?? '' })

  const { data: admins } = await admin.from('profiles').select('id, full_name')
    .eq('company_id', moi.company_id).eq('is_company_admin', true)
  const ids = (admins ?? []).map((a: { id: string }) => a.id)
  if (ids.length === 0) return json({ success: true, emailSent: false, nom: res.nom ?? '' })

  const { data: comptes } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  const destinataires = (comptes?.users ?? [])
    .filter((u) => ids.includes(u.id) && !!u.email)
    .map((u) => u.email as string)
  if (destinataires.length === 0) return json({ success: true, emailSent: false, nom: res.nom ?? '' })

  const appUrl = Deno.env.get('APP_PUBLIC_URL') ?? 'https://www.quantinvo.com'
  const qui = moi.full_name || 'Un superviseur'
  const { html, text } = emailQuantinvo({
    titre: 'Demande de suppression de compte',
    salutation: 'Bonjour,',
    paragraphes: [
      `${qui} demande la suppression du compte de ${res.nom || 'un compteur'}.`,
      'Vous seul pouvez supprimer un compte. La demande est aussi dans vos notifications.',
    ],
    details: [
      { intitule: 'Personne visée', valeur: res.nom || '' },
      { intitule: 'Demandé par', valeur: qui },
      { intitule: 'Motif', valeur: motif },
    ],
    bouton: { libelle: 'Ouvrir Mon équipe', lien: `${appUrl}/equipe` },
    note: 'La suppression est définitive : le compte et ses accès disparaissent.',
    raison: 'Vous recevez ce message parce que vous administrez cette entreprise sur Quantinvo.',
    siteUrl: appUrl,
  })

  try {
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: Deno.env.get('INVITE_FROM_EMAIL') ?? 'Quantinvo <onboarding@resend.dev>',
        reply_to: adresseDeContact() ?? undefined,
        to: destinataires,
        subject: `Demande de suppression du compte de ${res.nom || 'un compteur'}`,
        html, text,
      }),
    })
    if (!resp.ok) {
      console.error('[suppression] Resend', resp.status, await resp.text())
      return json({ success: true, emailSent: false, nom: res.nom ?? '' })
    }
  } catch (e) {
    console.error('[suppression] Resend', e)
    return json({ success: true, emailSent: false, nom: res.nom ?? '' })
  }

  return json({ success: true, emailSent: true, destinataires: destinataires.length, nom: res.nom ?? '' })
})
