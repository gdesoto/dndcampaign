import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import type { DungeonMapData } from '#shared/types/dungeon'
import MapCanvas from '~/components/dungeon/MapCanvas.vue'

const mocks = vi.hoisted(() => ({ maps: [] as any[], decode: vi.fn(), controls: [] as string[] }))
vi.mock('~/components/maps/svg-background', () => ({ decodeSvgRaster: mocks.decode }))
vi.mock('maplibre-gl', () => ({
  setWorkerUrl: vi.fn(),
  NavigationControl: vi.fn(function () { mocks.controls.push('navigation') }),
  FullscreenControl: vi.fn(function (this: any, options: { container: HTMLElement }) { this.container = options.container; mocks.controls.push('fullscreen') }),
  Map: class {
    events = new Map<string, (...args: any[]) => void>()
    sources = new Map<string, any>()
    layers = new Map<string, any>()
    canvas = document.createElement('canvas')
    // A wide, short container: wider than the map plus its old fixed pan margin.
    container = { clientWidth: 1600, clientHeight: 400 }
    zoom = 8
    options: any
    addControl = vi.fn()
    remove = vi.fn()
    fitBounds = vi.fn()
    setMaxBounds = vi.fn()
    setMaxZoom = vi.fn()
    easeTo = vi.fn()
    cameraForBounds = vi.fn(() => ({ zoom: 8 }))
    getBounds = vi.fn(() => ({ contains: () => false }))
    queryRenderedFeatures = vi.fn(() => [] as any[])
    touchZoomRotate = { disableRotation: vi.fn() }
    keyboard = { disableRotation: vi.fn() }
    constructor(options: any) {
      this.options = options
      mocks.maps.push(this)
    }
    on(event: string, listener: (...args: any[]) => void) { this.events.set(event, listener) }
    getCanvas() { return this.canvas }
    getContainer() { return this.container }
    getZoom() { return this.zoom }
    addSource(id: string, options: any) {
      this.sources.set(id, { ...options, setData: vi.fn(), updateImage: vi.fn(), setCoordinates: vi.fn() })
    }
    getSource(id: string) { return this.sources.get(id) }
    addLayer(layer: any) { this.layers.set(layer.id, structuredClone(layer)) }
    setFilter(id: string, filter: any) { this.layers.get(id).filter = filter }
    setLayoutProperty(id: string, key: string, value: any) {
      const layer = this.layers.get(id)
      layer.layout = { ...layer.layout, [key]: value }
    }
  },
}))

const map = {
  schemaVersion: 1, gridType: 'SQUARE', width: 40, height: 20, cellSize: 32,
  mapType: 'BUILDING', floorCount: 2, floorLabels: ['Ground floor', 'Upper floor'],
  rooms: [
    { id: 'hall', roomNumber: 1, x: 2, y: 2, width: 6, height: 4, isSecret: false, floor: 0 },
    { id: 'attic', roomNumber: 2, x: 2, y: 2, width: 6, height: 4, isSecret: false, floor: 1 },
  ],
  corridors: [], doors: [], walls: [], zones: [], dressing: [],
  traps: [{ id: 'pit', roomId: 'hall', name: 'Pit', severity: 'LOW', trigger: 'Step', effect: 'Fall', detectDc: 10, disarmDc: 10, isLocked: false }],
  encounters: [{ id: 'goblins', roomId: 'hall', title: 'Goblins', difficulty: 'EASY', summary: 'Ambush', isLocked: false }],
  treasures: [],
  metadata: { algorithmVersion: '1', configHash: 'hash', generatedAt: new Date().toISOString(), seed: 'seed', passHistory: [] },
} as DungeonMapData

const wrappers: Awaited<ReturnType<typeof mountSuspended>>[] = []
const mountCanvas = async (props: Record<string, unknown> = {}) => {
  const wrapper = await mountSuspended(MapCanvas, { props: { map, ...props } })
  wrappers.push(wrapper)
  await vi.waitFor(() => expect(mocks.maps.length).toBeGreaterThan(0))
  const instance = mocks.maps.at(-1)
  await vi.waitFor(() => expect(instance.events.has('load')).toBe(true))
  instance.events.get('load')()
  return { wrapper, instance }
}

beforeEach(() => {
  mocks.maps.length = 0
  mocks.controls.length = 0
  mocks.decode.mockReset()
})
afterEach(() => { wrappers.splice(0).forEach(wrapper => wrapper.unmount()) })

describe('dungeon map canvas', () => {
  it('draws the floor as a raster with selectable rooms and content markers, and keeps the view on same-size edits', async () => {
    const canvas = document.createElement('canvas')
    const rasterize = vi.fn(() => canvas)
    mocks.decode.mockResolvedValue({ width: 1280, height: 640, rasterize })
    const { wrapper, instance } = await mountCanvas({ selectedRoomId: 'hall' })

    expect(instance.options).toMatchObject({ dragRotate: false, bounds: [[0, -0.5], [1, 0]] })
    expect(mocks.controls).toEqual(['navigation', 'fullscreen'])
    expect(instance.canvas.getAttribute('aria-label')).toBe('Building map, Ground floor')
    expect(wrapper.find('[role="region"]').exists()).toBe(false)
    const features = instance.sources.get('dungeon-features').data.features
    expect(features.map((feature: any) => feature.properties)).toEqual([
      { kind: 'room', id: 'hall' },
      { kind: 'trap', id: 'pit', roomId: 'hall' },
      { kind: 'encounter', id: 'goblins', roomId: 'hall' },
    ])
    expect(instance.layers.get('room-selected-line').filter).toEqual(['==', ['get', 'id'], 'hall'])
    await vi.waitFor(() => expect(rasterize).toHaveBeenCalled())
    expect(instance.layers.get('dungeon-raster').layout.visibility).toBe('visible')
    const decodedSvg = await (mocks.decode.mock.calls[0]![0] as Blob).text()
    expect(decodedSvg).toContain('data-layer="grid"')

    // Pan limits cover the whole fitted view, so MapLibre never zooms in and crops the map.
    const degreesPerPixel = 360 / (512 * 2 ** 8)
    const [[limitWest, limitSouth], [limitEast, limitNorth]] = instance.setMaxBounds.mock.calls.at(-1)![0]
    expect(limitEast - limitWest).toBeGreaterThanOrEqual(1600 * degreesPerPixel)
    expect(limitNorth - limitSouth).toBeGreaterThanOrEqual(400 * degreesPerPixel)
    expect(limitWest).toBeLessThan(0)
    expect(limitNorth).toBeGreaterThan(0)
    const fitsBeforeResize = instance.fitBounds.mock.calls.length
    instance.events.get('resize')()
    expect(instance.fitBounds).toHaveBeenCalledTimes(fitsBeforeResize + 1)
    instance.events.get('zoomstart')({ originalEvent: new Event('wheel') })
    instance.events.get('resize')()
    expect(instance.fitBounds).toHaveBeenCalledTimes(fitsBeforeResize + 1)

    instance.queryRenderedFeatures.mockReturnValue([{ properties: { kind: 'room', id: 'hall' } }, { properties: { kind: 'trap', id: 'pit' } }])
    instance.events.get('click')({ point: { x: 1, y: 1 } })
    expect(wrapper.emitted('update:selectedMarker')?.at(-1)).toEqual([{ kind: 'trap', id: 'pit' }])
    instance.queryRenderedFeatures.mockReturnValue([{ properties: { kind: 'room', id: 'hall' } }])
    instance.events.get('click')({ point: { x: 1, y: 1 } })
    expect(wrapper.emitted('update:selectedRoomId')?.at(-1)).toEqual([null])
    instance.queryRenderedFeatures.mockReturnValue([])
    instance.events.get('click')({ point: { x: 1, y: 1 } })
    expect(wrapper.emitted('update:selectedMarker')?.at(-1)).toEqual([null])

    await wrapper.setProps({ selectedMarker: { kind: 'encounter', id: 'goblins' } })
    expect(instance.layers.get('marker-selected').filter).toEqual(['==', ['get', 'id'], 'goblins'])
    expect(instance.easeTo).toHaveBeenCalled()

    const fits = instance.fitBounds.mock.calls.length
    await wrapper.setProps({ floor: 1, showGrid: false })
    expect(instance.canvas.getAttribute('aria-label')).toBe('Building map, Upper floor')
    expect(instance.sources.get('dungeon-features').setData).toHaveBeenLastCalledWith(expect.objectContaining({
      features: [expect.objectContaining({ properties: { kind: 'room', id: 'attic' } })],
    }))
    await vi.waitFor(() => expect(mocks.decode).toHaveBeenCalledTimes(2))
    expect(await (mocks.decode.mock.calls[1]![0] as Blob).text()).not.toContain('data-layer="grid"')
    expect(instance.fitBounds).toHaveBeenCalledTimes(fits)
    await wrapper.setProps({ map: { ...map, width: 80 } })
    expect(instance.fitBounds).toHaveBeenCalledTimes(fits + 1)

    instance.zoom = 12
    instance.events.get('zoomend')()
    expect(instance.sources.get('dungeon-raster').updateImage).toHaveBeenCalled()
    ;(wrapper.vm as unknown as { fit: () => void }).fit()
    expect(instance.fitBounds).toHaveBeenCalledTimes(fits + 2)
  })
})
