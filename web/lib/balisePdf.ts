// Planche de balises (PDF) téléchargée depuis le navigateur.
//
// ⚠️ **LE DESSIN N'EST PLUS ICI.** Il vit dans `baliseDessin.ts`, dont l'app
// tient une copie identique : une balise imprimée depuis le site doit se
// scanner exactement comme une balise imprimée depuis l'app. Ce fichier ne
// garde que ce que le navigateur fait et que le téléphone ne fait pas —
// fabriquer un blob et le donner à télécharger.
//
// À imprimer à 100 % (taille réelle) sur des planches A4 de 80 étiquettes
// 35,6 × 16,9 mm.

import { dessinerPlanche } from '@/lib/baliseDessin'

// Le format du QR vit dans `baliseCode.ts`, lui aussi en double. Réexporté
// pour que les appelants — et les tests — n'aient rien à savoir.
export { BALISE_PREFIX, balisePayload, parseBalise } from '@/lib/baliseCode'
export { GABARIT, PAR_PLANCHE } from '@/lib/baliseDessin'

/** Construit le PDF d'une liste de numéros de balises. Renvoie les octets. */
export async function buildBaliseSheet(codes: string[]): Promise<Uint8Array> {
  return await (await dessinerPlanche(codes)).save()
}

/** Nom de fichier de la planche, ex. `balises_1000-1049_2026-08-21.pdf`. */
export function baliseSheetFilename(from: number, to: number, now = new Date()): string {
  return `balises_${from}-${to}_${now.toISOString().slice(0, 10)}.pdf`
}

/** Génère la planche et déclenche son téléchargement dans le navigateur. */
export async function downloadBaliseSheet(codes: string[], from: number, to: number): Promise<string> {
  const bytes = await buildBaliseSheet(codes)
  const filename = baliseSheetFilename(from, to)
  const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
  return filename
}
