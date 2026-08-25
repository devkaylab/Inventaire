import * as DocumentPicker from 'expo-document-picker'
import { File } from 'expo-file-system'
import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import { supabase } from './supabase'
import type { TablesInsert } from '@/types/database.types'
import { errorMessage } from './errors'

export interface CatalogRow {
  sku: string
  ean?: string
  brand?: string
  label?: string
  unit_purchase_price?: number
}

export interface StockRow {
  sku: string
  theoretical_qty: number
}

export interface ImportProgress {
  parsed: number
  uploaded: number
  total: number
}

export interface ImportResult {
  uploaded: number
  errors: string[]
}

// ─── Config ──────────────────────────────────────────────────────────────────
const BATCH_SIZE = 1000       // rows per Supabase request (~100-200 KB payload)
const CONCURRENCY = 6         // parallel requests in flight at once

// XLSX: skip everything we don't need
const XLSX_READ_OPTS: XLSX.ParsingOptions = {
  type: 'array',
  cellStyles: false,
  cellNF: false,
  cellDates: false,
  sheetStubs: false,
  dense: false,
  WTF: false,
}

// ─── File picker ─────────────────────────────────────────────────────────────
export async function pickFile(): Promise<{ uri: string; name: string } | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: [
      'text/csv',
      'text/comma-separated-values',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ],
    copyToCacheDirectory: true,
  })
  if (result.canceled) return null
  const asset = result.assets[0]
  return { uri: asset.uri, name: asset.name }
}

function isXlsx(name: string) {
  return name.toLowerCase().endsWith('.xlsx') || name.toLowerCase().endsWith('.xls')
}

// ─── Concurrency-limited batch uploader ───────────────────────────────────────
async function uploadBatches<T>(
  items: T[],
  uploadFn: (batch: T[]) => Promise<void>,
  onProgress?: (uploaded: number) => void,
): Promise<void> {
  const batches: T[][] = []
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    batches.push(items.slice(i, i + BATCH_SIZE))
  }

  let uploaded = 0
  let cursor = 0

  // Spin up CONCURRENCY workers — each grabs the next batch until done
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, batches.length) }, async () => {
      while (cursor < batches.length) {
        const batch = batches[cursor++]
        await uploadFn(batch)
        uploaded += batch.length
        onProgress?.(uploaded)
      }
    })
  )
}

// Normalize a header so matching ignores case, accents, and any separators
// (spaces, hyphens, underscores, apostrophes, dots): "Prix d'achat",
// "PRIX D'ACHAT" and "prix d achat" all become "prixdachat"; "Code-barres",
// "Code barres" and "code_barres" all become "codebarres".
function normalizeHeader(h: string): string {
  return h
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip diacritics
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')        // keep only letters & digits (drops spaces, -, _, ', dots…)
}

// Turn a spreadsheet cell into a clean code string. Numeric cells (Excel often
// stores SKUs/EANs as numbers) become plain integer digits — no scientific
// notation, no trailing ".0". Leading zeros lost to a numeric cell can't be
// recovered here; format the column as Text in the source file to keep them.
function cellToCode(v: unknown): string {
  if (v == null) return ''
  if (typeof v === 'number') {
    return Number.isInteger(v) ? v.toFixed(0) : String(v)
  }
  return String(v).trim()
}

// Header aliases (already normalized) for the catalog's identifying columns.
const SKU_KEYS = ['sku', 'codearticle', 'reference', 'ref', 'codeart']
// « codeean » : vu en vrai le 25 août 2026 — un fichier client portait la
// colonne « Code Ean », inconnue ici. Tous les EAN sortaient nuls, et les
// lignes au même SKU s'écrasaient au lieu d'être gardées sous leur EAN.
const EAN_KEYS = ['ean', 'ean13', 'gtin', 'gtin13', 'codeean', 'codeean13', 'codebarre', 'codebarres', 'gencod', 'gencode', 'barcode']

function pickCode(r: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const code = cellToCode(r[k])
    if (code) return code
  }
  return ''
}

// ─── XLSX → raw rows ──────────────────────────────────────────────────────────
async function xlsxToRawRows(uri: string): Promise<Record<string, unknown>[]> {
  const bytes = await new File(uri).bytes()
  const workbook = XLSX.read(bytes, XLSX_READ_OPTS)
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: true }) as Record<string, unknown>[]
  // Normalize all header keys, same as PapaParse does for CSV
  return rows.map(row => {
    const normalized: Record<string, unknown> = {}
    for (const key of Object.keys(row)) {
      normalized[normalizeHeader(key)] = row[key]
    }
    return normalized
  })
}

// ─── CSV → raw rows (streamed in chunks) ──────────────────────────────────────
function csvToRawRows(content: string): Promise<Record<string, unknown>[]> {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, unknown>>(content, {
      header: true,
      skipEmptyLines: true,
      transformHeader: normalizeHeader,
      complete: (r) => resolve(r.data),
      error: reject,
    })
  })
}

// ─── Catalog import ───────────────────────────────────────────────────────────
export async function importCatalogFile(
  uri: string,
  name: string,
  sessionId: string,
  onProgress?: (p: ImportProgress) => void,
): Promise<ImportResult> {
  const errors: string[] = []

  // 1. Parse
  const rawRows = isXlsx(name) ? await xlsxToRawRows(uri) : await csvToRawRows(await new File(uri).text())
  const total = rawRows.length

  // 2. Validate, map & deduplicate (last row wins for duplicate SKUs).
  // Aucune ligne portant un EAN ne doit disparaître en silence — un EAN perdu
  // ici ressort « article inconnu » au scan alors qu'il est dans le fichier.
  // Mêmes règles que web/lib/import.ts (mapCatalogRows), à garder synchrones :
  // - ligne sans SKU mais avec EAN → l'EAN sert de clé, comme au scan d'un
  //   article inconnu (le rapport masque déjà le SKU quand sku === ean) ;
  // - même SKU avec des EAN différents → chaque ligne supplémentaire devient un
  //   article à part, sous son EAN (contrainte UNIQUE (session_id, sku) oblige).
  const articleMap = new Map<string, TablesInsert<'articles'>>()
  let skipped = 0
  let keptByEan = 0
  for (let i = 0; i < rawRows.length; i++) {
    const r = rawRows[i]
    const ean = pickCode(r, EAN_KEYS) || null
    const sku = pickCode(r, SKU_KEYS) || ean
    if (!sku) {
      skipped++
      if (errors.length < 10) errors.push(`Ligne ${i + 2}: ni SKU ni EAN — ignorée`)
      continue
    }
    // Colonne prix d'achat optionnelle — en-têtes normalisés (sans séparateurs).
    const price = parseFloat(String(r['prixdachat'] ?? r['cost'] ?? r['cogs'] ?? r['cout'] ?? r['pa'] ?? '0'))
    const article: TablesInsert<'articles'> = {
      session_id: sessionId,
      sku,
      ean,
      brand: String(r['brand'] ?? r['marque'] ?? r['fournisseur'] ?? '').trim() || '',
      label: String(r['label'] ?? r['libelle'] ?? r['designation'] ?? r['description'] ?? r['nom'] ?? '').trim() || '',
      unit_purchase_price: isNaN(price) ? 0 : price,
    }
    const already = articleMap.get(sku)
    if (already?.ean && ean && already.ean !== ean) {
      articleMap.set(ean, { ...article, sku: ean })
      keptByEan++
      continue
    }
    // Doublon de SKU : la dernière ligne l'emporte, sans perdre un EAN déjà vu
    // si la nouvelle ligne n'en porte pas.
    articleMap.set(sku, already?.ean && !ean ? { ...article, ean: already.ean } : article)
  }
  const articles = Array.from(articleMap.values())
  if (keptByEan > 0) {
    errors.push(`${keptByEan} ligne(s) au même SKU avec un EAN différent — conservée(s) séparément sous leur EAN`)
  }
  const dupes = total - skipped - articles.length
  if (dupes > 0) errors.push(`${dupes} SKU(s) en double dans le fichier — dernière valeur conservée`)

  onProgress?.({ parsed: total, uploaded: 0, total: articles.length })

  // 3. Delete existing articles for this session then re-insert fresh
  const { error: deleteError } = await supabase
    .from('articles')
    .delete()
    .eq('session_id', sessionId)
  if (deleteError) {
    console.error('[import] delete articles', deleteError)
    throw new Error(errorMessage(deleteError))
  }

  // 4. Upload in concurrent batches
  await uploadBatches(
    articles,
    async (batch) => {
      const { error } = await supabase
        .from('articles')
        .insert(batch)
      if (error) {
        console.error('[import] insert articles', error)
        throw new Error(errorMessage(error))
      }
    },
    (uploaded) => onProgress?.({ parsed: total, uploaded, total }),
  )

  return { uploaded: articles.length, errors }
}

// ─── Stock import ─────────────────────────────────────────────────────────────
export async function importStockFile(
  uri: string,
  name: string,
  sessionId: string,
  onProgress?: (p: ImportProgress) => void,
): Promise<ImportResult> {
  const errors: string[] = []

  // 1. Parse
  const rawRows = isXlsx(name) ? await xlsxToRawRows(uri) : await csvToRawRows(await new File(uri).text())
  const total = rawRows.length

  // 2. Validate & aggregate — sum qty across all locations for the same SKU
  const stockMap = new Map<string, number>()
  let skipped = 0
  for (let i = 0; i < rawRows.length; i++) {
    const r = rawRows[i]
    const sku = pickCode(r, SKU_KEYS)
    if (!sku) {
      skipped++
      if (errors.length < 10) errors.push(`Ligne ${i + 2}: SKU manquant — ignorée`)
      continue
    }
    const qty = parseFloat(String(r['theoreticalqty'] ?? r['qtetheorique'] ?? r['quantitetheorique'] ?? r['quantite'] ?? r['qty'] ?? r['qte'] ?? r['stock'] ?? r['quantity'] ?? '0'))
    stockMap.set(sku, (stockMap.get(sku) ?? 0) + (isNaN(qty) ? 0 : qty))
  }
  const payload: TablesInsert<'theoretical_stock'>[] = Array.from(stockMap.entries()).map(
    ([sku, theoretical_qty]) => ({ session_id: sessionId, sku, theoretical_qty })
  )
  const locations = total - skipped
  const uniqueSkus = payload.length
  if (locations > uniqueSkus) errors.push(
    `${locations - uniqueSkus} ligne(s) multi-emplacements agrégées — quantités sommées par SKU`
  )

  onProgress?.({ parsed: total, uploaded: 0, total: payload.length })

  // 3. Delete existing stock for this session, then insert fresh
  //    (upsert alone would leave stale SKUs from a previous upload)
  const { error: deleteError } = await supabase
    .from('theoretical_stock')
    .delete()
    .eq('session_id', sessionId)
  if (deleteError) {
    console.error('[import] delete theoretical_stock', deleteError)
    throw new Error(errorMessage(deleteError))
  }

  await uploadBatches(
    payload,
    async (batch) => {
      const { error } = await supabase
        .from('theoretical_stock')
        .insert(batch)
      if (error) {
        console.error('[import] insert theoretical_stock', error)
        throw new Error(errorMessage(error))
      }
    },
    (uploaded) => onProgress?.({ parsed: total, uploaded, total: payload.length }),
  )

  return { uploaded: payload.length, errors }
}
