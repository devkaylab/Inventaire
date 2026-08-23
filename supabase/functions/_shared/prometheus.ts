// Lecture du flux de métriques d'un projet Supabase.
//
// Chaque projet expose un flux au format Prometheus à
// `https://<ref>.supabase.co/customer/v1/privileged/metrics`, authentifié en
// Basic Auth (`service_role` + une clé secrète de projet). Ce module ne fait
// que **lire ce texte** : il ne connaît ni le réseau, ni Deno, ni les secrets.
//
// C'est la même séparation que `_shared/devis.ts` : le calcul d'un côté, les
// API de la plateforme de l'autre, pour que vitest puisse l'exécuter tel quel
// (il ne sait pas résoudre les imports esm.sh).
//
// ⚠️ Ce flux expose l'INFRASTRUCTURE, pas la facturation. On y lit les
// connexions, le disque, la mémoire, le processeur — jamais les messages temps
// réel consommés ni la sortie réseau du mois, qui sont des compteurs de
// facturation. Et la seule série temps réel, `realtime_postgres_changes_*`,
// compte les abonnements `postgres_changes` : la présence de l'application
// passe par du **broadcast** et n'y apparaît donc jamais.

export type Serie = {
  nom: string
  etiquettes: Record<string, string>
  valeur: number
}

/** Une ligne : `nom{cle="valeur",…} 1.23e+08`, ou `nom 1.23`. */
const LIGNE = /^([a-zA-Z_:][a-zA-Z0-9_:]*)(\{([^}]*)\})?\s+([^\s]+)\s*$/

/**
 * Découpe le texte Prometheus en séries.
 *
 * Les lignes de commentaire (`# HELP`, `# TYPE`) et les valeurs non numériques
 * (`NaN`, `+Inf`) sont écartées : elles n'apportent rien ici et une valeur non
 * finie fausserait les rapports.
 */
export function analyser(texte: string): Serie[] {
  const series: Serie[] = []
  for (const brut of texte.split('\n')) {
    const ligne = brut.trim()
    if (ligne === '' || ligne.startsWith('#')) continue
    const m = LIGNE.exec(ligne)
    if (!m) continue
    const valeur = Number(m[4])
    if (!Number.isFinite(valeur)) continue
    series.push({ nom: m[1], etiquettes: etiquettesDe(m[3] ?? ''), valeur })
  }
  return series
}

function etiquettesDe(brut: string): Record<string, string> {
  const out: Record<string, string> = {}
  // `cle="valeur"` séparés par des virgules ; une virgule peut vivre dans une
  // valeur, d'où la lecture par expression plutôt qu'un `split(',')`.
  const paire = /([a-zA-Z_][a-zA-Z0-9_]*)="((?:[^"\\]|\\.)*)"/g
  let m: RegExpExecArray | null
  while ((m = paire.exec(brut)) !== null) {
    out[m[1]] = m[2].replace(/\\(.)/g, '$1')
  }
  return out
}

const ou = (series: Serie[], nom: string) => series.filter((s) => s.nom === nom)
const une = (series: Serie[], nom: string) => ou(series, nom)[0]?.valeur ?? null

export type Capacite = {
  /** Connexions Postgres ouvertes, toutes origines confondues. */
  connexions: number | null
  /** `max_connections` de l'instance — 60 sur une Micro. */
  connexionsMax: number | null
  /** Disque de DONNÉES provisionné, en octets. Voir `disqueOctets`. */
  disqueTotal: number | null
  disqueLibre: number | null
  /** Taille de la base applicative (`postgres`), en octets. */
  baseOctets: number | null
  walMo: number | null
  memoireTotale: number | null
  memoireDispo: number | null
  coeurs: number | null
  charge1: number | null
  /** Comptes `auth.users` — tous, jamais les seuls actifs du mois. */
  comptes: number | null
}

/**
 * ⚠️ Le disque qui compte est celui monté sur `/data`, pas `/`.
 *
 * L'instance expose deux systèmes de fichiers : la racine (le système, ~10 Go)
 * et `/data` (les données Postgres, celui que Supabase provisionne et
 * facture). Prendre le plus grand des deux — réflexe naturel — donnerait la
 * racine et une marge trois fois trop optimiste.
 *
 * Repli sur le plus grand si `/data` venait à disparaître d'une version
 * future : mieux vaut un chiffre approximatif qu'un tiret.
 */
function disqueOctets(series: Serie[], nom: string): number | null {
  const toutes = ou(series, nom)
  if (toutes.length === 0) return null
  const data = toutes.find((s) => s.etiquettes.mountpoint === '/data')
  if (data) return data.valeur
  return toutes.reduce((a, b) => (b.valeur > a.valeur ? b : a)).valeur
}

/** Extrait de quoi juger la capacité. Ce qui manque vaut `null`, jamais zéro. */
export function releverCapacite(series: Serie[]): Capacite {
  // Une ligne par utilisateur Postgres (`authenticator`, `supabase_admin`…) :
  // c'est leur somme qui se compare à `max_connections`.
  const connexions = ou(series, 'connection_stats_connection_count')
  const cpus = ou(series, 'node_cpu_online').filter((s) => s.valeur === 1)
  // Trois bases coexistent (`postgres`, `template0`, `template1`) ; seule la
  // première est la nôtre.
  const base = ou(series, 'pg_database_size_bytes')
    .find((s) => s.etiquettes.datname === 'postgres')

  return {
    connexions: connexions.length === 0 ? null : connexions.reduce((t, s) => t + s.valeur, 0),
    connexionsMax: une(series, 'max_connections_connection_count'),
    disqueTotal: disqueOctets(series, 'node_filesystem_size_bytes'),
    disqueLibre: disqueOctets(series, 'node_filesystem_avail_bytes'),
    baseOctets: base?.valeur ?? null,
    walMo: une(series, 'pg_wal_size_mb'),
    memoireTotale: une(series, 'node_memory_MemTotal_bytes'),
    memoireDispo: une(series, 'node_memory_MemAvailable_bytes'),
    coeurs: cpus.length === 0 ? null : cpus.length,
    charge1: une(series, 'node_load1'),
    comptes: une(series, 'auth_users_user_count'),
  }
}
