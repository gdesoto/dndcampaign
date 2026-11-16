import { z } from 'zod'
import { db } from '#server/db/client'
import * as tables from '#server/db/schema'
import { and, eq } from 'drizzle-orm'
import { ok, apiError, routeParams } from '#server/utils/http'
import { validateBody } from '#server/utils/validate'
import { TranscriptionService } from '#server/services/transcription.service'
import {
  transcriptionImportSchema,
  transcriptionStartSchema
} from '#shared/schemas/transcription'
import { buildRecordingWhereForPermission } from '#server/utils/campaign-auth'

const transcriptionCreateSchema = z.discriminatedUnion('mode', [
  transcriptionStartSchema.extend({ mode: z.literal('transcribe') }),
  transcriptionImportSchema.extend({ mode: z.literal('import') })
])

export default defineEventHandler(async (event) => {
  const sessionUser = await requireUserSession(event)
  const { recordingId } = routeParams(event, 'recordingId')
  const body = await validateBody(event, transcriptionCreateSchema, 'Invalid transcription request')

  const recording =
    (await db.query.recording.findFirst({
      where: and(
        eq(tables.recording.id, recordingId),
        buildRecordingWhereForPermission(sessionUser.user.id, 'recording.transcribe')
      ),
      with: { artifact: true, session: true }
    })) ?? null
  if (!recording) {
    throw apiError(404, 'NOT_FOUND', 'Recording not found')
  }

  const config = useRuntimeConfig()
  if (!config.elevenlabs?.apiKey) {
    throw apiError(500, 'CONFIG_ERROR', 'ElevenLabs API key is not configured')
  }

  if (body.mode === 'transcribe') {
    const webhookEnabled = Boolean(config.elevenlabs.webhookId)
    const service = new TranscriptionService(
      config.elevenlabs.apiKey,
      config.elevenlabs.webhookId,
      webhookEnabled
    )
    const job = await service.startTranscription({
      recordingId,
      sessionId: recording.sessionId,
      campaignId: recording.session.campaignId,
      storageKey: recording.artifact.storageKey,
      modelId: body.modelId,
      formats: body.formats,
      numSpeakers: body.numSpeakers,
      diarizationThreshold: body.diarizationThreshold,
      keyterms: body.keyterms,
      diarize: body.diarize ?? true,
      tagAudioEvents: body.tagAudioEvents ?? false,
      languageCode: body.languageCode,
      secondaryLanguageCodes: body.secondaryLanguageCodes,
      numbersFormat: body.numbersFormat,
    })

    return ok(job)
  }

  const existing =
    (await db.query.transcriptionJob.findFirst({
      where: eq(tables.transcriptionJob.externalJobId, body.transcriptionId),
      with: { artifacts: true }
    })) ?? null
  if (existing) {
    // externalJobId is unique, so a job on another recording can be neither returned nor re-imported here.
    if (existing.recordingId !== recordingId) {
      throw apiError(409, 'TRANSCRIPTION_EXISTS', 'This transcription is already imported for another recording')
    }
    return ok(existing)
  }

  const job = (
    await db
      .insert(tables.transcriptionJob)
      .values({
        recordingId,
        provider: 'ELEVENLABS',
        status: 'PROCESSING',
        externalJobId: body.transcriptionId,
        requestedFormats: JSON.stringify([]),
        diarize: true
      })
      .returning()
  )[0]!

  const service = new TranscriptionService(config.elevenlabs.apiKey)

  try {
    const updated = await service.fetchTranscriptionByExternalId(
      job.id,
      body.transcriptionId
    )
    return ok(updated)
  } catch (error) {
    await db
      .update(tables.transcriptionJob)
      .set({
        status: 'FAILED',
        errorMessage:
          (error as Error & { message?: string }).message ||
          'Unable to import transcription.'
      })
      .where(eq(tables.transcriptionJob.id, job.id))
    throw error
  }
})
