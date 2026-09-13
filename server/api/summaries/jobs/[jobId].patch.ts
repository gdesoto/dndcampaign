import { readBody, isError } from 'h3'
import { z } from 'zod'
import { ok, apiError, routeParams } from '#server/utils/http'
import { SummaryService } from '#server/services/summary.service'
import { prisma } from '#server/db/prisma'
import { resolveCampaignAccess } from '#server/utils/campaign-auth'

const summaryJobPatchSchema = z.object({
  action: z.literal('apply'),
})

export default defineEventHandler(async (event) => {
  const sessionUser = await requireUserSession(event)
  const { jobId } = routeParams(event, 'jobId')

  const body = (await readBody(event)) ?? {}
  const parsed = summaryJobPatchSchema.safeParse(body)
  if (!parsed.success) {
    throw apiError(400, 'VALIDATION_ERROR', 'Invalid summary action')
  }

  const job = await prisma.summaryJob.findUnique({
    where: { id: jobId },
    select: { id: true, campaignId: true },
  })
  if (!job) {
    throw apiError(404, 'NOT_FOUND', 'Summary job not found')
  }

  const access = await resolveCampaignAccess(job.campaignId, sessionUser.user.id, sessionUser.user.systemRole)
  if (!access.access?.permissions.includes('summary.run')) {
    throw apiError(403, 'FORBIDDEN', 'You do not have permission to apply summaries')
  }

  const service = new SummaryService()
  try {
    const updated = await service.applySummaryFromJob(jobId, sessionUser.user.id)
    if (!updated) {
      throw apiError(404, 'NOT_FOUND', 'Summary job not found')
    }
    return ok(updated)
  } catch (error) {
    if (isError(error)) throw error
    throw apiError(400,
      'SUMMARY_APPLY_FAILED',
      (error as Error & { message?: string }).message || 'Unable to apply summary.'
    )
  }
})
