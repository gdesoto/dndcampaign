import { readBody } from 'h3'
import { z } from 'zod'
import { db } from '#server/db/client'
import * as tables from '#server/db/schema'
import { and, eq, inArray } from 'drizzle-orm'
import { ok, apiError, routeParams } from '#server/utils/http'
import { TranscriptionService } from '#server/services/transcription.service'
import {
  transcriptionImportSchema,
  transcriptionStartSchema
} from '#shared/schemas/transcription'
import { buildCampaignWhereForPermission } from '#server/utils/campaign-auth'

const transcriptionCreateSchema = z.discriminatedUnion('mode', [
  transcriptionStartSchema.extend({ mode: z.literal('transcribe') }),
  transcriptionImportSchema.extend({ mode: z.literal('import') })
])

export default defineEventHandler(async (event) => {
  const sessionUser = await requireUserSession(event)
  const { recordingId } = routeParams(event, 'recordingId')

  const rawBody = (await readBody(event)) ?? {}

  let modeParsed = transcriptionCreateSchema.safeParse(rawBody)
  if (!modeParsed.success) {
    // Backwards-compatible body shape support for migration:
    // - old transcribe payload (no mode)
    // - old import payload with transcriptionId
    if (
      typeof rawBody === 'object' &&
      rawBody !== null &&
      'transcriptionId' in rawBody
    ) {
      modeParsed = transcriptionCreateSchema.safeParse({
        ...(rawBody as object),
        mode: 'import'
      })
    } else {
      modeParsed = transcriptionCreateSchema.safeParse({
        ...(rawBody as object),
        mode: 'transcribe'
      })
    }
  }
  if (!modeParsed.success) {
    throw apiError(400, 'VALIDATION_ERROR', 'Invalid transcription request')
  }

  if (modeParsed.data.mode === 'transcribe') {
    const recording =
      (await db.query.recording.findFirst({
        where: and(
          eq(tables.recording.id, recordingId),
          inArray(
            tables.recording.sessionId,
            db
              .select({ id: tables.session.id })
              .from(tables.session)
              .where(
                buildCampaignWhereForPermission(
                  sessionUser.user.id,
                  'recording.transcribe',
                  tables.session.campaignId
                )
              )
          )
        ),
        with: { artifact: true, session: { with: { campaign: true } } }
      })) ?? null
    if (!recording) {
      throw apiError(404, 'NOT_FOUND', 'Recording not found')
    }

    const config = useRuntimeConfig()
    if (!config.elevenlabs?.apiKey) {
      throw apiError(
        500,
        'CONFIG_ERROR',
        'ElevenLabs API key is not configured'
      )
    }

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
      modelId: modeParsed.data.modelId,
      formats: modeParsed.data.formats,
      numSpeakers: modeParsed.data.numSpeakers,
      diarizationThreshold: modeParsed.data.diarizationThreshold,
      keyterms: modeParsed.data.keyterms,
      diarize: modeParsed.data.diarize ?? true,
      tagAudioEvents: modeParsed.data.tagAudioEvents ?? false,
      languageCode: modeParsed.data.languageCode
    })

    return ok(job)
  }

  const recording =
    (await db.query.recording.findFirst({
      where: and(
        eq(tables.recording.id, recordingId),
        inArray(
          tables.recording.sessionId,
          db
            .select({ id: tables.session.id })
            .from(tables.session)
            .where(
              buildCampaignWhereForPermission(
                sessionUser.user.id,
                'recording.transcribe',
                tables.session.campaignId
              )
            )
        )
      ),
      with: { session: true }
    })) ?? null
  if (!recording) {
    throw apiError(404, 'NOT_FOUND', 'Recording not found')
  }

  const existing =
    (await db.query.transcriptionJob.findFirst({
      where: eq(
        tables.transcriptionJob.externalJobId,
        modeParsed.data.transcriptionId
      ),
      with: { artifacts: true }
    })) ?? null
  if (existing) {
    return ok(existing)
  }

  const job = (
    await db
      .insert(tables.transcriptionJob)
      .values({
        recordingId,
        provider: 'ELEVENLABS',
        status: 'PROCESSING',
        externalJobId: modeParsed.data.transcriptionId,
        requestedFormats: JSON.stringify([]),
        diarize: true
      })
      .returning()
  )[0]!

  const config = useRuntimeConfig()
  if (!config.elevenlabs?.apiKey) {
    throw apiError(500, 'CONFIG_ERROR', 'ElevenLabs API key is not configured')
  }

  const service = new TranscriptionService(config.elevenlabs.apiKey)

  try {
    const updated = await service.fetchTranscriptionByExternalId(
      job.id,
      modeParsed.data.transcriptionId
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
