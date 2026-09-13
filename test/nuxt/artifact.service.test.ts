import { createHash } from 'node:crypto'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LocalStorageAdapter } from '../../server/services/storage/local.adapter'

const mocks = vi.hoisted(() => ({
  artifactCreate: vi.fn(),
  adapter: undefined as unknown,
}))

vi.mock('#server/db/prisma', () => ({
  prisma: { artifact: { create: mocks.artifactCreate } },
}))

vi.mock('#server/services/storage/storage.factory', () => ({
  getStorageAdapter: () => mocks.adapter,
}))

const { ArtifactService } = await import('#server/services/artifact.service')
const temporaryRoots: string[] = []

afterEach(async () => {
  mocks.artifactCreate.mockReset()
  for (const root of temporaryRoots.splice(0)) await rm(root, { recursive: true, force: true })
})

const useLocalStorage = async () => {
  const root = await mkdtemp(join(tmpdir(), 'dm-vault-artifacts-'))
  temporaryRoots.push(root)
  mocks.adapter = new LocalStorageAdapter(root)
  return root
}

describe('ArtifactService creation', () => {
  it('delegates buffer uploads to stream storage and persists all artifact metadata', async () => {
    const root = await useLocalStorage()
    const data = Buffer.from([0, 255, 100, 109, 45, 118, 97, 117, 108, 116])
    mocks.artifactCreate.mockImplementation(async ({ data: artifact }) => ({ id: 'artifact-1', ...artifact }))

    const artifact = await new ArtifactService().createArtifactFromUpload({
      ownerId: 'owner-1', campaignId: 'campaign-1', filename: 'session recap!.mp3', mimeType: 'audio/mpeg', data,
      label: 'Session Recap', meta: { sessionId: 'session-1', kind: 'recap' },
    })

    const call = mocks.artifactCreate.mock.calls[0]?.[0]
    expect(call).toMatchObject({ data: {
      ownerId: 'owner-1', campaignId: 'campaign-1', provider: 'LOCAL', mimeType: 'audio/mpeg', byteSize: data.length,
      checksumSha256: createHash('sha256').update(data).digest('hex'), label: 'Session Recap',
      meta: JSON.stringify({ sessionId: 'session-1', kind: 'recap' }),
    } })
    expect(call.data.storageKey).toMatch(/^campaigns\/campaign-1\/owner-1\/[\w-]+-session_recap_.mp3$/)
    expect(await readFile(join(root, call.data.storageKey))).toEqual(data)
    expect(artifact).toMatchObject({ id: 'artifact-1', ...call.data })
  })

  it('persists nonempty multi-chunk streams with global storage keys', async () => {
    const root = await useLocalStorage()
    const data = Buffer.from('first second')
    mocks.artifactCreate.mockImplementation(async ({ data: artifact }) => ({ id: 'artifact-2', ...artifact }))

    await new ArtifactService().createArtifactFromStream({
      ownerId: 'owner-2', filename: 'stream.txt', mimeType: 'text/plain',
      stream: Readable.from([Buffer.from('first '), Buffer.from('second')]),
    })

    const call = mocks.artifactCreate.mock.calls[0]?.[0]
    expect(call.data).toMatchObject({
      ownerId: 'owner-2', storageKey: expect.stringMatching(/^global\/owner-2\/[\w-]+-stream.txt$/),
      mimeType: 'text/plain', byteSize: data.length, checksumSha256: createHash('sha256').update(data).digest('hex'),
    })
    expect(call.data.campaignId).toBeUndefined()
    expect(call.data.label).toBeUndefined()
    expect(call.data.meta).toBeUndefined()
    expect(await readFile(join(root, call.data.storageKey))).toEqual(data)
  })

  it('preserves empty buffer uploads through the stream path', async () => {
    const root = await useLocalStorage()
    const data = Buffer.alloc(0)
    mocks.artifactCreate.mockImplementation(async ({ data: artifact }) => ({ id: 'artifact-3', ...artifact }))

    await new ArtifactService().createArtifactFromUpload({
      ownerId: 'owner-3', filename: 'empty.txt', mimeType: 'text/plain', data,
    })

    const call = mocks.artifactCreate.mock.calls[0]?.[0]
    expect(call.data).toMatchObject({
      byteSize: 0, checksumSha256: createHash('sha256').update(data).digest('hex'),
    })
    expect(await readFile(join(root, call.data.storageKey))).toEqual(data)
  })

  it('does not persist an artifact row when stream storage fails', async () => {
    mocks.adapter = { putObjectStream: vi.fn().mockRejectedValue(new Error('storage unavailable')) }

    await expect(new ArtifactService().createArtifactFromUpload({
      ownerId: 'owner-4', filename: 'failure.bin', mimeType: 'application/octet-stream', data: Buffer.from('x'),
    })).rejects.toThrow('storage unavailable')
    expect(mocks.artifactCreate).not.toHaveBeenCalled()
  })

  it('keeps the stored object when artifact persistence fails', async () => {
    const root = await useLocalStorage()
    const data = Buffer.from('persist me')
    mocks.artifactCreate.mockRejectedValue(new Error('database unavailable'))

    await expect(new ArtifactService().createArtifactFromUpload({
      ownerId: 'owner-5', filename: 'persist.txt', mimeType: 'text/plain', data,
    })).rejects.toThrow('database unavailable')

    const key = mocks.artifactCreate.mock.calls[0]?.[0].data.storageKey as string
    expect(await readFile(join(root, key))).toEqual(data)
  })
})
