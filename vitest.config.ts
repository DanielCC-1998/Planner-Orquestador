import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@domain': resolve('src/domain'),
      '@application': resolve('src/application'),
      '@infrastructure': resolve('src/infrastructure'),
      '@presentation': resolve('src/presentation'),
      '@shared': resolve('src/shared'),
      '@tests': resolve('tests')
    }
  },
  test: {
    include: ['tests/unit/**/*.test.ts', 'tests/unit/**/*.test.tsx'],
    environment: 'node',
    testTimeout: 20_000
  }
})
