// ⚠️ UN APERÇU N'ÉCRIT PAS DANS LA PRODUCTION (4 octobre 2026).
//
// `supabaseClient.ts` porte une adresse de repli écrite en dur, et c'est
// volontaire : une preview dont la portée « Preview » n'était pas cochée dans
// Vercel se construisait sans configuration et affichait « e-mail ou mot de
// passe incorrect » à chaque tentative — une piste entièrement fausse.
//
// Mais le repli, c'est LA BASE DE PRODUCTION. Un aperçu qui tombe dessus ne
// casse rien : il marche, et il écrit chez les vrais clients. C'est le cas de
// l'aperçu On-Demand, mesuré ce jour dans son bundle servi. Le seul signal
// existant était un `console.warn`, dans une console que personne n'ouvre.
//
// D'où ce module : il dit si le déploiement est un APERÇU tombé sur le repli.
// `components/GardeApercu.tsx` refuse alors d'ouvrir l'app.

const envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const envAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

/** `true` quand le build n'a pas reçu les variables et tombera sur le repli. */
export const configDeRepli = !envUrl || !envAnonKey

/**
 * ⚠️ DEUX SIGNAUX, PARCE QUE CHACUN PEUT MANQUER.
 *
 * - `NEXT_PUBLIC_VERCEL_ENV` vaut « preview » sur un aperçu. Vercel la pose
 *   seule, MAIS seulement si « Automatically expose System Environment
 *   Variables » est coché. Décoché, elle est vide, et un garde qui ne tiendrait
 *   qu'à elle laisserait passer sans rien dire — le défaut qu'on répare.
 * - Le nom d'hôte : un aperçu répond sur `*.vercel.app`, la production sur
 *   `www.quantinvo.com`. Celui-là ne dépend d'aucun réglage, mais ne se lit
 *   que dans le navigateur.
 *
 * La production ne correspond à aucun des deux : son `VERCEL_ENV` vaut
 * « production » et son domaine est le nôtre. Elle garde donc son repli, et
 * continue exactement comme avant.
 */
export const porteeDuBuild = process.env.NEXT_PUBLIC_VERCEL_ENV ?? ''

/**
 * ⚠️ LA PRODUCTION SE DIT, ET ÇA PRIME SUR TOUT LE RESTE. Le site en ligne est
 * AUSSI joignable par son adresse `*.vercel.app` : sans cette sortie, une
 * production qui tournerait elle-même sur le repli s'y verrait refusée. Quand
 * Vercel annonce « production », on ne bloque pas, point.
 */
export const porteeEstProduction = porteeDuBuild === 'production'

/** `true` si ce nom d'hôte est celui d'un déploiement d'aperçu. */
export function hoteEstUnApercu(hote: string): boolean {
  return hote.endsWith('.vercel.app')
}

/** Vrai dès le rendu serveur quand Vercel a dit « preview ». */
export const apercuSansBase = porteeDuBuild === 'preview' && configDeRepli
