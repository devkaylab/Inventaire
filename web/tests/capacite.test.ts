import { describe, it, expect } from 'vitest'
import { analyser, releverCapacite } from '../../supabase/functions/_shared/prometheus'
import { lirePlafonds, aSurveiller, SEUILS, LIBELLES_ETAT } from '@/lib/capacite'
import { octets } from '@/lib/format'

/**
 * Extrait RÉEL du flux du projet, relevé le 23 août 2026 — étiquettes et
 * notation scientifique comprises. Un jeu inventé n'aurait pas montré les deux
 * points de montage ni les quatre lignes de connexions, qui sont exactement
 * les deux pièges de cette lecture.
 */
const FLUX = `
# HELP node_memory_MemAvailable_bytes Memory information field MemAvailable_bytes.
# TYPE node_memory_MemAvailable_bytes gauge
node_memory_MemAvailable_bytes{supabase_project_ref="ref",service_type="db"} 1.79740672e+08
node_filesystem_avail_bytes{service_type="db",device="/dev/nvme0n1",fstype="ext4",mountpoint="/data"} 1.690886144e+09
node_filesystem_avail_bytes{service_type="db",device="/dev/nvme1n1p2",fstype="ext4",mountpoint="/"} 2.41334272e+09
node_load1{service_type="db"} 0
node_memory_MemTotal_bytes{service_type="db"} 4.28224512e+08
node_filesystem_size_bytes{service_type="db",device="/dev/nvme0n1",fstype="ext4",mountpoint="/data"} 2.077073408e+09
node_filesystem_size_bytes{service_type="db",device="/dev/nvme1n1p2",fstype="ext4",mountpoint="/"} 1.0359754752e+10
node_cpu_online{service_type="db",cpu="0"} 1
node_cpu_online{service_type="db",cpu="1"} 1
pg_wal_size_mb{service_type="postgresql",server="localhost:5432"} 128.00034999847412
auth_users_user_count{service_type="postgresql",server="localhost:5432"} 7
pg_database_size_bytes{service_type="postgresql",datname="postgres"} 6.0009619e+07
pg_database_size_bytes{service_type="postgresql",datname="template0"} 7.520783e+06
pg_database_size_bytes{service_type="postgresql",datname="template1"} 7.752851e+06
connection_stats_connection_count{server="localhost:5432",username="authenticator"} 2
connection_stats_connection_count{server="localhost:5432",username="other"} 1
connection_stats_connection_count{server="localhost:5432",username="supabase_admin"} 2
connection_stats_connection_count{server="localhost:5432",username="supabase_storage_admin"} 1
max_connections_connection_count{server="localhost:5432"} 60
`

describe('lecture du flux Prometheus', () => {
  const series = analyser(FLUX)

  it('écarte les commentaires et garde les mesures', () => {
    expect(series.length).toBe(19)
    expect(series.some((s) => s.nom.startsWith('#'))).toBe(false)
  })

  it('lit la notation scientifique', () => {
    expect(series.find((s) => s.nom === 'node_memory_MemTotal_bytes')?.valeur).toBe(428_224_512)
  })

  it('sépare les étiquettes', () => {
    const cpu = series.filter((s) => s.nom === 'node_cpu_online')
    expect(cpu.map((s) => s.etiquettes.cpu)).toEqual(['0', '1'])
  })

  it('ignore une valeur non finie plutôt que de la propager', () => {
    // `NaN` est légal en Prometheus ; en faire un nombre casserait tout rapport.
    expect(analyser('x{a="b"} NaN').length).toBe(0)
    expect(analyser('x{a="b"} +Inf').length).toBe(0)
  })
})

describe('relevé de capacité', () => {
  const c = releverCapacite(analyser(FLUX))

  it('prend le disque de DONNÉES, jamais la racine', () => {
    // ⚠️ Le piège : la racine fait 10,4 Go, `/data` 2,08 Go. Prendre le plus
    // grand donnerait une marge trois fois trop optimiste.
    expect(c.disqueTotal).toBe(2_077_073_408)
    expect(c.disqueLibre).toBe(1_690_886_144)
  })

  it('additionne les connexions de tous les utilisateurs', () => {
    // Une ligne par rôle Postgres : seule leur somme se compare au plafond.
    expect(c.connexions).toBe(6)
    expect(c.connexionsMax).toBe(60)
  })

  it('ne retient que la base applicative', () => {
    // `template0` et `template1` coexistent et ne sont pas à nous.
    expect(c.baseOctets).toBe(60_009_619)
  })

  it('compte les cœurs en ligne', () => {
    expect(c.coeurs).toBe(2)
    expect(c.charge1).toBe(0)
  })

  it('rend null pour ce qui manque, jamais zéro', () => {
    // Un zéro se lirait comme une mesure : « 0 connexion » au lieu de « on ne
    // sait pas ». La page distingue les deux.
    const vide = releverCapacite([])
    expect(vide.connexions).toBeNull()
    expect(vide.disqueTotal).toBeNull()
    expect(vide.coeurs).toBeNull()
    expect(vide.comptes).toBeNull()
  })

  it('retombe sur le plus grand disque si /data disparaît', () => {
    const sansData = analyser(FLUX.replace(/mountpoint="\/data"/g, 'mountpoint="/autre"'))
    // Mieux vaut un chiffre approximatif qu'un tiret si Supabase renomme le
    // point de montage un jour.
    expect(releverCapacite(sansData).disqueTotal).toBe(10_359_754_752)
  })
})


const fmt = { octets }
// Les vraies valeurs du 23 août : 6 connexions sur 60, 386 Mo sur 2,08 Go.
const REEL = releverCapacite(analyser(FLUX))
const POINTES = {
  ecritures_min: 33, ecritures_quand: '2026-06-19T14:34:00+00:00',
  compteurs_max: 2, inventaires_max: 1, minutes_actives: 40, lignes: 207,
}

describe('lecture des plafonds', () => {
  const plafonds = lirePlafonds(REEL, POINTES, fmt)
  const par = (cle: string) => plafonds.find((p) => p.cle === cle)!

  it('rapporte les connexions au plafond de l’instance', () => {
    expect(par('connexions').valeur).toBe('6')
    expect(par('connexions').borne).toBe('60')
    expect(par('connexions').etat).toBe('ok')
  })

  it('mesure le disque utilisé, pas le disque libre', () => {
    // 2 077 073 408 − 1 690 886 144 = 386 187 264 octets.
    expect(par('disque').valeur).toBe(octets(386_187_264))
    expect(par('disque').part).toBeCloseTo(0.186, 2)
    expect(par('disque').etat).toBe('ok')
  })

  it('dit que les 8 Go inclus ne sont pas la taille du disque', () => {
    // C'est le contresens que la facturation invite à faire, et il change
    // complètement la marge qu'on croit avoir.
    expect(par('disque').note).toContain('seuil de prix')
  })

  it('convertit la pointe par minute en écritures par seconde', () => {
    // 33 par minute = 0,55 par seconde, contre ~300 qu'encaisse une Micro.
    expect(par('ecritures').valeur).toBe('0.55 / s')
    expect(par('ecritures').part).toBeCloseTo(33 / 60 / SEUILS.ECRITURES_MICRO_S, 5)
    expect(par('ecritures').etat).toBe('ok')
  })

  it('ne fabrique aucun chiffre pour ce qui n’est pas mesurable', () => {
    // Une estimation posée à côté de mesures réelles se lirait comme une
    // mesure. Les deux lignes de facture restent vides, et le disent.
    for (const cle of ['temps-reel', 'egress']) {
      expect(par(cle).valeur).toBe('—')
      expect(par(cle).part).toBeNull()
      expect(par(cle).etat).toBe('inconnu')
      expect(par(cle).source).toBe('facture')
    }
  })

  it('distingue les trois provenances', () => {
    expect(par('connexions').source).toBe('flux')
    expect(par('ecritures').source).toBe('base')
    expect(par('temps-reel').source).toBe('facture')
  })
})

describe('ce qui appelle un geste', () => {
  it('se tait quand tout a de la marge', () => {
    expect(aSurveiller(lirePlafonds(REEL, POINTES, fmt))).toEqual([])
  })

  it('remonte le plus tendu d’abord', () => {
    const serre = {
      ...REEL,
      connexions: 55,                    // 92 % → agir
      disqueLibre: 500_000_000,          // 76 % → surveiller
    }
    const liste = aSurveiller(lirePlafonds(serre, POINTES, fmt))
    expect(liste.map((p) => p.cle)).toEqual(['connexions', 'disque'])
    expect(liste[0].etat).toBe('agir')
  })

  it('ne compte jamais un plafond non mesuré comme un problème', () => {
    // Sans relevé, tout vaut `inconnu` — pas « à relever ».
    const liste = aSurveiller(lirePlafonds(null, null, fmt))
    expect(liste).toEqual([])
  })

  it('nomme les états sans jargon', () => {
    expect(LIBELLES_ETAT.ok).toBe('De la marge')
    expect(LIBELLES_ETAT.agir).toBe('À relever')
    expect(LIBELLES_ETAT.inconnu).toBe('Non mesuré')
  })
})
