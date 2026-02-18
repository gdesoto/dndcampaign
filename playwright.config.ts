import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './test/e2e',
  timeout: 120_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',
  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: {
    command: 'node test/scripts/run-e2e-server.mjs',
    url: 'http://127.0.0.1:4173/login',
    timeout: 240_000,
    reuseExistingServer: false,
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        nuxt: {
          host: 'http://127.0.0.1:4173',
          browser: false,
          server: false,
        },
      },
    },
  ],
})
