import * as XLSX from 'xlsx'
import { File, Paths } from 'expo-file-system'
import * as Sharing from 'expo-sharing'
import type { SessionResultRow } from '@/lib/queries'

const STATUS_LABELS: Record<string, string> = {
  validated: 'Validé',
  resolved: 'Arbitré',
  failed: 'Écart de comptage',
  pending: 'En attente',
}

export type ExportResult = { shared: boolean; uri: string; filename: string }

export async function exportResultsToExcel(
  inventoryNumber: string,
  rows: SessionResultRow[]
): Promise<ExportResult> {
  const data = rows.map((r) => ({
    SKU: r.sku,
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
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Écarts')

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
