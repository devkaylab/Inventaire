/**
 * Modèles de fichiers d'import — Référencement et Stock théorique.
 *
 * Demande de Julien, 25 août 2026, après un import raté sur une colonne
 * inconnue : mettre les deux gabarits à disposition dans la boîte à outils,
 * pour que le fichier parte du bon pied plutôt que d'être deviné.
 *
 * Deux règles à ne pas défaire :
 *
 * - **Toutes les cellules sont des chaînes.** C'est ce qui fait qu'Excel type
 *   les colonnes en Texte : un SKU « 0123 » ou un EAN gardent leurs zéros de
 *   tête. Écrire les quantités ou les prix en nombres retyperait la colonne
 *   et réintroduirait le piège que l'écran d'import documente.
 * - **Chaque en-tête doit être reconnu par l'import.** Un modèle dont une
 *   colonne ne serait pas relue serait pire que pas de modèle — un test fait
 *   passer chaque gabarit dans `mapCatalogRows` / `mapStockRows` et vérifie
 *   que rien ne se perd.
 *
 * Les lignes d'exemple sont à remplacer : elles montrent le format, dont le
 * cas qui a coûté un inventaire de test — **un même SKU sur plusieurs lignes,
 * un EAN par ligne** (deux tailles d'un même article, chacune son
 * code-barres). Les EAN d'exemple portent une clé de contrôle valide.
 */

export type Modele = {
  fichier: string
  feuille: string
  /** Première ligne : les en-têtes ; ensuite, des exemples à remplacer. */
  lignes: string[][]
}

export const MODELE_REFERENCEMENT: Modele = {
  fichier: 'modele_referencement.xlsx',
  feuille: 'Référentiel articles',
  lignes: [
    ['SKU', 'EAN', 'Marque', 'Libellé', "Prix d'achat"],
    ['ART-001', '3701234567891', 'Marque A', 'T-shirt coton — taille M', '12,50'],
    ['ART-001', '3701234567907', 'Marque A', 'T-shirt coton — taille L', '12,50'],
    ['ART-002', '3701234567914', 'Marque B', 'Coffret découverte', '24,90'],
  ],
}

export const MODELE_STOCK: Modele = {
  fichier: 'modele_stock_theorique.xlsx',
  feuille: 'Stock théorique',
  lignes: [
    ['SKU', 'Quantité théorique'],
    ['ART-001', '24'],
    ['ART-002', '8'],
  ],
}

/** Dessine le classeur et déclenche le téléchargement dans le navigateur. */
export async function telechargerModele(modele: Modele): Promise<void> {
  // Import différé, comme dans lib/import.ts : la bibliothèque pèse ~900 Ko.
  const XLSX = await import('xlsx')
  const feuille = XLSX.utils.aoa_to_sheet(modele.lignes)
  feuille['!cols'] = modele.lignes[0].map((_, i) => ({
    wch: Math.max(...modele.lignes.map(l => (l[i] ?? '').length)) + 4,
  }))
  const classeur = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(classeur, feuille, modele.feuille)
  XLSX.writeFile(classeur, modele.fichier)
}
