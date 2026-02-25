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

    return prisma.recording.create({
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

    return prisma.recording.create({
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

    return prisma.recording.update({
      where: { id: input.recordingId },
      data: { vttArtifactId: artifact.id },
    })
  }
}


