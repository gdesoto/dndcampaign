import { expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import HitPoints from '../../app/components/character/HitPoints.vue'

it.each([0, 7, 20])('shows %s current HP against its actual maximum', async (current) => {
  const wrapper = await mountSuspended(HitPoints, { props: { name: 'Aria', current, max: 20 } })
  const progress = wrapper.get('[role="progressbar"]')
  expect(progress.attributes('aria-valuenow')).toBe(String(current))
  expect(progress.attributes('aria-valuemax')).toBe('20')
  expect(progress.attributes('aria-valuetext')).toBe(`${current} of 20 hit points`)
  expect(wrapper.text()).toContain(`${current} / 20`)
  wrapper.unmount()
})

it.each([
  { current: 7 }, { current: 7, max: 0 }, { current: 7, max: -1 },
  { max: 20 }, { current: NaN, max: 20 }, { current: 7, max: Infinity },
])('does not invent progress when the data is incomplete: %j', async (props) => {
  const wrapper = await mountSuspended(HitPoints, { props: { name: 'Aria', ...props } })
  expect(wrapper.find('[role="progressbar"]').exists()).toBe(false)
  wrapper.unmount()
})

it('keeps an above-maximum value readable while bounding the progress bar', async () => {
  const wrapper = await mountSuspended(HitPoints, { props: { name: 'Aria', current: 25, max: 20 } })
  expect(wrapper.text()).toContain('25 / 20')
  expect(wrapper.get('[role="progressbar"]').attributes('aria-valuenow')).toBe('20')
  expect(wrapper.get('[role="progressbar"]').attributes('aria-valuetext')).toBe('25 of 20 hit points')
  wrapper.unmount()
})
