import { afterAll, afterEach } from 'vitest'
import { enableAutoUnmount } from '@vue/test-utils'
import { useNuxtApp } from '#app'

enableAutoUnmount(afterEach)

afterAll(() => useNuxtApp().vueApp.unmount())
