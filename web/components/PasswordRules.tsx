'use client'

import { checkPassword, PASSWORD_RULES } from '@/lib/password'

/**
 * Les exigences du mot de passe, cochées à mesure de la frappe.
 *
 * Annoncées d'emblée plutôt qu'au refus : la personne voit ce qu'on attend
 * d'elle pendant qu'elle compose, au lieu de le découvrir critère par critère
 * en enchaînant les erreurs.
 */
export function PasswordRules({ password }: { password: string }) {
  const c = checkPassword(password)
  return (
    <ul className="pwd-rules" aria-label="Exigences du mot de passe">
      {PASSWORD_RULES.map(r => (
        <li key={r.key} className={c[r.key] ? 'ok' : undefined}>
          <span aria-hidden="true">{c[r.key] ? '✓' : '·'}</span>
          {r.label}
        </li>
      ))}
    </ul>
  )
}
