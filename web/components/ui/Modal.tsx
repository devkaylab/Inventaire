'use client'

import { useEffect, useRef } from 'react'

/** Fenêtre modale générique (invitation, identifiants…). Échap et clic hors
 *  cadre referment ; le focus entre dans la fenêtre à l'ouverture. */
export function Modal({ title, onClose, children, footer }: {
  title: string
  onClose: () => void
  children: React.ReactNode
  footer?: React.ReactNode
}) {
  const boxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    boxRef.current?.focus()
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" ref={boxRef} tabIndex={-1}>
        <div className="modal-head">
          <h2 className="modal-title" id="modal-title">{title}</h2>
          <button type="button" className="modal-x" onClick={onClose} aria-label="Fermer">×</button>
        </div>
        {children}
        {footer && <div className="modal-actions">{footer}</div>}
      </div>
    </div>
  )
}
