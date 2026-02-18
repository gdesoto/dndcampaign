import { ok, fail } from '#server/utils/http'
import { readValidatedBodySafe } from '#server/utils/validate'
import { summarizeRequestSchema } from '#shared/schemas/summarization'
import { SummaryService } from '#server/services/summary.service'
import { prisma } from '#server/db/prisma'
import { resolveCampaignAccess } from '#server/utils/campaign-auth'

export default defineEventHandler(async (event) => {
  const sessionUser = await requireUserSession(event)
  const documentId = event.context.params?.documentId
  if (!documentId) {
    return fail(400, 'VALIDATION_ERROR', 'Document id is required')
  }

  const parsed = await readValidatedBodySafe(event, summarizeRequestSchema)
  if (!parsed.success) {
    return fail(400, 'VALIDATION_ERROR', 'Invalid summarization payload', parsed.fieldErrors)
  }

  const document = await prisma.document.findUnique({
    where: { id: documentId },
    select: { id: true, campaignId: true, type: true },
  })
  if (!document || document.type !== 'TRANSCRIPT') {
    return fail(404, 'NOT_FOUND', 'Transcript document not found')
  }

  const campaignAccess = await resolveCampaignAccess(
    document.campaignId,
    sessionUser.user.id,
    sessionUser.user.systemRole
  )
  const canRunSummary = campaignAccess.access?.permissions.includes('summary.run')
  if (!canRunSummary) {
    return fail(403, 'FORBIDDEN', 'You do not have permission to run summarization')
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
      500,
      'SUMMARY_FAILED',
      (error as Error & { message?: string }).message || 'Unable to start summarization.'
    )
  }
})
