// Génération et téléchargement du rapport d'inventaire.
//
// Portage de src/lib/report.ts (application mobile) : mêmes deux feuilles,
// mêmes colonnes, même forçage des codes en texte. Un rapport téléchargé depuis
// le site et un rapport partagé depuis le téléphone doivent être le même
// fichier. Seule la sortie change : un Blob et un lien de téléchargement au
// lieu du cache de l'application et de la feuille de partage iOS/Android.

// Types seulement : la bibliothèque elle-même est chargée à la demande, au clic.
import type * as XLSXNS from 'xlsx'
import type { SessionDetailRow, SessionResultRow } from '@/lib/inventory'
import { AUDIT_STATUS_LABELS } from '@/lib/inventory'

export type ExportFormat = 'xlsx' | 'csv'

export function reportFilename(inventoryNumber: string, format: ExportFormat, date = new Date()): string {
  return `inventaire_${inventoryNumber}_${date.toISOString().slice(0, 10)}.${format}`
}

/** Feuille « Écarts » : une ligne par article, plus une ligne TOTAL. */
export function buildVarianceRows(rows: SessionResultRow[]): Record<string, string | number>[] {
  const data = rows.map(r => ({
    // Quand sku === ean, le SKU était un repli interne pour un article inconnu
    // identifié par son seul code-barres : on laisse la colonne vide.
    SKU: r.sku === r.ean ? '' : r.sku,
    EAN: r.ean ?? '',
    Marque: r.brand,
    Désignation: r.label,
    'Prix achat unitaire': Number(r.unit_purchase_price),
    'Qté théorique': Number(r.theoretical_qty),
    'Qté comptée': Number(r.counted_qty),
    'Écart (unités)': Number(r.variance_units),
    'Écart (valeur achat)': Number(r.variance_value),
    Statut: AUDIT_STATUS_LABELS[r.status] ?? r.status,
  }))

  data.push({
    SKU: 'TOTAL',
    EAN: '', Marque: '', Désignation: '',
    'Prix achat unitaire': 0, 'Qté théorique': 0, 'Qté comptée': 0,
    'Écart (unités)': rows.reduce((s, r) => s + Number(r.variance_units), 0),
    'Écart (valeur achat)': rows.reduce((s, r) => s + Number(r.variance_value), 0),
    Statut: '',
  })
  return data
}

/** Feuille « Détail par zone » : une ligne par (article, balise), non sommée. */
export function buildDetailRows(detailRows: SessionDetailRow[]): Record<string, string | number>[] {
  return detailRows.map(r => ({
    SKU: r.sku === r.ean ? '' : r.sku,
    EAN: r.ean ?? '',
    Marque: r.brand ?? '',
    Désignation: r.label ?? '',
    Zone: r.zone ?? '',
    'Zone assignée à': r.zone_name ?? '',
    'Qté comptée': Number(r.counted_qty),
    'Compté par': r.counted_by ?? '',
    'Audité ?': r.audited ? 'Oui' : 'Non',
    'Qté auditée': Number(r.audited_qty),
    'Audité par': r.audited_by ?? '',
  }))
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Laisser le navigateur démarrer le téléchargement avant de libérer l'URL.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function downloadXlsx(
  inventoryNumber: string, rows: SessionResultRow[], detailRows: SessionDetailRow[] = [],
): Promise<string> {
  const XLSX = await import('xlsx')

  // Force certaines colonnes en TEXTE pour que les codes ne partent jamais en
  // notation scientifique et gardent leurs zéros de tête.
  const forceTextColumns = (ws: XLSXNS.WorkSheet, cols: number[]) => {
    const range = XLSX.utils.decode_range(ws['!ref']!)
    for (let R = range.s.r + 1; R <= range.e.r; R++) {
      for (const C of cols) {
        const cell = ws[XLSX.utils.encode_cell({ r: R, c: C })]
        if (cell && cell.v != null && cell.v !== '') {
          cell.t = 's'
          cell.v = String(cell.v)
          cell.z = '@'
          delete cell.w
        }
      }
    }
  }

  const wb = XLSX.utils.book_new()

  const ws = XLSX.utils.json_to_sheet(buildVarianceRows(rows))
  ws['!cols'] = [
    { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 30 }, { wch: 16 },
    { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 18 }, { wch: 18 },
  ]
  forceTextColumns(ws, [0, 1])
  XLSX.utils.book_append_sheet(wb, ws, 'Écarts')

  const wsDetail = XLSX.utils.json_to_sheet(buildDetailRows(detailRows))
  wsDetail['!cols'] = [
    { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 30 }, { wch: 10 },
    { wch: 18 }, { wch: 12 }, { wch: 20 }, { wch: 9 }, { wch: 12 }, { wch: 20 },
  ]
  // SKU, EAN et Zone sont des codes numériques : eux aussi en texte.
  forceTextColumns(wsDetail, [0, 1, 4])
  XLSX.utils.book_append_sheet(wb, wsDetail, 'Détail par zone')

  const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
  const filename = reportFilename(inventoryNumber, 'xlsx')
  triggerDownload(
    new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    filename,
  )
  return filename
}

/** Sérialise en CSV point-virgule — la variante qu'Excel français ouvre sans assistant. */
export function toCsv(rows: Record<string, string | number>[]): string {
  if (rows.length === 0) return ''
  const headers = Object.keys(rows[0])
  const escape = (v: string | number) => {
    const s = String(v ?? '')
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const lines = [
    headers.join(';'),
    ...rows.map(r => headers.map(h => escape(r[h])).join(';')),
  ]
  return lines.join('\r\n')
}

export function downloadCsv(inventoryNumber: string, rows: SessionResultRow[]): string {
  const csv = toCsv(buildVarianceRows(rows))
  const filename = reportFilename(inventoryNumber, 'csv')
  // Le BOM évite qu'Excel massacre les accents et empile tout en colonne A.
  triggerDownload(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }), filename)
  return filename
}
