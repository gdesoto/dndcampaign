import { afterAll, afterEach } from 'vitest'
import { config, disableAutoUnmount, enableAutoUnmount } from '@vue/test-utils'
import { useNuxtApp } from '#app'

// Files share a worker now: restore suite-level stubs and dispose mounted
// components even when an assertion prevents a test's explicit unmount.
const originalStubs = { ...config.global.stubs }
enableAutoUnmount(afterEach)

afterAll(() => {
  config.global.stubs = originalStubs
  disableAutoUnmount()
  // Test-utils boots a fresh Nuxt app for each file in the reused DOM.
  useNuxtApp().vueApp.unmount()
})
