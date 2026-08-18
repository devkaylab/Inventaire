/**
 * Vérifie que le canal de présence d'un inventaire n'est plus écoutable sans
 * y participer. (Constat C1 de l'audit du 13 août 2026.)
 *
 * À exécuter depuis un poste ayant un accès réseau normal — l'environnement
 * d'exécution de l'agent bloque les connexions directes vers Supabase, ce qui
 * a empêché de trancher au moment de l'audit.
 *
 *   node scripts/verifier-presence-privee.mjs <uuid-inventaire>
 *
 * Attendu APRÈS correctif : `CHANNEL_ERROR` ou `TIMED_OUT`, sans jamais
 * atteindre `SUBSCRIBED`. Un `SUBSCRIBED` signifie que l'autorisation n'est
 * pas appliquée — soit les policies manquent, soit un client est resté en
 * canal public.
 *
 * Le script se connecte **sans compte**, avec la seule clé publiable, celle
 * qui figure déjà dans le bundle du site : c'est exactement ce dont dispose
 * n'importe quel visiteur.
 */
import { createClient } from '@supabase/supabase-js'

const URL = process.env.SUPABASE_URL ?? 'https://heabesqvlinzarqenymj.supabase.co'
const KEY = process.env.SUPABASE_PUBLISHABLE_KEY ?? 'sb_publishable_J857c9oNhoSphjsKD6bM1Q_Cvw7t8B2'
const SESSION = process.argv[2]

if (!SESSION) {
  console.error('Usage : node scripts/verifier-presence-privee.mjs <uuid-inventaire>')
  process.exit(2)
}

const sb = createClient(URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } })
const { data } = await sb.auth.getUser()
console.log('Compte utilisé :', data?.user ? data.user.email : 'aucun (anonyme)')

const topic = `session:${SESSION}:presence`
const channel = sb.channel(topic, { config: { presence: { key: 'sonde-audit' } } })

channel.on('presence', { event: 'sync' }, () => {
  const state = channel.presenceState()
  console.log('⚠️  PRÉSENCE LUE :', JSON.stringify(state))
})

channel.subscribe((status, err) => {
  console.log('Statut :', status, err ? `— ${err}` : '')
  if (status === 'SUBSCRIBED') {
    console.log('\n❌ ÉCHEC : le canal accepte un client non authentifié.')
    console.log('   Vérifier que les policies de realtime.messages existent et')
    console.log('   que les deux clients passent bien `private: true`.')
  }
})

setTimeout(async () => {
  const st = channel.state
  if (st !== 'joined') {
    console.log('\n✅ CONFORME : abonnement refusé (état « %s »).', st)
  }
  await sb.removeAllChannels()
  process.exit(0)
}, 10_000)
