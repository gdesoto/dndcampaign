import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'
import { mountSuspended, mockNuxtImport } from '@nuxt/test-utils/runtime'
import QuestsPage from '../../app/pages/campaigns/[campaignId]/quests.vue'

const mockRequest = vi.fn()
const mockRefresh = vi.fn(async () => undefined)
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
    canWriteContent: computed(() => true),
    request: mockRequest,
  }),
}))

describe('Campaign quests page', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mockRequest.mockImplementation(async (path: string, options?: { method?: string; query?: { type?: string } }) => {
      if (path === '/api/campaigns/campaign-1/quests' && (!options?.method || options.method === 'GET')) {
        return questRecords.value
      }

      if (path === '/api/campaigns/campaign-1/glossary' && options?.query?.type === 'NPC') {
        return npcEntries.value
      }

      if (path === '/api/campaigns/campaign-1/characters' && (!options?.method || options.method === 'GET')) {
        return characterLinks.value
      }

      return null
    })
  })

  it('renders quest category, track, source, reward, and expiration details', async () => {
    const wrapper = await mountSuspended(QuestsPage, {
      global: {
        provide: {
          campaignCanWriteContent: computed(() => true),
        },
        stubs: {
          CampaignListTemplate: {
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
            props: ['open'],
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
    expect(wrapper.text()).toContain('Campaign')
    expect(wrapper.text()).toContain('Main quest')
    expect(wrapper.text()).toContain('Guildmaster Tovin')
    expect(wrapper.text()).toContain('500 gp and a writ of passage')
    expect(wrapper.text()).toContain('Emberfall 12, Year 2026')
  })
})
