import { ok, fail } from '#server/utils/http'
import { readValidatedBodySafe } from '#server/utils/validate'
import { summarizeRequestSchema } from '#shared/schemas/summarization'
import { SummaryService } from '#server/services/summary.service'

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
