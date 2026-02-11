import { prisma } from '#server/db/prisma'
import { ok, fail } from '#server/utils/http'
import { readValidatedBodySafe } from '#server/utils/validate'
import { TranscriptionService } from '#server/services/transcription.service'
import { transcriptionImportSchema } from '#shared/schemas/transcription'

export default defineEventHandler(async (event) => {
  const sessionUser = await requireUserSession(event)
  const recordingId = event.context.params?.recordingId
  if (!recordingId) {
    return fail(400, 'VALIDATION_ERROR', 'Recording id is required')
  }

  const validation = await readValidatedBodySafe(event, transcriptionImportSchema)
  if (!validation.success) {
    return fail(400, 'VALIDATION_ERROR', 'Invalid request', validation.fieldErrors)
  }

  const recording = await prisma.recording.findFirst({
    where: {
      id: recordingId,
      session: { campaign: { ownerId: sessionUser.user.id } },
    },
    include: { session: true },
  })
  if (!recording) {
    return fail(404, 'NOT_FOUND', 'Recording not found')
  }

  const existing = await prisma.transcriptionJob.findFirst({
    where: { externalJobId: validation.data.transcriptionId },
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
      externalJobId: validation.data.transcriptionId,
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
      validation.data.transcriptionId
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
