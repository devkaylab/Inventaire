// Planche de balises (PDF) écrite dans le cache, puis partagée.
//
// ⚠️ **LE DESSIN N'EST PLUS ICI.** Il vit dans `baliseDessin.ts`, dont le site
// tient une copie identique : une balise imprimée depuis l'app doit se scanner
// exactement comme une balise imprimée depuis le site. Ce fichier ne garde que
// ce que le téléphone fait et que le navigateur ne fait pas — écrire un
// fichier et ouvrir la feuille de partage.

import { File, Paths } from 'expo-file-system'
import * as Sharing from 'expo-sharing'
import { dessinerPlanche } from '@/lib/baliseDessin'

// Le format du QR vit dans `baliseCode.ts`, un module sans dépendance native
// donc testable sous vitest, contrairement à celui-ci. On le réexporte pour
// que les appelants n'aient rien à savoir.
export { BALISE_PREFIX, balisePayload, parseBalise } from '@/lib/baliseCode'
export { GABARIT, PAR_PLANCHE } from '@/lib/baliseDessin'

export type PlancheBalises = { uri: string; filename: string }

/**
 * ⚠️ **Dessiner et partager sont deux temps, et ils doivent le rester.**
 *
 * Les deux ne faisaient qu'une fonction, appelée pendant que l'overlay de
 * chargement était à l'écran. Or cet overlay est une `Modal`, donc un
 * `UIViewController` présenté : iOS **refuse** d'afficher la feuille de
 * partage par-dessus (« Attempt to present UIActivityViewController on … which
 * is already presenting »), `shareAsync` ne se résout jamais, et le bouton
 * « Créer et imprimer des balises » tourne **indéfiniment**. Vu au simulateur
 * le 23 août 2026 : rien ne sortait, et rien ne le disait.
 *
 * L'appelant dessine d'abord, **retire l'overlay**, et ne partage qu'une fois
 * l'écran libre (voir `BaliseCreator`).
 */
export async function buildBaliseSheetFile(
  title: string,
  codes: string[]
): Promise<PlancheBalises> {
  // Laisse React peindre l'overlay de chargement avant le dessin (bloquant) du PDF.
  await new Promise((r) => setTimeout(r, 30))
  const b64 = await (await dessinerPlanche(codes)).saveAsBase64()
  const safe = title.replace(/[^\w-]+/g, '_')
  const filename = `balises_${safe}_${new Date().toISOString().slice(0, 10)}.pdf`
  const file = new File(Paths.cache, filename)
  if (file.exists) file.delete()
  file.create()
  file.write(b64, { encoding: 'base64' })
  return { uri: file.uri, filename }
}

/** Ouvre le partage iOS (aperçu → Imprimer / Enregistrer). Faux si indisponible. */
export async function shareBaliseSheet(planche: PlancheBalises): Promise<boolean> {
  if (!(await Sharing.isAvailableAsync())) return false
  await Sharing.shareAsync(planche.uri, {
    mimeType: 'application/pdf',
    dialogTitle: 'Planches de balises',
    UTI: 'com.adobe.pdf',
  })
  return true
}
