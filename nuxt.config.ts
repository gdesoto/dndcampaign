import { fileURLToPath } from 'node:url'

const apiErrorHandler = fileURLToPath(new URL('./server/error-handler.ts', import.meta.url)).replace(/\\/g, '/')

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  hooks: {
    // Run the API envelope error handler before Nuxt's HTML error page handler.
    'nitro:config'(config) {
      const existing = config.errorHandler
        ? Array.isArray(config.errorHandler) ? config.errorHandler : [config.errorHandler]
        : []
      config.errorHandler = [apiErrorHandler, ...existing]
    },
  },
  devtools: {
    enabled: false
  },
  app: {
    head: {
      link: [
        {
          rel: 'icon',
          type: 'image/svg+xml',
          href: '/favicon.svg'
        },
        {
          rel: 'icon',
          type: 'image/x-icon',
          href: '/favicon.ico'
        }
      ]
    }
  },
  css: ['~/assets/css/main.css'],
  modules: [
    '@nuxt/icon',
    '@nuxt/image',
    '@nuxt/test-utils',
    '@nuxt/ui',
    'nuxt-auth-utils',
    '@nuxt/eslint',
    '@nuxtjs/mdc'
  ],
  vite: {
    optimizeDeps: {
      include: ['zod', 'maplibre-gl', 'rehype-sanitize']
    }
  },
  mdc: {
    remarkPlugins: {
      'remark-gfm': {
        src: 'remark-gfm'
      }
    },
    rehypePlugins: {
      'rehype-sanitize': {
        src: 'rehype-sanitize'
      }
    }
  },
  colorMode: {
    preference: 'system',
    fallback: 'dark',
    classSuffix: ''
  },
  runtimeConfig: {
    session: {
      password: '',
      cookie: {
        sameSite: 'lax',
        secure: false
      }
    },
    public: {
      appUrl: ''
    },
    storage: {
      provider: 'local',
      localRoot: './storage'
    },
    elevenlabs: {
      apiKey: '',
      webhookSecret: '',
      webhookId: ''
    },
    n8n: {
      webhookUrlDefault: '',
      webhookSecret: ''
    }
  }
})
