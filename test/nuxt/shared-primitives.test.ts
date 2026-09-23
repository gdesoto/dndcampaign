import { describe, expect, it, vi } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { z } from 'zod'
import { UFormField, UInput } from '#components'
import ResourceState from '../../app/components/shared/ResourceState.vue'
import ConfirmActionPopover from '../../app/components/shared/ConfirmActionPopover.vue'
import EntityFormModal from '../../app/components/shared/EntityFormModal.vue'

describe('SharedResourceState', () => {
  it('keeps content mounted through a refresh and a failed refresh', async () => {
    const wrapper = await mountSuspended(ResourceState, {
      props: { pending: true, hasData: true },
      slots: { default: () => h('input', { value: 'Existing draft' }) },
    })
    const input = wrapper.find('input').element
    expect(wrapper.text()).toContain('Refreshing')
    await wrapper.setProps({ pending: false, error: new Error('Offline') })
    expect(wrapper.find('input').element).toBe(input)
    expect(wrapper.text()).toContain('Unable to load data.')
  })

  it('offers filter recovery instead of creation for no matches', async () => {
    const wrapper = await mountSuspended(ResourceState, {
      props: { pending: false, empty: true, noMatches: true },
      slots: { emptyActions: () => h('button', 'Create first item') },
    })
    expect(wrapper.text()).not.toContain('Create first item')
    await wrapper.find('button').trigger('click')
    expect(wrapper.emitted('clear')).toBeTruthy()
  })

  it('emits retry on default error action', async () => {
    const wrapper = await mountSuspended(ResourceState, {
      props: {
        pending: false,
        error: new Error('boom'),
      },
    })

    const retryButton = wrapper.findAll('button').find((button) => button.text().trim() === 'Try again')
    expect(retryButton).toBeDefined()
    await retryButton!.trigger('click')
    expect(wrapper.emitted('retry')).toBeTruthy()
  })
})

describe('SharedEntityFormModal', () => {
  it('focuses the first invalid field without submitting or discarding the draft', async () => {
    const wrapper = await mountSuspended(EntityFormModal, {
      attachTo: document.body,
      props: { open: true, title: 'Create thing', state: { name: '' }, schema: z.object({ name: z.string().min(1, 'Name is required') }) },
      slots: { default: defineComponent({ components: { UFormField, UInput }, template: '<UFormField label="Name" name="name"><UInput model-value="" /></UFormField>' }) },
      global: { stubs: { UModal: { template: '<div><slot name="body" /></div>' } } },
    })
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(wrapper.text()).toContain('Name is required')
    expect(document.activeElement).toBe(wrapper.get('input').element)
    expect(wrapper.emitted('submit')).toBeUndefined()
    wrapper.unmount()
  })

  it('locks the form while deleting and keeps the draft and confirmation available after failure', async () => {
    let rejectDelete!: (error: Error) => void
    const deleteAction = vi.fn(() => new Promise<void>((_, reject) => { rejectDelete = reject }))
    const close = vi.fn()
    const wrapper = await mountSuspended(EntityFormModal, {
      props: { open: true, title: 'Edit quest', state: { title: 'The watchtower' }, showDeleteAction: true, deleteAction },
      global: { stubs: {
        UModal: { template: '<div><slot name="body" /></div>' },
        UPopover: { setup: () => ({ close }), template: '<div><slot /><slot name="content" :close="close" /></div>' },
      } },
    })
    expect(wrapper.text()).toContain('Delete The watchtower?')
    const confirm = wrapper.findAll('button').filter(button => button.text() === 'Delete').at(-1)!
    await confirm.trigger('click')
    expect(wrapper.get('fieldset').attributes('disabled')).toBeDefined()
    expect(wrapper.get('button[type="submit"]').attributes('disabled')).toBeDefined()
    rejectDelete(new Error('Please retry deletion'))
    await flushPromises()
    expect(wrapper.text()).toContain('Please retry deletion')
    expect(wrapper.props('state')).toEqual({ title: 'The watchtower' })
    expect(close).not.toHaveBeenCalled()
    expect(wrapper.get('fieldset').attributes('disabled')).toBeUndefined()
    deleteAction.mockResolvedValueOnce()
    await confirm.trigger('click')
    await flushPromises()
    expect(close).toHaveBeenCalledOnce()
    wrapper.unmount()
  })

  it('blocks cancellation and conflicting deletion during save', async () => {
    const wrapper = await mountSuspended(EntityFormModal, {
      props: { open: true, title: 'Edit thing', state: { name: 'Draft' }, saving: true, showDeleteAction: true },
      global: { stubs: { UModal: { template: '<div><slot name="body" /></div>' } } },
    })
    const cancel = wrapper.findAll('button').find(button => button.text() === 'Cancel')!
    expect(cancel.attributes('disabled')).toBeDefined()
    await cancel.trigger('click')
    expect(wrapper.emitted('cancel')).toBeUndefined()
    expect(wrapper.props('state')).toEqual({ name: 'Draft' })
  })
})

describe('SharedConfirmActionPopover', () => {
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
    expect(wrapper.get('[data-dismissible]').attributes('data-dismissible')).toBe('false')
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
