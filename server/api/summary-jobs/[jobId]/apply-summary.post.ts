import { ok, fail } from '#server/utils/http'
import { SummaryService } from '#server/services/summary.service'
import { prisma } from '#server/db/prisma'
import { resolveCampaignAccess } from '#server/utils/campaign-auth'

export default defineEventHandler(async (event) => {
  const sessionUser = await requireUserSession(event)
  const jobId = event.context.params?.jobId
  if (!jobId) {
    return fail(400, 'VALIDATION_ERROR', 'Summary job id is required')
  }

  const job = await prisma.summaryJob.findUnique({
    where: { id: jobId },
    select: { id: true, campaignId: true },
  })
  if (!job) {
    return fail(404, 'NOT_FOUND', 'Summary job not found')
  }

  const access = await resolveCampaignAccess(job.campaignId, sessionUser.user.id, sessionUser.user.systemRole)
  if (!access.access?.permissions.includes('summary.run')) {
    return fail(403, 'FORBIDDEN', 'You do not have permission to apply summaries')
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
