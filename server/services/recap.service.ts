import { prisma } from '#server/db/prisma'
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
      const existing = await prisma.recapRecording.findUnique({
        where: { sessionId: input.sessionId },
      })

      if (existing) {
        const previousArtifactId = existing.artifactId
        const updated = await prisma.recapRecording.update({
          where: { id: existing.id },
          data: {
            filename: input.filename,
            mimeType: input.mimeType,
            byteSize: artifact.byteSize,
            durationSeconds: input.durationSeconds,
            artifactId: artifact.id,
          },
        })

        if (previousArtifactId !== artifact.id) {
          await this.deleteArtifactBestEffort(previousArtifactId)
        }

        return updated
      }

      return await prisma.recapRecording.create({
        data: {
          sessionId: input.sessionId,
          filename: input.filename,
          mimeType: input.mimeType,
          byteSize: artifact.byteSize,
          durationSeconds: input.durationSeconds,
          artifactId: artifact.id,
        },
      })
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
