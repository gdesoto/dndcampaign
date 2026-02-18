import { prisma } from '#server/db/prisma'
import { ok, fail } from '#server/utils/http'
import { buildCampaignWhereForPermission } from '#server/utils/campaign-auth'

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
  const jobId = event.context.params?.jobId
  if (!jobId) {
    return fail(400, 'VALIDATION_ERROR', 'Transcription id is required')
  }

  const job = await prisma.transcriptionJob.findFirst({
    where: {
      id: jobId,
      recording: { session: { campaign: buildCampaignWhereForPermission(sessionUser.user.id, 'content.read') } },
    },
    include: {
      artifacts: { include: { artifact: true } },
    },
  })

  if (!job) {
    return fail(404, 'NOT_FOUND', 'Transcription not found')
  }

  return ok({
    id: job.id,
    status: job.status,
    requestId: job.requestId,
    externalJobId: job.externalJobId,
    modelId: job.modelId,
    languageCode: job.languageCode,
    numSpeakers: job.numSpeakers,
    diarize: job.diarize,
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
  })
})
