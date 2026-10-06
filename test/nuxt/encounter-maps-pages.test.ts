import { config, flushPromises, type VueWrapper } from '@vue/test-utils'
import { actionMenuStub } from '../helpers/action-menu'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { EncounterMapData } from '../../shared/types/encounter-map'
import { encounterMapGeneratorConfigSchema } from '../../shared/schemas/encounter-map'
import { ref } from 'vue'
import { mountSuspended, mockNuxtImport } from '@nuxt/test-utils/runtime'
import { USelect, USelectMenu, UTabs } from '#components'
import EncounterMapsPage from '../../app/pages/campaigns/[campaignId]/encounter-maps/index.vue'
import EncounterMapDetailPage from '../../app/pages/campaigns/[campaignId]/encounter-maps/[encounterMapId].vue'
import DashboardLayout from '../../app/layouts/dashboard.vue'

const api = vi.hoisted(() => ({
  listEncounterMaps: vi.fn(), createEncounterMap: vi.fn(), importEncounterMap: vi.fn(), deleteEncounterMap: vi.fn(),
  getEncounterMap: vi.fn(), updateEncounterMap: vi.fn(), regenerateEncounterMap: vi.fn(), patchMap: vi.fn(),
  listRooms: vi.fn(), updateRoom: vi.fn(), listLinks: vi.fn(), createLink: vi.fn(), deleteLink: vi.fn(),
  listSnapshots: vi.fn(), createSnapshot: vi.fn(), updateSnapshot: vi.fn(), restoreSnapshot: vi.fn(),
  exportEncounterMap: vi.fn(), publishEncounterMap: vi.fn(), unpublishEncounterMap: vi.fn(), createEncounterFromRoom: vi.fn(),
}))
const toastAdd = vi.hoisted(() => vi.fn())
const discardDecision = vi.hoisted(() => ({ confirm: vi.fn(async () => false) }))

mockNuxtImport('useRoute', () => () => ({
  path: '/campaigns/campaign-1/encounter-maps/dungeon-1',
  params: { campaignId: 'campaign-1', encounterMapId: 'dungeon-1' },
}))
mockNuxtImport('useApi', () => () => ({
  request: async (url: string) => {
    const resource = url.split('/').at(-1) ?? ''
    if (resource === 'quests') return [{ id: 'quest-1', title: 'Find the relic' }]
    return ['sessions', 'milestones', 'glossary', 'encounters'].includes(resource) ? [] : { id: 'campaign-1', name: 'Test campaign' }
  },
}))
mockNuxtImport('navigateTo', () => async () => undefined)
mockNuxtImport('useToast', () => () => ({ add: toastAdd }))
mockNuxtImport('useOverlay', () => () => ({
  create: () => ({ open: () => ({ result: discardDecision.confirm() }), close: () => {} }),
}))
vi.mock('~/composables/useEncounterMaps', () => ({ useEncounterMaps: () => api }))

const map: EncounterMapData = {
  schemaVersion: 1,
  gridType: 'SQUARE',
  width: 60,
  height: 60,
  cellSize: 32,
  rooms: [
    { id: 'room-1', roomNumber: 1, x: 2, y: 2, width: 8, height: 8, isSecret: false },
    { id: 'room-2', roomNumber: 2, x: 20, y: 20, width: 10, height: 10, isSecret: true },
  ],
  corridors: [{ id: 'corridor-1', fromRoomId: 'room-1', toRoomId: 'room-2', points: [{ x: 6, y: 6 }, { x: 25, y: 6 }, { x: 25, y: 25 }] }],
  doors: [{ id: 'door-1', x: 6, y: 6, corridorId: 'corridor-1', isLocked: false, isSecret: false, isSpecial: false }],
  walls: [],
  traps: [],
  encounters: [],
  treasures: [],
  dressing: [],
  zones: [],
  metadata: { algorithmVersion: '1.0.0', configHash: 'abc123', generatedAt: new Date().toISOString(), seed: 'seed-x', passHistory: [] },
}
const storedConfig = encounterMapGeneratorConfigSchema.parse({
  gridType: 'SQUARE', width: 60, height: 60, cellSize: 32, theme: 'crypt',
  layout: { roomDensity: 0.25, minRoomSize: 4, maxRoomSize: 10, corridorStyle: 'MIXED', connectivityStrictness: 0.7, secretRoomChance: 0.1 },
  doors: { doorFrequency: 0.65, lockedDoorChance: 0.2, secretDoorChance: 0.08, specialDoorChance: 0.05 },
  content: { trapDensity: 0.15, encounterDensity: 0.3, treasureDensity: 0.2, dressingDensity: 0.35 },
})
const detail = {
  id: 'dungeon-1', campaignId: 'campaign-1', name: 'Sunken Crypt', status: 'DRAFT', theme: 'crypt', seed: 'seed-x',
  gridType: 'SQUARE', generatorVersion: '1.0.0', roomCount: 2, canDelete: true,
  createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  config: storedConfig, map, playerView: null,
}
const roomRecord = (roomNumber: number, name = `Room ${roomNumber}`, extra = {}) => ({
  id: `room-row-${roomNumber}`, dungeonId: 'dungeon-1', roomNumber, name, description: null, gmNotes: null, playerNotes: null,
  readAloud: null, tags: [], bounds: null, state: 'UNSEEN', createdAt: '', updatedAt: '', ...extra,
})
const advancedOptions = {
  encounterScale: 'COMPLEX',
  accessPoints: { entrances: 3, exits: 2, entranceSide: 'WEST', concealedEntrance: true },
  tacticalTerrain: { cover: 'HEAVY', elevation: true, difficultTerrain: true, hazards: true, sightlines: 'BROKEN' },
  verticalConnections: { basement: true, staircases: 'DUAL', ladders: true, balconies: true, bridges: true },
} satisfies Pick<EncounterMapGeneratorConfig, 'encounterScale' | 'accessPoints' | 'tacticalTerrain' | 'verticalConnections'>

config.global.stubs.SharedActionMenu = actionMenuStub
config.global.stubs.UTooltip = { template: '<span><slot /></span>' }
config.global.stubs.UModal = {
  props: ['open', 'title', 'description'],
  template: '<section v-if="open" role="dialog"><h2>{{ title }}</h2><p>{{ description }}</p><slot name="body" /><slot name="footer" /></section>',
}
const canvasStub = {
  props: ['map', 'floor', 'selectedRoomId', 'selectedMarker', 'showRoute', 'showLabels', 'showGrid'],
  emits: ['update:selectedRoomId', 'update:selectedMarker'],
  template: '<div data-test="map-canvas"><slot name="toolbar" /></div>',
}
const detailStubs = {
  EncounterMapCanvas: canvasStub,
  UDropdownMenu: {
    props: ['items'],
    template: `<div><slot /><template v-for="item in items.flat()" :key="item.label">
      <button v-if="item.label && item.type !== 'label'" :disabled="item.disabled" @click="item.type === 'checkbox' ? item.onUpdateChecked(!item.checked) : item.onSelect?.()">{{ item.label }}</button>
    </template></div>`,
  },
  UPopover: { template: '<div><slot /><slot name="content" :close="() => {}" /></div>' },
  UCollapsible: { template: '<div><slot /><slot name="content" /></div>' },
}

const mountDetail = async (canWrite = true) => mountSuspended(EncounterMapDetailPage, {
  global: { provide: { campaignCanWriteContent: ref(canWrite) }, stubs: detailStubs },
})
const button = (wrapper: VueWrapper, label: string) => {
  const found = wrapper.findAll('button').find(item => item.text() === label)
  expect(found, `Expected visible ${label} button`).toBeDefined()
  return found!
}
const click = async (wrapper: VueWrapper, label: string) => {
  await button(wrapper, label).trigger('click')
  await flushPromises()
}
// Detached test DOMs do not turn submit-button clicks into form submissions.
const submit = async (wrapper: VueWrapper, label: string) => {
  button(wrapper, label).element.closest('form')!.dispatchEvent(new Event('submit', { cancelable: true }))
  await flushPromises()
}
const select = (wrapper: VueWrapper, label: string) =>
  wrapper.findAllComponents(USelect).find(item => item.vm.$attrs['aria-label'] === label)!
const choose = async (wrapper: VueWrapper, label: string, value: unknown) => {
  select(wrapper, label).vm.$emit('update:modelValue', value)
  await flushPromises()
}
const selected = (wrapper: VueWrapper, label: string) => (select(wrapper, label).props() as { modelValue: unknown }).modelValue
type TabsProps = { items: Array<{ label?: string; value: unknown }>; modelValue: unknown }
const tabsProps = (tabs: VueWrapper) => tabs.props() as TabsProps
const tabsWith = (wrapper: VueWrapper, value: string) =>
  wrapper.findAllComponents(UTabs).find(tabs => tabsProps(tabs).items.some(item => item.value === value))!
const openTab = async (wrapper: VueWrapper, value: string) => {
  tabsWith(wrapper, 'generator')
    .vm.$emit('update:modelValue', value)
  await flushPromises()
}
const floorTabs = (wrapper: VueWrapper) => wrapper.findAllComponents(UTabs).find(tabs => tabs.vm.$attrs['aria-label'] === 'Viewing floor')!
const toggle = async (wrapper: VueWrapper, label: string) => {
  const controlLabel = wrapper.findAll('label').find(item => item.text() === label)!
  await wrapper.get(`button[id="${controlLabel.attributes('for')}"]`).trigger('click')
  await flushPromises()
}
const textarea = (wrapper: VueWrapper, label: string) => {
  const fieldLabel = wrapper.findAll('label').find(item => item.text() === label)!
  return wrapper.get(`textarea[id="${fieldLabel.attributes('for')}"]`)
}

describe('Encounter map pages', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    discardDecision.confirm.mockResolvedValue(false)
    api.listEncounterMaps.mockResolvedValue([{ ...detail, config: undefined, map: undefined }])
    api.getEncounterMap.mockResolvedValue(detail)
    api.updateEncounterMap.mockResolvedValue(detail)
    api.regenerateEncounterMap.mockResolvedValue({ ...detail, previousSnapshotId: 'snapshot-before' })
    api.patchMap.mockResolvedValue(map)
    api.listRooms.mockResolvedValue([roomRecord(1), roomRecord(2)])
    api.updateRoom.mockResolvedValue({})
    api.listLinks.mockResolvedValue([])
    api.createLink.mockResolvedValue({})
    api.deleteLink.mockResolvedValue({})
    api.listSnapshots.mockResolvedValue([])
    api.createSnapshot.mockResolvedValue({})
    api.updateSnapshot.mockResolvedValue({})
    api.restoreSnapshot.mockResolvedValue({ restored: true, roomsReset: false })
    api.exportEncounterMap.mockResolvedValue({ format: 'SVG', filename: 'map.svg', contentType: 'image/svg+xml', content: '<svg />', encoding: 'utf8' })
    api.publishEncounterMap.mockResolvedValue({ ...detail, status: 'READY' })
    api.unpublishEncounterMap.mockResolvedValue(detail)
    api.createEncounterFromRoom.mockResolvedValue({ encounterId: 'encounter-1' })
    api.importEncounterMap.mockResolvedValue({ id: 'imported-dungeon-1' })
    api.createEncounterMap.mockResolvedValue({ id: 'generated-map-1' })
    api.deleteEncounterMap.mockResolvedValue({ deleted: true })
  })

  it('lists maps and keeps them reachable in the campaign sidebar', async () => {
    const list = await mountSuspended(EncounterMapsPage, { global: { provide: { campaignCanWriteContent: ref(true) } } })
    expect(list.text()).toContain('Sunken Crypt')
    expect(list.text()).toContain('Encounter maps')
    list.unmount()
    const layout = await mountSuspended(DashboardLayout, {
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
    expect(layout.findAll('aside a').find(link => link.text() === 'Encounter maps')?.attributes('href')).toBe('/campaigns/campaign-1/encounter-maps')
    layout.unmount()
  })

  it('creates maps with every shared generator option, a custom canvas, and preserved drafts after failure', async () => {
    const wrapper = await mountSuspended(EncounterMapsPage, {
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
    await click(wrapper, 'New map')
    await wrapper.get('input[placeholder="Ancient catacombs"]').setValue('Three-floor manor')
    expect(selected(wrapper, 'Encounter scale')).toBe('SEQUENCE')
    await choose(wrapper, 'Map type', 'BUILDING')
    expect((wrapper.get('input[placeholder="ruins, manor, woodland…"]').element as HTMLInputElement).value).toBe('manor')
    await choose(wrapper, 'Map size', 30)
    await choose(wrapper, 'Floor count', 3)
    await choose(wrapper, 'Encounter scale', 'COMPLEX')
    await choose(wrapper, 'Encounter flow', 'LOOP')
    for (const label of ['Access points', 'Tactical terrain', 'Vertical connections']) {
      expect(button(wrapper, label).attributes('aria-expanded')).toBe('false')
      await click(wrapper, label)
    }
    for (const [label, value] of [['Entrances', 3], ['Exits', 2], ['Main entrance side', 'WEST'], ['Cover', 'HEAVY'], ['Sightlines', 'BROKEN'], ['Staircases', 'DUAL']] as const) {
      await choose(wrapper, label, value)
    }
    for (const label of ['Concealed entrance', 'Elevated positions', 'Difficult terrain', 'Environmental hazards', 'Basement', 'Ladders', 'Balconies', 'Bridges']) {
      await toggle(wrapper, label)
    }
    api.createEncounterMap.mockRejectedValueOnce(new Error('Generation failed'))
    await click(wrapper, 'Generate map')
    expect((wrapper.get('input[placeholder="Ancient catacombs"]').element as HTMLInputElement).value).toBe('Three-floor manor')
    expect(selected(wrapper, 'Encounter flow')).toBe('LOOP')
    await click(wrapper, 'Generate map')
    expect(api.createEncounterMap).toHaveBeenLastCalledWith('campaign-1', expect.objectContaining({
      name: 'Three-floor manor',
      theme: 'manor',
      config: expect.objectContaining({ mapType: 'BUILDING', floorCount: 3, width: 30, height: 30, encounterFlow: 'LOOP', ...advancedOptions }),
    }))

    await click(wrapper, 'New map')
    await wrapper.get('input[placeholder="Ancient catacombs"]').setValue('Forest ambush')
    await choose(wrapper, 'Map type', 'BUILDING')
    await choose(wrapper, 'Floor count', 4)
    await click(wrapper, 'Vertical connections')
    for (const label of ['Basement', 'Ladders', 'Bridges']) await toggle(wrapper, label)
    await wrapper.get('input[placeholder="ruins, manor, woodland…"]').setValue('haunted grove')
    await choose(wrapper, 'Map type', 'FOREST')
    expect(wrapper.find('[aria-label="Floor count"]').exists()).toBe(false)
    expect((wrapper.get('input[placeholder="ruins, manor, woodland…"]').element as HTMLInputElement).value).toBe('haunted grove')
    await choose(wrapper, 'Map size', 0)
    const widthLabel = wrapper.findAll('label').find(item => item.text() === 'Width')!
    await wrapper.get(`input[id="${widthLabel.attributes('for')}"]`).setValue('90')
    await wrapper.get(`input[id="${widthLabel.attributes('for')}"]`).trigger('blur')
    await flushPromises()
    await click(wrapper, 'Generate map')
    expect(api.createEncounterMap).toHaveBeenLastCalledWith('campaign-1', expect.objectContaining({
      theme: 'haunted grove',
      config: expect.objectContaining({
        mapType: 'FOREST', floorCount: 1, width: 90, height: 40, encounterScale: 'SEQUENCE',
        verticalConnections: { basement: false, staircases: 'SINGLE', ladders: false, balconies: false, bridges: true },
      }),
    }))
    wrapper.unmount()
  })

  it('validates seeds with the shared creation schema and keeps the draft open after failure', async () => {
    const wrapper = await mountSuspended(EncounterMapsPage, {
      attachTo: document.body,
      global: { provide: { campaignCanWriteContent: ref(true) } },
    })
    await click(wrapper, 'New map')
    await wrapper.get('input[placeholder="Ancient catacombs"]').setValue('Seeded map')
    const seed = wrapper.get('input[placeholder="Blank for a random map"]')
    await seed.setValue('x'.repeat(81))
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(api.createEncounterMap).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('<=80 characters')
    expect(document.activeElement).toBe(seed.element)
    await wrapper.get('button[aria-label="Random seed"]').trigger('click')
    expect((seed.element as HTMLInputElement).value).toMatch(/^map-[a-z0-9]+$/)
    for (const [input, expected] of [[' a ', 'a'], ['   ', undefined]] as const) {
      await seed.setValue(input)
      api.createEncounterMap.mockRejectedValueOnce(new Error('Keep the draft'))
      await wrapper.get('form').trigger('submit')
      await flushPromises()
      expect(api.createEncounterMap).toHaveBeenLastCalledWith('campaign-1', expect.objectContaining({ seed: expected }))
      expect(wrapper.text()).toContain('Keep the draft')
      expect((wrapper.get('input[placeholder="Ancient catacombs"]').element as HTMLInputElement).value).toBe('Seeded map')
    }
    wrapper.unmount()
  })

  it('round-trips stored settings, saves or discards the draft, and generates with undo and reroll', async () => {
    const buildingConfig = { ...storedConfig, mapType: 'BUILDING', floorCount: 3, encounterFlow: 'LOOP', ...structuredClone(advancedOptions) }
    const buildingMap: EncounterMapData = {
      ...map, mapType: 'BUILDING', floorCount: 3, floorLabels: ['Basement', 'Ground floor', 'Upper floor'],
      rooms: map.rooms.map(room => ({ ...room, isSecret: false, floor: 1 })),
    }
    // The server stores what each save or generation sent.
    let stored: Record<string, any> = { ...detail, map: buildingMap, config: buildingConfig }
    api.getEncounterMap.mockImplementation(async () => stored)
    api.updateEncounterMap.mockImplementation(async (_campaign: string, _dungeon: string, input: Record<string, unknown>) => (stored = { ...stored, ...input }))
    api.regenerateEncounterMap.mockImplementation(async (_campaign: string, _dungeon: string, input: { seed?: string; config?: unknown }) => {
      stored = { ...stored, seed: input.seed ?? stored.seed, config: input.config ?? stored.config }
      return { ...stored, previousSnapshotId: 'snapshot-before' }
    })
    const wrapper = await mountDetail()
    expect(tabsProps(floorTabs(wrapper)).modelValue).toBe(1)
    expect(selected(wrapper, 'Encounter flow')).toBe('LOOP')
    for (const label of ['Access points', 'Tactical terrain', 'Vertical connections']) await click(wrapper, label)
    for (const [label, value] of [['Entrances', 3], ['Exits', 2], ['Main entrance side', 'WEST'], ['Cover', 'HEAVY'], ['Sightlines', 'BROKEN'], ['Staircases', 'DUAL']] as const) {
      expect(selected(wrapper, label)).toBe(value)
    }
    expect(wrapper.text()).not.toContain('Unsaved settings')

    await choose(wrapper, 'Encounter scale', 'SINGLE')
    expect(wrapper.text()).toContain('Unsaved settings')
    await click(wrapper, 'Discard')
    expect(selected(wrapper, 'Encounter scale')).toBe('COMPLEX')
    await choose(wrapper, 'Encounter scale', 'SINGLE')
    await submit(wrapper, 'Save settings')
    expect(api.updateEncounterMap).toHaveBeenLastCalledWith('campaign-1', 'dungeon-1', expect.objectContaining({
      theme: 'crypt', config: expect.objectContaining({ ...buildingConfig, encounterScale: 'SINGLE' }),
    }))

    await choose(wrapper, 'Cover', 'LIGHT')
    api.regenerateEncounterMap.mockRejectedValueOnce(new Error('Regeneration failed'))
    await click(wrapper, 'Generate')
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
    expect(api.regenerateEncounterMap).toHaveBeenLastCalledWith('campaign-1', 'dungeon-1', expect.objectContaining({
      scope: 'FULL', preserveLocks: true, seed: 'seed-x', config: expect.objectContaining({ tacticalTerrain: expect.objectContaining({ cover: 'LIGHT' }) }),
    }))
    expect(toastAdd).toHaveBeenLastCalledWith(expect.objectContaining({ title: 'Unable to generate the map', description: 'Regeneration failed' }))
    expect(selected(wrapper, 'Cover')).toBe('LIGHT')

    await click(wrapper, 'Generate')
    const undoToast = toastAdd.mock.calls.at(-1)![0]
    expect(undoToast.title).toBe('Map generated')
    await undoToast.actions[0].onClick()
    await flushPromises()
    expect(api.restoreSnapshot).toHaveBeenLastCalledWith('campaign-1', 'dungeon-1', 'snapshot-before')

    await click(wrapper, 'Reroll')
    const rerollSeed = api.regenerateEncounterMap.mock.calls.at(-1)![2].seed
    expect(rerollSeed).toMatch(/^map-[a-z0-9]+$/)
    expect((wrapper.get(`input[id="${wrapper.findAll('label').find(item => item.text() === 'Seed')!.attributes('for')}"]`).element as HTMLInputElement).value).toBe(rerollSeed)

    await click(wrapper, 'Regenerate traps')
    expect(api.regenerateEncounterMap).toHaveBeenLastCalledWith('campaign-1', 'dungeon-1', { scope: 'TRAPS', preserveLocks: true, seed: rerollSeed })
    expect(toastAdd.mock.calls.at(-1)![0].title).toBe('Traps regenerated')

    await choose(wrapper, 'Floor count', 2)
    expect(wrapper.findAll('label').some(item => item.text() === 'Balconies')).toBe(false)
    await click(wrapper, 'Generate')
    expect(api.regenerateEncounterMap).toHaveBeenLastCalledWith('campaign-1', 'dungeon-1', expect.objectContaining({
      config: expect.objectContaining({ floorCount: 2, verticalConnections: { ...advancedOptions.verticalConnections, balconies: false } }),
    }))
    wrapper.unmount()
  })

  it('confirms rebuilds only when saved room details would be lost and blocks overlapping mutations', async () => {
    api.listRooms.mockResolvedValue([roomRecord(1, 'Entry Hall'), roomRecord(2)])
    api.listSnapshots.mockResolvedValue([{ id: 'snapshot-1', snapshotType: 'MANUAL', label: 'Before the party', seed: 'old', mapType: 'DUNGEON', roomCount: 2, floorCount: 1, map, createdAt: new Date().toISOString() }])
    let rejectGeneration!: (reason: Error) => void
    api.regenerateEncounterMap.mockReturnValueOnce(new Promise((_, reject) => { rejectGeneration = reject }))
    const wrapper = await mountDetail()
    await click(wrapper, 'Generate')
    const consequences = wrapper.get('[role="dialog"]').text()
    for (const phrase of ['notes', 'tags', 'explored states', 'whole-map links', 'do not restore saved room details']) {
      expect(consequences).toContain(phrase)
    }
    await click(wrapper, 'Cancel')
    expect(api.regenerateEncounterMap).not.toHaveBeenCalled()

    await click(wrapper, 'Generate')
    await button(wrapper, 'Generate map').trigger('click')
    expect(api.regenerateEncounterMap).toHaveBeenCalledTimes(1)
    expect(button(wrapper, 'Publish').attributes('disabled')).toBeDefined()
    rejectGeneration(new Error('Generation failed'))
    await flushPromises()
    expect(wrapper.get('[role="dialog"] [role="alert"]').text()).toBe('Generation failed')
    await click(wrapper, 'Generate map')
    expect(api.regenerateEncounterMap).toHaveBeenCalledTimes(2)
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
    await click(wrapper, 'Publish')
    expect(api.publishEncounterMap).toHaveBeenCalledTimes(1)

    await openTab(wrapper, 'history')
    expect(wrapper.text()).toContain('Before the party')
    expect(wrapper.find('img[src^="data:image/svg+xml"]').exists()).toBe(true)
    await click(wrapper, 'Restore')
    await click(wrapper, 'Cancel')
    expect(api.restoreSnapshot).not.toHaveBeenCalled()
    api.restoreSnapshot.mockRejectedValueOnce(new Error('Restore failed'))
    await click(wrapper, 'Restore')
    await click(wrapper, 'Restore snapshot')
    expect(wrapper.get('[role="dialog"] [role="alert"]').text()).toBe('Restore failed')
    await click(wrapper, 'Restore snapshot')
    expect(api.restoreSnapshot).toHaveBeenLastCalledWith('campaign-1', 'dungeon-1', 'snapshot-1')

    await wrapper.get('input[aria-label="Snapshot label"]').setValue('Boss arena')
    await wrapper.get('input[aria-label="Snapshot label"]').element.closest('form')!.dispatchEvent(new Event('submit'))
    await flushPromises()
    expect(api.createSnapshot).toHaveBeenLastCalledWith('campaign-1', 'dungeon-1', { snapshotType: 'MANUAL', label: 'Boss arena' })
    await wrapper.get('button[aria-label="Rename Before the party"]').trigger('click')
    const rename = wrapper.findAll('input[aria-label="Snapshot label"]').at(-1)!
    await rename.setValue('')
    await rename.element.closest('form')!.dispatchEvent(new Event('submit'))
    await flushPromises()
    expect(api.updateSnapshot).toHaveBeenLastCalledWith('campaign-1', 'dungeon-1', 'snapshot-1', { label: null })
    wrapper.unmount()
  })

  it('inspects rooms and markers across floors with one discard guard and edits contents', async () => {
    const floorsMap: EncounterMapData = {
      ...map, mapType: 'BUILDING', floorCount: 2, floorLabels: ['Basement', 'Ground floor'],
      rooms: [
        { ...map.rooms[0]!, floor: 0, label: 'Entry hall' },
        { ...map.rooms[1]!, isSecret: false, floor: 0, label: 'Rear exit' },
        { id: 'room-3', roomNumber: 3, x: 2, y: 2, width: 8, height: 8, isSecret: false, floor: 1, label: 'Ritual chamber' },
      ],
      traps: [{ id: 'trap-1', roomId: 'room-1', name: 'Pit', severity: 'LOW', trigger: 'Step', effect: 'Fall', detectDc: 12, disarmDc: 14, isLocked: false }],
      terrain: [
        { id: 'cover-1', kind: 'COVER', label: 'Crates', x: 3, y: 3, width: 1, height: 1, floor: 0, roomId: 'room-1', blocksMovement: true, blocksSight: true },
        { id: 'elevation-1', kind: 'ELEVATION', label: 'Platform', x: 4, y: 3, width: 2, height: 2, floor: 0, roomId: 'room-1', elevationFeet: 5 },
        { id: 'cover-3', kind: 'COVER', label: 'Upper barricade', x: 3, y: 3, width: 1, height: 1, floor: 1, roomId: 'room-3', blocksMovement: true },
      ],
      flow: { style: 'BRANCHING', entryRoomId: 'room-1', objectiveRoomId: 'room-3', exitRoomId: 'room-2', routeRoomIds: ['room-1', 'room-3', 'room-1', 'room-2'] },
    }
    api.getEncounterMap.mockResolvedValue({ ...detail, map: floorsMap, config: { ...storedConfig, mapType: 'BUILDING', floorCount: 2 } })
    api.listRooms.mockResolvedValue([roomRecord(1, 'Entry hall'), roomRecord(2, 'Rear exit'), roomRecord(3, 'Ritual chamber')])
    const wrapper = await mountDetail()
    const canvas = wrapper.findComponent(canvasStub)
    expect(tabsProps(floorTabs(wrapper)).items).toEqual([{ label: 'Basement', value: 0 }, { label: 'Ground floor', value: 1 }])
    expect(wrapper.text()).not.toContain('Min room')

    await wrapper.get('[aria-label="Inspect entrance: Entry hall, Basement"]').trigger('click')
    await flushPromises()
    for (const text of ['Crates', 'Blocks movement', 'Blocks sight', 'Platform', '+5 ft']) expect(wrapper.get('[aria-label="Room terrain"]').text()).toContain(text)
    await textarea(wrapper, 'GM notes').setValue('Entrance notes in progress')
    await wrapper.get('[aria-label="Inspect objective: Ritual chamber, Ground floor"]').trigger('click')
    await flushPromises()
    expect(discardDecision.confirm).toHaveBeenCalledOnce()
    expect(canvas.props('selectedRoomId')).toBe('room-1')
    expect((textarea(wrapper, 'GM notes').element as HTMLTextAreaElement).value).toBe('Entrance notes in progress')
    await submit(wrapper, 'Save details')
    expect(api.updateRoom).toHaveBeenLastCalledWith('campaign-1', 'dungeon-1', 'room-row-1', expect.objectContaining({ gmNotes: 'Entrance notes in progress' }))
    await wrapper.get('[aria-label="Inspect objective: Ritual chamber, Ground floor"]').trigger('click')
    await flushPromises()
    expect(canvas.props('floor')).toBe(1)
    expect(canvas.props('selectedRoomId')).toBe('room-3')
    expect(wrapper.get('[aria-label="Room terrain"]').text()).toContain('Upper barricade')
    expect(wrapper.get('[aria-label="Room terrain"]').text()).not.toContain('Crates')

    const geometryLabel = wrapper.findAll('label').find(item => item.text() === 'X')!
    await wrapper.get(`input[id="${geometryLabel.attributes('for')}"]`).setValue('4')
    await wrapper.get(`input[id="${geometryLabel.attributes('for')}"]`).trigger('blur')
    await flushPromises()
    await click(wrapper, 'Apply position and size')
    expect(api.patchMap).toHaveBeenLastCalledWith('campaign-1', 'dungeon-1', { actions: [{ type: 'MOVE_ROOM', roomId: 'room-3', x: 4, y: 2 }] })

    floorTabs(wrapper).vm.$emit('update:modelValue', 0)
    await flushPromises()
    expect(canvas.props('floor')).toBe(0)
    expect(canvas.props('selectedRoomId')).toBeNull()
    canvas.vm.$emit('update:selectedMarker', { kind: 'trap', id: 'trap-1' })
    await flushPromises()
    expect(wrapper.text()).toContain('Pit')
    expect(wrapper.text()).toContain('Entry hall · DC 12/14')
    await wrapper.get('button[aria-label="Pin Pit"]').trigger('click')
    await flushPromises()
    expect(api.patchMap).toHaveBeenLastCalledWith('campaign-1', 'dungeon-1', { actions: [{ type: 'TOGGLE_LOCK', entityType: 'TRAP', entityId: 'trap-1' }] })
    tabsWith(wrapper, 'doors')
      .vm.$emit('update:modelValue', 'doors')
    await flushPromises()
    await wrapper.get('button[aria-label="Locked door: Entry hall ↔ Rear exit"]').trigger('click')
    await flushPromises()
    expect(api.patchMap).toHaveBeenLastCalledWith('campaign-1', 'dungeon-1', { actions: [{ type: 'TOGGLE_DOOR_LOCK', doorId: 'door-1' }] })
    tabsWith(wrapper, 'doors')
      .vm.$emit('update:modelValue', 'rooms')
    await flushPromises()
    await submit(wrapper, 'Add to this floor')
    expect(api.patchMap).toHaveBeenLastCalledWith('campaign-1', 'dungeon-1', { actions: [expect.objectContaining({ type: 'ADD_ROOM', floor: 0 })] })

    await click(wrapper, 'Encounter route')
    expect(canvas.props('showRoute')).toBe(true)
    await click(wrapper, 'Player view')
    expect(canvas.props('showRoute')).toBe(false)
    expect(wrapper.find('[aria-label="Encounter route"]').exists()).toBe(false)
    await click(wrapper, 'Labels')
    expect(canvas.props('showLabels')).toBe(false)
    wrapper.unmount()
  })

  it('hides secret rooms in player view, links records by name, and renames, archives, and exports the map', async () => {
    api.getEncounterMap.mockResolvedValue({ ...detail, map: { ...map, traps: ['room-1', 'room-2'].map(roomId => ({ id: `trap-${roomId}`, roomId, name: 'Pit', severity: 'LOW', trigger: 'Step', effect: 'Fall', detectDc: 10, disarmDc: 10, isLocked: false })) } })
    api.listLinks.mockResolvedValue([{ id: 'link-1', dungeonId: 'dungeon-1', roomId: 'room-row-1', linkType: 'QUEST', targetId: 'quest-1', createdAt: '' }])
    URL.createObjectURL = vi.fn(() => 'blob:map')
    URL.revokeObjectURL = vi.fn()
    const wrapper = await mountDetail()
    const canvas = wrapper.findComponent(canvasStub)
    await click(wrapper, 'Player view')
    expect(canvas.props('map').rooms.map((room: { id: string }) => room.id)).toEqual(['room-1'])
    expect(canvas.props('map').traps.map((trap: { id: string }) => trap.id)).toEqual(['trap-room-1'])
    await click(wrapper, 'Player view')
    expect(canvas.props('map').rooms).toHaveLength(2)

    await openTab(wrapper, 'links')
    await vi.waitFor(() => expect(wrapper.text()).toContain('Find the relic'))
    expect(wrapper.text()).toContain('Quest · 1 · Room 1')
    wrapper.findComponent(USelectMenu).vm.$emit('update:modelValue', 'quest-1')
    await flushPromises()
    await submit(wrapper, 'Add link')
    expect(api.createLink).toHaveBeenLastCalledWith('campaign-1', 'dungeon-1', { linkType: 'QUEST', targetId: 'quest-1', roomId: undefined })
    await wrapper.get('button[aria-label="Remove link to Find the relic"]').trigger('click')
    await flushPromises()
    expect(api.deleteLink).toHaveBeenLastCalledWith('campaign-1', 'dungeon-1', 'link-1')

    await wrapper.get('input[aria-label="Map name"]').setValue('Drowned Crypt')
    await wrapper.get('input[aria-label="Map name"]').element.closest('form')!.dispatchEvent(new Event('submit'))
    await flushPromises()
    expect(api.updateEncounterMap).toHaveBeenLastCalledWith('campaign-1', 'dungeon-1', { name: 'Drowned Crypt' })
    await click(wrapper, 'Archive')
    expect(api.updateEncounterMap).toHaveBeenLastCalledWith('campaign-1', 'dungeon-1', { status: 'ARCHIVED' })
    expect(toastAdd.mock.calls.at(-1)![0]).toMatchObject({ title: 'Map archived', actions: [expect.objectContaining({ label: 'Undo' })] })

    await click(wrapper, 'Export…')
    await choose(wrapper, 'Export format', 'SVG')
    await click(wrapper, 'Export map')
    expect(api.exportEncounterMap).toHaveBeenLastCalledWith('campaign-1', 'dungeon-1', expect.objectContaining({ format: 'SVG', floor: 0 }))
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
    await click(wrapper, 'Export…')
    await choose(wrapper, 'Export format', 'JSON')
    await click(wrapper, 'Export map')
    expect(api.exportEncounterMap).toHaveBeenLastCalledWith('campaign-1', 'dungeon-1', expect.objectContaining({ format: 'JSON', floor: undefined }))
    wrapper.unmount()
  })

  it('shows viewers the map and its details without editing controls', async () => {
    const wrapper = await mountDetail(false)
    expect(wrapper.text()).toContain('Read-only access')
    expect(wrapper.find('[data-test="map-canvas"]').exists()).toBe(true)
    for (const label of ['Generate', 'Reroll', 'Publish', 'Archive']) {
      expect(wrapper.findAll('button').some(item => item.text() === label)).toBe(false)
    }
    expect((select(wrapper, 'Map type').props() as { disabled?: boolean }).disabled).toBe(true)
    expect(wrapper.findAll('button').some(item => item.text() === 'Export…')).toBe(true)
    await openTab(wrapper, 'history')
    expect(wrapper.findAll('button').some(item => item.text() === 'Save snapshot')).toBe(false)
    wrapper.unmount()
  })
})
