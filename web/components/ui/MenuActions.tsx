'use client'

import { useEffect, useRef, useState } from 'react'

export type ActionRangee = {
  libelle: string
  onClick: () => void
  /** Le geste qui détruit : rouge, et derrière un filet, tout en bas. */
  destructif?: boolean
}

/**
 * Les actions d'une rangée, derrière un bouton « ⋯ ».
 *
 * ⚠️ CE N'EST PAS UN RANGEMENT, C'EST UNE DISTANCE. Sur /equipe, « Passer
 * compteur » et « Supprimer le compte » étaient deux liens voisins de même
 * dessin — l'un anodin et réversible d'un clic, l'autre définitif. C'est la
 * famille du défaut corrigé le 28 août 2026 dans l'application, où « Supprimer
 * mon compte » suivait « Se déconnecter » dans la même carte : ce qui protège,
 * c'est l'éloignement, la confirmation ne vient qu'après.
 *
 * Ce qui ne change pas : la confirmation qui exige la recopie du nom reste
 * exactement où elle était. Ce composant déplace un bouton, pas un garde-fou.
 *
 * Il reprend le motif du menu de l'avatar (`AppShell`) : Échap referme et rend
 * le focus au bouton, un clic ailleurs referme, et un choix referme avant
 * d'agir — sinon le panneau reste ouvert par-dessus la confirmation qu'il vient
 * d'ouvrir.
 */
export function MenuActions({ libelle, actions }: { libelle: string; actions: ActionRangee[] }) {
  const [ouvert, setOuvert] = useState(false)
  const boite = useRef<HTMLDivElement>(null)
  const bouton = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!ouvert) return
    const auClavier = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setOuvert(false); bouton.current?.focus() }
    }
    const ailleurs = (e: MouseEvent) => {
      if (!boite.current?.contains(e.target as Node)) setOuvert(false)
    }
    document.addEventListener('keydown', auClavier)
    document.addEventListener('mousedown', ailleurs)
    return () => {
      document.removeEventListener('keydown', auClavier)
      document.removeEventListener('mousedown', ailleurs)
    }
  }, [ouvert])

  if (actions.length === 0) return null

  return (
    <div className="menu-actions" ref={boite}>
      <button
        ref={bouton}
        type="button"
        className="menu-actions-btn"
        aria-label={libelle}
        aria-haspopup="menu"
        aria-expanded={ouvert}
        onClick={() => setOuvert((v) => !v)}
      >
        {/* Trois points dessinés : à cette taille un caractère ne se cale pas. */}
        <span aria-hidden="true" style={{ display: 'flex', gap: 3 }}>
          <span style={{ width: 3, height: 3, borderRadius: 99, background: 'currentColor' }} />
          <span style={{ width: 3, height: 3, borderRadius: 99, background: 'currentColor' }} />
          <span style={{ width: 3, height: 3, borderRadius: 99, background: 'currentColor' }} />
        </span>
      </button>

      {ouvert && (
        <div className="menu-actions-panneau" role="menu">
          {actions.map((a) => (
            <button
              key={a.libelle}
              type="button"
              role="menuitem"
              className={`menu-actions-item${a.destructif ? ' destructif' : ''}`}
              onClick={() => { setOuvert(false); a.onClick() }}
            >
              {a.libelle}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
