'use client'

import { usePathname, useRouter } from 'next/navigation'
import { NOM_LANGUE, changerLangue, useLangue, useTraduction } from '@/lib/i18n'
import { cheminDansLangue, langueDuChemin } from '@/lib/vitrine'

/**
 * Le bouton de langue (10 septembre 2026).
 *
 * Une pastille fixe, au-dessus du bouton de thème, qui porte le code de la
 * langue AFFICHÉE et bascule vers l'autre au clic. Deux langues seulement :
 * un cycle suffit, un menu serait un geste de plus pour rien.
 *
 * ⚠️ IL EST SUR TOUT LE SITE depuis le 11 septembre 2026 (demande de Julien),
 * et il ne fait pas la même chose partout :
 * - sur la VITRINE, la langue est dans l'adresse — il NAVIGUE vers la jumelle
 *   (`/tarifs` ⇄ `/en/tarifs`), et note le choix dans le cookie pour que la
 *   connexion et l'espace connecté suivent ;
 * - ailleurs (connexion, espace connecté, devis), il change la langue sur
 *   place : c'est un choix d'appareil, rien dans l'adresse.
 *
 * Il rend le code en dur (« FR » / « EN ») et non `NOM_LANGUE` : à 44 px de
 * haut, un mot ne tient pas, un code se lit d'un coup d'œil.
 */
export function LangueToggle() {
  const langue = useLangue()
  const { t } = useTraduction()
  const chemin = usePathname()
  const router = useRouter()
  const autre = langue === 'fr' ? 'en' : 'fr'
  const libelle = t('Langue : %{langue} (cliquer pour passer en %{autre})', {
    langue: NOM_LANGUE[langue], autre: NOM_LANGUE[autre],
  })
  const basculer = () => {
    changerLangue(autre)
    if (langueDuChemin(chemin)) router.push(cheminDansLangue(chemin ?? '/', autre))
  }
  return (
    <button
      type="button"
      className="langue-toggle"
      onClick={basculer}
      aria-label={libelle}
      title={libelle}
    >
      {langue.toUpperCase()}
    </button>
  )
}
