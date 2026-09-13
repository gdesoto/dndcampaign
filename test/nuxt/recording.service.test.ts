import { afterEach, describe, expect, it, vi } from 'vitest'
import { Readable } from 'node:stream'
import { prisma } from '#server/db/prisma'
import { ArtifactService } from '#server/services/artifact.service'
import { RecordingService } from '#server/services/recording.service'

const prismaMock = vi.hoisted(() => ({
  recording: {
    create: vi.fn(),
  },
}))

vi.mock('#server/db/prisma', () => ({ prisma: prismaMock }))

describe('RecordingService', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('cleans up the created artifact when recording-row persistence fails', async () => {
    const artifact = { id: 'artifact-1', byteSize: 12 }
    const rowFailure = new Error('recording row failed')
    const createArtifact = vi.spyOn(ArtifactService.prototype, 'createArtifactFromStream').mockResolvedValue(artifact as never)
    const deleteArtifact = vi.spyOn(ArtifactService.prototype, 'deleteArtifact').mockResolvedValue(null)
    const createRecording = vi.mocked(prisma.recording.create).mockRejectedValue(rowFailure)

    await expect(new RecordingService().createRecordingFromStream({
      ownerId: 'owner-1',
      campaignId: 'campaign-1',
      sessionId: 'session-1',
      filename: 'recording.mp3',
      mimeType: 'audio/mpeg',
      stream: Readable.from(['recording bytes']),
      kind: 'AUDIO',
    })).rejects.toBe(rowFailure)

    expect(createArtifact).toHaveBeenCalledWith(expect.objectContaining({
      ownerId: 'owner-1',
      campaignId: 'campaign-1',
      filename: 'recording.mp3',
      mimeType: 'audio/mpeg',
      label: 'Recording audio',
    }))
    expect(createRecording).toHaveBeenCalledWith({
      data: expect.objectContaining({
        sessionId: 'session-1',
        artifactId: 'artifact-1',
        byteSize: 12,
      }),
    })
    expect(deleteArtifact).toHaveBeenCalledWith('artifact-1')
  })

  it('preserves the recording-row error when cleanup also fails', async () => {
    const rowFailure = new Error('recording row failed')
    vi.spyOn(ArtifactService.prototype, 'createArtifactFromStream').mockResolvedValue({ id: 'artifact-1', byteSize: 12 } as never)
    vi.spyOn(ArtifactService.prototype, 'deleteArtifact').mockRejectedValue(new Error('cleanup failed'))
    vi.mocked(prisma.recording.create).mockRejectedValue(rowFailure)

    await expect(new RecordingService().createRecordingFromStream({
      ownerId: 'owner-1',
      campaignId: 'campaign-1',
      sessionId: 'session-1',
      filename: 'recording.mp3',
      mimeType: 'audio/mpeg',
      stream: Readable.from(['recording bytes']),
      kind: 'AUDIO',
    })).rejects.toBe(rowFailure)
  })
})
