// Rendu PDF du devis — le seul fichier qui dépend de pdf-lib.
//
// Il ne décide de rien : la mise en page vient de `devis.ts`, qui est testé par
// les tests du site. Ici on ne fait que poser les éléments sur une page A4, en
// retournant l'axe vertical (les millimètres de `devis.ts` partent du haut, le
// PDF compte depuis le bas).
//
// pdf-lib est chargé depuis esm.sh, comme le client Supabase des autres
// fonctions edge. C'est la même bibliothèque que celle utilisée par le site
// pour les planches de balises : un seul moteur PDF dans le produit.
import { PDFDocument, StandardFonts, rgb } from 'https://esm.sh/pdf-lib@1.17.1'
import { type Devis, type Element, PAGE, elementsDevis } from './devis.ts'

const MM = 72 / 25.4

/** '#4636b0' → rgb(). pdf-lib ne lit pas l'hexadécimal. */
function couleur(hex: string) {
  const v = hex.replace('#', '')
  const n = parseInt(v.length === 3 ? v.split('').map((c) => c + c).join('') : v, 16)
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255)
}

export async function devisEnPdf(devis: Devis): Promise<Uint8Array> {
  const elements: Element[] = elementsDevis(devis)

  const doc = await PDFDocument.create()
  doc.setTitle(`Devis ${devis.reference} — ${devis.entreprise}`)
  doc.setProducer('Quantinvo')
  doc.setCreator('Quantinvo')

  const page = doc.addPage([PAGE.largeur * MM, PAGE.hauteur * MM])
  const normale = await doc.embedFont(StandardFonts.Helvetica)
  const grasse = await doc.embedFont(StandardFonts.HelveticaBold)

  const hautVersBas = (y: number) => (PAGE.hauteur - y) * MM

  for (const el of elements) {
    if (el.type === 'bloc') {
      page.drawRectangle({
        x: el.x * MM,
        y: hautVersBas(el.y + el.hauteur),
        width: el.largeur * MM,
        height: el.hauteur * MM,
        color: couleur(el.couleur),
      })
      continue
    }
    if (el.type === 'trait') {
      page.drawLine({
        start: { x: el.x1 * MM, y: hautVersBas(el.y1) },
        end: { x: el.x2 * MM, y: hautVersBas(el.y2) },
        thickness: el.epaisseur * MM,
        color: couleur(el.couleur),
      })
      continue
    }
    const police = el.gras ? grasse : normale
    // Helvetica ne connaît pas toutes les ponctuations françaises : l'apostrophe
    // courbe et les espaces insécables feraient échouer l'encodage WinAnsi.
    const texte = el.texte.replace(/[’‘]/g, "'").replace(/[“”]/g, '"').replace(/[  ]/g, ' ')
    const largeur = police.widthOfTextAtSize(texte, el.taille)
    page.drawText(texte, {
      x: (el.alignement === 'droite' ? el.x * MM - largeur : el.x * MM),
      y: hautVersBas(el.y),
      size: el.taille,
      font: police,
      color: couleur(el.couleur ?? '#0b0f19'),
    })
  }

  return await doc.save()
}

/** Le PDF en base64, forme attendue par Resend pour une pièce jointe. */
export function enBase64(octets: Uint8Array): string {
  let binaire = ''
  const bloc = 0x8000
  for (let i = 0; i < octets.length; i += bloc) {
    binaire += String.fromCharCode(...octets.subarray(i, i + bloc))
  }
  return btoa(binaire)
}
