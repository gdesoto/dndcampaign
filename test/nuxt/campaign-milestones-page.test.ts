import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'
import { mountSuspended, mockNuxtImport } from '@nuxt/test-utils/runtime'
import MilestonesPage from '../../app/pages/campaigns/[campaignId]/milestones.vue'

const mockRequest = vi.fn()
const mockRefresh = vi.fn(async () => undefined)
const mockMilestones = ref([
  {
    id: 'milestone-1',
    title: 'Secure the alliance',
    description: 'Win over the northern clans.',
    isComplete: false,
    completedAt: null,
  },
])
const mockPending = ref(false)
const mockError = ref(null)

mockNuxtImport('useRoute', () => () => ({
  params: { campaignId: 'campaign-1' },
}))

mockNuxtImport('useApi', () => () => ({
  request: mockRequest,
}))

mockNuxtImport('useAsyncData', () => async (_key: string | (() => string), _handler: () => Promise<unknown>) => ({
  data: mockMilestones,
  pending: mockPending,
  error: mockError,
  refresh: mockRefresh,
}))

describe('Campaign milestones page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockMilestones.value = [
      {
        id: 'milestone-1',
        title: 'Secure the alliance',
        description: 'Win over the northern clans.',
        isComplete: false,
        completedAt: null,
      },
    ]
    mockPending.value = false
    mockError.value = null

    mockRequest.mockImplementation(async (path: string, options?: { method?: string }) => {
      if (path === '/api/campaigns/campaign-1/milestones' && (!options?.method || options.method === 'GET')) {
        return mockMilestones.value
      }

      if (path === '/api/milestones/milestone-1' && options?.method === 'DELETE') {
        return { success: true }
      }

      return null
    })
  })

  it('deletes a milestone after confirmation and refreshes the list', async () => {
    const wrapper = await mountSuspended(MilestonesPage, {
      global: {
        provide: {
          campaignCanWriteContent: computed(() => true),
        },
        stubs: {
          CampaignListTemplate: {
            template: `
              <div>
                <slot name="notice" />
                <slot />
              </div>
            `,
          },
          SharedResourceState: {
            props: ['pending', 'error', 'empty'],
            template: `
              <div>
                <slot v-if="pending" name="loading" />
                <slot v-else-if="empty" name="emptyActions" />
                <slot v-else />
              </div>
            `,
          },
          SharedListItemCard: {
            template: `
              <div>
                <slot name="header" />
                <slot />
              </div>
            `,
          },
          SharedEntityFormModal: {
            template: '<div><slot /></div>',
          },
          SharedReadOnlyAlert: {
            template: '<div />',
          },
          SharedConfirmActionPopover: {
            emits: ['confirm'],
            template: `
              <div>
                <slot name="trigger" />
                <button type="button" @click="$emit('confirm', { close: () => {} })">Confirm delete milestone</button>
              </div>
            `,
          },
          UButton: {
            emits: ['click'],
            props: ['disabled'],
            template: `<button type="button" :disabled="disabled" @click="$emit('click')"><slot /></button>`,
          },
          UCard: {
            template: '<div><slot /></div>',
          },
          UFormField: {
            template: '<label><slot /></label>',
          },
          UInput: {
            props: ['modelValue'],
            emits: ['update:modelValue'],
            template: `<input :value="modelValue" @input="$emit('update:modelValue', $event.target.value)" />`,
          },
          UTextarea: {
            props: ['modelValue'],
            emits: ['update:modelValue'],
            template: `<textarea :value="modelValue" @input="$emit('update:modelValue', $event.target.value)" />`,
          },
        },
      },
    })

    expect(wrapper.text()).toContain('Secure the alliance')

    const confirmDeleteButton = wrapper.findAll('button').find((button) =>
      button.text().trim() === 'Confirm delete milestone'
    )

    expect(confirmDeleteButton).toBeDefined()
    await confirmDeleteButton!.trigger('click')

    expect(mockRequest).toHaveBeenCalledWith('/api/milestones/milestone-1', expect.objectContaining({ method: 'DELETE' }))
    expect(mockRefresh).toHaveBeenCalled()
  })

  it('keeps milestone cards visible during background refreshes', async () => {
    mockPending.value = true

    const wrapper = await mountSuspended(MilestonesPage, {
      global: {
        provide: {
          campaignCanWriteContent: computed(() => true),
        },
        stubs: {
          CampaignListTemplate: {
            template: `
              <div>
                <slot name="notice" />
                <slot />
              </div>
            `,
          },
          SharedResourceState: {
            props: ['pending', 'error', 'empty'],
            template: `
              <div>
                <div v-if="pending">Loading milestones</div>
                <slot v-else-if="empty" name="emptyActions" />
                <slot v-else />
              </div>
            `,
          },
          SharedListItemCard: {
            template: `
              <div>
                <slot name="header" />
                <slot />
              </div>
            `,
          },
          SharedEntityFormModal: {
            template: '<div><slot /></div>',
          },
          SharedReadOnlyAlert: {
            template: '<div />',
          },
          SharedConfirmActionPopover: {
            template: '<div><slot name="trigger" /></div>',
          },
          UButton: {
            emits: ['click'],
            props: ['disabled'],
            template: `<button type="button" :disabled="disabled" @click="$emit('click')"><slot /></button>`,
          },
          UCard: {
            template: '<div><slot /></div>',
          },
          UFormField: {
            template: '<label><slot /></label>',
          },
          UInput: {
            props: ['modelValue'],
            emits: ['update:modelValue'],
            template: `<input :value="modelValue" @input="$emit('update:modelValue', $event.target.value)" />`,
          },
          UTextarea: {
            props: ['modelValue'],
            emits: ['update:modelValue'],
            template: `<textarea :value="modelValue" @input="$emit('update:modelValue', $event.target.value)" />`,
          },
        },
      },
    })

    expect(wrapper.text()).toContain('Secure the alliance')
    expect(wrapper.text()).not.toContain('Loading milestones')
  })
})
