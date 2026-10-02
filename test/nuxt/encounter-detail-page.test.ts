import { actionMenuStub } from '../helpers/action-menu'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { mountSuspended, mockNuxtImport } from '@nuxt/test-utils/runtime'
import EncounterDetailPage from '../../app/pages/campaigns/[campaignId]/encounters/[encounterId].vue'
import EventTimeline from '../../app/components/encounter/EventTimeline.vue'
import type { EncounterEvent } from '../../shared/types/encounter'

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
  const originalScrollTo = window.scrollTo
  const stubs = {
    SharedActionMenu: actionMenuStub,
    UTooltip: { props: { text: String }, template: '<slot />' },
  }

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
      activeParticipantId: null,
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
          tempHp: 5,
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
      if (String(path).includes('/calendar/config')) return { isEnabled: false }
      return []
    })
  })

  afterEach(() => {
    window.scrollTo = originalScrollTo
  })

  it('selects a participant without modifying the turn', async () => {
    const original = await mockGetEncounter()
    mockGetEncounter.mockResolvedValue({ ...original, status: 'ACTIVE', activeParticipantId: 'combatant-1', combatants: [...original.combatants, { ...original.combatants[0], id: 'combatant-2', name: 'Ally', sortOrder: 1 }] })
    const wrapper = await mountSuspended(EncounterDetailPage, { global: { stubs, provide: { campaignCanWriteContent: ref(true) } } })
    expect(wrapper.get('[aria-label="Encounter participants"]').text()).toContain('(+5 temp)')
    expect(wrapper.get('[aria-label="Encounter participants"]').text()).toContain('Speed 30 ft')
    mockRequest.mockClear()
    await wrapper.get('button[aria-label="Select Ally"]').trigger('click')
    expect(mockRequest).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('Set active turn')
    const setTurn = wrapper.findAll('button').find(button => button.text() === 'Set active turn')
    await setTurn!.trigger('click')
    expect(mockRequest).toHaveBeenCalledWith('/api/encounters/enc-1/turn', { method: 'PATCH', body: { action: 'set-active', combatantId: 'combatant-2' } })
    wrapper.unmount()
  })

  it('rejects a blank HP amount without applying damage', async () => {
    const original = await mockGetEncounter()
    mockGetEncounter.mockResolvedValue({ ...original, status: 'ACTIVE', activeParticipantId: 'combatant-1' })
    const wrapper = await mountSuspended(EncounterDetailPage, { global: { stubs, provide: { campaignCanWriteContent: ref(true) } } })
    mockRequest.mockClear()
    const damage = wrapper.findAll('button').find(button => button.text() === 'Damage')
    await damage!.trigger('click')
    expect(mockRequest).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('Enter a whole number from 1 to 9999.')
    wrapper.unmount()
  })

  it('renders finished encounters as records with explicit reopening', async () => {
    const original = await mockGetEncounter()
    mockGetEncounter.mockResolvedValue({ ...original, status: 'COMPLETED', activeParticipantId: null })
    const wrapper = await mountSuspended(EncounterDetailPage, { global: { stubs, provide: { campaignCanWriteContent: ref(true) } } })
    expect(wrapper.text()).toContain('Reopen')
    expect(wrapper.find('button[aria-label="Add participant"]').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('Next turn')
    expect(wrapper.text()).toContain('Final record')
    wrapper.unmount()
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
      activeParticipantId: null,
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
        stubs,
        provide: {
          campaignCanWriteContent: ref(true),
        },
      },
    })

    const refreshButton = wrapper.findAll('button').find((button) => button.text().includes('Refresh'))
    expect(refreshButton).toBeTruthy()
    await refreshButton!.trigger('click')
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('Participants')
    expect(wrapper.text()).toContain('Bandit')
    expect(wrapper.text()).not.toContain('Refreshing')
    expect(wrapper.find('[aria-label="Refreshing encounter"]').exists()).toBe(true)
    expect(wrapper.find('[aria-label="Loading content"]').exists()).toBe(false)
    wrapper.unmount()
  })
})

describe('Encounter timeline', () => {
  const events: EncounterEvent[] = [
    { id: 'old', encounterId: 'enc', eventType: 'NOTE', summary: 'An earlier note', createdAt: '2026-09-20T10:00:00Z' },
    { id: 'new', encounterId: 'enc', eventType: 'HP', summary: 'Guard takes damage', payload: { action: 'hp.damage' }, createdAt: '2026-09-20T11:00:00Z' },
  ]

  it('sorts newest first, reverses order, filters types, and recovers from no matches', async () => {
    const wrapper = await mountSuspended(EventTimeline, { props: { events }, global: { stubs: {
      UTooltip: { template: '<slot />' },
      UDropdownMenu: { props: ['items'], template: `<div><slot /><button v-for="item in items" :key="item.label" @click="item.onUpdateChecked(!item.checked)">{{ item.label }}</button></div>` },
    } } })
    const history = () => wrapper.get('[aria-label="Encounter event history"]').text()
    expect(history()).toContain('Damage')
    expect(history().indexOf('Guard takes damage')).toBeLessThan(history().indexOf('An earlier note'))
    await wrapper.get('[aria-label="Show oldest first"]').trigger('click')
    expect(history().indexOf('An earlier note')).toBeLessThan(history().indexOf('Guard takes damage'))
    await wrapper.findAll('button').find(button => button.text() === 'Note')!.trigger('click')
    expect(history()).toContain('An earlier note')
    expect(history()).not.toContain('Guard takes damage')
    await wrapper.findAll('button').find(button => button.text() === 'Clear filters')!.trigger('click')
    await wrapper.findAll('button').find(button => button.text() === 'Condition')!.trigger('click')
    expect(wrapper.text()).toContain('No events match these filters.')
    await wrapper.findAll('button').find(button => button.text() === 'Clear filters')!.trigger('click')
    expect(history()).toContain('Guard takes damage')
    expect(events[0]?.id).toBe('old')
    await wrapper.setProps({ events: [{ ...events[1]!, summary: 'Guard regains HP', payload: { action: 'hp.heal' } }] })
    expect(history()).toContain('Healing')
    expect(history()).not.toContain('Damage')
    await wrapper.setProps({ events: [] })
    expect(wrapper.text()).toContain('No encounter events yet.')
  })
})
