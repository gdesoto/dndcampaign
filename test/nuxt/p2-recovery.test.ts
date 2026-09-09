import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { useRetainedResource } from '../../app/composables/useRetainedResource'
import ConfirmActionPopover from '../../app/components/shared/ConfirmActionPopover.vue'

describe('retained resource recovery', () => {
  it('retains successful data after failure without showing it under different filters', async () => {
    const key = ref('campaign-a:all')
    const cache = useRetainedResource<string[]>(() => key.value)
    cache.seed(['Hydrated record'])
    await expect(cache.load(async () => { throw new Error('Offline') })).rejects.toThrow('Offline')
    expect(cache.get()).toEqual(['Hydrated record'])
    key.value = 'campaign-a:missing'
    expect(cache.get()).toBeUndefined()
    await cache.load(async () => [])
    expect(cache.get()).toEqual([])
  })

  it('does not let an old request replace the current scope cache', async () => {
    const key = ref('first')
    const cache = useRetainedResource<string[]>(() => key.value)
    let resolveOld!: (value: string[]) => void
    const old = cache.load(() => new Promise(resolve => { resolveOld = resolve }))
    key.value = 'second'
    await cache.load(async () => ['Current record'])
    resolveOld(['Old record'])
    await old
    expect(cache.get()).toEqual(['Current record'])
  })
})

describe('asynchronous confirmation recovery', () => {
  it('blocks duplicate submissions and dismissal, retains failure, and allows retry', async () => {
    let rejectAction!: (reason: Error) => void
    const action = vi.fn(() => new Promise<void>((_, reject) => { rejectAction = reject }))
    const close = vi.fn()
    const wrapper = await mountSuspended(ConfirmActionPopover, {
      props: { action, confirmLabel: 'Delete record' },
      global: {
        stubs: {
          UPopover: {
            props: ['dismissible'],
            setup: () => ({ close }),
            template: '<div :data-dismissible="dismissible"><slot /><slot name="content" :close="close" /></div>',
          },
        },
      },
    })
    const confirm = wrapper.findAll('button').find(button => button.text() === 'Delete record')!
    const cancel = wrapper.findAll('button').find(button => button.text() === 'Cancel')!
    await confirm.trigger('click')
    await confirm.trigger('click')
    expect(action).toHaveBeenCalledTimes(1)
    expect(cancel.attributes('disabled')).toBeDefined()
    expect(wrapper.attributes('data-dismissible')).toBe('false')
    rejectAction(new Error('Unable to delete record'))
    await flushPromises()
    expect(wrapper.find('[role="alert"]').text()).toBe('Unable to delete record')
    expect(close).not.toHaveBeenCalled()
    action.mockResolvedValueOnce()
    await confirm.trigger('click')
    await flushPromises()
    expect(close).toHaveBeenCalledTimes(1)
    wrapper.unmount()
  })
})
