import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'
import { mountSuspended, mockNuxtImport } from '@nuxt/test-utils/runtime'
import JournalEntryPage from '../../app/pages/campaigns/[campaignId]/journal/[entryId].vue'

const mockGetEntry = vi.fn()
const mockListEntryHistory = vi.fn()
const mockListMemberOptions = vi.fn()
const mockUpdateEntry = vi.fn()
const mockDeleteEntry = vi.fn()
const mockDiscoverEntry = vi.fn()
const mockTransferEntry = vi.fn()
const mockArchiveEntry = vi.fn()
const mockUnarchiveEntry = vi.fn()
const mockRequest = vi.fn()
const mockToastAdd = vi.fn()

mockNuxtImport('useRoute', () => () => ({
  params: { campaignId: 'campaign-1', entryId: 'entry-1' },
}))

mockNuxtImport('useUserSession', () => () => ({
  user: ref({ id: 'user-holder' }),
}))

mockNuxtImport('useAsyncData', () => async (_key: string | (() => string), handler: () => Promise<unknown>) => ({
  data: ref(await handler()),
  pending: ref(false),
  error: ref(null),
  refresh: vi.fn(async () => undefined),
}))

vi.mock('~/composables/useCampaignJournal', () => ({
  useCampaignJournal: () => ({
    getEntry: mockGetEntry,
    listEntryHistory: mockListEntryHistory,
    listMemberOptions: mockListMemberOptions,
    updateEntry: mockUpdateEntry,
    deleteEntry: mockDeleteEntry,
    discoverEntry: mockDiscoverEntry,
    transferEntry: mockTransferEntry,
    archiveEntry: mockArchiveEntry,
    unarchiveEntry: mockUnarchiveEntry,
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

const discoverableEntry = {
  id: 'entry-1',
  campaignId: 'campaign-1',
  authorUserId: 'user-dm',
  authorName: 'DM One',
  holderUserId: 'user-holder',
  holderUserName: 'Holder User',
  title: 'Found Letter',
  contentMarkdown: 'Secret note',
  visibility: 'DM' as const,
  isDiscoverable: true,
  discoveredAt: new Date().toISOString(),
  discoveredByUserId: 'user-dm',
  discoveredByUserName: 'DM One',
  isArchived: false,
  archivedAt: null,
  archivedByUserId: null,
  archivedByUserName: null,
  sessions: [],
  tags: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  canView: true,
  canEdit: true,
  canDelete: false,
}

describe('campaign journal entry page', () => {
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
    mockGetEntry.mockResolvedValue(discoverableEntry)
    mockListEntryHistory.mockResolvedValue({
      items: [
        {
          id: 'h1',
          campaignJournalEntryId: 'entry-1',
          campaignId: 'campaign-1',
          fromHolderUserId: null,
          fromHolderUserName: null,
          toHolderUserId: 'user-holder',
          toHolderUserName: 'Holder User',
          actorUserId: 'user-dm',
          actorUserName: 'DM One',
          action: 'DISCOVERED',
          createdAt: new Date().toISOString(),
        },
      ],
      pagination: { page: 1, pageSize: 30, total: 1, totalPages: 1 },
    })
    mockListMemberOptions.mockResolvedValue({
      items: [
        { userId: 'user-holder', name: 'Holder User', role: 'COLLABORATOR', hasDmAccess: false },
        { userId: 'user-dm', name: 'DM One', role: 'OWNER', hasDmAccess: true },
      ],
    })
    mockRequest.mockResolvedValue([])
  })

  it('shows discoverable holder controls and history timeline', async () => {
    const wrapper = await mountSuspended(JournalEntryPage, {
      global: {
        stubs: formStubs,
        provide: {
          campaignAccess: computed(() => ({
            campaignId: 'campaign-1',
            role: 'COLLABORATOR',
            hasDmAccess: false,
            permissions: ['content.read', 'content.write'],
          })),
        },
      },
    })

    expect(wrapper.text()).toContain('Found Letter')
    expect(wrapper.text()).toContain('Discoverable Actions')
    expect(wrapper.text()).toContain('Transfer')
    expect(wrapper.text()).toContain('Archive')
    expect(wrapper.text()).toContain('History')
    expect(wrapper.text()).toContain('DISCOVERED')
  })
})
