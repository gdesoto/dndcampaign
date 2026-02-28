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
