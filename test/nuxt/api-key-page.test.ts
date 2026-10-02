import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { clearNuxtData } from '#imports'
import ApiKeysPage from '../../app/pages/settings/api-keys.vue'
import Form from '../../app/components/account/api-keys/Form.vue'

const { request } = vi.hoisted(() => ({ request: vi.fn() }))
mockNuxtImport('useApi', () => () => ({ request }))
mockNuxtImport('useUnsavedChanges', () => vi.fn())

const baseKey = {
  id: 'key-1',
  name: 'Road assistant',
  prefix: 'dnd_live_',
  campaignIds: ['campaign-1'],
  permissions: ['campaign.read'],
  expiresAt: '2026-09-21T10:11:12.345Z',
  lastUsedAt: null,
  revokedAt: null,
  createdAt: '2026-09-20T10:11:12.345Z',
}

const FormStub = defineComponent({
  name: 'AccountApiKeysForm',
  props: {
    initial: { type: Object, default: undefined },
    editing: { type: Boolean, default: false },
    submitting: { type: Boolean, default: false },
  },
  emits: ['submit', 'cancel', 'clear'],
  setup(_, { expose }) {
    const reset = vi.fn()
    const markSubmitted = vi.fn()
    expose({ dirty: false, reset, markSubmitted })
    return { reset }
  },
  template: '<div data-testid="api-key-form" />',
})

const ListStub = defineComponent({
  name: 'AccountApiKeysList',
  emits: ['edit'],
  template: '<div data-testid="api-key-list" />',
})

const stubs = {
  AccountApiKeysForm: FormStub,
  AccountApiKeysList: ListStub,
  AccountApiKeysSecretReveal: { template: '<div data-testid="secret-reveal" />' },
  UCard: { template: '<section><slot name="header" /><slot /></section>' },
  UAlert: { props: ['description'], template: '<div role="alert">{{ description }}</div>' },
  UButton: { template: '<button><slot /></button>' },
  UBadge: { template: '<span><slot /></span>' },
  USkeleton: { template: '<div />' },
}

const mountPage = () => mountSuspended(ApiKeysPage, {
  global: { stubs },
})

describe('account API key page mutations', () => {
  beforeEach(() => {
    request.mockReset()
    request.mockImplementation(async (url: string, options?: { method?: string }) => {
      if (url === '/api/account/api-keys' && !options) return { keys: [baseKey] }
      if (url === '/api/campaigns') return [{ id: 'campaign-1', name: 'The Old Road' }]
      if (options?.method === 'PATCH') return baseKey
      if (options?.method === 'POST') return { key: baseKey, secret: 'secret-once' }
      return { keys: [baseKey] }
    })
  })

  afterEach(() => {
    clearNuxtData('account-api-keys')
    clearNuxtData('account-api-key-campaigns')
  })

  it('preserves the exact expiration timestamp when an edit leaves it unchanged', async () => {
    const wrapper = await mountPage()
    await flushPromises()
    const list = wrapper.findComponent(ListStub)
    await list.vm.$emit('edit', baseKey)
    await flushPromises()

    const form = wrapper.findComponent(FormStub)
    const initial = form.props('initial') as { name: string; campaignIds: string[]; expiresAt: string; permissions: Record<string, { read: boolean; write: boolean }> }
    await form.vm.$emit('submit', { ...initial, permissions: { campaign: { read: true, write: false } } })
    await flushPromises()

    const patchCall = request.mock.calls.find(([, options]) => options?.method === 'PATCH')
    expect(patchCall?.[1].body.expiresAt).toBe(baseKey.expiresAt)
  })

  it('reports an invalid expiration and resets submitting state without making a request', async () => {
    const wrapper = await mountPage()
    await flushPromises()
    const form = wrapper.findComponent(FormStub)
    const before = request.mock.calls.length
    await form.vm.$emit('submit', {
      name: 'New key',
      campaignIds: ['campaign-1'],
      permissions: { campaign: { read: true, write: false } },
      expiresAt: 'not-a-date',
    })
    await flushPromises()

    expect(request.mock.calls).toHaveLength(before)
    expect(wrapper.text()).toContain('Enter a valid expiration date.')
    expect(form.props('submitting')).toBe(false)
  })

  it('clears create feedback and resets the draft when requested', async () => {
    const wrapper = await mountPage()
    await flushPromises()
    const form = wrapper.findComponent(FormStub)
    await form.vm.$emit('submit', {
      name: 'New key',
      campaignIds: ['campaign-1'],
      permissions: { campaign: { read: true, write: false } },
      expiresAt: '',
    })
    await flushPromises()
    expect(wrapper.text()).toContain('API key created.')

    await form.vm.$emit('clear')
    expect(wrapper.text()).not.toContain('API key created.')
    expect((form.vm as unknown as { reset: ReturnType<typeof vi.fn> }).reset).toHaveBeenCalled()
  })
})

describe('account API key form', () => {
  const campaigns = [{ id: 'campaign-1', name: 'The Old Road' }]

  const mountForm = () => mountSuspended(Form, {
    props: { campaigns },
    global: {
      stubs: {
        UForm: { emits: ['submit'], template: '<form @submit.prevent="$emit(\'submit\')"><slot /></form>' },
        UFormField: { props: ['label', 'description'], template: '<label><span>{{ label }}</span><slot /></label>' },
        UInput: {
          props: ['modelValue', 'type'],
          emits: ['update:modelValue'],
          template: '<input :type="type || \'text\'" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
        },
        USelectMenu: {
          props: ['modelValue', 'items'],
          emits: ['update:modelValue'],
          template: '<select multiple @change="$emit(\'update:modelValue\', items.map(item => item.id))"><option v-for="item in items" :key="item.id">{{ item.name }}</option></select>',
        },
        USwitch: {
          props: ['modelValue'],
          emits: ['update:modelValue'],
          template: '<button type="button" @click="$emit(\'update:modelValue\', !modelValue)">switch</button>',
        },
        UButton: { template: '<button type="submit"><slot /></button>' },
        UAlert: { props: ['description'], template: '<div role="alert">{{ description }}<slot /></div>' },
      },
    },
  })

  it('requires a name, campaigns, and at least one permission', async () => {
    const wrapper = await mountForm()
    await wrapper.find('form').trigger('submit')
    expect(wrapper.text()).toContain('Enter a name for this API key.')
  })

  it('emits the draft with independent access controls', async () => {
    const wrapper = await mountForm()
    await wrapper.find('input').setValue('Road assistant')
    await wrapper.find('select').trigger('change')
    await wrapper.find('button[type="button"]').trigger('click')
    await wrapper.find('form').trigger('submit')

    const submission = wrapper.emitted('submit')?.[0]?.[0] as { name: string; campaignIds: string[]; permissions: Record<string, { read: boolean; write: boolean }> }
    expect(submission.name).toBe('Road assistant')
    expect(submission.campaignIds).toEqual(['campaign-1'])
    expect(submission.permissions.campaign?.read).toBe(true)
    expect(submission.permissions.campaign?.write).toBe(false)
  })
})
