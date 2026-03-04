import { readBody } from 'h3'
import { z } from 'zod'
import { prisma } from '#server/db/prisma'
import { ok, fail } from '#server/utils/http'
import { TranscriptionService } from '#server/services/transcription.service'
import { transcriptionImportSchema, transcriptionStartSchema } from '#shared/schemas/transcription'
import { buildCampaignWhereForPermission } from '#server/utils/campaign-auth'

const transcriptionCreateSchema = z.discriminatedUnion('mode', [
  transcriptionStartSchema.extend({ mode: z.literal('transcribe') }),
  transcriptionImportSchema.extend({ mode: z.literal('import') }),
])

export default defineEventHandler(async (event) => {
  const sessionUser = await requireUserSession(event)
  const recordingId = event.context.params?.recordingId
  if (!recordingId) {
    return fail(400, 'VALIDATION_ERROR', 'Recording id is required')
  }

  const rawBody = (await readBody(event)) ?? {}

  let modeParsed = transcriptionCreateSchema.safeParse(rawBody)
  if (!modeParsed.success) {
    // Backwards-compatible body shape support for migration:
    // - old transcribe payload (no mode)
    // - old import payload with transcriptionId
    if (typeof rawBody === 'object' && rawBody !== null && 'transcriptionId' in rawBody) {
      modeParsed = transcriptionCreateSchema.safeParse({ ...(rawBody as object), mode: 'import' })
    } else {
      modeParsed = transcriptionCreateSchema.safeParse({ ...(rawBody as object), mode: 'transcribe' })
    }
  }
  if (!modeParsed.success) {
    return fail(400, 'VALIDATION_ERROR', 'Invalid transcription request')
  }

  if (modeParsed.data.mode === 'transcribe') {
    const recording = await prisma.recording.findFirst({
      where: {
        id: recordingId,
        session: { campaign: buildCampaignWhereForPermission(sessionUser.user.id, 'recording.transcribe') },
      },
      include: {
        artifact: true,
        session: { include: { campaign: true } },
      },
    })
    if (!recording) {
      return fail(404, 'NOT_FOUND', 'Recording not found')
    }

    const config = useRuntimeConfig()
    if (!config.elevenlabs?.apiKey) {
      return fail(500, 'CONFIG_ERROR', 'ElevenLabs API key is not configured')
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
      languageCode: modeParsed.data.languageCode,
    })

    return ok(job)
  }

  const recording = await prisma.recording.findFirst({
    where: {
      id: recordingId,
      session: { campaign: buildCampaignWhereForPermission(sessionUser.user.id, 'recording.transcribe') },
    },
    include: { session: true },
  })
  if (!recording) {
    return fail(404, 'NOT_FOUND', 'Recording not found')
  }

  const existing = await prisma.transcriptionJob.findFirst({
    where: { externalJobId: modeParsed.data.transcriptionId },
    include: { artifacts: true },
  })
  if (existing) {
    return ok(existing)
  }

  const job = await prisma.transcriptionJob.create({
    data: {
      recordingId,
      provider: 'ELEVENLABS',
      status: 'PROCESSING',
      externalJobId: modeParsed.data.transcriptionId,
      requestedFormats: JSON.stringify([]),
      diarize: true,
    },
  })

  const config = useRuntimeConfig()
  if (!config.elevenlabs?.apiKey) {
    return fail(500, 'CONFIG_ERROR', 'ElevenLabs API key is not configured')
  }

  const service = new TranscriptionService(config.elevenlabs.apiKey)

  try {
    const updated = await service.fetchTranscriptionByExternalId(
      job.id,
      modeParsed.data.transcriptionId
    )
    return ok(updated)
  } catch (error) {
    await prisma.transcriptionJob.update({
      where: { id: job.id },
      data: {
        status: 'FAILED',
        errorMessage:
          (error as Error & { message?: string }).message || 'Unable to import transcription.',
      },
    })
    throw error
  }
})
