import path from 'node:path'
import { defineConfig } from 'vitest/config'

// Tests unitaires de la logique pure de `src/lib/` (hors ligne, erreurs…).
// Volontairement limité aux modules sans dépendance native : ils tournent en
// Node, sans simulateur ni build, donc en quelques centaines de millisecondes.
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
  },
})
