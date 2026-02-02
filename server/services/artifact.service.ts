import { randomUUID } from 'node:crypto'
import type { Readable } from 'node:stream'
import { prisma } from '#server/db/prisma'
import { getStorageAdapter } from './storage/storage.factory'
import type { StorageProvider } from '@prisma/client'

type CreateArtifactInput = {
  ownerId: string
  campaignId?: string
  filename: string
  mimeType: string
  data: Buffer
  label?: string
  meta?: Record<string, unknown>
}

type CreateArtifactStreamInput = {
  ownerId: string
  campaignId?: string
  filename: string
  mimeType: string
  stream: Readable
  label?: string
  meta?: Record<string, unknown>
}

export class ArtifactService {
  async createArtifactFromUpload(input: CreateArtifactInput) {
    const adapter = getStorageAdapter()
    const storageKey = this.buildStorageKey(input)
    const result = await adapter.putObject(storageKey, input.data, input.mimeType)

    return prisma.artifact.create({
      data: {
        ownerId: input.ownerId,
        campaignId: input.campaignId,
        provider: 'LOCAL' as StorageProvider,
        storageKey: result.storageKey,
        mimeType: input.mimeType,
        byteSize: result.byteSize,
        checksumSha256: result.checksumSha256,
        label: input.label,
        meta: input.meta ? JSON.stringify(input.meta) : undefined,
      },
    })
  }

  async createArtifactFromStream(input: CreateArtifactStreamInput) {
    const adapter = getStorageAdapter()
    const storageKey = this.buildStorageKey(input)
    const result = await adapter.putObjectStream(storageKey, input.stream, input.mimeType)

    return prisma.artifact.create({
      data: {
        ownerId: input.ownerId,
        campaignId: input.campaignId,
        provider: 'LOCAL' as StorageProvider,
        storageKey: result.storageKey,
        mimeType: input.mimeType,
        byteSize: result.byteSize,
        checksumSha256: result.checksumSha256,
        label: input.label,
        meta: input.meta ? JSON.stringify(input.meta) : undefined,
      },
    })
  }

  async getStream(artifactId: string) {
    const artifact = await prisma.artifact.findUnique({ where: { id: artifactId } })
    if (!artifact) return null
    const adapter = getStorageAdapter()
    return adapter.getObject(artifact.storageKey)
  }

  async deleteArtifact(artifactId: string) {
    const artifact = await prisma.artifact.findUnique({ where: { id: artifactId } })
    if (!artifact) return null
    const adapter = getStorageAdapter()
    await adapter.deleteObject(artifact.storageKey)
    await prisma.artifact.delete({ where: { id: artifactId } })
    return artifact
  }

  private buildStorageKey(input: CreateArtifactInput) {
    const safeName = input.filename.replace(/[^a-zA-Z0-9._-]/g, '_')
    const campaignPart = input.campaignId ? `campaigns/${input.campaignId}` : 'global'
    return `${campaignPart}/${input.ownerId}/${randomUUID()}-${safeName}`
  }
}

