import { prisma } from '#server/db/prisma'
import { ok, fail } from '#server/utils/http'
import { SummaryService } from '#server/services/summary.service'

export default defineEventHandler(async (event) => {
  const sessionUser = await requireUserSession(event)
  const sessionId = event.context.params?.sessionId
  if (!sessionId) {
    return fail(400, 'VALIDATION_ERROR', 'Session id is required')
  }

  const service = new SummaryService()
  const job = await service.getLatestJobForSession(sessionId, sessionUser.user.id)

  const jobs = await prisma.summaryJob.findMany({
    where: { sessionId, campaign: { ownerId: sessionUser.user.id } },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      status: true,
      mode: true,
      trackingId: true,
      summaryDocumentId: true,
      createdAt: true,
      updatedAt: true,
    },
  })

  if (!job) {
    return ok({ job: null, suggestions: [], jobs })
  }

  return ok({
    job: {
      id: job.id,
      status: job.status,
      mode: job.mode,
      trackingId: job.trackingId,
      promptProfile: job.promptProfile,
      summaryDocumentId: job.summaryDocumentId,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      meta: job.meta,
    },
    suggestions: job.suggestions.map((suggestion) => ({
      id: suggestion.id,
      entityType: suggestion.entityType,
      action: suggestion.action,
      status: suggestion.status,
      match: suggestion.match,
      payload: suggestion.payload,
    })),
    jobs,
  })
})
