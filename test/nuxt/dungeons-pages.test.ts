import { config, flushPromises, type VueWrapper } from '@vue/test-utils'
import { actionMenuStub } from '../helpers/action-menu'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MapCanvas from '../../app/components/dungeon/MapCanvas.vue'
import type { DungeonGeneratorConfig, DungeonMapData } from '../../shared/types/dungeon'
import { ref } from 'vue'
import { mountSuspended, mockNuxtImport } from '@nuxt/test-utils/runtime'
import { USelect } from '#components'
import DungeonsPage from '../../app/pages/campaigns/[campaignId]/dungeons/index.vue'
import DungeonDetailPage from '../../app/pages/campaigns/[campaignId]/dungeons/[dungeonId].vue'
import DashboardLayout from '../../app/layouts/dashboard.vue'

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
const discardDecision = vi.hoisted(() => ({ confirm: vi.fn(async () => false) }))

mockNuxtImport('useRoute', () => () => ({
  path: '/campaigns/campaign-1/dungeons/dungeon-1',
  params: { campaignId: 'campaign-1', dungeonId: 'dungeon-1' },
}))
mockNuxtImport('useApi', () => () => ({ request: async () => ({ id: 'campaign-1', name: 'Test campaign' }) }))
mockNuxtImport('navigateTo', () => async () => undefined)
mockNuxtImport('useOverlay', () => () => ({
  create: () => ({ open: () => ({ result: discardDecision.confirm() }), close: () => {} }),
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

const advancedOptions = {
  encounterScale: 'COMPLEX',
  accessPoints: { entrances: 3, exits: 2, entranceSide: 'WEST', concealedEntrance: true },
  tacticalTerrain: { cover: 'HEAVY', elevation: true, difficultTerrain: true, hazards: true, sightlines: 'BROKEN' },
  verticalConnections: { basement: true, staircases: 'DUAL', ladders: true, balconies: true, bridges: true },
} satisfies Pick<DungeonGeneratorConfig, 'encounterScale' | 'accessPoints' | 'tacticalTerrain' | 'verticalConnections'>

const selectProps = (select: { props(): unknown }) => select.props() as { modelValue: unknown; items: unknown }

config.global.stubs.SharedActionMenu = actionMenuStub
config.global.stubs.UModal = {
  props: ['open', 'title', 'description'],
  template: '<section v-if="open" role="dialog"><h2>{{ title }}</h2><p>{{ description }}</p><slot name="body" /></section>',
}
const clickButton = async (wrapper: VueWrapper, label: string) => {
  const button = wrapper.findAll('button').find(item => item.text() === label)
  expect(button, `Expected visible ${label} button`).toBeDefined()
  await button!.trigger('click')
  await flushPromises()
}

describe('Dungeon pages', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    discardDecision.confirm.mockResolvedValue(false)
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
    mockCreateDungeon.mockResolvedValue({ id: 'generated-map-1' })
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
    expect(wrapper.text()).toContain('Encounter maps')
    wrapper.unmount()
  })

  it('keeps encounter maps reachable in the grouped campaign sidebar and breadcrumbs', async () => {
    const wrapper = await mountSuspended(DashboardLayout, {
      global: {
        stubs: {
          AppHeader: true,
          CampaignPartyFooter: true,
          UDashboardGroup: { template: '<div><slot /></div>' },
          UDashboardSidebar: { template: '<aside><slot :collapsed="false" /></aside>' },
          UDashboardPanel: { template: '<main><slot name="header" /><slot name="body" /></main>' },
          UDashboardNavbar: { template: '<header><slot name="left" /></header>' },
          UDashboardSidebarCollapse: true,
        },
      },
    })
    const mapLink = wrapper.findAll('aside a').find(link => link.text() === 'Encounter maps')
    expect(mapLink?.attributes('href')).toBe('/campaigns/campaign-1/dungeons')
    expect(wrapper.get('main').text()).toContain('Encounter map')
    wrapper.unmount()
  })

  it('preserves all creation options after failure and clears building-only choices when changing to a forest', async () => {
    const wrapper = await mountSuspended(DungeonsPage, {
      global: {
        provide: { campaignCanWriteContent: ref(true) },
        stubs: {
          SharedEntityFormModal: {
            props: ['open', 'submitLabel'], emits: ['submit'],
            template: '<div v-if="open"><slot /><button @click="$emit(\'submit\')">{{ submitLabel }}</button></div>',
          },
        },
      },
    })
    const button = (label: string) => wrapper.findAll('button').find(item => item.text() === label)!
    const select = async (label: string, value: string | number) => {
      wrapper.findAllComponents(USelect).find(item => item.vm.$attrs['aria-label'] === label)!.vm.$emit('update:modelValue', value)
      await flushPromises()
    }
    const toggle = async (label: string) => {
      const controlLabel = wrapper.findAll('label').find(item => item.text() === label)!
      await wrapper.get(`button[id="${controlLabel.attributes('for')}"]`).trigger('click')
    }
    await button('New map').trigger('click')
    await wrapper.get('input[placeholder="Ancient catacombs"]').setValue('Three-floor manor')
    expect(selectProps(wrapper.findAllComponents(USelect).find(item => item.vm.$attrs['aria-label'] === 'Encounter scale')!).modelValue).toBe('SEQUENCE')
    await select('Map type', 'BUILDING')
    await select('Map size', 30)
    await select('Floor count', 3)
    await select('Encounter scale', 'COMPLEX')
    await select('Encounter flow', 'LOOP')
    for (const label of ['Access points', 'Tactical terrain', 'Vertical connections']) {
      expect(button(label).attributes('aria-expanded')).toBe('false')
      await button(label).trigger('click')
    }
    await select('Entrances', 3)
    await select('Exits', 2)
    await select('Main entrance side', 'WEST')
    await select('Cover', 'HEAVY')
    await select('Sightlines', 'BROKEN')
    await select('Staircases', 'DUAL')
    for (const label of ['Concealed entrance', 'Elevated positions', 'Difficult terrain', 'Environmental hazards', 'Basement', 'Ladders', 'Balconies', 'Bridges']) {
      await toggle(label)
    }
    mockCreateDungeon.mockRejectedValueOnce(new Error('Generation failed'))
    await button('Generate map').trigger('click')
    await flushPromises()
    expect((wrapper.get('input[placeholder="Ancient catacombs"]').element as HTMLInputElement).value).toBe('Three-floor manor')
    expect(wrapper.get('[aria-label="Encounter flow"]').text()).toContain('Alternate routes')
    await button('Generate map').trigger('click')
    await flushPromises()
    expect(mockCreateDungeon).toHaveBeenLastCalledWith('campaign-1', expect.objectContaining({
      name: 'Three-floor manor',
      config: expect.objectContaining({ mapType: 'BUILDING', floorCount: 3, width: 30, height: 30, encounterFlow: 'LOOP', ...advancedOptions }),
    }))

    await button('New map').trigger('click')
    await wrapper.get('input[placeholder="Ancient catacombs"]').setValue('Forest ambush')
    expect(selectProps(wrapper.findAllComponents(USelect).find(item => item.vm.$attrs['aria-label'] === 'Encounter scale')!).modelValue).toBe('SEQUENCE')
    await select('Map type', 'BUILDING')
    await select('Floor count', 4)
    await button('Vertical connections').trigger('click')
    await select('Staircases', 'DUAL')
    for (const label of ['Basement', 'Ladders', 'Balconies', 'Bridges']) await toggle(label)
    await select('Map type', 'FOREST')
    expect(wrapper.find('[aria-label="Floor count"]').exists()).toBe(false)
    await button('Generate map').trigger('click')
    await flushPromises()
    expect(mockCreateDungeon).toHaveBeenLastCalledWith('campaign-1', expect.objectContaining({
      config: expect.objectContaining({
        mapType: 'FOREST', floorCount: 1, encounterFlow: 'BRANCHING', encounterScale: 'SEQUENCE',
        verticalConnections: { basement: false, staircases: 'SINGLE', ladders: false, balconies: false, bridges: true },
      }),
    }))
    wrapper.unmount()
  })

  it('uses the shared creation schema for optional seeds, field feedback, and preserved drafts', async () => {
    const wrapper = await mountSuspended(DungeonsPage, {
      attachTo: document.body,
      global: { provide: { campaignCanWriteContent: ref(true) } },
    })
    await clickButton(wrapper, 'New map')
    await wrapper.get('input[placeholder="Ancient catacombs"]').setValue('Seeded map')
    const seed = wrapper.get('input[placeholder="e.g. crypt-2026-03-14"]')
    await seed.setValue('x'.repeat(81))
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(mockCreateDungeon).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('<=80 characters')
    expect((seed.element as HTMLInputElement).value).toBe('x'.repeat(81))
    expect(document.activeElement).toBe(seed.element)
    for (const [input, expected] of [[' a ', 'a'], ['my seed', 'my seed'], ['   ', undefined]] as const) {
      await seed.setValue(input)
      mockCreateDungeon.mockRejectedValueOnce(new Error('Keep the draft'))
      await wrapper.get('form').trigger('submit')
      await flushPromises()
      expect(mockCreateDungeon).toHaveBeenLastCalledWith('campaign-1', expect.objectContaining({ seed: expected }))
      expect(wrapper.find('[role="dialog"]').exists()).toBe(true)
      expect(wrapper.text()).toContain('Keep the draft')
      expect((wrapper.get('input[placeholder="Ancient catacombs"]').element as HTMLInputElement).value).toBe('Seeded map')
    }
    wrapper.unmount()
  })

  it('roundtrips stored generation options, preserves regeneration drafts on failure, and normalizes single-floor buildings', async () => {
    const storedConfig = {
      ...dungeonDetailFixture.config,
      mapType: 'BUILDING', floorCount: 3, encounterFlow: 'LOOP', ...structuredClone(advancedOptions),
    }
    const map: DungeonMapData = {
      ...dungeonDetailFixture.map as DungeonMapData,
      mapType: 'BUILDING', floorCount: 3,
      floorLabels: ['Basement', 'Ground floor', 'Upper floor'],
      rooms: dungeonDetailFixture.map.rooms.map((room, index) => ({ ...room, floor: index === 0 ? 1 : 0, isSecret: false })),
      flow: { style: 'LOOP', entryRoomId: 'room-1', objectiveRoomId: 'room-2', exitRoomId: 'room-1', routeRoomIds: ['room-1', 'room-2', 'room-1'] },
    }
    const detail = { ...dungeonDetailFixture, map, config: storedConfig }
    mockGetDungeon.mockResolvedValue(detail)
    mockUpdateDungeon.mockResolvedValue(detail)
    const wrapper = await mountSuspended(DungeonDetailPage, {
      global: {
        provide: { campaignCanWriteContent: ref(true) },
        stubs: {
          DungeonMapCanvas: true,
          UDropdownMenu: {
            props: ['items'],
            template: '<div><slot /><button v-for="item in items.flat()" :key="item.label" @click="item.onSelect()">{{ item.label }}</button></div>',
          },
        },
      },
    })
    const button = (label: string) => wrapper.findAll('button').find(item => item.text() === label)!
    const select = (label: string) => wrapper.findAllComponents(USelect).find(item => item.vm.$attrs['aria-label'] === label)!
    expect(selectProps(select('Viewing floor')).modelValue).toBe(1)
    select('Viewing floor').vm.$emit('update:modelValue', 0)
    await flushPromises()
    expect(selectProps(select('Encounter scale')).modelValue).toBe('COMPLEX')
    expect(selectProps(select('Encounter flow')).modelValue).toBe('LOOP')
    for (const label of ['Access points', 'Tactical terrain', 'Vertical connections']) await button(label).trigger('click')
    for (const [label, value] of [['Entrances', 3], ['Exits', 2], ['Main entrance side', 'WEST'], ['Cover', 'HEAVY'], ['Sightlines', 'BROKEN'], ['Staircases', 'DUAL']] as const) {
      expect(selectProps(select(label)).modelValue).toBe(value)
    }
    for (const label of ['Concealed entrance', 'Elevated positions', 'Difficult terrain', 'Environmental hazards', 'Basement', 'Ladders', 'Balconies', 'Bridges']) {
      const controlLabel = wrapper.findAll('label').find(item => item.text() === label)!
      expect(wrapper.get(`button[id="${controlLabel.attributes('for')}"]`).attributes('aria-checked')).toBe('true')
    }
    await button('Save settings').trigger('click')
    await flushPromises()
    expect(mockUpdateDungeon).toHaveBeenLastCalledWith('campaign-1', 'dungeon-1', expect.objectContaining({ config: storedConfig }))
    expect(selectProps(select('Viewing floor')).modelValue).toBe(0)

    select('Encounter scale').vm.$emit('update:modelValue', 'SINGLE')
    select('Entrances').vm.$emit('update:modelValue', 2)
    select('Cover').vm.$emit('update:modelValue', 'LIGHT')
    await flushPromises()
    const draftConfig = {
      ...storedConfig,
      encounterScale: 'SINGLE',
      accessPoints: { ...storedConfig.accessPoints, entrances: 2 },
      tacticalTerrain: { ...storedConfig.tacticalTerrain, cover: 'LIGHT' },
    }
    mockRegenerateDungeon.mockRejectedValueOnce(new Error('Regeneration failed'))
    await button('Regenerate full').trigger('click')
    await flushPromises()
    expect(mockRegenerateDungeon).not.toHaveBeenCalled()
    await clickButton(wrapper, 'Regenerate map')
    await flushPromises()
    expect(mockRegenerateDungeon).toHaveBeenLastCalledWith('campaign-1', 'dungeon-1', expect.objectContaining({ scope: 'FULL', config: draftConfig }))
    expect(wrapper.text()).toContain('Regeneration failed')
    expect(selectProps(select('Encounter scale')).modelValue).toBe('SINGLE')
    expect(selectProps(select('Entrances')).modelValue).toBe(2)
    expect(selectProps(select('Cover')).modelValue).toBe('LIGHT')
    await clickButton(wrapper, 'Cancel')
    mockGenerateDungeon.mockRejectedValueOnce(new Error('Generation failed'))
    await button('Generate').trigger('click')
    await flushPromises()
    await clickButton(wrapper, 'Generate map')
    await flushPromises()
    expect(mockGenerateDungeon).toHaveBeenLastCalledWith('campaign-1', 'dungeon-1', expect.objectContaining({ config: draftConfig }))
    await clickButton(wrapper, 'Cancel')

    mockRegenerateDungeon.mockRejectedValueOnce(new Error('Trap regeneration failed'))
    await button('Regenerate traps').trigger('click')
    await flushPromises()
    expect(mockRegenerateDungeon).toHaveBeenLastCalledWith('campaign-1', 'dungeon-1', {
      scope: 'TRAPS', preserveLocks: true, seed: 'seed-x',
    })
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
    expect(selectProps(select('Encounter scale')).modelValue).toBe('SINGLE')

    select('Floor count').vm.$emit('update:modelValue', 2)
    await flushPromises()
    expect(wrapper.findAll('label').some(item => item.text() === 'Balconies')).toBe(false)
    mockRegenerateDungeon.mockRejectedValueOnce(new Error('Regeneration failed'))
    await button('Regenerate full').trigger('click')
    await flushPromises()
    await clickButton(wrapper, 'Regenerate map')
    await flushPromises()
    expect(mockRegenerateDungeon).toHaveBeenLastCalledWith('campaign-1', 'dungeon-1', expect.objectContaining({
      config: expect.objectContaining({
        floorCount: 2,
        verticalConnections: { ...advancedOptions.verticalConnections, balconies: false },
      }),
    }))
    await clickButton(wrapper, 'Cancel')
    select('Floor count').vm.$emit('update:modelValue', 1)
    await flushPromises()
    await button('Save settings').trigger('click')
    await flushPromises()
    expect(mockUpdateDungeon).toHaveBeenLastCalledWith('campaign-1', 'dungeon-1', expect.objectContaining({
      config: expect.objectContaining({
        ...draftConfig,
        floorCount: 1,
        verticalConnections: { basement: false, staircases: 'SINGLE', ladders: false, balconies: false, bridges: true },
      }),
    }))
    wrapper.unmount()
  })

  it('opens the entrance floor or ground floor for older maps and preserves the chosen floor after refresh', async () => {
    for (const hasFlow of [false, true]) {
      const map: DungeonMapData = {
        ...dungeonDetailFixture.map as DungeonMapData,
        mapType: 'BUILDING', floorCount: 3,
        floorLabels: ['Basement', 'Ground floor', 'Upper floor'],
        rooms: dungeonDetailFixture.map.rooms.map(room => ({ ...room, floor: 2, isSecret: false })),
        ...(hasFlow ? {
          flow: { style: 'BRANCHING' as const, entryRoomId: 'room-1', objectiveRoomId: 'room-2', exitRoomId: 'room-1', routeRoomIds: ['room-1', 'room-2', 'room-1'] },
        } : {}),
      }
      const detail = { ...dungeonDetailFixture, map, config: { ...dungeonDetailFixture.config, mapType: 'BUILDING', floorCount: 3 } }
      mockGetDungeon.mockResolvedValue(detail)
      mockUpdateDungeon.mockResolvedValue(detail)
      const wrapper = await mountSuspended(DungeonDetailPage, {
        global: { provide: { campaignCanWriteContent: ref(true) }, stubs: { DungeonMapCanvas: true } },
      })
      const floorSelect = wrapper.findAllComponents(USelect).find(item => item.vm.$attrs['aria-label'] === 'Viewing floor')!
      expect(selectProps(floorSelect).modelValue).toBe(hasFlow ? 2 : 1)
      floorSelect.vm.$emit('update:modelValue', 0)
      await flushPromises()
      await wrapper.findAll('button').find(item => item.text() === 'Save settings')!.trigger('click')
      await flushPromises()
      expect(selectProps(floorSelect).modelValue).toBe(0)
      wrapper.unmount()
    }
  })

  it('preserves the flow draft after generation failure and inspects named floors with one discard guard', async () => {
    const map: DungeonMapData = {
      ...dungeonDetailFixture.map as DungeonMapData,
      mapType: 'BUILDING', floorCount: 2,
      floorLabels: ['Basement', 'Ground floor'],
      rooms: [
        { ...dungeonDetailFixture.map.rooms[0]!, floor: 0, label: 'Entry hall' },
        { ...dungeonDetailFixture.map.rooms[1]!, isSecret: false, floor: 0, label: 'Rear exit' },
        { id: 'room-3', roomNumber: 3, x: 2, y: 2, width: 8, height: 8, isSecret: false, floor: 1, label: 'Ritual chamber' },
      ],
      terrain: [
        { id: 'cover-1', kind: 'COVER', label: 'Crates', x: 3, y: 3, width: 1, height: 1, floor: 0, roomId: 'room-1', blocksMovement: true, blocksSight: true },
        { id: 'elevation-1', kind: 'ELEVATION', label: 'Platform', x: 4, y: 3, width: 2, height: 2, floor: 0, roomId: 'room-1', elevationFeet: 5 },
        { id: 'difficult-1', kind: 'DIFFICULT', label: 'Debris', x: 5, y: 5, width: 2, height: 1, floor: 0, roomId: 'room-1' },
        { id: 'hazard-1', kind: 'HAZARD', label: 'Brazier', x: 3, y: 7, width: 1, height: 1, floor: 0, roomId: 'room-1' },
        { id: 'cover-3', kind: 'COVER', label: 'Upper barricade', x: 3, y: 3, width: 1, height: 1, floor: 1, roomId: 'room-3', blocksMovement: true },
      ],
      flow: { style: 'BRANCHING', entryRoomId: 'room-1', objectiveRoomId: 'room-3', exitRoomId: 'room-2', routeRoomIds: ['room-1', 'room-3', 'room-1', 'room-2'] },
    }
    mockGetDungeon.mockResolvedValue({ ...dungeonDetailFixture, map, config: { ...dungeonDetailFixture.config, mapType: 'BUILDING', floorCount: 2, encounterFlow: 'BRANCHING' } })
    const canvasStub = { props: ['map', 'floor', 'selectedRoomId', 'showRoute'], template: '<div />' }
    const wrapper = await mountSuspended(DungeonDetailPage, {
      global: { provide: { campaignCanWriteContent: ref(true) }, stubs: { DungeonMapCanvas: canvasStub } },
    })
    const button = (label: string) => wrapper.findAll('button').find(item => item.text() === label)!
    const canvas = wrapper.findComponent(canvasStub)
    const flowSelect = wrapper.findAllComponents(USelect).find(item => item.vm.$attrs['aria-label'] === 'Encounter flow')!
    const floorSelect = wrapper.findAllComponents(USelect).find(item => item.vm.$attrs['aria-label'] === 'Viewing floor')!
    expect(selectProps(floorSelect).items).toEqual([{ label: 'Basement', value: 0 }, { label: 'Ground floor', value: 1 }])
    expect(wrapper.get('[aria-label="Viewing floor"]').text()).toContain('Basement')
    expect(wrapper.text()).not.toContain('Connectivity')
    expect(wrapper.text()).not.toContain('Min room')
    expect(wrapper.text()).not.toContain('Max room')
    expect(wrapper.text()).not.toContain('Secret room chance')
    flowSelect.vm.$emit('update:modelValue', 'LINEAR')
    await flushPromises()
    mockGenerateDungeon.mockRejectedValueOnce(new Error('Generation failed'))
    await button('Generate').trigger('click')
    await flushPromises()
    await clickButton(wrapper, 'Generate map')
    await flushPromises()
    expect(mockGenerateDungeon).toHaveBeenLastCalledWith('campaign-1', 'dungeon-1', expect.objectContaining({ config: expect.objectContaining({ encounterFlow: 'LINEAR' }) }))
    expect(wrapper.get('[aria-label="Encounter flow"]').text()).toContain('Direct route')
    await clickButton(wrapper, 'Cancel')

    await wrapper.get('[aria-label="Inspect entrance: Entry Hall, Basement"]').trigger('click')
    await flushPromises()
    const terrain = () => wrapper.get('[aria-label="Room terrain"]').text()
    for (const detail of ['Crates', 'Blocks movement', 'Blocks sight', 'Platform', '+5 ft', 'Debris', 'Extra movement cost', 'Brazier', 'Environmental hazard']) {
      expect(terrain()).toContain(detail)
    }
    expect(terrain()).not.toContain('Upper barricade')
    const notesLabel = wrapper.findAll('label').find(item => item.text() === 'GM notes')!
    const notes = wrapper.get(`textarea[id="${notesLabel.attributes('for')}"]`)
    await notes.setValue('Entrance notes in progress')
    await wrapper.get('[aria-label="Inspect objective: Ritual chamber, Ground floor"]').trigger('click')
    await flushPromises()
    expect(discardDecision.confirm).toHaveBeenCalledOnce()
    expect(canvas.props('floor')).toBe(0)
    expect(canvas.props('selectedRoomId')).toBe('room-1')
    expect((notes.element as HTMLTextAreaElement).value).toBe('Entrance notes in progress')
    expect(terrain()).toContain('Crates')
    discardDecision.confirm.mockResolvedValueOnce(true)
    await wrapper.get('[aria-label="Inspect objective: Ritual chamber, Ground floor"]').trigger('click')
    await flushPromises()
    expect(discardDecision.confirm).toHaveBeenCalledTimes(2)
    expect(canvas.props('floor')).toBe(1)
    expect(canvas.props('selectedRoomId')).toBe('room-3')
    expect(wrapper.get('[aria-label="Viewing floor"]').text()).toContain('Ground floor')
    expect(terrain()).toContain('Upper barricade')
    for (const detail of ['Crates', 'Platform', 'Debris', 'Brazier']) expect(terrain()).not.toContain(detail)

    const routeLabel = wrapper.findAll('label').find(item => item.text() === 'Show route')!
    await wrapper.get(`button[id="${routeLabel.attributes('for')}"]`).trigger('click')
    expect(canvas.props('showRoute')).toBe(true)
    const playerLabel = wrapper.findAll('label').find(item => item.text() === 'Player-safe map mode')!
    await wrapper.get(`button[id="${playerLabel.attributes('for')}"]`).trigger('click')
    expect(canvas.props('showRoute')).toBe(false)
    expect(wrapper.find('[aria-label="Encounter route"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('scopes the canvas, room list, edits, and visual export to the selected floor', async () => {
    const map: DungeonMapData = {
      ...dungeonDetailFixture.map as DungeonMapData,
      mapType: 'BUILDING', floorCount: 2,
      rooms: [
        ...dungeonDetailFixture.map.rooms.map(room => ({ ...room, floor: 0, label: `Ground room ${room.roomNumber}` })),
        { id: 'room-3', roomNumber: 3, x: 2, y: 2, width: 8, height: 8, isSecret: false, floor: 1, label: 'Upper landing' },
      ],
    }
    mockGetDungeon.mockResolvedValue({ ...dungeonDetailFixture, map, config: { ...dungeonDetailFixture.config, mapType: 'BUILDING', floorCount: 2 } })
    mockListRooms.mockResolvedValue([
      { id: 'room-row-3', dungeonId: 'dungeon-1', roomNumber: 3, name: 'Upper landing', description: null, gmNotes: null, playerNotes: null, readAloud: null, state: 'UNSEEN', tags: [], bounds: null },
    ])
    const canvasStub = { props: ['map', 'floor', 'selectedRoomId'], template: '<div />' }
    const wrapper = await mountSuspended(DungeonDetailPage, {
      global: { provide: { campaignCanWriteContent: ref(true) }, stubs: { DungeonMapCanvas: canvasStub } },
    })
    const button = (label: string) => wrapper.findAll('button').find(item => item.text() === label)!
    const canvas = wrapper.findComponent(canvasStub)
    const floorSelect = wrapper.findAllComponents(USelect).find(item => item.vm.$attrs['aria-label'] === 'Viewing floor')!
    expect(selectProps(floorSelect).items).toEqual([{ label: 'Floor 1', value: 0 }, { label: 'Floor 2', value: 1 }])
    expect(canvas.props('floor')).toBe(0)
    expect(wrapper.text()).toContain('Ground room 1')
    expect(wrapper.text()).not.toContain('Upper landing')
    floorSelect.vm.$emit('update:modelValue', 1)
    await flushPromises()
    expect(canvas.props('floor')).toBe(1)
    expect(wrapper.text()).toContain('Upper landing')
    expect(wrapper.text()).not.toContain('Ground room 1')
    expect(button('Toggle door lock').attributes('disabled')).toBeDefined()
    await button('Add room').trigger('click')
    await flushPromises()
    expect(mockPatchMap).toHaveBeenLastCalledWith('campaign-1', 'dungeon-1', {
      actions: [expect.objectContaining({ type: 'ADD_ROOM', floor: 1 })],
    })
    const format = wrapper.findAllComponents(USelect).find(item => item.vm.$attrs['aria-label'] === 'Export format')!
    format.vm.$emit('update:modelValue', 'SVG')
    await flushPromises()
    await button('Export map').trigger('click')
    await flushPromises()
    expect(mockExportDungeon).toHaveBeenLastCalledWith('campaign-1', 'dungeon-1', expect.objectContaining({ format: 'SVG', floor: 1 }))
    format.vm.$emit('update:modelValue', 'JSON')
    await flushPromises()
    await button('Export map').trigger('click')
    await flushPromises()
    expect(mockExportDungeon).toHaveBeenLastCalledWith('campaign-1', 'dungeon-1', expect.objectContaining({ format: 'JSON', floor: undefined }))

    await button('Upper landing • 8 × 8').trigger('click')
    await flushPromises()
    const notesLabel = wrapper.findAll('label').find(item => item.text() === 'GM notes')!
    const notes = wrapper.get(`textarea[id="${notesLabel.attributes('for')}"]`)
    await notes.setValue('Keep these unsaved notes')
    floorSelect.vm.$emit('update:modelValue', 0)
    await flushPromises()
    expect(discardDecision.confirm).toHaveBeenCalledOnce()
    expect(canvas.props('floor')).toBe(1)
    expect((notes.element as HTMLTextAreaElement).value).toBe('Keep these unsaved notes')
    discardDecision.confirm.mockResolvedValueOnce(true)
    floorSelect.vm.$emit('update:modelValue', 0)
    await flushPromises()
    expect(canvas.props('floor')).toBe(0)
    expect(canvas.props('selectedRoomId')).toBeNull()
    const widthLabel = wrapper.findAll('label').find(item => item.text() === 'Width')!
    await wrapper.get(`input[id="${widthLabel.attributes('for')}"]`).setValue('')
    wrapper.findAllComponents(USelect).find(item => item.vm.$attrs['aria-label'] === 'Map type')!.vm.$emit('update:modelValue', 'FOREST')
    await flushPromises()
    expect(wrapper.find('[aria-label="Floor count"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('Ambient cover density')
    wrapper.unmount()
  })

  it('confirms destructive map changes, preserves failure for retry, and blocks overlapping mutations', async () => {
    let rejectGeneration!: (reason: Error) => void
    mockGenerateDungeon.mockReturnValueOnce(new Promise((_, reject) => { rejectGeneration = reject }))
    mockListSnapshots.mockResolvedValue([{ id: 'snapshot-1', snapshotType: 'MANUAL', createdAt: new Date().toISOString() }])
    const wrapper = await mountSuspended(DungeonDetailPage, {
      global: {
        provide: { campaignCanWriteContent: ref(true) },
        stubs: {
          DungeonMapCanvas: true,
          UDropdownMenu: {
            props: ['items'],
            template: '<div><slot /><button v-for="item in items.flat()" :key="item.label" @click="item.onSelect()">{{ item.label }}</button></div>',
          },
        },
      },
    })
    const button = (label: string) => wrapper.findAll('button').find(item => item.text() === label)!
    await clickButton(wrapper, 'Room 1 • 8 × 8')
    const notesLabel = wrapper.findAll('label').find(item => item.text() === 'GM notes')!
    const notes = wrapper.get(`textarea[id="${notesLabel.attributes('for')}"]`)
    await notes.setValue('Unsaved room notes')
    await clickButton(wrapper, 'Generate')
    expect(discardDecision.confirm).toHaveBeenCalledOnce()
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
    expect(mockGenerateDungeon).not.toHaveBeenCalled()
    discardDecision.confirm.mockResolvedValueOnce(true)
    await clickButton(wrapper, 'Generate')
    expect(mockGenerateDungeon).not.toHaveBeenCalled()
    const consequences = wrapper.get('[role="dialog"]').text()
    for (const phrase of ['notes', 'tags', 'explored states', 'whole-map links', 'do not restore saved room details']) {
      expect(consequences).toContain(phrase)
    }
    await clickButton(wrapper, 'Cancel')
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
    expect(mockGenerateDungeon).not.toHaveBeenCalled()
    expect((notes.element as HTMLTextAreaElement).value).toBe('Unsaved room notes')
    await notes.setValue('')
    await clickButton(wrapper, 'Generate')
    await clickButton(wrapper, 'Generate map')
    await button('Generate map').trigger('click')
    expect(mockGenerateDungeon).toHaveBeenCalledTimes(1)
    expect(button('Cancel').attributes('disabled')).toBeDefined()
    expect(button('Publish').attributes('disabled')).toBeDefined()
    await button('Publish').trigger('click')
    expect(mockPublishDungeon).not.toHaveBeenCalled()
    rejectGeneration(new Error('Generation failed'))
    await flushPromises()
    expect(wrapper.get('[role="dialog"] [role="alert"]').text()).toBe('Generation failed')
    expect(button('Cancel').attributes('disabled')).toBeUndefined()
    await clickButton(wrapper, 'Generate map')
    expect(mockGenerateDungeon).toHaveBeenCalledTimes(2)
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
    expect(button('Publish').attributes('disabled')).toBeUndefined()
    await clickButton(wrapper, 'Publish')
    expect(mockPublishDungeon).toHaveBeenCalledTimes(1)
    expect(wrapper.text()).not.toContain('Generation failed')

    for (const label of ['Regenerate full', 'Regenerate layout']) {
      await clickButton(wrapper, label)
      expect(mockRegenerateDungeon).not.toHaveBeenCalled()
      await clickButton(wrapper, 'Cancel')
      expect(mockRegenerateDungeon).not.toHaveBeenCalled()
    }
    await clickButton(wrapper, 'Regenerate layout')
    await clickButton(wrapper, 'Regenerate map')
    expect(mockRegenerateDungeon).toHaveBeenCalledWith('campaign-1', 'dungeon-1', expect.objectContaining({ scope: 'LAYOUT' }))
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)

    await clickButton(wrapper, 'Restore')
    expect(mockRestoreSnapshot).not.toHaveBeenCalled()
    await clickButton(wrapper, 'Cancel')
    expect(mockRestoreSnapshot).not.toHaveBeenCalled()
    mockRestoreSnapshot.mockRejectedValueOnce(new Error('Restore failed'))
    await clickButton(wrapper, 'Restore')
    await clickButton(wrapper, 'Restore snapshot')
    expect(wrapper.get('[role="dialog"] [role="alert"]').text()).toBe('Restore failed')
    await clickButton(wrapper, 'Restore snapshot')
    expect(mockRestoreSnapshot).toHaveBeenCalledTimes(2)
    expect(mockRestoreSnapshot).toHaveBeenLastCalledWith('campaign-1', 'dungeon-1', 'snapshot-1')
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
    wrapper.unmount()
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
    wrapper.unmount()
  })

  it('hides secret rooms and their contents in preview and restores the full map when disabled', async () => {
    const map: DungeonMapData = {
      ...dungeonDetailFixture.map as DungeonMapData,
      traps: ['room-1', 'room-2'].map(roomId => ({
        id: `trap-${roomId}`, roomId, name: 'Pit', severity: 'LOW', trigger: 'Step', effect: 'Fall',
        detectDc: 10, disarmDc: 10, isLocked: false,
      })),
    }
    mockGetDungeon.mockResolvedValue({ ...dungeonDetailFixture, map })
    const canvasStub = { props: ['map'], template: '<div />' }
    const wrapper = await mountSuspended(DungeonDetailPage, {
      global: {
        provide: { campaignCanWriteContent: ref(true) },
        stubs: { DungeonMapCanvas: canvasStub },
      },
    })
    const canvas = wrapper.findComponent(canvasStub)
    const playerModeLabel = wrapper.findAll('label').find(label => label.text() === 'Player-safe map mode')!
    const playerMode = wrapper.get(`button[id="${playerModeLabel.attributes('for')}"]`)

    expect(canvas.props('map')).toEqual(map)
    await playerMode.trigger('click')
    expect(canvas.props('map').rooms.map((room: { id: string }) => room.id)).toEqual(['room-1'])
    expect(canvas.props('map').traps.map((trap: { id: string }) => trap.id)).toEqual(['trap-room-1'])
    await playerMode.trigger('click')
    expect(canvas.props('map')).toEqual(map)
    expect(mockPatchMap).not.toHaveBeenCalled()
    wrapper.unmount()
  })
})

describe('Dungeon map keyboard controls', () => {
  it('names zoom controls and supports keyboard zoom, pan, and fit', async () => {
    const wrapper = await mountSuspended(MapCanvas, {
      props: { map: { ...dungeonDetailFixture.map as DungeonMapData, floorLabels: ['Basement'] } },
    })
    expect(wrapper.get('svg[role="img"]').attributes('aria-label')).toBe('Dungeon map, Basement')
    expect(wrapper.find('button[aria-label="Zoom in"]').exists()).toBe(true)
    expect(wrapper.find('button[aria-label="Zoom out"]').exists()).toBe(true)
    expect(wrapper.find('[aria-label="Select dungeon room"]').exists()).toBe(true)
    const map = wrapper.get('[aria-label="Dungeon map controls"]')
    expect(map.attributes('tabindex')).toBe('0')
    const transform = () => wrapper.get('svg > g').attributes('transform')
    const initial = transform()
    await map.trigger('keydown', { key: '+' })
    expect(transform()).not.toBe(initial)
    const zoomed = transform()
    await map.trigger('keydown', { key: 'ArrowRight' })
    expect(transform()).not.toBe(zoomed)
    await map.trigger('keydown', { key: 'Home' })
    expect(transform()).toBe(initial)
    await wrapper.setProps({ map: dungeonDetailFixture.map as DungeonMapData })
    expect(wrapper.get('svg[role="img"]').attributes('aria-label')).toBe('Dungeon map, floor 1')
    wrapper.unmount()
  })
})
