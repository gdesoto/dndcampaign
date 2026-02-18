import { ok, fail } from '#server/utils/http'
import { SummarySuggestionService } from '#server/services/summary-suggestion.service'
import { prisma } from '#server/db/prisma'
import { resolveCampaignAccess } from '#server/utils/campaign-auth'

export default defineEventHandler(async (event) => {
  const sessionUser = await requireUserSession(event)
  const suggestionId = event.context.params?.suggestionId
  if (!suggestionId) {
    return fail(400, 'VALIDATION_ERROR', 'Suggestion id is required')
  }

  const suggestion = await prisma.summarySuggestion.findUnique({
    where: { id: suggestionId },
    select: { id: true, summaryJob: { select: { campaignId: true } } },
  })
  if (!suggestion) {
    return fail(404, 'NOT_FOUND', 'Suggestion not found')
  }

  const access = await resolveCampaignAccess(
    suggestion.summaryJob.campaignId,
    sessionUser.user.id,
    sessionUser.user.systemRole
  )
  if (!access.access?.permissions.includes('summary.run')) {
    return fail(403, 'FORBIDDEN', 'You do not have permission to discard suggestions')
  }

  const service = new SummarySuggestionService()
  const result = await service.discardSuggestion(sessionUser.user.id, suggestionId)
  if (!result) {
    return fail(404, 'NOT_FOUND', 'Suggestion not found')
  }

  return ok(result)
})
