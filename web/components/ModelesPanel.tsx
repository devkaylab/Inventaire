'use client'

import { useState } from 'react'
import { MODELE_REFERENCEMENT, MODELE_STOCK, telechargerModele, type Modele } from '@/lib/modeles'
import { useToast } from '@/components/ui/Toast'

/**
 * Les deux modèles de fichiers d'import (demande de Julien, 25 août 2026).
 * Le format vit dans `lib/modeles.ts` ; ici, seulement le téléchargement et
 * l'explication — la même que celle de l'onglet Set up, en plus court.
 */
export function ModelesPanel() {
  const toast = useToast()
  const [occupe, setOccupé] = useState<string | null>(null)

  async function telecharger(modele: Modele) {
    setOccupé(modele.fichier)
    try {
      await telechargerModele(modele)
    } catch {
      toast.error('Le téléchargement du modèle a échoué. Réessayez.')
    } finally {
      setOccupé(null)
    }
  }

  return (
    <div className="panel">
      <h3>Modèles de fichiers</h3>
      <p>
        Les deux fichiers attendus par l&apos;onglet Set up d&apos;un inventaire, avec leurs
        colonnes déjà nommées et quelques lignes d&apos;exemple à remplacer. Les colonnes de
        codes y sont en Texte — c&apos;est ce qui préserve les zéros de tête.
      </p>
      <div className="modeles">
        <div className="modele-row">
          <div>
            <div className="modele-nom">Référencement <span className="role-tag">requis</span></div>
            <p className="muted small" style={{ margin: 0 }}>
              SKU, EAN, marque, libellé, prix d&apos;achat. Un même SKU peut occuper plusieurs
              lignes, une par EAN — deux tailles d&apos;un article, chacune son code-barres.
            </p>
          </div>
          <button
            className="btn btn-ghost btn-sm"
            disabled={occupe !== null}
            onClick={() => telecharger(MODELE_REFERENCEMENT)}
          >
            {occupe === MODELE_REFERENCEMENT.fichier ? 'Préparation…' : 'Télécharger'}
          </button>
        </div>
        <div className="modele-row">
          <div>
            <div className="modele-nom">Stock théorique <span className="role-tag">optionnel</span></div>
            <p className="muted small" style={{ margin: 0 }}>
              SKU et quantité attendue. Sans ce fichier, le rapport ne calcule aucun écart.
            </p>
          </div>
          <button
            className="btn btn-ghost btn-sm"
            disabled={occupe !== null}
            onClick={() => telecharger(MODELE_STOCK)}
          >
            {occupe === MODELE_STOCK.fichier ? 'Préparation…' : 'Télécharger'}
          </button>
        </div>
      </div>
    </div>
  )
}
