import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['electron/__tests__/**/*.test.ts'],
    globals: false
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'electron')
    }
  }
})
