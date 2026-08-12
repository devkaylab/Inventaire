'use client'

// Confirmation modale, en remplacement de `window.confirm`.
//
// Deux raisons de ne pas garder `confirm()` : il ne permet aucune nuance entre
// « je range un inventaire » et « j'efface trois jours de comptage », et il ne
// laisse pas exiger un geste délibéré. Ici une action destructrice peut
// demander de recopier le numéro d'inventaire (`requireText`).

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'

export type ConfirmOptions = {
  title: string
  /** Corps du message. Les lignes du tableau sont rendues telles quelles. */
  message?: string
  /** Points détaillés, listés sous le message. */
  details?: string[]
  confirmLabel?: string
  cancelLabel?: string
  tone?: 'default' | 'danger'
  /** Si fourni, la confirmation n'est active qu'une fois ce texte recopié. */
  requireText?: string
}

type Pending = ConfirmOptions & { resolve: (ok: boolean) => void }

const ConfirmContext = createContext<((options: ConfirmOptions) => Promise<boolean>) | null>(null)

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = useState<Pending | null>(null)
  const [typed, setTyped] = useState('')
  const confirmRef = useRef<HTMLButtonElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const confirm = useCallback((options: ConfirmOptions) => (
    new Promise<boolean>(resolve => {
      setTyped('')
      setPending({ ...options, resolve })
    })
  ), [])

  const close = useCallback((ok: boolean) => {
    setPending(current => { current?.resolve(ok); return null })
    setTyped('')
  }, [])

  // Échap ferme, et le focus part sur le champ à recopier s'il existe, sinon
  // sur le bouton de confirmation.
  useEffect(() => {
    if (!pending) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(false) }
    window.addEventListener('keydown', onKey)
    const target = pending.requireText ? inputRef.current : confirmRef.current
    target?.focus()
    return () => window.removeEventListener('keydown', onKey)
  }, [pending, close])

  const blocked = !!pending?.requireText && typed.trim() !== pending.requireText

  const value = useMemo(() => confirm, [confirm])

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      {pending && (
        <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) close(false) }}>
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
            <h2 className="modal-title" id="confirm-title">{pending.title}</h2>
            {pending.message && <p className="modal-message">{pending.message}</p>}
            {pending.details && pending.details.length > 0 && (
              <ul className="modal-details">
                {pending.details.map(d => <li key={d}>{d}</li>)}
              </ul>
            )}
            {pending.requireText && (
              <div className="field" style={{ marginTop: 16 }}>
                <label htmlFor="confirm-echo">
                  Recopiez <strong>{pending.requireText}</strong> pour confirmer
                </label>
                <input
                  id="confirm-echo"
                  ref={inputRef}
                  value={typed}
                  onChange={e => setTyped(e.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>
            )}
            <div className="modal-actions">
              <button type="button" className="btn btn-ghost" onClick={() => close(false)}>
                {pending.cancelLabel ?? 'Annuler'}
              </button>
              <button
                type="button"
                ref={confirmRef}
                className={`btn ${pending.tone === 'danger' ? 'btn-danger' : 'btn-primary'}`}
                disabled={blocked}
                onClick={() => close(true)}
              >
                {pending.confirmLabel ?? 'Confirmer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  )
}

export function useConfirm(): (options: ConfirmOptions) => Promise<boolean> {
  const ctx = useContext(ConfirmContext)
  if (!ctx) throw new Error('useConfirm doit être utilisé dans un <ConfirmProvider>')
  return ctx
}
