import { afterEach, expect, it, vi } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import ActionMenu from '../../app/components/shared/ActionMenu.vue'

const wrappers: Awaited<ReturnType<typeof mountSuspended>>[] = []
afterEach(() => { wrappers.splice(0).forEach(wrapper => wrapper.unmount()); document.body.innerHTML = '' })
const settle = async () => { await flushPromises(); await new Promise(resolve => setTimeout(resolve, 250)); await flushPromises() }

it.each([false, true])('hands focus to confirmation, retains failure, retries and restores the trigger (modal=%s)', async (modal) => {
  let reject!: (error: Error) => void
  const action = vi.fn().mockImplementationOnce(() => new Promise((_, fail) => { reject = fail })).mockResolvedValue(undefined)
  const wrapper = await mountSuspended(ActionMenu, { attachTo: document.body, global: { stubs: { UTooltip: { template: '<div><slot /></div>' } } }, props: { name: 'Test record', items: [
    { label: 'Open', to: '/campaigns/c1' },
    { label: 'Delete', action, destructive: true, confirmation: { message: 'Delete test record?', modal } },
  ] } })
  wrappers.push(wrapper)
  const trigger = wrapper.get('button[aria-label="Actions for Test record"]')
  await trigger.trigger('click'); await settle()
  const menuItem = [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')].find(item => item.textContent?.includes('Delete'))!
  expect(menuItem).toBeDefined()
  menuItem.click(); await settle()
  const button = (label: string) => [...document.querySelectorAll<HTMLButtonElement>('button')].find(item => item.textContent?.trim() === label)!
  expect(document.activeElement).toBe(button('Cancel'))
  button('Delete').click(); await settle()
  expect(button('Cancel').disabled).toBe(true)
  expect(action).toHaveBeenCalledTimes(1)
  reject(new Error('Try again')); await settle()
  expect(document.querySelector('[role="alert"]')?.textContent).toContain('Try again')
  expect(document.activeElement).toBe(button('Cancel'))
  button('Delete').click(); await settle()
  expect(action).toHaveBeenCalledTimes(2)
  expect(document.activeElement).toBe(trigger.element)
})
