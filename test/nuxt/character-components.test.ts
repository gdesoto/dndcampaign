import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import ClassAvatar from '../../app/components/character/ClassAvatar.vue'
import HitPoints from '../../app/components/character/HitPoints.vue'
import SpellsEditor from '../../app/components/character/SpellsEditor.vue'

describe('Character class avatar', () => {
  it('uses class identity for initials and a neutral fallback for unknown classes', async () => {
    const wrapper = await mountSuspended(ClassAvatar, { props: { name: 'Mira Moon', classes: ['Wizard 5', 'Fighter 1'] } })
    expect(wrapper.text()).toBe('MM')
    expect(wrapper.find('.bg-linear-to-br').classes()).toContain('from-blue-800')
    await wrapper.setProps({ classes: ['Homebrew'] })
    expect(wrapper.find('.bg-linear-to-br').classes()).toContain('from-stone-600')
    wrapper.unmount()
  })

  it('keeps a supplied portrait and shows initials if the image fails', async () => {
    const wrapper = await mountSuspended(ClassAvatar, { props: { name: 'Mira Moon', src: '/portrait.png', classes: ['Druid'] } })
    expect(wrapper.find('img').attributes('alt')).toBe('Mira Moon')
    expect(wrapper.find('.bg-linear-to-br').exists()).toBe(false)
    await wrapper.find('img').trigger('error')
    expect(wrapper.find('.bg-linear-to-br').text()).toBe('MM')
    expect(wrapper.find('.bg-linear-to-br').classes()).toContain('from-green-800')
    wrapper.unmount()
  })
})

describe('Character hit points', () => {
  it('shows accessible HP, bounds progress, and omits progress for incomplete data', async () => {
    const wrapper = await mountSuspended(HitPoints, { props: { name: 'Aria', current: 7, max: 20 } })
    expect(wrapper.text()).toContain('7 / 20')
    expect(wrapper.get('[role="progressbar"]').attributes()).toMatchObject({
      'aria-valuenow': '7', 'aria-valuemax': '20', 'aria-valuetext': '7 of 20 hit points',
    })
    await wrapper.setProps({ current: 0 })
    expect(wrapper.get('[role="progressbar"]').attributes('aria-valuenow')).toBe('0')
    await wrapper.setProps({ current: 25 })
    expect(wrapper.text()).toContain('25 / 20')
    expect(wrapper.get('[role="progressbar"]').attributes()).toMatchObject({
      'aria-valuenow': '20', 'aria-valuetext': '25 of 20 hit points',
    })
    await wrapper.setProps({ max: undefined })
    expect(wrapper.find('[role="progressbar"]').exists()).toBe(false)
    wrapper.unmount()
  })
})

describe('Character spells editor', () => {
  it('edits slots and spell lists without losing unknown keys or fields', async () => {
    const wrapper = await mountSuspended(SpellsEditor, {
      props: {
        'modelValue': {
          concentration: 'Bless',
          slots: { 1: 4, 2: { max: 3, remaining: 1, recharge: 'long' }, pact: 2 },
          prepared: ['Shield', { name: 'Fire Bolt', school: 'Evocation' }],
          known: 'legacy',
        },
        'onUpdate:modelValue': (value: Record<string, unknown>) => wrapper.setProps({ modelValue: value }),
      },
      global: { stubs: { UTooltip: { template: '<span><slot /></span>' } } },
    })
    const model = () => wrapper.props('modelValue') as Record<string, unknown>
    const numberInput = (id: string) => wrapper.findAllComponents({ name: 'UInputNumber' }).find(c => String(c.props('id')).endsWith(id))!

    for (const [id, value] of [['-1-max', 2], ['-2-max', 5], ['-3-remaining', 2]] as const) {
      numberInput(id).vm.$emit('update:modelValue', value)
      await flushPromises()
    }
    expect(model().slots).toEqual({ 1: { max: 2, remaining: 2 }, 2: { max: 5, remaining: 1, recharge: 'long' }, pact: 2 })

    await wrapper.get('input[aria-label="Prepared spell 2"]').setValue('Firebolt')
    await wrapper.get('input[aria-label="New prepared spell"]').setValue('shield')
    await wrapper.findAll('form')[0]!.trigger('submit')
    await wrapper.get('input[aria-label="New prepared spell"]').setValue(' Mage Armor ')
    await wrapper.findAll('form')[0]!.trigger('submit')
    await wrapper.get('button[aria-label="Remove Shield"]').trigger('click')
    expect(model().prepared).toEqual([{ name: 'Firebolt', school: 'Evocation' }, 'Mage Armor'])
    expect(model()).toMatchObject({ concentration: 'Bless', known: 'legacy' })

    await wrapper.get('input[aria-label="New known spell"]').setValue('Light')
    await wrapper.findAll('form')[1]!.trigger('submit')
    expect(model().known).toEqual(['Light'])
    wrapper.unmount()
  })
})
