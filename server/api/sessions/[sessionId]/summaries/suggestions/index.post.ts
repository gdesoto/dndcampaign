import { ok, fail } from '#server/utils/http'
import { validateBody } from '#server/utils/validate'
import { generateSuggestionsRequestSchema } from '#shared/schemas/summarization'
import { SummaryService } from '#server/services/summary.service'

export default defineEventHandler(async (event) => {
  const sessionUser = await requireUserSession(event)
  const sessionId = event.context.params?.sessionId
  if (!sessionId) {
    return fail(event, 400, 'VALIDATION_ERROR', 'Session id is required')
  }

  const parsed = await validateBody(event, generateSuggestionsRequestSchema, 'Invalid suggestion generation payload')
  if (!parsed.ok) return parsed.response

  const service = new SummaryService()
  try {
    const result = await service.startSuggestionGeneration({
      sessionId,
      userId: sessionUser.user.id,
      summaryJobId: parsed.data.summaryJobId,
      summaryDocumentId: parsed.data.summaryDocumentId,
      webhookUrlOverride: parsed.data.webhookUrlOverride,
      promptProfile: parsed.data.promptProfile,
      mode: parsed.data.mode,
    })
    return ok(result)
  } catch (error) {
    return fail(
      event, 500,
      'SUGGESTION_GENERATION_FAILED',
      (error as Error & { message?: string }).message || 'Unable to generate suggestions.'
    )
  }
})
