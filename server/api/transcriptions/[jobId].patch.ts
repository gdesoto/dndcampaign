import { Readable } from 'node:stream'
import { readBody } from 'h3'
import { z } from 'zod'
import { prisma } from '#server/db/prisma'
import { DocumentService } from '#server/services/document.service'
import { RecordingService } from '#server/services/recording.service'
import { TranscriptionService } from '#server/services/transcription.service'
import { getStorageAdapter } from '#server/services/storage/storage.factory'
import { ok, apiError, routeParams } from '#server/utils/http'
import { transcriptionApplySchema, transcriptionAttachVttSchema } from '#shared/schemas/transcription'
import { toVtt } from '#shared/utils/transcript'
import { streamToBuffer } from '#server/utils/multipart'
import { buildCampaignWhereForPermission } from '#server/utils/campaign-auth'

const transcriptionActionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('fetch') }),
  transcriptionApplySchema.extend({ action: z.literal('apply-transcript') }),
  transcriptionAttachVttSchema.extend({ action: z.literal('attach-vtt') }),
])

export default defineEventHandler(async (event) => {
  const sessionUser = await requireUserSession(event)
  const { jobId } = routeParams(event, 'jobId')

  const rawBody = (await readBody(event)) ?? {}
  const parsed = transcriptionActionSchema.safeParse(rawBody)
  if (!parsed.success) {
    throw apiError(400, 'VALIDATION_ERROR', 'Invalid request')
  }

  if (parsed.data.action === 'fetch') {
    const job = await prisma.transcriptionJob.findFirst({
      where: {
        id: jobId,
        recording: { session: { campaign: buildCampaignWhereForPermission(sessionUser.user.id, 'recording.transcribe') } },
      },
    })

    if (!job) {
      throw apiError(404, 'NOT_FOUND', 'Transcription not found')
    }

    if (!job.externalJobId) {
      throw apiError(400, 'VALIDATION_ERROR', 'Transcription job is missing an external id')
    }

    const config = useRuntimeConfig()
    if (!config.elevenlabs?.apiKey) {
      throw apiError(500, 'CONFIG_ERROR', 'ElevenLabs API key is not configured')
    }

    const service = new TranscriptionService(config.elevenlabs.apiKey)
    const updated = await service.fetchTranscription(job.id)
    if (!updated) {
      throw apiError(404, 'NOT_FOUND', 'Unable to fetch transcription')
    }

    return ok(updated)
  }

  if (parsed.data.action === 'apply-transcript') {
    const job = await prisma.transcriptionJob.findFirst({
      where: {
        id: jobId,
        recording: { session: { campaign: buildCampaignWhereForPermission(sessionUser.user.id, 'document.edit') } },
      },
      include: {
        recording: { include: { session: true } },
        artifacts: { include: { artifact: true } },
      },
    })

    if (!job) {
      throw apiError(404, 'NOT_FOUND', 'Transcription not found')
    }

    const artifactId = 'artifactId' in parsed.data ? parsed.data.artifactId : undefined
    const selected = artifactId
      ? job.artifacts.find((entry) => entry.artifactId === artifactId)
      : job.artifacts.find((entry) => entry.format === 'TXT')

    if (!selected) {
      throw apiError(404, 'NOT_FOUND', 'Transcript artifact not found')
    }

    const adapter = getStorageAdapter()
    const { stream } = await adapter.getObject(selected.artifact.storageKey)
    const buffer = await streamToBuffer(stream)
    const content = buffer.toString('utf-8')

    const service = new DocumentService()
    const existing = await prisma.document.findFirst({
      where: { sessionId: job.recording.sessionId, type: 'TRANSCRIPT' },
    })

    const titleBase = job.recording.session?.title
      ? `Transcript: ${job.recording.session.title}`
      : 'Transcript'

    const updated = existing
      ? await service.updateDocument({
          documentId: existing.id,
          content,
          format: 'PLAINTEXT',
          source: 'ELEVENLABS_IMPORT',
          createdByUserId: sessionUser.user.id,
        })
      : await service.createDocument({
          campaignId: job.recording.session.campaignId,
          sessionId: job.recording.sessionId,
          recordingId: job.recordingId,
          type: 'TRANSCRIPT',
          title: titleBase,
          content,
          format: 'PLAINTEXT',
          source: 'ELEVENLABS_IMPORT',
          createdByUserId: sessionUser.user.id,
        })

    if (existing && existing.recordingId !== job.recordingId) {
      await prisma.document.update({
        where: { id: existing.id },
        data: { recordingId: job.recordingId },
      })
    }

    return ok(updated)
  }

  if (parsed.data.action !== 'attach-vtt') {
    throw apiError(400, 'VALIDATION_ERROR', 'Invalid request')
  }

  const job = await prisma.transcriptionJob.findFirst({
    where: {
      id: jobId,
      recording: { session: { campaign: buildCampaignWhereForPermission(sessionUser.user.id, 'document.edit') } },
    },
    include: {
      recording: { include: { session: { include: { campaign: true } } } },
      artifacts: { include: { artifact: true } },
    },
  })

  if (!job) {
    throw apiError(404, 'NOT_FOUND', 'Transcription not found')
  }

  const targetRecordingId = parsed.data.recordingId || job.recordingId
  const targetRecording = await prisma.recording.findFirst({
    where: {
      id: targetRecordingId,
      sessionId: job.recording.sessionId,
      session: { campaign: buildCampaignWhereForPermission(sessionUser.user.id, 'document.edit') },
    },
    include: { session: { include: { campaign: true } } },
  })

  if (!targetRecording) {
    throw apiError(404, 'NOT_FOUND', 'Recording not found')
  }

  if (targetRecording.kind !== 'VIDEO') {
    throw apiError(400, 'VALIDATION_ERROR', 'Subtitles can only be attached to video recordings')
  }

  const artifactId = 'artifactId' in parsed.data ? parsed.data.artifactId : undefined
  const selected = artifactId ? job.artifacts.find((entry) => entry.artifactId === artifactId) : null
  if (!selected || selected.format !== 'SRT') {
    throw apiError(404, 'NOT_FOUND', 'Subtitle artifact not found')
  }

  const adapter = getStorageAdapter()
  const { stream } = await adapter.getObject(selected.artifact.storageKey)
  const buffer = await streamToBuffer(stream)
  const content = buffer.toString('utf-8')
  const vttContent = toVtt(content)

  const service = new RecordingService()
  const updated = await service.attachVttFromStream({
    ownerId: sessionUser.user.id,
    campaignId: targetRecording.session.campaignId,
    recordingId: targetRecording.id,
    filename: 'subtitles.vtt',
    mimeType: 'text/vtt',
    stream: Readable.from(vttContent),
  })

  return ok(updated)
})
