'use client'

// La case « J'accepte les conditions générales » (16 septembre 2026).
//
// ⚠️ UNE SEULE DÉFINITION pour les trois gestes qui ouvrent un paiement :
// l'inscription, la souscription et l'ajout d'un magasin. Trois cases écrites
// à la main finiraient par ne pas dire la même chose — sur le seul texte dont
// la formulation a une portée juridique.
//
// ⚠️ ELLE N'EST JAMAIS COCHÉE D'AVANCE. Une case pré-cochée ne prouve aucun
// accord. Et la vérification ne vit pas ici : la base refuse un dépôt dont la
// version n'est pas celle en vigueur (`version_conditions`). Cette case ne fait
// qu'éviter un aller-retour.

import { useId } from 'react'
import { CONDITIONS_URL } from '@/lib/conditions'
import { t } from '@/lib/i18n'

export function AccepterConditions({
  accepte, onChange,
}: {
  accepte: boolean
  onChange: (v: boolean) => void
}) {
  const id = useId()
  return (
    <div className="accepter-conditions">
      <input id={id} type="checkbox" checked={accepte} onChange={(e) => onChange(e.target.checked)} />
      <label htmlFor={id}>
        {t('J’ai lu et j’accepte les')}{' '}
        {/* Nouvel onglet : la lecture ne doit pas faire perdre la saisie. */}
        <a href={CONDITIONS_URL} target="_blank" rel="noreferrer">{t('conditions générales de vente et d’utilisation')}</a>
        {t(', dont l’usage de chaque licence pour le seul magasin déclaré.')}
      </label>
    </div>
  )
}
