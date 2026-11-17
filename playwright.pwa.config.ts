import { defineConfig, devices } from '@playwright/test'

// Run after pnpm build: the development server intentionally has no service worker.
export default defineConfig({
  testDir: './test/pwa',
  timeout: 120_000,
  expect: { timeout: 15_000 },
  reporter: 'list',
  use: {
    ...devices['Desktop Chrome'],
    baseURL: 'http://127.0.0.1:4173',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'node test/scripts/run-e2e-server.mjs --production',
    url: 'http://127.0.0.1:4173/login',
    timeout: 120_000,
    reuseExistingServer: false,
  },
})
