import { randomUUID } from 'node:crypto'
import { Readable } from 'node:stream'
import { prisma } from '#server/db/prisma'
import { getStorageAdapter } from '#server/services/storage/storage.factory'
import type { StorageProvider } from '#server/db/prisma-client'

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
    return this.createArtifactFromStream({
      ...input,
      stream: Readable.from([input.data]),
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

  async deleteArtifact(artifactId: string) {
    const artifact = await prisma.artifact.findUnique({ where: { id: artifactId } })
    if (!artifact) return null
    await prisma.artifact.delete({ where: { id: artifactId } })
    const adapter = getStorageAdapter()
    try {
      await adapter.deleteObject(artifact.storageKey)
    } catch {
      // Database row is already removed; ignore storage cleanup failures.
    }
    return artifact
  }

  private buildStorageKey(input: Pick<CreateArtifactInput | CreateArtifactStreamInput, 'filename' | 'campaignId' | 'ownerId'>) {
    const safeName = input.filename.replace(/[^a-zA-Z0-9._-]/g, '_')
    const campaignPart = input.campaignId ? `campaigns/${input.campaignId}` : 'global'
    return `${campaignPart}/${input.ownerId}/${randomUUID()}-${safeName}`
  }
}


