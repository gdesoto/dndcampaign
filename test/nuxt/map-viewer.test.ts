import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import type { CampaignMapViewerDto } from '#shared/types/api/map'
import Viewer from '~/components/maps/Viewer.vue'

const mocks = vi.hoisted(() => ({ maps: [] as any[], loadSvg: vi.fn(), worker: vi.fn(), fail: false }))
vi.mock('~/components/maps/svg-background', () => ({ loadSvgBackground: mocks.loadSvg }))
vi.mock('maplibre-gl', () => ({
  setWorkerUrl: mocks.worker,
  NavigationControl: vi.fn(function () {}),
  Map: class {
    events = new Map<string, (...args: any[]) => void>()
    sources = new Map<string, any>()
    layers = new Map<string, any>()
    canvas = document.createElement('canvas')
    container = document.createElement('div')
    zoom = 2
    addControl = vi.fn()
    remove = vi.fn()
    setMaxBounds = vi.fn()
    fitBounds = vi.fn()
    queryRenderedFeatures = vi.fn(() => [] as any[])
    constructor() {
      if (mocks.fail) throw Object.assign(new Error('No GPU'), { name: 'GPUInitializationError' })
      mocks.maps.push(this)
    }
    on(event: string, listener: (...args: any[]) => void) { this.events.set(event, listener) }
    getCanvas() { return this.canvas }
    getCanvasContainer() { return this.container }
    getZoom() { return this.zoom }
    addSource(id: string, options: any) {
      this.sources.set(id, { ...options, setData: vi.fn(), updateImage: vi.fn(), setCoordinates: vi.fn() })
    }
    getSource(id: string) { return this.sources.get(id) }
    addLayer(layer: any) { this.layers.set(layer.id, structuredClone(layer)) }
    getLayer(id: string) { return this.layers.get(id) }
    setFilter(id: string, filter: any) { this.layers.get(id).filter = filter }
    setLayoutProperty(id: string, key: string, value: any) {
      const layer = this.layers.get(id)
      layer.layout = { ...layer.layout, [key]: value }
    }
  },
}))

const viewer: CampaignMapViewerDto = {
  map: { id: 'map', campaignId: 'campaign', name: 'Vale', isPrimary: true, status: 'ACTIVE', importVersion: 1, sourceFingerprint: 'fixture', bounds: [[-10, -6], [10, 6]], defaultActiveLayers: ['burg', 'marker'] },
  features: [{ id: 'town', type: 'Feature', geometry: { type: 'Point', coordinates: [0, 0] }, properties: { mapFeatureId: 'town', featureType: 'burg', displayName: 'Town', externalId: '1', sourceRef: 'burgs', removed: false, capital: true, glossaryLinkedOrMatched: true } }],
}
const wrappers: Awaited<ReturnType<typeof mountSuspended>>[] = []
const mountViewer = async (extra = {}) => {
  const wrapper = await mountSuspended(Viewer, { props: { viewer, activeLayers: ['state', 'burg', 'river', 'marker'], selectedFeatureIds: [], ...extra } })
  wrappers.push(wrapper)
  await vi.waitFor(() => expect(mocks.maps.length).toBeGreaterThan(0))
  const map = mocks.maps.at(-1)
  await vi.waitFor(() => expect(map.events.has('load')).toBe(true))
  map.events.get('load')()
  return { wrapper, map }
}
beforeEach(() => {
  mocks.maps.length = 0
  mocks.fail = false
  mocks.loadSvg.mockReset()
  mocks.worker.mockClear()
})
afterEach(() => { wrappers.splice(0).forEach(wrapper => wrapper.unmount()) })

describe('campaign map viewer', () => {
  it('shares one feature source, preserves selected overlays, and updates data without recreating the map', async () => {
    const { wrapper, map } = await mountViewer({ selectedFeatureIds: ['town'] })
    expect(mocks.worker).toHaveBeenCalledWith(expect.any(String))
    expect([...map.sources.keys()]).toEqual(['campaign-map-svg', 'campaign-map-features'])
    expect(map.layers.get('map-selected-point')).toMatchObject({ source: 'campaign-map-features', filter: ['in', ['get', 'mapFeatureId'], ['literal', ['town']]] })
    await wrapper.setProps({ selectedFeatureIds: [], activeLayers: [] })
    expect(map.layers.get('map-selected-point').filter).toEqual(['in', ['get', 'mapFeatureId'], ['literal', []]])
    expect(map.layers.get('map-burg-capital').layout.visibility).toBe('none')
    expect(map.layers.get('map-selected-point').layout?.visibility).not.toBe('none')
    const features = [...viewer.features, { ...viewer.features[0]!, id: 'second' }]
    await wrapper.setProps({ viewer: { ...viewer, features } })
    expect(map.sources.get('campaign-map-features').setData).toHaveBeenCalledWith({ type: 'FeatureCollection', features })
    expect(mocks.maps).toHaveLength(1)
  })

  it('preserves glossary filtering and settlement zoom thresholds', async () => {
    const { wrapper, map } = await mountViewer()
    expect(map.layers.get('map-burg-major').minzoom).toBe(7)
    expect(map.layers.get('map-burg-minor').minzoom).toBe(9)
    await wrapper.setProps({ glossaryPointsOnly: true })
    expect(map.layers.get('map-river-line').layout.visibility).toBe('none')
    expect(map.layers.get('map-state-fill').layout.visibility).toBe('visible')
    expect(map.layers.get('map-marker-point').filter).toEqual(['all', ['==', ['get', 'featureType'], 'marker'], ['==', ['get', 'glossaryLinkedOrMatched'], true]])
    await wrapper.setProps({ glossaryPointsOnly: false })
    expect(map.layers.get('map-river-line').layout.visibility).toBe('visible')
  })

  it('prioritizes points over states, toggles selection, and clears hover on native mouseleave', async () => {
    const { wrapper, map } = await mountViewer({ selectedFeatureIds: ['town'] })
    map.queryRenderedFeatures.mockReturnValue([{ properties: { mapFeatureId: 'state', featureType: 'state' } }, { properties: viewer.features[0]!.properties }])
    map.events.get('mousemove')({ point: { x: 10, y: 10 }, originalEvent: { clientX: 20, clientY: 30 } })
    expect(wrapper.emitted('featureHover')?.at(-1)).toEqual([{ id: 'town', name: 'Town', type: 'burg' }])
    map.events.get('click')({ point: { x: 10, y: 10 } })
    expect(wrapper.emitted('update:selectedFeatureIds')?.at(-1)).toEqual([[]])
    map.container.dispatchEvent(new MouseEvent('mouseleave'))
    expect(wrapper.emitted('featureHover')?.at(-1)).toEqual([null])
    expect(map.canvas.style.cursor).toBe('')
  })

  it('loads features before the SVG and ignores stale background requests on map changes and unmount', async () => {
    let resolveFirst!: (value: any) => void
    let resolveSecond!: (value: any) => void
    mocks.loadSvg.mockImplementationOnce(() => new Promise(resolve => { resolveFirst = resolve }))
      .mockImplementationOnce(() => new Promise(resolve => { resolveSecond = resolve }))
    const { wrapper, map } = await mountViewer({ svgBackgroundUrl: '/first.svg' })
    expect(map.layers.has('map-marker-point')).toBe(true)
    await wrapper.setProps({ svgBackgroundUrl: '/second.svg' })
    expect(mocks.loadSvg.mock.calls[0]![1].aborted).toBe(true)
    const staleRasterize = vi.fn()
    resolveFirst({ rasterize: staleRasterize })
    await Promise.resolve()
    expect(staleRasterize).not.toHaveBeenCalled()
    wrapper.unmount()
    wrappers.length = 0
    resolveSecond({ rasterize: staleRasterize })
    await Promise.resolve()
    expect(staleRasterize).not.toHaveBeenCalled()
    expect(map.remove).toHaveBeenCalledOnce()
    expect(mocks.loadSvg.mock.calls[1]![1].aborted).toBe(true)
  })

  it('reuses the decoded background across zoom tiers and applies new bounds', async () => {
    const canvas = document.createElement('canvas')
    const rasterize = vi.fn<(scale: number) => HTMLCanvasElement>(() => canvas)
    mocks.loadSvg.mockResolvedValue({ rasterize })
    const { wrapper, map } = await mountViewer({ svgBackgroundUrl: '/map.svg' })
    await vi.waitFor(() => expect(rasterize).toHaveBeenCalledWith(1))
    for (const zoom of [3, 5, 7, 8]) {
      map.zoom = zoom
      map.events.get('zoomend')()
    }
    expect(rasterize.mock.calls.map(call => call[0])).toEqual([1, 2, 3, 4])
    expect(mocks.loadSvg).toHaveBeenCalledOnce()
    expect(map.sources.get('campaign-map-svg').updateImage).toHaveBeenCalledWith({ image: canvas })
    const bounds: [[number, number], [number, number]] = [[-20, -12], [20, 12]]
    await wrapper.setProps({ viewer: { ...viewer, map: { ...viewer.map, bounds } } })
    expect(map.setMaxBounds).toHaveBeenLastCalledWith(bounds)
    expect(map.fitBounds).toHaveBeenLastCalledWith(bounds, { padding: 0, duration: 0 })
  })

  it('explains unavailable WebGL2 without leaving a loading screen', async () => {
    mocks.fail = true
    const wrapper = await mountSuspended(Viewer, { props: { viewer, activeLayers: [], selectedFeatureIds: [] } })
    wrappers.push(wrapper)
    await vi.waitFor(() => expect(wrapper.text()).toContain('This map requires WebGL2'))
    expect(wrapper.text()).not.toContain('Loading map viewer')
  })
})
