// Edge function : le webhook Stripe — payé, donc créé (22 août 2026).
//
// Déployée en `verify_jwt: false` : Stripe n'envoie pas de JWT. **C'est la
// signature qui garde la porte** (`verifierWebhook`, `STRIPE_WEBHOOK_SECRET`),
// et rien n'est lu avant qu'elle soit vérifiée sur le corps brut.
//
// Un seul événement compte : `checkout.session.completed` avec
// `payment_status = paid`. Tout le reste répond 200 sans rien faire — Stripe
// ne doit pas relancer ce qu'on ignore exprès.
//
// Rejeu : Stripe renvoie un événement tant qu'il n'a pas reçu 200. La RPC
// `fulfil_paid_request` répond `already: true` sur une session déjà traitée,
// et on répond 200 — c'est le cas normal prévu par AGENTS.md, pas une erreur.
// Un vrai problème (session inconnue, base injoignable) répond 500 pour que
// Stripe réessaie.
//
// Après la création : pour une inscription, le contact est invité comme
// administrateur de son entreprise (même lien `/bienvenue` que les autres
// invitations) et reçoit ses codes ; pour un ajout de magasin, le demandeur
// reçoit « votre magasin est créé ».
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { adresseDeContact, emailQuantinvo } from '../_shared/email.ts'
import { lireFacture, verifierWebhook } from '../_shared/stripe.ts'

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

type Session = {
  id: string
  payment_status?: string
  customer?: string | null
  invoice?: string | null
  payment_intent?: string | null
  metadata?: Record<string, string>
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Méthode non autorisée' }, 405)

  const secret = Deno.env.get('STRIPE_WEBHOOK_SECRET')
  if (!secret) return json({ error: 'webhook non configuré' }, 500)

  const corps = await req.text()
  let event: Record<string, unknown>
  try {
    event = await verifierWebhook(secret, corps, req.headers.get('stripe-signature'))
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'signature' }, 400)
  }

  if (event.type !== 'checkout.session.completed') return json({ received: true, ignored: event.type })
  const session = ((event.data as { object?: Session })?.object ?? {}) as Session
  if (session.payment_status && session.payment_status !== 'paid') {
    // SEPA : la session peut se terminer avant que le prélèvement soit réglé ;
    // Stripe enverra alors `checkout.session.async_payment_succeeded`.
    return json({ received: true, ignored: `payment_status=${session.payment_status}` })
  }

  const url = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const client = createClient(url, serviceKey)

  const { data: result, error } = await client.rpc('fulfil_paid_request', {
    p_session_id: session.id,
    p_customer_id: typeof session.customer === 'string' ? session.customer : null,
    p_invoice_id: typeof session.invoice === 'string' ? session.invoice : null,
    p_payment_intent_id: typeof session.payment_intent === 'string' ? session.payment_intent : null,
    // L'identifiant de l'événement, marqué DANS la même transaction que la
    // création : un rejeu ressort en `already` sans rien refaire. Le marquage
    // n'est volontairement pas fait ici — le faire avant l'appel rendrait tout
    // échec définitif, puisque le rejeu serait alors écarté comme « déjà vu ».
    p_event_id: typeof event.id === 'string' ? event.id : null,
  })
  if (error) return json({ error: error.message }, 500)
  if (!result?.success) return json({ error: result?.error ?? 'refus' }, 500)
  if (result.already) return json({ received: true, already: true, kind: result.kind })

  // À partir d'ici tout est créé. Les e-mails se tentent, ils ne défont rien.
  const appUrl = Deno.env.get('APP_PUBLIC_URL') ?? 'https://www.quantinvo.com'
  const resendKey = Deno.env.get('RESEND_API_KEY')
  const fromAddr = Deno.env.get('INVITE_FROM_EMAIL') ?? 'Quantinvo <onboarding@resend.dev>'
  const notes: string[] = []

  // La facture Stripe, pour la donner dans nos messages. Lecture seule ; si
  // la clé n'a pas ce droit ou que la facture tarde, on écrit sans.
  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')
  const facture = stripeKey && typeof session.invoice === 'string'
    ? await lireFacture(stripeKey, session.invoice).catch(() => null)
    : null

  if (result.kind === 'company' && result.invite?.email) {
    const inv = result.invite as { email: string; first_name: string; last_name: string }
    const { data: ok } = await client.rpc('invite_company_admin_after_payment', {
      p_company: result.company_id,
      p_email: inv.email,
      p_first: inv.first_name,
      p_last: inv.last_name,
    })
    if (ok?.success) {
      // Même chemin que les autres invitations : lien d'invitation Supabase
      // vers /bienvenue, où la personne vérifie son nom et choisit son mot de
      // passe. handle_new_user créera le profil avec le drapeau d'administrateur.
      const fullName = `${inv.first_name} ${inv.last_name}`.trim()
      const { data: link, error: linkErr } = await client.auth.admin.generateLink({
        type: 'invite',
        email: inv.email,
        options: {
          redirectTo: `${appUrl}/bienvenue`,
          data: { first_name: inv.first_name, last_name: inv.last_name, full_name: fullName, role: 'company_admin' },
        },
      })
      const actionLink = link?.properties?.action_link
      if (linkErr || !actionLink) {
        notes.push(`lien d'invitation : ${linkErr?.message ?? 'absent'}`)
      } else if (resendKey) {
        const stores = (result.stores ?? []) as { name: string; join_code: string }[]
        const { html, text } = emailQuantinvo({
          titre: 'Bienvenue sur Quantinvo',
          apercu: `${result.company_name} est prête. Créez votre accès.`,
          salutation: inv.first_name ? `Bonjour ${inv.first_name},` : 'Bonjour,',
          paragraphes: [
            `Votre paiement est bien reçu : ${result.company_name} est créée sur Quantinvo, avec ${stores.length > 1 ? `ses ${stores.length} magasins` : 'son magasin'}.`,
            'Vous en êtes l’administrateur. Il ne reste qu’à vérifier vos informations et à choisir votre mot de passe — vous trouverez ensuite les codes d’accès de chaque magasin sur sa fiche, à communiquer à vos équipes.',
          ],
          details: [
            { intitule: 'Entreprise', valeur: result.company_name },
            ...stores.map((s) => ({ intitule: 'Magasin', valeur: s.name })),
            ...(facture ? [{ intitule: 'Facture', valeur: facture.numero || 'disponible en ligne' }] : []),
          ],
          bouton: { libelle: 'Créer mon accès', lien: actionLink },
          ...(facture ? { lienSecondaire: { libelle: `Voir et télécharger votre facture${facture.numero ? ` ${facture.numero}` : ''}`, lien: facture.url } } : {}),
          note: 'Ce lien est personnel et à usage unique. Les codes d’accès ne circulent pas par e-mail : ils se lisent une fois connecté.',
          raison: 'Vous recevez ce message parce que vous venez de régler votre licence Quantinvo.',
          siteUrl: appUrl,
        })
        const resp = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ from: fromAddr, reply_to: adresseDeContact() ?? undefined, to: [inv.email], subject: `Bienvenue sur Quantinvo — ${result.company_name}`, html, text }),
        })
        if (!resp.ok) notes.push(`e-mail de bienvenue : ${resp.status}`)
      }
    } else {
      notes.push(`invitation : ${ok?.error ?? 'refusée'}`)
    }
  }

  if (result.kind === 'store' && result.notify?.email && resendKey) {
    const n = result.notify as { email: string; first_name: string; store_name: string; company_name: string; store_id: string }
    const { html, text } = emailQuantinvo({
      titre: 'Votre magasin est créé',
      apercu: `${n.store_name} est prêt à recevoir ses inventaires.`,
      salutation: n.first_name ? `Bonjour ${n.first_name},` : 'Bonjour,',
      paragraphes: [
        `Votre paiement est bien reçu : le magasin « ${n.store_name} » est créé et prêt à recevoir ses inventaires.`,
        'Sa fiche vous donne son code d’accès, à communiquer à vos équipes, et vous pouvez dès maintenant y affecter un superviseur.',
      ],
      details: [
        { intitule: 'Magasin', valeur: n.store_name },
        { intitule: 'Entreprise', valeur: n.company_name },
        ...(facture ? [{ intitule: 'Facture', valeur: facture.numero || 'disponible en ligne' }] : []),
      ],
      bouton: { libelle: 'Ouvrir la fiche du magasin', lien: `${appUrl}/magasins/${n.store_id}` },
      ...(facture ? { lienSecondaire: { libelle: `Voir et télécharger votre facture${facture.numero ? ` ${facture.numero}` : ''}`, lien: facture.url } } : {}),
      note: 'Le code d’accès ne circule pas par e-mail : il se lit sur la fiche, une fois connecté.',
      raison: 'Vous recevez ce message parce que vous venez de régler l’ajout de ce magasin.',
      siteUrl: appUrl,
    })
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: fromAddr, reply_to: adresseDeContact() ?? undefined, to: [n.email], subject: `Votre magasin ${n.store_name} est créé`, html, text }),
    })
    if (!resp.ok) notes.push(`e-mail magasin : ${resp.status}`)
  }

  // Avis interne, comme à l'acceptation : le revenu est encaissé.
  if (resendKey) {
    try {
      const { data: admins } = await client.rpc('admin_notify_emails')
      const dest = ((admins ?? []) as string[]).filter(Boolean)
      if (dest.length > 0) {
        const objet = result.kind === 'company'
          ? `${result.company_name} a réglé et est créée`
          : `${result.company_name} a réglé le magasin ${result.store_name}`
        const { html, text } = emailQuantinvo({
          titre: 'Paiement reçu',
          apercu: objet,
          paragraphes: [`${objet}. Tout est en place, rien à faire de votre côté.`],
          bouton: { libelle: 'Ouvrir le tableau de bord', lien: `${appUrl}/admin` },
          raison: 'Vous recevez ce message parce que vous suivez les ventes Quantinvo.',
          siteUrl: appUrl,
        })
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ from: fromAddr, reply_to: adresseDeContact() ?? undefined, to: dest, subject: `Paiement reçu — ${result.company_name}`, html, text }),
        })
      }
    } catch {
      // Sans conséquence : le tableau de bord montre l'état.
    }
  }

  return json({ received: true, created: result.kind, notes })
})
