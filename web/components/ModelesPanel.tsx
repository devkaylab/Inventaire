'use client'

import { useState } from 'react'
import { MODELE_REFERENCEMENT, MODELE_STOCK, telechargerModele, type Modele } from '@/lib/modeles'
import { useToast } from '@/components/ui/Toast'
import { t } from '@/lib/i18n'

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
      toast.error(t('Le téléchargement du modèle a échoué. Réessayez.'))
    } finally {
      setOccupé(null)
    }
  }

  return (
    <div className="panel">
      <h3>{t('Modèles de fichiers')}</h3>
      <p>
        {t("Les deux fichiers attendus par l'onglet Set up d'un inventaire, avec leurs colonnes déjà nommées et quelques lignes d'exemple à remplacer. Les colonnes de codes y sont en Texte — c'est ce qui préserve les zéros de tête.")}
      </p>
      <div className="modeles">
        <div className="modele-row">
          <div>
            <div className="modele-nom">{t('Référencement')} <span className="role-tag">{t('requis')}</span></div>
            <p className="muted small" style={{ margin: 0 }}>
              {t("SKU, EAN, marque, libellé, prix d'achat. Un même SKU peut occuper plusieurs lignes, une par EAN — deux tailles d'un article, chacune son code-barres.")}
            </p>
          </div>
          <button
            className="btn btn-ghost btn-sm"
            disabled={occupe !== null}
            onClick={() => telecharger(MODELE_REFERENCEMENT)}
          >
            {occupe === MODELE_REFERENCEMENT.fichier ? t('Préparation…') : t('Télécharger')}
          </button>
        </div>
        <div className="modele-row">
          <div>
            <div className="modele-nom">{t('Stock théorique')} <span className="role-tag">{t('optionnel')}</span></div>
            <p className="muted small" style={{ margin: 0 }}>
              {t('SKU et quantité attendue. Sans ce fichier, le rapport ne calcule aucun écart.')}
            </p>
          </div>
          <button
            className="btn btn-ghost btn-sm"
            disabled={occupe !== null}
            onClick={() => telecharger(MODELE_STOCK)}
          >
            {occupe === MODELE_STOCK.fichier ? t('Préparation…') : t('Télécharger')}
          </button>
        </div>
      </div>
    </div>
  )
}
