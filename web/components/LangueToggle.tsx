'use client'

import { NOM_LANGUE, changerLangue, useLangue, useTraduction } from '@/lib/i18n'

/**
 * Le bouton de langue (10 septembre 2026).
 *
 * Une pastille fixe, au-dessus du bouton de thème, qui porte le code de la
 * langue AFFICHÉE et bascule vers l'autre au clic. Deux langues seulement :
 * un cycle suffit, un menu serait un geste de plus pour rien.
 *
 * ⚠️ Il n'est monté QUE dans l'espace connecté et sur ses portes (connexion,
 * bienvenue, réinitialisation) — la vitrine reste en français, décision de
 * Julien : « le site et l'app gardent comme langue le français ». Le bouton de
 * thème, lui, vit dans le layout racine : c'est voulu qu'ils ne soient pas au
 * même endroit.
 *
 * Il rend le code en dur (« FR » / « EN ») et non `NOM_LANGUE` : à 44 px de
 * haut, un mot ne tient pas, un code se lit d'un coup d'œil.
 */
export function LangueToggle() {
  const langue = useLangue()
  const { t } = useTraduction()
  const autre = langue === 'fr' ? 'en' : 'fr'
  const libelle = t('Langue : %{langue} (cliquer pour passer en %{autre})', {
    langue: NOM_LANGUE[langue], autre: NOM_LANGUE[autre],
  })
  return (
    <button
      type="button"
      className="langue-toggle"
      onClick={() => changerLangue(autre)}
      aria-label={libelle}
      title={libelle}
    >
      {langue.toUpperCase()}
    </button>
  )
}
