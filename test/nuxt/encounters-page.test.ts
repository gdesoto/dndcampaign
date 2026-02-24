import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { mountSuspended, mockNuxtImport } from '@nuxt/test-utils/runtime'
import EncountersPage from '../../app/pages/campaigns/[campaignId]/encounters/index.vue'

const mockListEncounters = vi.fn()
const mockCreateEncounter = vi.fn()
const mockListStatBlocks = vi.fn()
const mockCreateStatBlock = vi.fn()
const mockUpdateStatBlock = vi.fn()
const mockDeleteStatBlock = vi.fn()
const mockListTemplates = vi.fn()
const mockCreateTemplate = vi.fn()
const mockUpdateTemplate = vi.fn()
const mockDeleteTemplate = vi.fn()
const mockInstantiateTemplate = vi.fn()
const mockRequest = vi.fn()

mockNuxtImport('useRoute', () => () => ({
  params: { campaignId: 'campaign-1' },
}))

vi.mock('~/composables/useEncounterList', () => ({
  useEncounterList: () => ({
    listEncounters: mockListEncounters,
    createEncounter: mockCreateEncounter,
  }),
}))

vi.mock('~/composables/useEncounterStatBlocks', () => ({
  useEncounterStatBlocks: () => ({
    listStatBlocks: mockListStatBlocks,
    createStatBlock: mockCreateStatBlock,
    updateStatBlock: mockUpdateStatBlock,
    deleteStatBlock: mockDeleteStatBlock,
  }),
}))

vi.mock('~/composables/useEncounterTemplates', () => ({
  useEncounterTemplates: () => ({
    listTemplates: mockListTemplates,
    createTemplate: mockCreateTemplate,
    updateTemplate: mockUpdateTemplate,
    deleteTemplate: mockDeleteTemplate,
    instantiateTemplate: mockInstantiateTemplate,
  }),
}))

mockNuxtImport('useApi', () => () => ({
  request: mockRequest,
}))

describe('Campaign encounters page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockListStatBlocks.mockResolvedValue([])
    mockListTemplates.mockResolvedValue([])
    mockRequest.mockImplementation(async (path: string) => {
      if (String(path).includes('/sessions')) return []
      if (String(path).includes('/calendar-config')) return null
      return []
    })
    mockListEncounters.mockResolvedValue([
      {
        id: 'enc-1',
        campaignId: 'campaign-1',
        sessionId: null,
        name: 'Roadside Ambush',
        type: 'COMBAT',
        status: 'PLANNED',
        visibility: 'SHARED',
        currentRound: 1,
        currentTurnIndex: 0,
        createdByUserId: 'user-1',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ])
  })

  it('shows read-only state for viewers', async () => {
    const wrapper = await mountSuspended(EncountersPage, {
      global: {
        provide: {
          campaignCanWriteContent: ref(false),
        },
      },
    })

    expect(wrapper.text()).toContain('Read-only access')
    const button = wrapper.findAll('button').find((entry) => entry.text().includes('New encounter'))
    expect(button?.attributes('disabled')).toBeDefined()
  })

  it('renders encounter entries from API', async () => {
    const wrapper = await mountSuspended(EncountersPage, {
      global: {
        provide: {
          campaignCanWriteContent: ref(true),
        },
      },
    })

    expect(wrapper.text()).toContain('Roadside Ambush')
    expect(wrapper.text()).toContain('PLANNED')
    expect(wrapper.text()).toContain('Stat block library')
    expect(wrapper.text()).toContain('Encounter template library')
  })
})
