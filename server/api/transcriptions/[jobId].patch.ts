import { readBody } from 'h3'
import { z } from 'zod'
import { prisma } from '#server/db/prisma'
import { TranscriptionService } from '#server/services/transcription.service'
import { ok, apiError, routeParams } from '#server/utils/http'
import { transcriptionApplySchema, transcriptionAttachVttSchema } from '#shared/schemas/transcription'
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

    const updated = await TranscriptionService.applyTranscript({
      job,
      artifactId: parsed.data.artifactId,
      createdByUserId: sessionUser.user.id,
    })

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
      recording: { include: { session: true } },
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
    include: { session: true },
  })

  if (!targetRecording) {
    throw apiError(404, 'NOT_FOUND', 'Recording not found')
  }

  const updated = await TranscriptionService.attachSubtitles({
    job,
    artifactId: parsed.data.artifactId,
    targetRecording,
    ownerId: sessionUser.user.id,
  })

  return ok(updated)
})
