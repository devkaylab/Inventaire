// Edge function : ajouter un membre (compteur) à son équipe.
// - Vérifie que l'appelant est superviseur.
// - Pré-inscrit l'e-mail (team_invitations) dans son entreprise.
// - Crée l'utilisateur auth et envoie le lien de finalisation.
//
// ⚠️ Elle écrit avec la clé de service, donc hors RLS : les deux contrôles qui
// remplacent les policies sont écrits à la main ici — les magasins doivent
// appartenir au superviseur, et une invitation déjà posée ailleurs ne se
// reprend pas (constat n°3 de la revue du 28 août 2026). Le rôle est posé
// explicitement, jamais laissé à ce qui restait dans la ligne.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { adresseDeContact, emailQuantinvo } from '../_shared/email.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

/**
 * Une personne déjà invitée et pas encore activée n'est pas un échec d'ajout :
 * la pré-inscription est enregistrée et son lien précédent reste valable.
 */
function inviteFailure(message: string) {
  const already = /already been registered|already registered|already exists/i.test(message)
  return {
    success: true,
    emailSent: false,
    alreadyInvited: already,
    emailError: already
      ? 'Cette personne avait déjà été invitée : le lien reçu précédemment reste valable.'
      : message,
  }
}

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
      return json({
        success: false,
        code: 'already_in_team',
        error: 'Cette personne fait déjà partie de votre équipe.',
      })
    }
    // Ce n'est pas une faute de saisie, c'est une situation à expliquer : le
    // compte existe, mais ailleurs. Sans dire OÙ — nommer l'autre entreprise
    // renseignerait le superviseur sur un client qui n'est pas le sien.
    //
    // Le `code` permet aux écrans de présenter cela comme une information et
    // non comme une erreur ; le texte reste lisible tel quel pour un appelant
    // qui l'ignorerait.
    return json({
      success: false,
      code: 'other_company',
      error:
        'Cette personne appartient déjà à une autre entreprise, et un compte ne peut être ' +
        "rattaché qu'à une seule. Demandez à l'administrateur de votre entreprise de s'en " +
        'occuper, ou ajoutez cette personne avec une autre adresse e-mail.',
    })
  }

  // ── Déjà invitée, mais ailleurs ? ────────────────────────────────────────
  //
  // ⚠️ `team_invitations.email` est unique **pour toute la base**, pas par
  // entreprise. Sans ce contrôle, l'`upsert` plus bas basculait la ligne d'une
  // autre entreprise sur celle-ci — et comme `role` n'est pas dans la charge,
  // PostgREST ne le met pas à jour : un `company_admin` en attente survivait à
  // l'écrasement, et `handle_new_user` l'aurait honoré. Constat n°3 de la
  // revue de sécurité du 28 août 2026.
  //
  // Le déclencheur `team_invitations_figees` (20260828150001) refuse de toute
  // façon les deux changements, service_role compris. Ce contrôle-ci est là
  // pour le dire lisiblement plutôt que de laisser remonter une exception.
  const { data: dejaInvitee } = await admin
    .from('team_invitations')
    .select('company_id, role')
    .eq('email', email)
    .maybeSingle()

  if (dejaInvitee && dejaInvitee.company_id !== prof.company_id) {
    // Même traitement que le compte existant ailleurs : ce n'est pas une
    // faute de saisie, et on ne nomme pas l'autre entreprise.
    return json({
      success: false,
      code: 'other_company',
      error:
        'Cette adresse est déjà réservée dans une autre entreprise, et un compte ne peut être ' +
        "rattaché qu'à une seule. Demandez à l'administrateur de votre entreprise de s'en " +
        'occuper, ou ajoutez cette personne avec une autre adresse e-mail.',
    })
  }

  if (dejaInvitee && dejaInvitee.role !== 'employee') {
    // Même entreprise, mais elle est attendue à un autre poste. Un superviseur
    // ne reprend pas une invitation de superviseur ou d'administrateur.
    return json({
      success: false,
      code: 'already_invited',
      error:
        'Cette personne est déjà invitée à un autre poste dans votre entreprise. ' +
        "Attendez qu'elle ait créé son compte, ou demandez à l'administrateur de votre " +
        'entreprise de reprendre son invitation.',
    })
  }

  // Les magasins doivent appartenir au superviseur : sans ce filtre, un appel
  // direct à l'API rattacherait un compteur à n'importe quel magasin.
  //
  // La liste des magasins du superviseur est lue dans tous les cas : elle sert
  // au filtre, et plus bas à nommer le magasin dans l'e-mail quand
  // l'invitation n'en vise qu'un.
  const { data: mine } = await admin
    .from('store_supervisors')
    .select('store_id')
    .eq('user_id', inviter.id)
  const mesMagasins = (mine ?? []).map((s: { store_id: string }) => s.store_id)

  let allowedStoreIds: string[] = []
  if (storeIds.length > 0) {
    const mineSet = new Set(mesMagasins)
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
        // ⚠️ Explicite, et non déduit de l'absence : sans cette ligne, un
        // `upsert` conserve le rôle de la ligne existante (PostgREST ne met à
        // jour que les colonnes envoyées). C'est la moitié du constat n°3.
        role: 'employee',
        full_name: fullName,
        first_name: firstName,
        last_name: lastName,
        store_ids: allowedStoreIds,
        created_by: inviter.id,
      },
      { onConflict: 'email' },
    )
  if (iErr) return json({ success: false, error: iErr.message }, 500)

  // Invitation : crée l'utilisateur auth et produit le lien de finalisation.
  // Le compteur n'a plus à ressaisir son identité — le prénom et le nom
  // voyagent en métadonnées, et /bienvenue les lui présente pour vérification
  // avant qu'il choisisse son mot de passe.
  //
  // L'ordre compte : la ligne `team_invitations` doit exister avant cet appel,
  // car c'est l'INSERT dans `auth.users` qui déclenche `handle_new_user`, et
  // c'est là que l'entreprise et les magasins sont lus.
  //
  // `generateLink` plutôt que `inviteUserByEmail` : il crée l'utilisateur et
  // renvoie le lien **sans envoyer d'e-mail**, ce qui laisse l'envoi à Resend
  // — déjà en place, avec notre gabarit et notre domaine. Le SMTP intégré de
  // Supabase est fortement limité en débit et conviendrait mal à
  // l'onboarding d'une équipe entière le jour d'un inventaire. Repli sur
  // l'envoi Supabase si Resend n'est pas configuré.
  const appUrl = Deno.env.get('APP_PUBLIC_URL') ?? 'https://www.quantinvo.com'
  const redirectTo = `${appUrl}/bienvenue`
  const metadata = { first_name: firstName, last_name: lastName, full_name: fullName, role: 'employee' }
  const resendKey = Deno.env.get('RESEND_API_KEY')

  if (!resendKey) {
    const { error: invErr } = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo,
      data: metadata,
    })
    if (invErr) return json(inviteFailure(invErr.message))
    return json({ success: true, emailSent: true, via: 'supabase', emailError: null })
  }

  const { data: link, error: linkErr } = await admin.auth.admin.generateLink({
    type: 'invite',
    email,
    options: { redirectTo, data: metadata },
  })
  if (linkErr) return json(inviteFailure(linkErr.message))

  const actionLink = link?.properties?.action_link
  if (!actionLink) {
    return json({ success: true, emailSent: false, emailError: 'Lien d’invitation absent de la réponse Supabase.' })
  }

  const fromAddr = Deno.env.get('INVITE_FROM_EMAIL') ?? 'Quantinvo <onboarding@resend.dev>'

  /* ── Où l'on arrive, et de la part de qui ────────────────────────────────
   *
   * Le message nommait « une équipe d'inventaire » — ni le magasin, ni
   * l'entreprise — et ne disait pas qu'il faudrait installer quelque chose.
   * Or le nom du responsable et celui du magasin sont les deux seules preuves,
   * pour la personne qui reçoit ce message, qu'elle est au bon endroit ; et
   * l'application est l'étape suivante, autant l'annoncer ici.
   *
   * ⚠️ **Le magasin n'est nommé que s'il y en a un seul.** Une invitation peut
   * en porter plusieurs, ou aucun — « aucun » voulant dire tous ceux du
   * superviseur, résolus à l'inscription par `handle_new_user`. Dans ces deux
   * cas l'entreprise prend sa place : une liste de magasins ne se lit pas dans
   * un objet d'e-mail.
   *
   * ⚠️ **Ces deux lectures viennent APRÈS tous les contrôles.** Elles servent
   * à écrire le message, jamais à décider de l'invitation.
   */
  const idsPourLeNom = allowedStoreIds.length > 0 ? allowedStoreIds : mesMagasins
  let storeName: string | null = null
  if (idsPourLeNom.length === 1) {
    const { data: st } = await admin
      .from('stores')
      .select('name')
      .eq('id', idsPourLeNom[0])
      .maybeSingle()
    storeName = st?.name ?? null
  }
  const { data: comp } = await admin
    .from('companies')
    .select('name')
    .eq('id', prof.company_id)
    .maybeSingle()
  const companyName: string | null = comp?.name ?? null
  const lieu = storeName ?? companyName

  const greeting = firstName ? `Bonjour ${firstName},` : 'Bonjour,'
  // Sans nom complet au profil, la phrase tient quand même : on ne laisse
  // jamais un blanc à la place de qui invite.
  const quiInvite = prof.full_name || 'Votre responsable'

  const { html, text } = emailQuantinvo({
    titre: "Vous rejoignez l'équipe d'inventaire",
    salutation: greeting,
    paragraphes: [
      lieu
        ? `${quiInvite} vous a ajouté à l'équipe d'inventaire de ${lieu}. C'est avec cette adresse que vous vous connecterez.`
        : `${quiInvite} vous a ajouté à son équipe d'inventaire. C'est avec cette adresse que vous vous connecterez.`,
      "Il reste deux choses à faire : choisir votre mot de passe, puis installer l'application Quantinvo sur votre téléphone — c'est là que l'on compte.",
    ],
    // L'encadré de faits est celui de l'invitation à un inventaire : rien de
    // neuf à dessiner, et l'identifiant y trouve sa place — c'est ce que la
    // personne devra retaper dans l'application.
    details: [
      ...(storeName ? [{ intitule: 'Magasin', valeur: storeName }] : []),
      ...(companyName ? [{ intitule: 'Entreprise', valeur: companyName }] : []),
      { intitule: 'Votre identifiant', valeur: email },
    ],
    // ⚠️ Aucun lien de boutique ici : deux gestes concurrents dans un message
    // qui n'en veut qu'un, et un lien mort tant que l'application n'est pas
    // publiée. Le chemin vers la boutique est sur /bienvenue, après le mot de
    // passe — là où il est vrai.
    bouton: { libelle: "Accepter l'invitation", lien: actionLink },
    note: 'Ce lien est personnel et à usage unique.',
    raison: 'Vous recevez ce message parce que votre responsable vous a ajouté à son équipe.',
    siteUrl: appUrl,
  })

  const objet = prof.full_name && lieu
    ? `${prof.full_name} vous ajoute à l'équipe de ${lieu}`
    : lieu
      ? `Vous rejoignez l'équipe d'inventaire de ${lieu}`
      : "Vous rejoignez une équipe d'inventaire Quantinvo"

  try {
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: fromAddr, reply_to: adresseDeContact() ?? undefined, to: [email], subject: objet, html, text }),
    })
    const bodyText = await resp.text()
    if (!resp.ok) {
      console.error('[teammate] Resend error', resp.status, bodyText)
      return json({ success: true, emailSent: false, emailError: `${resp.status} ${bodyText}` })
    }
    return json({ success: true, emailSent: true, via: 'resend', emailError: null })
  } catch (e) {
    console.error('[teammate] Resend fetch failed', e)
    return json({ success: true, emailSent: false, emailError: e instanceof Error ? e.message : String(e) })
  }
})
