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
        UTooltip: { template: '<span><slot /></span>' },
        UCard: { template: '<div><slot name="header" /><slot /></div>' },
        UForm: { emits: ['submit'], template: '<form @submit.prevent="$emit(\'submit\')"><slot /></form>' },
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
          template: '<div v-if="open"><slot name="body" /><slot name="footer" /></div>',
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

  it('saves edited config', async () => {
    const wrapper = await mountComponent()
    await flushPromises()

    const saveButton = wrapper.findAll('button').find((button) => button.text().includes('Save calendar settings'))
    expect(saveButton).toBeDefined()
    await wrapper.find('input').setValue('New calendar')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(upsertConfig).toHaveBeenCalledTimes(1)
    expect(upsertConfig.mock.calls[0]?.[0]).toBe('cmp-1')
    expect(upsertConfig.mock.calls[0]?.[1]).toMatchObject({ name: 'New calendar' })
  })

  it('preserves edits after a failed save and can discard back to saved values', async () => {
    upsertConfig.mockRejectedValueOnce(new Error('Save failed'))
    const wrapper = await mountComponent()
    await flushPromises()
    await wrapper.find('input').setValue('Unsaved calendar')
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(wrapper.find('input').element.value).toBe('Unsaved calendar')
    expect(wrapper.text()).toContain('Save failed')
    await wrapper.findAll('button').find(button => button.text() === 'Discard changes')!.trigger('click')
    expect(wrapper.find('input').element.value).toBe('Calendar')
    wrapper.unmount()
  })

  it('keeps template confirmation open after failure for retry', async () => {
    applyTemplate.mockRejectedValueOnce(new Error('Template failed'))
    const wrapper = await mountComponent()
    await flushPromises()
    await wrapper.findAll('button').find(button => button.text() === 'Apply template')!.trigger('click')
    expect(applyTemplate).not.toHaveBeenCalled()
    await wrapper.findAll('button').filter(button => button.text() === 'Apply template').at(-1)!.trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('Template failed')
    expect(wrapper.findAll('button').filter(button => button.text() === 'Apply template')).toHaveLength(2)
    await wrapper.findAll('button').filter(button => button.text() === 'Apply template').at(-1)!.trigger('click')
    await flushPromises()
    expect(applyTemplate).toHaveBeenCalledTimes(2)
    expect(applyTemplate).toHaveBeenLastCalledWith('cmp-1', { templateId: 'earth' })
    expect(wrapper.findAll('button').filter(button => button.text() === 'Apply template')).toHaveLength(1)
    wrapper.unmount()
  })

  it('does not mutate saved nested data when generating a draft name', async () => {
    const wrapper = await mountComponent()
    await flushPromises()
    await wrapper.findAll('button').find(button => button.text() === 'Generate')!.trigger('click')
    await flushPromises()
    expect(baseConfig.weekdays[0]!.name).toBe('Moonday')
    expect(wrapper.findAll('input').some(input => input.element.value === 'Stormday')).toBe(true)
    wrapper.unmount()
  })
})
