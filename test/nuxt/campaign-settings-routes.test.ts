import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { flushPromises, type VueWrapper } from '@vue/test-utils'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { NuxtPage } from '#components'
import { useState, clearNuxtData, clearNuxtState } from '#imports'

const { request, toastAdd } = vi.hoisted(() => ({ request: vi.fn(), toastAdd: vi.fn() }))
mockNuxtImport('useApi', () => () => ({ request }))
mockNuxtImport('useToast', () => () => ({ add: toastAdd }))
mockNuxtImport('useOverlay', () => () => ({ create: () => ({ open: () => ({ result: Promise.resolve(true) }), close: vi.fn() }) }))

const stubs = { UTooltip: { template: '<div><slot /></div>' } }
const campaign = { id: 'c1', name: 'Shattered Crown', system: 'D&D 5e', dungeonMasterName: 'Mira', description: 'A kingdom in ruins.', currentStatus: '', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' }
let wrapper: VueWrapper | undefined
let failPatch = false

beforeAll(async () => {
  // Compile the lazy route components before the per-test timeout starts.
  await Promise.all([
    import('../../app/pages/campaigns/[campaignId].vue'),
    import('../../app/pages/campaigns/[campaignId]/settings.vue'),
    import('../../app/pages/campaigns/[campaignId]/settings/index.vue'),
    import('../../app/pages/campaigns/[campaignId]/settings/members.vue'),
  ])
})

beforeEach(() => {
  clearNuxtData()
  clearNuxtState()
  useState('nuxt-session').value = { user: { id: 'u1' } }
  useState('nuxt-auth-ready').value = true
  failPatch = false
  toastAdd.mockClear()
  request.mockReset().mockImplementation(async (url: string, options?: { method?: string }) => {
    if (url === '/api/campaigns/c1/workspace') {
      return { campaign: { id: 'c1', name: campaign.name }, sessionHeader: null, access: { campaignId: 'c1', role: 'OWNER', hasDmAccess: true, permissions: ['content.write', 'campaign.update', 'campaign.members.manage', 'campaign.settings.manage', 'campaign.public.manage'] } }
    }
    if (url === '/api/campaigns/c1/members') {
      return {
        campaignId: 'c1', campaignName: campaign.name, pendingInvites: [],
        members: [{ id: 'm1', userId: 'u1', role: 'OWNER', hasDmAccess: true, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', user: { id: 'u1', email: 'owner@example.com', name: 'Owner One', avatarUrl: null } }],
      }
    }
    if (url === '/api/campaigns/c1' && options?.method === 'PATCH') {
      if (failPatch) throw new Error('Name already taken.')
      return campaign
    }
    if (url === '/api/campaigns/c1') return campaign
    throw new Error(`Unexpected request: ${url}`)
  })
})
afterEach(() => { wrapper?.unmount(); wrapper = undefined })

async function open(path: string) {
  wrapper = await mountSuspended(defineComponent({ render: () => h(NuxtPage) }), { route: path, global: { stubs } })
  await flushPromises()
  return wrapper
}

describe('campaign settings routes', () => {
  it('deep-links to the members panel inside the shared settings navigation', async () => {
    const page = await open('/campaigns/c1/settings/members')
    await vi.waitFor(() => expect(page.text()).toContain('Owner One'))
    expect(page.text()).toContain('Campaign settings')
    expect(page.text()).toContain('Invite a member')
    expect(page.text()).not.toContain('Campaign details')
    const links = page.findAll('nav a').map(link => link.attributes('href'))
    expect(links).toEqual(['/campaigns/c1/settings', '/campaigns/c1/settings/calendar', '/campaigns/c1/settings/members', '/campaigns/c1/settings/public'])
  })

  it('saves general campaign details and keeps input when the save fails', async () => {
    const page = await open('/campaigns/c1/settings')
    await vi.waitFor(() => expect(page.text()).toContain('Campaign details'))
    const nameInput = page.get('input[name="name"]')
    expect((nameInput.element as HTMLInputElement).value).toBe('Shattered Crown')

    failPatch = true
    await nameInput.setValue('Broken Crown')
    await page.find('form').trigger('submit')
    await vi.waitFor(() => expect(page.text()).toContain('Name already taken.'))
    expect((nameInput.element as HTMLInputElement).value).toBe('Broken Crown')
    expect(toastAdd).not.toHaveBeenCalled()

    failPatch = false
    await page.find('form').trigger('submit')
    await vi.waitFor(() => expect(toastAdd).toHaveBeenCalledWith(expect.objectContaining({ title: 'Campaign saved' })))
    const patches = request.mock.calls.filter(([, options]) => options?.method === 'PATCH')
    expect(patches.at(-1)).toEqual(['/api/campaigns/c1', { method: 'PATCH', body: { name: 'Broken Crown', system: 'D&D 5e', dungeonMasterName: 'Mira', description: 'A kingdom in ruins.' } }])
    expect(page.text()).not.toContain('Name already taken.')
  })
})
