import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import { defineVitestProject } from '@nuxt/test-utils/config'

export default defineConfig({
  test: {
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
          // Bound shared-DB contention after the CPU-heavy Nuxt/unit phase.
          maxWorkers: 3,
          sequence: { groupOrder: 1 },
          include: ['test/api/*.{test,spec}.ts'],
          environment: 'node',
          globalSetup: ['test/scripts/api-global-setup.mjs'],
        },
      },
      await defineVitestProject({
        test: {
          name: 'nuxt',
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
