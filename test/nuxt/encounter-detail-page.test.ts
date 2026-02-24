import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { mountSuspended, mockNuxtImport } from '@nuxt/test-utils/runtime'
import EncounterDetailPage from '../../app/pages/campaigns/[campaignId]/encounters/[encounterId].vue'

const mockGetEncounter = vi.fn()
const mockUpdateEncounter = vi.fn()
const mockGetSummary = vi.fn()
const mockAddNoteEvent = vi.fn()
const mockListTemplates = vi.fn()
const mockInstantiateTemplate = vi.fn()
const mockListStatBlocks = vi.fn()
const mockRuntime = {
  start: vi.fn(),
  pause: vi.fn(),
  resume: vi.fn(),
  complete: vi.fn(),
  abandon: vi.fn(),
  rollInitiative: vi.fn(),
  reorderInitiative: vi.fn(),
  advanceTurn: vi.fn(),
  rewindTurn: vi.fn(),
  setActiveTurn: vi.fn(),
  createCombatant: vi.fn(),
  updateCombatant: vi.fn(),
  deleteCombatant: vi.fn(),
  applyDamage: vi.fn(),
  applyHeal: vi.fn(),
  addCondition: vi.fn(),
  updateCondition: vi.fn(),
  deleteCondition: vi.fn(),
}
const mockRequest = vi.fn()

mockNuxtImport('useRoute', () => () => ({
  params: { campaignId: 'campaign-1', encounterId: 'enc-1' },
}))

mockNuxtImport('useApi', () => () => ({
  request: mockRequest,
}))

vi.mock('~/composables/useEncounterDetail', () => ({
  useEncounterDetail: () => ({
    getEncounter: mockGetEncounter,
    updateEncounter: mockUpdateEncounter,
    deleteEncounter: vi.fn(),
    getSummary: mockGetSummary,
    getEvents: vi.fn(),
    addNoteEvent: mockAddNoteEvent,
  }),
}))

vi.mock('~/composables/useEncounterRuntime', () => ({
  useEncounterRuntime: () => mockRuntime,
}))

vi.mock('~/composables/useEncounterTemplates', () => ({
  useEncounterTemplates: () => ({
    listTemplates: mockListTemplates,
    createTemplate: vi.fn(),
    updateTemplate: vi.fn(),
    deleteTemplate: vi.fn(),
    instantiateTemplate: mockInstantiateTemplate,
  }),
}))

vi.mock('~/composables/useEncounterStatBlocks', () => ({
  useEncounterStatBlocks: () => ({
    listStatBlocks: mockListStatBlocks,
    createStatBlock: vi.fn(),
    updateStatBlock: vi.fn(),
    deleteStatBlock: vi.fn(),
  }),
}))

describe('Encounter detail page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.scrollTo = vi.fn()

    mockGetEncounter.mockResolvedValue({
      id: 'enc-1',
      campaignId: 'campaign-1',
      sessionId: null,
      name: 'Bridge Ambush',
      type: 'COMBAT',
      status: 'PLANNED',
      visibility: 'SHARED',
      notes: null,
      calendarYear: null,
      calendarMonth: null,
      calendarDay: null,
      currentRound: 1,
      currentTurnIndex: 0,
      createdByUserId: 'user-1',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      combatants: [
        {
          id: 'combatant-1',
          encounterId: 'enc-1',
          name: 'Bandit',
          side: 'ENEMY',
          sourceType: 'CUSTOM',
          sourceCampaignCharacterId: null,
          sourcePlayerCharacterId: null,
          sourceGlossaryEntryId: null,
          sourceStatBlockId: null,
          initiative: 10,
          sortOrder: 0,
          maxHp: 12,
          currentHp: 12,
          tempHp: 0,
          armorClass: 12,
          speed: 30,
          isConcentrating: false,
          deathSaveSuccesses: 0,
          deathSaveFailures: 0,
          isDefeated: false,
          isHidden: false,
          notes: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      conditions: [],
      events: [],
    })
    mockGetSummary.mockResolvedValue({
      encounterId: 'enc-1',
      rounds: 1,
      totalEvents: 0,
      totalDamage: 0,
      totalHealing: 0,
      defeatedCombatants: 0,
    })
    mockListTemplates.mockResolvedValue([])
    mockListStatBlocks.mockResolvedValue([])
    for (const key of Object.keys(mockRuntime) as Array<keyof typeof mockRuntime>) {
      mockRuntime[key].mockResolvedValue({})
    }
    mockRequest.mockImplementation(async (path: string) => {
      if (String(path).includes('/sessions')) return []
      if (String(path).includes('/characters')) {
        return [{ id: 'link-1', status: 'ACTIVE', character: { id: 'pc-1', name: 'Aria' } }]
      }
      if (String(path).includes('/calendar-config')) return { isEnabled: false }
      return []
    })
  })

  it('renders PC add and encounter settings controls', async () => {
    const wrapper = await mountSuspended(EncounterDetailPage, {
      global: {
        provide: {
          campaignCanWriteContent: ref(true),
        },
      },
    })

    expect(wrapper.text()).toContain('Manage combatants')
    expect(wrapper.text()).toContain('Encounter settings')
    expect(wrapper.text()).toContain('Active combatant')
    expect(wrapper.text()).toContain('Quest & milestone shortcuts')
  })

  it('keeps runtime content visible while manual refresh is pending', async () => {
    let requestCount = 0
    mockGetEncounter.mockImplementation(async () => {
      requestCount += 1
      if (requestCount === 1) {
        return {
          id: 'enc-1',
          campaignId: 'campaign-1',
          sessionId: null,
          name: 'Bridge Ambush',
          type: 'COMBAT',
          status: 'PLANNED',
          visibility: 'SHARED',
          notes: null,
          calendarYear: null,
          calendarMonth: null,
          calendarDay: null,
          currentRound: 1,
          currentTurnIndex: 0,
          createdByUserId: 'user-1',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          combatants: [
            {
              id: 'combatant-1',
              encounterId: 'enc-1',
              name: 'Bandit',
              side: 'ENEMY',
              sourceType: 'CUSTOM',
              sourceCampaignCharacterId: null,
              sourcePlayerCharacterId: null,
              sourceGlossaryEntryId: null,
              sourceStatBlockId: null,
              initiative: 10,
              sortOrder: 0,
              maxHp: 12,
              currentHp: 12,
              tempHp: 0,
              armorClass: 12,
              speed: 30,
              isConcentrating: false,
              deathSaveSuccesses: 0,
              deathSaveFailures: 0,
              isDefeated: false,
              isHidden: false,
              notes: null,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          ],
          conditions: [],
          events: [],
        }
      }
      return new Promise(() => {})
    })

    const wrapper = await mountSuspended(EncounterDetailPage, {
      global: {
        provide: {
          campaignCanWriteContent: ref(true),
        },
      },
    })

    const refreshButton = wrapper.findAll('button').find((button) => button.text().includes('Refresh'))
    expect(refreshButton).toBeTruthy()
    await refreshButton!.trigger('click')
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('Active combatant')
    expect(wrapper.text()).toContain('Bandit')
  })
})
