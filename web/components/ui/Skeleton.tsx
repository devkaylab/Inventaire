'use client'

/**
 * Ossature de chargement. Remplace les « Chargement… » / « Calcul du rapport… »
 * en texte gris : la page garde sa forme pendant le chargement, donc elle ne
 * saute pas quand les données arrivent.
 */
export function Skeleton({ height = 16, width = '100%', radius = 8 }: {
  height?: number | string
  width?: number | string
  radius?: number
}) {
  return <div className="skeleton" style={{ height, width, borderRadius: radius }} aria-hidden="true" />
}

/** Plusieurs lignes d'ossature, pour une liste ou un tableau. */
export function SkeletonRows({ rows = 4, height = 56 }: { rows?: number; height?: number }) {
  return (
    <div className="skeleton-rows" aria-busy="true" aria-label="Chargement">
      {Array.from({ length: rows }, (_, i) => <Skeleton key={i} height={height} radius={12} />)}
    </div>
  )
}
