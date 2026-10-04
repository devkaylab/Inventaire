// ⚠️ SUR QUELLE BASE CETTE APPLICATION EST-ELLE BRANCHÉE ? (4 octobre 2026)
//
// Le site a reçu le même garde le matin même (voir
// `docs/notes/108-un-apercu-n-ecrit-pas-dans-la-production`), mais l'app ne
// peut pas le reprendre tel quel : elle n'a pas de « portée Preview ». Son
// adresse vient d'`EXPO_PUBLIC_SUPABASE_URL`, **figée au moment du bundle**,
// lue dans un `.env` unique. Rien ne distingue un build d'essai d'un vrai une
// fois installé — et l'identifiant étant le même (`com.quantinvo.app`), un
// build d'essai ÉCRASE l'app publiée sur un vrai téléphone.
//
// D'où ce module : il dit si l'app parle à la production. Quand ce n'est pas
// le cas, `BandeauBaseEssai` le met à l'écran, en permanence.

/**
 * ⚠️ L'HÔTE DE LA PRODUCTION, EN DUR — et c'est volontaire.
 *
 * Le lire dans l'environnement n'aurait aucun sens : c'est justement
 * l'environnement qu'on met en doute. Une valeur écrite ici est la seule qui
 * ne puisse pas être déplacée par le fichier qu'on cherche à contrôler.
 */
const HOTE_PRODUCTION = 'heabesqvlinzarqenymj.supabase.co'

/** L'hôte réellement embarqué dans ce bundle, ou `''` si l'adresse manque. */
export function hoteDeLaBase(): string {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? ''
  try {
    return new URL(url).hostname
  } catch {
    return ''
  }
}

/**
 * `true` quand ce bundle parle à la production.
 *
 * ⚠️ UNE ADRESSE ABSENTE N'EST PAS LA PRODUCTION. Le bandeau s'affiche alors
 * aussi : une app sans adresse ne se connecte à rien, et le dire vaut mieux
 * que de laisser chercher.
 */
export function surLaProduction(): boolean {
  return hoteDeLaBase() === HOTE_PRODUCTION
}

/**
 * Le repère montré dans le bandeau : le préfixe du projet Supabase.
 *
 * Il suffit à distinguer deux bases d'essai l'une de l'autre, et il tient sur
 * une ligne au plus étroit des iPhone.
 */
export function repereDeLaBase(): string {
  const hote = hoteDeLaBase()
  return hote ? hote.split('.')[0] : 'aucune'
}
