import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import { defineVitestProject } from '@nuxt/test-utils/config'

export default defineConfig({
  test: {
    isolate: false,
    projects: [
      {
        test: {
          name: 'unit',
          include: ['test/unit/*.{test,spec}.ts'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'api',
          // Limit shared SQLite contention; global setup still runs before all workers.
          maxWorkers: 3,
          sequence: { groupOrder: 2 },
          include: ['test/api/*.{test,spec}.ts'],
          environment: 'node',
          globalSetup: ['test/scripts/api-global-setup.mjs'],
        },
      },
      await defineVitestProject({
        test: {
          name: 'nuxt',
          // The Nuxt project resolves separately and does not inherit root test options.
          isolate: false,
          setupFiles: ['test/nuxt/setup.ts'],
          // Component startup has a separate budget from shared-database API work.
          maxWorkers: 6,
          sequence: { groupOrder: 1 },
          // Test-utils v4 boots Nuxt inside beforeAll, including cold plugin compilation.
          hookTimeout: 30_000,
          include: ['test/nuxt/*.{test,spec}.ts'],
          environment: 'nuxt',
          environmentOptions: {
            nuxt: {
              rootDir: fileURLToPath(new URL('.', import.meta.url)),
              domEnvironment: 'happy-dom',
              overrides: {
                runtimeConfig: {
                  public: {
                    mdc: {
                      highlight: {
                        theme: {},
                        langs: [],
                      },
                    },
                  },
                },
              },
            },
          },
        },
      }),
    ],
    coverage: {
      enabled: false,
      provider: 'v8',
    },
  },
})
