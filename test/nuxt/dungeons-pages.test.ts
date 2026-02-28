import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { mountSuspended, mockNuxtImport } from '@nuxt/test-utils/runtime'
import DungeonsPage from '../../app/pages/campaigns/[campaignId]/dungeons/index.vue'
import DungeonDetailPage from '../../app/pages/campaigns/[campaignId]/dungeons/[dungeonId].vue'

const mockListDungeons = vi.fn()
const mockCreateDungeon = vi.fn()
const mockImportDungeon = vi.fn()
const mockDeleteDungeon = vi.fn()
const mockGetDungeon = vi.fn()
const mockUpdateDungeon = vi.fn()
const mockGenerateDungeon = vi.fn()
const mockRegenerateDungeon = vi.fn()
const mockPatchMap = vi.fn()
const mockListRooms = vi.fn()
const mockUpdateRoom = vi.fn()
const mockListLinks = vi.fn()
const mockCreateLink = vi.fn()
const mockDeleteLink = vi.fn()
const mockListSnapshots = vi.fn()
const mockCreateSnapshot = vi.fn()
const mockRestoreSnapshot = vi.fn()
const mockExportDungeon = vi.fn()
const mockPublishDungeon = vi.fn()
const mockUnpublishDungeon = vi.fn()
const mockCreateEncounterFromRoom = vi.fn()

mockNuxtImport('useRoute', () => () => ({
  params: { campaignId: 'campaign-1', dungeonId: 'dungeon-1' },
}))

vi.mock('~/composables/useDungeonList', () => ({
  useDungeonList: () => ({
    listDungeons: mockListDungeons,
    createDungeon: mockCreateDungeon,
    importDungeon: mockImportDungeon,
    deleteDungeon: mockDeleteDungeon,
  }),
}))

vi.mock('~/composables/useDungeonDetail', () => ({
  useDungeonDetail: () => ({
    getDungeon: mockGetDungeon,
    updateDungeon: mockUpdateDungeon,
    generateDungeon: mockGenerateDungeon,
    regenerateDungeon: mockRegenerateDungeon,
    patchMap: mockPatchMap,
    listRooms: mockListRooms,
    updateRoom: mockUpdateRoom,
    listLinks: mockListLinks,
    createLink: mockCreateLink,
    deleteLink: mockDeleteLink,
    listSnapshots: mockListSnapshots,
    createSnapshot: mockCreateSnapshot,
    restoreSnapshot: mockRestoreSnapshot,
    exportDungeon: mockExportDungeon,
    publishDungeon: mockPublishDungeon,
    unpublishDungeon: mockUnpublishDungeon,
    createEncounterFromRoom: mockCreateEncounterFromRoom,
  }),
}))

const dungeonDetailFixture = {
  id: 'dungeon-1',
  campaignId: 'campaign-1',
  name: 'Sunken Crypt',
  status: 'DRAFT',
  theme: 'crypt',
  seed: 'seed-x',
  gridType: 'SQUARE',
  generatorVersion: '1.0.0',
  roomCount: 2,
  canDelete: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  config: {
    gridType: 'SQUARE',
    width: 60,
    height: 60,
    cellSize: 32,
    theme: 'crypt',
    layout: {
      roomDensity: 0.25,
      minRoomSize: 4,
      maxRoomSize: 10,
      corridorStyle: 'MIXED',
      connectivityStrictness: 0.7,
      secretRoomChance: 0.1,
    },
    doors: {
      doorFrequency: 0.65,
      lockedDoorChance: 0.2,
      secretDoorChance: 0.08,
      specialDoorChance: 0.05,
    },
    content: {
      trapDensity: 0.15,
      encounterDensity: 0.3,
      treasureDensity: 0.2,
      dressingDensity: 0.35,
    },
  },
  map: {
    schemaVersion: 1,
    gridType: 'SQUARE',
    width: 60,
    height: 60,
    cellSize: 32,
    rooms: [
      { id: 'room-1', roomNumber: 1, x: 2, y: 2, width: 8, height: 8, isSecret: false },
      { id: 'room-2', roomNumber: 2, x: 20, y: 20, width: 10, height: 10, isSecret: true },
    ],
    corridors: [
      {
        id: 'corridor-1',
        fromRoomId: 'room-1',
        toRoomId: 'room-2',
        points: [{ x: 6, y: 6 }, { x: 25, y: 6 }, { x: 25, y: 25 }],
      },
    ],
    doors: [{ id: 'door-1', x: 6, y: 6, corridorId: 'corridor-1', isLocked: false, isSecret: false, isSpecial: false }],
    walls: [],
    traps: [],
    encounters: [],
    treasures: [],
    dressing: [],
    zones: [],
    metadata: {
      algorithmVersion: '1.0.0',
      configHash: 'abc123',
      generatedAt: new Date().toISOString(),
      seed: 'seed-x',
      passHistory: [],
    },
  },
  playerView: null,
}

describe('Dungeon pages', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockListDungeons.mockResolvedValue([
      {
        id: 'dungeon-1',
        campaignId: 'campaign-1',
        name: 'Sunken Crypt',
        status: 'DRAFT',
        theme: 'crypt',
        seed: 'seed-x',
        gridType: 'SQUARE',
        generatorVersion: '1.0.0',
        roomCount: 2,
        canDelete: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ])
    mockGetDungeon.mockResolvedValue(dungeonDetailFixture)
    mockUpdateDungeon.mockResolvedValue(dungeonDetailFixture)
    mockGenerateDungeon.mockResolvedValue(dungeonDetailFixture)
    mockRegenerateDungeon.mockResolvedValue(dungeonDetailFixture)
    mockPatchMap.mockResolvedValue(dungeonDetailFixture.map)
    mockListRooms.mockResolvedValue([
      {
        id: 'room-row-1',
        dungeonId: 'dungeon-1',
        roomNumber: 1,
        name: 'Entry Hall',
        description: null,
        gmNotes: null,
        playerNotes: null,
        readAloud: null,
        tags: [],
        bounds: { x: 2, y: 2, width: 8, height: 8 },
        state: 'UNSEEN',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ])
    mockUpdateRoom.mockResolvedValue({})
    mockListLinks.mockResolvedValue([])
    mockCreateLink.mockResolvedValue({})
    mockDeleteLink.mockResolvedValue({})
    mockListSnapshots.mockResolvedValue([])
    mockCreateSnapshot.mockResolvedValue({})
    mockRestoreSnapshot.mockResolvedValue({ restored: true })
    mockExportDungeon.mockResolvedValue({
      format: 'JSON',
      filename: 'sunken-crypt-dm.json',
      contentType: 'application/json',
      content: '{}',
      encoding: 'utf8',
    })
    mockPublishDungeon.mockResolvedValue({ ...dungeonDetailFixture, status: 'READY' })
    mockUnpublishDungeon.mockResolvedValue({ ...dungeonDetailFixture, status: 'DRAFT' })
    mockCreateEncounterFromRoom.mockResolvedValue({ encounterId: 'encounter-1' })
    mockImportDungeon.mockResolvedValue({ id: 'imported-dungeon-1' })
    mockDeleteDungeon.mockResolvedValue({ deleted: true })
  })

  it('renders dungeons list entries', async () => {
    const wrapper = await mountSuspended(DungeonsPage, {
      global: {
        provide: {
          campaignCanWriteContent: ref(true),
        },
      },
    })

    expect(wrapper.text()).toContain('Sunken Crypt')
    expect(wrapper.text()).toContain('Dungeons')
  })

  it('shows read-only state in detail page for viewers', async () => {
    const wrapper = await mountSuspended(DungeonDetailPage, {
      global: {
        provide: {
          campaignCanWriteContent: ref(false),
        },
        stubs: {
          DungeonMapCanvas: {
            template: '<div data-test="map-canvas-stub">map</div>',
          },
        },
      },
    })

    expect(wrapper.text()).toContain('Read-only access')
    expect(wrapper.text()).toContain('Generator Settings')
    expect(wrapper.text()).toContain('Room Metadata')
    expect(wrapper.text()).toContain('Map Edit Tools')
    expect(wrapper.text()).toContain('Links')
    expect(wrapper.text()).toContain('Export')
    expect(wrapper.text()).toContain('Snapshots')
    expect(wrapper.find('[data-test="map-canvas-stub"]').exists()).toBe(true)
  })
})
