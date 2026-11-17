import { fileURLToPath } from 'node:url'

const apiErrorHandler = fileURLToPath(new URL('./server/error-handler.ts', import.meta.url)).replace(/\\/g, '/')

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  vue: {
    compilerOptions: {
      isCustomElement: tag => ['video-player', 'video-neutral-skin', 'audio-neutral-skin'].includes(tag)
    }
  },
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
  experimental: {
    // A new build or missing route chunk must not reload an open player or editor.
    emitRouteChunkError: 'manual'
  },
  app: {
    head: {
      htmlAttrs: { lang: 'en' },
      meta: [
        { name: 'theme-color', content: '#211712' },
        { name: 'mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-title', content: 'DM Vault' },
        { name: 'apple-mobile-web-app-status-bar-style', content: 'default' }
      ],
      link: [
        { rel: 'apple-touch-icon', sizes: '180x180', href: '/icons/apple-touch-icon.png' },
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
    '@nuxt/test-utils',
    '@nuxt/ui',
    'nuxt-auth-utils',
    '@nuxt/eslint',
    '@nuxtjs/mdc',
    '@vite-pwa/nuxt'
  ],
  pwa: {
    registerType: 'prompt',
    registerWebManifestInRouteRules: true,
    manifest: {
      id: '/',
      name: 'DM Vault',
      short_name: 'DM Vault',
      description: 'Your campaign desk for tabletop adventures, sessions, and recaps.',
      lang: 'en',
      start_url: '/',
      scope: '/',
      display: 'standalone',
      background_color: '#211712',
      theme_color: '#211712',
      icons: [
        { src: '/icons/pwa-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: '/icons/pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
        { src: '/icons/pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
      ]
    },
    client: { periodicSyncForUpdates: 60 * 60 },
    generateSW: {
      skipWaiting: false,
      clientsClaim: false,
      navigateFallback: null,
      // Only public branding, the offline notice, and public build identity (for update detection).
      // The module adds Nuxt's public build metadata to these globs.
      globPatterns: ['offline.html', 'favicon.svg', 'icons/*.png'],
      globIgnores: ['**/_payload.json', '_nuxt/builds/latest.json'],
      // Keep the static .html URL; Nuxt's default transform rewrites it as an app route.
      manifestTransforms: [manifest => ({ manifest, warnings: [] })],
      runtimeCaching: [{
        urlPattern: ({ request, url }) => request.mode === 'navigate'
          && !/^\/api(?:\/|$)/.test(url.pathname) && !request.headers.has('range'),
        handler: 'NetworkOnly',
        options: { precacheFallback: { fallbackURL: '/offline.html' } }
      }]
    }
  },
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
      cookie: {
        sameSite: 'lax',
        secure: false
      }
    },
    public: {
      appUrl: ''
    },
    // Test-only: unsafe in production because clients can set X-Forwarded-For.
    rateLimit: {
      trustForwardedFor: false
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
