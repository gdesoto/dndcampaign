import { prisma } from '#server/db/prisma'
import { ArtifactService } from './artifact.service'
import type { RecordingKind } from '#server/db/prisma-client'
import type { Readable } from 'node:stream'

type CreateRecordingInput = {
  ownerId: string
  campaignId: string
  sessionId: string
  filename: string
  mimeType: string
  data: Buffer
  kind: RecordingKind
  durationSeconds?: number
}

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

  async createRecordingFromUpload(input: CreateRecordingInput) {
    const artifact = await this.artifactService.createArtifactFromUpload({
      ownerId: input.ownerId,
      campaignId: input.campaignId,
      filename: input.filename,
      mimeType: input.mimeType,
      data: input.data,
      label: `Recording ${input.kind.toLowerCase()}`,
    })

    try {
      return await prisma.recording.create({
        data: {
          sessionId: input.sessionId,
          kind: input.kind,
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
      return await prisma.recording.create({
        data: {
          sessionId: input.sessionId,
          kind: input.kind,
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
      return await prisma.recording.update({
        where: { id: input.recordingId },
        data: { vttArtifactId: artifact.id },
      })
    } catch (error) {
      await this.deleteArtifactBestEffort(artifact.id)
      throw error
    }
  }

  async deleteRecording(recordingId: string) {
    const recording = await prisma.recording.findUnique({
      where: { id: recordingId },
      select: {
        id: true,
        artifactId: true,
        vttArtifactId: true,
        transcriptionJobs: {
          select: {
            artifacts: {
              select: {
                artifactId: true,
              },
            },
          },
        },
      },
    })

    if (!recording) {
      return null
    }

    const relatedArtifactIds = new Set<string>([
      recording.artifactId,
      ...(recording.vttArtifactId ? [recording.vttArtifactId] : []),
      ...recording.transcriptionJobs.flatMap((job) => job.artifacts.map((artifact) => artifact.artifactId)),
    ])

    await prisma.recording.delete({
      where: { id: recording.id },
    })

    for (const artifactId of relatedArtifactIds) {
      await this.deleteArtifactBestEffort(artifactId)
    }

    return recording
  }

  private async deleteArtifactBestEffort(artifactId: string) {
    try {
      await this.artifactService.deleteArtifact(artifactId)
    } catch {
      // Best-effort cleanup to avoid leaking orphan artifacts.
    }
  }
}


