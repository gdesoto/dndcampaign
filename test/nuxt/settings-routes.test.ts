import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { NuxtPage } from '#components'
import { clearNuxtData, clearNuxtState, useRouter, useState } from '#imports'

const { request } = vi.hoisted(() => ({ request: vi.fn() }))
mockNuxtImport('useApi', () => () => ({ request }))
mockNuxtImport('useUserSession', () => () => ({
  loggedIn: ref(true),
  ready: ref(true),
  fetch: vi.fn(),
  user: ref({ id: 'user-1', systemRole: 'USER' }),
}))

const stubs = {
  AccountSettingsPanel: { template: '<section data-testid="settings-panel">Account profile</section>' },
  AccountApiKeysForm: { template: '<section data-testid="api-key-form">Create an API key</section>' },
  AccountApiKeysList: { template: '<section data-testid="api-key-list">Your API keys</section>' },
  AccountApiKeysSecretReveal: { template: '<section data-testid="secret-reveal" />' },
  UPage: { template: '<div><slot /></div>' },
  UPageBody: { template: '<div data-testid="account-page-body"><slot /></div>' },
  UPageHeader: { props: ['title'], template: '<header><h1>{{ title }}</h1><slot /></header>' },
  UNavigationMenu: { template: '<nav data-testid="account-navigation" />' },
  UCard: { template: '<section><slot name="header" /><slot /></section>' },
  UAlert: { template: '<div><slot /></div>' },
  UButton: { template: '<button><slot /></button>' },
  UBadge: { template: '<span><slot /></span>' },
  USkeleton: { template: '<div />' },
}

const mountRoute = async (path: string) => mountSuspended(defineComponent({ render: () => h(NuxtPage) }), {
  route: path,
  global: { stubs },
})

describe('account settings routes', () => {
  afterEach(() => {
    clearNuxtData()
    clearNuxtState()
    request.mockReset()
  })

  it('renders the existing settings panel at /settings', async () => {
    useState('nuxt-session').value = { user: { id: 'user-1', systemRole: 'USER' } }
    useState('nuxt-auth-ready').value = true
    const wrapper = await mountRoute('/settings')
    await flushPromises()
    expect(useRouter().currentRoute.value.path).toBe('/settings')
    expect(wrapper.find('[data-testid="settings-panel"]').exists()).toBe(true)
    expect(wrapper.findAll('h1')).toHaveLength(1)
    expect(wrapper.findAll('[data-testid="account-navigation"]')).toHaveLength(1)
    wrapper.unmount()
  })

  it('renders the API key panel at the nested settings route', async () => {
    useState('nuxt-session').value = { user: { id: 'user-1', systemRole: 'USER' } }
    useState('nuxt-auth-ready').value = true
    request.mockImplementation(async (url: string) => url === '/api/account/api-keys' ? { keys: [] } : [])
    const wrapper = await mountRoute('/settings/api-keys')
    await flushPromises()
    expect(useRouter().currentRoute.value.path).toBe('/settings/api-keys')
    expect(wrapper.find('[data-testid="api-key-form"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="settings-panel"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="account-navigation"]').exists()).toBe(true)
    expect(wrapper.findAll('h1')).toHaveLength(1)
    expect(wrapper.findAll('[data-testid="account-navigation"]')).toHaveLength(1)
    wrapper.unmount()
  })
})
