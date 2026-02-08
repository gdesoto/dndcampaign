import { ok, fail } from '#server/utils/http'
import { SummaryService } from '#server/services/summary.service'

export default defineEventHandler(async (event) => {
  const sessionUser = await requireUserSession(event)
  const jobId = event.context.params?.jobId
  if (!jobId) {
    return fail(400, 'VALIDATION_ERROR', 'Summary job id is required')
  }

  const service = new SummaryService()
  try {
    const updated = await service.applySummaryFromJob(jobId, sessionUser.user.id)
    if (!updated) {
      return fail(404, 'NOT_FOUND', 'Summary job not found')
    }
    return ok(updated)
  } catch (error) {
    return fail(
      400,
      'SUMMARY_APPLY_FAILED',
      (error as Error & { message?: string }).message || 'Unable to apply summary.'
    )
  }
})
