/**
 * « il y a 12 min » — situer un événement sans afficher une heure absolue, qui
 * ne dit rien à qui lit.
 *
 * Deux précisions, un seul calcul :
 *
 *   · par défaut, la forme courte — au-delà d'un jour on compte en jours. C'est
 *     ce que lit un superviseur qui revient sur un arbitrage : « hier » suffit,
 *     « il y a 31 h 12 » demande une soustraction mentale ;
 *   · `minutes` garde les minutes derrière l'heure (« il y a 3 h 05 »), ce dont
 *     les balises restées hors ligne ont besoin : on y surveille un retard qui
 *     dure, pas une date.
 *
 * Rend une chaîne vide sur une date illisible plutôt qu'un « NaN » : l'appelant
 * la laisse simplement tomber de sa ligne.
 */
export function depuis(quand: number | string, opts?: { minutes?: boolean }): string {
  const ts = typeof quand === 'string' ? Date.parse(quand) : quand
  if (!Number.isFinite(ts)) return ''
  const min = Math.max(0, Math.round((Date.now() - ts) / 60000))
  if (min < 1) return "à l'instant"
  if (min < 60) return `il y a ${min} min`
  const h = Math.floor(min / 60)
  if (opts?.minutes) return `il y a ${h} h ${String(min % 60).padStart(2, '0')}`
  if (h < 24) return `il y a ${h} h`
  const j = Math.floor(h / 24)
  return j === 1 ? 'hier' : `il y a ${j} j`
}
