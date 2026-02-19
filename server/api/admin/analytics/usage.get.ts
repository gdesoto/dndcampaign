import { getQuery } from 'h3'
import { ok, fail } from '#server/utils/http'
import { requireSystemAdmin } from '#server/utils/campaign-auth'
import { adminAnalyticsUsageQuerySchema } from '#shared/schemas/admin'
import { AdminAnalyticsService } from '#server/services/admin-analytics.service'

const analyticsService = new AdminAnalyticsService()

export default defineEventHandler(async (event) => {
  const authz = await requireSystemAdmin(event)
  if (!authz.ok) {
    return authz.response
  }

  const parsed = adminAnalyticsUsageQuerySchema.safeParse(getQuery(event))
  if (!parsed.success) {
    return fail(event, 400, 'VALIDATION_ERROR', 'Invalid analytics usage query parameters')
  }

  const result = await analyticsService.getUsage(parsed.data)
  return ok(result)
})
