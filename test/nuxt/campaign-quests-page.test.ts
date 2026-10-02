import { config, flushPromises } from '@vue/test-utils'
import { actionMenuStub } from '../helpers/action-menu'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'
import { mountSuspended, mockNuxtImport } from '@nuxt/test-utils/runtime'
import QuestsPage from '../../app/pages/campaigns/[campaignId]/quests.vue'
import { questFormSchema } from '../../app/utils/quest-form-schema'

const mockRequest = vi.fn()
const mockRefresh = vi.fn(async () => undefined)
const canWriteContent = ref(true)
const mockCalendarConfig = {
  id: 'calendar-1',
  campaignId: 'campaign-1',
  isEnabled: true,
  name: 'Test Calendar',
  startingYear: 2026,
  firstWeekdayIndex: 0,
  currentYear: 2026,
  currentMonth: 3,
  currentDay: 10,
  weekdays: [{ name: 'Sun' }],
  months: [
    { name: 'Dawnrise', length: 30 },
    { name: 'Bloomtide', length: 30 },
    { name: 'Emberfall', length: 30 },
  ],
  moons: [],
  yearLength: 90,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

const questRecords = ref([
  {
    id: 'quest-1',
    campaignId: 'campaign-1',
    title: 'Recover the seal',
    description: 'Search the old tower for the missing seal.',
    type: 'CAMPAIGN',
    track: 'MAIN',
    sourceType: 'NPC',
    sourceText: null,
    sourceNpcId: 'npc-1',
    sourceNpcName: 'Guildmaster Tovin',
    sourceCharacterId: null,
    sourceCharacterName: null,
    reward: '500 gp and a writ of passage',
    status: 'ACTIVE',
    progressNotes: 'The party has located the tower entrance.',
    expirationDate: {
      year: 2026,
      month: 3,
      day: 12,
    },
    sortOrder: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
])
const npcEntries = ref([
  {
    id: 'npc-1',
    name: 'Guildmaster Tovin',
  },
])
const characterLinks = ref([
  {
    character: {
      id: 'pc-1',
      name: 'Sir Rowan',
    },
  },
])

mockNuxtImport('useAsyncData', () => async (_key: string | (() => string), handler: () => Promise<unknown>) => ({
  data: ref(await handler()),
  pending: ref(false),
  error: ref(null),
  refresh: mockRefresh,
}))

vi.mock('~/composables/useCampaignCalendar', () => ({
  useCampaignCalendar: () => ({
    getConfig: vi.fn(async () => mockCalendarConfig),
  }),
}))

vi.mock('~/composables/useCampaignPageContext', () => ({
  useCampaignPageContext: () => ({
    campaignId: computed(() => 'campaign-1'),
    canWriteContent,
    request: mockRequest,
  }),
}))

config.global.stubs.SharedActionMenu = actionMenuStub

describe('Campaign quests page', () => {
  const originalQuests = questRecords.value.slice()

  afterEach(() => {
    questRecords.value = originalQuests.slice()
    canWriteContent.value = true
  })

  beforeEach(() => {
    vi.clearAllMocks()

    mockRequest.mockImplementation(async (path: string, options?: { method?: string; query?: { type?: string }; body?: { status?: string } }) => {
      if (path === '/api/campaigns/campaign-1/quests' && (!options?.method || options.method === 'GET')) {
        return questRecords.value
      }

      if (path === '/api/campaigns/campaign-1/glossary' && options?.query?.type === 'NPC') {
        return npcEntries.value
      }

      if (path === '/api/campaigns/campaign-1/characters' && (!options?.method || options.method === 'GET')) {
        return characterLinks.value
      }

      if (path.startsWith('/api/quests/') && options?.method === 'PATCH' && options.body?.status) {
        const quest = questRecords.value.find((quest) => path === `/api/quests/${quest.id}`)
        if (quest) quest.status = options.body.status
      }

      return null
    })
  })

  it('preserves grouped quest order, details, edit/status actions, and reader permissions', async () => {
    questRecords.value.push(
      { ...originalQuests[0]!, id: 'quest-2', title: 'Pay the ferryman', status: 'COMPLETED' },
      { ...originalQuests[0]!, id: 'quest-3', title: 'Find the scout', status: 'ON_HOLD' },
      { ...originalQuests[0]!, id: 'quest-4', title: 'Deliver the letter', status: 'FAILED' },
    )
    const wrapper = await mountSuspended(QuestsPage, {
      global: {
        provide: {
          campaignCanWriteContent: computed(() => true),
        },
        stubs: {
          CampaignTemplatesList: {
            props: ['actionLabel', 'actionDisabled'],
            emits: ['action'],
            template: `
              <div>
                <button type="button" :disabled="actionDisabled" @click="$emit('action')">{{ actionLabel }}</button>
                <slot name="notice" />
                <slot name="filters" />
                <slot />
              </div>
            `,
          },
          SharedResourceState: {
            props: ['pending', 'error', 'empty'],
            template: `
              <div>
                <slot v-if="pending" name="loading" />
                <slot v-else-if="empty" name="emptyActions" />
                <slot v-else />
              </div>
            `,
          },
          SharedEntityFormModal: {
            name: 'SharedEntityFormModal',
            props: ['open', 'schema', 'state'],
            template: '<div><slot /></div>',
          },
          SharedReadOnlyAlert: {
            template: '<div />',
          },
          UButton: {
            emits: ['click'],
            props: ['disabled'],
            template: `<button type="button" :disabled="disabled" @click="$emit('click')"><slot /></button>`,
          },
          UCard: {
            template: '<div><slot /></div>',
          },
          UFormField: {
            template: '<label><slot /></label>',
          },
          UInput: {
            props: ['modelValue'],
            emits: ['update:modelValue'],
            template: `<input :value="modelValue" @input="$emit('update:modelValue', $event.target.value)" />`,
          },
          UTextarea: {
            props: ['modelValue'],
            emits: ['update:modelValue'],
            template: `<textarea :value="modelValue" @input="$emit('update:modelValue', $event.target.value)" />`,
          },
          USelect: {
            props: ['items', 'modelValue'],
            emits: ['update:modelValue'],
            template: `
              <select :value="modelValue" @change="$emit('update:modelValue', $event.target.value)">
                <option v-for="item in items" :key="item.value" :value="item.value">{{ item.label }}</option>
              </select>
            `,
          },
          UBadge: {
            template: '<span><slot /></span>',
          },
          USwitch: {
            props: ['modelValue', 'disabled'],
            emits: ['update:modelValue'],
            template: `<input type="checkbox" :checked="modelValue" :disabled="disabled" @change="$emit('update:modelValue', $event.target.checked)" />`,
          },
          SharedListItemCard: {
            template: `
              <div>
                <slot name="header" />
                <slot />
              </div>
            `,
          },
        },
      },
    })

    expect(wrapper.text()).toContain('Recover the seal')
    const modal = wrapper.findComponent({ name: 'SharedEntityFormModal' })
    expect(modal.props('schema')).toBe(questFormSchema)
    expect(questFormSchema.safeParse({ ...modal.props('state'), title: 'New quest' }).success).toBe(false)
    expect(wrapper.text()).toContain('Campaign')
    expect(wrapper.text()).toContain('Main quest')
    expect(wrapper.text()).toContain('Guildmaster Tovin')
    expect(wrapper.text()).toContain('500 gp and a writ of passage')
    expect(wrapper.text()).toContain('Emberfall 12, Year 2026')

    const sections = wrapper.findAll('section')
    expect(sections.map((section) => section.find('h2').text())).toEqual([
      'Active and on hold quests', 'Completed and failed quests',
    ])
    expect(sections.map((section) => section.find('span').text())).toEqual(['2 shown', '2 shown'])
    expect(sections.map((section) => section.findAll('h3').map((title) => title.text()))).toEqual([
      ['Recover the seal', 'Find the scout'], ['Pay the ferryman', 'Deliver the letter'],
    ])

    for (const [index, questId] of ['quest-1', 'quest-2'].entries()) {
      await sections[index]!.findAll('button').find((button) => button.text() === 'Edit')!.trigger('click')
      expect(modal.props('state').id).toBe(questId)
    }

    await sections[1]!.find('select').setValue('ACTIVE')
    await flushPromises()
    expect(mockRequest).toHaveBeenCalledWith('/api/quests/quest-2', { method: 'PATCH', body: { status: 'ACTIVE' } })
    expect(mockRefresh).toHaveBeenCalledOnce()
    expect(wrapper.findAll('section').map((section) => section.findAll('h3').map((title) => title.text()))).toEqual([
      ['Recover the seal', 'Pay the ferryman', 'Find the scout'], ['Deliver the letter'],
    ])

    await wrapper.findAll('select')[2]!.setValue('FAILED')
    expect(wrapper.findAll('section').map((section) => section.find('h2').text())).toEqual(['Completed and failed quests'])
    expect(wrapper.findAll('h3').map((title) => title.text())).toEqual(['Deliver the letter'])

    canWriteContent.value = false
    await flushPromises()
    expect(wrapper.findAll('section select')).toHaveLength(0)
    expect(wrapper.findAll('section button')).toHaveLength(0)
    expect(wrapper.find('section').text()).toContain('Failed')
    wrapper.unmount()
  })
})
