import { describe, expect, it, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import { mountSuspended, mockNuxtImport } from '@nuxt/test-utils/runtime'
import MapsPage from '../../app/pages/campaigns/[campaignId]/maps.vue'
import CampaignCharactersPage from '../../app/pages/campaigns/[campaignId]/characters.vue'

const mockRequest = vi.fn()

mockNuxtImport('useRoute', () => () => ({
  params: { campaignId: 'campaign-1' },
}))

mockNuxtImport('useApi', () => () => ({
  request: mockRequest,
}))

mockNuxtImport('useAsyncData', () => async (_key: string | (() => string), handler: () => Promise<unknown>) => ({
  data: ref(await handler()),
  pending: ref(false),
  error: ref(null),
  refresh: vi.fn(async () => undefined),
}))

describe('UM-3 UI permission states', () => {
  beforeEach(() => {
    mockRequest.mockReset()
  })

  it('shows map page read-only state when campaign write permission is false', async () => {
    mockRequest.mockImplementation(async (path: string) => {
      if (path === '/api/campaigns/campaign-1/maps') {
        return [
          {
            id: 'map-1',
            campaignId: 'campaign-1',
            name: 'Shared Map',
            slug: 'shared-map',
            isPrimary: true,
            status: 'ACTIVE',
            sourceType: 'AZGAAR_FULL_JSON',
            importVersion: 1,
            sourceFingerprint: 'fingerprint',
            hasSvg: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            featureCounts: {
              state: 1,
              province: 0,
              burg: 0,
              marker: 0,
              river: 0,
              route: 0,
              cell: 0,
            },
          },
        ]
      }

      if (path === '/api/campaigns/campaign-1/maps/map-1/viewer') {
        return {
          map: {
            id: 'map-1',
            campaignId: 'campaign-1',
            name: 'Shared Map',
            isPrimary: true,
            status: 'ACTIVE',
            importVersion: 1,
            sourceFingerprint: 'fingerprint',
            bounds: [[-180, -85], [180, 85]],
            defaultActiveLayers: ['state', 'marker'],
          },
          features: [],
        }
      }

      return null
    })

    const wrapper = await mountSuspended(MapsPage, {
      global: {
        provide: {
          campaignCanWriteContent: ref(false),
        },
        stubs: {
          ClientOnly: { template: '<div><slot /></div>' },
          MapsImportForm: { template: '<div>Maps Import Form</div>' },
          MapsLayerPanel: { template: '<div>Maps Layer Panel</div>' },
          MapsViewer: { template: '<div>Maps Viewer</div>' },
          MapsGlossaryStageModal: { template: '<div>Maps Glossary Stage Modal</div>' },
        },
      },
    })

    expect(wrapper.text()).toContain('Read-only access')

    const importAnotherButton = wrapper.findAll('button').find((button) =>
      button.text().includes('Import another map')
    )

    expect(importAnotherButton).toBeDefined()
    expect(importAnotherButton!.attributes('disabled')).toBeDefined()
  })

  it('shows shared-access warning in character unlink confirmation and requires confirm click', async () => {
    mockRequest.mockImplementation(async (path: string, options?: { method?: string }) => {
      if (path === '/api/campaigns/campaign-1/characters' && (!options?.method || options.method === 'GET')) {
        return [
          {
            id: 'link-1',
            campaignId: 'campaign-1',
            characterId: 'char-1',
            status: 'ACTIVE',
            roleLabel: null,
            notes: null,
            character: {
              id: 'char-1',
              name: 'Shared Character',
              canEdit: true,
              isOwner: true,
              summaryJson: { level: 4, classes: ['Fighter'] },
            },
            accessImpact: {
              warningRequired: true,
              impactedUserCount: 2,
            },
            campaign: {
              id: 'campaign-1',
              name: 'Campaign One',
            },
          },
        ]
      }

      if (path === '/api/characters') {
        return [{ id: 'char-1', name: 'Shared Character', canEdit: true, isOwner: true }]
      }

      if (path === '/api/campaigns/campaign-1/characters/char-1' && options?.method === 'DELETE') {
        return { success: true }
      }

      return null
    })

    const wrapper = await mountSuspended(CampaignCharactersPage, {
      global: {
        provide: {
          campaignCanWriteContent: ref(true),
        },
        stubs: {
          UPopover: {
            template: '<div><slot /><slot name="content" :close="() => {}" /></div>',
          },
        },
      },
    })

    expect(wrapper.text()).toContain('Shared access warning')
    expect(wrapper.text()).toContain('may lose access')

    const removeButtons = wrapper.findAll('button').filter((button) => button.text().trim() === 'Remove')
    expect(removeButtons.length).toBeGreaterThan(1)

    await removeButtons[0]!.trigger('click')
    expect(mockRequest).not.toHaveBeenCalledWith(
      '/api/campaigns/campaign-1/characters/char-1',
      expect.objectContaining({ method: 'DELETE' })
    )

    await removeButtons[1]!.trigger('click')
    expect(mockRequest).toHaveBeenCalledWith(
      '/api/campaigns/campaign-1/characters/char-1',
      expect.objectContaining({ method: 'DELETE' })
    )
  })
})
