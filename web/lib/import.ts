// Import des fichiers d'inventaire : référentiel articles et stock théorique.
//
// Portage de src/lib/import.ts (application mobile). La lecture des en-têtes, la
// coercition des cellules, la déduplication et l'envoi par lots sont repris à
// l'identique — c'est ce qui garantit qu'un même fichier donne le même résultat
// sur le site et sur le téléphone. Seules les entrées/sorties changent :
// `expo-document-picker` / `expo-file-system` cèdent la place au `File` du
// navigateur.

import Papa from 'papaparse'
import { supabase } from '@/lib/supabaseClient'
import { errorMessage } from '@/lib/errors'

export type ImportProgress = { parsed: number; uploaded: number; total: number }
export type ImportResult = { uploaded: number; errors: string[] }

type ArticleInsert = {
  session_id: string
  sku: string
  ean: string | null
  brand: string
  label: string
  unit_purchase_price: number
}

type StockInsert = { session_id: string; sku: string; theoretical_qty: number }

const BATCH_SIZE = 1000   // lignes par requête (~100-200 Ko)
const CONCURRENCY = 6     // requêtes simultanées

export const ACCEPTED_EXTENSIONS = '.csv,.xlsx,.xls'

export function isSpreadsheet(name: string): boolean {
  return /\.(xlsx|xls)$/i.test(name)
}

// ── Envoi par lots, parallélisme borné ───────────────────────────────────────
async function uploadBatches<T>(
  items: T[],
  uploadFn: (batch: T[]) => Promise<void>,
  onProgress?: (uploaded: number) => void,
): Promise<void> {
  const batches: T[][] = []
  for (let i = 0; i < items.length; i += BATCH_SIZE) batches.push(items.slice(i, i + BATCH_SIZE))

  let uploaded = 0
  let cursor = 0
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, batches.length) }, async () => {
      while (cursor < batches.length) {
        const batch = batches[cursor++]
        await uploadFn(batch)
        uploaded += batch.length
        onProgress?.(uploaded)
      }
    }),
  )
}

/**
 * Normalise un en-tête pour que la comparaison ignore casse, accents et
 * séparateurs : « Prix d'achat », « PRIX D'ACHAT » et « prix d achat »
 * deviennent tous `prixdachat`.
 */
export function normalizeHeader(h: string): string {
  return h
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // marques diacritiques combinantes
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

/**
 * Transforme une cellule en code propre. Excel stocke souvent les SKU et EAN
 * comme des nombres : on évite la notation scientifique et le « .0 » final.
 * Un zéro de tête perdu par une cellule numérique est irrécupérable ici — d'où
 * le conseil, dans l'interface, de formater ces colonnes en Texte.
 */
export function cellToCode(v: unknown): string {
  if (v == null) return ''
  if (typeof v === 'number') return Number.isInteger(v) ? v.toFixed(0) : String(v)
  return String(v).trim()
}

export const SKU_KEYS = ['sku', 'codearticle', 'reference', 'ref', 'codeart']
// « codeean » : vu en vrai le 25 août 2026 — un fichier client portait la
// colonne « Code Ean », inconnue ici. Tous les EAN sortaient nuls, et les
// lignes au même SKU s'écrasaient au lieu d'être gardées sous leur EAN.
export const EAN_KEYS = ['ean', 'ean13', 'gtin', 'gtin13', 'codeean', 'codeean13', 'codebarre', 'codebarres', 'gencod', 'gencode', 'barcode']
const BRAND_KEYS = ['brand', 'marque', 'fournisseur']
const LABEL_KEYS = ['label', 'libelle', 'designation', 'description', 'nom']
const PRICE_KEYS = ['prixdachat', 'cost', 'cogs', 'cout', 'pa']
const QTY_KEYS = ['theoreticalqty', 'qtetheorique', 'quantitetheorique', 'quantite', 'qty', 'qte', 'stock', 'quantity']

export function pickCode(r: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const code = cellToCode(r[k])
    if (code) return code
  }
  return ''
}

function pickText(r: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const v = r[k]
    if (v != null && String(v).trim() !== '') return String(v).trim()
  }
  return ''
}

function pickNumber(r: Record<string, unknown>, keys: string[]): number {
  for (const k of keys) {
    if (r[k] == null || r[k] === '') continue
    // Les exports français écrivent « 12,50 ».
    const n = parseFloat(String(r[k]).replace(',', '.'))
    if (!isNaN(n)) return n
  }
  return 0
}

// ── Lecture des fichiers ─────────────────────────────────────────────────────

async function xlsxToRawRows(file: File): Promise<Record<string, unknown>[]> {
  // Import différé : la bibliothèque pèse ~900 Ko et n'a aucune raison
  // d'alourdir le premier chargement du tableau de bord.
  const XLSX = await import('xlsx')
  const bytes = new Uint8Array(await file.arrayBuffer())
  const workbook = XLSX.read(bytes, {
    type: 'array', cellStyles: false, cellNF: false, cellDates: false, sheetStubs: false,
  })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: true }) as Record<string, unknown>[]
  return rows.map((row) => {
    const normalized: Record<string, unknown> = {}
    for (const key of Object.keys(row)) normalized[normalizeHeader(key)] = row[key]
    return normalized
  })
}

function csvToRawRows(file: File): Promise<Record<string, unknown>[]> {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, unknown>>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: normalizeHeader,
      complete: r => resolve(r.data),
      error: reject,
    })
  })
}

async function readRows(file: File): Promise<Record<string, unknown>[]> {
  return isSpreadsheet(file.name) ? xlsxToRawRows(file) : csvToRawRows(file)
}

// ── Référentiel articles ─────────────────────────────────────────────────────

/**
 * Mappe des lignes brutes vers des articles. Pur, donc testable.
 *
 * Aucune ligne portant un EAN ne doit disparaître en silence : un EAN perdu à
 * l'import ressort « article inconnu » au scan alors qu'il est bien dans le
 * fichier. Deux cas concrets (référentiels bijouterie/horlogerie, un EAN par
 * pièce) :
 * - ligne sans SKU mais avec EAN → l'EAN sert de clé, comme au scan d'un
 *   article inconnu (le rapport masque déjà le SKU quand sku === ean) ;
 * - même SKU sur plusieurs lignes avec des EAN différents → chaque ligne
 *   supplémentaire est importée comme article à part, sous son EAN, au lieu
 *   d'écraser l'EAN précédent (contrainte UNIQUE (session_id, sku) oblige).
 */
export function mapCatalogRows(rawRows: Record<string, unknown>[], sessionId: string): {
  articles: ArticleInsert[]; errors: string[]; skipped: number
} {
  const errors: string[] = []
  const byS = new Map<string, ArticleInsert>()
  let skipped = 0
  let keptByEan = 0

  for (let i = 0; i < rawRows.length; i++) {
    const r = rawRows[i]
    const ean = pickCode(r, EAN_KEYS) || null
    const sku = pickCode(r, SKU_KEYS) || ean
    if (!sku) {
      skipped++
      if (errors.length < 10) errors.push(`Ligne ${i + 2} : ni SKU ni EAN — ignorée`)
      continue
    }
    const article: ArticleInsert = {
      session_id: sessionId,
      sku,
      ean,
      brand: pickText(r, BRAND_KEYS),
      label: pickText(r, LABEL_KEYS),
      unit_purchase_price: pickNumber(r, PRICE_KEYS),
    }
    const already = byS.get(sku)
    if (already?.ean && ean && already.ean !== ean) {
      byS.set(ean, { ...article, sku: ean })
      keptByEan++
      continue
    }
    // Doublon de SKU : la dernière ligne l'emporte, sans perdre un EAN déjà vu
    // si la nouvelle ligne n'en porte pas.
    byS.set(sku, already?.ean && !ean ? { ...article, ean: already.ean } : article)
  }

  const articles = [...byS.values()]
  if (keptByEan > 0) {
    errors.push(`${keptByEan} ligne(s) au même SKU avec un EAN différent — conservée(s) séparément sous leur EAN`)
  }
  const dupes = rawRows.length - skipped - articles.length
  if (dupes > 0) errors.push(`${dupes} SKU en double dans le fichier — dernière valeur conservée`)
  return { articles, errors, skipped }
}

export async function importCatalogFile(
  file: File, sessionId: string, onProgress?: (p: ImportProgress) => void,
): Promise<ImportResult> {
  const rawRows = await readRows(file)
  const total = rawRows.length
  const { articles, errors } = mapCatalogRows(rawRows, sessionId)

  onProgress?.({ parsed: total, uploaded: 0, total: articles.length })

  // Remplacement complet : un simple upsert laisserait les SKU d'un import
  // précédent qui ne sont plus dans le fichier.
  // ⚠️ LE VIDAGE PASSE PAR UNE RPC, JAMAIS PAR UN DELETE POSTGREST.
  // Un remplacement doit vider d'abord : un simple upsert laisserait les SKU
  // d'un import précédent qui ne sont plus dans le fichier. Mais la policy
  // `articles_supervisor` porte `is_session_participant(session_id)`, qui prend la colonne
  // de la LIGNE — Postgres l'évalue une fois par ligne. Sur 29 382 articles le
  // DELETE dépassait le délai serveur (3 septembre 2026), et PostgREST rendait
  // une erreur SANS TEXTE que l'écran affichait telle quelle.
  // `vider_import` contrôle le droit une fois puis supprime hors RLS : 57 ms.
  const { error: deleteError } = await supabase.rpc('vider_import', {
    p_session_id: sessionId, p_cible: 'articles',
  })
  if (deleteError) {
    console.error('[import] vider_import articles', deleteError)
    throw new Error(errorMessage(deleteError))
  }

  await uploadBatches(articles, async (batch) => {
    const { error } = await supabase.from('articles').insert(batch)
    if (error) {
      console.error('[import] insert articles', error)
      throw new Error(errorMessage(error))
    }
  }, uploaded => onProgress?.({ parsed: total, uploaded, total: articles.length }))

  return { uploaded: articles.length, errors }
}

// ── Stock théorique ──────────────────────────────────────────────────────────

/** Agrège les quantités par SKU (un article peut occuper plusieurs emplacements). */
export function mapStockRows(rawRows: Record<string, unknown>[], sessionId: string): {
  rows: StockInsert[]; errors: string[]; skipped: number
} {
  const errors: string[] = []
  const byS = new Map<string, number>()
  let skipped = 0

  for (let i = 0; i < rawRows.length; i++) {
    const r = rawRows[i]
    const sku = pickCode(r, SKU_KEYS)
    if (!sku) {
      skipped++
      if (errors.length < 10) errors.push(`Ligne ${i + 2} : SKU manquant — ignorée`)
      continue
    }
    byS.set(sku, (byS.get(sku) ?? 0) + pickNumber(r, QTY_KEYS))
  }

  const rows = [...byS.entries()].map(([sku, theoretical_qty]) => ({ session_id: sessionId, sku, theoretical_qty }))
  const locations = rawRows.length - skipped
  if (locations > rows.length) {
    errors.push(`${locations - rows.length} lignes multi-emplacements agrégées — quantités sommées par SKU`)
  }
  return { rows, errors, skipped }
}

export async function importStockFile(
  file: File, sessionId: string, onProgress?: (p: ImportProgress) => void,
): Promise<ImportResult> {
  const rawRows = await readRows(file)
  const total = rawRows.length
  const { rows, errors } = mapStockRows(rawRows, sessionId)

  onProgress?.({ parsed: total, uploaded: 0, total: rows.length })

  // ⚠️ LE VIDAGE PASSE PAR UNE RPC, JAMAIS PAR UN DELETE POSTGREST.
  // Un remplacement doit vider d'abord : un simple upsert laisserait les SKU
  // d'un import précédent qui ne sont plus dans le fichier. Mais la policy
  // `theoretical_stock_supervisor` porte `is_session_participant(session_id)`, qui prend la colonne
  // de la LIGNE — Postgres l'évalue une fois par ligne. Sur 29 382 articles le
  // DELETE dépassait le délai serveur (3 septembre 2026), et PostgREST rendait
  // une erreur SANS TEXTE que l'écran affichait telle quelle.
  // `vider_import` contrôle le droit une fois puis supprime hors RLS : 57 ms.
  const { error: deleteError } = await supabase.rpc('vider_import', {
    p_session_id: sessionId, p_cible: 'stock',
  })
  if (deleteError) {
    console.error('[import] vider_import stock', deleteError)
    throw new Error(errorMessage(deleteError))
  }

  await uploadBatches(rows, async (batch) => {
    const { error } = await supabase.from('theoretical_stock').insert(batch)
    if (error) {
      console.error('[import] insert theoretical_stock', error)
      throw new Error(errorMessage(error))
    }
  }, uploaded => onProgress?.({ parsed: total, uploaded, total: rows.length }))

  return { uploaded: rows.length, errors }
}
