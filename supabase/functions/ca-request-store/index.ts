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
import { adresseDeContact, emailQuantinvo } from '../_shared/email.ts'
import { nomOffre } from '../_shared/devis.ts'

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

  // ⚠️ L'assiette est le nombre d'appareils depuis le 2 septembre 2026. Le stock
  // et la surface ne sont plus demandés : ils ne tarifent plus rien.
  let payload: { name?: string; message?: string; devices?: number | null }
  try {
    payload = await req.json()
  } catch {
    return json({ success: false, error: 'Requête invalide' }, 400)
  }
  const name = (payload.name ?? '').trim()
  const message = (payload.message ?? '').trim()
  const devices = typeof payload.devices === 'number' ? Math.round(payload.devices) : null
  if (!name) return json({ success: false, error: 'Le nom du magasin est requis.' }, 400)

  const url = Deno.env.get('SUPABASE_URL')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  const caller = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } })
  const { data: userData, error: userErr } = await caller.auth.getUser()
  if (userErr || !userData?.user) return json({ success: false, error: 'Session expirée.' }, 401)

  // La borne (1 à 1 000) et le message de refus vivent dans la RPC : l'edge ne
  // redit pas la règle, il la laisse parler.
  const { data: result, error: rErr } = await caller.rpc('ca_request_store', {
    p_name: name,
    p_message: message,
    p_devices: devices,
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

  const appUrl = Deno.env.get('APP_PUBLIC_URL') ?? 'https://www.quantinvo.com'
  const appareils = devices !== null && devices > 0
    ? `${nb(devices)} appareil${devices > 1 ? 's' : ''}`
    : null
  const details: { intitule: string; valeur: string }[] = [{ intitule: 'Magasin', valeur: name }]
  if (appareils) details.push({ intitule: 'Appareils', valeur: appareils })
  if (appareils) details.push({ intitule: 'Offre', valeur: nomOffre(devices) })

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
  let accuse = true
  try {
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: fromAddr, reply_to: adresseDeContact() ?? undefined,
        to: [email],
        subject: `Demande reçue — ${name}`,
        html,
        text,
      }),
    })
    if (!resp.ok) accuse = false
  } catch {
    accuse = false
  }

  // L'avis à Quantinvo : c'est du revenu qui attend, il doit se voir sans
  // ouvrir le tableau de bord. Administrateurs lus en base, comme ailleurs.
  // Le nom de l'entreprise vient du profil ; l'assiette déclarée suit.
  try {
    const admin = createClient(url, serviceKey)
    const [{ data: admins }, { data: profil2 }] = await Promise.all([
      admin.rpc('admin_notify_emails'),
      admin.from('profiles').select('full_name, companies(name)').eq('id', userData.user.id).maybeSingle(),
    ])
    const dest = ((admins ?? []) as string[]).filter(Boolean)
    if (dest.length > 0) {
      const entreprise = ((profil2 as { companies?: { name?: string } | null } | null)?.companies?.name ?? '').trim()
      const demandeur = ((profil2 as { full_name?: string } | null)?.full_name ?? '').trim() || email
      const declare = appareils
        ? `${appareils} · ${nomOffre(devices)}`
        : 'appareils non déclarés'
      const avis = emailQuantinvo({
        titre: 'Nouvelle demande de magasin',
        apercu: `${entreprise || 'Une entreprise'} demande l’ajout de « ${name} ».`,
        paragraphes: [
          `${entreprise || 'Une entreprise cliente'} vient de demander l’ajout du magasin « ${name} ». Demande faite par ${demandeur}.`,
          message ? `Son message : « ${message} »` : 'Pas de message joint.',
          'Le devis s’établit depuis le tableau de bord — l’offre proposée y suit le nombre d’appareils.',
        ],
        details: [
          ...(entreprise ? [{ intitule: 'Entreprise', valeur: entreprise }] : []),
          { intitule: 'Magasin', valeur: name },
          { intitule: 'Déclaré', valeur: declare },
        ],
        bouton: { libelle: 'Ouvrir le tableau de bord', lien: `${appUrl}/admin` },
        raison: 'Vous recevez ce message parce que vous suivez les ventes Quantinvo.',
        siteUrl: appUrl,
      })
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: fromAddr, reply_to: adresseDeContact() ?? undefined, to: dest, subject: `Demande de magasin — ${name}`, html: avis.html, text: avis.text }),
      })
    }
  } catch {
    // Sans conséquence pour le client : le tableau de bord montre la demande.
  }

  return accuse ? json({ success: true, requested: true, emailed: true }) : sansAccuse('accusé non envoyé')
})
