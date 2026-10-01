import { defineConfig } from '@playwright/test'

/** E2E tests on the built Electron app (`pnpm test:e2e` builds it first). */
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 90_000,
  expect: { timeout: 10_000 },
  workers: 1,
  reporter: [['list']],
  use: { trace: 'retain-on-failure' }
})
