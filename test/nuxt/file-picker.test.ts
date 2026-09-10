import { expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import FilePicker from '../../app/components/shared/FilePicker.vue'

it('shows the selected filename and lets the user clear the selection', async () => {
  const wrapper = await mountSuspended(FilePicker, { props: { label: 'Select recording', accept: 'audio/*' } })
  expect(wrapper.text()).toContain('Select recording')
  expect(wrapper.get('[role="status"]').text()).toBe('No file selected')
  const file = new File(['audio'], 'Session 12 recording.mp3', { type: 'audio/mpeg' })
  await wrapper.setProps({ modelValue: file })
  expect(wrapper.text()).toContain(file.name)
  expect(wrapper.get('[role="status"]').text()).toBe('File selected')
  const remove = wrapper.get(`button[aria-label*="${file.name}"]`)
  await wrapper.setProps({ disabled: true })
  expect(remove.attributes('disabled')).toBeDefined()
  await wrapper.setProps({ disabled: false })
  await remove.trigger('click')
  expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([null])
  await wrapper.setProps({ modelValue: null })
  expect(wrapper.get('[role="status"]').text()).toBe('No file selected')
  wrapper.unmount()
})
