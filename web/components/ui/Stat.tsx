'use client'

export type Tone = 'neutral' | 'pos' | 'neg' | 'warn' | 'accent'

/** Chiffre-clé d'un bloc de synthèse (articles comptés, écart, démarque…). */
export function Stat({ label, value, tone = 'neutral', sub }: {
  label: string
  value: string
  tone?: Tone
  sub?: string
}) {
  return (
    <div className="dash-stat">
      <div className={`dash-stat-value num${tone !== 'neutral' ? ` ${tone}` : ''}`}>{value}</div>
      <div className="dash-stat-label">{label}</div>
      {sub && <div className="dash-stat-sub">{sub}</div>}
    </div>
  )
}

/** Petite paire libellé/valeur alignée, utilisée dans les lignes d'écart. */
export function Figure({ label, value, tone = 'neutral' }: {
  label: string
  value: string
  tone?: Tone
}) {
  return (
    <div className="figure">
      <div className="figure-label">{label}</div>
      <div className={`figure-value num${tone !== 'neutral' ? ` ${tone}` : ''}`}>{value}</div>
    </div>
  )
}
