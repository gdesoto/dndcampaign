// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  css: ['~/assets/css/main.css'],
  modules: [
    '@nuxt/icon',
    '@nuxt/image',
    '@nuxt/test-utils',
    '@nuxt/ui',
    '@pinia/nuxt',
    'nuxt-auth-utils'
  ],
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
