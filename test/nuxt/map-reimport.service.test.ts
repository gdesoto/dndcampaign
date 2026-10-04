import { resolve } from 'node:path'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createDatabase, type Database } from '../../server/db/connection'
import { campaign, campaignMap, campaignMapFeature, campaignMapFile, campaignMapGlossaryLink, glossaryEntry, user } from '../../server/db/schema'

const harness = vi.hoisted(() => ({
  database: undefined as Database | undefined,
  putObject: vi.fn(),
  deleteObject: vi.fn(),
}))

vi.mock('#server/db/client', () => ({
  get db() { return harness.database },
}))
vi.mock('#server/services/storage/storage.factory', () => ({
  getStorageAdapter: () => ({ putObject: harness.putObject, deleteObject: harness.deleteObject }),
}))

const { MapService } = await import('#server/services/map.service')
let database: Database
let objects: Map<string, Buffer>
let operations: Array<{ action: 'put' | 'delete'; key: string }>

const uploads = () => [
  {
    filename: 'full.json', mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({
      info: { mapName: 'Updated World', width: 100, height: 100 },
      pack: { burgs: [{ i: 1, name: 'New Town', x: 50, y: 50 }] },
    })),
  },
  { filename: 'world.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg/>') },
]

const state = () => ({
  map: database.select().from(campaignMap).get(),
  files: database.select().from(campaignMapFile).all(),
  features: database.select().from(campaignMapFeature).all(),
  links: database.select().from(campaignMapGlossaryLink).all(),
  glossary: database.select().from(glossaryEntry).all(),
})

beforeEach(() => {
  database = createDatabase(':memory:')
  harness.database = database
  migrate(database, { migrationsFolder: resolve('drizzle') })
  objects = new Map([['old-full.json', Buffer.from('old map')]])
  operations = []
  harness.putObject.mockReset().mockImplementation(async (key: string, buffer: Buffer) => {
    operations.push({ action: 'put', key })
    objects.set(key, buffer)
    return { storageKey: key, byteSize: buffer.byteLength, checksumSha256: 'new-checksum' }
  })
  harness.deleteObject.mockReset().mockImplementation(async (key: string) => {
    operations.push({ action: 'delete', key })
    objects.delete(key)
  })
  database.insert(user).values({ id: 'owner', name: 'Owner', email: 'map-owner@example.test' }).run()
  database.insert(campaign).values({ id: 'campaign', ownerId: 'owner', name: 'Campaign' }).run()
  database.insert(campaignMap).values({
    id: 'map', campaignId: 'campaign', name: 'Old World', slug: 'old-world',
    createdById: 'owner', sourceFingerprint: 'old-fingerprint', isPrimary: true,
    rawManifestJson: { bounds: [[-180, -85], [180, 85]] },
  }).run()
  database.insert(campaignMapFile).values({
    id: 'old-file', campaignMapId: 'map', kind: 'FULL_JSON', storageProvider: 'LOCAL',
    storageKey: 'old-full.json', contentType: 'application/json', sizeBytes: 7,
  }).run()
  database.insert(campaignMapFeature).values({
    id: 'old-feature', campaignMapId: 'map', externalId: '1', featureType: 'BURG',
    name: 'Old Town', displayName: 'Old Town', normalizedName: 'old town',
    geometryType: 'Point', geometryJson: { type: 'Point', coordinates: [0, 0] }, sourceRef: 'pack.burgs[1]',
  }).run()
  database.insert(glossaryEntry).values({
    id: 'glossary', campaignId: 'campaign', type: 'LOCATION', name: 'Town', description: 'Town notes',
    sourceMapId: 'map', sourceMapFeatureId: 'old-feature',
  }).run()
  database.insert(campaignMapGlossaryLink).values({
    id: 'old-link', campaignMapId: 'map', mapFeatureId: 'old-feature', glossaryEntryId: 'glossary', linkType: 'MERGED',
  }).run()
})

afterEach(() => {
  database?.$client.close()
  harness.database = undefined
  vi.restoreAllMocks()
})

describe('map reimport storage and database consistency', () => {
  it('uploads without a database transaction, then commits new files and restored links before deleting old objects', async () => {
    const before = state()
    const upload = harness.putObject.getMockImplementation()!
    harness.putObject.mockImplementation(async (...args) => {
      expect(database.$client.inTransaction).toBe(false)
      expect(state()).toEqual(before)
      return upload(...args)
    })
    const remove = harness.deleteObject.getMockImplementation()!
    harness.deleteObject.mockImplementation(async (key: string) => {
      expect(state().map?.importVersion).toBe(2)
      expect(state().links).toMatchObject([{ glossaryEntryId: 'glossary', mapFeatureId: state().features[0]!.id, linkType: 'MERGED' }])
      expect(state().files.every(file => objects.has(file.storageKey))).toBe(true)
      return remove(key)
    })

    const result = await new MapService().applyReimport('campaign', 'map', 'owner', 'replace_preserve_links', uploads())
    const after = state()
    expect(result).toMatchObject({ id: 'map', importVersion: 2, hasSvg: true, featureCounts: { burg: 1 } })
    expect(after.features).toMatchObject([{ name: 'New Town', externalId: '1', featureType: 'BURG' }])
    expect(after.features[0]!.id).not.toBe('old-feature')
    expect(after.files.map(file => file.kind).sort()).toEqual(['FULL_JSON', 'SVG'])
    const preparedKeys = harness.putObject.mock.calls.map(([key]) => key as string)
    expect(new Set(preparedKeys).size).toBe(2)
    expect(preparedKeys.every(key => key.startsWith('campaigns/campaign/maps/map/raw/'))).toBe(true)
    expect(operations).toEqual([...preparedKeys.map(key => ({ action: 'put', key })), { action: 'delete', key: 'old-full.json' }])
    expect([...objects.keys()].sort()).toEqual(preparedKeys.sort())
  })

  it('cleans all attempted uploads including a partial failed write and keeps the existing map intact', async () => {
    const before = state()
    const upload = harness.putObject.getMockImplementation()!
    harness.putObject.mockImplementation(async (...args) => {
      const result = await upload(...args)
      if (harness.putObject.mock.calls.length === 2) throw new Error('storage upload failed after partial write')
      return result
    })

    await expect(new MapService().applyReimport('campaign', 'map', 'owner', 'replace_preserve_links', uploads())).rejects.toThrow('storage upload failed')
    expect(state()).toEqual(before)
    const keys = harness.putObject.mock.calls.map(([key]) => key as string)
    expect(operations).toEqual([...keys.map(key => ({ action: 'put', key })), ...keys.map(key => ({ action: 'delete', key }))])
    expect([...objects.keys()]).toEqual(['old-full.json'])
    expect(database.$client.inTransaction).toBe(false)
  })

  it('rolls back files, features, links, glossary references, and version if link restoration fails after replacing files', async () => {
    const before = state()
    database.$client.exec("CREATE TRIGGER reject_reimport_link BEFORE INSERT ON CampaignMapGlossaryLink BEGIN SELECT RAISE(ABORT, 'link restoration failed'); END")

    await expect(new MapService().applyReimport('campaign', 'map', 'owner', 'replace_preserve_links', uploads())).rejects.toMatchObject({
      message: 'link restoration failed',
      code: 'SQLITE_CONSTRAINT_TRIGGER',
    })
    expect(state()).toEqual(before)
    const keys = harness.putObject.mock.calls.map(([key]) => key as string)
    expect(keys).toHaveLength(2)
    expect(operations).toEqual([...keys.map(key => ({ action: 'put', key })), ...keys.map(key => ({ action: 'delete', key }))])
    expect([...objects.keys()]).toEqual(['old-full.json'])
    expect(database.$client.inTransaction).toBe(false)
  })

  it('retains every newly referenced object when obsolete-file cleanup fails after commit', async () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {})
    harness.deleteObject.mockImplementation(async (key: string) => {
      operations.push({ action: 'delete', key })
      throw new Error('old object deletion failed')
    })

    const result = await new MapService().applyReimport('campaign', 'map', 'owner', 'replace_preserve_links', uploads())
    const after = state()
    expect(result).toMatchObject({ id: 'map', importVersion: 2 })
    expect(after.map?.importVersion).toBe(2)
    expect(after.links).toMatchObject([{ mapFeatureId: after.features[0]!.id, glossaryEntryId: 'glossary' }])
    expect(after.files).toHaveLength(2)
    expect(after.files.every(file => objects.has(file.storageKey))).toBe(true)
    expect(harness.deleteObject.mock.calls).toEqual([['old-full.json']])
    expect(objects.size).toBe(3)
    expect(warning).toHaveBeenCalledWith(expect.stringContaining('committed'), expect.objectContaining({ mapId: 'map', storageKey: 'old-full.json' }))
  })
})
