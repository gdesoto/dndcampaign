import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'
import { mountSuspended, mockNuxtImport } from '@nuxt/test-utils/runtime'
import RequestsPage from '../../app/pages/campaigns/[campaignId]/requests.vue'

const mockListRequests = vi.fn()
const mockCreateRequest = vi.fn()
const mockUpdateRequest = vi.fn()
const mockCancelRequest = vi.fn()
const mockAddVote = vi.fn()
const mockRemoveMyVote = vi.fn()
const mockDecideRequest = vi.fn()

mockNuxtImport('useRoute', () => () => ({
  params: { campaignId: 'campaign-1' },
}))

mockNuxtImport('useAsyncData', () => async (_key: string | (() => string), handler: () => Promise<unknown>) => ({
  data: ref(await handler()),
  pending: ref(false),
  error: ref(null),
  refresh: vi.fn(async () => undefined),
}))

vi.mock('~/composables/useCampaignRequests', () => ({
  useCampaignRequests: () => ({
    listRequests: mockListRequests,
    createRequest: mockCreateRequest,
    updateRequest: mockUpdateRequest,
    cancelRequest: mockCancelRequest,
    addVote: mockAddVote,
    removeMyVote: mockRemoveMyVote,
    decideRequest: mockDecideRequest,
  }),
}))

const baseRequest = {
  id: 'req-1',
  campaignId: 'campaign-1',
  createdByUserId: 'user-1',
  createdByName: 'Player One',
  type: 'ITEM',
  visibility: 'PUBLIC',
  title: 'Need a silvered weapon',
  description: 'Asking for a silvered weapon before undead dungeon.',
  status: 'PENDING',
  decisionNote: null,
  decidedByUserId: null,
  decidedByName: null,
  decidedAt: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  voteCount: 2,
  viewerHasVoted: false,
  canModerate: false,
  canEdit: false,
  canCancel: false,
  canVote: true,
} as const

describe('Campaign requests page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockListRequests.mockResolvedValue({
      items: [baseRequest],
      pagination: {
        page: 1,
        pageSize: 50,
        total: 1,
        totalPages: 1,
      },
    })
  })

  it('hides moderation queue tab for non-DM access', async () => {
    const wrapper = await mountSuspended(RequestsPage, {
      global: {
        provide: {
          campaignAccess: computed(() => ({
            campaignId: 'campaign-1',
            role: 'COLLABORATOR',
            hasDmAccess: false,
            permissions: ['content.read'],
          })),
        },
      },
    })

    expect(wrapper.text()).toContain('DM request board')
    expect(wrapper.text()).not.toContain('Moderation Queue')
    expect(wrapper.text()).toContain('Need a silvered weapon')
  })

  it('shows moderation controls for DM-capable request items', async () => {
    mockListRequests.mockResolvedValue({
      items: [
        {
          ...baseRequest,
          id: 'req-2',
          visibility: 'PRIVATE',
          canModerate: true,
          canVote: false,
          viewerHasVoted: true,
        },
      ],
      pagination: {
        page: 1,
        pageSize: 50,
        total: 1,
        totalPages: 1,
      },
    })

    const wrapper = await mountSuspended(RequestsPage, {
      global: {
        provide: {
          campaignAccess: ref({
            campaignId: 'campaign-1',
            role: 'COLLABORATOR',
            hasDmAccess: true,
            permissions: ['content.read', 'content.write'],
          }),
        },
      },
    })

    expect(wrapper.text()).toContain('Moderation Queue')
    expect(wrapper.text()).toContain('Approve')
    expect(wrapper.text()).toContain('Deny')
    expect(wrapper.text()).toContain('DM Only')
    expect(wrapper.text()).not.toContain('Remove vote')
  })
})
