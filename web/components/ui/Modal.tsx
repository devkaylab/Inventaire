'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { t } from '@/lib/i18n'

/**
 * ⚠️ LA DURÉE DU FONDU DE SORTIE EST ÉCRITE DEUX FOIS : ici, et dans
 * `globals.css` (`voile-sort` / `modal-sort`, `.16s`). Elles doivent
 * s'accorder — trop court ici et la fenêtre saute avant la fin du fondu ;
 * trop long et un voile mort reste à l'écran. Une garde tient l'accord
 * (`web/tests/fenetre-modale.test.ts`). Même piège que `DUREE_LIEN_HEURES`.
 */
export const DUREE_FERMETURE_MS = 160

/** Fenêtre modale générique (invitation, identifiants…). Échap et clic hors
 *  cadre referment ; le focus entre dans la fenêtre à l'ouverture.
 *
 *  ⚠️ **LA FERMETURE PASSE PAR LE FONDU, JAMAIS DIRECTEMENT.** Demande de
 *  Julien (10 octobre 2026) : « une animation fade in et fade out quand on a
 *  terminé ». React démontait d'un coup — le voile disparaissait net, et la
 *  page revenait comme un claquement. `onClose` n'est donc appelé qu'après
 *  l'animation, et toutes les sorties (Échap, croix, clic sur le voile,
 *  bouton du pied) empruntent le même chemin : une seule sortie, un seul
 *  comportement.
 */
export function Modal({ title, onClose, children, footer, large = false }: {
  title: string
  onClose: () => void
  /**
   * ⚠️ Le contenu peut être une FONCTION qui reçoit `fermer`. Sans ça, un
   * formulaire qui se referme tout seul après l'envoi appellerait `onClose`
   * en direct — la fenêtre sauterait, sans fondu, au moment exact que Julien
   * décrivait (« fade out quand on a terminé »). Les appelants qui n'en ont
   * pas besoin passent du JSX comme avant.
   */
  children: React.ReactNode | ((fermer: () => void) => React.ReactNode)
  footer?: React.ReactNode
  /** Élargit la fenêtre pour un tableau : 460 px ne tient pas quatre colonnes. */
  large?: boolean
}) {
  const boxRef = useRef<HTMLDivElement>(null)
  // ⚠️ `sortie` sert AUSSI de verrou : sans lui, deux Échap de suite poseraient
  // deux minuteurs et `onClose` partirait deux fois — ce qui rouvrirait la
  // fenêtre chez un appelant qui bascule un booléen.
  const [sortie, setSortie] = useState(false)

  const fermer = useCallback(() => {
    if (sortie) return
    setSortie(true)
    setTimeout(onClose, DUREE_FERMETURE_MS)
  }, [onClose, sortie])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') fermer() }
    window.addEventListener('keydown', onKey)
    boxRef.current?.focus()
    return () => window.removeEventListener('keydown', onKey)
  }, [fermer])

  return (
    <div
      className={`modal-backdrop${sortie ? ' sortie' : ''}`}
      onMouseDown={e => { if (e.target === e.currentTarget) fermer() }}
    >
      <div className={`modal${large ? ' modal-large' : ''}`} role="dialog" aria-modal="true" aria-labelledby="modal-title" ref={boxRef} tabIndex={-1}>
        <div className="modal-head">
          <h2 className="modal-title" id="modal-title">{title}</h2>
          <button type="button" className="modal-x" onClick={fermer} aria-label={t('Fermer')}>×</button>
        </div>
        {typeof children === 'function' ? children(fermer) : children}
        {footer && <div className="modal-actions">{footer}</div>}
      </div>
    </div>
  )
}
