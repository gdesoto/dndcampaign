import { ok, fail } from '#server/utils/http'
import { SummarySuggestionService } from '#server/services/summary-suggestion.service'
import { readBody } from 'h3'

export default defineEventHandler(async (event) => {
  const sessionUser = await requireUserSession(event)
  const suggestionId = event.context.params?.suggestionId
  if (!suggestionId) {
    return fail(400, 'VALIDATION_ERROR', 'Suggestion id is required')
  }

  const service = new SummarySuggestionService()
  try {
    const body = await readBody<{ payload?: Record<string, unknown> }>(event)
    const payloadOverride =
      body?.payload && typeof body.payload === 'object' && !Array.isArray(body.payload)
        ? body.payload
        : undefined
    const result = await service.applySuggestion(sessionUser.user.id, suggestionId, payloadOverride)
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
