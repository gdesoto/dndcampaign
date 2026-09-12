import { validateQuery } from '#server/utils/validate'
import { ok } from '#server/utils/http'
import { requireSystemAdmin } from '#server/utils/campaign-auth'
import { adminAnalyticsUsageQuerySchema } from '#shared/schemas/admin'
import { AdminAnalyticsService } from '#server/services/admin-analytics.service'

const analyticsService = new AdminAnalyticsService()

export default defineEventHandler(async (event) => {
  const authz = await requireSystemAdmin(event)
  if (!authz.ok) {
    return authz.response
  }

  const parsed = validateQuery(event, adminAnalyticsUsageQuerySchema, 'Invalid analytics usage query parameters')
  if (!parsed.ok) return parsed.response

  const result = await analyticsService.getUsage(parsed.data)
  return ok(result)
})
