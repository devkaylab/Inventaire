// Edge function : les messages internes du produit (30 août 2026).
//
// Deux canaux, choisis d'après le PROFIL de l'appelant — jamais d'après la
// requête : un superviseur ordinaire écrit à l'administrateur de son
// entreprise ; un administrateur d'entreprise écrit à Quantinvo (adresses
// lues par admin_notify_emails, comme tous les avis internes).
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
import { adresseDeContact, emailQuantinvo } from '../_shared/email.ts'

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
  aucun_administrateur_quantinvo: 'Personne chez Quantinvo ne peut recevoir ce message pour le moment.',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ success: false, error: 'Méthode non autorisée' }, 405)

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json({ success: false, error: 'Non authentifié' }, 401)

  let payload: { sujet?: string; message?: string; filId?: string }
  try {
    payload = await req.json()
  } catch {
    return json({ success: false, error: 'Requête invalide' }, 400)
  }
  const sujet = (payload.sujet ?? '').trim()
  const message = (payload.message ?? '').trim()
  // Avec un fil, c'est une réponse ; sans, c'est une conversation qui s'ouvre.
  const filId = (payload.filId ?? '').trim() || null

  const url = Deno.env.get('SUPABASE_URL')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  const caller = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } })
  const { data: userData, error: userErr } = await caller.auth.getUser()
  if (userErr || !userData?.user) return json({ success: false, error: 'Session expirée.' }, 401)

  // Le destinataire ne vient JAMAIS de la requête : à l'ouverture d'un fil il
  // se déduit du profil (un administrateur d'entreprise écrit à Quantinvo, un
  // superviseur à son administrateur) ; sur une réponse, ce sont les autres
  // participants du fil, et la RPC vérifie l'appartenance.
  const { data: profilAppelant } = await caller
    .from('profiles')
    .select('is_company_admin')
    .eq('id', userData.user.id)
    .maybeSingle()
  const versQuantinvo = !!profilAppelant?.is_company_admin

  const { data: result, error: rErr } = filId
    ? await caller.rpc('repondre_fil', { p_fil: filId, p_message: message })
    : await caller.rpc('ouvrir_fil', { p_sujet: sujet, p_message: message })
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
    const filCible = filId ?? (result?.fil_id as string | undefined)
    if (!filCible) return sansEmail('fil introuvable')

    const [{ data: profil }, { data: fil }] = await Promise.all([
      admin.from('profiles').select('full_name, is_admin, companies(name)')
        .eq('id', userData.user.id).maybeSingle(),
      admin.rpc('fil_pour_email', { p_fil: filCible }),
    ])
    const jeSuisQuantinvo = !!(profil as { is_admin?: boolean } | null)?.is_admin
    const entreprise = ((profil as { companies?: { name?: string } | null } | null)?.companies?.name ?? '').trim()
    const sujetFil = ((fil?.sujet as string | undefined) ?? sujet).trim()
    const versClient = fil?.portee === 'quantinvo' && jeSuisQuantinvo

    // ⚠️ Quantinvo parle d'une seule voix : quand c'est NOUS qui répondons à
    // un client, l'e-mail ne porte ni le nom ni l'adresse personnelle de
    // l'administrateur — le client répondrait dans une boîte privée.
    const nomExpediteur = versClient
      ? 'Quantinvo'
      : (((profil as { full_name?: string } | null)?.full_name ?? '').trim() || 'Un superviseur')
    const adresseExpediteur = versClient
      ? (adresseDeContact() ?? '')
      : (userData.user.email ?? '')

    // Les destinataires SONT les autres participants du fil : une réponse
    // revient à qui a écrit, une ouverture va à ceux que la RPC a inscrits.
    const adresses: string[] = []
    for (const d of ((fil?.destinataires ?? []) as { user_id: string }[])) {
      if (d.user_id === userData.user.id) continue
      const { data: u } = await admin.auth.admin.getUserById(d.user_id)
      if (u?.user?.email) adresses.push(u.user.email)
    }
    if (adresses.length === 0) return sansEmail('aucune adresse de destinataire')

    const appUrl = Deno.env.get('APP_PUBLIC_URL') ?? 'https://www.quantinvo.com'
    const { html, text } = emailQuantinvo({
      titre: filId
        ? 'Réponse à votre conversation'
        : versQuantinvo ? 'Message d’une entreprise cliente' : 'Message d’un de vos superviseurs',
      apercu: `${nomExpediteur} : ${sujetFil || message.slice(0, 60)}`,
      paragraphes: [
        filId
          ? `${nomExpediteur}${!versClient && entreprise ? ` (${entreprise})` : ''} a répondu :`
          : `${nomExpediteur}${entreprise ? ` (${entreprise})` : ''} vous écrit depuis son tableau de bord :`,
        `« ${message} »`,
        // La règle du projet : un texte qui invite à écrire donne l'adresse.
        adresseExpediteur
          ? `Votre réponse partira directement à ${adresseExpediteur}.`
          : '',
      ].filter(Boolean),
      details: [
        // Le sujet figure aussi sur une réponse : sans lui, on ne sait pas de
        // quelle conversation il s'agit sans cliquer.
        ...(sujetFil ? [{ intitule: 'Sujet', valeur: sujetFil }] : []),
        ...(versQuantinvo && !versClient && entreprise ? [{ intitule: 'Entreprise', valeur: entreprise }] : []),
        { intitule: 'De', valeur: adresseExpediteur ? `${nomExpediteur} — ${adresseExpediteur}` : nomExpediteur },
      ],
      // Le bouton mène AU FIL : la conversation se lit et se poursuit là.
      bouton: {
        libelle: 'Ouvrir la conversation',
        lien: filCible ? `${appUrl}/messages?fil=${filCible}` : `${appUrl}/messages`,
      },
      raison: 'Vous recevez ce message parce que vous participez à cette conversation sur Quantinvo.',
      siteUrl: appUrl,
    })

    const fromAddr = Deno.env.get('INVITE_FROM_EMAIL') ?? 'Quantinvo <onboarding@resend.dev>'
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: fromAddr,
        // La réponse revient à l'expéditeur — sauf quand Quantinvo écrit à un
        // client : elle va alors à l'adresse de contact, pas à une boîte
        // personnelle.
        reply_to: adresseExpediteur || undefined,
        to: adresses,
        subject: filId
        ? `Réponse de ${nomExpediteur} — ${sujetFil}`
        : `Message de ${nomExpediteur} — ${sujetFil}`,
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
