// FONCTION TEMPORAIRE — à supprimer après l'essai.
// Objet : savoir si les variables des templates Resend (`{{{VAR}}}`) sont
// échappées ou insérées telles quelles. Elle crée un template, l'envoie à
// l'adresse d'essai de Resend (delivered@resend.dev, aucun humain derrière),
// relit le message rendu, puis supprime le template.
// La clé Resend ne sort jamais de Supabase.
const MOT_DE_PASSE = 'essai-echappement-2026-08-21'

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body, null, 2), { status, headers: { 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'POST attendu' }, 405)
  const corps = await req.json().catch(() => ({}))
  if (corps?.mot !== MOT_DE_PASSE) return json({ error: 'non' }, 403)

  const cle = Deno.env.get('RESEND_API_KEY')
  const from = Deno.env.get('INVITE_FROM_EMAIL')
  if (!cle || !from) return json({ error: 'clé ou expéditeur absent' }, 500)

  const appel = async (chemin: string, init?: RequestInit) => {
    const r = await fetch(`https://api.resend.com${chemin}`, {
      ...init,
      headers: { Authorization: `Bearer ${cle}`, 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    })
    const texte = await r.text()
    let donnees: unknown = texte
    try { donnees = JSON.parse(texte) } catch { /* garder le texte */ }
    return { statut: r.status, donnees }
  }

  const etapes: Record<string, unknown> = {}

  // 1. Un template avec la variable dans les deux contextes qui comptent :
  //    en plein texte, et en valeur d'attribut (href).
  const html = `<!doctype html><html><body>
<p>Magasin : {{{MAGASIN}}}</p>
<p><a href="{{{LIEN}}}">Ouvrir</a></p>
</body></html>`
  const creation = await appel('/templates', {
    method: 'POST',
    body: JSON.stringify({
      name: 'essai-echappement-quantinvo',
      html,
      variables: [
        { key: 'MAGASIN', type: 'string' },
        { key: 'LIEN', type: 'string' },
      ],
    }),
  })
  etapes.creation = creation
  const id = (creation.donnees as { id?: string })?.id
  if (!id) return json({ etapes, conclusion: 'création impossible' }, 500)

  etapes.publication = await appel(`/templates/${id}/publish`, { method: 'POST' })

  // 2. Envoi à l'adresse d'essai de Resend, avec des valeurs hostiles.
  const envoi = await appel('/emails', {
    method: 'POST',
    body: JSON.stringify({
      from,
      to: ['delivered@resend.dev'],
      subject: 'Essai échappement Quantinvo',
      template: {
        id,
        variables: {
          MAGASIN: 'Boutique <img src=x onerror=alert(1)> "Lyon" & Cie',
          LIEN: 'javascript:alert(1)',
        },
      },
    }),
  })
  etapes.envoi = envoi
  const emailId = (envoi.donnees as { id?: string })?.id

  // 3. Relecture du message tel qu'il est parti.
  let rendu: unknown = null
  if (emailId) {
    await new Promise((r) => setTimeout(r, 2000))
    const lecture = await appel(`/emails/${emailId}`)
    rendu = lecture.donnees
  }
  etapes.rendu = rendu

  // 4. Ménage.
  etapes.suppression = await appel(`/templates/${id}`, { method: 'DELETE' })

  return json({ etapes })
})
