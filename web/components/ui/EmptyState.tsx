'use client'

/**
 * État vide explicite. Un tableau de bord d'inventaire passe l'essentiel de sa
 * vie à moitié rempli : chaque zone vide doit dire *pourquoi* elle est vide et
 * *quoi faire ensuite*, pas seulement « aucune donnée ».
 */
export function EmptyState({
  title,
  hint,
  action,
  tone = 'neutral',
}: {
  title: string
  hint?: string
  action?: React.ReactNode
  tone?: 'neutral' | 'ok'
}) {
  return (
    <div className={`empty-state${tone === 'ok' ? ' empty-state-ok' : ''}`}>
      <div className="empty-state-title">{title}</div>
      {hint && <p className="empty-state-hint">{hint}</p>}
      {action && <div className="empty-state-action">{action}</div>}
    </div>
  )
}
