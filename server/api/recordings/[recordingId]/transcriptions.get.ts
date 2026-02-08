import { prisma } from '#server/db/prisma'
import { ok, fail } from '#server/utils/http'

const parseJsonArray = (value: string | null) => {
  if (!value) return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export default defineEventHandler(async (event) => {
  const sessionUser = await requireUserSession(event)
  const recordingId = event.context.params?.recordingId
  if (!recordingId) {
    return fail(400, 'VALIDATION_ERROR', 'Recording id is required')
  }

  const jobs = await prisma.transcriptionJob.findMany({
    where: {
      recordingId,
      recording: { session: { campaign: { ownerId: sessionUser.user.id } } },
    },
    include: {
      artifacts: {
        include: { artifact: true },
        orderBy: { createdAt: 'asc' },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  return ok(
    jobs.map((job) => ({
      id: job.id,
      status: job.status,
      requestId: job.requestId,
      externalJobId: job.externalJobId,
      modelId: job.modelId,
      languageCode: job.languageCode,
      numSpeakers: job.numSpeakers,
      diarize: job.diarize,
      tagAudioEvents: job.tagAudioEvents,
      requestedFormats: parseJsonArray(job.requestedFormats),
      keyterms: parseJsonArray(job.keyterms),
      errorMessage: job.errorMessage,
      completedAt: job.completedAt,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      artifacts: job.artifacts.map((entry) => ({
        id: entry.id,
        format: entry.format,
        artifact: {
          id: entry.artifact.id,
          storageKey: entry.artifact.storageKey,
          mimeType: entry.artifact.mimeType,
          byteSize: entry.artifact.byteSize,
          createdAt: entry.artifact.createdAt,
        },
      })),
    }))
  )
})
