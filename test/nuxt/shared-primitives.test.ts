import { afterEach, describe, expect, it, vi } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import { defineComponent, h, ref } from 'vue'
import { z } from 'zod'
import { TooltipProvider } from 'reka-ui'
import { UApp, UFormField, UInput } from '#components'
import ResourceState from '../../app/components/shared/ResourceState.vue'
import ConfirmActionPopover from '../../app/components/shared/ConfirmActionPopover.vue'
import EntityFormModal from '../../app/components/shared/EntityFormModal.vue'
import ActionMenu from '../../app/components/shared/ActionMenu.vue'
import FilePicker from '../../app/components/shared/FilePicker.vue'
import ResponsiveTable from '../../app/components/shared/ResponsiveTable.vue'

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

  it('shows a confirmation, preserves edits on Keep editing, and closes on Discard changes', async () => {
    const Harness = defineComponent({
      components: { UApp, EntityFormModal },
      setup: () => ({ open: ref(true), state: ref({ title: '' }) }),
      template: `<UApp><EntityFormModal v-model:open="open" :state="state" title="Create item">
        <input v-model="state.title" aria-label="Title" />
      </EntityFormModal></UApp>`,
    })
    const wrapper = await mountSuspended(Harness, {
      global: { stubs: {
        UModal: {
          props: ['open'],
          template: '<div v-if="open" role="dialog"><slot name="body" /></div>',
        },
      } },
    })
    const click = async (label: string) => {
      const button = wrapper.findAll('button').find(button => button.text() === label)
      expect(button, `Expected visible ${label} button`).toBeDefined()
      await button!.trigger('click')
      await flushPromises()
    }
    try {
      await wrapper.get('input').setValue('Changed draft')
      await click('Cancel')
      expect(wrapper.findAll('[role="dialog"]')).toHaveLength(2)
      await click('Keep editing')
      expect(wrapper.findAll('[role="dialog"]')).toHaveLength(1)
      expect(wrapper.get('input').element.value).toBe('Changed draft')
      await click('Cancel')
      await click('Discard changes')
      expect(wrapper.findAll('[role="dialog"]')).toHaveLength(0)
    }
    finally {
      wrapper.unmount()
    }
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

describe('SharedFilePicker', () => {
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
})

describe('SharedResponsiveTable', () => {
  it('keeps mobile identity, status, details, and actions on the native sorted and visible row model', async () => {
    const edit = vi.fn()
    const wrapper = await mountSuspended(ResponsiveTable, {
      props: {
        identityColumn: 'name', statusColumn: 'status',
        data: [{ name: 'Beta', status: 'Active', count: 2 }, { name: 'Alpha', status: 'Archived', count: 1 }],
        columns: [{ accessorKey: 'name', header: 'Name' }, { accessorKey: 'status', header: 'Status' }, { accessorKey: 'count', header: 'Count' }, { id: 'actions', header: 'Actions' }],
      },
      slots: { 'actions-cell': ({ row }: any) => h('button', { onClick: () => edit(row.original.name) }, 'Edit') },
    })
    await flushPromises()
    const table = wrapper.findComponent({ name: 'UTable' }).vm as unknown as { tableApi: any }
    table.tableApi.setSorting([{ id: 'name', desc: false }])
    await flushPromises()
    const records = wrapper.findAll('[data-mobile-record]')
    expect(records.map(record => record.get('[data-record-identity]').text())).toEqual(['Alpha', 'Beta'])
    expect(records[0]!.get('[data-record-status]').text()).toBe('Archived')
    expect(records[0]!.findAll('dt').map(label => label.text())).toEqual(['Count'])
    await records[0]!.get('[data-record-actions] button').trigger('click')
    expect(edit).toHaveBeenCalledWith('Alpha')
    table.tableApi.getColumn('count').toggleVisibility(false)
    await flushPromises()
    expect(wrapper.findAll('[data-mobile-record] dt')).toHaveLength(0)
    await wrapper.setProps({ loading: true })
    expect(wrapper.findAll('[data-mobile-record]')).toHaveLength(2)
    expect(wrapper.text()).toContain('Loading results')
    wrapper.unmount()
  })
})

describe('SharedActionMenu', () => {
  const wrappers: Awaited<ReturnType<typeof mountSuspended>>[] = []
  afterEach(() => { wrappers.splice(0).forEach(wrapper => wrapper.unmount()) })
  const settle = async () => { await flushPromises(); await new Promise(resolve => setTimeout(resolve, 250)); await flushPromises() }

  it('ignores pointer-restored focus but shows the tooltip for keyboard focus', async () => {
    const wrapper = await mountSuspended(defineComponent({
      setup: () => () => h(TooltipProvider, { delayDuration: 0 }, {
        default: () => h(ActionMenu, { name: 'Test record', items: [{ label: 'Edit', action: vi.fn() }] }),
      }),
    }), { attachTo: document.body })
    wrappers.push(wrapper)
    const trigger = wrapper.get('button[aria-label="Actions for Test record"]')
    const nativeMatches = trigger.element.matches.bind(trigger.element)
    let keyboardFocus = false
    const matches = vi.spyOn(trigger.element, 'matches').mockImplementation(selector => selector === ':focus-visible' ? keyboardFocus : nativeMatches(selector))
    try {
      await trigger.trigger('focus')
      await settle()
      expect(document.querySelector('[role="tooltip"]')).toBeNull()
      await trigger.trigger('blur')
      keyboardFocus = true
      await trigger.trigger('focus')
      await settle()
      expect(document.querySelector('[role="tooltip"]')?.textContent).toContain('Actions for Test record')
    } finally {
      matches.mockRestore()
    }
  })

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
})
