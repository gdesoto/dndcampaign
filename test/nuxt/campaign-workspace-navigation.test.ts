import { afterEach, expect, it, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import { flushPromises, type VueWrapper } from '@vue/test-utils'
import { clearNuxtData } from '#imports'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { useCampaignWorkspace } from '../../app/composables/useCampaignWorkspace'

const { request } = vi.hoisted(() => ({ request: vi.fn() }))
mockNuxtImport('useApi', () => () => ({ request }))
let wrapper: VueWrapper | undefined
afterEach(() => { wrapper?.unmount(); clearNuxtData() })

it('keeps campaign content mounted while session context reloads without leaking it to another campaign', async () => {
  const campaignId = ref('c1')
  const sessionId = ref('s1')
  const isSessionDetailRoute = ref(true)
  const response = {
    campaign: { id: 'c1', name: 'Campaign' },
    sessionHeader: { id: 's1', title: 'Session' },
    access: { permissions: ['content.write'] },
  }
  request.mockReset().mockResolvedValueOnce(response)
  let resolveRequest!: (value: unknown) => void
  request.mockImplementation(() => new Promise(resolve => { resolveRequest = resolve }))
  let mounts = 0
  const child = defineComponent({ setup() { mounts++; return () => h('p', 'Editor') } })
  let workspace!: Awaited<ReturnType<typeof useCampaignWorkspace>>
  wrapper = await mountSuspended(defineComponent({ async setup() {
    workspace = await useCampaignWorkspace({ campaignId, sessionId, isSessionDetailRoute })
    return () => workspace.campaign.value ? h(child) : h('p', 'Loading')
  } }))

  sessionId.value = ''
  isSessionDetailRoute.value = false
  await flushPromises()
  expect(workspace.pending.value).toBe(true)
  expect(wrapper.text()).toBe('Editor')
  expect(workspace.canWriteContent.value).toBe(true)
  expect(workspace.sessionHeader.value).toBeNull()
  resolveRequest({ ...response, sessionHeader: null })
  await flushPromises()
  expect(mounts).toBe(1)

  campaignId.value = 'c2'
  await flushPromises()
  expect(workspace.campaign.value).toBeUndefined()
  expect(workspace.canWriteContent.value).toBe(false)
  resolveRequest({ ...response, campaign: { id: 'c2', name: 'Other campaign' }, sessionHeader: null })
  await flushPromises()
})
