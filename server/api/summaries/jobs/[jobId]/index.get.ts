import { ok, fail } from '#server/utils/http'
import { SummaryService } from '#server/services/summary.service'

export default defineEventHandler(async (event) => {
  const sessionUser = await requireUserSession(event)
  const jobId = event.context.params?.jobId
  if (!jobId) {
    return fail(400, 'VALIDATION_ERROR', 'Summary job id is required')
  }

  const service = new SummaryService()
  const job = await service.getJobById(jobId, sessionUser.user.id)
  if (!job) {
    return fail(404, 'NOT_FOUND', 'Summary job not found')
  }

  return ok({
    id: job.id,
    status: job.status,
    mode: job.mode,
    kind: job.kind,
    trackingId: job.trackingId,
    promptProfile: job.promptProfile,
    summaryDocumentId: job.summaryDocumentId,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    meta: job.meta,
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
