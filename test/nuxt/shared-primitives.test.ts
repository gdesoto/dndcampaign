import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { h } from 'vue'
import ResourceState from '../../app/components/shared/ResourceState.vue'
import EntityFormModal from '../../app/components/shared/EntityFormModal.vue'
import ListItemCard from '../../app/components/shared/ListItemCard.vue'
import StatCard from '../../app/components/shared/StatCard.vue'

describe('SharedResourceState', () => {
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
            template: '<div><slot name="content" /></div>',
          },
        },
      },
    })

    const cancelButton = wrapper.findAll('button').find((button) => button.text().trim() === 'Cancel')
    expect(cancelButton).toBeDefined()
    await cancelButton!.trigger('click')
    expect(wrapper.emitted('cancel')).toBeTruthy()
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
