import { isError } from 'h3'
import { ok, apiError, routeParams } from '#server/utils/http'
import { validateBody } from '#server/utils/validate'
import { summarizeRequestSchema } from '#shared/schemas/summarization'
import { SummaryService } from '#server/services/summary.service'
import { prisma } from '#server/db/prisma'
import { resolveCampaignAccess } from '#server/utils/campaign-auth'

export default defineEventHandler(async (event) => {
  const sessionUser = await requireUserSession(event)
  const { documentId } = routeParams(event, 'documentId')

  const parsed = await validateBody(event, summarizeRequestSchema, 'Invalid summarization payload')

  const document = await prisma.document.findUnique({
    where: { id: documentId },
    select: { id: true, campaignId: true, type: true },
  })
  if (!document || document.type !== 'TRANSCRIPT') {
    throw apiError(404, 'NOT_FOUND', 'Transcript document not found')
  }

  const campaignAccess = await resolveCampaignAccess(
    document.campaignId,
    sessionUser.user.id,
    sessionUser.user.systemRole
  )
  const canRunSummary = campaignAccess.access?.permissions.includes('summary.run')
  if (!canRunSummary) {
    throw apiError(403, 'FORBIDDEN', 'You do not have permission to run summarization')
  }

  const service = new SummaryService()

  try {
    const result = await service.startSummarization({
      documentId,
      userId: sessionUser.user.id,
      webhookUrlOverride: parsed.webhookUrlOverride,
      promptProfile: parsed.promptProfile,
      mode: parsed.mode,
    })

    return ok(result)
  } catch (error) {
    if (isError(error)) throw error
    throw apiError(500,
      'SUMMARY_FAILED',
      (error as Error & { message?: string }).message || 'Unable to start summarization.'
    )
  }
})
