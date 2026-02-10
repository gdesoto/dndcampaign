import { ok, fail } from '#server/utils/http'
import { readValidatedBodySafe } from '#server/utils/validate'
import { generateSuggestionsRequestSchema } from '#shared/schemas/summarization'
import { SummaryService } from '#server/services/summary.service'

export default defineEventHandler(async (event) => {
  const sessionUser = await requireUserSession(event)
  const sessionId = event.context.params?.sessionId
  if (!sessionId) {
    return fail(400, 'VALIDATION_ERROR', 'Session id is required')
  }

  const parsed = await readValidatedBodySafe(event, generateSuggestionsRequestSchema)
  if (!parsed.success) {
    return fail(400, 'VALIDATION_ERROR', 'Invalid suggestion generation payload', parsed.fieldErrors)
  }

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
      500,
      'SUGGESTION_GENERATION_FAILED',
      (error as Error & { message?: string }).message || 'Unable to generate suggestions.'
    )
  }
})
