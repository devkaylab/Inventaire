import * as XLSX from 'xlsx'
import { File, Paths } from 'expo-file-system'
import * as Sharing from 'expo-sharing'
import type { SessionResultRow, SessionDetailRow } from '@/lib/queries'

// À garder identique à `AUDIT_STATUS_LABELS` du site (web/lib/inventory.ts).
// `uncounted` désigne un article attendu au stock théorique et jamais scanné :
// il n'a pas de ligne d'audit, donc pas de statut d'audit.
const STATUS_LABELS: Record<string, string> = {
  validated: 'Validé',
  resolved: 'Arbitré',
  failed: 'Écart de comptage',
  pending: 'En attente',
  uncounted: 'Non compté',
}

export type ExportResult = { shared: boolean; uri: string; filename: string }

// Force given columns (by index) to TEXT so codes never render as numbers
// (no scientific notation, leading zeros kept, uniform format).
function forceTextColumns(ws: XLSX.WorkSheet, cols: number[]) {
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

export async function exportResultsToExcel(
  inventoryNumber: string,
  rows: SessionResultRow[],
  detailRows: SessionDetailRow[] = []
): Promise<ExportResult> {
  const wb = XLSX.utils.book_new()

  // ── Onglet « Écarts » — résumé par article (théorique / écart / démarque) ──
  const data = rows.map((r) => ({
    // When sku === ean the SKU was an internal fallback for an EAN-only unknown
    // article → leave the SKU column empty (the code shows in EAN only).
    SKU: r.sku === r.ean ? '' : r.sku,
    EAN: r.ean ?? '',
    Marque: r.brand,
    Désignation: r.label,
    'Prix achat unitaire': Number(r.unit_purchase_price),
    'Qté théorique': Number(r.theoretical_qty),
    'Qté comptée': Number(r.counted_qty),
    'Écart (unités)': Number(r.variance_units),
    'Écart (valeur achat)': Number(r.variance_value),
    Statut: STATUS_LABELS[r.status] ?? r.status,
  }))

  const totalVarianceValue = rows.reduce((s, r) => s + Number(r.variance_value), 0)
  const totalVarianceUnits = rows.reduce((s, r) => s + Number(r.variance_units), 0)
  data.push({
    SKU: 'TOTAL',
    EAN: '',
    Marque: '',
    Désignation: '',
    'Prix achat unitaire': 0,
    'Qté théorique': 0,
    'Qté comptée': 0,
    'Écart (unités)': totalVarianceUnits,
    'Écart (valeur achat)': totalVarianceValue,
    Statut: '',
  })

  const ws = XLSX.utils.json_to_sheet(data)
  ws['!cols'] = [
    { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 30 }, { wch: 16 },
    { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 18 }, { wch: 18 },
  ]
  forceTextColumns(ws, [0, 1])
  XLSX.utils.book_append_sheet(wb, ws, 'Écarts')

  // ── Onglet « Détail par zone » — une ligne par (article, balise), non sommé ──
  const detail = detailRows.map((r) => ({
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
  const wsDetail = XLSX.utils.json_to_sheet(detail)
  wsDetail['!cols'] = [
    { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 30 }, { wch: 10 },
    { wch: 18 }, { wch: 12 }, { wch: 20 }, { wch: 9 }, { wch: 12 }, { wch: 20 },
  ]
  // SKU (0), EAN (1) et Zone (4) forcés en texte (codes numériques).
  forceTextColumns(wsDetail, [0, 1, 4])
  XLSX.utils.book_append_sheet(wb, wsDetail, 'Détail par zone')

  const b64 = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' })
  const filename = `inventaire_${inventoryNumber}_${new Date().toISOString().slice(0, 10)}.xlsx`
  const file = new File(Paths.cache, filename)
  if (file.exists) file.delete()
  file.create()
  file.write(b64, { encoding: 'base64' })

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, {
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      dialogTitle: "Rapport d'inventaire",
      UTI: 'org.openxmlformats.spreadsheetml.sheet',
    })
    return { shared: true, uri: file.uri, filename }
  }
  return { shared: false, uri: file.uri, filename }
}
