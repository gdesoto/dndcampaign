import { isError } from 'h3'
import { ok, apiError, routeParams } from '#server/utils/http'
import { validateBody } from '#server/utils/validate'
import { generateSuggestionsRequestSchema } from '#shared/schemas/summarization'
import { SummaryService } from '#server/services/summary.service'

export default defineEventHandler(async (event) => {
  const sessionUser = await requireUserSession(event)
  const { sessionId } = routeParams(event, 'sessionId')

  const parsed = await validateBody(event, generateSuggestionsRequestSchema, 'Invalid suggestion generation payload')

  const service = new SummaryService()
  try {
    const result = await service.startSuggestionGeneration({
      sessionId,
      userId: sessionUser.user.id,
      summaryJobId: parsed.summaryJobId,
      summaryDocumentId: parsed.summaryDocumentId,
      webhookUrlOverride: parsed.webhookUrlOverride,
      promptProfile: parsed.promptProfile,
      mode: parsed.mode,
    })
    return ok(result)
  } catch (error) {
    if (isError(error)) throw error
    throw apiError(500,
      'SUGGESTION_GENERATION_FAILED',
      (error as Error & { message?: string }).message || 'Unable to generate suggestions.'
    )
  }
})
