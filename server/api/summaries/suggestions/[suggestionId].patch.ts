import { readBody } from 'h3'
import { z } from 'zod'
import { ok, fail } from '#server/utils/http'
import { SummarySuggestionService } from '#server/services/summary-suggestion.service'
import { prisma } from '#server/db/prisma'
import { resolveCampaignAccess } from '#server/utils/campaign-auth'

const summarySuggestionPatchSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('apply'),
    payload: z.record(z.string(), z.unknown()).optional(),
  }),
  z.object({
    action: z.literal('discard'),
  }),
])

export default defineEventHandler(async (event) => {
  const sessionUser = await requireUserSession(event)
  const suggestionId = event.context.params?.suggestionId
  if (!suggestionId) {
    return fail(400, 'VALIDATION_ERROR', 'Suggestion id is required')
  }

  const body = (await readBody(event)) ?? {}
  const parsed = summarySuggestionPatchSchema.safeParse(body)
  if (!parsed.success) {
    return fail(400, 'VALIDATION_ERROR', 'Invalid suggestion action')
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
    return fail(403, 'FORBIDDEN', 'You do not have permission to modify suggestions')
  }

  const service = new SummarySuggestionService()

  if (parsed.data.action === 'apply') {
    try {
      const result = await service.applySuggestion(sessionUser.user.id, suggestionId, parsed.data.payload)
      if (!result) {
        return fail(404, 'NOT_FOUND', 'Suggestion not found')
      }
      return ok(result)
    } catch (error) {
      return fail(
        400,
        'SUGGESTION_APPLY_FAILED',
        (error as Error & { message?: string }).message || 'Unable to apply suggestion.'
      )
    }
  }

  const result = await service.discardSuggestion(sessionUser.user.id, suggestionId)
  if (!result) {
    return fail(404, 'NOT_FOUND', 'Suggestion not found')
  }

  return ok(result)
})
