import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  test: {
    // Les modules testés sont volontairement sans React ni DOM : pas besoin de
    // jsdom, et c'est une bonne raison de les garder ainsi.
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
  resolve: {
    alias: { '@': path.resolve(__dirname) },
  },
})
