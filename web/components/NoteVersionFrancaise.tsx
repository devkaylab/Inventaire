'use client'

import { useTraduction } from '@/lib/i18n'

/**
 * Les textes légaux restent en français : seule la version française fait foi.
 * Quand l'interface est en anglais, une ligne le dit avant le document.
 */
export function NoteVersionFrancaise() {
  const { langue, t } = useTraduction()
  if (langue === 'fr') return null
  return (
    <p className="legal-avis" lang="en">
      {t('Ce document n’existe qu’en français. En cas de divergence, la version française fait foi.')}
    </p>
  )
}
