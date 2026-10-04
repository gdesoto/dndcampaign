import { randomUUID } from 'node:crypto'
import { Readable } from 'node:stream'
import { eq } from 'drizzle-orm'
import { db } from '#server/db/client'
import { artifact } from '#server/db/schema'
import { getStorageAdapter } from '#server/services/storage/storage.factory'
import type { StorageProvider } from '#server/db/schema'

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

    return db.insert(artifact).values({
        ownerId: input.ownerId,
        campaignId: input.campaignId,
        provider: 'LOCAL' as StorageProvider,
        storageKey: result.storageKey,
        mimeType: input.mimeType,
        byteSize: result.byteSize,
        checksumSha256: result.checksumSha256,
        label: input.label,
        meta: input.meta ? JSON.stringify(input.meta) : undefined,
    }).returning().get()!
  }

  async deleteArtifact(artifactId: string) {
    const existing = db.select().from(artifact).where(eq(artifact.id, artifactId)).get()
    if (!existing) return null
    db.delete(artifact).where(eq(artifact.id, artifactId)).run()
    const adapter = getStorageAdapter()
    try {
      await adapter.deleteObject(existing.storageKey)
    } catch {
      // Database row is already removed; ignore storage cleanup failures.
    }
    return existing
  }

  private buildStorageKey(input: Pick<CreateArtifactInput | CreateArtifactStreamInput, 'filename' | 'campaignId' | 'ownerId'>) {
    const safeName = input.filename.replace(/[^a-zA-Z0-9._-]/g, '_')
    const campaignPart = input.campaignId ? `campaigns/${input.campaignId}` : 'global'
    return `${campaignPart}/${input.ownerId}/${randomUUID()}-${safeName}`
  }
}


