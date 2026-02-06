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

  if (!job) {
    return ok({ job: null, suggestions: [] })
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
  })
})
