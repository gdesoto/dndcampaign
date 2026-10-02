import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import ClassAvatar from '../../app/components/character/ClassAvatar.vue'
import HitPoints from '../../app/components/character/HitPoints.vue'

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
