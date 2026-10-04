import { eq } from 'drizzle-orm'
import { db } from '#server/db/client'
import { recording } from '#server/db/schema'
import { ArtifactService } from './artifact.service'
import type { RecordingKind } from '#server/db/schema'
import type { Readable } from 'node:stream'

type CreateRecordingStreamInput = {
  ownerId: string
  campaignId: string
  sessionId: string
  filename: string
  mimeType: string
  stream: Readable
  kind: RecordingKind
  durationSeconds?: number
}

type AttachVttStreamInput = {
  ownerId: string
  campaignId: string
  recordingId: string
  filename: string
  mimeType: string
  stream: Readable
}

export class RecordingService {
  private artifactService = new ArtifactService()

  async createRecordingFromStream(input: CreateRecordingStreamInput) {
    const artifact = await this.artifactService.createArtifactFromStream({
      ownerId: input.ownerId,
      campaignId: input.campaignId,
      filename: input.filename,
      mimeType: input.mimeType,
      stream: input.stream,
      label: `Recording ${input.kind.toLowerCase()}`,
    })

    try {
      return db.insert(recording).values({
          sessionId: input.sessionId,
          kind: input.kind,
          filename: input.filename,
          mimeType: input.mimeType,
          byteSize: artifact.byteSize,
          durationSeconds: input.durationSeconds,
          artifactId: artifact.id,
      }).returning().get()!
    } catch (error) {
      await this.deleteArtifactBestEffort(artifact.id)
      throw error
    }
  }

  async attachVttFromStream(input: AttachVttStreamInput) {
    const artifact = await this.artifactService.createArtifactFromStream({
      ownerId: input.ownerId,
      campaignId: input.campaignId,
      filename: input.filename,
      mimeType: input.mimeType,
      stream: input.stream,
      label: 'Transcript VTT',
      meta: {
        recordingId: input.recordingId,
        kind: 'subtitle',
      },
    })

    try {
      const updated = db.update(recording).set({ vttArtifactId: artifact.id }).where(eq(recording.id, input.recordingId)).returning().get()
      if (!updated) throw new Error('Recording not found')
      return updated
    } catch (error) {
      await this.deleteArtifactBestEffort(artifact.id)
      throw error
    }
  }

  async deleteRecording(recordingId: string) {
    const existing = db.query.recording.findFirst({
      where: eq(recording.id, recordingId),
      columns: { id: true, artifactId: true, vttArtifactId: true },
      with: { transcriptionJobs: { columns: {}, with: { artifacts: { columns: { artifactId: true } } } } },
    }).sync()

    if (!existing) {
      return null
    }

    const relatedArtifactIds = new Set<string>([
      existing.artifactId,
      ...(existing.vttArtifactId ? [existing.vttArtifactId] : []),
      ...existing.transcriptionJobs.flatMap((job) => job.artifacts.map((artifact) => artifact.artifactId)),
    ])

    db.delete(recording).where(eq(recording.id, existing.id)).run()

    for (const artifactId of relatedArtifactIds) {
      await this.deleteArtifactBestEffort(artifactId)
    }

    return existing
  }

  private async deleteArtifactBestEffort(artifactId: string) {
    try {
      await this.artifactService.deleteArtifact(artifactId)
    } catch {
      // Best-effort cleanup to avoid leaking orphan artifacts.
    }
  }
}


