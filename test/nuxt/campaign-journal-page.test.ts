import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'
import { mountSuspended, mockNuxtImport } from '@nuxt/test-utils/runtime'
import JournalPage from '../../app/pages/campaigns/[campaignId]/journal.vue'

const mockListEntries = vi.fn()
const mockListTags = vi.fn()
const mockCreateEntry = vi.fn()
const mockUpdateEntry = vi.fn()
const mockDeleteEntry = vi.fn()
const mockRequest = vi.fn()
const mockToastAdd = vi.fn()

mockNuxtImport('useRoute', () => () => ({
  params: { campaignId: 'campaign-1' },
}))

mockNuxtImport('useAsyncData', () => async (_key: string | (() => string), handler: () => Promise<unknown>) => ({
  data: ref(await handler()),
  pending: ref(false),
  error: ref(null),
  refresh: vi.fn(async () => undefined),
}))

vi.mock('~/composables/useCampaignJournal', () => ({
  useCampaignJournal: () => ({
    listEntries: mockListEntries,
    listTags: mockListTags,
    createEntry: mockCreateEntry,
    updateEntry: mockUpdateEntry,
    deleteEntry: mockDeleteEntry,
  }),
}))

vi.mock('~/composables/useApi', () => ({
  useApi: () => ({
    request: mockRequest,
  }),
}))

vi.mock('~/composables/useToast', () => ({
  useToast: () => ({
    add: mockToastAdd,
  }),
}))

const entry = {
  id: 'entry-1',
  campaignId: 'campaign-1',
  authorUserId: 'user-player',
  authorName: 'Player One',
  title: 'Journal Entry One',
  contentMarkdown: 'This is body text.',
  visibility: 'CAMPAIGN' as const,
  sessions: [],
  tags: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  canView: true,
  canEdit: true,
  canDelete: true,
}

describe('campaign journal page', () => {
  const formStubs = {
    USelect: {
      props: ['modelValue'],
      emits: ['update:modelValue'],
      template: '<input :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
    },
    USelectMenu: {
      props: ['modelValue'],
      emits: ['update:modelValue'],
      template: '<div><slot /></div>',
    },
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockListEntries.mockResolvedValue({
      items: [entry],
      pagination: {
        page: 1,
        pageSize: 50,
        total: 1,
        totalPages: 1,
      },
    })
    mockListTags.mockResolvedValue({
      items: [],
      pagination: {
        page: 1,
        pageSize: 200,
        total: 0,
        totalPages: 1,
      },
    })
    mockRequest.mockImplementation(async (url: string) => {
      if (url.includes('/sessions')) {
        return [{ id: 'session-1', title: 'Session One', sessionNumber: 1 }]
      }
      if (url.includes('/glossary')) {
        return [{ id: 'glossary-1', name: 'Ancient Relic' }]
      }
      return []
    })
  })

  it('hides DM tab for non-DM members and renders journal list content', async () => {
    const wrapper = await mountSuspended(JournalPage, {
      global: {
        stubs: formStubs,
        provide: {
          campaignCanWriteContent: true,
          campaignAccess: computed(() => ({
            campaignId: 'campaign-1',
            role: 'COLLABORATOR',
            hasDmAccess: false,
            permissions: ['content.read', 'content.write'],
          })),
        },
      },
    })

    expect(wrapper.text()).toContain('Campaign journal')
    expect(wrapper.text()).not.toContain('DM-visible')
    expect(wrapper.text()).toContain('Journal Entry One')
    expect(wrapper.text()).toContain('Open')
    expect(mockListEntries).toHaveBeenCalled()
  })

  it('shows DM tab for DM users and shows read-only alert when writing disabled', async () => {
    const wrapper = await mountSuspended(JournalPage, {
      global: {
        stubs: formStubs,
        provide: {
          campaignCanWriteContent: false,
          campaignAccess: ref({
            campaignId: 'campaign-1',
            role: 'COLLABORATOR',
            hasDmAccess: true,
            permissions: ['content.read', 'content.write'],
          }),
        },
      },
    })

    expect(wrapper.text()).toContain('DM-visible')
    expect(wrapper.text()).toContain('Read-only role')
    expect(wrapper.text()).toContain('cannot create new entries')
  })
})
