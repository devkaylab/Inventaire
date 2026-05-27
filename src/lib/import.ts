import * as DocumentPicker from 'expo-document-picker'
import { File } from 'expo-file-system'
import Papa from 'papaparse'
import * as XLSX from 'xlsx'

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

export interface ImportResult<T> {
  rows: T[]
  errors: string[]
}

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

async function readFileAsString(uri: string): Promise<string> {
  return new File(uri).text()
}

async function readFileAsBase64(uri: string): Promise<string> {
  return new File(uri).base64()
}

function isXlsx(name: string) {
  return name.toLowerCase().endsWith('.xlsx') || name.toLowerCase().endsWith('.xls')
}

function parseSheetRows(name: string, rows: Record<string, unknown>[]): string[] {
  return [`Lecture de ${rows.length} lignes depuis ${name}`]
}

export async function parseCatalogFile(uri: string, name: string): Promise<ImportResult<CatalogRow>> {
  const rows: CatalogRow[] = []
  const errors: string[] = []

  try {
    let rawRows: Record<string, unknown>[]

    if (isXlsx(name)) {
      const base64 = await readFileAsBase64(uri)
      const workbook = XLSX.read(base64, { type: 'base64' })
      const sheet = workbook.Sheets[workbook.SheetNames[0]]
      rawRows = XLSX.utils.sheet_to_json(sheet, { defval: '' }) as Record<string, unknown>[]
    } else {
      const content = await readFileAsString(uri)
      const result = Papa.parse<Record<string, unknown>>(content, {
        header: true,
        skipEmptyLines: true,
        transformHeader: h => h.trim().toLowerCase(),
      })
      rawRows = result.data
    }

    for (let i = 0; i < rawRows.length; i++) {
      const r = rawRows[i]
      const sku = String(r['sku'] ?? r['SKU'] ?? r['Sku'] ?? '').trim()
      if (!sku) {
        errors.push(`Ligne ${i + 2}: SKU manquant — ligne ignorée`)
        continue
      }
      const price = parseFloat(String(r['unit_purchase_price'] ?? r['prix'] ?? r['price'] ?? r['prix_achat'] ?? '0'))
      rows.push({
        sku,
        ean: String(r['ean'] ?? r['EAN'] ?? r['Ean'] ?? '').trim() || undefined,
        brand: String(r['brand'] ?? r['marque'] ?? r['Brand'] ?? '').trim() || undefined,
        label: String(r['label'] ?? r['libelle'] ?? r['designation'] ?? r['Label'] ?? '').trim() || undefined,
        unit_purchase_price: isNaN(price) ? 0 : price,
      })
    }
  } catch (e: unknown) {
    errors.push(`Erreur de lecture: ${e instanceof Error ? e.message : String(e)}`)
  }

  return { rows, errors }
}

export async function parseStockFile(uri: string, name: string): Promise<ImportResult<StockRow>> {
  const rows: StockRow[] = []
  const errors: string[] = []

  try {
    let rawRows: Record<string, unknown>[]

    if (isXlsx(name)) {
      const base64 = await readFileAsBase64(uri)
      const workbook = XLSX.read(base64, { type: 'base64' })
      const sheet = workbook.Sheets[workbook.SheetNames[0]]
      rawRows = XLSX.utils.sheet_to_json(sheet, { defval: '' }) as Record<string, unknown>[]
    } else {
      const content = await readFileAsString(uri)
      const result = Papa.parse<Record<string, unknown>>(content, {
        header: true,
        skipEmptyLines: true,
        transformHeader: h => h.trim().toLowerCase(),
      })
      rawRows = result.data
    }

    for (let i = 0; i < rawRows.length; i++) {
      const r = rawRows[i]
      const sku = String(r['sku'] ?? r['SKU'] ?? r['Sku'] ?? '').trim()
      if (!sku) {
        errors.push(`Ligne ${i + 2}: SKU manquant — ligne ignorée`)
        continue
      }
      const qty = parseFloat(String(r['theoretical_qty'] ?? r['qte_theorique'] ?? r['quantite'] ?? r['qty'] ?? r['stock'] ?? '0'))
      rows.push({ sku, theoretical_qty: isNaN(qty) ? 0 : qty })
    }
  } catch (e: unknown) {
    errors.push(`Erreur de lecture: ${e instanceof Error ? e.message : String(e)}`)
  }

  return { rows, errors }
}
