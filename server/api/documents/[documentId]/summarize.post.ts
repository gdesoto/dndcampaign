import { ok, fail } from '#server/utils/http'
import { validateBody } from '#server/utils/validate'
import { summarizeRequestSchema } from '#shared/schemas/summarization'
import { SummaryService } from '#server/services/summary.service'
import { prisma } from '#server/db/prisma'
import { resolveCampaignAccess } from '#server/utils/campaign-auth'

export default defineEventHandler(async (event) => {
  const sessionUser = await requireUserSession(event)
  const documentId = event.context.params?.documentId
  if (!documentId) {
    return fail(event, 400, 'VALIDATION_ERROR', 'Document id is required')
  }

  const parsed = await validateBody(event, summarizeRequestSchema, 'Invalid summarization payload')
  if (!parsed.ok) return parsed.response

  const document = await prisma.document.findUnique({
    where: { id: documentId },
    select: { id: true, campaignId: true, type: true },
  })
  if (!document || document.type !== 'TRANSCRIPT') {
    return fail(event, 404, 'NOT_FOUND', 'Transcript document not found')
  }

  const campaignAccess = await resolveCampaignAccess(
    document.campaignId,
    sessionUser.user.id,
    sessionUser.user.systemRole
  )
  const canRunSummary = campaignAccess.access?.permissions.includes('summary.run')
  if (!canRunSummary) {
    return fail(event, 403, 'FORBIDDEN', 'You do not have permission to run summarization')
  }

  const service = new SummaryService()

  try {
    const result = await service.startSummarization({
      documentId,
      userId: sessionUser.user.id,
      webhookUrlOverride: parsed.data.webhookUrlOverride,
      promptProfile: parsed.data.promptProfile,
      mode: parsed.data.mode,
    })

    return ok(result)
  } catch (error) {
    return fail(
      event, 500,
      'SUMMARY_FAILED',
      (error as Error & { message?: string }).message || 'Unable to start summarization.'
    )
  }
})
