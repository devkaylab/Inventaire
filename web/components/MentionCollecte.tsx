'use client'

import { PRIVACY_URL } from '@/lib/links'
import { useTraduction } from '@/lib/i18n'

/**
 * Information au point de collecte (RGPD art. 13).
 *
 * La politique de confidentialité ne suffit pas si personne ne la croise :
 * l'information doit être donnée **au moment où les données sont saisies**.
 * D'où cette mention sous chaque formulaire qui collecte des données
 * personnelles — et non un simple lien perdu dans un pied de page.
 *
 * Volontairement pas de case à cocher : la base légale ici n'est pas le
 * consentement mais l'exécution du contrat (ou les mesures précontractuelles).
 * Une case cocher-pour-continuer donnerait à croire le contraire.
 */
export function MentionCollecte({ finalite }: { finalite: string }) {
  const { t } = useTraduction()
  return (
    <p className="mention-collecte">
      {t('Les informations saisies sont utilisées par Devkaylab, éditeur de Quantinvo, pour %{finalite}. Vous disposez d’un droit d’accès, de rectification, d’effacement et d’opposition, ainsi que du droit d’introduire une réclamation auprès de la CNIL. Détail dans la ', { finalite })}
      <a href={PRIVACY_URL} target="_blank" rel="noreferrer">{t('politique de confidentialité')}</a>.
    </p>
  )
}
