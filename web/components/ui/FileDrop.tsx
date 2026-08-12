'use client'

import { useId, useRef, useState } from 'react'

/** Zone de dépôt + sélecteur de fichier. Un superviseur au bureau glisse son
 *  export depuis l'explorateur ; le clic reste possible pour tout le monde. */
export function FileDrop({ accept, disabled, label, hint, onFile }: {
  accept: string
  disabled?: boolean
  label: string
  hint: string
  onFile: (file: File) => void
}) {
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)

  function pick(file: File | undefined | null) {
    if (!file || disabled) return
    onFile(file)
    // Permet de re-sélectionner le même fichier après correction.
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div
      className="file-drop"
      data-over={over}
      data-disabled={disabled}
      onDragOver={e => { e.preventDefault(); if (!disabled) setOver(true) }}
      onDragLeave={() => setOver(false)}
      onDrop={e => { e.preventDefault(); setOver(false); pick(e.dataTransfer.files?.[0]) }}
      onClick={() => { if (!disabled) inputRef.current?.click() }}
      onKeyDown={e => {
        if (disabled) return
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); inputRef.current?.click() }
      }}
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled}
      aria-labelledby={inputId}
    >
      <div className="file-drop-title" id={inputId}>{label}</div>
      <div className="file-drop-hint">{hint}</div>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        disabled={disabled}
        onChange={e => pick(e.target.files?.[0])}
        className="sr-only"
        tabIndex={-1}
      />
    </div>
  )
}
