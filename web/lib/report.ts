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
import type { LigneDetailMagasin, LigneRapportMagasin } from '@/lib/rapportMagasin'

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

/**
 * Force certaines colonnes en TEXTE pour que les codes ne partent jamais en
 * notation scientifique et gardent leurs zéros de tête.
 *
 * Sortie de `downloadXlsx` le 4 septembre 2026 : le rapport d'un magasin a les
 * mêmes colonnes de codes, et deux copies de cette boucle divergeraient le
 * jour où l'une gagnerait une colonne.
 */
function forcerEnTexte(XLSX: typeof XLSXNS, ws: XLSXNS.WorkSheet, cols: number[]): void {
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

export async function downloadXlsx(
  inventoryNumber: string, rows: SessionResultRow[], detailRows: SessionDetailRow[] = [],
): Promise<string> {
  const XLSX = await import('xlsx')
  const wb = XLSX.utils.book_new()

  const ws = XLSX.utils.json_to_sheet(buildVarianceRows(rows))
  ws['!cols'] = [
    { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 30 }, { wch: 16 },
    { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 18 }, { wch: 18 },
  ]
  forcerEnTexte(XLSX, ws, [0, 1])
  XLSX.utils.book_append_sheet(wb, ws, 'Écarts')

  const wsDetail = XLSX.utils.json_to_sheet(buildDetailRows(detailRows))
  wsDetail['!cols'] = [
    { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 30 }, { wch: 10 },
    { wch: 18 }, { wch: 12 }, { wch: 20 }, { wch: 9 }, { wch: 12 }, { wch: 20 },
  ]
  // SKU, EAN et Zone sont des codes numériques : eux aussi en texte.
  forcerEnTexte(XLSX, wsDetail, [0, 1, 4])
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
/**
 * Neutralise une cellule qu'un tableur exécuterait comme une formule.
 *
 * ⚠️ POURQUOI. Excel et LibreOffice évaluent toute cellule dont le premier
 * caractère est `=`, `+`, `-` ou `@` — et le tabulateur ou le retour chariot
 * suffisent à décaler le contenu vers l'un d'eux. Or les libellés, marques et
 * SKU de ce rapport viennent du **fichier fournisseur importé**, que Quantinvo
 * ne contrôle pas : un libellé forgé devient une commande qui s'exécute sur le
 * poste de la personne qui ouvre le rapport.
 *
 * L'apostrophe de tête est la parade retenue par l'OWASP : le tableur affiche
 * le texte au lieu de l'évaluer. Elle se voit dans la cellule — c'est le prix,
 * et il ne se paie que sur les valeurs qui commençaient par l'un de ces
 * caractères.
 *
 * ⚠️ **Les nombres ne passent jamais par ici** (voir `echapper`) : un écart de
 * −650 est un nombre, pas une chaîne, et le préfixer en ferait du texte —
 * impossible à sommer dans le tableur, sur la colonne même que le rapport
 * existe pour montrer. C'est le piège classique de ce correctif.
 *
 * L'export XLSX n'est pas concerné : SheetJS écrit ces valeurs en cellules de
 * type `s` (chaîne), jamais `f` (formule). Vérifié à la source.
 */
export function neutraliserFormule(valeur: string): string {
  return /^[=+\-@\t\r]/.test(valeur) ? `'${valeur}` : valeur
}

export function toCsv(rows: Record<string, string | number>[]): string {
  if (rows.length === 0) return ''
  const headers = Object.keys(rows[0])
  const echapper = (v: string | number) => {
    // Un nombre reste un nombre : il n'y a rien à neutraliser, et le figer en
    // texte casserait les totaux du tableur.
    const s = typeof v === 'number' ? String(v) : neutraliserFormule(String(v ?? ''))
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const lines = [
    headers.map(echapper).join(';'),
    ...rows.map(r => headers.map(h => echapper(r[h])).join(';')),
  ]
  return lines.join('\r\n')
}

function downloadCsvBlob(csv: string, filename: string): void {
  // Le BOM évite qu'Excel massacre les accents et empile tout en colonne A.
  triggerDownload(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }), filename)
}

/**
 * Export CSV, aligné sur l'Excel.
 *
 * L'Excel porte deux feuilles ; le CSV n'a pas de feuilles. La version
 * précédente n'exportait donc que les écarts, et le détail par balise
 * disparaissait silencieusement — avec lui « Compté par » et « Audité par »,
 * précisément ce qu'on vient chercher dans un CSV pour retrouver qui a compté
 * quoi.
 *
 * On sort les deux tableaux en deux fichiers, avec exactement les colonnes de
 * l'Excel. Un suffixe explicite dans le nom, pour qu'ils ne se confondent pas
 * dans le dossier de téléchargement.
 *
 * Deux téléchargements enchaînés : les navigateurs demandent parfois
 * confirmation pour le second. C'est visible, contrairement à une donnée
 * manquante — et l'écran de choix du format annonce les deux fichiers.
 */
export function downloadCsv(
  inventoryNumber: string, rows: SessionResultRow[], detailRows: SessionDetailRow[] = [],
): string[] {
  const base = reportFilename(inventoryNumber, 'csv').replace(/\.csv$/, '')
  const names: string[] = []

  const variance = `${base}_ecarts.csv`
  downloadCsvBlob(toCsv(buildVarianceRows(rows)), variance)
  names.push(variance)

  if (detailRows.length > 0) {
    const detail = `${base}_detail_par_zone.csv`
    // Laisser le premier téléchargement démarrer avant de lancer le second.
    setTimeout(() => downloadCsvBlob(toCsv(buildDetailRows(detailRows)), detail), 600)
    names.push(detail)
  }
  return names
}

// ── Le rapport consolidé d'un magasin ────────────────────────────────────────
//
// Mêmes colonnes que le rapport d'un inventaire, à trois différences près, et
// chacune vient d'une décision :
//
// ⚠️ PAS DE COLONNE « PRIX ACHAT UNITAIRE ». Le prix est porté PAR
// INVENTAIRE : le même SKU peut valoir 41 € en septembre et 38 € en août. Une
// seule colonne obligerait à en inventer un ; la valeur, elle, reste juste
// parce qu'elle est calculée inventaire par inventaire puis additionnée.
//
// ⚠️ PAS DE COLONNE « STATUT » non plus : le statut d'audit appartient à un
// inventaire, pas à un magasin. Une référence arbitrée ici et en écart là
// n'aurait aucun statut à afficher.
//
// ⚠️ ET DEUX FEUILLES, dont la seconde dit d'OÙ vient chaque ligne. C'est la
// contrepartie de l'addition : sans elle, un écart de 12 pièces sur une
// référence vue dans trois inventaires ne se rattache à aucun rayon.

export function storeReportFilename(
  storeName: string, format: ExportFormat, date = new Date(),
): string {
  const base = storeName
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '').toLowerCase() || 'magasin'
  return `rapport_magasin_${base}_${date.toISOString().slice(0, 10)}.${format}`
}

export function buildStoreVarianceRows(
  rows: LigneRapportMagasin[],
): Record<string, string | number>[] {
  const data = rows.map(r => ({
    SKU: r.sku === r.ean ? '' : r.sku,
    EAN: r.ean ?? '',
    Marque: r.brand,
    Désignation: r.label,
    'Qté théorique': Number(r.theoretical_qty),
    'Qté comptée': Number(r.counted_qty),
    'Écart (unités)': Number(r.variance_units),
    'Écart (valeur achat)': Number(r.variance_value),
    Inventaires: Number(r.inventaires),
  }))

  data.push({
    SKU: 'TOTAL',
    EAN: '', Marque: '', Désignation: '',
    'Qté théorique': rows.reduce((s, r) => s + Number(r.theoretical_qty), 0),
    'Qté comptée': rows.reduce((s, r) => s + Number(r.counted_qty), 0),
    'Écart (unités)': rows.reduce((s, r) => s + Number(r.variance_units), 0),
    'Écart (valeur achat)': rows.reduce((s, r) => s + Number(r.variance_value), 0),
    Inventaires: 0,
  })
  return data
}

export function buildStoreDetailRows(
  rows: LigneDetailMagasin[],
): Record<string, string | number>[] {
  return rows.map(r => ({
    Inventaire: r.inventaire,
    'N° inventaire': r.numero,
    // ⚠️ La date de CLÔTURE (Julien, 4 septembre 2026). Quand une référence
    // revient dans trois lignes, c'est elle qui dit laquelle est la plus
    // récente — le numéro ne le dit qu'à qui connaît la nomenclature.
    'Clôturé le': r.cloture_le,
    SKU: r.sku === r.ean ? '' : r.sku,
    EAN: r.ean ?? '',
    Marque: r.brand,
    Désignation: r.label,
    'Qté théorique': Number(r.theoretical_qty),
    'Qté comptée': Number(r.counted_qty),
    'Écart (unités)': Number(r.variance_units),
    'Écart (valeur achat)': Number(r.variance_value),
  }))
}

export async function downloadStoreXlsx(
  storeName: string, rows: LigneRapportMagasin[], detailRows: LigneDetailMagasin[],
): Promise<string> {
  const XLSX = await import('xlsx')
  const wb = XLSX.utils.book_new()

  const ws = XLSX.utils.json_to_sheet(buildStoreVarianceRows(rows))
  ws['!cols'] = [
    { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 30 },
    { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 18 }, { wch: 12 },
  ]
  forcerEnTexte(XLSX, ws, [0, 1])
  XLSX.utils.book_append_sheet(wb, ws, 'Consolidé')

  const wsDetail = XLSX.utils.json_to_sheet(buildStoreDetailRows(detailRows))
  wsDetail['!cols'] = [
    { wch: 28 }, { wch: 20 }, { wch: 12 }, { wch: 16 }, { wch: 16 },
    { wch: 16 }, { wch: 30 }, { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 18 },
  ]
  // Le numéro d'inventaire, le SKU et l'EAN sont des codes : en texte, sans
  // quoi ils partent en notation scientifique et perdent leurs zéros de tête.
  forcerEnTexte(XLSX, wsDetail, [1, 3, 4])
  XLSX.utils.book_append_sheet(wb, wsDetail, 'Par inventaire')

  const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
  const filename = storeReportFilename(storeName, 'xlsx')
  triggerDownload(
    new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    filename,
  )
  return filename
}

export function downloadStoreCsv(
  storeName: string, rows: LigneRapportMagasin[], detailRows: LigneDetailMagasin[],
): string[] {
  const base = storeReportFilename(storeName, 'csv').replace(/\.csv$/, '')
  const names: string[] = []

  const consolide = `${base}_consolide.csv`
  downloadCsvBlob(toCsv(buildStoreVarianceRows(rows)), consolide)
  names.push(consolide)

  if (detailRows.length > 0) {
    const detail = `${base}_par_inventaire.csv`
    setTimeout(() => downloadCsvBlob(toCsv(buildStoreDetailRows(detailRows)), detail), 600)
    names.push(detail)
  }
  return names
}
