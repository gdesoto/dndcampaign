import { ok, fail } from '#server/utils/http'
import { SummarySuggestionService } from '#server/services/summary-suggestion.service'

export default defineEventHandler(async (event) => {
  const sessionUser = await requireUserSession(event)
  const suggestionId = event.context.params?.suggestionId
  if (!suggestionId) {
    return fail(400, 'VALIDATION_ERROR', 'Suggestion id is required')
  }

  const service = new SummarySuggestionService()
  try {
    const result = await service.applySuggestion(sessionUser.user.id, suggestionId)
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
})
