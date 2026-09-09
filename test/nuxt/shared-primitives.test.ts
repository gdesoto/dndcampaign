import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { h } from 'vue'
import ResourceState from '../../app/components/shared/ResourceState.vue'
import EntityFormModal from '../../app/components/shared/EntityFormModal.vue'
import ListItemCard from '../../app/components/shared/ListItemCard.vue'
import StatCard from '../../app/components/shared/StatCard.vue'

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

  it('emits cancel from default footer actions', async () => {
    const wrapper = await mountSuspended(EntityFormModal, {
      props: {
        open: true,
        title: 'Create thing',
      },
      slots: {
        default: () => h('div', 'Fields'),
      },
      global: {
        stubs: {
          UModal: {
            props: ['open'],
            emits: ['update:open'],
            template: '<div><slot name="body" /></div>',
          },
        },
      },
    })

    const cancelButton = wrapper.findAll('button').find((button) => button.text().trim() === 'Cancel')
    expect(cancelButton).toBeDefined()
    await cancelButton!.trigger('click')
    expect(wrapper.emitted('cancel')).toBeTruthy()
  })

  it('disables overlay dismissal on the shared entity modal', async () => {
    const wrapper = await mountSuspended(EntityFormModal, {
      props: {
        open: true,
        title: 'Edit thing',
      },
      slots: {
        default: () => h('div', 'Fields'),
      },
      global: {
        stubs: {
          UModal: {
            props: ['open', 'dismissible'],
            emits: ['update:open'],
            template: '<div :data-dismissible="String(dismissible)"><slot name="body" /></div>',
          },
        },
      },
    })

    expect(wrapper.attributes('data-dismissible')).toBe('false')
  })

  it('emits delete when the footer delete action is enabled', async () => {
    const wrapper = await mountSuspended(EntityFormModal, {
      props: {
        open: true,
        title: 'Edit thing',
        showDeleteAction: true,
      },
      slots: {
        default: () => h('div', 'Fields'),
      },
      global: {
        stubs: {
          SharedConfirmActionPopover: {
            emits: ['confirm'],
            template: '<div><button type="button" @click="$emit(\'confirm\', { close: () => {} })">Delete</button></div>',
          },
          UModal: {
            props: ['open'],
            emits: ['update:open'],
            template: '<div><slot name="body" /></div>',
          },
        },
      },
    })

    const deleteButton = wrapper.findAll('button').find((button) => button.text().trim() === 'Delete')
    expect(deleteButton).toBeDefined()
    await deleteButton!.trigger('click')
    expect(wrapper.emitted('delete')).toBeTruthy()
  })
})

describe('SharedListItemCard', () => {
  it('renders header and default slots', async () => {
    const wrapper = await mountSuspended(ListItemCard, {
      slots: {
        header: () => h('div', 'Header'),
        default: () => h('p', 'Body'),
      },
    })

    expect(wrapper.text()).toContain('Header')
    expect(wrapper.text()).toContain('Body')
  })
})

describe('SharedStatCard', () => {
  it('renders label, value and optional hint', async () => {
    const wrapper = await mountSuspended(StatCard, {
      props: {
        label: 'Sessions',
        value: 12,
        hint: 'Latest this week',
      },
    })

    expect(wrapper.text()).toContain('Sessions')
    expect(wrapper.text()).toContain('12')
    expect(wrapper.text()).toContain('Latest this week')
  })
})
