import { and, eq } from 'drizzle-orm'
import { db } from '#server/db/client'
import { recapRecording } from '#server/db/schema'
import { ArtifactService } from './artifact.service'
import type { Readable } from 'node:stream'

type CreateRecapStreamInput = {
  ownerId: string
  campaignId: string
  sessionId: string
  filename: string
  mimeType: string
  stream: Readable
  durationSeconds?: number
}

export class RecapService {
  private artifactService = new ArtifactService()

  async createRecapFromStream(input: CreateRecapStreamInput) {
    const kind = input.mimeType.startsWith('video/') ? 'VIDEO' : 'AUDIO'
    const artifact = await this.artifactService.createArtifactFromStream({
      ownerId: input.ownerId,
      campaignId: input.campaignId,
      filename: input.filename,
      mimeType: input.mimeType,
      stream: input.stream,
      label: 'Session Recap',
      meta: {
        sessionId: input.sessionId,
        kind: 'recap',
      },
    })

    try {
      const result = db.transaction((tx) => {
        const existing = tx.select().from(recapRecording).where(and(eq(recapRecording.sessionId, input.sessionId), eq(recapRecording.kind, kind))).get()
        const values = {
          filename: input.filename,
          mimeType: input.mimeType,
          byteSize: artifact.byteSize,
          durationSeconds: input.durationSeconds ?? null,
          artifactId: artifact.id,
        }
        const updated = existing
          ? tx.update(recapRecording).set(values).where(eq(recapRecording.id, existing.id)).returning().get()!
          : tx.insert(recapRecording).values({ ...values, sessionId: input.sessionId, kind }).returning().get()!
        return { updated, previousArtifactId: existing?.artifactId }
      }, { behavior: 'immediate' })
      if (result.previousArtifactId && result.previousArtifactId !== artifact.id) await this.deleteArtifactBestEffort(result.previousArtifactId)
      return result.updated

    } catch (error) {
      await this.deleteArtifactBestEffort(artifact.id)
      throw error
    }
  }

  private async deleteArtifactBestEffort(artifactId: string) {
    try {
      await this.artifactService.deleteArtifact(artifactId)
    } catch {
      // Best-effort cleanup to avoid blocking recap operations.
    }
  }
}
