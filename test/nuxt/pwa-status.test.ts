import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { nextTick, reactive } from 'vue'
import { useNuxtApp } from '#app'
import PwaStatus from '../../app/components/shared/PwaStatus.vue'

const pwa = reactive({ needRefresh: false, registrationError: false, updateServiceWorker: vi.fn() })
beforeAll(() => { useNuxtApp().provide('pwa', pwa) })

afterEach(() => {
  vi.restoreAllMocks()
  pwa.needRefresh = false
  pwa.registrationError = false
})

describe('PWA feedback', () => {
  it('keeps updates passive and dismissible, including while offline, without activating or reloading', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    pwa.needRefresh = true
    const wrapper = await mountSuspended(PwaStatus)
    expect(wrapper.text()).toContain("You're offline")
    expect(wrapper.text()).toContain('Keep this page open')
    expect(wrapper.text()).toContain('close all DM Vault tabs and windows')
    expect(wrapper.text()).not.toContain('ready to work offline')
    expect(pwa.updateServiceWorker).not.toHaveBeenCalled()

    await wrapper.get('[aria-label="Update notice"] button').trigger('click')
    expect(wrapper.text()).not.toContain('Update available')
    expect(wrapper.text()).toContain("You're offline")
    await wrapper.get('[aria-label="Offline notice"] button').trigger('click')
    expect(wrapper.text()).toBe('')

    window.dispatchEvent(new Event('offline'))
    await nextTick()
    expect(wrapper.text()).toContain("You're offline")
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true)
    window.dispatchEvent(new Event('online'))
    await nextTick()
    expect(wrapper.text()).toBe('')
    expect(pwa.updateServiceWorker).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('reports registration failure without blocking online use', async () => {
    pwa.registrationError = true
    const wrapper = await mountSuspended(PwaStatus)
    expect(wrapper.text()).toContain('App setup incomplete')
    expect(wrapper.text()).toContain('keep using DM Vault online')
    await wrapper.get('[aria-label="App setup notice"] button').trigger('click')
    expect(wrapper.text()).toBe('')
    wrapper.unmount()
  })

  it('uses the same passive notice for Nuxt build changes and missing route chunks', async () => {
    const wrapper = await mountSuspended(PwaStatus)
    await useNuxtApp().callHook('app:manifest:update', { id: 'next-build', timestamp: Date.now() })
    await nextTick()
    expect(wrapper.text()).toContain('Update available')
    await wrapper.get('[aria-label="Update notice"] button').trigger('click')
    expect(wrapper.text()).toBe('')
    await useNuxtApp().callHook('app:chunkError', { error: new Error('Old chunk unavailable') })
    await nextTick()
    expect(wrapper.text()).toContain('Update available')
    expect(pwa.updateServiceWorker).not.toHaveBeenCalled()
    wrapper.unmount()
  })
})
