import { expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import ClassAvatar from '../../app/components/character/ClassAvatar.vue'

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
