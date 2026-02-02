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
    storage: {
      provider: process.env.STORAGE_PROVIDER_DEFAULT || 'local',
      localRoot: process.env.STORAGE_LOCAL_ROOT || './storage'
    }
  }
})
