'use client'

// File d'avis éphémères. Remplace les `alert()` : un `alert` bloque la page,
// ne dit pas d'où il vient et n'a aucun style. Ici le message apparaît près de
// l'action, se referme seul, et reste lisible au clavier comme au lecteur
// d'écran (role="status" + aria-live).

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'

export type ToastKind = 'success' | 'error' | 'info'

type Toast = { id: number; kind: ToastKind; message: string }

type ToastApi = {
  success: (message: string) => void
  error: (message: string) => void
  info: (message: string) => void
}

const ToastContext = createContext<ToastApi | null>(null)

const DURATION: Record<ToastKind, number> = {
  success: 3500,
  info: 4000,
  // Une erreur mérite qu'on ait le temps de la lire avant qu'elle disparaisse.
  error: 7000,
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const nextId = useRef(1)
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>())

  const dismiss = useCallback((id: number) => {
    setToasts(list => list.filter(t => t.id !== id))
    const timer = timers.current.get(id)
    if (timer) { clearTimeout(timer); timers.current.delete(id) }
  }, [])

  const push = useCallback((kind: ToastKind, message: string) => {
    const id = nextId.current++
    setToasts(list => [...list, { id, kind, message }])
    timers.current.set(id, setTimeout(() => dismiss(id), DURATION[kind]))
  }, [dismiss])

  // Les timers survivraient au démontage et appelleraient setState dans le vide.
  useEffect(() => {
    const pending = timers.current
    return () => { pending.forEach(clearTimeout); pending.clear() }
  }, [])

  const api = useMemo<ToastApi>(() => ({
    success: m => push('success', m),
    error: m => push('error', m),
    info: m => push('info', m),
  }), [push])

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toast-stack" role="status" aria-live="polite">
        {toasts.map(t => (
          <div key={t.id} className={`toast toast-${t.kind}`}>
            <span className="toast-msg">{t.message}</span>
            <button
              type="button"
              className="toast-close"
              onClick={() => dismiss(t.id)}
              aria-label="Fermer"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast doit être utilisé dans un <ToastProvider>')
  return ctx
}
