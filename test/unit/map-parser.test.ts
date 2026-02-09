import { describe, expect, it } from 'vitest'
import { buildFeatureDiff, classifyMapUploadFiles, normalizeMapName, parseAzgaarFullJson } from '../../server/services/map-parser.service'

const buildSampleMap = () =>
  Buffer.from(
    JSON.stringify({
      info: { mapName: 'Chronosia' },
      notes: [{ id: 'marker0', name: 'Storm Crown', legend: 'A dangerous volcano.' }],
      pack: {
        vertices: [
          { i: 0, p: [0, 0] },
          { i: 1, p: [100, 0] },
          { i: 2, p: [100, 100] },
          { i: 3, p: [0, 100] },
        ],
        cells: [
          {
            i: 0,
            p: [50, 50],
            v: [0, 1, 2, 3],
            state: 1,
            province: 10,
            biome: 1,
            burg: 0,
            r: 0,
          },
        ],
        states: [{ i: 1, name: 'Silverreach', fullName: 'Kingdom of Silverreach' }],
        provinces: [{ i: 10, name: 'Northwatch' }],
        burgs: [{ i: 2, x: 40, y: 40, name: 'Greyhaven', state: 1, type: 'Town' }],
        markers: [{ i: 0, x: 70, y: 60, type: 'volcano' }],
        rivers: [{ i: 5, name: 'Moonrun', type: 'River', length: 20, cells: [0] }],
        routes: [{ i: 7, group: 'roads', points: [[20, 20, 0], [80, 80, 0]] }],
      },
    })
  )

describe('map parser', () => {
  it('requires full json and classifies optional files', () => {
    const classified = classifyMapUploadFiles([
      { filename: 'Chronosia Full.json', mimeType: 'application/json', buffer: Buffer.from('{}') },
      { filename: 'Chronosia.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg />') },
      { filename: 'Chronosia Rivers.geojson', mimeType: 'application/geo+json', buffer: Buffer.from('{}') },
    ])

    expect(classified.fullJson.filename).toContain('Full')
    expect(classified.optionalFiles.map((file) => file.kind)).toEqual(['SVG', 'GEOJSON_RIVERS'])
  })

  it('normalizes azgaar entities and maps marker notes into description', () => {
    const parsed = parseAzgaarFullJson(buildSampleMap())
    expect(parsed.mapName).toBe('Chronosia')
    expect(parsed.features.some((feature) => feature.featureType === 'state')).toBe(true)
    expect(parsed.features.some((feature) => feature.featureType === 'route')).toBe(true)
    expect(parsed.features.some((feature) => feature.featureType === 'cell')).toBe(true)

    const marker = parsed.features.find((feature) => feature.featureType === 'marker')
    expect(marker?.name).toBe('Storm Crown')
    expect(marker?.description).toContain('dangerous volcano')
  })

  it('strips lone surrogate characters before Prisma-bound payload creation', () => {
    const payload = Buffer.from(
      JSON.stringify({
        notes: [{ id: 'marker0', name: 'Bad\uD83DName', legend: 'Legend\uD83Dtext' }],
        pack: {
          vertices: [
            { i: 0, p: [0, 0] },
            { i: 1, p: [100, 0] },
            { i: 2, p: [100, 100] },
          ],
          cells: [{ i: 0, p: [50, 50], v: [0, 1, 2], state: 1, province: 0 }],
          states: [{ i: 1, name: 'State\uD83DOne' }],
          provinces: [],
          burgs: [],
          rivers: [],
          routes: [],
          markers: [{ i: 0, x: 20, y: 30, type: 'monument', icon: '\uD83D' }],
        },
      })
    )

    const parsed = parseAzgaarFullJson(payload)
    const marker = parsed.features.find((feature) => feature.featureType === 'marker')
    expect(marker?.displayName).toBe('BadName')
    expect(marker?.description).toBe('Legendtext')
    expect(JSON.stringify(parsed.features)).not.toContain('\\ud83d')
  })

  it('builds reimport diff counts', () => {
    const diff = buildFeatureDiff(
      [
        {
          featureType: 'STATE',
          externalId: '1',
          name: 'A',
          displayName: 'A',
          removed: false,
          geometryType: 'Polygon',
        },
      ],
      [
        {
          externalId: '1',
          featureType: 'state',
          name: 'A',
          displayName: 'A updated',
          normalizedName: 'a updated',
          geometryType: 'Polygon',
          geometryJson: { type: 'Polygon', coordinates: [] },
          sourceRef: 'pack.states[1]',
          removed: false,
        },
        {
          externalId: '2',
          featureType: 'state',
          name: 'B',
          displayName: 'B',
          normalizedName: 'b',
          geometryType: 'Polygon',
          geometryJson: { type: 'Polygon', coordinates: [] },
          sourceRef: 'pack.states[2]',
          removed: false,
        },
      ]
    )

    expect(diff).toEqual({ added: 1, removed: 0, changed: 1 })
    expect(normalizeMapName('  The-Great,  Vale! ')).toBe('the great vale')
  })

  it('does not emit neutral state boundary (state id 0)', () => {
    const payload = Buffer.from(
      JSON.stringify({
        pack: {
          vertices: [
            { i: 0, p: [0, 0] },
            { i: 1, p: [100, 0] },
            { i: 2, p: [100, 100] },
            { i: 3, p: [0, 100] },
          ],
          cells: [
            { i: 0, p: [50, 50], v: [0, 1, 2, 3], state: 0, province: 0 },
          ],
          states: [{ i: 0, name: 'Neutral lands' }],
          provinces: [],
          burgs: [],
          markers: [],
          rivers: [],
          routes: [],
        },
      })
    )

    const parsed = parseAzgaarFullJson(payload)
    expect(parsed.features.filter((feature) => feature.featureType === 'state')).toEqual([])
  })
})
