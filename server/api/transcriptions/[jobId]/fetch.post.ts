import { prisma } from '#server/db/prisma'
import { ok, fail } from '#server/utils/http'
import { TranscriptionService } from '#server/services/transcription.service'

export default defineEventHandler(async (event) => {
  const sessionUser = await requireUserSession(event)
  const jobId = event.context.params?.jobId
  if (!jobId) {
    return fail(400, 'VALIDATION_ERROR', 'Transcription id is required')
  }

  const job = await prisma.transcriptionJob.findFirst({
    where: {
      id: jobId,
      recording: { session: { campaign: { ownerId: sessionUser.user.id } } },
    },
  })

  if (!job) {
    return fail(404, 'NOT_FOUND', 'Transcription not found')
  }

  if (!job.externalJobId) {
    return fail(400, 'VALIDATION_ERROR', 'Transcription job is missing an external id')
  }

  const config = useRuntimeConfig()
  if (!config.elevenlabs?.apiKey) {
    return fail(500, 'CONFIG_ERROR', 'ElevenLabs API key is not configured')
  }

  const service = new TranscriptionService(config.elevenlabs.apiKey)
  const updated = await service.fetchTranscription(job.id)
  if (!updated) {
    return fail(404, 'NOT_FOUND', 'Unable to fetch transcription')
  }

  return ok(updated)
})
