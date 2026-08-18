// Edge function : déposer une demande d'accès superviseur, et expliquer par
// e-mail ce que l'écran n'a plus le droit de dire (constat M3).
//
// Depuis la migration 20260818000002, la fonction publique répond exactement la
// même chose dans tous les cas — sans quoi elle confirmait, code après code,
// lesquels sont valides, et révélait au passage quelles adresses ont déjà un
// compte. Le prix est une personne laissée sans explication.
//
// Cette fonction le lui rend, par un canal qui n'atteint qu'elle : sa propre
// boîte. Elle appelle la variante détaillée en `service_role` — inaccessible au
// navigateur — et envoie le message correspondant.
//
// ⚠️ LE CODE MAGASIN RESTE MUET, y compris par e-mail. Qui essaie des codes
// utilise sa propre adresse : lui écrire « ce code n'existe pas » rouvrirait
// l'oracle, simplement plus lentement. « Code inconnu » et « demande créée »
// reçoivent donc **le même message**, et le nom du magasin n'y figure jamais.
//
// Déployée avec `verify_jwt: false` : un formulaire public n'a pas de session.
// La contrepartie est la limitation de débit, appliquée ici avant tout travail,
// par adresse e-mail et par adresse IP.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

/** La seule réponse que le navigateur obtient, quel que soit le cas réel. */
const RECU = { success: true, received: true }

const enveloppe = (corps: string) =>
  `<div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;max-width:520px;margin:auto;color:#111">` +
  `<h2 style="font-weight:800">Quantinvo</h2>${corps}` +
  `<p style="color:#666;font-size:13px;margin-top:24px">Vous recevez ce message parce que cette adresse a été saisie sur le formulaire de demande d'accès superviseur. Si ce n'est pas vous, ignorez-le.</p></div>`

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ success: false, error: 'Méthode non autorisée' }, 405)

  let p: { firstName?: string; lastName?: string; email?: string; phone?: string; storeCode?: string }
  try {
    p = await req.json()
  } catch {
    return json({ success: false, error: 'Requête invalide' }, 400)
  }

  const email = (p.email ?? '').trim().toLowerCase()
  const url = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const admin = createClient(url, serviceKey)

  // ── Débit ────────────────────────────────────────────────────────────────
  // `client_ip()` verrait l'adresse de cette fonction, pas celle du visiteur :
  // on transmet donc explicitement celle de la requête entrante.
  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim()
  const limite = async (scope: string, key: string, max: number) => {
    if (!key) return true
    const { data, error } = await admin.rpc('rate_limit_ok', {
      p_scope: scope, p_key: key, p_max: max, p_window: '1 hour',
    })
    // Une panne du compteur ne doit pas fermer le formulaire : on laisse passer,
    // la fonction publique de la base applique de toute façon sa propre limite.
    if (error) return true
    return data === true
  }
  if (!(await limite('supervisor_request', email, 5)) ||
      !(await limite('supervisor_request_ip', ip, 20))) {
    // 200 volontairement : c'est un message pour la personne, pas une panne.
    return json({ success: false, error: 'Trop de tentatives depuis cette adresse. Réessayez dans une heure.' })
  }

  // ── Dépôt ────────────────────────────────────────────────────────────────
  const { data: detail, error } = await admin.rpc('submit_supervisor_request_detailed', {
    p_first_name: p.firstName ?? '', p_last_name: p.lastName ?? '',
    p_email: p.email ?? '', p_phone: p.phone ?? '', p_store_code: p.storeCode ?? '',
  })
  if (error) return json({ success: false, error: 'Envoi impossible. Réessayez.' }, 500)

  // Erreurs de saisie : elles ne parlent que de ce qui vient d'être tapé.
  if (detail?.success !== true) return json(detail, 200)

  // ── Explication par e-mail ───────────────────────────────────────────────
  const resendKey = Deno.env.get('RESEND_API_KEY')
  const appUrl = Deno.env.get('APP_PUBLIC_URL') ?? 'https://quantinvo.vercel.app'
  const prenom = (p.firstName ?? '').trim()
  const bonjour = prenom ? `Bonjour ${prenom},` : 'Bonjour,'

  let sujet: string
  let corps: string
  switch (detail.outcome) {
    case 'account_exists':
      sujet = 'Vous avez déjà un compte Quantinvo'
      corps = `<p>${bonjour}</p><p>Une demande d'accès vient d'être déposée avec cette adresse, mais elle dispose déjà d'un compte Quantinvo. Inutile d'en créer un second : connectez-vous directement.</p>` +
        `<p style="margin-top:24px"><a href="${appUrl}/login" style="background:#111;color:#fff;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:600">Me connecter</a></p>` +
        `<p style="color:#666;font-size:13px">Mot de passe oublié ? L'écran de connexion permet de le réinitialiser.</p>`
      break
    case 'request_pending':
      sujet = 'Votre demande Quantinvo est déjà en cours'
      corps = `<p>${bonjour}</p><p>Une demande d'accès superviseur est déjà enregistrée pour cette adresse et attend la validation de l'administrateur. Inutile d'en déposer une nouvelle.</p><p>Dès qu'elle est acceptée, vous recevez un message vous invitant à choisir votre mot de passe.</p>`
      break
    default:
      // 'created' ET 'unknown_store' : rigoureusement le même message, sans nom
      // de magasin. C'est ce qui empêche de deviner un code par e-mail.
      sujet = 'Votre demande d’accès Quantinvo'
      corps = `<p>${bonjour}</p><p>Nous avons bien reçu votre demande d'accès superviseur.</p>` +
        `<p>Si le code magasin saisi est correct, elle est en attente de validation par l'administrateur de votre entreprise. Dès qu'elle est acceptée, vous recevez un message vous invitant à choisir votre mot de passe.</p>` +
        `<p><strong>Sans nouvelle sous 48 heures</strong>, vérifiez le code magasin auprès de votre administrateur : une erreur de saisie est la cause la plus fréquente.</p>`
  }

  // L'envoi est accessoire : son échec ne doit pas faire croire que la demande
  // n'a pas été prise en compte — elle l'est, elle est en base.
  if (resendKey && email) {
    const from = Deno.env.get('INVITE_FROM_EMAIL') ?? 'Quantinvo <onboarding@resend.dev>'
    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to: [email], subject: sujet, html: enveloppe(corps) }),
      })
    } catch {
      // silencieux, volontairement
    }
  }

  return json(RECU)
})
