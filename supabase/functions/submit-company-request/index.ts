// Edge function : une entreprise demande son inscription, et tout le monde
// est prévenu (22 août 2026).
//
// Julien : « il faut que je puisse recevoir un mail de demande d'inscription,
// je ne sais pas si c'est déjà prévu ». Ça ne l'était pas : /inscription
// écrivait en base et personne ne le savait — ni Quantinvo, ni le prospect.
//
// Même figure que `ca-request-store` : la RPC `submit_company_request` fait le
// travail (elle est publique, gardée par sa propre validation et la limitation
// de débit), l'edge écrit deux messages par-dessus — l'accusé au prospect,
// l'avis aux administrateurs Quantinvo lus en base. Un e-mail qui ne part pas
// ne défait pas la demande.
//
// Déployée en `verify_jwt: false` : un formulaire public n'a pas de session.
// Le site retombe sur la RPC directe si l'edge est injoignable — la demande
// passe alors sans e-mail, plutôt que de ne pas passer.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { adresseDeContact, emailQuantinvo } from '../_shared/email.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

const nb = (v: number) => v.toLocaleString('fr-FR')

type Magasin = { name?: string | null; units?: number | null; sqm?: number | null }

async function envoyer(cle: string, from: string, to: string | string[], subject: string, html: string, text: string) {
  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${cle}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, reply_to: adresseDeContact() ?? undefined, to: Array.isArray(to) ? to : [to], subject, html, text }),
  })
  if (!resp.ok) throw new Error(`${resp.status} ${await resp.text()}`)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ success: false, error: 'Méthode non autorisée' }, 405)

  let p: {
    companyName?: string; firstName?: string; lastName?: string; email?: string; phone?: string
    storeCount?: number; message?: string; siren?: string | null; ape?: string | null; stores?: Magasin[]
  }
  try {
    p = await req.json()
  } catch {
    return json({ success: false, error: 'Requête invalide' }, 400)
  }

  const url = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const client = createClient(url, serviceKey)

  // La RPC porte la validation et la limitation de débit : on ne la double pas.
  const { data: result, error } = await client.rpc('submit_company_request', {
    p_company_name: p.companyName ?? '',
    p_first_name: p.firstName ?? '',
    p_last_name: p.lastName ?? '',
    p_email: p.email ?? '',
    p_phone: p.phone ?? '',
    p_store_count: typeof p.storeCount === 'number' ? p.storeCount : 0,
    p_message: p.message ?? '',
    p_siren: p.siren ?? null,
    p_ape: p.ape ?? null,
    p_stores: Array.isArray(p.stores) ? p.stores : [],
  })
  if (error) return json({ success: false, error: error.message }, 500)
  if (!result?.success) return json({ success: false, error: result?.error ?? 'Envoi impossible.' }, 400)

  const resendKey = Deno.env.get('RESEND_API_KEY')
  if (!resendKey) return json({ success: true, emailed: false })

  const appUrl = Deno.env.get('APP_PUBLIC_URL') ?? 'https://www.quantinvo.com'
  const fromAddr = Deno.env.get('INVITE_FROM_EMAIL') ?? 'Quantinvo <onboarding@resend.dev>'
  const entreprise = (p.companyName ?? '').trim()
  const prenom = (p.firstName ?? '').trim()
  const magasins = (Array.isArray(p.stores) ? p.stores : []).filter((m) => (m.name ?? '').trim() || m.units != null)
  const nbMagasins = magasins.length || p.storeCount || 0

  let emailed = false
  try {
    const accuse = emailQuantinvo({
      titre: 'Votre demande est bien reçue',
      apercu: `Demande d’inscription reçue pour ${entreprise}.`,
      salutation: prenom ? `Bonjour ${prenom},` : 'Bonjour,',
      paragraphes: [
        `Nous avons bien reçu votre demande d’inscription pour ${entreprise}. Elle est en cours d’étude : nous revenons vers vous avec un devis adapté à ${nbMagasins > 1 ? 'chacun de vos magasins' : 'votre magasin'}.`,
        'Vous n’avez rien à faire d’ici là. Le devis vous parviendra par e-mail, et vous pourrez l’accepter et régler en ligne.',
      ],
      details: [
        { intitule: 'Entreprise', valeur: entreprise },
        { intitule: 'Magasins', valeur: nb(nbMagasins) },
      ],
      raison: 'Vous recevez ce message parce que vous avez demandé l’inscription de votre entreprise sur Quantinvo.',
      siteUrl: appUrl,
    })
    await envoyer(resendKey, fromAddr, (p.email ?? '').trim(), `Demande reçue — ${entreprise}`, accuse.html, accuse.text)
    emailed = true
  } catch {
    // La demande est enregistrée ; l'accusé qui ne part pas se dit, il n'annule rien.
  }

  // L'avis interne : c'est le début du parcours de vente, il doit se voir.
  try {
    const { data: admins } = await client.rpc('admin_notify_emails')
    const dest = ((admins ?? []) as string[]).filter(Boolean)
    if (dest.length > 0) {
      const lignes = magasins.slice(0, 8).map((m) => ({
        intitule: (m.name ?? '').trim() || 'Magasin',
        valeur: [
          m.units != null ? `${nb(m.units)} pièces` : 'stock non déclaré',
          m.sqm != null ? `${nb(m.sqm)} m²` : null,
        ].filter(Boolean).join(' · '),
      }))
      const avis = emailQuantinvo({
        titre: 'Nouvelle demande d’inscription',
        apercu: `${entreprise} demande son inscription — ${nb(nbMagasins)} magasin${nbMagasins > 1 ? 's' : ''}.`,
        paragraphes: [
          `${entreprise} vient de demander son inscription, pour ${nb(nbMagasins)} magasin${nbMagasins > 1 ? 's' : ''}. Contact : ${[prenom, (p.lastName ?? '').trim()].filter(Boolean).join(' ')}${p.phone ? ` · ${p.phone}` : ''}.`,
          (p.message ?? '').trim() ? `Son message : « ${(p.message ?? '').trim()} »` : 'Pas de message joint.',
          'Le devis s’établit depuis le tableau de bord — le recoupement stock / surface y est affiché.',
        ],
        details: [
          { intitule: 'Entreprise', valeur: entreprise },
          ...(p.siren ? [{ intitule: 'SIREN', valeur: String(p.siren) }] : []),
          ...lignes,
          ...(magasins.length > 8 ? [{ intitule: '…', valeur: `et ${magasins.length - 8} autres` }] : []),
        ],
        bouton: { libelle: 'Ouvrir le tableau de bord', lien: `${appUrl}/admin` },
        raison: 'Vous recevez ce message parce que vous suivez les ventes Quantinvo.',
        siteUrl: appUrl,
      })
      await envoyer(resendKey, fromAddr, dest, `Demande d’inscription — ${entreprise}`, avis.html, avis.text)
    }
  } catch {
    // Sans conséquence pour le prospect : le tableau de bord montre la demande.
  }

  return json({ success: true, emailed })
})
