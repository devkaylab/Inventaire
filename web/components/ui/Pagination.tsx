'use client'

import { useEffect, useRef } from 'react'
import { nb } from '@/lib/format'

/**
 * Les boutons de page d'un long tableau (3 septembre 2026).
 *
 * ⚠️ ILS SE RENDENT AU-DESSUS *ET* EN DESSOUS DU TABLEAU. Constat de Julien :
 * sur un écran de 14 pouces — la taille de travail habituelle — cinquante
 * lignes dépassent la fenêtre, et les boutons du bas restent hors de vue.
 * On ne fait pas descendre quelqu'un jusqu'en bas pour tourner une page.
 *
 * `pages <= 1` n'affiche que le décompte : deux rangées de boutons inertes
 * autour d'un tableau qui tient sur une page n'apprendraient rien.
 */
export function Pagination({ page, pages, chargement, onPage, children }: {
  /** Page courante, à partir de 0. */
  page: number
  /** Nombre total de pages, au moins 1. */
  pages: number
  /** Une page est en cours de chargement : on n'en demande pas une seconde. */
  chargement?: boolean
  onPage: (p: number) => void
  /** Le décompte « 1–50 sur 400 000 », rendu à gauche. */
  children?: React.ReactNode
}) {
  if (pages <= 1) return children ? <div className="pagination">{children}</div> : null
  return (
    <div className="pagination">
      {children ?? <span />}
      <div className="pagination-boutons">
        <button
          type="button" className="btn btn-ghost btn-sm"
          disabled={page === 0 || chargement}
          onClick={() => onPage(Math.max(0, page - 1))}
        >
          Précédent
        </button>
        <span className="muted small">Page {page + 1} / {nb(pages)}</span>
        <button
          type="button" className="btn btn-ghost btn-sm"
          disabled={page + 1 >= pages || chargement}
          onClick={() => onPage(page + 1)}
        >
          Suivant
        </button>
      </div>
    </div>
  )
}

/**
 * Ramène le haut du tableau sous les yeux au changement de page.
 *
 * ⚠️ PAS AU PREMIER RENDU : on arriverait sur l'onglet en faisant sauter la
 * page, alors que personne n'a rien demandé. Le repère est posé sur l'élément
 * qui ouvre le tableau, jamais sur la fenêtre entière — l'en-tête et les
 * tuiles de synthèse doivent rester où ils sont.
 */
export function useRetourEnHaut(page: number) {
  const repere = useRef<HTMLDivElement>(null)
  const premier = useRef(true)
  useEffect(() => {
    if (premier.current) { premier.current = false; return }
    repere.current?.scrollIntoView({ block: 'start' })
  }, [page])
  return repere
}
