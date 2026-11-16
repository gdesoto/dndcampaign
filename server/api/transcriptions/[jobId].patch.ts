import { readBody } from 'h3'
import { z } from 'zod'
import { db } from '#server/db/client'
import * as tables from '#server/db/schema'
import { and, eq } from 'drizzle-orm'
import { TranscriptionService } from '#server/services/transcription.service'
import { ok, apiError, routeParams } from '#server/utils/http'
import {
  transcriptionApplySchema,
  transcriptionAttachVttSchema
} from '#shared/schemas/transcription'
import { buildRecordingWhereForPermission } from '#server/utils/campaign-auth'

const transcriptionActionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('fetch') }),
  transcriptionApplySchema.extend({ action: z.literal('apply-transcript') }),
  transcriptionAttachVttSchema.extend({ action: z.literal('attach-vtt') })
])

export default defineEventHandler(async (event) => {
  const sessionUser = await requireUserSession(event)
  const { jobId } = routeParams(event, 'jobId')

  const rawBody = (await readBody(event)) ?? {}
  const parsed = transcriptionActionSchema.safeParse(rawBody)
  if (!parsed.success) {
    throw apiError(400, 'VALIDATION_ERROR', 'Invalid request')
  }

  const job =
    (await db.query.transcriptionJob.findFirst({
      where: and(
        eq(tables.transcriptionJob.id, jobId),
        buildRecordingWhereForPermission(
          sessionUser.user.id,
          parsed.data.action === 'fetch' ? 'recording.transcribe' : 'document.edit',
          tables.transcriptionJob.recordingId
        )
      ),
      with: {
        recording: { with: { session: true } },
        artifacts: { with: { artifact: true } }
      }
    })) ?? null

  if (!job) {
    throw apiError(404, 'NOT_FOUND', 'Transcription not found')
  }

  if (parsed.data.action === 'fetch') {
    if (!job.externalJobId) {
      throw apiError(
        400,
        'VALIDATION_ERROR',
        'Transcription job is missing an external id'
      )
    }

    const config = useRuntimeConfig()
    if (!config.elevenlabs?.apiKey) {
      throw apiError(
        500,
        'CONFIG_ERROR',
        'ElevenLabs API key is not configured'
      )
    }

    const service = new TranscriptionService(config.elevenlabs.apiKey)
    const updated = await service.fetchTranscription(job.id)
    if (!updated) {
      throw apiError(404, 'NOT_FOUND', 'Unable to fetch transcription')
    }

    return ok(updated)
  }

  if (parsed.data.action === 'apply-transcript') {
    const updated = await TranscriptionService.applyTranscript({
      job,
      artifactId: parsed.data.artifactId,
      createdByUserId: sessionUser.user.id
    })

    return ok(updated)
  }

  const targetRecordingId = parsed.data.recordingId || job.recordingId
  const targetRecording =
    (await db.query.recording.findFirst({
      // Same session as the job, which was already checked for document.edit.
      where: and(
        eq(tables.recording.id, targetRecordingId),
        eq(tables.recording.sessionId, job.recording.sessionId)
      ),
      with: { session: true }
    })) ?? null

  if (!targetRecording) {
    throw apiError(404, 'NOT_FOUND', 'Recording not found')
  }

  const updated = await TranscriptionService.attachSubtitles({
    job,
    artifactId: parsed.data.artifactId,
    targetRecording,
    ownerId: sessionUser.user.id
  })

  return ok(updated)
})
