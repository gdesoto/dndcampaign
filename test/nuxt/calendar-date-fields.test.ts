import { expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import CalendarDateFields from '../../app/components/campaign/CalendarDateFields.vue'

it('labels date fields and bounds the day by the chosen month', async () => {
  const wrapper = await mountSuspended(CalendarDateFields, { props: { prefix: 'start', year: 1369, month: 1, day: 5, months: [{ name: 'Shortmoon', length: 20 }, { name: 'Longmoon', length: 36 }] } })
  expect(wrapper.findAll('label').map(label => label.text())).toEqual(['Year', 'Month', 'Day'])
  expect(wrapper.find('input[min="1"]').attributes('max')).toBe('20')
  await wrapper.setProps({ month: 2 })
  expect(wrapper.find('input[min="1"]').attributes('max')).toBe('36')
  await wrapper.setProps({ disabled: true })
  expect(wrapper.find('input[min="1"]').attributes('disabled')).toBeDefined()
  wrapper.unmount()
})
