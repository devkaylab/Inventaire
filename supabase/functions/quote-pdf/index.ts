// Edge function : le PDF d'un devis, par son jeton (22 août 2026).
//
// Sert le bouton « Télécharger le PDF » de la page publique `/devis/<jeton>`.
// Le prospect n'a pas de compte à ce stade : la fonction est donc déployée en
// `verify_jwt: false`, et **c'est le jeton qui tient lieu de clé** — un uuid
// aléatoire, ni devinable ni énumérable. C'est la troisième fonction publique
// du projet, avec `submit-supervisor-request` et `accept-quote`.
//
// Elle ne décide de rien et n'écrit rien : elle relit le devis par
// `quote_by_token` et le redessine avec le même module que l'envoi. Un PDF
// téléchargé et un PDF reçu par e-mail sont donc le même document.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { type LigneDevis } from '../_shared/devis.ts'
import { devisEnPdf } from '../_shared/devisPdf.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  const jeton = new URL(req.url).searchParams.get('token')?.trim() ?? ''
  if (!/^[0-9a-f-]{36}$/i.test(jeton)) {
    return new Response('Lien invalide', { status: 400, headers: cors })
  }

  const url = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const client = createClient(url, serviceKey)

  const { data, error } = await client.rpc('quote_by_token', { p_token: jeton })
  if (error) return new Response('Erreur', { status: 500, headers: cors })
  if (!data?.found) return new Response('Devis introuvable', { status: 404, headers: cors })

  const lignes: LigneDevis[] = Array.isArray(data.lines) ? data.lines : []
  // Le même objet que le PDF joint à l'e-mail : les deux doivent être le même
  // document, sinon le client compare et s'inquiète.
  const magasin = (data.store_name ?? '').trim()
  try {
    const octets = await devisEnPdf({
      reference: data.reference || 'DEVIS',
      entreprise: data.company_name ?? '',
      objet: data.kind === 'store' && magasin ? `Ajout du magasin ${magasin}` : undefined,
      contact: data.contact_name ?? data.contact_first_name ?? '',
      siren: data.siren ?? null,
      lignes,
      totalCents: typeof data.amount_cents === 'number' ? data.amount_cents : 0,
      emisLe: new Date(data.sent_at ?? Date.now()),
      expireLe: new Date(data.expires_at ?? Date.now()),
    })
    const nom = `devis-${(data.reference || 'quantinvo').replace(/[^\w-]/g, '')}.pdf`
    return new Response(octets, {
      status: 200,
      headers: {
        ...cors,
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${nom}"`,
        // Un devis peut être renvoyé : pas de cache intermédiaire.
        'Cache-Control': 'no-store',
      },
    })
  } catch {
    return new Response('PDF indisponible', { status: 500, headers: cors })
  }
})
