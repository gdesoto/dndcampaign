import { fail, ok } from '#server/utils/http'
import { readValidatedBodySafe } from '#server/utils/validate'
import {
  campaignRequestDecisionInputSchema,
  campaignRequestUpdateSchema,
} from '#shared/schemas/campaign-requests'
import { CampaignRequestsService } from '#server/services/campaign-requests.service'

const campaignRequestsService = new CampaignRequestsService()

export default defineEventHandler(async (event) => {
  const campaignId = event.context.params?.campaignId
  const requestId = event.context.params?.requestId
  if (!campaignId || !requestId) {
    return fail(event, 400, 'VALIDATION_ERROR', 'Campaign id and request id are required')
  }

  const rawBody = ((await readBody(event).catch(() => null)) ?? {}) as Record<string, unknown>
  const action = typeof rawBody.action === 'string' ? rawBody.action : null
  const sessionUser = await requireUserSession(event)

  if (action === 'cancel') {
    const result = await campaignRequestsService.cancelRequest(
      campaignId,
      requestId,
      sessionUser.user.id,
      sessionUser.user.systemRole,
    )
    if (!result.ok) {
      return fail(event, result.statusCode, result.code, result.message, result.fields)
    }
    return ok(result.data)
  }

  if (action === 'decision') {
    const decisionParsed = campaignRequestDecisionInputSchema.safeParse(rawBody)
    if (!decisionParsed.success) {
      const fields: Record<string, string> = {}
      for (const issue of decisionParsed.error.issues) {
        const key = issue.path.join('.') || 'decision'
        fields[key] = issue.message
      }
      return fail(event, 400, 'VALIDATION_ERROR', 'Invalid request decision payload', fields)
    }

    const result = await campaignRequestsService.decideRequest(
      campaignId,
      requestId,
      sessionUser.user.id,
      decisionParsed.data,
      sessionUser.user.systemRole,
    )
    if (!result.ok) {
      return fail(event, result.statusCode, result.code, result.message, result.fields)
    }
    return ok(result.data)
  }

  const parsed = await readValidatedBodySafe(event, campaignRequestUpdateSchema)
  if (!parsed.success) {
    return fail(event, 400, 'VALIDATION_ERROR', 'Invalid request update payload', parsed.fieldErrors)
  }

  const result = await campaignRequestsService.updateRequest(
    campaignId,
    requestId,
    sessionUser.user.id,
    parsed.data,
    sessionUser.user.systemRole,
  )
  if (!result.ok) {
    return fail(event, result.statusCode, result.code, result.message, result.fields)
  }

  return ok(result.data)
})
