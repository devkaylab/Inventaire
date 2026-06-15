// ─── Compat shim ──────────────────────────────────────────────────────────────
// The design system now lives in `./ink.ts` with light + dark palettes and is
// consumed per-component via `useTheme()` (src/lib/theme.tsx).
//
// This module is kept so any not-yet-migrated import of `{ Colors, passLabel }`
// keeps compiling. `Colors` points at the dark palette (the app's default theme).

export { darkTheme as Colors } from './ink'

export const PASS_LABELS: Record<number, string> = {
  1: 'Compte',
  2: 'Audit',
  3: 'Arbitrage',
}

export function passLabel(n: number): string {
  return PASS_LABELS[n] ?? `Passe ${n}`
}
