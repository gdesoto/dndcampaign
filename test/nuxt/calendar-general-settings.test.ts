import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import CalendarGeneralSettings from '../../app/components/campaign/settings/CalendarGeneralSettings.vue'

const getConfig = vi.fn()
const upsertConfig = vi.fn()
const applyTemplate = vi.fn()
const updateCurrentDate = vi.fn()
const generateNames = vi.fn()

vi.mock('~/composables/useCampaignCalendar', () => ({
  useCampaignCalendar: () => ({
    getConfig,
    upsertConfig,
    applyTemplate,
    updateCurrentDate,
    generateNames,
  }),
}))

const baseConfig = {
  id: 'cfg-1',
  campaignId: 'cmp-1',
  isEnabled: true,
  name: 'Calendar',
  startingYear: 1,
  firstWeekdayIndex: 0,
  currentYear: 1,
  currentMonth: 1,
  currentDay: 1,
  weekdays: [{ name: 'Moonday' }],
  months: [{ name: 'Month 1', length: 30 }],
  moons: [],
  yearLength: 30,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

const mountComponent = async () =>
  mountSuspended(CalendarGeneralSettings, {
    props: {
      campaignId: 'cmp-1',
      canEdit: true,
    },
    global: {
      stubs: {
        UCard: { template: '<div><slot name="header" /><slot /></div>' },
        UAlert: { template: '<div><slot /></div>' },
        UInput: {
          props: ['modelValue'],
          emits: ['update:modelValue'],
          template:
            '<input :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
        },
        USelect: {
          props: ['modelValue', 'items'],
          emits: ['update:modelValue'],
          template:
            '<select :value="modelValue" @change="$emit(\'update:modelValue\', $event.target.value)"><option v-for="item in items || []" :key="item.value" :value="item.value">{{ item.label }}</option></select>',
        },
        USwitch: {
          props: ['modelValue'],
          emits: ['update:modelValue'],
          template:
            '<button type="button" @click="$emit(\'update:modelValue\', !modelValue)"><slot />switch</button>',
        },
        UButton: {
          emits: ['click'],
          template: '<button type="button" @click="$emit(\'click\')"><slot /></button>',
        },
        UModal: {
          props: ['open'],
          emits: ['update:open'],
          template: '<div v-if="open"><slot /><slot name="footer" /></div>',
        },
      },
    },
  })

describe('CalendarGeneralSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getConfig.mockResolvedValue(baseConfig)
    upsertConfig.mockResolvedValue(baseConfig)
    applyTemplate.mockResolvedValue(baseConfig)
    updateCurrentDate.mockResolvedValue(baseConfig)
    generateNames.mockResolvedValue({ kind: 'weekday', names: ['Stormday'] })
  })

  it('loads config on mount', async () => {
    await mountComponent()
    await flushPromises()

    expect(getConfig).toHaveBeenCalledWith('cmp-1')
  })

  it('saves edited config', async () => {
    const wrapper = await mountComponent()
    await flushPromises()

    const saveButton = wrapper.findAll('button').find((button) => button.text().includes('Save calendar settings'))
    expect(saveButton).toBeDefined()
    await saveButton!.trigger('click')
    await flushPromises()

    expect(upsertConfig).toHaveBeenCalledTimes(1)
    expect(upsertConfig.mock.calls[0]?.[0]).toBe('cmp-1')
  })

  it('confirms template overwrite when existing config is present', async () => {
    const wrapper = await mountComponent()
    await flushPromises()

    const applyTemplateButtons = wrapper
      .findAll('button')
      .filter((button) => button.text().trim() === 'Apply template')
    expect(applyTemplateButtons.length).toBe(1)
    await applyTemplateButtons[0]!.trigger('click')
    await flushPromises()

    const confirmApplyButton = wrapper
      .findAll('button')
      .filter((button) => button.text().trim() === 'Apply template')
      .at(-1)
    expect(confirmApplyButton).toBeDefined()
    await confirmApplyButton!.trigger('click')
    await flushPromises()

    expect(applyTemplate).toHaveBeenCalledTimes(1)
    expect(applyTemplate).toHaveBeenCalledWith('cmp-1', { templateId: 'earth' })
  })

  it('generates a weekday name from UI action', async () => {
    const wrapper = await mountComponent()
    await flushPromises()

    const generateButton = wrapper.findAll('button').find((button) => button.text().trim() === 'Generate')
    expect(generateButton).toBeDefined()
    await generateButton!.trigger('click')
    await flushPromises()

    expect(generateNames).toHaveBeenCalledTimes(1)
    expect(generateNames).toHaveBeenCalledWith('cmp-1', { kind: 'weekday', count: 1 })
  })
})
