// Capacité de l'instance — relevé du flux de métriques du projet.
//
// Supabase expose, pour chaque projet, un flux Prometheus à
// `https://<ref>.supabase.co/customer/v1/privileged/metrics`. Cette fonction
// le lit **côté serveur** et n'en rend que les quelques chiffres qui servent à
// décider quand relever un plafond.
//
// ⚠️ POURQUOI UNE FONCTION EDGE, ET PAS UN APPEL DEPUIS LE NAVIGATEUR
//
// Le flux s'authentifie avec une clé secrète de projet, qui contourne la RLS.
// Elle ne doit donc jamais quitter le serveur : un `NEXT_PUBLIC_*` la
// publierait à tout visiteur. Elle vit dans le secret `METRICS_KEY` — nommée
// ainsi parce que Supabase réserve le préfixe `SUPABASE_` à ses propres
// secrets injectés.
//
// C'est une clé DÉDIÉE, distincte de celle qui fait tourner les autres
// fonctions : pas moins puissante, mais révocable seule — la changer ne casse
// ni Stripe, ni les invitations, ni les devis.
//
// ⚠️ La garde est `is_admin()`, appelée AVEC LE JETON DE L'APPELANT. Sans
// elle, n'importe quel compte connecté lirait l'infrastructure. `is_admin()`
// porte au passage l'exigence aal2 conditionnelle.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { analyser, releverCapacite } from '../_shared/prometheus.ts'

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

  const url = Deno.env.get('SUPABASE_URL')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
  const cle = Deno.env.get('METRICS_KEY')

  const caller = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } })
  const { data: userData, error: userErr } = await caller.auth.getUser()
  if (userErr || !userData?.user) return json({ success: false, error: 'Session expirée.' }, 401)

  const { data: estAdmin, error: adminErr } = await caller.rpc('is_admin')
  if (adminErr || estAdmin !== true) return json({ success: false, error: 'Accès refusé' }, 403)

  // Sans clé, on ne fait pas semblant : la page affichera « non branché » et
  // gardera ses chiffres de base, plutôt que des tirets inexpliqués.
  if (!cle) {
    return json({ success: false, code: 'sans_cle', error: 'Le relevé de capacité n’est pas branché.' }, 200)
  }

  let texte: string
  try {
    const reponse = await fetch(`${url}/customer/v1/privileged/metrics`, {
      headers: { Authorization: 'Basic ' + btoa(`service_role:${cle}`) },
    })
    if (!reponse.ok) {
      // 401 = clé invalide ou révoquée. On le dit tel quel : c'est la seule
      // panne qui se répare, et elle se répare en console.
      return json({
        success: false,
        code: reponse.status === 401 ? 'cle_refusee' : 'flux_indisponible',
        error: `Le flux de métriques répond ${reponse.status}.`,
      }, 200)
    }
    texte = await reponse.text()
  } catch (e) {
    return json({
      success: false, code: 'flux_indisponible',
      error: `Flux injoignable : ${e instanceof Error ? e.message : 'erreur inconnue'}`,
    }, 200)
  }

  const capacite = releverCapacite(analyser(texte))
  return json({ success: true, releve: new Date().toISOString(), capacite })
})
