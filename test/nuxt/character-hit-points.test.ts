import { expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import HitPoints from '../../app/components/character/HitPoints.vue'

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
