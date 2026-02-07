import { prisma } from '#server/db/prisma'
import { ok, fail } from '#server/utils/http'
import { readValidatedBodySafe } from '#server/utils/validate'
import { transcriptionStartSchema } from '#shared/schemas/transcription'
import { TranscriptionService } from '#server/services/transcription.service'

export default defineEventHandler(async (event) => {
  const sessionUser = await requireUserSession(event)
  const recordingId = event.context.params?.recordingId
  if (!recordingId) {
    return fail(400, 'VALIDATION_ERROR', 'Recording id is required')
  }

  const validation = await readValidatedBodySafe(event, transcriptionStartSchema)
  if (!validation.success) {
    return fail(400, 'VALIDATION_ERROR', 'Invalid transcription request', validation.fieldErrors)
  }

  const recording = await prisma.recording.findFirst({
    where: { id: recordingId, session: { campaign: { ownerId: sessionUser.user.id } } },
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
    modelId: validation.data.modelId,
    formats: validation.data.formats,
    numSpeakers: validation.data.numSpeakers,
    keyterms: validation.data.keyterms,
    diarize: validation.data.diarize ?? true,
    languageCode: validation.data.languageCode,
  })

  return ok(job)
})
